const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const virtualShareDir = path.join(rootDir, 'tests', 'virtual-network-share');
const sourceDb = path.join(rootDir, 'prisma', 'dev.db');
const targetDb = path.join(virtualShareDir, 'network-dev.db');

/**
 * Initializes the virtual simulated network share directory.
 */
function setupVirtualNetworkShare() {
  if (!fs.existsSync(virtualShareDir)) {
    fs.mkdirSync(virtualShareDir, { recursive: true });
  }

  if (fs.existsSync(sourceDb)) {
    fs.copyFileSync(sourceDb, targetDb);
    console.log(`[Virtual Network Share] پایگاه داده در پوشه شبکه مجازی کپی شد: ${targetDb}`);
  }

  return {
    virtualShareDir,
    targetDb,
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
