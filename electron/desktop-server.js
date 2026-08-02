// Pure Node launcher logic (no Electron imports) so it can be smoke-tested
// headlessly. Starts the Flask backend (either as a Python module in dev or a
// bundled executable when packaged) and serves the built Angular SPA, proxying
// /api/* to the backend.
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function log(prefix, message) {
  console.log(`[${prefix}] ${message}`);
}

function createLauncher(options) {
  const {
    browserDir,
    backendCommand,
    backendArgs = [],
    backendPort = Number(process.env.BACKEND_PORT || 5001),
    appPort = Number(process.env.APP_PORT || 4201),
    backendEnv = {},
    rootDir = process.cwd(),
  } = options;

  let backendProcess = null;

  function startBackend(onReady, onError) {
    let ready = false;
    log('launcher', `starting backend "${backendCommand}" on port ${backendPort}`);
    backendProcess = spawn(backendCommand, backendArgs, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...backendEnv,
        PORT: String(backendPort),
        FINAPP_DEBUG: '0',
      },
      stdio: 'pipe',
      windowsHide: true,
    });
    backendProcess.stdout.on('data', (data) => log('backend', String(data).trim()));
    backendProcess.stderr.on('data', (data) => log('backend', String(data).trim()));
    backendProcess.stdout.on('error', (err) => log('backend', `stdout error: ${err.message}`));
    backendProcess.stderr.on('error', (err) => log('backend', `stderr error: ${err.message}`));
    backendProcess.on('error', onError);
    backendProcess.on('exit', (code) => {
      log('backend', `process exited with code ${code}`);
      if (!ready) {
        onError(new Error(`the backend stopped before becoming ready (exit code ${code}).`));
      }
    });
    waitForHealth(
      `http://127.0.0.1:${backendPort}/api/health`,
      () => {
        ready = true;
        onReady();
      },
      () => onError(new Error('the backend did not become ready in time.'))
    );
  }

  function waitForHealth(url, onReady, onFailed) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      http
        .get(url, (res) => {
          if (res.statusCode === 200) {
            clearInterval(timer);
            onReady();
          } else {
            res.resume();
          }
        })
        .on('error', () => {
          if (attempts >= 100) {
            clearInterval(timer);
            log('launcher', `backend did not become ready (${url})`);
            if (onFailed) {
              onFailed();
            }
          }
        });
    }, 300);
  }

  function serveStatic(req, res) {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = path.normalize(path.join(browserDir, urlPath));
    if (filePath === browserDir) {
      filePath = path.join(browserDir, 'index.csr.html');
    }
    if (!filePath.startsWith(browserDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        const fallback = path.join(browserDir, 'index.csr.html');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(fallback).pipe(res);
      }
    });
  }

  function proxyToBackend(req, res) {
    const proxyRequest = http.request(
      {
        host: '127.0.0.1',
        port: backendPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyResponse) => {
        res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
        proxyResponse.pipe(res);
      }
    );
    proxyRequest.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end('{"error":"backend unavailable"}');
    });
    req.pipe(proxyRequest);
  }

  function startAppServer(onReady) {
    const appServer = http.createServer((req, res) => {
      if (req.url.startsWith('/api/')) {
        proxyToBackend(req, res);
      } else {
        serveStatic(req, res);
      }
    });
    appServer.listen(appPort, '127.0.0.1', () => {
      log('launcher', `app available at http://127.0.0.1:${appPort}`);
      onReady();
    });
    return appServer;
  }

  function shutdown() {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill();
    }
  }

  return {
    backendPort,
    appPort,
    startBackend,
    startAppServer,
    waitForHealth,
    shutdown,
  };
}

module.exports = { createLauncher };
