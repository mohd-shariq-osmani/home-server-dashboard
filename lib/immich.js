const http = require('http');
const { exec } = require('child_process');

function fetchImmichJson(port, endpointPath, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: endpointPath,
        timeout: timeoutMs,
        headers: { 'Accept': 'application/json', 'User-Agent': 'HomeServerMonitor/1.0' }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data), error: null });
          } catch (err) {
            resolve({ statusCode: res.statusCode, data: null, error: err.message });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: null, data: null, error: 'Timeout' });
    });

    req.on('error', (err) => {
      resolve({ statusCode: null, data: null, error: err.message });
    });
  });
}

function getImmichContainers(socketPath = '/var/run/docker.sock') {
  return new Promise((resolve) => {
    const req = http.request(
      {
        socketPath,
        path: '/containers/json?all=1',
        method: 'GET',
        headers: { Host: 'docker' },
        timeout: 2000
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const list = JSON.parse(data);
            const immich = list
              .filter(c => Array.isArray(c.Names) && c.Names.some(n => n.includes('immich')))
              .map(c => {
                const rawName = c.Names[0] || '';
                const cleanName = rawName.startsWith('/') ? rawName.slice(1) : rawName;
                return {
                  name: cleanName,
                  state: c.State || 'unknown',
                  status: c.Status || 'unknown',
                  healthy: (c.Status || '').includes('(healthy)') || c.State === 'running'
                };
              });
            resolve(immich);
          } catch {
            fallbackCliContainers().then(resolve);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      fallbackCliContainers().then(resolve);
    });

    req.on('error', () => {
      fallbackCliContainers().then(resolve);
    });

    req.end();
  });
}

function fallbackCliContainers() {
  return new Promise((resolve) => {
    exec('docker ps -a --filter "name=immich" --format "{{.Names}}\t{{.State}}\t{{.Status}}"', { timeout: 2000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const lines = stdout.trim().split('\n').filter(Boolean);
      const list = lines.map(line => {
        const [name, state, status] = line.split('\t');
        return {
          name: name || '',
          state: state || 'unknown',
          status: status || 'unknown',
          healthy: (status || '').includes('(healthy)') || state === 'running'
        };
      });
      resolve(list);
    });
  });
}

/**
 * Main telemetry fetcher for Immich Server
 */
async function getImmichStats(config = {}) {
  const immichConfig = config.immich || {};
  const port = immichConfig.port || 2283;
  const socketPath = config.docker?.socketPath || '/var/run/docker.sock';
  const storagePath = immichConfig.storagePath || '/Volumes/Storage/immich-server';
  const externalLibraries = immichConfig.externalLibraries || [];

  const startTime = Date.now();
  const [pingRes, verRes, featRes, containers] = await Promise.all([
    fetchImmichJson(port, '/api/server/ping', 2000),
    fetchImmichJson(port, '/api/server/version', 2000),
    fetchImmichJson(port, '/api/server/features', 2000),
    getImmichContainers(socketPath)
  ]);
  const latencyMs = Date.now() - startTime;

  const online = pingRes.statusCode === 200 && pingRes.data?.res === 'pong';

  let versionFormatted = 'v3.x';
  if (verRes.data && typeof verRes.data.major === 'number') {
    versionFormatted = `v${verRes.data.major}.${verRes.data.minor}.${verRes.data.patch}`;
  }

  const mlContainer = containers.find(c => c.name.includes('machine_learning'));
  const mlOnline = !!mlContainer && mlContainer.state === 'running';

  const features = featRes.data || {
    smartSearch: true,
    facialRecognition: true,
    duplicateDetection: true,
    ocr: true
  };

  return {
    online,
    port,
    version: versionFormatted,
    latencyMs: online ? latencyMs : null,
    mlOnline,
    mlStatus: mlContainer ? mlContainer.status : (online ? 'ready' : 'offline'),
    containersCount: containers.length,
    containers,
    features: {
      smartSearch: !!features.smartSearch,
      facialRecognition: !!features.facialRecognition,
      duplicateDetection: !!features.duplicateDetection,
      ocr: !!features.ocr,
      sidecar: !!features.sidecar,
      reverseGeocoding: !!features.reverseGeocoding
    },
    storagePath,
    externalLibraries
  };
}

module.exports = {
  getImmichStats
};
