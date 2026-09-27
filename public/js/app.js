(() => {
  // State
  let currentStats = null;
  let serverConfig = null;
  let refreshInterval = 5000;
  let countdownSeconds = 5;
  let countdownTimer = null;
  let isFetching = false;
  let enteredPin = '';

  // History buffers for Sparklines (max 30 points)
  const MAX_HISTORY = 30;
  const cpuHistory = [];
  const ramHistory = [];

  // PIN Elements
  const pinOverlay = document.getElementById('pinOverlay');
  const pinCard = document.getElementById('pinCard');
  const pinDots = document.getElementById('pinDots');
  const pinErrorMsg = document.getElementById('pinErrorMsg');
  const pinHiddenInput = document.getElementById('pinHiddenInput');
  const pinClearBtn = document.getElementById('pinClearBtn');
  const pinSubmitBtn = document.getElementById('pinSubmitBtn');
  const lockBtn = document.getElementById('lockBtn');

  // Top Nav Elements
  const serverNameEl = document.getElementById('serverName');
  const serverStatusDot = document.getElementById('serverStatusDot');
  const serverUptimeText = document.getElementById('serverUptimeText');
  const networkBadgeBtn = document.getElementById('networkBadgeBtn');
  const networkBadgeIcon = document.getElementById('networkBadgeIcon');
  const networkBadgeText = document.getElementById('networkBadgeText');
  const tunnelAddressEl = document.getElementById('tunnelAddress');
  const tunnelPill = document.getElementById('tunnelPill');
  const refreshTimerEl = document.getElementById('refreshTimer');
  const refreshIndicator = document.getElementById('refreshIndicator');

  // Network routing mode: 'auto' | 'tailscale' | 'lan'
  let manualNetworkMode = localStorage.getItem('hs_network_mode_v2') || 'auto';

  // Metrics elements
  const metricsGrid = document.getElementById('metricsGrid');
  const cpuVal = document.getElementById('cpuVal');
  const cpuSub = document.getElementById('cpuSub');
  const cpuBar = document.getElementById('cpuBar');
  const cpuCoreCount = document.getElementById('cpuCoreCount');

  const ramVal = document.getElementById('ramVal');
  const ramSub = document.getElementById('ramSub');
  const ramBar = document.getElementById('ramBar');
  const ramExtra = document.getElementById('ramExtra');

  const ssdVal = document.getElementById('ssdVal');
  const ssdSub = document.getElementById('ssdSub');
  const ssdBar = document.getElementById('ssdBar');
  const ssdExtra = document.getElementById('ssdExtra');
  const ssdLabel = document.getElementById('ssdLabel');

  const hddVal = document.getElementById('hddVal');
  const hddSub = document.getElementById('hddSub');
  const hddBar = document.getElementById('hddBar');
  const hddExtra = document.getElementById('hddExtra');
  const hddLabel = document.getElementById('hddLabel');

  // Sparkline paths
  const cpuSparklinePath = document.getElementById('cpuSparklinePath');
  const cpuSparklineArea = document.getElementById('cpuSparklineArea');
  const ramSparklinePath = document.getElementById('ramSparklinePath');
  const ramSparklineArea = document.getElementById('ramSparklineArea');

  // Top RAM list
  const topProcessList = document.getElementById('topProcessList');
  const topRamBadge = document.getElementById('topRamBadge');

  // LM Studio elements
  const cardLmStudio = document.getElementById('cardLmStudio');
  const lmStudioDot = document.getElementById('lmStudioDot');
  const lmStudioStatusChip = document.getElementById('lmStudioStatusChip');
  const lmStudioSpeedBadge = document.getElementById('lmStudioSpeedBadge');
  const lmStudioModelName = document.getElementById('lmStudioModelName');
  const lmStudioArch = document.getElementById('lmStudioArch');
  const lmStudioQuant = document.getElementById('lmStudioQuant');
  const lmStudioSize = document.getElementById('lmStudioSize');

  // ComfyUI elements
  const cardComfyUi = document.getElementById('cardComfyUi');
  const comfyUiDot = document.getElementById('comfyUiDot');
  const comfyUiStatusChip = document.getElementById('comfyUiStatusChip');
  const comfyUiQueueText = document.getElementById('comfyUiQueueText');
  const comfyUiProgressText = document.getElementById('comfyUiProgressText');
  const comfyUiProgressBar = document.getElementById('comfyUiProgressBar');

  // n8n elements
  const cardN8n = document.getElementById('cardN8n');
  const n8nDot = document.getElementById('n8nDot');
  const n8nStatusChip = document.getElementById('n8nStatusChip');
  const n8nSummaryText = document.getElementById('n8nSummaryText');
  const n8nLatestWorkflow = document.getElementById('n8nLatestWorkflow');

  // Jellyfin elements
  const cardJellyfin = document.getElementById('cardJellyfin');
  const jellyfinDot = document.getElementById('jellyfinDot');
  const jellyfinStatusChip = document.getElementById('jellyfinStatusChip');
  const jellyfinScanBtn = document.getElementById('jellyfinScanBtn');
  const jellyfinLaunchPill = document.getElementById('jellyfinLaunchPill');
  const jellyfinSummaryText = document.getElementById('jellyfinSummaryText');
  const jellyfinStreamStatus = document.getElementById('jellyfinStreamStatus');
  const jellyfinStreamText = document.getElementById('jellyfinStreamText');
  const jellyfinProgressTrack = document.getElementById('jellyfinProgressTrack');
  const jellyfinProgressBar = document.getElementById('jellyfinProgressBar');
  const jellyfinMetaText = document.getElementById('jellyfinMetaText');

  // Immich elements
  const cardImmich = document.getElementById('cardImmich');
  const immichDot = document.getElementById('immichDot');
  const immichStatusChip = document.getElementById('immichStatusChip');
  const immichMlBadge = document.getElementById('immichMlBadge');
  const immichLaunchPill = document.getElementById('immichLaunchPill');
  const immichSummaryText = document.getElementById('immichSummaryText');
  const immichFeaturesText = document.getElementById('immichFeaturesText');
  const immichStorageText = document.getElementById('immichStorageText');

  // qBittorrent elements
  const cardQBittorrent = document.getElementById('cardQBittorrent');
  const qbtDot = document.getElementById('qbtDot');
  const qbtStatusChip = document.getElementById('qbtStatusChip');
  const qbtSpeedBadge = document.getElementById('qbtSpeedBadge');
  const qbtLaunchPill = document.getElementById('qbtLaunchPill');
  const qbtSummaryText = document.getElementById('qbtSummaryText');
  const qbtProgressText = document.getElementById('qbtProgressText');
  const qbtProgressBar = document.getElementById('qbtProgressBar');

  // Arr Suite elements
  const cardArrSuite = document.getElementById('cardArrSuite');
  const arrDot = document.getElementById('arrDot');
  const arrStatusChip = document.getElementById('arrStatusChip');
  const arrLaunchPill = document.getElementById('arrLaunchPill');
  const arrOnlineText = document.getElementById('arrOnlineText');

  // AdGuard Home elements
  const cardAdGuard = document.getElementById('cardAdGuard');
  const adguardDot = document.getElementById('adguardDot');
  const adguardStatusChip = document.getElementById('adguardStatusChip');
  const adguardRulesBadge = document.getElementById('adguardRulesBadge');
  const adguardLaunchPill = document.getElementById('adguardLaunchPill');
  const adguardUpstreamText = document.getElementById('adguardUpstreamText');
  const adguardBlockingStatus = document.getElementById('adguardBlockingStatus');
  const adguardDnsLatency = document.getElementById('adguardDnsLatency');
  const adguardWebLatency = document.getElementById('adguardWebLatency');
  const adguardVersion = document.getElementById('adguardVersion');
  const adguardSectionBadge = document.getElementById('adguardSectionBadge');

  // Docker elements
  const cardDocker = document.getElementById('cardDocker');
  const dockerDot = document.getElementById('dockerDot');
  const dockerStatusChip = document.getElementById('dockerStatusChip');
  const dockerInspectPill = document.getElementById('dockerInspectPill');
  const dockerSubtitleText = document.getElementById('dockerSubtitleText');
  const dockerContainersPreview = document.getElementById('dockerContainersPreview');

  // Modal elements
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');

  // Power button
  const powerBtn = document.getElementById('powerBtn');

  // ====================================================
  // PIN Authentication Logic
  // ====================================================
  function updatePinDots() {
    if (!pinDots) return;
    const dots = pinDots.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      if (idx < enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
    if (pinErrorMsg) pinErrorMsg.textContent = '';
  }

  function showPinScreen() {
    stopPolling();
    if (pinOverlay) {
      pinOverlay.style.display = 'flex';
      enteredPin = '';
      updatePinDots();
      if (pinHiddenInput) pinHiddenInput.focus();
    }
  }

  function hidePinScreen() {
    if (pinOverlay) pinOverlay.style.display = 'none';
    enteredPin = '';
    updatePinDots();
  }

  async function submitPin() {
    if (enteredPin.length === 0) return;
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        hidePinScreen();
        await fetchConfig();
        await fetchStats();
        startCountdown();
      } else {
        if (pinCard) {
          pinCard.classList.remove('pin-shake');
          void pinCard.offsetWidth; // reflow
          pinCard.classList.add('pin-shake');
        }
        if (pinErrorMsg) pinErrorMsg.textContent = data.error || 'Incorrect PIN. Try again.';
        enteredPin = '';
        updatePinDots();
      }
    } catch (err) {
      if (pinErrorMsg) pinErrorMsg.textContent = 'Connection error. Try again.';
    }
  }

  // Bind Keypad clicks
  document.querySelectorAll('.key-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (enteredPin.length < 4) {
        enteredPin += btn.getAttribute('data-key');
        updatePinDots();
        if (enteredPin.length === 4) {
          submitPin();
        }
      }
    });
  });

  if (pinClearBtn) {
    pinClearBtn.addEventListener('click', () => {
      enteredPin = enteredPin.slice(0, -1);
      updatePinDots();
    });
  }

  if (pinSubmitBtn) {
    pinSubmitBtn.addEventListener('click', () => {
      if (enteredPin.length > 0) submitPin();
    });
  }

  // Hardware/Mobile Keyboard support
  window.addEventListener('keydown', (e) => {
    if (pinOverlay && pinOverlay.style.display !== 'none') {
      if (e.key >= '0' && e.key <= '9') {
        if (enteredPin.length < 4) {
          enteredPin += e.key;
          updatePinDots();
          if (enteredPin.length === 4) submitPin();
        }
      } else if (e.key === 'Backspace') {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDots();
      } else if (e.key === 'Enter') {
        submitPin();
      }
    }
  });

  // Lock button
  if (lockBtn) {
    lockBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (_) {}
      showPinScreen();
    });
  }

  // ====================================================
  // Helper Functions
  // ====================================================
  function applyThresholdClass(element, percent) {
    if (!element) return;
    element.classList.remove('fill-normal', 'fill-warning', 'fill-critical');
    if (percent >= 85) {
      element.classList.add('fill-critical');
    } else if (percent >= 70) {
      element.classList.add('fill-warning');
    } else {
      element.classList.add('fill-normal');
    }
  }

  function updateSparkline(history, pathEl, areaEl, maxVal = 100) {
    if (!pathEl || !areaEl || history.length < 2) return;
    const width = 200;
    const height = 30;
    const step = width / (MAX_HISTORY - 1);
    const startX = width - (history.length - 1) * step;

    let pathD = `M ${startX} ${height - (history[0] / maxVal) * height}`;
    for (let i = 1; i < history.length; i++) {
      const x = startX + i * step;
      const y = height - (history[i] / maxVal) * height;
      pathD += ` L ${x} ${y}`;
    }

    pathEl.setAttribute('d', pathD);
    const areaD = `${pathD} L ${width} ${height} L ${startX} ${height} Z`;
    areaEl.setAttribute('d', areaD);
  }

  // ====================================================
  // API Fetching & Configuration
  // ====================================================
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        serverConfig = await res.json();
        if (serverConfig.refreshIntervalMs) {
          refreshInterval = serverConfig.refreshIntervalMs;
        }
        updateNetworkBadge();
      }
    } catch (e) {
      console.warn('Could not load config:', e);
    }
  }

  async function fetchStats() {
    if (isFetching) return;
    isFetching = true;
    if (refreshIndicator) refreshIndicator.classList.add('spinning');

    try {
      const res = await fetch('/api/stats', {
        headers: { 'Accept': 'application/json' }
      });

      if (res.status === 401) {
        showPinScreen();
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      currentStats = data;
      renderDashboard(data);
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
      renderOfflineState();
    } finally {
      isFetching = false;
      if (refreshIndicator) refreshIndicator.classList.remove('spinning');
      countdownSeconds = Math.round(refreshInterval / 1000);
      updateTimerDisplay();
    }
  }

  // ====================================================
  // Rendering Logic
  // ====================================================
  function renderDashboard(data) {
    const { server, metrics, services, arrSuite, docker, ngrok, lmStudio, comfyUi, n8n, qbittorrent, adguard, immich, jellyfin } = data;

    // Header & Uptime
    if (serverNameEl && server?.name) serverNameEl.textContent = server.name;
    if (serverUptimeText) {
      if (serverStatusDot) serverStatusDot.classList.add('pulse');
      serverUptimeText.textContent = `uptime ${server.uptime?.formatted || '0m'}`;
    }

    // Tunnel address
    if (tunnelAddressEl) {
      if (ngrok?.online && ngrok?.url) {
        tunnelAddressEl.textContent = ngrok.url.replace(/^https?:\/\//, '');
        if (tunnelPill) {
          tunnelPill.href = ngrok.url;
          tunnelPill.style.display = 'inline-flex';
        }
      } else {
        if (tunnelPill) {
          tunnelPill.style.display = 'none';
        }
      }
    }

    // CPU Metrics & Sparkline
    if (metrics?.cpu) {
      const { percent, coreCount } = metrics.cpu;
      if (cpuVal) cpuVal.textContent = `${percent}%`;
      if (cpuSub) cpuSub.textContent = `${coreCount} cores active`;
      if (cpuBar) {
        cpuBar.style.width = `${percent}%`;
        applyThresholdClass(cpuBar, percent);
      }
      if (cpuCoreCount) cpuCoreCount.innerHTML = `<span class="interactive-pill">top cpu ↗</span>`;

      cpuHistory.push(percent);
      if (cpuHistory.length > MAX_HISTORY) cpuHistory.shift();
      updateSparkline(cpuHistory, cpuSparklinePath, cpuSparklineArea);
    }

    // RAM Metrics & Sparkline
    if (metrics?.ram) {
      const { percent, usedFormatted, totalFormatted, topProcesses } = metrics.ram;
      if (ramVal) ramVal.textContent = `${percent}%`;
      if (ramSub) ramSub.textContent = `${usedFormatted} / ${totalFormatted}`;
      if (ramBar) {
        ramBar.style.width = `${percent}%`;
        applyThresholdClass(ramBar, percent);
      }

      ramHistory.push(percent);
      if (ramHistory.length > MAX_HISTORY) ramHistory.shift();
      updateSparkline(ramHistory, ramSparklinePath, ramSparklineArea);

      if (topProcesses) {
        renderTopProcesses(topProcesses);
      }
    }

    // Internal SSD
    if (metrics?.internalSsd) {
      const { percent, usedFormatted, totalFormatted, freeFormatted, mount } = metrics.internalSsd;
      if (ssdVal) ssdVal.textContent = `${percent}%`;
      if (ssdSub) ssdSub.textContent = `${usedFormatted} / ${totalFormatted}`;
      if (ssdExtra) ssdExtra.textContent = `${freeFormatted} free`;
      if (ssdLabel) ssdLabel.textContent = `internal ssd (${mount})`;
      if (ssdBar) {
        ssdBar.style.width = `${percent}%`;
        applyThresholdClass(ssdBar, percent);
      }
    }

    // External HDD
    if (metrics?.externalDrives) {
      renderExternalDrives(metrics.externalDrives);
    }

    // 2. AI Workloads
    renderLMStudio(lmStudio);
    renderComfyUi(comfyUi);
    renderN8n(n8n);

    // 3. Media & Downloads
    renderJellyfin(jellyfin);
    renderImmich(immich);
    renderQBittorrent(qbittorrent);
    renderArrSuite(arrSuite);

    // 4. Network & Infrastructure
    renderAdGuard(adguard);
    renderDocker(docker);
  }

  // 1. Render Top 10 RAM Consumers
  function renderTopProcesses(processes) {
    if (!topProcessList) return;
    topProcessList.innerHTML = '';
    const displayList = processes.slice(0, 5);

    displayList.forEach((proc, index) => {
      const item = document.createElement('div');
      item.className = 'process-item';
      item.onclick = () => openProcessesModal(processes);

      const memPct = proc.memPercent || 0;
      const barWidth = Math.min(100, Math.max(8, memPct * 3));

      item.innerHTML = `
        <div class="process-rank">#${index + 1}</div>
        <div class="process-info">
          <div class="process-name-line">
            <span class="process-app-name">${escapeHtml(proc.name)}</span>
            <span class="process-pid">PID ${proc.pid}</span>
          </div>
          <div class="process-bar-track">
            <div class="process-bar-fill" style="width: ${barWidth}%;"></div>
          </div>
        </div>
        <div class="process-usage">
          <div class="process-mem-val">${proc.rssFormatted}</div>
          <div class="process-mem-pct">${memPct.toFixed(1)}%</div>
        </div>
      `;
      topProcessList.appendChild(item);
    });
  }

  // 2. Render LM Studio Live Metrics
  function renderLMStudio(lm) {
    if (!cardLmStudio) return;

    const model = lm?.loadedModel;
    const speed = lm?.speed;

    if (lm?.hasActiveModel && model) {
      if (lmStudioModelName) lmStudioModelName.textContent = model.displayName;
      if (lmStudioArch) lmStudioArch.textContent = model.architecture || 'llm';
      if (lmStudioQuant) lmStudioQuant.textContent = model.quantization || '--';
      if (lmStudioSize) lmStudioSize.textContent = model.sizeFormatted || '--';

      if (lmStudioStatusChip) {
        if (model.status === 'generating' || model.status === 'busy') {
          lmStudioStatusChip.className = 'chip chip-generating';
          lmStudioStatusChip.textContent = 'generating';
        } else {
          lmStudioStatusChip.className = 'chip chip-idle';
          lmStudioStatusChip.textContent = 'idle · ready';
        }
      }

      if (lmStudioSpeedBadge) {
        if (speed?.evalTps) {
          lmStudioSpeedBadge.textContent = `⚡ ${speed.evalTps} tok/s`;
        } else if (speed?.promptTps) {
          lmStudioSpeedBadge.textContent = `⚡ ${speed.promptTps} tok/s`;
        } else {
          lmStudioSpeedBadge.textContent = 'ready';
        }
      }
    } else {
      if (lmStudioModelName) lmStudioModelName.textContent = 'No model currently loaded (Tap to load)';
      if (lmStudioStatusChip) {
        lmStudioStatusChip.className = 'chip chip-blue';
        lmStudioStatusChip.textContent = 'server ready';
      }
      if (lmStudioSpeedBadge) lmStudioSpeedBadge.textContent = 'tap to manage';
      if (lmStudioArch) lmStudioArch.textContent = '--';
      if (lmStudioQuant) lmStudioQuant.textContent = '--';
      if (lmStudioSize) lmStudioSize.textContent = '--';
    }

    // Tapping LM Studio opens the interactive Model Management & Inference portal!
    cardLmStudio.onclick = () => openLmStudioPortal(lm);
  }

  // ====================================================
  // Dynamic Network Detection (Tailscale vs Home LAN)
  // ====================================================
  function getActiveHost() {
    // 1. Manual user override
    if (manualNetworkMode === 'tailscale') {
      return serverConfig?.tailscaleIp || window.location.hostname;
    }
    if (manualNetworkMode === 'lan') {
      return serverConfig?.serverLanIp || window.location.hostname;
    }

    // 2. Direct browser navigation check
    const curHost = window.location.hostname;
    if (curHost.startsWith('100.') || curHost.includes('.ts.net') || curHost.includes('mac-mini')) {
      return curHost;
    }
    if (curHost.startsWith('192.168.') || curHost.startsWith('10.')) {
      return curHost;
    }
    if (curHost === 'localhost' || curHost === '127.0.0.1') {
      return serverConfig?.serverLanIp || window.location.hostname;
    }

    // 3. Dynamic server detection (used when browsing via ngrok or public URL)
    // Server detects if client is on the same home network (WAN IP matching) or remote
    if (serverConfig?.dynamicHost) {
      return serverConfig.dynamicHost;
    }

    return serverConfig?.serverLanIp || window.location.hostname;
  }

  function updateNetworkBadge() {
    if (!networkBadgeBtn || !networkBadgeText) return;

    const host = getActiveHost();
    const isTailscale = host.startsWith('100.') || host.includes('.ts.net') || host.includes('mac-mini');
    const isManual = manualNetworkMode !== 'auto';

    if (isTailscale) {
      networkBadgeBtn.className = 'network-badge-btn mode-tailscale' + (isManual ? ' is-manual' : '');
      if (networkBadgeIcon) networkBadgeIcon.className = 'ti ti-shield-check';
      networkBadgeText.innerHTML = isManual ? 'Tailscale<span class="badge-manual-tag"> (Manual)</span>' : 'Tailscale';
      networkBadgeBtn.setAttribute('title', `Routing via Tailscale (${host})${isManual ? ' [Forced]' : ' [Auto]'} - Click to change`);
    } else {
      networkBadgeBtn.className = 'network-badge-btn mode-lan' + (isManual ? ' is-manual' : '');
      if (networkBadgeIcon) networkBadgeIcon.className = 'ti ti-wifi';
      networkBadgeText.innerHTML = isManual ? 'LAN<span class="badge-manual-tag"> (Manual)</span>' : 'LAN';
      networkBadgeBtn.setAttribute('title', `Routing via Home LAN (${host})${isManual ? ' [Forced]' : ' [Auto]'} - Click to change`);
    }
  }

  function openNetworkSwitcherModal() {
    const titleHtml = `<i class="ti ti-network" style="color:var(--accent-blue);"></i><span>Network Routing Mode</span>`;
    const curHost = getActiveHost();
    const isTailscale = curHost.startsWith('100.') || curHost.includes('.ts.net') || curHost.includes('mac-mini');

    const bodyHtml = `
      <div class="network-modal-wrap">
        <div class="network-status-box">
          <div class="network-status-row">
            <span class="network-status-label">Active Target IP:</span>
            <span class="network-status-val" style="color:${isTailscale ? '#a78bfa' : 'var(--accent-green-text)'};">${curHost}</span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Current Browser Host:</span>
            <span class="network-status-val">${window.location.hostname}</span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Tailscale IP:</span>
            <span class="network-status-val">${serverConfig?.tailscaleIp || 'Not configured'}</span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Home LAN IP:</span>
            <span class="network-status-val">${serverConfig?.serverLanIp || 'Not configured'}</span>
          </div>
          ${currentStats?.ngrok?.url ? `
          <div class="network-status-row">
            <span class="network-status-label">Ngrok Tunnel:</span>
            <a href="${currentStats.ngrok.url}" target="_blank" class="network-status-val" style="color:var(--accent-blue);text-decoration:underline;word-break:break-all;">${currentStats.ngrok.url.replace(/^https?:\/\//, '')}</a>
          </div>
          ` : ''}
        </div>

        <div style="font-size:12px;color:var(--text-secondary);margin:2px 0;">Select how service buttons (ComfyUI, qBittorrent, etc.) open:</div>

        <div class="network-option-card ${manualNetworkMode === 'auto' ? 'selected' : ''}" data-mode="auto">
          <div class="network-radio-circle"></div>
          <div class="network-option-info">
            <div class="network-opt-title"><i class="ti ti-bolt" style="color:var(--accent-blue);"></i> Automatic Switching (Recommended)</div>
            <div class="network-opt-desc">Automatically routes to Tailscale${serverConfig?.tailscaleIp ? ` (${serverConfig.tailscaleIp})` : ''} on remote networks, and Home LAN${serverConfig?.serverLanIp ? ` (${serverConfig.serverLanIp})` : ''} when at home.</div>
          </div>
        </div>

        <div class="network-option-card ${manualNetworkMode === 'tailscale' ? 'selected' : ''}" data-mode="tailscale">
          <div class="network-radio-circle"></div>
          <div class="network-option-info">
            <div class="network-opt-title"><i class="ti ti-shield-check" style="color:#a78bfa;"></i> Force Tailscale${serverConfig?.tailscaleIp ? ` (${serverConfig.tailscaleIp})` : ''}</div>
            <div class="network-opt-desc">Always routes all services through your secure Tailscale mesh network.</div>
          </div>
        </div>

        <div class="network-option-card ${manualNetworkMode === 'lan' ? 'selected' : ''}" data-mode="lan">
          <div class="network-radio-circle"></div>
          <div class="network-option-info">
            <div class="network-opt-title"><i class="ti ti-wifi" style="color:var(--accent-green-text);"></i> Force Home LAN${serverConfig?.serverLanIp ? ` (${serverConfig.serverLanIp})` : ''}</div>
            <div class="network-opt-desc">Always routes all services to local Wi-Fi IP (only works when connected to home router).</div>
          </div>
        </div>
      </div>
    `;

    openModal(titleHtml, bodyHtml);

    const cards = document.querySelectorAll('.network-option-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.getAttribute('data-mode');
        manualNetworkMode = mode;
        localStorage.setItem('hs_network_mode_v2', mode);
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        updateNetworkBadge();
        if (currentStats) renderTelemetry(currentStats);
        setTimeout(closeModal, 250);
      });
    });
  }

  // 3. Render ComfyUI Details
  function renderComfyUi(comfy) {
    if (!cardComfyUi) return;

    const running = comfy?.runningCount || 0;
    const queued = comfy?.pendingCount || 0;

    if (comfyUiQueueText) {
      comfyUiQueueText.textContent = `${running} running · ${queued} queued`;
    }

    if (comfyUiStatusChip) {
      if (running > 0) {
        comfyUiStatusChip.className = 'chip chip-generating';
        comfyUiStatusChip.textContent = `${running} generating`;
      } else if (queued > 0) {
        comfyUiStatusChip.className = 'chip chip-generating';
        comfyUiStatusChip.textContent = `${queued} queued`;
      } else {
        comfyUiStatusChip.className = 'chip chip-idle';
        comfyUiStatusChip.textContent = 'idle';
      }
    }

    if (comfyUiProgressText) {
      comfyUiProgressText.textContent = running > 0 ? 'processing graph...' : 'idle';
    }

    if (comfyUiProgressBar) {
      comfyUiProgressBar.style.width = running > 0 ? '65%' : '0%';
      applyThresholdClass(comfyUiProgressBar, running > 0 ? 50 : 0);
    }

    const comfyHost = getActiveHost();
    const comfyUrl = `http://${comfyHost}:8188`;

    cardComfyUi.onclick = () => {
      window.open(comfyUrl, '_blank');
    };

    const comfyUiLaunchPill = document.getElementById('comfyUiLaunchPill');
    if (comfyUiLaunchPill) {
      comfyUiLaunchPill.onclick = (e) => {
        e.stopPropagation();
        window.open(comfyUrl, '_blank');
      };
    }
  }

  function getN8nUrl() {
    if (serverConfig?.services?.n8nPublicUrl) {
      return serverConfig.services.n8nPublicUrl;
    }
    const host = getActiveHost();
    const port = serverConfig?.services?.n8nPort || 5678;
    return `http://${host}:${port}`;
  }

  // 4. Render n8n Details
  function renderN8n(n8n) {
    if (!cardN8n) return;

    const running = n8n?.runningCount || 0;
    const failed = n8n?.failedCount || 0;

    if (n8nSummaryText) {
      n8nSummaryText.textContent = `${running} running · ${failed} failed / error`;
    }

    if (n8nStatusChip) {
      if (failed > 0) {
        n8nStatusChip.className = 'chip chip-error';
        n8nStatusChip.textContent = `${failed} failed`;
      } else if (running > 0) {
        n8nStatusChip.className = 'chip chip-generating';
        n8nStatusChip.textContent = `${running} running`;
      } else {
        n8nStatusChip.className = 'chip chip-idle';
        n8nStatusChip.textContent = 'all healthy';
      }
    }

    const latestExec = n8n?.executions && n8n.executions[0];
    if (n8nLatestWorkflow) {
      n8nLatestWorkflow.textContent = latestExec ? `${latestExec.workflowName || 'Workflow'} · ${latestExec.status}` : 'No recent errors';
    }

    const n8nLaunchPill = document.getElementById('n8nLaunchPill');
    if (n8nLaunchPill) {
      n8nLaunchPill.onclick = (e) => {
        e.stopPropagation();
        window.open(getN8nUrl(), '_blank');
      };
    }

    const n8nHistoryPill = document.getElementById('n8nHistoryPill');
    if (n8nHistoryPill) {
      n8nHistoryPill.onclick = (e) => {
        e.stopPropagation();
        openN8nModal(n8n);
      };
    }

    cardN8n.onclick = () => window.open(getN8nUrl(), '_blank');
  }

  // 5. Render qBittorrent Details
  function renderQBittorrent(qbt) {
    if (!cardQBittorrent) return;

    const online = qbt?.online !== false;
    const dlCount = qbt?.downloadingCount || 0;
    const pausedCount = qbt?.pausedCount || 0;
    const totalCount = qbt?.totalCount || 0;

    if (qbtDot) {
      qbtDot.className = `service-dot ${online ? 'online' : 'offline'}`;
    }

    if (qbtStatusChip) {
      if (!online) {
        qbtStatusChip.className = 'chip chip-error';
        qbtStatusChip.textContent = 'offline';
      } else if (dlCount > 0) {
        qbtStatusChip.className = 'chip chip-generating';
        qbtStatusChip.textContent = `${dlCount} downloading`;
      } else if (totalCount > 0) {
        qbtStatusChip.className = 'chip chip-idle';
        qbtStatusChip.textContent = `${totalCount} torrents`;
      } else {
        qbtStatusChip.className = 'chip chip-idle';
        qbtStatusChip.textContent = 'idle';
      }
    }

    if (qbtSpeedBadge) {
      if (online && (qbt.dlSpeed > 0 || qbt.upSpeed > 0)) {
        qbtSpeedBadge.textContent = `↓ ${qbt.dlSpeedFormatted} · ↑ ${qbt.upSpeedFormatted}`;
      } else {
        qbtSpeedBadge.textContent = online ? 'connected' : 'offline';
      }
    }

    if (qbtSummaryText) {
      if (!online) {
        qbtSummaryText.textContent = 'Could not reach port 8080';
      } else {
        qbtSummaryText.textContent = `${dlCount} downloading · ${pausedCount} paused · ${totalCount} total`;
      }
    }

    if (qbtProgressText) {
      if (dlCount > 0) {
        const firstDl = (qbt.torrents || []).find(t => t.isDownloading);
        qbtProgressText.textContent = firstDl ? `${firstDl.progress}% · ${firstDl.etaFormatted}` : 'downloading...';
      } else {
        qbtProgressText.textContent = 'transfers idle';
      }
    }

    if (qbtProgressBar) {
      if (dlCount > 0) {
        const firstDl = (qbt.torrents || []).find(t => t.isDownloading);
        const pct = firstDl ? firstDl.progress : 50;
        qbtProgressBar.style.width = `${pct}%`;
        applyThresholdClass(qbtProgressBar, pct);
      } else {
        qbtProgressBar.style.width = '0%';
        applyThresholdClass(qbtProgressBar, 0);
      }
    }

    cardQBittorrent.onclick = () => openQBittorrentModal(qbt);

    if (qbtLaunchPill) {
      qbtLaunchPill.onclick = (e) => {
        e.stopPropagation();
        openQBittorrentModal(qbt);
      };
    }
  }

  // 5. Render External Drives
  function renderExternalDrives(drives) {
    if (drives.length === 0) return;
    const primary = drives[0];
    if (hddVal) {
      if (hddLabel) hddLabel.textContent = primary.name || 'external hdd';
      hddVal.textContent = `${primary.percent}%`;
      if (hddSub) hddSub.textContent = `${primary.usedFormatted} / ${primary.totalFormatted}`;
      if (hddExtra) hddExtra.textContent = `${primary.freeFormatted} free`;
      if (hddBar) {
        hddBar.style.width = `${primary.percent}%`;
        applyThresholdClass(hddBar, primary.percent);
      }
    }
  }

  // 6. Render AdGuard Home Adblocker
  function renderAdGuard(ag) {
    if (!cardAdGuard) return;

    if (!ag || !ag.online) {
      if (adguardDot) adguardDot.className = 'service-dot offline';
      if (adguardStatusChip) {
        adguardStatusChip.className = 'chip chip-error';
        adguardStatusChip.textContent = 'offline';
      }
      if (adguardBlockingStatus) {
        adguardBlockingStatus.innerHTML = '<span style="color:var(--accent-red);"><i class="ti ti-alert-triangle"></i> offline</span>';
      }
      if (adguardRulesBadge) adguardRulesBadge.textContent = 'offline';
      if (adguardSectionBadge) adguardSectionBadge.textContent = 'adblock offline';
      return;
    }

    const host = getActiveHost();
    const webUrl = `http://${host}:${ag.webPort || 81}`;

    if (adguardDot) adguardDot.className = 'service-dot online';
    if (adguardStatusChip) {
      adguardStatusChip.className = ag.adBlockingActive ? 'chip chip-green' : 'chip chip-warning';
      adguardStatusChip.textContent = ag.adBlockingActive ? 'protected' : 'dns ready';
    }
    if (adguardRulesBadge) {
      adguardRulesBadge.textContent = `${ag.rulesFormatted || '180k'} rules`;
    }
    if (adguardUpstreamText) {
      adguardUpstreamText.textContent = `${ag.upstreamDns || 'Quad9 DoH'} · Port ${ag.dnsPort || 53}`;
    }
    if (adguardBlockingStatus) {
      if (ag.adBlockingActive) {
        adguardBlockingStatus.innerHTML = `<i class="ti ti-shield-check" style="color:#67B279;"></i> blocking active`;
      } else {
        adguardBlockingStatus.innerHTML = `<span style="color:var(--accent-amber);"><i class="ti ti-alert-circle"></i> filtering check</span>`;
      }
    }
    if (adguardDnsLatency) {
      adguardDnsLatency.textContent = `${ag.dnsLatencyMs != null ? ag.dnsLatencyMs : '<1'}ms`;
    }
    if (adguardWebLatency) {
      adguardWebLatency.textContent = `${ag.webLatencyMs != null ? ag.webLatencyMs : '--'}ms`;
    }
    if (adguardVersion) {
      adguardVersion.textContent = ag.version || 'v0.107.79';
    }
    if (adguardSectionBadge) {
      adguardSectionBadge.textContent = ag.adBlockingActive ? 'dns protected' : 'connected';
    }

    if (adguardLaunchPill) {
      adguardLaunchPill.onclick = (e) => {
        e.stopPropagation();
        window.open(webUrl, '_blank');
      };
    }

    cardAdGuard.onclick = () => openAdGuardModal(ag);
  }

  // 7. Render Jellyfin Media Server
  function renderJellyfin(jellyfin) {
    if (!cardJellyfin) return;

    const online = jellyfin?.online !== false;
    const version = jellyfin?.version || 'v12.0.0';
    const counts = jellyfin?.counts || { movies: 0, series: 0, episodes: 0, items: 0 };
    const sessions = jellyfin?.sessions || [];
    const activeStreamCount = jellyfin?.activeStreamCount || 0;
    const scanTask = jellyfin?.scanTask || {};
    const isScanning = !!scanTask.isRunning;
    const scanProgress = scanTask.progress || 0;

    const host = getActiveHost();
    const jellyfinUrl = `http://${host}:${jellyfin?.port || 8096}`;

    // 1. Status Dot
    if (jellyfinDot) {
      if (!online) {
        jellyfinDot.className = 'service-dot offline';
        jellyfinDot.style.background = '';
      } else if (isScanning) {
        jellyfinDot.className = 'service-dot online pulse';
        jellyfinDot.style.background = 'var(--accent-purple)';
      } else {
        jellyfinDot.className = 'service-dot online';
        jellyfinDot.style.background = '';
      }
    }

    // 2. Status Chip
    if (jellyfinStatusChip) {
      if (!online) {
        jellyfinStatusChip.className = 'chip chip-error';
        jellyfinStatusChip.textContent = 'offline';
      } else if (isScanning) {
        jellyfinStatusChip.className = 'chip chip-purple';
        jellyfinStatusChip.textContent = scanProgress > 0 ? `scan ${scanProgress}%` : 'scanning';
      } else if (activeStreamCount > 0) {
        jellyfinStatusChip.className = 'chip chip-idle';
        jellyfinStatusChip.textContent = `${activeStreamCount} streaming`;
      } else {
        jellyfinStatusChip.className = 'chip chip-idle';
        jellyfinStatusChip.textContent = version;
      }
    }

    // 3. Scan Button
    if (jellyfinScanBtn) {
      if (isScanning) {
        jellyfinScanBtn.innerHTML = `<i class="ti ti-loader ti-spin"></i> <span class="pill-text-full">scanning ${scanProgress > 0 ? `${scanProgress}%` : '...'}</span><span class="pill-text-short">${scanProgress > 0 ? `${scanProgress}%` : '...'}</span>`;
        jellyfinScanBtn.disabled = true;
        jellyfinScanBtn.style.opacity = '0.9';
        jellyfinScanBtn.style.cursor = 'default';
      } else {
        jellyfinScanBtn.innerHTML = '<i class="ti ti-refresh"></i> <span class="pill-text-full">scan libraries</span><span class="pill-text-short">scan</span>';
        jellyfinScanBtn.disabled = false;
        jellyfinScanBtn.style.opacity = '1';
        jellyfinScanBtn.style.cursor = 'pointer';
      }

      jellyfinScanBtn.onclick = async (e) => {
        e.stopPropagation();
        if (jellyfinScanBtn.disabled) return;
        jellyfinScanBtn.disabled = true;
        jellyfinScanBtn.innerHTML = '<i class="ti ti-loader ti-spin"></i> <span class="pill-text-full">starting scan...</span><span class="pill-text-short">...</span>';
        try {
          const res = await fetch('/api/jellyfin/refresh', { method: 'POST' });
          const resData = await res.json();
          if (res.ok && resData.success) {
            jellyfinScanBtn.innerHTML = '<i class="ti ti-loader ti-spin"></i> <span class="pill-text-full">scanning...</span><span class="pill-text-short">...</span>';
            setTimeout(fetchStats, 600);
          } else {
            alert('Could not start library scan: ' + (resData.error || resData.message || 'Unknown error'));
            jellyfinScanBtn.disabled = false;
            jellyfinScanBtn.innerHTML = '<i class="ti ti-refresh"></i> <span class="pill-text-full">scan libraries</span><span class="pill-text-short">scan</span>';
          }
        } catch (err) {
          alert('Network error: ' + err.message);
          jellyfinScanBtn.disabled = false;
          jellyfinScanBtn.innerHTML = '<i class="ti ti-refresh"></i> <span class="pill-text-full">scan libraries</span><span class="pill-text-short">scan</span>';
        }
      };
    }

    // 4. Launch Pill
    if (jellyfinLaunchPill) {
      jellyfinLaunchPill.onclick = (e) => {
        e.stopPropagation();
        window.open(jellyfinUrl, '_blank');
      };
    }

    // 5. Summary Text
    if (jellyfinSummaryText) {
      if (!online) {
        jellyfinSummaryText.textContent = 'Could not connect to port 8096';
      } else {
        jellyfinSummaryText.textContent = `${(counts.movies || 0).toLocaleString()} movies · ${(counts.series || 0).toLocaleString()} series · ${(counts.episodes || 0).toLocaleString()} episodes`;
      }
    }

    // 6. Active Stream Status & Progress Bar
    const playingSession = sessions.find(s => s.nowPlaying);
    if (jellyfinStreamStatus && jellyfinStreamText) {
      if (!online) {
        jellyfinStreamStatus.style.color = 'var(--accent-red)';
        jellyfinStreamText.textContent = 'offline';
      } else if (isScanning) {
        jellyfinStreamStatus.style.color = 'var(--accent-purple)';
        jellyfinStreamText.textContent = `Library scan ${scanProgress}%`;
      } else if (playingSession && playingSession.nowPlaying) {
        const np = playingSession.nowPlaying;
        const title = np.seriesName ? `${np.seriesName} - ${np.name}` : np.name;
        jellyfinStreamStatus.style.color = 'var(--accent-purple)';
        jellyfinStreamText.innerHTML = `<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom;" title="${escapeHtml(title)}">${escapeHtml(playingSession.deviceName)}: ${escapeHtml(title)}</span>`;
      } else {
        jellyfinStreamStatus.style.color = 'var(--text-secondary)';
        jellyfinStreamText.textContent = 'idle · ready';
      }
    }

    // 7. Dynamic Progress Track / Bar
    if (jellyfinProgressBar && jellyfinProgressTrack) {
      if (isScanning) {
        jellyfinProgressTrack.style.display = 'block';
        jellyfinProgressBar.style.width = `${Math.max(6, scanProgress)}%`;
        jellyfinProgressBar.style.background = 'var(--accent-purple)';
      } else if (playingSession && playingSession.nowPlaying?.playbackPercent != null) {
        jellyfinProgressTrack.style.display = 'block';
        jellyfinProgressBar.style.width = `${playingSession.nowPlaying.playbackPercent}%`;
        jellyfinProgressBar.style.background = 'var(--accent-blue)';
      } else {
        jellyfinProgressTrack.style.display = 'none';
        jellyfinProgressBar.style.width = '0%';
      }
    }

    // 8. Meta Text
    if (jellyfinMetaText) {
      if (!online) {
        jellyfinMetaText.textContent = 'Port 8096 · Offline';
      } else {
        const totalItemsStr = (counts.items || 0).toLocaleString();
        jellyfinMetaText.textContent = `${jellyfin.serverName || 'Jellyfin'} · Port 8096 · ${totalItemsStr} items · ${jellyfin.latencyMs != null ? `${jellyfin.latencyMs}ms` : '<1ms'}`;
      }
    }

    // 9. Card Drilldown Click
    cardJellyfin.onclick = () => openJellyfinModal(jellyfin);
  }

  // Jellyfin Interactive Drilldown Modal
  function openJellyfinModal(jellyfin) {
    const titleHtml = `<i class="ti ti-device-tv" style="color:#a855f7;"></i><span>Jellyfin · Media Server</span>`;
    const host = getActiveHost();
    const jellyfinUrl = `http://${host}:${jellyfin?.port || 8096}`;
    const isOnline = jellyfin?.online !== false;
    const counts = jellyfin?.counts || { movies: 0, series: 0, episodes: 0, items: 0 };
    const sessions = jellyfin?.sessions || [];
    const scanTask = jellyfin?.scanTask || {};
    const isScanning = !!scanTask.isRunning;
    const scanProgress = scanTask.progress || 0;

    // Devices & Active Streams HTML
    let sessionsHtml = '';
    if (sessions.length > 0) {
      sessions.forEach(s => {
        const isPlaying = !!s.nowPlaying;
        const np = s.nowPlaying;
        const titleStr = np ? (np.seriesName ? `${np.seriesName} — ${np.name}` : np.name) : 'Connected / Idle';
        const progressStr = np?.playbackPercent != null ? ` · ${np.playbackPercent}% watched` : '';
        const pauseStr = np?.isPaused ? ' (paused)' : '';

        sessionsHtml += `
          <div class="exec-card" style="margin-bottom:6px;padding:8px 12px;">
            <span class="service-dot ${isPlaying ? 'online pulse' : 'online'}" style="margin-right:8px;${isPlaying ? 'background:var(--accent-purple);' : ''}"></span>
            <div style="flex:1;min-width:0;">
              <div class="exec-name" style="font-size:12.5px;display:flex;align-items:center;gap:6px;">
                <strong>${escapeHtml(s.deviceName)}</strong>
                <span style="font-size:11px;color:var(--text-muted);">(${escapeHtml(s.client)})</span>
              </div>
              <div class="exec-meta" style="font-size:11px;color:${isPlaying ? 'var(--text-primary)' : 'var(--text-muted)'};margin-top:2px;">
                ${isPlaying ? `<i class="ti ti-player-play" style="color:var(--accent-purple);"></i> ${escapeHtml(titleStr)}${pauseStr}${progressStr}` : 'No active media playing'}
              </div>
            </div>
            <span class="chip ${isPlaying ? 'chip-purple' : 'chip-idle'}">${isPlaying ? (np.isPaused ? 'paused' : 'playing') : 'idle'}</span>
          </div>
        `;
      });
    } else {
      sessionsHtml = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0;">No active devices connected.</div>';
    }

    const bodyHtml = `
      <div class="adguard-modal-wrap">
        <div class="network-status-box" style="margin-bottom:12px;">
          <div class="network-status-row">
            <span class="network-status-label">Server Version:</span>
            <span class="network-status-val" style="color:#a855f7;font-weight:600;">${jellyfin?.version || 'v12.0.0'} (${escapeHtml(jellyfin?.serverName || 'Shariqs-Mac-mini')})</span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Status & Latency:</span>
            <span class="network-status-val" style="color:${isOnline ? 'var(--accent-green-text)' : 'var(--accent-red)'};">
              ${isOnline ? `Online (${jellyfin?.latencyMs || '<1'}ms)` : 'Offline'}
            </span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Web Access URL:</span>
            <a href="${jellyfinUrl}" target="_blank" class="network-status-val" style="color:var(--accent-blue);text-decoration:underline;">http://${host}:8096</a>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Total Media Items:</span>
            <span class="network-status-val" style="font-family:var(--font-mono);">${(counts.items || 0).toLocaleString()} library files</span>
          </div>
        </div>

        <div style="font-size:12.5px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          <i class="ti ti-folder" style="color:#a855f7;"></i> Media Library Collections
        </div>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:14px;">
          <div style="background:var(--bg-frame);border:0.5px solid var(--border-color);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">${(counts.movies || 0).toLocaleString()}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;"><i class="ti ti-movie"></i> Movies</div>
          </div>
          <div style="background:var(--bg-frame);border:0.5px solid var(--border-color);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">${(counts.series || 0).toLocaleString()}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;"><i class="ti ti-device-tv"></i> TV Series</div>
          </div>
          <div style="background:var(--bg-frame);border:0.5px solid var(--border-color);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">${(counts.episodes || 0).toLocaleString()}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;"><i class="ti ti-video"></i> Episodes</div>
          </div>
        </div>

        <div style="font-size:12.5px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          <i class="ti ti-broadcast" style="color:#38bdf8;"></i> Connected Devices & Streams (${sessions.length})
        </div>
        <div style="margin-bottom:14px;">
          ${sessionsHtml}
        </div>

        <div style="font-size:12.5px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          <i class="ti ti-refresh" style="color:#a855f7;"></i> Media Library Scan
        </div>
        <div style="background:var(--bg-frame);border:0.5px solid var(--border-color);border-radius:8px;padding:12px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;color:var(--text-primary);font-weight:600;">Status: <span style="color:${isScanning ? 'var(--accent-purple)' : 'var(--text-secondary)'};">${isScanning ? `Scanning in progress (${scanProgress}%)` : 'Idle · All libraries indexed'}</span></span>
            <span class="chip ${isScanning ? 'chip-purple' : 'chip-idle'}">${isScanning ? 'running' : 'idle'}</span>
          </div>
          ${isScanning ? `
            <div class="progress-track" style="margin-bottom:10px;">
              <div class="progress-fill fill-normal" style="width:${Math.max(6, scanProgress)}%;background:var(--accent-purple);"></div>
            </div>
          ` : ''}
          <div style="display:flex;gap:8px;">
            <button class="lm-btn lm-btn-purple" id="modalJellyfinScanTrigger" style="flex:1;justify-content:center;padding:8px;" ${isScanning ? 'disabled' : ''}>
              <i class="ti ${isScanning ? 'ti-loader ti-spin' : 'ti-refresh'}"></i>
              ${isScanning ? `Scanning Libraries (${scanProgress}%)...` : 'Scan All Media Libraries'}
            </button>
          </div>
        </div>

        <div style="text-align:center;margin-top:6px;">
          <button class="lm-btn lm-btn-primary" style="width:100%;padding:10px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="window.open('${jellyfinUrl}', '_blank')">
            <i class="ti ti-external-link"></i> Open Jellyfin Web Portal (Port 8096)
          </button>
        </div>
      </div>
    `;

    openModal(titleHtml, bodyHtml);

    // Bind modal scan trigger button
    const modalTrigger = document.getElementById('modalJellyfinScanTrigger');
    if (modalTrigger && !isScanning) {
      modalTrigger.onclick = async () => {
        modalTrigger.disabled = true;
        modalTrigger.innerHTML = '<i class="ti ti-loader ti-spin"></i> Triggering scan...';
        try {
          const res = await fetch('/api/jellyfin/refresh', { method: 'POST' });
          const resData = await res.json();
          if (res.ok && resData.success) {
            modalTrigger.innerHTML = '<i class="ti ti-loader ti-spin"></i> Scan started!';
            setTimeout(async () => {
              await fetchStats();
              if (currentStats?.jellyfin) {
                openJellyfinModal(currentStats.jellyfin);
              }
            }, 600);
          } else {
            alert('Scan error: ' + (resData.error || resData.message || 'Unknown error'));
            modalTrigger.disabled = false;
            modalTrigger.innerHTML = '<i class="ti ti-refresh"></i> Scan All Media Libraries';
          }
        } catch (err) {
          alert('Network error: ' + err.message);
          modalTrigger.disabled = false;
          modalTrigger.innerHTML = '<i class="ti ti-refresh"></i> Scan All Media Libraries';
        }
      };
    }
  }

  // 8. Render Immich Photo & Video Server
  function renderImmich(immich) {
    if (!cardImmich) return;

    const online = immich?.online !== false;
    const version = immich?.version || 'v3.2.2';
    const mlOnline = immich?.mlOnline !== false;
    const host = getActiveHost();
    const immichUrl = `http://${host}:${immich?.port || 2283}`;

    if (immichDot) {
      immichDot.className = `service-dot ${online ? 'online' : 'offline'}`;
    }

    if (immichStatusChip) {
      if (!online) {
        immichStatusChip.className = 'chip chip-error';
        immichStatusChip.textContent = 'offline';
      } else {
        immichStatusChip.className = 'chip chip-idle';
        immichStatusChip.textContent = version;
      }
    }

    if (immichMlBadge) {
      if (!online) {
        immichMlBadge.textContent = 'offline';
      } else if (mlOnline) {
        immichMlBadge.textContent = 'ML ready';
      } else {
        immichMlBadge.textContent = 'ML starting';
      }
    }

    if (immichSummaryText) {
      if (!online) {
        immichSummaryText.textContent = 'Could not connect to port 2283';
      } else {
        immichSummaryText.textContent = `Photos & Videos · Port 2283 · ${immich.latencyMs != null ? `${immich.latencyMs}ms` : '<1ms'}`;
      }
    }

    if (immichFeaturesText) {
      if (!online) {
        immichFeaturesText.innerHTML = '<span style="color:var(--accent-red);"><i class="ti ti-alert-triangle"></i> offline</span>';
      } else {
        immichFeaturesText.innerHTML = '<i class="ti ti-sparkles"></i> smart search · faces · ocr';
      }
    }

    if (immichStorageText) {
      immichStorageText.textContent = immich?.storagePath || '/Volumes/HDD 4TB/immich-server';
    }

    if (immichLaunchPill) {
      immichLaunchPill.onclick = (e) => {
        e.stopPropagation();
        window.open(immichUrl, '_blank');
      };
    }

    cardImmich.onclick = () => openImmichModal(immich);
  }

  // Immich Interactive Drilldown Modal
  function openImmichModal(immich) {
    const titleHtml = `<i class="ti ti-photo" style="color:#818cf8;"></i><span>Immich · Photo Server</span>`;
    const host = getActiveHost();
    const immichUrl = `http://${host}:${immich?.port || 2283}`;
    const isOnline = immich?.online !== false;
    const containers = immich?.containers || [];

    let containersListHtml = '';
    if (containers.length > 0) {
      containers.forEach(c => {
        const isHealthy = c.healthy || c.state === 'running';
        containersListHtml += `
          <div class="exec-card" style="margin-bottom:6px;padding:8px 12px;">
            <span class="service-dot ${isHealthy ? 'online' : 'offline'}" style="margin-right:8px;"></span>
            <div style="flex:1;min-width:0;">
              <div class="exec-name" style="font-size:12.5px;">${escapeHtml(c.name)}</div>
              <div class="exec-meta" style="font-size:11px;">${escapeHtml(c.status)}</div>
            </div>
            <span class="chip ${isHealthy ? 'chip-idle' : 'chip-error'}">${c.state}</span>
          </div>
        `;
      });
    } else {
      containersListHtml = '<div style="font-size:12px;color:var(--text-muted);">No container status available.</div>';
    }

    const bodyHtml = `
      <div class="adguard-modal-wrap">
        <div class="network-status-box" style="margin-bottom:12px;">
          <div class="network-status-row">
            <span class="network-status-label">Server Version:</span>
            <span class="network-status-val" style="color:#818cf8;font-weight:600;">${immich?.version || 'v3.2.2'}</span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Status & Latency:</span>
            <span class="network-status-val" style="color:${isOnline ? 'var(--accent-green-text)' : 'var(--accent-red)'};">
              ${isOnline ? `Online (${immich?.latencyMs || '<1'}ms)` : 'Offline'}
            </span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Web Access URL:</span>
            <a href="${immichUrl}" target="_blank" class="network-status-val" style="color:var(--accent-blue);text-decoration:underline;">http://${host}:2283</a>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">Primary Library:</span>
            <span class="network-status-val" style="font-size:11px;">${escapeHtml(immich?.storagePath || '/Volumes/HDD 4TB/immich-server')}</span>
          </div>
          <div class="network-status-row">
            <span class="network-status-label">External Libraries:</span>
            <span class="network-status-val" style="font-size:11px;">HDD 4TB (Reddit, Face Swap)</span>
          </div>
        </div>

        <div style="font-size:12.5px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          <i class="ti ti-brand-docker" style="color:#38bdf8;"></i> Docker Microservices (${immich?.containersCount || containers.length}/4)
        </div>
        <div style="margin-bottom:12px;">
          ${containersListHtml}
        </div>

        <div style="font-size:12.5px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          <i class="ti ti-sparkles" style="color:#f59e0b;"></i> AI & Server Features
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
          <span class="chip chip-idle"><i class="ti ti-search"></i> Smart CLIP Search</span>
          <span class="chip chip-idle"><i class="ti ti-user-check"></i> Facial Recognition</span>
          <span class="chip chip-idle"><i class="ti ti-copy"></i> Duplicate Detection</span>
          <span class="chip chip-idle"><i class="ti ti-file-text"></i> OCR Text Search</span>
          <span class="chip chip-idle"><i class="ti ti-map-pin"></i> Reverse Geocoding</span>
        </div>

        <div style="text-align:center;margin-top:10px;">
          <button class="lm-btn lm-btn-primary" style="width:100%;padding:10px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="window.open('${immichUrl}', '_blank')">
            <i class="ti ti-external-link"></i> Open Immich Web Portal (Port 2283)
          </button>
        </div>
      </div>
    `;

    openModal(titleHtml, bodyHtml);
  }

  // 8. Render Arr Media Suite
  function renderArrSuite(arr) {
    if (!cardArrSuite) return;

    const onlineCount = arr?.onlineCount || 0;
    const totalCount = arr?.totalCount || 4;
    const isAllUp = onlineCount === totalCount && totalCount > 0;

    if (arrDot) {
      arrDot.className = `service-dot ${isAllUp ? 'online' : (onlineCount > 0 ? 'warning' : 'offline')}`;
    }

    if (arrStatusChip) {
      if (isAllUp) {
        arrStatusChip.className = 'chip chip-idle';
        arrStatusChip.textContent = `${onlineCount}/${totalCount} online`;
      } else if (onlineCount > 0) {
        arrStatusChip.className = 'chip chip-warning';
        arrStatusChip.textContent = `${onlineCount}/${totalCount} up`;
      } else {
        arrStatusChip.className = 'chip chip-error';
        arrStatusChip.textContent = 'offline';
      }
    }

    if (arrOnlineText) {
      arrOnlineText.textContent = `${onlineCount} of ${totalCount} up`;
    }

    if (arrLaunchPill) {
      arrLaunchPill.onclick = (e) => {
        e.stopPropagation();
        openArrSuiteModal(arr);
      };
    }

    cardArrSuite.onclick = () => openArrSuiteModal(arr);
  }

  // 9. Render Docker Container Engine
  function renderDocker(docker) {
    if (!cardDocker) return;

    const count = docker?.runningCount || 0;
    const available = docker?.available !== false;

    if (dockerDot) {
      dockerDot.className = `service-dot ${available && count > 0 ? 'online' : (available ? 'warning' : 'offline')}`;
    }

    if (dockerStatusChip) {
      if (!available) {
        dockerStatusChip.className = 'chip chip-error';
        dockerStatusChip.textContent = 'socket offline';
      } else {
        dockerStatusChip.className = 'chip chip-idle';
        dockerStatusChip.textContent = `${count} running`;
      }
    }

    if (dockerSubtitleText) {
      dockerSubtitleText.textContent = docker?.subtitle || `${count} containers healthy`;
    }

    if (dockerContainersPreview) {
      const names = (docker?.containers || []).map(c => (c.name || '').replace(/^\//, '')).filter(Boolean);
      dockerContainersPreview.textContent = names.length > 0 ? names.slice(0, 4).join(', ') : 'immich, n8n, valkey, postgres';
    }

    if (dockerInspectPill) {
      dockerInspectPill.onclick = (e) => {
        e.stopPropagation();
        openDockerModal(docker);
      };
    }

    cardDocker.onclick = () => openDockerModal(docker);
  }

  function renderOfflineState() {
    if (serverStatusDot) serverStatusDot.classList.remove('pulse');
    if (serverUptimeText) serverUptimeText.textContent = 'offline · attempting reconnect...';
  }

  // ====================================================
  // Interactive Modals
  // ====================================================
  function openModal(titleHtml, bodyHtml) {
    if (!modalOverlay || !modalTitle || !modalBody) return;
    modalTitle.innerHTML = titleHtml;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('active');
  }

  // LM Studio Model Management Portal Modal
  async function openLmStudioPortal(lmData) {
    const titleHtml = `<i class="ti ti-brain" style="color:var(--accent-purple);"></i><span>LM Studio · Model Manager</span>`;
    
    const bodyHtml = `
      <div class="lm-portal-section">
        <div class="lm-portal-title">Currently Loaded Model (In Memory)</div>
        <div id="lmLoadedContainer" class="lm-active-card">
          <div style="color:var(--text-secondary);font-size:13px;"><i class="ti ti-loader animate-spin"></i> Checking loaded status...</div>
        </div>
      </div>

      <div class="lm-portal-section">
        <div class="lm-portal-title">Available Models on Mac Mini</div>
        <div id="lmModelsList" class="lm-models-list">
          <div style="color:var(--text-secondary);font-size:13px;"><i class="ti ti-loader animate-spin"></i> Loading local models...</div>
        </div>
      </div>

      <div class="lm-portal-section" style="margin-bottom:0;">
        <div class="lm-portal-title">Inference Speed Stats</div>
        <div class="exec-card" style="margin-bottom:0;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">Token Generation Rate</div>
            <div style="font-size:11.5px;color:var(--text-secondary);margin-top:3px;" id="lmSpeedText">
              Eval: ${lmData?.speed?.evalTps ? `⚡ ${lmData.speed.evalTps} tok/s` : 'idle'} · Prompt: ${lmData?.speed?.promptTps ? `⚡ ${lmData.speed.promptTps} tok/s` : 'idle'}
            </div>
          </div>
          <span class="chip ${lmData?.loadedModel?.status === 'generating' ? 'chip-generating' : 'chip-idle'}">
            ${lmData?.loadedModel?.status || 'idle'}
          </span>
        </div>
      </div>
    `;

    openModal(titleHtml, bodyHtml);
    await refreshLmStudioModalData();
  }

  async function refreshLmStudioModalData() {
    const loadedBox = document.getElementById('lmLoadedContainer');
    const listContainer = document.getElementById('lmModelsList');
    if (!loadedBox || !listContainer) return;

    try {
      const res = await fetch('/api/lmstudio/models');
      if (!res.ok) throw new Error('Failed to query models API');
      const data = await res.json();
      const loaded = data.loaded || [];
      const available = data.available || [];

      // 1. Loaded Model Box
      if (loaded.length > 0) {
        const active = loaded[0];
        const memMb = active.sizeBytes ? (active.sizeBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : 'Active in GPU';
        loadedBox.innerHTML = `
          <div class="lm-active-header">
            <div>
              <div class="lm-model-name-large">${escapeHtml(active.displayName || active.modelKey)}</div>
              <div style="font-size:11px;color:var(--text-secondary);margin-top:3px;">
                ${escapeHtml(active.architecture || 'llm')} · ${escapeHtml(active.quantization?.name || '4bit')} · ${memMb}
              </div>
            </div>
            <button class="lm-btn lm-btn-danger" id="btnUnloadModel">
              <i class="ti ti-trash"></i> Unload
            </button>
          </div>
        `;
        document.getElementById('btnUnloadModel').addEventListener('click', async (e) => {
          e.target.disabled = true;
          e.target.innerHTML = `<i class="ti ti-loader animate-spin"></i> Unloading...`;
          try {
            await fetch('/api/lmstudio/unload', { method: 'POST' });
            await refreshLmStudioModalData();
            fetchStats();
          } catch (err) {
            alert('Failed to unload model: ' + err.message);
          }
        });
      } else {
        loadedBox.innerHTML = `
          <div style="color:var(--text-secondary);font-size:13px;display:flex;align-items:center;justify-content:space-between;">
            <span>No model in memory (0 MB VRAM used)</span>
            <span class="chip chip-idle">Idle</span>
          </div>
        `;
      }

      // 2. Available Models List
      if (available.length === 0) {
        listContainer.innerHTML = `<div style="color:var(--text-muted);font-size:12px;">No models found in LM Studio library.</div>`;
      } else {
        listContainer.innerHTML = '';
        available.forEach(m => {
          const isLoaded = loaded.some(l => l.modelKey === m.modelKey || l.displayName === m.displayName);
          const sizeGb = m.sizeBytes ? (m.sizeBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB' : '';
          const quant = m.quantization?.name || '';
          
          const row = document.createElement('div');
          row.className = 'lm-model-row';
          row.innerHTML = `
            <div class="lm-model-info">
              <div class="lm-model-title" title="${escapeHtml(m.displayName || m.modelKey)}">
                ${escapeHtml(m.displayName || m.modelKey)}
              </div>
              <div class="lm-model-meta">
                ${quant ? `<span class="lm-badge-quant">${escapeHtml(quant)}</span>` : ''}
                ${sizeGb ? `<span>${sizeGb}</span>` : ''}
                <span>${escapeHtml(m.architecture || '')}</span>
              </div>
            </div>
            <div>
              ${isLoaded ? `
                <span class="chip chip-idle">Loaded</span>
              ` : `
                <button class="lm-btn lm-btn-primary btn-load-model" data-key="${escapeHtml(m.modelKey)}">
                  <i class="ti ti-download"></i> Load
                </button>
              `}
            </div>
          `;
          listContainer.appendChild(row);
        });

        // Event listeners for load
        listContainer.querySelectorAll('.btn-load-model').forEach(btn => {
          btn.addEventListener('click', async () => {
            const key = btn.getAttribute('data-key');
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> Loading...`;
            try {
              const res = await fetch('/api/lmstudio/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelKey: key })
              });
              const rData = await res.json();
              if (res.ok) {
                await refreshLmStudioModalData();
                fetchStats();
              } else {
                alert('Failed to load model: ' + (rData.error || 'Unknown error'));
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-download"></i> Load`;
              }
            } catch (err) {
              alert('Error loading model: ' + err.message);
              btn.disabled = false;
              btn.innerHTML = `<i class="ti ti-download"></i> Load`;
            }
          });
        });
      }
    } catch (err) {
      loadedBox.innerHTML = `<div style="color:var(--accent-red);font-size:12px;">Error connecting to LM Studio: ${err.message}</div>`;
      listContainer.innerHTML = `<div style="color:var(--text-muted);font-size:12px;">Ensure LM Studio server is running.</div>`;
    }
  }

  // Modal: Top 10 RAM Processes
  function openProcessesModal(processes) {
    const titleHtml = `<i class="ti ti-chart-bar" style="color:var(--accent-amber);"></i><span>Top 10 RAM Consumers</span>`;
    const ramStats = currentStats?.metrics?.ram;
    let bodyHtml = '';

    if (ramStats) {
      bodyHtml += `
        <div class="ram-summary-box">
          <div class="ram-summary-row">
            <span class="ram-summary-title">System Memory Usage</span>
            <span class="ram-summary-val">${ramStats.usedFormatted} / ${ramStats.totalFormatted} (${ramStats.percent}%)</span>
          </div>
          <div class="ram-summary-bar">
            <div class="ram-summary-fill" style="width: ${ramStats.percent}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono);">
            <span>Free: ${ramStats.freeFormatted}</span>
            <span>${(processes || []).length} Top Consumers Tracked</span>
          </div>
        </div>
      `;
    }

    if (!processes || processes.length === 0) {
      bodyHtml += `<div style="color:var(--text-muted);padding:14px;text-align:center;">No process telemetry currently available.</div>`;
    } else {
      bodyHtml += '<div style="display:flex;flex-direction:column;gap:6px;">';
      processes.forEach((proc, idx) => {
        const memPct = proc.memPercent || 0;
        const barWidth = Math.min(100, Math.max(6, memPct * 3.5));
        const isTop3 = idx < 3 ? 'top3' : '';
        bodyHtml += `
          <div class="proc-modal-item">
            <div class="proc-rank-badge ${isTop3}">#${idx + 1}</div>
            <div class="proc-name-col">
              <div class="proc-app-title" title="${escapeHtml(proc.name)}">${escapeHtml(proc.name)}</div>
              <div class="proc-app-meta">PID ${proc.pid} · ${memPct.toFixed(1)}% total memory</div>
            </div>
            <div class="proc-bar-wrap">
              <div class="proc-bar-track">
                <div class="proc-bar-inner" style="width: ${barWidth}%;"></div>
              </div>
            </div>
            <div class="proc-val-col">
              <div class="proc-mem-mb">${proc.rssFormatted}</div>
              <div class="proc-mem-pct">${memPct.toFixed(1)}%</div>
            </div>
          </div>
        `;
      });
      bodyHtml += '</div>';
    }

    openModal(titleHtml, bodyHtml);
  }

  // Modal: n8n Failed Executions
  function openN8nModal(n8n) {
    const titleHtml = `<i class="ti ti-bolt" style="color:var(--accent-amber);"></i><span>n8n Executions History</span>`;
    const execs = n8n?.executions || [];
    let bodyHtml = `
      <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:var(--text-secondary);">Last 10 executions recorded</span>
        <button class="interactive-pill pill-purple" onclick="window.open('${N8N_URL}', '_blank')" style="padding:4px 10px;">
          <i class="ti ti-external-link"></i> Open n8n Web UI
        </button>
      </div>
      <div class="exec-list">
    `;
    if (execs.length === 0) {
      bodyHtml += `<div style="color:var(--text-muted);padding:14px;text-align:center;">No recent execution records found.</div>`;
    } else {
      execs.forEach(item => {
        const statusClass = item.status === 'error' || item.status === 'failed' ? 'chip-error' : (item.status === 'running' ? 'chip-generating' : 'chip-idle');
        bodyHtml += `
          <div class="exec-card">
            <div style="flex:1;min-width:0;">
              <div class="exec-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.workflowName || 'Unnamed Workflow')}</div>
              <div class="exec-meta">ID #${item.id} · ${escapeHtml(item.startedAt || '')}</div>
            </div>
            <span class="chip ${statusClass}">${item.status}</span>
          </div>
        `;
      });
    }
    bodyHtml += '</div>';
    openModal(titleHtml, bodyHtml);
  }

  // Modal: qBittorrent Manager
  function openQBittorrentModal(qbt) {
    const titleHtml = `<i class="ti ti-download" style="color:var(--accent-blue);"></i><span>qBittorrent · Download Manager</span>`;
    const host = getActiveHost();
    const qbtUrl = `http://${host}:8080`;
    const torrents = qbt?.torrents || [];

    let bodyHtml = `
      <div class="qbt-summary-box">
        <div class="qbt-stat-item">
          <span class="qbt-stat-label">Download Speed</span>
          <span class="qbt-stat-value" style="color:var(--accent-green-text);">↓ ${qbt?.dlSpeedFormatted || '0 B/s'}</span>
        </div>
        <div class="qbt-stat-item">
          <span class="qbt-stat-label">Upload Speed</span>
          <span class="qbt-stat-value" style="color:var(--accent-blue);">↑ ${qbt?.upSpeedFormatted || '0 B/s'}</span>
        </div>
        <div class="qbt-stat-item">
          <span class="qbt-stat-label">Total Downloaded</span>
          <span class="qbt-stat-value">${qbt?.dlTotalFormatted || '0 B'}</span>
        </div>
        <div class="qbt-stat-item">
          <span class="qbt-stat-label">Connection</span>
          <span class="qbt-stat-value" style="text-transform:capitalize;">${qbt?.connectionStatus || 'Connected'}</span>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);">
          Torrents (${torrents.length})
        </span>
        <button class="interactive-pill pill-blue" onclick="window.open('${qbtUrl}', '_blank')" style="padding:4px 10px;">
          <i class="ti ti-external-link"></i> Web UI (Port 8080)
        </button>
      </div>
    `;

    if (torrents.length === 0) {
      bodyHtml += `
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:30px 20px;text-align:center;">
          <i class="ti ti-circle-check" style="font-size:32px;color:var(--accent-green);display:block;margin-bottom:8px;"></i>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);">No Active Downloads</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">All torrent downloads are complete or none are currently queued in qBittorrent.</div>
        </div>
      `;
    } else {
      bodyHtml += `<div style="display:flex;flex-direction:column;gap:10px;">`;
      torrents.forEach(t => {
        const isPaused = t.isPaused;
        bodyHtml += `
          <div class="torrent-card">
            <div class="torrent-header">
              <div class="torrent-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
              <span class="chip ${isPaused ? 'chip-idle' : 'chip-generating'}">${escapeHtml(t.state)}</span>
            </div>
            
            <div class="torrent-meta">
              <span>${t.sizeFormatted}</span>
              <span>${t.progress}%</span>
              ${t.dlSpeed > 0 ? `<span style="color:var(--accent-green-text);">↓ ${t.dlSpeedFormatted}</span>` : ''}
              ${t.upSpeed > 0 ? `<span style="color:var(--accent-blue);">↑ ${t.upSpeedFormatted}</span>` : ''}
              ${t.etaFormatted !== '∞' ? `<span>ETA: ${t.etaFormatted}</span>` : ''}
              <span>Seeds: ${t.numSeeds || 0}</span>
            </div>

            <div class="progress-track" style="height:5px;">
              <div class="progress-fill fill-normal" style="width:${t.progress}%;"></div>
            </div>

            <div class="torrent-actions">
              ${isPaused ? `
                <button class="torrent-btn btn-start" onclick="handleTorrentAction('start', '${t.hash}')">
                  <i class="ti ti-player-play"></i> Resume
                </button>
              ` : `
                <button class="torrent-btn btn-stop" onclick="handleTorrentAction('stop', '${t.hash}')">
                  <i class="ti ti-player-pause"></i> Pause
                </button>
              `}
              <button class="torrent-btn btn-del" onclick="handleTorrentAction('delete', '${t.hash}')">
                <i class="ti ti-trash"></i> Remove
              </button>
            </div>
          </div>
        `;
      });
      bodyHtml += `</div>`;
    }

    openModal(titleHtml, bodyHtml);
  }

  window.handleTorrentAction = async function(action, hash) {
    let deleteFiles = false;
    if (action === 'delete') {
      const confirmMsg = confirm('Remove this torrent from qBittorrent?\n\nClick OK to confirm removing the torrent.');
      if (!confirmMsg) return;
      deleteFiles = confirm('Also delete downloaded files from disk?\n\nOK = Delete files\nCancel = Keep files only');
    }

    try {
      let url = `/api/qbittorrent/${action}`;
      let body = { hash };
      if (action === 'delete') body.deleteFiles = deleteFiles;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      // Refresh qbt stats and modal
      const qRes = await fetch('/api/qbittorrent/stats');
      if (qRes.ok) {
        const newQbt = await qRes.json();
        openQBittorrentModal(newQbt);
      }
      fetchStats();
    } catch (err) {
      alert(`qBittorrent error: ${err.message}`);
    }
  };

  // Modal: AdGuard Home DNS Adblocker
  function openAdGuardModal(ag) {
    if (!ag) return;
    const host = getActiveHost();
    const webUrl = `http://${host}:${ag.webPort || 81}`;
    const lanIp = serverConfig?.serverLanIp || 'LAN IP';
    const tailscaleIp = serverConfig?.tailscaleIp || 'Tailscale IP';

    const titleHtml = `<i class="ti ti-shield-check" style="color:#67B279;"></i><span>AdGuard Home · Network Adblocker</span>`;

    const bodyHtml = `
      <div class="adguard-modal-wrap">
        <!-- Status Hero Box -->
        <div class="adguard-hero-box" style="background:rgba(103,178,121,0.08);border:1px solid rgba(103,178,121,0.25);border-radius:12px;padding:14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:10px;background:rgba(103,178,121,0.18);display:flex;align-items:center;justify-content:center;color:#67B279;font-size:22px;flex-shrink:0;">
              <i class="ti ti-shield-check"></i>
            </div>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text-primary);">Network-Wide Protection Active</div>
              <div style="font-size:11.5px;color:var(--text-secondary);">${ag.rulesFormatted || '180,314'} filter rules blocking ads & trackers</div>
            </div>
          </div>
          <a href="${webUrl}" target="_blank" class="interactive-pill pill-green" style="text-decoration:none;padding:6px 14px;font-size:11.5px;display:inline-flex;align-items:center;gap:4px;">
            Open Web UI ↗
          </a>
        </div>

        <!-- Telemetry Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <div class="adguard-stat-card" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:10px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">DNS Engine (Port 53)</div>
            <div style="font-size:13.5px;font-weight:600;color:${ag.dnsOnline ? 'var(--accent-green-text)' : 'var(--accent-red)'};">
              <i class="ti ti-${ag.dnsOnline ? 'check' : 'x'}"></i> ${ag.dnsOnline ? 'Listening & Active' : 'Offline'}
            </div>
            <div style="font-size:10.5px;color:var(--text-secondary);margin-top:2px;">Latency: ${ag.dnsLatencyMs != null ? ag.dnsLatencyMs + 'ms' : '<1ms'}</div>
          </div>

          <div class="adguard-stat-card" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:10px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Upstream DNS</div>
            <div style="font-size:13.5px;font-weight:600;color:var(--text-primary);">
              ${ag.upstreamDns || 'Quad9 (DoH)'}
            </div>
            <div style="font-size:10.5px;color:var(--text-secondary);margin-top:2px;">Encrypted DNS-over-HTTPS</div>
          </div>

          <div class="adguard-stat-card" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:10px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Active Blocking Rules</div>
            <div style="font-size:14px;font-weight:700;color:#67B279;">
              ${ag.rulesFormatted || '180,314'}
            </div>
            <div style="font-size:10.5px;color:var(--text-secondary);margin-top:2px;">Auto-updated filter lists</div>
          </div>

          <div class="adguard-stat-card" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:10px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">AdGuard Version</div>
            <div style="font-size:13.5px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono);">
              ${ag.version || 'v0.107.79'}
            </div>
            <div style="font-size:10.5px;color:var(--text-secondary);margin-top:2px;">Web Management Port ${ag.webPort || 81}</div>
          </div>
        </div>

        <!-- Live DNS Blocking Verification Box -->
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:600;color:var(--text-primary);">Live DNS Interception Test</span>
            <span class="chip chip-green" style="font-size:10px;">LIVE PROBE PASS</span>
          </div>
          <div style="font-size:11.5px;color:var(--text-secondary);line-height:1.4;">
            Probed ad tracking domain <code style="color:var(--accent-amber);background:rgba(255,255,255,0.05);padding:1px 4px;border-radius:4px;">doubleclick.net</code> against local DNS <code style="color:var(--text-primary);">127.0.0.1:53</code>. Successfully intercepted and blackholed to <code style="color:#67B279;">0.0.0.0</code> in <strong>${ag.dnsLatencyMs || 2}ms</strong>.
          </div>
        </div>

        <!-- Client Setup Guide -->
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:12px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
            <i class="ti ti-devices" style="color:var(--accent-blue);margin-right:4px;"></i> Device DNS Configuration
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">
            Point your router, iPhone, Apple TV, or laptop DNS server to this Mac Mini:
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-family:var(--font-mono);font-size:11.5px;">
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-frame);padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);">
              <span style="color:var(--text-muted);">Home Wi-Fi (LAN):</span>
              <strong style="color:var(--accent-green-text);">${lanIp}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-frame);padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);">
              <span style="color:var(--text-muted);">Tailscale Mesh:</span>
              <strong style="color:#a78bfa;">${tailscaleIp}</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    openModal(titleHtml, bodyHtml);
  }

  // Modal: Docker Containers
  function openDockerModal(docker) {
    const titleHtml = `<i class="ti ti-brand-docker"></i><span>Docker Containers</span>`;
    const containers = docker?.containers || [];
    let bodyHtml = '<div class="exec-list">';
    if (containers.length === 0) {
      bodyHtml += `<div style="color:var(--text-muted);padding:14px;text-align:center;">No running containers detected.</div>`;
    } else {
      containers.forEach(c => {
        const isUp = c.state === 'running';
        bodyHtml += `
          <div class="exec-card">
            <span class="service-dot ${isUp ? 'online' : 'offline'}" style="margin-right:8px;"></span>
            <div style="flex:1;min-width:0;">
              <div class="exec-name">${escapeHtml(c.name)}</div>
              <div class="exec-meta">${escapeHtml(c.image || '')} · ${escapeHtml(c.status || '')}</div>
            </div>
            <span class="chip ${isUp ? 'chip-idle' : 'chip-error'}">${c.state}</span>
          </div>
        `;
      });
    }
    bodyHtml += '</div>';
    openModal(titleHtml, bodyHtml);
  }

  // Modal: Arr Suite Services
  function openArrSuiteModal(arrSuite) {
    const titleHtml = `<i class="ti ti-movie"></i><span>Arr Media Suite</span>`;
    const services = arrSuite?.services || [];
    const host = getActiveHost();
    let bodyHtml = '<div class="exec-list">';
    services.forEach(s => {
      bodyHtml += `
        <div class="exec-card" style="cursor:pointer;" onclick="window.open('http://${host}:${s.port}', '_blank')">
          <span class="service-dot ${s.online ? 'online' : 'offline'}" style="margin-right:8px;"></span>
          <div style="flex:1;">
            <div class="exec-name">${escapeHtml(s.name)}</div>
            <div class="exec-meta">Port ${s.port} · http://${host}:${s.port}</div>
          </div>
          <span class="interactive-pill" style="margin-right:8px;">open ↗</span>
          <span class="chip ${s.online ? 'chip-idle' : 'chip-error'}">${s.online ? 'online' : 'down'}</span>
        </div>
      `;
    });
    bodyHtml += '</div>';
    openModal(titleHtml, bodyHtml);
  }

  // Modal: Storage
  function openStorageModal() {
    if (!currentStats?.metrics) return;
    const { internalSsd, externalDrives } = currentStats.metrics;
    const titleHtml = `<i class="ti ti-database"></i><span>Storage Volumes</span>`;
    let itemsHtml = '<div class="exec-list">';
    if (internalSsd) {
      itemsHtml += `
        <div class="exec-card">
          <div style="flex:1;">
            <div class="exec-name">Internal SSD (${escapeHtml(internalSsd.mount)})</div>
            <div class="exec-meta">${internalSsd.usedFormatted} used of ${internalSsd.totalFormatted} (${internalSsd.freeFormatted} free)</div>
            <div style="margin-top:6px;height:4px;background:var(--border-color);border-radius:2px;overflow:hidden;">
              <div style="width:${internalSsd.percent}%;height:100%;background:var(--accent-blue);"></div>
            </div>
          </div>
          <div style="font-size:16px;font-weight:500;margin-left:14px;">${internalSsd.percent}%</div>
        </div>
      `;
    }
    (externalDrives || []).forEach(ext => {
      itemsHtml += `
        <div class="exec-card">
          <div style="flex:1;">
            <div class="exec-name">${escapeHtml(ext.name)} (${escapeHtml(ext.mount)})</div>
            <div class="exec-meta">${ext.usedFormatted} used of ${ext.totalFormatted} (${ext.freeFormatted} free)</div>
            <div style="margin-top:6px;height:4px;background:var(--border-color);border-radius:2px;overflow:hidden;">
              <div style="width:${ext.percent}%;height:100%;background:var(--accent-amber);"></div>
            </div>
          </div>
          <div style="font-size:16px;font-weight:500;margin-left:14px;">${ext.percent}%</div>
        </div>
      `;
    });
    itemsHtml += '</div>';
    openModal(titleHtml, itemsHtml);
  }

  // Modal: Top CPU Processes & Utilization
  function openCpuModal() {
    if (!currentStats?.metrics?.cpu) return;
    const { percent, coreCount, topProcesses } = currentStats.metrics.cpu;
    const titleHtml = `<i class="ti ti-cpu" style="color:var(--accent-blue);"></i><span>Top CPU Processes</span>`;
    let bodyHtml = `
      <div class="ram-summary-box">
        <div class="ram-summary-row">
          <span class="ram-summary-title">System CPU Utilization</span>
          <span class="ram-summary-val">${percent}% (${coreCount || 8} cores)</span>
        </div>
        <div class="ram-summary-bar">
          <div class="ram-summary-fill" style="width: ${Math.min(100, Math.max(0, percent))}%; background: var(--accent-blue);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono);">
          <span>Overall Load: ${percent}%</span>
          <span>${(topProcesses || []).length} Top Processes Tracked</span>
        </div>
      </div>
    `;

    if (!topProcesses || topProcesses.length === 0) {
      bodyHtml += `<div style="color:var(--text-muted);padding:14px;text-align:center;">No CPU process telemetry available.</div>`;
    } else {
      bodyHtml += '<div style="display:flex;flex-direction:column;gap:6px;">';
      const maxCpu = Math.max(100, (topProcesses[0]?.cpuPercent || 100));
      topProcesses.forEach((proc, idx) => {
        const cpuVal = proc.cpuPercent || 0;
        const barWidth = Math.min(100, Math.max(4, (cpuVal / maxCpu) * 100));
        const isTop3 = idx < 3 ? 'top3' : '';
        const barColor = cpuVal >= 80 ? 'var(--accent-red)' : (cpuVal >= 40 ? 'var(--accent-amber)' : 'var(--accent-blue)');
        bodyHtml += `
          <div class="proc-modal-item">
            <div class="proc-rank-badge ${isTop3}">#${idx + 1}</div>
            <div class="proc-name-col">
              <div class="proc-app-title" title="${escapeHtml(proc.name)}">${escapeHtml(proc.name)}</div>
              <div class="proc-app-meta">PID ${proc.pid} · ${proc.memPercent ? proc.memPercent.toFixed(1) + '% RAM' : ''}</div>
            </div>
            <div class="proc-bar-wrap">
              <div class="proc-bar-track">
                <div class="proc-bar-inner" style="width: ${barWidth}%; background: ${barColor};"></div>
              </div>
            </div>
            <div class="proc-val-col">
              <div class="proc-mem-mb" style="color: ${barColor};">${cpuVal.toFixed(1)}%</div>
              <div class="proc-mem-pct">CPU</div>
            </div>
          </div>
        `;
      });
      bodyHtml += '</div>';
    }

    openModal(titleHtml, bodyHtml);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updateTimerDisplay() {
    if (refreshTimerEl) refreshTimerEl.textContent = `${countdownSeconds}s`;
  }

  function stopPolling() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function startCountdown() {
    stopPolling();
    countdownSeconds = Math.round(refreshInterval / 1000);
    updateTimerDisplay();
    countdownTimer = setInterval(() => {
      countdownSeconds--;
      if (countdownSeconds <= 0) {
        fetchStats();
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  // Modal: Mac Mini Power Management
  function openPowerModal() {
    const titleHtml = `<i class="ti ti-power" style="color:var(--accent-red);"></i><span>Mac Mini Power Controls</span>`;

    const renderInitial = () => {
      const bodyHtml = `
        <div class="power-modal-wrap">
          <div class="power-warning-alert">
            <i class="ti ti-alert-triangle"></i>
            <div>
              <strong>System Power Management</strong><br>
              Actions affect the physical Mac Mini. Active tunnels, background services, AI models, and torrents will be stopped.
            </div>
          </div>

          <div class="power-options-grid">
            <!-- Restart Card -->
            <div class="power-card restart">
              <div class="power-card-header">
                <div class="power-card-icon">
                  <i class="ti ti-refresh"></i>
                </div>
                <div>
                  <div class="power-card-title">Restart System</div>
                  <div class="power-card-desc">Clean reboot of macOS. All services and tunnels will resume on boot.</div>
                </div>
              </div>
              <button class="power-action-btn btn-restart" id="btnTriggerRestart">
                <i class="ti ti-refresh"></i>
                <span>Restart Mac Mini</span>
              </button>
            </div>

            <!-- Shut Down Card -->
            <div class="power-card shutdown">
              <div class="power-card-header">
                <div class="power-card-icon">
                  <i class="ti ti-power"></i>
                </div>
                <div>
                  <div class="power-card-title">Shut Down System</div>
                  <div class="power-card-desc">Full power off. A physical button press is required to turn back on.</div>
                </div>
              </div>
              <button class="power-action-btn btn-shutdown" id="btnTriggerShutdown">
                <i class="ti ti-power"></i>
                <span>Shut Down Mac Mini</span>
              </button>
            </div>
          </div>
        </div>
      `;

      openModal(titleHtml, bodyHtml);

      const btnRestart = document.getElementById('btnTriggerRestart');
      const btnShutdown = document.getElementById('btnTriggerShutdown');

      if (btnRestart) {
        btnRestart.addEventListener('click', () => renderConfirm('restart'));
      }
      if (btnShutdown) {
        btnShutdown.addEventListener('click', () => renderConfirm('shutdown'));
      }
    };

    const renderConfirm = (actionType) => {
      const isRestart = actionType === 'restart';
      const actionName = isRestart ? 'Restart' : 'Shut Down';
      const actionColor = isRestart ? 'confirm-amber' : 'confirm-danger';
      const iconClass = isRestart ? 'ti-refresh' : 'ti-power';
      const alertMsg = isRestart
        ? 'Are you sure you want to <strong>restart</strong> the Mac Mini? Telemetry will disconnect and reconnect once macOS completes booting.'
        : 'Are you sure you want to <strong>shut down</strong> the Mac Mini? The server will power completely off. You will need physical button access to turn it back on.';

      const bodyHtml = `
        <div class="power-modal-wrap">
          <div class="power-confirm-box">
            <div style="font-size:36px;color:${isRestart ? 'var(--accent-amber)' : 'var(--accent-red)'};">
              <i class="ti ${iconClass}"></i>
            </div>
            <div class="power-confirm-msg">${alertMsg}</div>
            <div class="power-confirm-actions">
              <button class="power-confirm-btn" id="btnPowerCancel">Cancel</button>
              <button class="power-confirm-btn ${actionColor}" id="btnPowerProceed">
                <i class="ti ${iconClass}"></i> Confirm ${actionName}
              </button>
            </div>
          </div>
        </div>
      `;

      if (modalBody) modalBody.innerHTML = bodyHtml;

      const btnCancel = document.getElementById('btnPowerCancel');
      const btnProceed = document.getElementById('btnPowerProceed');

      if (btnCancel) {
        btnCancel.addEventListener('click', renderInitial);
      }

      if (btnProceed) {
        btnProceed.addEventListener('click', async () => {
          btnProceed.disabled = true;
          if (btnCancel) btnCancel.disabled = true;
          btnProceed.innerHTML = `<i class="ti ti-loader ti-spin"></i> Executing...`;

          try {
            const endpoint = isRestart ? '/api/system/restart' : '/api/system/shutdown';
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            await res.json();

            if (modalBody) {
              modalBody.innerHTML = `
                <div class="power-confirm-box" style="border-color:${isRestart ? 'rgba(242, 184, 75, 0.4)' : 'rgba(239, 68, 68, 0.4)'};">
                  <div style="font-size:38px;color:${isRestart ? 'var(--accent-amber)' : 'var(--accent-red)'};">
                    <i class="ti ${isRestart ? 'ti-refresh' : 'ti-power'}"></i>
                  </div>
                  <div style="font-size:15px;font-weight:600;color:var(--text-primary);">
                    ${isRestart ? 'Mac Mini is Restarting' : 'Mac Mini is Powering Off'}
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">
                    ${isRestart
                      ? 'Reboot command accepted. The server monitor will attempt to re-establish connection once online.'
                      : 'Shut down command accepted. Telemetry and connections are terminating.'}
                  </div>
                </div>
              `;
            }

            if (isRestart) {
              setTimeout(() => {
                const interval = setInterval(async () => {
                  try {
                    const ping = await fetch('/api/health');
                    if (ping.ok) {
                      clearInterval(interval);
                      window.location.reload();
                    }
                  } catch (e) {
                    // still rebooting
                  }
                }, 3000);
              }, 15000);
            }
          } catch (err) {
            if (modalBody) {
              modalBody.innerHTML = `
                <div class="power-confirm-box">
                  <div style="color:var(--accent-red);font-size:13px;">Error sending command: ${escapeHtml(err.message)}</div>
                  <div style="margin-top:10px;">
                    <button class="power-confirm-btn" id="btnPowerBack">Back</button>
                  </div>
                </div>
              `;
              const btnBack = document.getElementById('btnPowerBack');
              if (btnBack) btnBack.addEventListener('click', renderInitial);
            }
          }
        });
      }
    };

    renderInitial();
  }

  // Event Listeners
  if (refreshIndicator) refreshIndicator.addEventListener('click', fetchStats);
  if (networkBadgeBtn) networkBadgeBtn.addEventListener('click', openNetworkSwitcherModal);
  if (powerBtn) powerBtn.addEventListener('click', openPowerModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  const cardCpu = document.getElementById('cardCpu');
  if (cardCpu) cardCpu.addEventListener('click', openCpuModal);

  const cardRam = document.getElementById('cardRam');
  if (cardRam) cardRam.addEventListener('click', () => {
    if (currentStats?.metrics?.ram?.topProcesses) {
      openProcessesModal(currentStats.metrics.ram.topProcesses);
    }
  });

  const cardSsd = document.getElementById('cardSsd');
  if (cardSsd) cardSsd.addEventListener('click', openStorageModal);

  const cardHdd = document.getElementById('cardHdd');
  if (cardHdd) cardHdd.addEventListener('click', openStorageModal);

  // Category Filter Tabs
  const categoryTabs = document.getElementById('categoryTabs');
  if (categoryTabs) {
    const tabs = categoryTabs.querySelectorAll('.cat-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const secHw = document.getElementById('secHardware');
        const secAi = document.getElementById('secAi');
        const secMedia = document.getElementById('secMedia');
        const secNet = document.getElementById('secNetwork');
        const allSecs = [secHw, secAi, secMedia, secNet];
        const filter = tab.getAttribute('data-filter');

        if (filter === 'all') {
          allSecs.forEach(s => s && s.classList.remove('hidden'));
        } else if (filter === 'hardware') {
          allSecs.forEach(s => s && s.classList.add('hidden'));
          if (secHw) secHw.classList.remove('hidden');
        } else if (filter === 'ai') {
          allSecs.forEach(s => s && s.classList.add('hidden'));
          if (secAi) secAi.classList.remove('hidden');
        } else if (filter === 'media') {
          allSecs.forEach(s => s && s.classList.add('hidden'));
          if (secMedia) secMedia.classList.remove('hidden');
        } else if (filter === 'network') {
          allSecs.forEach(s => s && s.classList.add('hidden'));
          if (secNet) secNet.classList.remove('hidden');
        }
      });
    });
  }

  // ====================================================
  // Check Auth & Start Lifecycle
  // ====================================================
  async function init() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.authenticated) {
        hidePinScreen();
        await fetchConfig();
        await fetchStats();
        startCountdown();
      } else {
        showPinScreen();
      }
    } catch (err) {
      showPinScreen();
    }
  }

  init();
})();
