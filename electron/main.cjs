'use strict';

const { app, BrowserWindow, shell, Menu, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// ── Register custom protocol BEFORE app is ready ─────────────────────────────
// file:// does NOT support fetch(), so sql.js WASM loading fails → white screen.
// app:// protocol with supportFetchAPI fixes this by serving dist/ files via fs.
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
  },
}]);

let mainWindow = null;

// MIME types for serving local files
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

// ── Create the BrowserWindow ──────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 390,
    minHeight: 600,
    titleBarStyle: 'default',
    backgroundColor: '#f4f4f5',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Load via custom app:// protocol so fetch() works for WASM files.
  mainWindow.loadURL('app://host/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Log any page errors to help debug issues
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) console.error('[Renderer]', message);
  });

  // Open all target="_blank" links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ── Right-click context menu (Cut/Copy/Paste/Select All) ──
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { Menu: CtxMenu, MenuItem } = require('electron');
    const menu = new CtxMenu();
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'cut', label: '剪切' }));
      menu.append(new MenuItem({ role: 'copy', label: '复制' }));
      menu.append(new MenuItem({ role: 'paste', label: '粘贴' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'selectAll', label: '全选' }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy', label: '复制' }));
    }
    if (menu.items.length > 0) menu.popup();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── macOS menu ────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Auto updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `新版本 v${info.version} 可用，是否立即下载？`,
      buttons: ['下载更新', '稍后'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已下载',
      message: '新版本已下载完成，重启应用即可完成更新。',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  // Silently check — no error popup if offline
  autoUpdater.on('error', () => {});
  autoUpdater.checkForUpdates().catch(() => {});
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // ── Handle app:// protocol — serve files from dist/ folder ──────────────
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    // Remove leading slash on Windows
    if (process.platform === 'win32' && pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }
    const filePath = path.join(__dirname, '../dist', pathname);
    try {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
      });
    } catch (err) {
      console.error('[Protocol] 404:', filePath, err.message);
      return new Response('Not Found', { status: 404 });
    }
  });

  buildMenu();
  createWindow();
  // Check for updates after a short delay
  setTimeout(setupAutoUpdater, 3000);
});

app.on('window-all-closed', () => {
  // On macOS keep the process alive until Cmd+Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
