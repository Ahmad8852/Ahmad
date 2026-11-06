'use strict';
// plainsearch as a desktop app: runs the server inside the app and shows the tabbed browser in its own window.
const { app, BrowserWindow, Menu, shell, nativeImage } = require('electron');
const path = require('node:path');

const FIXED_PORT = parseInt(process.env.PLAINSEARCH_PORT, 10) || 38247; // fixed so bookmarks/tabs (localStorage) survive restarts
let win = null, origin = '';

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(server.address().port); });
  });
}

async function startServer() {
  const { server } = require('../server');
  let port;
  try { port = await listen(server, FIXED_PORT); } catch (e) { port = await listen(server, 0); } // port taken → any free port
  origin = `http://127.0.0.1:${port}`;
}

const go = (p) => win && win.loadURL(origin + p);
const click = (id) => win && win.webContents.executeJavaScript(`(function(){var e=document.getElementById(${JSON.stringify(id)});if(e)e.click();})()`).catch(() => {});

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [
      { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => click('newtab') },
      { label: 'Open Address Bar', accelerator: 'CmdOrCtrl+L', click: () => win && win.webContents.executeJavaScript("(function(){var a=document.getElementById('addr');if(a){a.focus();a.select();}})()").catch(() => {}) },
      { type: 'separator' }, mac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Go', submenu: [
      { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => click('back') },
      { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => click('fwd') },
      { label: 'Reload Page', accelerator: 'CmdOrCtrl+R', click: () => click('reload') },
      { type: 'separator' },
      { label: 'Browser', accelerator: 'CmdOrCtrl+1', click: () => go('/browser') },
      { label: 'Search Home (full page)', accelerator: 'CmdOrCtrl+2', click: () => go('/') },
      { label: 'API Docs', click: () => go('/api') }, { label: 'Sources', click: () => go('/sources') }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 700, minHeight: 480, title: 'plainsearch', backgroundColor: '#dfe6ef',
    icon: nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png')),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.loadURL(origin + '/browser');
  // Anything that is not our own local pages opens in your normal browser, never inside the app.
  const external = (u) => { if (/^https?:/i.test(u) && !u.startsWith(origin)) { shell.openExternal(u); return true; } return false; };
  win.webContents.setWindowOpenHandler(({ url }) => { if (!external(url) && url.startsWith(origin)) go(url.slice(origin.length)); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin)) { e.preventDefault(); external(url); } });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  await startServer();
  buildMenu();
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });
