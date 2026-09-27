const http = require('http');
const https = require('https');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { formatBytes } = require('./system');

/**
 * Pings an HTTP/HTTPS URL and measures response latency.
 */
function checkHttpService(urlStr, timeoutMs = 2500) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      return resolve({
        online: false,
        latencyMs: null,
        statusCode: null,
        error: 'Invalid URL'
      });
    }

    const client = url.protocol === 'https:' ? https : http;
    const startTime = Date.now();

    const req = client.request(
      url,
      {
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'HomeServerMonitor/1.0',
          'Accept': '*/*'
        }
      },
      (res) => {
        const latencyMs = Date.now() - startTime;
        res.resume();
        resolve({
          online: true,
          latencyMs,
          statusCode: res.statusCode,
          error: null
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ online: false, latencyMs: null, statusCode: null, error: 'Timeout' });
    });

    req.on('error', (err) => {
      resolve({ online: false, latencyMs: null, statusCode: null, error: err.code || err.message });
    });

    req.end();
  });
}

/**
 * LM Studio detailed metrics: Loaded model, status, tokens/sec.
 */
function getLMStudioDetails() {
  return new Promise((resolve) => {
    const lmsCliPath = path.join(os.homedir(), '.lmstudio', 'bin', 'lms');
    const lmsCmd = fs.existsSync(lmsCliPath) ? `"${lmsCliPath}" ps --json` : 'lms ps --json';
    exec(lmsCmd, { timeout: 2500 }, (err, stdout) => {
      let loadedModel = null;
      if (!err && stdout) {
        try {
          const models = JSON.parse(stdout);
          if (Array.isArray(models) && models.length > 0) {
            const m = models[0];
            loadedModel = {
              displayName: m.displayName || m.modelKey,
              modelKey: m.modelKey,
              architecture: m.architecture,
              quantization: m.quantization?.name || (typeof m.quantization === 'string' ? m.quantization : 'Unknown'),
              sizeFormatted: m.sizeBytes ? formatBytes(m.sizeBytes) : null,
              status: m.status || 'idle', // 'idle' | 'generating'
              queued: m.queued || 0,
              parallel: m.parallel || 1,
              contextLength: m.contextLength,
              maxContextLength: m.maxContextLength
            };
          }
        } catch {
          // Fall through
        }
      }

      // 2. Extract latest tokens per second from server logs
      let speed = { evalTps: null, promptTps: null };
      try {
        const logsDir = path.join(os.homedir(), '.lmstudio', 'server-logs');
        if (fs.existsSync(logsDir)) {
          const monthDirs = fs.readdirSync(logsDir).filter(d => !d.startsWith('.')).sort().reverse();
          if (monthDirs.length > 0) {
            const latestMonthPath = path.join(logsDir, monthDirs[0]);
            const logFiles = fs.readdirSync(latestMonthPath).filter(f => f.endsWith('.log')).sort().reverse();
            if (logFiles.length > 0) {
              const latestLog = path.join(latestMonthPath, logFiles[0]);
              const fd = fs.openSync(latestLog, 'r');
              const stat = fs.fstatSync(fd);
              const readSize = Math.min(64 * 1024, stat.size);
              const buffer = Buffer.alloc(readSize);
              fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
              fs.closeSync(fd);

              const lines = buffer.toString('utf8').split('\n');
              for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (!speed.evalTps && line.includes('eval time') && !line.includes('prompt eval time')) {
                  const match = line.match(/([\d.]+)\s*tokens per second/);
                  if (match) speed.evalTps = parseFloat(match[1]);
                }
                if (!speed.promptTps && line.includes('prompt eval time')) {
                  const match = line.match(/([\d.]+)\s*tokens per second/);
                  if (match) speed.promptTps = parseFloat(match[1]);
                }
                if (speed.evalTps && speed.promptTps) break;
              }
            }
          }
        }
      } catch {
        // Non-fatal
      }

      resolve({
        loadedModel,
        speed,
        hasActiveModel: !!loadedModel,
        isGenerating: loadedModel?.status === 'generating' || loadedModel?.status === 'busy'
      });
    });
  });
}

/**
 * ComfyUI detailed metrics: running & queued activities, device status.
 */
function getComfyUiDetails() {
  return new Promise((resolve) => {
    const queueReq = http.request(
      { host: '127.0.0.1', port: 8188, path: '/queue', method: 'GET', timeout: 2000 },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const q = JSON.parse(data);
            const running = q.queue_running || [];
            const pending = q.queue_pending || [];

            resolve({
              runningCount: running.length,
              pendingCount: pending.length,
              totalActive: running.length + pending.length,
              runningJobs: running.map((job, idx) => ({
                id: job[1] || `job-${idx}`,
                number: job[0]
              }))
            });
          } catch {
            resolve({ runningCount: 0, pendingCount: 0, totalActive: 0, runningJobs: [] });
          }
        });
      }
    );

    queueReq.on('timeout', () => { queueReq.destroy(); resolve(null); });
    queueReq.on('error', () => resolve(null));
    queueReq.end();
  });
}

/**
 * n8n detailed metrics: last 10 running, failed, and error executions.
 */
function getN8nDetails(config = {}) {
  return new Promise((resolve) => {
    const n8nScript = 'const { DatabaseSync } = require("node:sqlite");\nconst db = new DatabaseSync("/home/node/.n8n/database.sqlite", { open: true, readOnly: true });\nconst rows = db.prepare("SELECT e.id, e.workflowId, w.name as workflowName, e.status, e.startedAt, e.stoppedAt, e.mode FROM execution_entity e LEFT JOIN workflow_entity w ON e.workflowId = w.id WHERE e.status IN (\x27running\x27, \x27error\x27, \x27failed\x27, \x27crashed\x27) ORDER BY e.startedAt DESC LIMIT 10").all();\nconst counts = db.prepare("SELECT status, count(*) as count FROM execution_entity GROUP BY status").all();\nconsole.log(JSON.stringify({ executions: rows, counts }));';
    const containerName = config?.n8n?.containerName || 'discord-n8n-n8n-1';

    const child = spawn('docker', ['exec', '-i', containerName, 'node', '--experimental-sqlite', '-'], {
      timeout: 3500
    });

    let stdout = '';
    child.stdout.on('data', d => stdout += d);

    child.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          const parsed = JSON.parse(stdout);
          const counts = parsed.counts || [];
          const runningCount = counts.find(c => c.status === 'running')?.count || 0;
          const failedCount = (counts.find(c => c.status === 'error')?.count || 0) + (counts.find(c => c.status === 'failed')?.count || 0);

          resolve({
            available: true,
            runningCount,
            failedCount,
            executions: parsed.executions || []
          });
        } catch {
          resolve({ available: false, runningCount: 0, failedCount: 0, executions: [] });
        }
      } else {
        resolve({ available: false, runningCount: 0, failedCount: 0, executions: [] });
      }
    });

    child.on('error', () => {
      resolve({ available: false, runningCount: 0, failedCount: 0, executions: [] });
    });

    child.stdin.end(n8nScript);
  });
}

async function checkAllServices(config) {
  const serviceList = config.services || [];
  const arrConfig = config.arrSuite;

  // Concurrently fetch health checks + deep integrations
  const [serviceResults, arrResult, lmStudioDetails, comfyUiDetails, n8nDetails] = await Promise.all([
    Promise.all(serviceList.map(async (svc) => {
      const result = await checkHttpService(svc.url, svc.timeoutMs || 2500);
      return {
        id: svc.id,
        name: svc.name,
        port: svc.port,
        url: svc.url,
        online: result.online,
        latencyMs: result.latencyMs,
        statusCode: result.statusCode,
        error: result.error,
        subtitle: result.online
          ? `port ${svc.port}${result.latencyMs != null ? ` · ${result.latencyMs}ms` : ''}`
          : `port ${svc.port} · offline`
      };
    })),
    // Arr suite
    (async () => {
      if (!arrConfig || !Array.isArray(arrConfig.services)) return null;
      const arrServices = await Promise.all(arrConfig.services.map(async (svc) => {
        const res = await checkHttpService(svc.url, svc.timeoutMs || 2500);
        return {
          id: svc.id,
          name: svc.name,
          port: svc.port,
          url: svc.url,
          online: res.online,
          latencyMs: res.latencyMs,
          statusCode: res.statusCode,
          error: res.error
        };
      }));
      const onlineCount = arrServices.filter(s => s.online).length;
      const totalCount = arrServices.length;
      const status = onlineCount === totalCount && totalCount > 0 ? 'online' : (onlineCount > 0 ? 'warning' : 'offline');
      return {
        id: arrConfig.id || 'arrsuite',
        name: arrConfig.name || 'Arr suite',
        status,
        online: onlineCount > 0,
        onlineCount,
        totalCount,
        subtitle: `${onlineCount} of ${totalCount} up`,
        services: arrServices
      };
    })(),
    getLMStudioDetails(),
    getComfyUiDetails(),
    getN8nDetails(config)
  ]);

  // Enrich specific service objects with their deep telemetry
  const enrichedServices = serviceResults.map(s => {
    if (s.id === 'lmstudio') {
      const model = lmStudioDetails?.loadedModel;
      let extraSub = s.subtitle;
      if (model) {
        extraSub = `${model.displayName.split(' ')[0]} · ${model.status}`;
        if (lmStudioDetails?.speed?.evalTps) {
          extraSub += ` · ${lmStudioDetails.speed.evalTps} tok/s`;
        }
      }
      return {
        ...s,
        subtitle: extraSub,
        details: lmStudioDetails
      };
    }

    if (s.id === 'comfyui') {
      let extraSub = s.subtitle;
      if (comfyUiDetails) {
        extraSub = `${comfyUiDetails.runningCount} running · ${comfyUiDetails.pendingCount} queued`;
      }
      return {
        ...s,
        subtitle: extraSub,
        details: comfyUiDetails
      };
    }

    if (s.id === 'n8n') {
      let extraSub = s.subtitle;
      if (n8nDetails?.available) {
        extraSub = `${n8nDetails.runningCount} running · ${n8nDetails.failedCount} error/failed`;
      }
      return {
        ...s,
        subtitle: extraSub,
        details: n8nDetails
      };
    }

    return s;
  });

  return {
    services: enrichedServices,
    arrSuite: arrResult,
    lmStudioDetails,
    comfyUiDetails,
    n8nDetails
  };
}

module.exports = {
  checkHttpService,
  checkAllServices,
  getLMStudioDetails,
  getComfyUiDetails,
  getN8nDetails
};
