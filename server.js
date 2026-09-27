const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { exec } = require('child_process');

const { getSystemStats } = require('./lib/system');
const { checkAllServices } = require('./lib/services');
const { getDockerStats } = require('./lib/docker');
const { getNgrokStatus } = require('./lib/ngrok');
const { getTopRamProcesses, getTopCpuProcesses } = require('./lib/ramProcesses');
const { getLmStudioModels, loadLmStudioModel, unloadLmStudioModels } = require('./lib/lmstudio');
const { getQBittorrentStats, stopTorrent, startTorrent, deleteTorrent } = require('./lib/qbittorrent');
const { getAdGuardStats } = require('./lib/adguard');
const { getImmichStats } = require('./lib/immich');
const { getJellyfinStats, refreshAllLibraries } = require('./lib/jellyfin');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Warning: could not read config.json, using defaults:', err.message);
  config = {
    server: { name: 'mini-server', port: 3001, host: '0.0.0.0', refreshIntervalMs: 5000 },
    auth: { enabled: true, type: 'pin', pin: '1234', sessionDurationDays: 365, apiToken: 'change-me-to-a-secure-token' },
    storage: { bootMount: '/', externalDrives: [{ name: 'external hdd', mount: '/Volumes/ExternalDrive' }] },
    docker: { enabled: true, socketPath: '/var/run/docker.sock' }
  };
}

// Session secret and token hash
const SESSION_SECRET = config.auth?.sessionSecret || process.env.SESSION_SECRET || 'homeserver-default-session-secret';
const PIN_CODE = String(config.auth?.pin || process.env.PIN || '1234');
const VALID_SESSION_TOKEN = crypto.createHmac('sha256', SESSION_SECRET).update(PIN_CODE).digest('hex');

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

let serverPublicIp = null;

function updateServerPublicIp() {
  https.get('https://api.ipify.org', { timeout: 3000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const ip = data.trim();
      if (ip && /^[\d.]+$/.test(ip)) {
        serverPublicIp = ip;
      }
    });
  }).on('error', () => {});
}
updateServerPublicIp();
setInterval(updateServerPublicIp, 5 * 60 * 1000);

function getNetworkInfo() {
  const nets = os.networkInterfaces();
  let lanIp = null;
  let tailscaleIp = null;

  if (nets.en0) {
    const v4 = nets.en0.find(n => n.family === 'IPv4' && !n.internal);
    if (v4) lanIp = v4.address;
  }

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('100.')) {
          tailscaleIp = net.address;
        } else if (!lanIp && (net.address.startsWith('192.168.') || net.address.startsWith('10.'))) {
          lanIp = net.address;
        }
      }
    }
  }

  return {
    lanIp: lanIp || '127.0.0.1',
    tailscaleIp: tailscaleIp || null,
    tailscaleDns: config.network?.tailscaleDns || null
  };
}

function getLocalLanIp() {
  return getNetworkInfo().lanIp;
}

function isAuthenticated(req) {
  if (!config.auth || !config.auth.enabled) return true;

  // 1. Check Session Cookie
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.hs_session === VALID_SESSION_TOKEN) {
    return true;
  }

  // 2. Check Query parameter ?pin=...
  if (req.query.pin && String(req.query.pin) === PIN_CODE) {
    return true;
  }

  // 3. Check Query parameter ?token=... or Header Bearer
  const queryToken = req.query.token;
  const authHeader = req.headers.authorization;
  if (queryToken && (queryToken === config.auth.apiToken || queryToken === PIN_CODE)) {
    return true;
  }
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer === config.auth.apiToken || bearer === PIN_CODE || bearer === VALID_SESSION_TOKEN) {
      return true;
    }
  }

  return false;
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || config.server?.port || 3001;

// Light rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// JSON body parser for POST requests
app.use(express.json());

// Public health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Authentication Status & Verification endpoints
app.get('/api/auth/status', (req, res) => {
  const authed = isAuthenticated(req);
  res.json({ authenticated: authed });
});

app.post('/api/auth/verify', (req, res) => {
  const { pin } = req.body;
  if (String(pin) === PIN_CODE) {
    const maxAgeSec = (config.auth.sessionDurationDays || 365) * 86400;
    res.setHeader('Set-Cookie', `hs_session=${VALID_SESSION_TOKEN}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly`);
    return res.json({ success: true, message: 'Authentication successful' });
  }
  return res.status(401).json({ success: false, error: 'Incorrect PIN' });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'hs_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Auto-login & cookie drop if ?pin=... is passed in browser URL
app.use((req, res, next) => {
  if (req.query.pin && String(req.query.pin) === PIN_CODE) {
    const maxAgeSec = (config.auth.sessionDurationDays || 365) * 86400;
    res.setHeader('Set-Cookie', `hs_session=${VALID_SESSION_TOKEN}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly`);
    if (req.method === 'GET' && (req.path === '/' || req.path === '')) {
      return res.redirect('/');
    }
  }
  next();
});

// ComfyUI Reverse Proxy (Works locally and via ngrok on phones!)
const comfyProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:8188',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/comfyui': ''
  },
  on: {
    error: (err, req, res) => {
      console.error('ComfyUI Proxy Error:', err.message);
      if (res && res.writeHead) {
        res.writeHead(502, { 'Content-Type': 'text/html' });
        res.end(`
          <div style="font-family:sans-serif;background:#0d0f12;color:#f3f4f6;padding:40px;text-align:center;">
            <h2>ComfyUI is Offline or Starting Up</h2>
            <p style="color:#9ca3af;">Could not connect to ComfyUI on port 8188.</p>
            <a href="/" style="color:#3b82f6;">&larr; Return to Dashboard</a>
          </div>
        `);
      }
    }
  }
});

app.use('/comfyui', (req, res, next) => {
  if (req.originalUrl === '/comfyui') {
    return res.redirect(301, '/comfyui/');
  }
  if (!isAuthenticated(req)) {
    return res.redirect('/?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}, comfyProxy);

// Protect API routes
const requireApiAuth = (req, res, next) => {
  if (isAuthenticated(req)) {
    return next();
  }
  return res.status(401).json({ authenticated: false, error: 'Authentication required. Please enter PIN.' });
};

app.use('/api/', apiLimiter);

// Dashboard Configuration
app.get('/api/config', (req, res) => {
  const netInfo = getNetworkInfo();
  const hostHeader = (req.headers.host || '').toLowerCase();
  const remoteIp = req.socket.remoteAddress || '';
  const xForwardedFor = req.headers['x-forwarded-for'] || '';
  const clientPublicIp = xForwardedFor.split(',')[0].trim();

  let detectedNetwork = 'lan';
  let dynamicHost = netInfo.lanIp;

  // 1. Direct Tailscale connection
  if (hostHeader.startsWith('100.') || hostHeader.includes('.ts.net') || (netInfo.tailscaleDns && hostHeader.includes(netInfo.tailscaleDns)) || (remoteIp && remoteIp.includes('100.'))) {
    detectedNetwork = 'tailscale';
    dynamicHost = netInfo.tailscaleIp || netInfo.lanIp;
  }
  // 2. Direct LAN connection
  else if (hostHeader.startsWith('192.168.') || hostHeader.startsWith('10.') || hostHeader.startsWith('127.') || hostHeader.startsWith('localhost') || remoteIp.startsWith('192.168.')) {
    detectedNetwork = 'lan';
    dynamicHost = netInfo.lanIp;
  }
  // 3. Ngrok tunnel connection
  else if (hostHeader.includes('ngrok')) {
    // If client public IP matches server home public IP, client is connected to HOME WI-FI!
    if (clientPublicIp && serverPublicIp && clientPublicIp === serverPublicIp) {
      detectedNetwork = 'lan';
      dynamicHost = netInfo.lanIp;
    } else {
      // Client is on an outside network (cellular data, external Wi-Fi)
      detectedNetwork = 'tailscale';
      dynamicHost = netInfo.tailscaleIp || netInfo.lanIp;
    }
  }

  res.json({
    serverName: config.server?.name || 'mini-server',
    refreshIntervalMs: config.server?.refreshIntervalMs || 5000,
    serverLanIp: netInfo.lanIp,
    tailscaleIp: netInfo.tailscaleIp,
    tailscaleDns: netInfo.tailscaleDns,
    clientIp: clientPublicIp || remoteIp,
    serverPublicIp,
    detectedNetwork, // 'lan' | 'tailscale'
    dynamicHost,     // LAN when at home, Tailscale when outside
    suggestedHost: dynamicHost,
    services: {
      lmStudioPort: config.services?.find(s => s.id === 'lmstudio')?.port || 1234,
      comfyUiPort: config.services?.find(s => s.id === 'comfyui')?.port || 8188,
      n8nPort: config.services?.find(s => s.id === 'n8n')?.port || 5678,
      n8nPublicUrl: config.services?.find(s => s.id === 'n8n')?.publicUrl || null,
      qbittorrentPort: config.qbittorrent?.port || 8080,
      adguardPort: config.adguard?.webPort || 81,
      immichPort: config.immich?.port || 2283,
      jellyfinPort: config.jellyfin?.port || 8096
    },
    version: '1.5.0'
  });
});

// Protected Stats API
app.get('/api/stats', requireApiAuth, async (req, res) => {
  try {
    const [systemStats, serviceResults, dockerStats, ngrokStatus, topRamProcesses, topCpuProcesses, qbtStats, adguardStats, immichStats, jellyfinStats] = await Promise.all([
      getSystemStats(config),
      checkAllServices(config),
      config.docker?.enabled !== false ? getDockerStats(config) : Promise.resolve(null),
      config.ngrok?.enabled !== false ? getNgrokStatus(config) : Promise.resolve(null),
      getTopRamProcesses(10),
      getTopCpuProcesses(10),
      config.qbittorrent?.enabled !== false ? getQBittorrentStats(config) : Promise.resolve(null),
      config.adguard?.enabled !== false ? getAdGuardStats(config) : Promise.resolve(null),
      config.immich?.enabled !== false ? getImmichStats(config) : Promise.resolve(null),
      config.jellyfin?.enabled !== false ? getJellyfinStats(config) : Promise.resolve(null)
    ]);

    res.json({
      timestamp: Date.now(),
      server: {
        name: config.server?.name || 'mini-server',
        online: true,
        uptime: systemStats.uptime
      },
      metrics: {
        cpu: {
          ...systemStats.cpu,
          topProcesses: topCpuProcesses
        },
        ram: {
          ...systemStats.ram,
          topProcesses: topRamProcesses
        },
        internalSsd: systemStats.internalSsd,
        externalDrives: systemStats.externalDrives
      },
      services: serviceResults.services,
      arrSuite: serviceResults.arrSuite,
      docker: dockerStats,
      ngrok: ngrokStatus,
      lmStudio: serviceResults.lmStudioDetails,
      comfyUi: serviceResults.comfyUiDetails,
      n8n: serviceResults.n8nDetails,
      qbittorrent: qbtStats,
      adguard: adguardStats,
      immich: immichStats,
      jellyfin: jellyfinStats
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to retrieve server metrics', message: err.message });
  }
});

// Mac Mini System Power Management APIs
app.post('/api/system/restart', requireApiAuth, (req, res) => {
  res.json({ success: true, message: 'Mac Mini is restarting...' });
  setTimeout(() => {
    exec("osascript -e 'tell application \"System Events\" to restart'", (err) => {
      if (err) console.error('Error initiating restart:', err);
    });
  }, 600);
});

app.post('/api/system/shutdown', requireApiAuth, (req, res) => {
  res.json({ success: true, message: 'Mac Mini is powering off...' });
  setTimeout(() => {
    exec("osascript -e 'tell application \"System Events\" to shut down'", (err) => {
      if (err) console.error('Error initiating shutdown:', err);
    });
  }, 600);
});

// qBittorrent Torrent Management APIs
app.get('/api/qbittorrent/stats', requireApiAuth, async (req, res) => {
  try {
    const data = await getQBittorrentStats(config);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/qbittorrent/stop', requireApiAuth, async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'hash is required' });
    const result = await stopTorrent(hash, config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/qbittorrent/start', requireApiAuth, async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'hash is required' });
    const result = await startTorrent(hash, config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/qbittorrent/delete', requireApiAuth, async (req, res) => {
  try {
    const { hash, deleteFiles } = req.body;
    if (!hash) return res.status(400).json({ error: 'hash is required' });
    const result = await deleteTorrent(hash, !!deleteFiles, config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LM Studio Model Management APIs
app.get('/api/lmstudio/models', requireApiAuth, async (req, res) => {
  try {
    const data = await getLmStudioModels();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lmstudio/load', requireApiAuth, async (req, res) => {
  try {
    const { modelKey } = req.body;
    if (!modelKey) return res.status(400).json({ error: 'modelKey is required' });
    const result = await loadLmStudioModel(modelKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lmstudio/unload', requireApiAuth, async (req, res) => {
  try {
    const result = await unloadLmStudioModels();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Jellyfin Media Server APIs
app.post('/api/jellyfin/refresh', requireApiAuth, async (req, res) => {
  try {
    const result = await refreshAllLibraries(config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start HTTP server & bind WebSocket upgrade for ComfyUI
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` HomeServer Monitor running on port ${PORT}`);
  console.log(` Server Name: ${config.server?.name || 'mini-server'}`);
  console.log(` Auth Type: PIN (Protected)`);
  console.log(` LAN IP: http://${getLocalLanIp()}:${PORT}`);
  console.log(` ComfyUI Proxy: http://localhost:${PORT}/comfyui/`);
  console.log(`====================================================`);
});

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/comfyui')) {
    comfyProxy.upgrade(req, socket, head);
  }
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\nTerminating server...');
  server.close(() => process.exit(0));
});
