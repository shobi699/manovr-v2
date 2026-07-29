const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;

// ثبت handler اعلانات نیتیو سیستم‌عامل در الکترون
ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: title || 'سامانه مدیریت مانور',
      body: body || '',
      silent: false,
    });
    notif.show();
    return { ok: true };
  }
  return { ok: false, error: 'Notifications not supported' };
});

// آدرس لوکال دیتابیس در پوشه AppData کاربر
const userDataPath = app.getPath('userData');
const dbFolder = path.join(userDataPath, 'database');
const dbPath = path.join(dbFolder, 'dev.db');

// ایجاد پوشه لاگ و جریان نوشتن لاگ‌ها
const logFolder = path.join(userDataPath, 'logs');
if (!fs.existsSync(logFolder)) {
  fs.mkdirSync(logFolder, { recursive: true });
}
const logPath = path.join(logFolder, 'server.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function writeLog(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
}

writeLog('Starting application...');

const crypto = require('crypto');

let authSecret = null;

function setupAuthSecret() {
  const configFolder = path.join(userDataPath, 'config');
  if (!fs.existsSync(configFolder)) {
    fs.mkdirSync(configFolder, { recursive: true });
  }
  const keyPath = path.join(configFolder, 'auth.key');
  if (!fs.existsSync(keyPath)) {
    const secret = crypto.randomBytes(48).toString('base64');
    fs.writeFileSync(keyPath, secret, 'utf8');
    writeLog(`Auth secret created successfully at: ${keyPath}`);
  } else {
    writeLog(`Auth secret loaded from: ${keyPath}`);
  }
  return fs.readFileSync(keyPath, 'utf8').trim();
}

function setupDatabase() {
  if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
  }

  // اگر دیتابیس در AppData وجود نداشت، دیتابیس اولیه را از داخل پکیج کپی می‌کنیم
  if (!fs.existsSync(dbPath)) {
    const templateDbPath = app.isPackaged
      ? path.join(process.resourcesPath, 'dev.db')
      : path.join(__dirname, 'prisma', 'dev.db');

    writeLog(`Looking for template database at: ${templateDbPath}`);

    if (fs.existsSync(templateDbPath)) {
      fs.copyFileSync(templateDbPath, dbPath);
      writeLog(`Database initialized successfully at: ${dbPath}`);
    } else {
      writeLog(`ERROR: Template database not found at: ${templateDbPath}`);
    }
  } else {
    writeLog(`Database already exists at: ${dbPath}`);
  }
}

const net = require('net');

function findFreePort(startPort, callback) {
  const server = net.createServer();
  server.listen(startPort, () => {
    server.once('close', () => {
      callback(startPort);
    });
    server.close();
  });
  server.on('error', () => {
    findFreePort(startPort + 1, callback);
  });
}

function startNextServer(port) {
  if (!app.isPackaged) {
    // در محیط توسعه نیازی به اجرای مجدد سرور نیست
    return;
  }

  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js')
    : path.join(__dirname, '.next', 'standalone', 'server.js');
  writeLog(`Looking for standalone server at: ${serverPath}`);
  
  if (!fs.existsSync(serverPath)) {
    writeLog(`ERROR: Next.js standalone server not found at: ${serverPath}`);
    return;
  }

  // فورک کردن پروسه سرور Next.js با استفاده از انجین Node داخلی الکترون
  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: `file:${dbPath}`,
      AUTH_SECRET: authSecret,
      NODE_ENV: 'production'
    },
    cwd: app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone')
      : path.join(__dirname, '.next', 'standalone'),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  serverProcess.stdout.on('data', (data) => {
    writeLog(`[Server Stdout] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    writeLog(`[Server Stderr] ${data.toString().trim()}`);
  });

  serverProcess.on('error', (err) => {
    writeLog(`ERROR: Next.js server error: ${err.message}`);
  });

  serverProcess.on('exit', (code) => {
    writeLog(`Server process exited with code: ${code}`);
  });
}

function checkServerReady(port, callback, attempts = 0) {
  if (attempts > 30) {
    writeLog('WARNING: Server check timed out after 30 attempts, opening window anyway.');
    callback();
    return;
  }
  
  const req = http.get(`http://localhost:${port}`, (res) => {
    writeLog(`Server responded with status: ${res.statusCode}. Server is ready!`);
    callback();
  });
  
  req.on('error', () => {
    setTimeout(() => checkServerReady(port, callback, attempts + 1), 500);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'سامانه مدیریت مانور دپو',
    autoHideMenuBar: true, // پنهان کردن منوهای بالای صفحه
  });

  const url = `http://localhost:${port}`;
  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let selectedPort = 3000;

app.on('ready', () => {
  setupDatabase();
  authSecret = setupAuthSecret();
  
  findFreePort(3000, (port) => {
    selectedPort = port;
    writeLog(`Selected free port: ${selectedPort}`);
    startNextServer(selectedPort);
    
    if (app.isPackaged) {
      writeLog('Waiting for Next.js server to become ready...');
      checkServerReady(selectedPort, () => {
        createWindow(selectedPort);
      });
    } else {
      createWindow(selectedPort);
    }
  });
});

function killServer() {
  if (serverProcess) {
    writeLog('Killing Next.js server process...');
    try {
      serverProcess.kill();
    } catch (e) {
      writeLog(`Error killing server process: ${e.message}`);
    }
    serverProcess = null;
  }
}

app.on('window-all-closed', () => {
  writeLog('All windows closed, quitting application...');
  killServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  writeLog('Application will quit, killing server process...');
  killServer();
});
