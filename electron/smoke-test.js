// Headless smoke test for electron/desktop-server.js (no Electron needed).
'use strict';

const http = require('http');
const path = require('path');

const { createLauncher } = require('./desktop-server');

const ROOT = path.resolve(__dirname, '..');

function get(port, pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: pathname }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () =>
          resolve({ status: res.statusCode, contentType: res.headers['content-type'] || '', body })
        );
      })
      .on('error', reject);
  });
}

async function main() {
  const launcher = createLauncher({
    browserDir: path.join(ROOT, 'frontend-app', 'dist', 'frontend-app', 'browser'),
    backendCommand: path.join(ROOT, 'venv', 'Scripts', 'python.exe'),
    backendArgs: ['-m', 'backend.app'],
    rootDir: ROOT,
  });
  launcher.startBackend(
    () => {
      launcher.startAppServer(async () => {
        try {
          const index = await get(launcher.appPort, '/');
          console.log('GET /            ->', index.status, index.contentType);
          const dashboard = await get(launcher.appPort, '/dashboard');
          console.log('GET /dashboard   ->', dashboard.status, dashboard.contentType);
          const api = await get(launcher.appPort, '/api/health');
          console.log('GET /api/health  ->', api.status, api.body);
          const cats = await get(launcher.appPort, '/api/categories');
          console.log('GET /api/cat     ->', cats.status, cats.body.slice(0, 100));
          const assetName = cats.body.length ? 'index.csr.html' : '';
          const csr = await get(launcher.appPort, '/index.csr.html');
          console.log('GET index.csr    ->', csr.status, csr.contentType);
        } catch (err) {
          console.error('SMOKE TEST FAILED:', err);
          process.exitCode = 1;
        } finally {
          launcher.shutdown();
          process.exit();
        }
      });
    },
    (err) => {
      console.error('backend failed to start:', err);
      process.exit(1);
    }
  );
}

main();
