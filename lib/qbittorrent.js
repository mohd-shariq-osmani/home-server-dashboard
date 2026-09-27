const http = require('http');
const { formatBytes } = require('./system');

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
  return formatBytes(bytesPerSec) + '/s';
}

function formatEta(seconds) {
  if (!seconds || seconds <= 0 || seconds >= 8640000) return '∞';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

function qbtRequest(path, method = 'GET', postData = null, config = {}) {
  return new Promise((resolve) => {
    const qbtConfig = config.qbittorrent || {};
    const port = qbtConfig.port || 8080;
    const apiKey = qbtConfig.apiKey || '';

    const headers = {
      'Accept': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (postData) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers,
        timeout: 3000
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ ok: true, data: data ? JSON.parse(data) : null, raw: data });
            } catch {
              resolve({ ok: true, data: null, raw: data });
            }
          } else {
            resolve({ ok: false, statusCode: res.statusCode, error: data || `HTTP ${res.statusCode}` });
          }
        });
      }
    );

    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function getQBittorrentStats(config = {}) {
  const [transferRes, torrentsRes] = await Promise.all([
    qbtRequest('/api/v2/transfer/info', 'GET', null, config),
    qbtRequest('/api/v2/torrents/info', 'GET', null, config)
  ]);

  if (!transferRes.ok && !torrentsRes.ok) {
    return {
      online: false,
      error: transferRes.error || torrentsRes.error || 'Cannot connect to qBittorrent on port 8080'
    };
  }

  const transfer = transferRes.data || {};
  const rawTorrents = Array.isArray(torrentsRes.data) ? torrentsRes.data : [];

  const torrents = rawTorrents.map(t => {
    const progressPct = Math.round((t.progress || 0) * 100);
    const isPaused = typeof t.state === 'string' && t.state.toLowerCase().includes('paused');
    const isDownloading = typeof t.state === 'string' && t.state.toLowerCase().includes('dl') && !isPaused;

    return {
      hash: t.hash,
      name: t.name,
      sizeBytes: t.size,
      sizeFormatted: formatBytes(t.size),
      progress: progressPct,
      state: t.state,
      isDownloading,
      isPaused,
      dlSpeed: t.dlspeed || 0,
      dlSpeedFormatted: formatSpeed(t.dlspeed),
      upSpeed: t.upspeed || 0,
      upSpeedFormatted: formatSpeed(t.upspeed),
      eta: t.eta,
      etaFormatted: formatEta(t.eta),
      numSeeds: t.num_seeds,
      numLeechs: t.num_leechs,
      category: t.category,
      addedOn: t.added_on
    };
  });

  const activeDownloading = torrents.filter(t => t.isDownloading || (t.dlSpeed > 0));
  const paused = torrents.filter(t => t.isPaused);

  return {
    online: true,
    connectionStatus: transfer.connection_status || 'connected',
    dlSpeed: transfer.dl_info_speed || 0,
    dlSpeedFormatted: formatSpeed(transfer.dl_info_speed),
    upSpeed: transfer.up_info_speed || 0,
    upSpeedFormatted: formatSpeed(transfer.up_info_speed),
    dlTotalFormatted: formatBytes(transfer.dl_info_data),
    upTotalFormatted: formatBytes(transfer.up_info_data),
    downloadingCount: activeDownloading.length,
    pausedCount: paused.length,
    totalCount: torrents.length,
    torrents
  };
}

async function stopTorrent(hash, config = {}) {
  const postData = `hashes=${encodeURIComponent(hash)}`;
  return qbtRequest('/api/v2/torrents/stop', 'POST', postData, config);
}

async function startTorrent(hash, config = {}) {
  const postData = `hashes=${encodeURIComponent(hash)}`;
  return qbtRequest('/api/v2/torrents/start', 'POST', postData, config);
}

async function deleteTorrent(hash, deleteFiles = false, config = {}) {
  const postData = `hashes=${encodeURIComponent(hash)}&deleteFiles=${deleteFiles ? 'true' : 'false'}`;
  return qbtRequest('/api/v2/torrents/delete', 'POST', postData, config);
}

module.exports = {
  getQBittorrentStats,
  stopTorrent,
  startTorrent,
  deleteTorrent,
  formatSpeed,
  formatEta
};
