const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const LMS_PATH = path.join(os.homedir(), '.lmstudio', 'bin', 'lms');

function getLmsBinary() {
  if (fs.existsSync(LMS_PATH)) {
    return LMS_PATH;
  }
  return 'lms';
}

function execPromise(cmd, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr?.trim() || err.message));
      }
      resolve(stdout);
    });
  });
}

/**
 * Returns available models on disk and currently loaded models in memory
 */
async function getLmStudioModels() {
  const lms = getLmsBinary();
  let available = [];
  let loaded = [];

  try {
    const lsOut = await execPromise(`"${lms}" ls --json`, 10000);
    available = JSON.parse(lsOut);
  } catch (err) {
    console.error('Error listing LM Studio models:', err.message);
  }

  try {
    const psOut = await execPromise(`"${lms}" ps --json`, 10000);
    loaded = JSON.parse(psOut);
  } catch (err) {
    console.error('Error listing loaded LM Studio models:', err.message);
  }

  return { available, loaded };
}

/**
 * Load a model into LM Studio memory
 */
async function loadLmStudioModel(modelKey) {
  if (!modelKey || typeof modelKey !== 'string') {
    throw new Error('Valid modelKey is required');
  }
  // Sanitize modelKey to prevent command injection
  const safeKey = modelKey.replace(/[^a-zA-Z0-9_\-\.\/@:]/g, '');
  const lms = getLmsBinary();
  const cmd = `"${lms}" load "${safeKey}" -y`;
  
  const stdout = await execPromise(cmd, 90000); // Allow up to 90s for large weights
  return { success: true, message: stdout.trim() || `Model ${safeKey} loaded successfully` };
}

/**
 * Unload all models from memory
 */
async function unloadLmStudioModels() {
  const lms = getLmsBinary();
  const cmd = `"${lms}" unload --all`;
  
  const stdout = await execPromise(cmd, 20000);
  return { success: true, message: stdout.trim() || 'All models unloaded' };
}

module.exports = {
  getLmStudioModels,
  loadLmStudioModel,
  unloadLmStudioModels
};
