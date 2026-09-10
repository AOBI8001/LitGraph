import { app, BrowserWindow, ipcMain, shell, safeStorage, clipboard, dialog, session } from 'electron';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { localService } from '../scripts/local-service.js';
import { createMetrics } from './metrics.mjs';
import { execFile } from 'node:child_process';
import { institutionBrowser } from './institution.mjs';
import { scansciService } from '../scripts/scansci-service.js';
import { withoutPreferences } from '../src/settings-reset.js';
import { createAgentRuntime } from './agent-runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
// Isolate the single-instance lock as well as storage for verification runs.
if (process.env.LITGRAPH_TEST_MODE === '1' && process.env.LITGRAPH_TEST_DATA) app.setPath('userData', path.resolve(process.env.LITGRAPH_TEST_DATA));
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void startDesktop().catch(error => { console.error('LitGraph startup failed:', error.message); app.exit(1); });
}

async function startDesktop() {
  // Test runs use an isolated profile and never send production statistics.
  const testing = process.env.LITGRAPH_TEST_MODE === '1';
  if (testing && process.env.LITGRAPH_TEST_DATA) app.setPath('userData', path.resolve(process.env.LITGRAPH_TEST_DATA));
  await app.whenReady();
  const dataRoot = app.getPath('userData');
  mkdirSync(dataRoot, { recursive: true });
  const statePath = path.join(dataRoot, 'workspace-state.json');
  const keyPath = path.join(dataRoot, 'model-config.encrypted');
  const agentDocs = path.join(dataRoot, 'agent-guide');
  mkdirSync(agentDocs, { recursive: true });
  for (const file of readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md'))) copyFileSync(path.join(root, 'docs', file), path.join(agentDocs, file));
  const adapter = path.join(agentDocs, 'litgraph-mcp.mjs');
  copyFileSync(path.join(root, 'scripts/litgraph-mcp.mjs'), adapter);
  const atomicWrite = (file, data) => { writeFileSync(file + '.tmp', data, { mode: 0o600 }); renameSync(file + '.tmp', file); };
  let window, origin = '', savedState = {}, pending = new Map();
  const connectionFile=path.join(agentDocs,'connection.json');
  const pairingFile=path.join(agentDocs,'pairing.json');
  let pairingEnabled=false;
  try{pairingEnabled=JSON.parse(readFileSync(pairingFile,'utf8')).enabled===true;}catch{}
  const publishConnection=token=>atomicWrite(connectionFile,JSON.stringify({enabled:pairingEnabled,running:Boolean(origin&&token),...(pairingEnabled&&token?{url:origin,token}:{})}));
  publishConnection();
  const engine=scansciService(root,{dataRoot});
  const institutions=institutionBrowser({dataRoot,testing,engine,onDownload:()=>{
    if(window&&!window.isDestroyed())window.webContents.send('desktop:institution-download');
  }});
  const agentRunner = await createAgentRuntime(dataRoot, { getProxyEnv: async provider => {
    // Native CLIs may not read Windows/PAC settings. Reuse the OS-selected proxy
    // for this provider only; never borrow institution cookies or credentials.
    if (process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy) return {};
    const routes = await session.defaultSession.resolveProxy(provider === 'codex' ? 'https://chatgpt.com' : 'https://api.anthropic.com');
    const first = routes.split(';')[0].trim(), match = /^(PROXY|HTTPS|SOCKS5) ([\w.\-\[\]:]+)$/.exec(first);
    if (!match) return {};
    const proxy = `${match[1] === 'SOCKS5' ? 'socks5h' : match[1] === 'HTTPS' ? 'https' : 'http'}://${match[2]}`;
    return { HTTPS_PROXY: proxy, HTTP_PROXY: proxy };
  } });
  const metrics = await createMetrics(dataRoot, { disabled: testing || !app.isPackaged });
  try { savedState = JSON.parse(readFileSync(statePath, 'utf8')); } catch {}
  const trusted = event => Boolean(window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url.startsWith(origin + '/'));
  const guard = event => { if (!trusted(event)) throw Error('Untrusted window'); };
  const persistState = state => {
    if (!state || Array.isArray(state) || typeof state !== 'object') throw Error('Invalid state');
    const filtered = Object.fromEntries(Object.entries(state).filter(([key, value]) => key.startsWith('litgraph.') && key !== 'litgraph.aiConfig' && typeof value === 'string'));
    const json = JSON.stringify(filtered); if (json.length > 64 * 1024 * 1024) throw Error('Workspace backup exceeds 64 MB');
    atomicWrite(statePath, json); savedState = filtered;
  };
  ipcMain.on('desktop:bootstrap', event => {
    if (!trusted(event)) { event.returnValue = null; return; }
    let config = null;
    try { if (existsSync(keyPath) && safeStorage.isEncryptionAvailable()) config = JSON.parse(safeStorage.decryptString(readFileSync(keyPath))); } catch {}
    event.returnValue = { state: savedState, config, metricsEnabled: metrics.enabled(), version: app.getVersion() };
  });
  ipcMain.on('desktop:save-state', (event, state) => {
    try { guard(event); persistState(state); event.returnValue = true; } catch { event.returnValue = false; }
  });
  ipcMain.handle('desktop:save-config', (event, config) => {
    guard(event);
    if (!safeStorage.isEncryptionAvailable()) throw Error('Windows credential encryption is unavailable. Configuration was not saved.');
    atomicWrite(keyPath, safeStorage.encryptString(JSON.stringify(config)));
    return true;
  });
  const deleteConfig = () => {
    for(const controller of pending.values())controller.abort();
    for(const file of [keyPath,keyPath+'.tmp'])try{unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}
  };
  ipcMain.handle('desktop:delete-config', event => {guard(event);deleteConfig();return true;});
  ipcMain.handle('desktop:reset-settings', async (event,state) => {
    guard(event);
    await agentRunner.disconnect();
    await institutions.clearSession();

    deleteConfig();
    persistState(withoutPreferences(state));
    return true;
  });
  ipcMain.handle('desktop:copy-text', async (event, value) => {
    guard(event);
    if (typeof value !== 'string' || value.length > 4 * 1024 * 1024) throw Error('Invalid clipboard text');
    // Native clipboard writes remain valid after preparing the Agent instructions
    // asynchronously, even if Windows has moved focus away from this renderer.
    await clipboard.writeText(value);
    return true;
  });
  ipcMain.handle('desktop:institution',async(event,action,data={})=>{
    guard(event);
    if(action==='search')return institutions.search(data);
    if(action==='saved')return institutions.saved();
    if(action==='open')return institutions.open(data);
    if(action==='acquire')return institutions.acquire(data);
    if(action==='cancel')return institutions.cancel(data.id);
    if(action==='list')return institutions.list();
    if(action==='read')return institutions.read(data.id);
    if(action==='acknowledge')return institutions.acknowledge(data.id);
    throw Error('Unknown institution action');
  });
  ipcMain.handle('desktop:agent-runtime', async (event, action, data = {}) => {
    guard(event);
    if (action === 'status') return agentRunner.status();
    if (action === 'connect') return agentRunner.connect(data.provider);
    if (action === 'choose') {
      if (!['codex', 'claude'].includes(data.provider)) throw Error('Unsupported agent.');
      const selected = await dialog.showOpenDialog(window, { title: 'Choose official agent executable', properties: ['openFile'], filters: [{ name: 'Executable', extensions: ['exe'] }] });
      if (selected.canceled) return null;
      return agentRunner.connect(data.provider, selected.filePaths[0]);
    }
    throw Error('Unknown agent action');
  });
  ipcMain.handle('desktop:control', (event, action) => {
    guard(event);
    if (action === 'minimize') window.minimize();
    else if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (action === 'close') window.close();
  });
  ipcMain.handle('desktop:use', (event, action) => { guard(event); return metrics.use(action); });
  ipcMain.handle('desktop:metrics', (event, enabled) => { guard(event); return metrics.setEnabled(enabled); });
  ipcMain.handle('desktop:model-cancel', (event, id) => { guard(event); pending.get(id)?.abort(); });
  ipcMain.handle('desktop:model-request', async (event, request) => {
    guard(event);
    const url = new URL(request.url);
    if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw Error('Use HTTPS or a local model endpoint.');
    if (typeof request.id !== 'string' || pending.has(request.id) || pending.size >= 8 || typeof request.body !== 'string' || request.body.length > 25 * 1024 * 1024) throw Error('Invalid or excessive model request');
    const headers = Object.fromEntries(Object.entries(request.headers || {}).filter(([key, value]) => ['content-type', 'authorization', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access'].includes(key.toLowerCase()) && typeof value === 'string'));
    const controller = new AbortController(); pending.set(request.id, controller);
    try {
      const result = await fetch(url, { method: 'POST', headers, body: request.body, redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]) });
      let length = 0, chunks = [];
      for await (const chunk of result.body || []) { length += chunk.length; if (length > 10 * 1024 * 1024) throw Error('Model response exceeds 10 MB'); chunks.push(chunk); }
      return { status: result.status, body: Buffer.concat(chunks).toString('utf8'), contentType: result.headers.get('content-type') || 'application/json' };
    } finally { pending.delete(request.id); }
  });
  const openOriginal = async file => {
    const error = await shell.openPath(file);
    if (error) await new Promise((resolve, reject) => execFile('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', file], { windowsHide: true }, err => err ? reject(err) : resolve()));
  };
  const openDataFolder = async folder => {
    const expected = path.resolve(dataRoot, 'data');
    if (path.resolve(folder) !== expected) throw Error('Invalid data folder');
    const error = await shell.openPath(expected);
    if (error) throw Error(error);
  };
  const service = localService(root, { dataRoot, installRoot: path.dirname(process.execPath), openOriginal, openDataFolder, nodeCommand: process.execPath, argsPrefix: [adapter], nodeEnv: { ELECTRON_RUN_AS_NODE: '1' }, guide: path.join(agentDocs, 'LITGRAPH_AGENT_GUIDE.md'),connectionFile,
    engine,agentRunner,searchInstitution:(input,signal)=>institutions.search(input,signal),acquireInstitution:(input,signal)=>institutions.acquire(input,signal),
    onAgentSession:token=>publishConnection(token),
    onAgentAuthorize:token=>{pairingEnabled=true;atomicWrite(pairingFile,JSON.stringify({enabled:true}));publishConnection(token);},
    onAgentRevoke:()=>{pairingEnabled=false;atomicWrite(pairingFile,JSON.stringify({enabled:false}));publishConnection();}
  });
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const next = async () => {
      try {
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
        const route = decodeURIComponent(new URL(req.url, origin).pathname);
        const dist = path.join(root, 'dist');
        const file = path.resolve(dist, '.' + (route === '/' ? '/index.html' : route));
        if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
        const bytes = await readFile(file);
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch { res.writeHead(404); res.end('Not found'); }
    };
    Promise.resolve(service(req, res, next)).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;

  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#ffffff', title: 'LitGraph', webPreferences: { partition: 'litgraph', preload: path.join(root, 'desktop/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, devTools: !app.isPackaged || testing } });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin + '/')) { event.preventDefault(); if (/^https?:\/\//i.test(url)) void shell.openExternal(url); } });
  const allowPermission = (contents, permission) => contents === window.webContents && contents.getURL().startsWith(origin + '/') && ['fullscreen', 'clipboard-sanitized-write'].includes(permission);
  window.webContents.session.setPermissionCheckHandler((contents, permission) => allowPermission(contents, permission));
  window.webContents.session.setPermissionRequestHandler((contents, permission, callback) => callback(allowPermission(contents, permission)));
  window.once('ready-to-show', () => { window.maximize(); window.show(); void metrics.launch(); });
  window.on('closed',()=>app.quit());
  app.on('second-instance', () => { if (window.isMinimized()) window.restore(); window.focus(); });
  app.on('window-all-closed', () => app.quit());
  let quitting=false,shutdownDone=false;
  app.on('before-quit', event => {
    if(shutdownDone)return;
    event.preventDefault();if(quitting)return;quitting=true;
    for(const controller of pending.values())controller.abort();
    void Promise.all([agentRunner.close(),institutions.close()]).catch(()=>console.warn('Desktop services could not complete shutdown.')).finally(()=>{publishConnection();void metrics.close();server.close();shutdownDone=true;app.quit();});
  });
  await window.loadURL(origin);
}
