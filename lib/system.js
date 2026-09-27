const si = require('systeminformation');

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) {
    return `${d}d ${h}h`;
  }
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

async function getSystemStats(config) {
  const [load, mem, fsSizes, timeData] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.time()
  ]);

  // CPU
  const cpuPercent = Math.round(load.currentLoad || 0);
  const perCore = (load.cpus || []).map((core, i) => ({
    core: i,
    load: Math.round(core.load || 0)
  }));

  // RAM
  // On macOS/Unix, mem.available gives actual available memory including reclaimable cache
  const totalMem = mem.total || 1;
  const availableMem = mem.available != null ? mem.available : mem.free;
  const usedMem = Math.max(0, totalMem - availableMem);
  const ramPercent = Math.min(100, Math.round((usedMem / totalMem) * 100));

  // Boot SSD
  // On macOS APFS, check for /System/Volumes/Data first (where user data & apps reside), fallback to /
  let bootFs = fsSizes.find(f => f.mount === '/System/Volumes/Data') ||
               fsSizes.find(f => f.mount === (config.storage?.bootMount || '/')) ||
               fsSizes[0];

  const bootSsd = bootFs ? {
    mount: bootFs.mount,
    name: 'internal ssd',
    totalBytes: bootFs.size,
    usedBytes: bootFs.used,
    freeBytes: bootFs.available,
    totalFormatted: formatBytes(bootFs.size),
    usedFormatted: formatBytes(bootFs.used),
    freeFormatted: formatBytes(bootFs.available),
    percent: Math.round(bootFs.use || 0)
  } : {
    mount: '/',
    name: 'internal ssd',
    totalBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
    totalFormatted: '0 GB',
    usedFormatted: '0 GB',
    freeFormatted: '0 GB',
    percent: 0
  };

  // External Drives
  const configuredExternal = config.storage?.externalDrives || [];
  const externalDrives = configuredExternal.map(ext => {
    const disk = fsSizes.find(f => f.mount === ext.mount || f.mount.toLowerCase() === ext.mount.toLowerCase());
    if (disk) {
      return {
        id: ext.id || ext.name,
        name: ext.name || 'external hdd',
        mount: ext.mount,
        mounted: true,
        totalBytes: disk.size,
        usedBytes: disk.used,
        freeBytes: disk.available,
        totalFormatted: formatBytes(disk.size),
        usedFormatted: formatBytes(disk.used),
        freeFormatted: formatBytes(disk.available),
        percent: Math.round(disk.use || 0)
      };
    }
    return {
      id: ext.id || ext.name,
      name: ext.name || 'external hdd',
      mount: ext.mount,
      mounted: false,
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      totalFormatted: '0 GB',
      usedFormatted: '0 GB',
      freeFormatted: '0 GB',
      percent: 0
    };
  });

  // Uptime
  const uptimeSeconds = timeData.uptime || 0;
  const uptimeFormatted = formatUptime(uptimeSeconds);

  return {
    cpu: {
      percent: cpuPercent,
      cores: perCore,
      coreCount: perCore.length
    },
    ram: {
      percent: ramPercent,
      usedBytes: usedMem,
      totalBytes: totalMem,
      freeBytes: availableMem,
      usedFormatted: formatBytes(usedMem),
      totalFormatted: formatBytes(totalMem),
      freeFormatted: formatBytes(availableMem)
    },
    internalSsd: bootSsd,
    externalDrives,
    uptime: {
      seconds: uptimeSeconds,
      formatted: uptimeFormatted
    }
  };
}

module.exports = {
  getSystemStats,
  formatBytes,
  formatUptime
};
