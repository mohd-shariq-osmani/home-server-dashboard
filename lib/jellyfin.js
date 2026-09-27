const http = require('http');

/**
 * Helper to make HTTP requests to Jellyfin API
 */
function fetchJellyfin(endpointPath, options = {}) {
  const { port = 8096, apiKey = '', method = 'GET', timeoutMs = 2500 } = options;

  return new Promise((resolve) => {
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'HomeServerMonitor/1.0'
    };

    if (apiKey) {
      headers['Authorization'] = `MediaBrowser Token="${apiKey}"`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: endpointPath,
        method,
        headers,
        timeout: timeoutMs
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            resolve({ statusCode: res.statusCode, data: parsed, error: null });
          } catch {
            resolve({ statusCode: res.statusCode, data: null, raw: data, error: null });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: null, data: null, error: 'Timeout' });
    });

    req.on('error', (err) => {
      resolve({ statusCode: null, data: null, error: err.code || err.message });
    });

    req.end();
  });
}

/**
 * Fetch comprehensive Jellyfin telemetry: server info, library counts, active sessions, and scan task progress.
 */
async function getJellyfinStats(config = {}) {
  const jfConfig = config.jellyfin || {};
  const port = jfConfig.port || 8096;
  const apiKey = jfConfig.apiKey || '';

  const startTime = Date.now();
  const [infoRes, countsRes, sessionsRes, tasksRes] = await Promise.all([
    fetchJellyfin('/System/Info/Public', { port, timeoutMs: 2000 }),
    fetchJellyfin('/Items/Counts', { port, apiKey, timeoutMs: 2000 }),
    fetchJellyfin('/Sessions', { port, apiKey, timeoutMs: 2000 }),
    fetchJellyfin('/ScheduledTasks', { port, apiKey, timeoutMs: 2000 })
  ]);
  const latencyMs = Date.now() - startTime;

  const online = infoRes.statusCode === 200 && !!infoRes.data;
  const version = infoRes.data?.Version ? `v${infoRes.data.Version}` : 'v12.0.0';
  const serverName = infoRes.data?.ServerName || 'Jellyfin';

  // Library Counts
  const counts = {
    movies: countsRes.data?.MovieCount ?? 0,
    series: countsRes.data?.SeriesCount ?? 0,
    episodes: countsRes.data?.EpisodeCount ?? 0,
    items: countsRes.data?.ItemCount ?? 0
  };

  // Active Sessions & Streams
  let activeSessions = [];
  let activeStreamCount = 0;
  if (Array.isArray(sessionsRes.data)) {
    activeSessions = sessionsRes.data.map(s => {
      const nowPlaying = s.NowPlayingItem ? {
        name: s.NowPlayingItem.Name,
        seriesName: s.NowPlayingItem.SeriesName || null,
        type: s.NowPlayingItem.Type,
        isPaused: !!s.PlayState?.IsPaused,
        playbackPercent: (s.NowPlayingItem.RunTimeTicks && s.PlayState?.PositionTicks)
          ? Math.min(100, Math.round((s.PlayState.PositionTicks / s.NowPlayingItem.RunTimeTicks) * 100))
          : null
      } : null;

      if (nowPlaying) activeStreamCount++;

      return {
        id: s.Id,
        client: s.Client || 'Client',
        deviceName: s.DeviceName || 'Unknown Device',
        userName: s.UserName || 'User',
        nowPlaying
      };
    });
  }

  // Library Scan Scheduled Task
  let scanTask = {
    isRunning: false,
    progress: 0,
    state: 'Idle',
    lastEndTime: null
  };

  if (Array.isArray(tasksRes.data)) {
    const refreshTask = tasksRes.data.find(t => t.Key === 'RefreshLibrary' || (t.Name && t.Name.includes('Library')));
    if (refreshTask) {
      const isRunning = refreshTask.State === 'Running';
      const rawProgress = typeof refreshTask.CurrentProgressPercentage === 'number'
        ? Math.round(refreshTask.CurrentProgressPercentage * 10) / 10
        : (isRunning ? 1 : 0);

      scanTask = {
        isRunning,
        progress: rawProgress,
        state: refreshTask.State || 'Idle',
        lastEndTime: refreshTask.LastExecutionResult?.EndTimeUtc || null
      };
    }
  }

  return {
    online,
    port,
    version,
    serverName,
    latencyMs: online ? latencyMs : null,
    counts,
    activeStreamCount,
    sessions: activeSessions,
    scanTask
  };
}

/**
 * Triggers a full media library scan across all libraries
 */
async function refreshAllLibraries(config = {}) {
  const jfConfig = config.jellyfin || {};
  const port = jfConfig.port || 8096;
  const apiKey = jfConfig.apiKey || '';

  const res = await fetchJellyfin('/Library/Refresh', {
    port,
    apiKey,
    method: 'POST',
    timeoutMs: 5000
  });

  if (res.statusCode === 204 || res.statusCode === 200) {
    return { success: true, message: 'Library scan triggered successfully.' };
  }

  return {
    success: false,
    error: res.error || `HTTP ${res.statusCode}`,
    message: 'Failed to start library scan.'
  };
}

module.exports = {
  getJellyfinStats,
  refreshAllLibraries
};
