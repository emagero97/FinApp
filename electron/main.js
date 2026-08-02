// FinApp desktop entry point. Boots the launcher (backend + static server) and
// opens the window. All networking logic lives in desktop-server.js.
'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createLauncher } = require('./desktop-server');

const CRASH_LOG = path.join(os.tmpdir(), 'finapp-main.log');

function writeCrashLog(message) {
  try {
    fs.writeFileSync(CRASH_LOG, `[${new Date().toISOString()}] ${message}\n`, { flag: 'a' });
  } catch {
    // ignore
  }
  try {
    console.log(`[main] ${message}`);
  } catch {
    // ignore
  }
}

process.on('uncaughtException', (err) => {
  writeCrashLog(`uncaughtException: ${(err && err.stack) || err}`);
});
process.on('unhandledRejection', (reason) => {
  writeCrashLog(`unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});

const isPackaged = app.isPackaged;
const ROOT_DIR = path.resolve(__dirname, '..');

let mainWindow = null;
let appServer = null;
let launcher = null;

function log(message) {
  console.log(`[electron] ${message}`);
}

function resolveOptions() {
  if (isPackaged) {
    const resources = process.resourcesPath;
    return {
      browserDir: path.join(resources, 'browser'),
      backendCommand: path.join(resources, 'backend', 'finapp-backend.exe'),
      backendArgs: [],
      rootDir: path.join(app.getPath('userData')),
      backendEnv: {
        FINAPP_DB_PATH: path.join(app.getPath('userData'), 'finapp.db'),
      },
    };
  }
  const venvPython = path.join(ROOT_DIR, 'venv', 'Scripts', 'python.exe');
  return {
    browserDir: path.join(ROOT_DIR, 'frontend-app', 'dist', 'frontend-app', 'browser'),
    backendCommand: process.env.FINAPP_PYTHON || (fs.existsSync(venvPython) ? venvPython : 'python'),
    backendArgs: ['-m', 'backend.app'],
    rootDir: ROOT_DIR,
    backendEnv: {},
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'FinApp',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${launcher.appPort}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function fatal(message) {
  log(`FATAL: ${message}`);
  dialog.showErrorBox('FinApp could not start', message);
  launcher?.shutdown();
  app.quit();
}

app.whenReady().then(() => {
  const options = resolveOptions();
  writeCrashLog(`startup: browserDir=${options.browserDir}`);
  writeCrashLog(`startup: backendCommand=${options.backendCommand}`);
  if (!fs.existsSync(path.join(options.browserDir, 'index.csr.html'))) {
    fatal(
      isPackaged
        ? 'The frontend files are missing from the package.'
        : 'The frontend has not been built. Run "npm run build" in the frontend-app folder, then try again.'
    );
    return;
  }

  launcher = createLauncher(options);
  writeCrashLog('startup: created launcher');
  launcher.startBackend(
    () => {
      writeCrashLog('startup: backend ready');
      appServer = launcher.startAppServer(() => {
        writeCrashLog('startup: app server up');
        createWindow();
      });
    },
    (err) => {
      writeCrashLog(`startup: backend failed: ${err.message}`);
      fatal(`Could not start the backend: ${err.message}`);
    }
  );
});

app.on('window-all-closed', () => {
  launcher?.shutdown();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

process.on('exit', () => {
  launcher?.shutdown();
});
