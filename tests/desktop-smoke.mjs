import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
const root = process.cwd();
await mkdir('output/desktop', { recursive: true });
const dataDir = await mkdtemp(path.join(root, 'output/desktop/profile-'));
const executablePath = process.env.LITGRAPH_TEST_EXECUTABLE || path.join(root, 'node_modules/electron/dist/electron.exe');
const packaged = Boolean(process.env.LITGRAPH_TEST_EXECUTABLE);
const environment = { ...process.env, LITGRAPH_TEST_MODE: '1', LITGRAPH_TEST_DATA: dataDir };
delete environment.ELECTRON_RUN_AS_NODE;
const options = { executablePath, args: packaged ? [] : [root], env: environment, timeout: 45000 };
let application;
const mock = http.createServer(async (req, res) => {
 if (req.url === '/slow') return;
 let body = ''; for await (const part of req) body += part;
 res.writeHead(req.url === '/error' ? 429 : 200, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ path: req.url, body: JSON.parse(body), authorization: req.headers.authorization, custom: req.headers['x-not-allowed'] || null }));
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const mockURL = `http://127.0.0.1:${mock.address().port}`;
// A valid, original one-page PDF fixture; no third-party paper is embedded.
const textStream = 'BT /F1 16 Tf 50 720 Td (LitGraph original document test - evidence is stored locally.) Tj ET';
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream`];
let pdfText = '%PDF-1.4\n', offsets = [0];
objects.forEach((body, index) => { offsets.push(Buffer.byteLength(pdfText)); pdfText += `${index + 1} 0 obj\n${body}\nendobj\n`; });
const xref = Buffer.byteLength(pdfText);
pdfText += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const originalData = Buffer.from(pdfText).toString('base64');
const errors = [];
try {
 application = await electron.launch(options);
 let page = await application.firstWindow();
 page.on('pageerror', error => errors.push(error.message));
 await page.locator('#empty-sample-project').waitFor();
 assert.equal(await page.evaluate(() => typeof window.litgraphDesktop?.recordUse), 'function');
 assert.equal(await page.evaluate(() => typeof window.litgraphDesktop?.copyText), 'function');
 assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
 assert.equal(await page.evaluate(() => window.litgraphDesktop.bootstrap().metricsEnabled), false);
 assert.equal(await page.evaluate(() => window.litgraphDesktop.bootstrap().version), JSON.parse(await readFile('package.json', 'utf8')).version);
 await application.evaluate(async ({ clipboard, ClipboardItem }) => { globalThis.litgraphTestClipboard = await Promise.all((await clipboard.read()).filter(item => item.types.length).map(async item => new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type => [type, await item.getType(type)])))))); });
 try {
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].blur());
  assert.equal(await page.evaluate(() => window.litgraphDesktop.copyText('LitGraph unfocused clipboard fixture')), true);
  assert.equal(await application.evaluate(async ({ clipboard }) => await clipboard.readText()), 'LitGraph unfocused clipboard fixture');
  assert.equal(await page.evaluate(() => window.litgraphDesktop.copyText({ unexpected: true }).then(() => false, () => true)), true);
  assert.equal(await page.evaluate(() => window.litgraphDesktop.copyText('x'.repeat(4 * 1024 * 1024 + 1)).then(() => false, () => true)), true);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
  // Reproduce the reported browser API failure. The desktop button must not
  // depend on navigator.clipboard after its asynchronous instruction request.
  await page.evaluate(() => { window.originalClipboardWriter = navigator.clipboard.writeText; navigator.clipboard.writeText = async () => { throw new DOMException('Document is not focused.', 'NotAllowedError'); }; });
  await page.locator('#empty-model-access').click();
  await page.locator('.manual-agent-access summary').click();
  await page.locator('#copy-agent-instructions').click();
  await page.waitForTimeout(500);
  assert.equal(await application.evaluate(async ({ clipboard }) => (await clipboard.readText()).includes('ELECTRON_RUN_AS_NODE')), true, 'Desktop Agent instructions could not be copied');
  await page.locator('[data-close-modal="api"]').first().click();
 } finally {
  await page.evaluate(() => { if (window.originalClipboardWriter) navigator.clipboard.writeText = window.originalClipboardWriter; delete window.originalClipboardWriter; });
  await application.evaluate(async ({ clipboard }) => { if (globalThis.litgraphTestClipboard?.length) await clipboard.write(globalThis.litgraphTestClipboard); else clipboard.clear(); delete globalThis.litgraphTestClipboard; });
 }
 await page.locator('#empty-sample-project').click();
 await page.waitForFunction(() => document.querySelector('#project-selector-label')?.textContent.includes('样例'));
 await page.evaluate(() => localStorage.setItem('litgraph.desktop-test', 'persistent'));
 const config = { endpoint: 'http://127.0.0.1:9999', model: 'test-model', apiKey: 'TEST-ONLY-NOT-A-REAL-KEY' };
 await page.evaluate(config => window.litgraphDesktop.saveConfig(config), config);
 const keyBytes = await readFile(path.join(dataDir, 'model-config.encrypted'));
 assert.ok(!keyBytes.includes(Buffer.from(config.apiKey)));
 // Exercise the native transport independently of browser CORS and real accounts.
 for (const endpoint of ['/v1/chat/completions', '/v1/responses', '/v1/messages', '/error']) {
  const response = await page.evaluate(async ({ url, endpoint }) => window.litgraphDesktop.modelRequest({ id: crypto.randomUUID(), url: url + endpoint, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer TEST-ONLY', 'X-Not-Allowed': 'blocked' }, body: JSON.stringify({ model: 'fixture', input: 'synthetic question' }) }), { url: mockURL, endpoint });
  assert.equal(response.status, endpoint === '/error' ? 429 : 200);
  const decoded = JSON.parse(response.body); assert.equal(decoded.path, endpoint); assert.equal(decoded.authorization, 'Bearer TEST-ONLY'); assert.equal(decoded.custom, null);
 }
 const cancelled = await page.evaluate(async url => {
  const id = crypto.randomUUID(); const pending = window.litgraphDesktop.modelRequest({ id, url: url + '/slow', body: '{}' }).then(() => false, () => true);
  await new Promise(resolve => setTimeout(resolve, 100)); await window.litgraphDesktop.cancelModel(id); return pending;
 }, mockURL);
 assert.equal(cancelled, true);
 const blocked = await page.evaluate(() => window.litgraphDesktop.modelRequest({ id: crypto.randomUUID(), url: 'http://example.com/model', body: '{}' }).then(() => false, () => true));
 assert.equal(blocked, true);
 // Main-process HTTP and app MCP adapter work without a user's Node installation.
 const instructions = await page.evaluate(async () => {
  const boot = await (await fetch('/__litgraph/bootstrap', { method: 'POST' })).json();
  return (await fetch('/__litgraph/instructions', { method: 'POST', headers: { Authorization: 'Bearer ' + boot.browserToken, 'Content-Type': 'application/json' }, body: '{}' })).json();
 });
 assert.equal(instructions.root, dataDir);
 assert.ok(instructions.guide.startsWith(dataDir));
 // Exercise the actual shipped PDF worker through file import, not preconverted Markdown.
 await page.route('**/__litgraph/metadata',route=>route.fulfill({json:{metadata:null}}));
 await page.locator('#add-papers-button').click();
 await page.locator('#document-input').setInputFiles({name:'desktop-conversion-fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from(originalData,'base64')});
 await page.locator('#start-paper-import').click();
 await page.waitForFunction(()=>{
   const jobs=JSON.parse(localStorage.getItem('litgraph.discoveryHistory.v1')||'[]');
   return jobs.some(j=>j.items.some(i=>i.title==='desktop-conversion-fixture'&&i.converted)&&j.status!=='running');
 },null,{timeout:60000});
 const localPDF=await page.evaluate(async()=>{
   const job=JSON.parse(localStorage.getItem('litgraph.discoveryHistory.v1')).find(j=>j.items.some(i=>i.title==='desktop-conversion-fixture'));
   const boot=await (await fetch('/__litgraph/bootstrap',{method:'POST'})).json();
   return (await fetch('/__litgraph/document-state',{method:'POST',headers:{Authorization:'Bearer '+boot.browserToken,'Content-Type':'application/json'},body:JSON.stringify({projectId:job.projectId,nodeId:job.items[0].nodeId})})).json();
 });
 assert.match(localPDF.markdown,/evidence is stored locally/);
 assert.ok(localPDF.originalRelativePath&&localPDF.markdownRelativePath);
 await page.unroute('**/__litgraph/metadata');
 const documentRecord = await page.evaluate(async originalData => {
  const boot = await (await fetch('/__litgraph/bootstrap', { method: 'POST' })).json();
  const response = await fetch('/__litgraph/document', { method: 'POST', headers: { Authorization: 'Bearer ' + boot.browserToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'desktop-fixture', nodeId: 'original', fileName: 'fixture.md', markdown: '# Fixture\n\nEvidence is stored locally.', sourceKind: 'pdf_text', originalData }) });
  return response.json();
 }, originalData);
 assert.ok(documentRecord.key && documentRecord.originalRelativePath && documentRecord.markdownRelativePath);
 assert.equal((await readFile(path.join(dataDir, documentRecord.originalRelativePath))).toString('base64'), originalData);
 // Original documents are handed to the OS, never to an in-app viewer.
 await application.evaluate(({shell})=>{globalThis.savedOpenPath=shell.openPath;shell.openPath=async file=>{globalThis.openedOriginal=file;return '';};});
 try {
  const folder = await page.evaluate(async () => {
   const boot = await (await fetch('/__litgraph/bootstrap', { method: 'POST' })).json();
   return (await fetch('/__litgraph/data-folder', { method: 'POST', headers: { Authorization: 'Bearer ' + boot.browserToken, 'Content-Type': 'application/json' }, body: '{}' })).json();
  });
  assert.equal(folder.opened, true);
  assert.equal(folder.path, path.join(dataDir, 'data'));
  assert.equal(await application.evaluate(() => globalThis.openedOriginal), path.join(dataDir, 'data'));
  assert.equal(await page.evaluate(async () => (await fetch('/__litgraph/data-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status), 401);
  const native=await page.evaluate(async key=>{
   const boot=await (await fetch('/__litgraph/bootstrap',{method:'POST'})).json();
   return (await fetch('/__litgraph/open-native',{method:'POST',headers:{Authorization:'Bearer '+boot.browserToken,'Content-Type':'application/json'},body:JSON.stringify({key})})).json();
  },documentRecord.key);
  assert.equal(native.opened,true);
  assert.equal(await application.evaluate(()=>globalThis.openedOriginal),path.join(dataDir,documentRecord.originalRelativePath));
  assert.equal(await page.evaluate(()=>Boolean(window.open('about:blank','_blank'))),false);
 } finally {await application.evaluate(({shell})=>{shell.openPath=globalThis.savedOpenPath;delete globalThis.savedOpenPath;});}
 assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized()),true);
 const chrome=await page.locator('.desktop-titlebar').evaluate(el=>({region:getComputedStyle(el).getPropertyValue('-webkit-app-region'),standard:getComputedStyle(el).getPropertyValue('app-region'),classes:document.documentElement.className,bootstrap:Boolean(window.litgraphDesktop.bootstrap()),supported:CSS.supports('-webkit-app-region','drag')}));
 assert.equal(chrome.region,'drag',JSON.stringify(chrome));
 await application.evaluate(({shell})=>{globalThis.savedOpenExternal=shell.openExternal;shell.openExternal=async url=>{globalThis.feedbackURL=url;};});
 try {
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('link',{name:/用户反馈/}).click();
  await page.waitForTimeout(150);
  assert.equal(await application.evaluate(()=>globalThis.feedbackURL),'https://my.feishu.cn/share/base/form/shrcnbw8bQOlnsv8EXdKFaXnoIy');
  await page.getByRole('button',{name:'设置',exact:true}).click();
 } finally {await application.evaluate(({shell})=>{shell.openExternal=globalThis.savedOpenExternal;delete globalThis.savedOpenExternal;});}
 assert.ok(instructions.contracts.discovery.startsWith(dataDir));
 assert.ok(instructions.contracts.research.startsWith(dataDir));
 assert.ok(instructions.connectionFile.startsWith(dataDir));
 const child = spawn(instructions.node, [...instructions.argsPrefix, '--connection-file',instructions.connectionFile], { env: { ...options.env, ...instructions.env }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
 const lines = []; let buffer = '', childErrors = '', childExit = null;
 child.stderr.on('data', chunk => { childErrors += chunk; });
 child.on('exit', code => { childExit = code; });
 child.stdout.on('data', chunk => { buffer += chunk; let index; while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); try { lines.push(JSON.parse(line)); } catch {} } });
 child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'desktop-test', version: '1' } } }) + '\n');
 child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'litgraph_connect', arguments: { model: 'Desktop test agent', vision: false } } }) + '\n');
 await new Promise((resolve, reject) => { const end = Date.now() + 15000; const timer = setInterval(() => { if (lines.some(l => l.id === 2)) { clearInterval(timer); resolve(); } else if (Date.now() > end || childExit !== null) { clearInterval(timer); child.kill(); reject(Error(`Desktop MCP did not answer; exit=${childExit}; stderr=${childErrors}; stdout=${buffer}; responses=${JSON.stringify(lines)}`)); } }, 100); });
 assert.equal(lines.find(l => l.id === 1).result.serverInfo.name, 'litgraph');
 assert.equal(lines.find(l => l.id === 2).result.isError, false);
 await page.waitForTimeout(1500);
 await page.screenshot({ path: 'output/desktop/main-window.png' });
 // A normal native close must preserve workspace state; restart on a new port.
 const oldOrigin = new URL(page.url()).origin;
 // Wait for the asynchronous Agent status refresh before closing the window.
 // Otherwise the connection notice can appear between a count check and click.
 await page.locator('#agent-connected-dialog[open]').waitFor({ timeout: 15000 });
 await page.locator('#agent-connected-dialog button').last().click();
 await page.locator('#window-close').click();
 await application.close().catch(() => {});
 const stored = await readFile(path.join(dataDir, 'workspace-state.json'), 'utf8');
 assert.ok(!stored.includes(config.apiKey));
 assert.equal(JSON.parse(stored)['litgraph.desktop-test'], 'persistent');
 application = await electron.launch(options); page = await application.firstWindow();
 await page.locator('#project-selector-label').waitFor();
 assert.equal(await page.evaluate(() => localStorage.getItem('litgraph.desktop-test')), 'persistent');
 assert.equal(await page.evaluate(() => window.litgraphDesktop.bootstrap().config.model), 'test-model');
 assert.ok((await page.locator('#project-selector-label').textContent()).includes('样例'));
 assert.equal(await page.evaluate(() => localStorage.getItem('litgraph.aiConfig')), null);
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'litgraph_context',arguments:{}}})+'\n');
 await new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(lines.some(l=>l.id===3)){clearInterval(timer);resolve();}else if(Date.now()-start>15000){clearInterval(timer);child.kill();reject(Error('Saved MCP configuration failed to reconnect'));}},100);});
 assert.equal(lines.find(l=>l.id===3).result?.isError,false,JSON.stringify(lines.find(l=>l.id===3)));
 child.stdin.end();
 const recovered = await page.evaluate(async key => {
  const boot = await (await fetch('/__litgraph/bootstrap', { method: 'POST' })).json();
  const headers = { Authorization: 'Bearer ' + boot.browserToken, 'Content-Type': 'application/json' };
  return { document: await (await fetch('/__litgraph/document', { method: 'POST', headers, body: JSON.stringify({ key }) })).json(), original: await (await fetch('/__litgraph/original', { method: 'POST', headers, body: JSON.stringify({ key }) })).json() };
 }, documentRecord.key);
 assert.match(recovered.document.markdown, /Evidence is stored locally/); assert.equal(recovered.original.data, originalData);
 await assert.rejects(readFile(path.join(dataDir, 'metrics-state.json')), { code: 'ENOENT' });
 assert.deepEqual(errors, []);
 console.log(JSON.stringify({ passed: true, packaged, dataDir, tested: ['fresh blank project', '50-paper sample', 'sandbox isolation', 'encrypted model configuration', 'native model transport for three protocol routes', 'HTTP errors and cancellation', 'native MCP handshake', 'PDF and Markdown disk persistence', 'system original-file handoff', 'authorized categorized data-folder handoff', 'unfocused native Agent clipboard with blocked browser clipboard', 'maximized startup and draggable title bar', 'installed Agent guide paths', 'close and restart persistence', 'test telemetry disabled'], oldOrigin, newOrigin: new URL(page.url()).origin }));
} finally { await application?.close().catch(() => {}); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); }
