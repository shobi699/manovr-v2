const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const virtualShareDir = path.join(rootDir, 'tests', 'virtual-network-share');
const sourceDb = path.join(rootDir, 'prisma', 'dev.db');
const targetDb = path.join(virtualShareDir, 'network-dev.db');

/**
 * Initializes the virtual simulated network share directory.
 * @param {string} [customName] - Optional unique name to prevent parallel test collision
 */
function setupVirtualNetworkShare(customName) {
  if (!fs.existsSync(virtualShareDir)) {
    fs.mkdirSync(virtualShareDir, { recursive: true });
  }

  const dbFileName = customName ? `${customName}.db` : `network-dev-${process.pid || 'default'}.db`;
  const customTargetDb = path.join(virtualShareDir, dbFileName);

  if (fs.existsSync(sourceDb)) {
    try {
      fs.copyFileSync(sourceDb, customTargetDb);
      // پاکسازی هرگونه ژورنال موقت قبلی
      if (fs.existsSync(`${customTargetDb}-wal`)) fs.unlinkSync(`${customTargetDb}-wal`);
      if (fs.existsSync(`${customTargetDb}-shm`)) fs.unlinkSync(`${customTargetDb}-shm`);
      console.log(`[Virtual Network Share] پایگاه داده در پوشه شبکه مجازی کپی شد: ${customTargetDb}`);
    } catch {}
  }

  return {
    virtualShareDir,
    targetDb: customTargetDb,
  };
}

/**
 * Generates an artificial network latency delay (simulating bad ping/jitter).
 * @param {number} minMs - Minimum delay in ms (default 100)
 * @param {number} maxMs - Maximum delay in ms (default 750)
 */
function sleepWithJitter(minMs = 100, maxMs = 750) {
  const jitter = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, jitter));
}

module.exports = {
  setupVirtualNetworkShare,
  sleepWithJitter,
  virtualShareDir,
  targetDb,
};

if (require.main === module) {
  const info = setupVirtualNetworkShare();
  console.log(`[Simulate Network] بستر شبکه مجازی با موفقیت آماده شد:`, info);
}
