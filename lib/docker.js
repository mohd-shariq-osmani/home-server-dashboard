const http = require('http');
const fs = require('fs');
const { formatBytes } = require('./system');

// In-memory cache for per-container stats to keep API requests sub-50ms
const containerStatsCache = new Map();
let lastStatsFetchTime = 0;
let isFetchingStats = false;

function queryDockerSocket(path, socketPath, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path,
        method: 'GET',
        headers: { Host: 'docker' },
        timeout: timeoutMs
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse Docker response: ${err.message}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Docker socket timeout'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

function parseMemoryStats(stats) {
  try {
    const mem = stats.memory_stats;
    if (!mem || !mem.usage) return { usageBytes: null, usageFormatted: null, percent: null };
    const cache = mem.stats?.cache || 0;
    const usage = Math.max(0, mem.usage - cache);
    const limit = mem.limit || 0;
    const percent = limit > 0 ? Math.round((usage / limit) * 1000) / 10 : null;
    return {
      usageBytes: usage,
      usageFormatted: formatBytes(usage),
      percent
    };
  } catch {
    return { usageBytes: null, usageFormatted: null, percent: null };
  }
}

async function updateStatsCacheBackground(containers, socketPath) {
  if (isFetchingStats) return;
  isFetchingStats = true;
  lastStatsFetchTime = Date.now();

  try {
    const running = containers.filter(c => c.State === 'running');
    // Query stats sequentially or in batches of 3 to avoid socket saturation
    for (const c of running) {
      try {
        const stats = await queryDockerSocket(`/containers/${c.Id}/stats?stream=false`, socketPath, 2000);
        const mem = parseMemoryStats(stats);
        containerStatsCache.set(c.Id.slice(0, 12), {
          memory: mem,
          updatedAt: Date.now()
        });
      } catch {
        // ignore individual container stat failure
      }
    }
  } finally {
    isFetchingStats = false;
  }
}

async function getDockerStats(config) {
  const socketPath = config.docker?.socketPath || '/var/run/docker.sock';

  if (!fs.existsSync(socketPath)) {
    return {
      available: false,
      online: false,
      runningCount: 0,
      stoppedCount: 0,
      totalCount: 0,
      statusText: 'Docker offline',
      subtitle: 'daemon not found',
      containers: []
    };
  }

  try {
    const rawContainers = await queryDockerSocket('/containers/json?all=1', socketPath, 2000);

    if (!Array.isArray(rawContainers)) {
      return {
        available: false,
        online: false,
        runningCount: 0,
        stoppedCount: 0,
        totalCount: 0,
        statusText: 'offline',
        subtitle: 'unexpected response',
        containers: []
      };
    }

    const runningContainers = rawContainers.filter(c => c.State === 'running');
    const stoppedContainers = rawContainers.filter(c => c.State !== 'running');

    // Trigger background stats refresh if older than 15s
    if (Date.now() - lastStatsFetchTime > 15000 && !isFetchingStats) {
      updateStatsCacheBackground(rawContainers, socketPath).catch(() => {});
    }

    const containers = rawContainers.map((container) => {
      const shortId = container.Id.slice(0, 12);
      const cached = containerStatsCache.get(shortId);
      const rawName = (container.Names && container.Names[0]) || shortId;
      const cleanName = rawName.replace(/^\//, '');

      return {
        id: shortId,
        name: cleanName,
        image: container.Image,
        state: container.State, // 'running', 'exited', etc.
        status: container.Status, // 'Up 3 days', etc.
        created: container.Created,
        ports: (container.Ports || [])
          .filter(p => p.PublicPort)
          .map(p => `${p.PublicPort}:${p.PrivatePort}`)
          .join(', '),
        memory: cached ? cached.memory : { usageBytes: null, usageFormatted: null, percent: null }
      };
    });

    const runningCount = runningContainers.length;
    const stoppedCount = stoppedContainers.length;
    const totalCount = rawContainers.length;

    return {
      available: true,
      online: runningCount > 0,
      runningCount,
      stoppedCount,
      totalCount,
      statusText: runningCount > 0 ? 'online' : 'idle',
      subtitle: `${runningCount} running${stoppedCount > 0 ? ` · ${stoppedCount} stopped` : ''}`,
      containers
    };
  } catch (err) {
    return {
      available: false,
      online: false,
      runningCount: 0,
      stoppedCount: 0,
      totalCount: 0,
      statusText: 'offline',
      subtitle: err.code === 'EACCES' ? 'permission denied' : 'offline',
      containers: []
    };
  }
}

module.exports = {
  getDockerStats
};
