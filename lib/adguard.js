const http = require('http');
const dns = require('dns');
const fs = require('fs');

/**
 * AdGuard Home Integration for HomeServer
 * Monitors DNS service on port 53 and Web Management UI on port 81.
 */

// Cache parsed log data so we don't read the disk on every single poll
let cachedLogData = {
  rulesCount: 180314,
  version: 'v0.107.79',
  upstream: 'Quad9 (DoH)',
  lastChecked: 0
};

/**
 * Reads the latest filter rule count and version from AdGuard Home logs.
 */
function getLogTelemetry(logPath = '/var/log/AdGuardHome.stderr.log') {
  const now = Date.now();
  if (now - cachedLogData.lastChecked < 60000 && cachedLogData.rulesCount > 0) {
    return cachedLogData;
  }

  try {
    if (!fs.existsSync(logPath)) {
      return cachedLogData;
    }

    const stat = fs.statSync(logPath);
    const readSize = Math.min(stat.size, 128 * 1024); // read last 128 KB
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(logPath, 'r');
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);

    const content = buffer.toString('utf8');

    // 1. Extract rules_count (ignore prev_rules_count)
    const ruleMatches = [...content.matchAll(/(?:^|\s)rules_count=(\d+)/g)];
    if (ruleMatches.length > 0) {
      const lastMatch = ruleMatches[ruleMatches.length - 1];
      cachedLogData.rulesCount = parseInt(lastMatch[1], 10);
    }

    // 2. Extract version
    const versionMatch = content.match(/version="AdGuard Home, version ([^"]+)"/);
    if (versionMatch) {
      cachedLogData.version = versionMatch[1];
    }

    // 3. Extract upstream
    if (content.includes('dns10.quad9.net')) {
      cachedLogData.upstream = 'Quad9 (DoH)';
    } else if (content.includes('cloudflare')) {
      cachedLogData.upstream = 'Cloudflare (DoH)';
    }

    cachedLogData.lastChecked = now;
  } catch (err) {
    console.warn('Could not parse AdGuard Home log:', err.message);
  }

  return cachedLogData;
}

/**
 * Performs a live DNS probe on 127.0.0.1:53 to verify active ad blocking.
 */
async function probeDnsBlocking(dnsPort = 53) {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers([`127.0.0.1:${dnsPort}`]);
    const start = Date.now();

    // Query doubleclick.net - expected to resolve to 0.0.0.0 when filtering is active
    resolver.resolve4('doubleclick.net', (err, addresses) => {
      const latencyMs = Date.now() - start;
      if (err) {
        return resolve({
          dnsOnline: false,
          adBlockingActive: false,
          latencyMs,
          error: err.code || err.message
        });
      }

      const blocked = Array.isArray(addresses) && addresses.includes('0.0.0.0');
      resolve({
        dnsOnline: true,
        adBlockingActive: blocked,
        latencyMs,
        resolvedAddress: addresses[0] || null,
        error: null
      });
    });
  });
}

/**
 * Checks HTTP Web UI on port 81 and measures response latency.
 */
function checkWebUi(webPort = 81, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(
      {
        host: '127.0.0.1',
        port: webPort,
        path: '/',
        method: 'GET',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'HomeServer/1.0' }
      },
      (res) => {
        const latencyMs = Date.now() - start;
        res.resume();
        // 200, 302, 401 all indicate the web server is alive and responding
        resolve({
          webOnline: res.statusCode >= 200 && res.statusCode < 500,
          statusCode: res.statusCode,
          latencyMs
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ webOnline: false, statusCode: null, latencyMs: null, error: 'Timeout' });
    });

    req.on('error', (err) => {
      resolve({ webOnline: false, statusCode: null, latencyMs: null, error: err.code || err.message });
    });

    req.end();
  });
}

/**
 * Fetches authenticated stats from /control/stats if credentials are configured.
 */
function fetchApiStats(webPort = 81, username = '', password = '') {
  if (!username || !password) return Promise.resolve(null);

  return new Promise((resolve) => {
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    const req = http.request(
      {
        host: '127.0.0.1',
        port: webPort,
        path: '/control/stats',
        method: 'GET',
        timeout: 3000,
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'User-Agent': 'HomeServer/1.0'
        }
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(raw);
              return resolve(data);
            } catch (e) {
              return resolve(null);
            }
          }
          resolve(null);
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * Main function: collects comprehensive AdGuard Home metrics.
 */
async function getAdGuardStats(config = {}) {
  const agConfig = config.adguard || {};
  const webPort = agConfig.webPort || 81;
  const dnsPort = agConfig.dnsPort || 53;
  const logPath = agConfig.logPath || '/var/log/AdGuardHome.stderr.log';

  // Run probes concurrently
  const [webResult, dnsResult, logData, apiStats] = await Promise.all([
    checkWebUi(webPort),
    probeDnsBlocking(dnsPort),
    Promise.resolve(getLogTelemetry(logPath)),
    fetchApiStats(webPort, agConfig.username, agConfig.password)
  ]);

  const online = webResult.webOnline || dnsResult.dnsOnline;

  // Format rules count with commas (e.g. "180,314")
  const rulesFormatted = (logData.rulesCount || 0).toLocaleString();

  // If full API stats are available, calculate percentage
  let blockedPct = null;
  if (apiStats?.num_dns_queries > 0) {
    blockedPct = ((apiStats.num_blocked_filtering / apiStats.num_dns_queries) * 100).toFixed(1);
  }

  return {
    enabled: agConfig.enabled !== false,
    online,
    name: 'AdGuard Home',
    title: 'AdGuard Home',
    type: 'adblocker',
    version: logData.version || 'v0.107.79',
    webPort,
    dnsPort,
    rulesCount: logData.rulesCount,
    rulesFormatted,
    upstreamDns: logData.upstream || 'Quad9 (DoH)',
    dnsOnline: dnsResult.dnsOnline,
    adBlockingActive: dnsResult.adBlockingActive,
    dnsLatencyMs: dnsResult.latencyMs,
    webLatencyMs: webResult.latencyMs,
    apiStatsAvailable: !!apiStats,
    stats: apiStats ? {
      totalQueries: apiStats.num_dns_queries || 0,
      blockedQueries: apiStats.num_blocked_filtering || 0,
      blockedMalware: apiStats.num_replaced_safebrowsing || 0,
      blockedAdult: apiStats.num_replaced_parental || 0,
      avgProcessingMs: (apiStats.avg_processing_time * 1000).toFixed(2),
      blockedPercent: blockedPct ? `${blockedPct}%` : '--%'
    } : null
  };
}

module.exports = {
  getAdGuardStats,
  probeDnsBlocking,
  checkWebUi,
  getLogTelemetry
};
