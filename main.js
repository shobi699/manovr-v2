const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 520,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public', 'logo.png'),
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

// ثبت handler اعلانات نیتیو سیستم‌عامل در الکترون.
// ورودی از سمت رندرر می‌آید و نباید مورد اعتماد فرض شود؛ payload ممکن است
// undefined یا با نوع نادرست باشد، بنابراین destructuring مستقیم انجام نمی‌شود.
ipcMain.handle('show-notification', (event, payload) => {
  // فقط پنجره اصلی برنامه مجاز به فراخوانی این API نیتیو است
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { ok: false, error: 'Unauthorized sender' };
  }

  if (!Notification.isSupported()) {
    return { ok: false, error: 'Notifications not supported' };
  }

  const title = typeof payload?.title === 'string' && payload.title.trim()
    ? payload.title.slice(0, 120)
    : 'سامانه مدیریت مانور';
  const body = typeof payload?.body === 'string' ? payload.body.slice(0, 500) : '';

  const notif = new Notification({ title, body, silent: false });
  notif.show();
  return { ok: true };
});

function ensureWritableDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const testFile = path.join(dirPath, `.test_write_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
}

let appConfig = { mode: 'server', serverUrl: 'http://localhost:3000', sharedDataPath: '' };

function loadAppConfig() {
  const configCandidatePaths = [
    process.env.PORTABLE_EXECUTABLE_DIR ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'manovr-config.json') : null,
    path.join(path.dirname(process.execPath), 'manovr-config.json'),
    process.resourcesPath ? path.join(process.resourcesPath, 'manovr-config.json') : null,
    path.join(__dirname, 'manovr-config.json'),
    path.join(app.getPath('userData'), 'manovr-config.json')
  ].filter(Boolean);

  for (const cfgFile of configCandidatePaths) {
    if (fs.existsSync(cfgFile)) {
      try {
        const raw = fs.readFileSync(cfgFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          appConfig = { ...appConfig, ...parsed, _source: cfgFile };
          return;
        }
      } catch (e) {}
    }
  }
}

loadAppConfig();

// تعیین هوشمند مسیر ذخیره‌سازی داده‌ها (پوشه محلی، تنظیمات یا AppData)
function resolveUserDataPath() {
  // ۱. بررسی فایل تنظیمات manovr-config.json در اولویت اول
  if (appConfig?.sharedDataPath && typeof appConfig.sharedDataPath === 'string') {
    const target = appConfig.sharedDataPath.trim();
    if (target && ensureWritableDir(target)) {
      return { path: target, source: `manovr-config.json (${appConfig._source || 'config'})` };
    }
  }

  // ۲. بررسی مسیر پیش‌فرض DFS سازمانی پایانه فتح‌آباد (\\srvdfs01\Line1\Depo\data)
  const defaultDfsData = '\\\\srvdfs01\\Line1\\Depo\\data';
  const defaultDfsRoot = '\\\\srvdfs01\\Line1\\Depo';
  try {
    if (fs.existsSync(defaultDfsRoot) && ensureWritableDir(defaultDfsData)) {
      return { path: defaultDfsData, source: 'Default Corporate DFS Share (\\\\srvdfs01\\Line1\\Depo\\data)' };
    }
  } catch (e) {}

  // ۳. بررسی حالت پرتابل در مسیر فایل اجرایی
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    const portableDataDir = path.join(portableDir, 'data');
    if (ensureWritableDir(portableDataDir)) {
      return { path: portableDataDir, source: `Portable directory (${portableDataDir})` };
    }
  }

  // ۴. بررسی وجود پوشه data در کنار پروژه/برنامه
  const localDataDir = path.join(__dirname, 'data');
  if (ensureWritableDir(localDataDir)) {
    return { path: localDataDir, source: 'Local application data directory' };
  }

  // ۵. فالبک نهایی به AppData سیستم‌عامل
  return { path: app.getPath('userData'), source: 'OS Local AppData fallback' };
}

const { path: userDataPath, source: userDataSource } = resolveUserDataPath();
const dbFolder = path.join(userDataPath, 'database');
const dbPath = path.join(dbFolder, 'dev.db');

const os = require('os');
const hostname = os.hostname().replace(/[^a-zA-Z0-9_-]/g, '_');

// ایجاد پوشه لاگ و جریان نوشتن لاگ‌ها به تفکیک نام هر سیستم
const logFolder = path.join(userDataPath, 'logs');
if (!fs.existsSync(logFolder)) {
  fs.mkdirSync(logFolder, { recursive: true });
}
const logPath = path.join(logFolder, `server-${hostname}.log`);
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function writeLog(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] [${hostname}] ${message}\n`);
}

function getLanAddresses(port) {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return addresses;
}

writeLog('Starting application...');
writeLog(`Active data directory: ${userDataPath} (Source: ${userDataSource})`);
writeLog(`Database target path: ${dbPath}`);

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

  const templateDbPath = app.isPackaged
    ? path.join(process.resourcesPath, 'dev.db')
    : path.join(__dirname, 'prisma', 'dev.db');

  writeLog(`Looking for template database at: ${templateDbPath}`);

  if (!fs.existsSync(dbPath)) {
    if (fs.existsSync(templateDbPath)) {
      fs.copyFileSync(templateDbPath, dbPath);
      writeLog(`Database initialized successfully at: ${dbPath}`);
    } else {
      writeLog(`ERROR: Template database not found at: ${templateDbPath}`);
    }
  } else {
    // در نسخه پروداکشن/پرتابل هرگز دیتابیس موجود کاربر رونویسی نمی‌شود تا اطلاعات از دست نرود
    if (!app.isPackaged && fs.existsSync(templateDbPath)) {
      try {
        const templateStat = fs.statSync(templateDbPath);
        const currentStat = fs.statSync(dbPath);
        if (templateStat.mtimeMs > currentStat.mtimeMs) {
          fs.copyFileSync(templateDbPath, dbPath);
          writeLog(`[Dev Mode] Database updated from newer template at: ${dbPath}`);
        } else {
          writeLog(`Database already exists at: ${dbPath}`);
        }
      } catch (e) {
        writeLog(`Database status check error: ${e.message}`);
      }
    } else {
      writeLog(`Database already exists at: ${dbPath}`);
    }
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

  function formatDatabaseUrl(rawPath) {
    const normalized = rawPath.replace(/\\/g, '/');
    return `file:${normalized}`;
  }

  // فورک کردن پروسه سرور Next.js با استفاده از انجین Node داخلی الکترون
  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      DATABASE_URL: formatDatabaseUrl(dbPath),
      AUTH_SECRET: authSecret,
      IS_MASTER_SERVER: 'true',
      STORAGE_SOURCE: userDataSource,
      STORAGE_PATH: userDataPath,
      SHARED_DATA_TARGET: appConfig.sharedDataPath || '\\\\srvdfs01\\Line1\\Depo\\data',
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
    const lanAddrs = getLanAddresses(port);
    if (lanAddrs.length > 0) {
      writeLog(`Network access URLs for other PCs: ${lanAddrs.join(' | ')}`);
    }
    callback();
  });
  
  req.on('error', () => {
    setTimeout(() => checkServerReady(port, callback, attempts + 1), 500);
  });
}

function createWindow(portOrUrl, customTitle) {
  const isUrl = typeof portOrUrl === "string" && portOrUrl.startsWith("http");
  const targetUrl = isUrl ? portOrUrl : `http://localhost:${portOrUrl}`;
  
  const windowTitle = customTitle || (
    userDataSource && (userDataSource.includes('DFS') || userDataSource.includes('config'))
      ? 'سامانه مدیریت مانور دپو — پایگاه داده متمرکز شبکه'
      : 'سامانه مدیریت مانور دپو'
  );

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: windowTitle,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public', 'logo.png'),
  });

  mainWindow.loadURL(targetUrl);

  const showMainWindow = () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.maximize();
      mainWindow.focus();
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  };

  mainWindow.once('ready-to-show', showMainWindow);
  mainWindow.webContents.once('did-finish-load', showMainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let selectedPort = 3000;

app.on('ready', () => {
  createSplashWindow();

  if (appConfig?.mode === 'client') {
    const targetUrl = appConfig.serverUrl || 'http://localhost:3000';
    writeLog(`Starting in CLIENT mode. Connecting directly to master server: ${targetUrl}`);
    createWindow(targetUrl, 'سامانه مدیریت مانور دپو (کلاینت متصل به سرور مرکزی)');
    return;
  }

  // حالت سرور محلی / مستر (Master Server)
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
    writeLog('Killing Next.js server process and tree...');
    try {
      if (process.platform === 'win32' && serverProcess.pid) {
        const { execSync } = require('child_process');
        try {
          execSync(`taskkill /pid ${serverProcess.pid} /t /f`, { stdio: 'ignore' });
        } catch (e) {}
      }
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
