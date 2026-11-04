const { app, BrowserWindow, protocol, net, session, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { DiskLibrary, safeId } = require('./library.cjs');

app.setName('Xbieha');
protocol.registerSchemesAsPrivileged([{ scheme: 'xbieha', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();
let window, library, closing = false, closeRequest, closeTimer;
const trusted = frame => frame && frame === window?.webContents.mainFrame && frame.url.startsWith('xbieha://studio/');
const external = url => { if (/^https:\/\//.test(url)) void shell.openExternal(url); };

function handler(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event.senderFrame)) throw new Error('Only Xbieha can access this library.');
    return fn(...args);
  });
}

async function createWindow() {
  closing = false;
  window = new BrowserWindow({ width: 1380, height: 920, minWidth: 880, minHeight: 650, title: 'Xbieha', backgroundColor: '#f8f4ee', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, partition: 'xbieha-memory', spellcheck: false } });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('xbieha://studio/') && /\/(terms|privacy)\.html$/.test(url)) {
      const notice = new BrowserWindow({ width: 820, height: 760, parent: window, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'xbieha-memory' } });
      notice.webContents.setWindowOpenHandler(({ url: link }) => { external(link); return { action: 'deny' }; });
      notice.webContents.on('will-navigate', (event, link) => { event.preventDefault(); external(link); });
      void notice.loadURL(url);
    } else external(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => { event.preventDefault(); external(url); });
  window.on('close', event => {
    if (closing) return;
    event.preventDefault();
    if (closeRequest) return;
    closeRequest = randomUUID();
    window.webContents.send('studio:prepare-close', closeRequest);
    closeTimer = setTimeout(() => { closeRequest = null; void dialog.showMessageBox(window, { type: 'warning', message: 'Your work is still being saved.', detail: 'Xbieha has stayed open to protect your work. Wait for saving to finish, then close it again.', buttons: ['Keep working'] }); }, 120000);
  });
  window.once('ready-to-show', () => window.show());
  await window.loadURL('xbieha://studio/');
}

app.whenReady().then(async () => {
  app.setAccessibilitySupportEnabled(true);
  library = new DiskLibrary(path.join(app.getPath('appData'), 'Xbieha', 'Library'));
  await library.init();
  const localSession = session.fromPartition('xbieha-memory', { cache: false });
  localSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  localSession.setPermissionCheckHandler(() => false);
  // Bundled assets only. Clicking an official reference can open the system browser.
  localSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
  localSession.protocol.handle('xbieha', async request => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'studio' || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
      const pathname = decodeURIComponent(url.pathname);
      let file;
      if (pathname.startsWith('/__media/')) file = library.mediaPath(safeId(pathname.slice(9)));
      else {
        const root = path.join(__dirname, 'web');
        file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
      }
      const response = await net.fetch(pathToFileURL(file).href, { method: request.method, headers: request.headers });
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src 'none'");
      return new Response(response.body, { status: response.status, headers });
    } catch { return new Response('This local file could not be opened.', { status: 404 }); }
  });
  handler('library:list', () => library.listProjects());
  handler('library:load', id => library.loadProject(id));
  handler('library:save', project => library.saveProject(project));
  handler('library:delete', id => library.deleteProject(id));
  handler('library:show', async () => { const error = await shell.openPath(library.root); if (error) throw new Error(error); });
  handler('video:load', () => library.loadVideo());
  handler('video:save', manifest => library.saveVideo(manifest));
  handler('media:has', (id, size) => library.hasMedia(id, size));
  handler('media:begin', (id, size) => library.beginTransfer(library.mediaPath(id), size));
  handler('transfer:append', (token, bytes) => library.appendTransfer(token, bytes));
  handler('transfer:finish', token => library.finishTransfer(token));
  handler('transfer:abort', token => library.abortTransfer(token));
  handler('export:choose', async (name, size) => {
    if (typeof name !== 'string' || name !== path.basename(name) || name.length > 180) throw new Error('Invalid export name.');
    const result = await dialog.showSaveDialog(window, { title: 'Save your creation', defaultPath: path.join(app.getPath('pictures'), name), buttonLabel: 'Save', properties: ['createDirectory', 'showOverwriteConfirmation'] });
    if (result.canceled || !result.filePath) return null;
    // The renderer receives an opaque token, never authority over arbitrary paths.
    return { token: await library.beginTransfer(result.filePath, size), name: path.basename(result.filePath) };
  });
  ipcMain.on('studio:closed-ready', async (event, request, error) => {
    if (!trusted(event.senderFrame) || request !== closeRequest) return;
    clearTimeout(closeTimer); closeRequest = null;
    if (error) { await dialog.showMessageBox(window, { type: 'error', message: 'Your latest changes could not be saved.', detail: String(error), buttons: ['Keep working'] }); return; }
    await library.pending; closing = true; window.close();
  });
  // DOM download links also get a native destination chooser.
  localSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ title: 'Save your creation', defaultPath: path.join(app.getPath('pictures'), path.basename(item.getFilename())), properties: ['createDirectory', 'showOverwriteConfirmation'] });
    item.once('done', (_event, state) => { if (state === 'interrupted') void dialog.showMessageBox(window, { type: 'error', message: 'The export could not be saved.', detail: 'Check free disk space and try exporting again.' }); });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Xbieha', submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Show project folder', click: () => void shell.openPath(library.root) }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ]));
  app.setAboutPanelOptions({ applicationName: 'Xbieha', applicationVersion: '1.0.0', copyright: 'Your personal creative studio. Saved on your Mac.', iconPath: path.join(__dirname, 'web', 'icon-512.png') });
  await createWindow();
}).catch(error => { dialog.showErrorBox('Xbieha could not open', error.message); app.quit(); });
app.on('second-instance', () => { window?.show(); window?.focus(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow(); else { window?.show(); window?.focus(); } });
app.on('window-all-closed', () => app.quit());
