# HomeServer Monitor 🖥️

A self-hosted, lightweight, dark-themed server monitoring dashboard designed specifically for a Mac Mini running as an AI & media home server.

Built with **Node.js + Express** (single process), zero build steps required, and a mobile-first responsive frontend that provides full real-time telemetry, service control, and dynamic network routing.

---

## ✨ Features

- **Real-Time System Metrics**:
  - **CPU**: Overall usage % with top active process drilldown modal (process names, CPU %, and memory consumption).
  - **RAM**: Used / Total / Free / Percentage (macOS available-memory aware).
  - **Storage**: Boot SSD and external drives/volumes (e.g., APFS / Volumes).
  - **System Controls**: Safe options to restart or power off the server machine directly from the dashboard.
- **Dynamic Network Routing**:
  - Automatically detects whether the client is accessing via **Home LAN** or **Tailscale** mesh network.
  - Dynamically routes service launch buttons to the appropriate IP/domain without manual link editing.
  - Interactive network modal allows forcing Tailscale or LAN mode anytime.
- **Media & Entertainment**:
  - **Jellyfin**: Live server status, active transcode/playback streams, total movie/show counts, and one-click **Scan All Libraries** action.
  - **Immich**: Photo/video library asset counts, storage breakdown, and quick web portal launch.
  - **Arr Suite** (Sonarr `8989`, Radarr `7878`, Prowlarr `9696`, Bazarr `6767`): Grouped card showing online count with drilldown modal to view individual service latency & status.
- **AI & Automation**:
  - **LM Studio**: Loaded models, quantization, RAM usage, model management, and interactive inference testing modal.
  - **n8n**: Running and failed execution counts, latest workflow status, and error logs drilldown.
  - **ComfyUI**: Queue status, generating vs. idle state, and quick launch.
- **Network & Downloads**:
  - **AdGuard Home**: Real-time DNS blocking telemetry, active filter rules, latency probes, and client setup guidance.
  - **qBittorrent**: Download/upload speeds, active torrents count, free disk space, and pause/resume torrent management.
  - **Docker Engine**: Direct Unix socket connection (`/var/run/docker.sock`) showing container status, CPU/memory, and interactive inspection.
  - **Ngrok Tunnel**: Probes local ngrok inspection API (`localhost:4040`) and displays public address badge.
- **Security & Access Control**:
  - **PIN Code Authentication**: Instant touch-friendly PIN lock screen with secure session cookies.
  - **HTTP Basic Auth**: Native browser login prompt support.
  - **API Token Auth**: Support for `?token=XYZ` query parameter or `Authorization: Bearer XYZ` header.
  - **Rate Limiting**: Built-in rate limiting to protect against abuse on public tunnels.
- **Responsive Dark UI**:
  - Near-black `#0d0f12` background with sleek macOS-inspired card design.
  - Category tabs (All, Media, AI, Network, Storage) optimized for both desktop and mobile viewports.
  - Seamless background auto-refresh every 5 seconds without full page reload.

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/mohd-shariq-osmani/home-server-dashboard.git
cd home-server-dashboard
npm install
```

### 2. Configure Your Server
Copy the example configuration file and customize it for your setup:
```bash
cp config.example.json config.json
nano config.json
```

Update your `pin`, server credentials, drive mount points, and any service ports or API keys.

### 3. Start the Dashboard
```bash
npm start
```
Or for development with automatic reload:
```bash
npm run dev
```

### 4. Open in Browser
Visit `http://localhost:3001` (or your Mac's LAN/Tailscale IP:3001) in your browser. Enter your configured PIN or credentials to access.

---

## ⚙️ Configuration (`config.json`)

The dashboard is configured via `config.json`. Refer to `config.example.json` for all options:

```json
{
  "server": {
    "name": "mini-server",
    "port": 3001,
    "host": "0.0.0.0",
    "refreshIntervalMs": 5000,
    "tailscaleIp": "100.xx.xx.xx",
    "serverLanIp": "192.168.x.xx"
  },
  "auth": {
    "enabled": true,
    "pin": "1234",
    "username": "admin",
    "password": "changeme123",
    "apiToken": "your-secret-api-token"
  },
  "storage": {
    "bootMount": "/",
    "externalDrives": [
      {
        "id": "external-hdd",
        "name": "External HDD",
        "mount": "/Volumes/ExternalDrive"
      }
    ]
  },
  "services": [
    { "id": "lmstudio", "name": "LM Studio", "url": "http://127.0.0.1:1234", "port": 1234 },
    { "id": "n8n", "name": "n8n", "url": "http://127.0.0.1:5678", "port": 5678 },
    { "id": "comfyui", "name": "ComfyUI", "url": "http://127.0.0.1:8188", "port": 8188 }
  ],
  "jellyfin": {
    "enabled": true,
    "url": "http://127.0.0.1:8096",
    "port": 8096,
    "apiKey": ""
  },
  "immich": {
    "enabled": true,
    "url": "http://127.0.0.1:2283",
    "port": 2283,
    "storagePath": "/Volumes/Photos/immich"
  },
  "adguard": {
    "enabled": true,
    "webPort": 81,
    "dnsPort": 53
  },
  "qbittorrent": {
    "enabled": true,
    "url": "http://127.0.0.1:8080",
    "port": 8080,
    "apiKey": ""
  }
}
```

---

## 🔄 Running 24/7 on macOS (launchd Service)

To keep the dashboard running continuously in the background on your Mac (including across reboots):

1. Create a launch agent file at `~/Library/LaunchAgents/com.homeserver.monitor.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.homeserver.monitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/home-server-dashboard/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/home-server-dashboard</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/homeserver-monitor.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/homeserver-monitor.err</string>
</dict>
</plist>
```
*(Verify your node binary location with `which node` and adjust paths accordingly).*

2. Load and start the service:
```bash
launchctl load ~/Library/LaunchAgents/com.homeserver.monitor.plist
```

3. To stop or restart:
```bash
launchctl kickstart -k gui/$(id -u)/com.homeserver.monitor
```

Alternatively, you can manage it with PM2:
```bash
npx pm2 start server.js --name homeserver-monitor
npx pm2 save
npx pm2 startup
```

---

## 🛡️ API Endpoints

All endpoints require authentication (PIN session cookie, HTTP Basic Auth, or `?token=YOUR_TOKEN`):

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/stats` | `GET` | Returns aggregated metrics, CPU processes, storage, services, Docker, Jellyfin, Immich, AdGuard, and qBittorrent data. |
| `/api/config` | `GET` | Returns safe client configuration and dynamic network detection info. |
| `/api/auth/pin` | `POST` | Authenticates via numeric PIN and sets session cookie. |
| `/api/system/reboot` | `POST` | Gracefully reboots the host macOS system. |
| `/api/system/shutdown` | `POST` | Gracefully powers off the host macOS system. |
| `/api/jellyfin/refresh` | `POST` | Triggers a scan on all Jellyfin media libraries. |
| `/api/health` | `GET` | Lightweight health check returning server uptime. |

---

## 📄 License

MIT
