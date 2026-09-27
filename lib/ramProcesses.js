const { exec } = require('child_process');
const { formatBytes } = require('./system');

function cleanProcessName(cmd, pid) {
  if (!cmd) return `Process ${pid}`;

  // Known patterns
  if (cmd.includes('llama-server')) return 'llama-server (LM Studio AI)';
  if (cmd.includes('com.apple.Virtualization.VirtualMachine') || cmd.includes('virtualization')) return 'Docker Virtual Machine';
  if (cmd.includes('Antigravity Helper (Renderer)')) return 'Antigravity (Renderer)';
  if (cmd.includes('Antigravity Helper')) return 'Antigravity (Helper)';
  if (cmd.includes('language_server')) return 'Antigravity Language Server';
  if (cmd.includes('Antigravity')) return 'Antigravity';
  if (cmd.includes('LM Studio Helper (Renderer)')) return 'LM Studio (UI Renderer)';
  if (cmd.includes('LM Studio')) return 'LM Studio';
  if (cmd.includes('Google Chrome Helper (Renderer)')) return 'Google Chrome (Tab/Extension)';
  if (cmd.includes('Google Chrome Helper')) return 'Google Chrome (Helper)';
  if (cmd.includes('Google Chrome')) return 'Google Chrome';
  if (cmd.includes('WindowServer')) return 'macOS WindowServer';
  if (cmd.includes('AdGuardHome')) return 'AdGuardHome';
  if (cmd.includes('openclaw')) return 'OpenClaw Gateway';
  if (cmd.includes('ffmpeg')) return 'FFmpeg (Media Transcoder)';
  if (cmd.includes('Jellyfin')) return 'Jellyfin Media Server';
  if (cmd.includes('comfyui') || cmd.includes('main.py')) return 'ComfyUI Server';
  if (cmd.includes('node') && cmd.includes('server.js')) return 'HomeServer Monitor';
  if (cmd.includes('docker') || cmd.includes('com.docker')) return 'Docker Desktop';
  if (cmd.includes('Finder')) return 'macOS Finder';

  // Fallback to binary basename
  const parts = cmd.trim().split(/\s+/);
  const binaryPath = parts[0];
  const baseName = binaryPath.split('/').pop();
  return baseName || `PID ${pid}`;
}

function getTopRamProcesses(limit = 10) {
  return new Promise((resolve) => {
    // ps -eo pid,rss,pmem,command -m sorts by memory on macOS
    exec('ps -eo pid,rss,pmem,command -m', { timeout: 2500, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([]);
      }

      try {
        const lines = stdout.trim().split('\n');
        // First line is header (PID RSS %MEM COMMAND)
        const processRows = lines.slice(1);
        const processes = [];

        for (const line of processRows) {
          const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(.+)$/);
          if (!match) continue;

          const pid = parseInt(match[1], 10);
          const rssKb = parseInt(match[2], 10);
          const pmem = parseFloat(match[3]);
          const rawCommand = match[4];

          if (isNaN(pid) || isNaN(rssKb) || rssKb <= 0) continue;

          const rssBytes = rssKb * 1024;
          const name = cleanProcessName(rawCommand, pid);

          processes.push({
            pid,
            name,
            rawCommand: rawCommand.length > 80 ? rawCommand.slice(0, 77) + '...' : rawCommand,
            rssBytes,
            rssFormatted: formatBytes(rssBytes),
            memPercent: pmem
          });

          if (processes.length >= limit) break;
        }

        resolve(processes);
      } catch (parseErr) {
        console.error('Error parsing ps memory output:', parseErr);
        resolve([]);
      }
    });
  });
}

function getTopCpuProcesses(limit = 10) {
  return new Promise((resolve) => {
    // ps -eo pid,pcpu,pmem,command -r sorts by CPU on macOS
    exec('ps -eo pid,pcpu,pmem,command -r', { timeout: 2500, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([]);
      }

      try {
        const lines = stdout.trim().split('\n');
        const processRows = lines.slice(1);
        const processes = [];

        for (const line of processRows) {
          const match = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+)$/);
          if (!match) continue;

          const pid = parseInt(match[1], 10);
          const pcpu = parseFloat(match[2]);
          const pmem = parseFloat(match[3]);
          const rawCommand = match[4];

          if (isNaN(pid) || isNaN(pcpu)) continue;

          const name = cleanProcessName(rawCommand, pid);

          processes.push({
            pid,
            name,
            rawCommand: rawCommand.length > 80 ? rawCommand.slice(0, 77) + '...' : rawCommand,
            cpuPercent: pcpu,
            memPercent: pmem
          });

          if (processes.length >= limit) break;
        }

        resolve(processes);
      } catch (parseErr) {
        console.error('Error parsing ps CPU output:', parseErr);
        resolve([]);
      }
    });
  });
}

module.exports = {
  getTopRamProcesses,
  getTopCpuProcesses
};
