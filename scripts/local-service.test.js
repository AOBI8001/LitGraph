import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localService } from './local-service.js';
const testRoot = await mkdtemp(path.join(tmpdir(), 'litgraph-empty-library-test-'));
const middleware = localService(testRoot);
const server = http.createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function call(route, body, token, method = body ? 'POST' : 'GET') {
  const r = await fetch(base + '/__litgraph/' + route, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: body ? JSON.stringify(body) : undefined });
  return { code: r.status, data: await r.json() };
}
try {
  const { data: b } = await call('bootstrap', {});
  assert.equal((await call('document', { node: { id: 'missing' } }, b.browserToken)).data, null);
  assert.equal((await call('original', { id: 'missing' }, b.browserToken)).data, null);
  const { data: config } = await call('instructions', {}, b.browserToken);
  const tool = (name, args = {}) => call('agent', { name, arguments: args }, config.token);
  assert.equal((await call('status', null, b.browserToken)).data.connected, false);
  const connectedAgent=(await tool('litgraph_connect', { model: 'Test Agent' })).data;
  assert.equal(connectedAgent.connected, true);
  assert.ok(connectedAgent.connectionId);
  assert.match(connectedAgent.instructions,/接入成功/);
  assert.equal((await tool('litgraph_connect', { model: 'Test Agent' })).data.connectionId,connectedAgent.connectionId);
  assert.equal((await call('status', null, b.browserToken)).data.model, 'Test Agent');
  assert.equal((await call('document', {}, config.token)).code, 403);
  assert.equal((await call('status', null, 'invalid')).code, 401);
  const { data: job } = await call('tasks', { messages: [{ role: 'user', content: 'test' }] }, b.browserToken);
  assert.equal((await tool('litgraph_next_task')).data.id, job.id);
  assert.equal((await tool('litgraph_submit_result', { id: job.id, result: '{"answer":"ok"}' })).data.accepted, true);
  assert.equal((await call('tasks/' + job.id, null, b.browserToken)).data.result, '{"answer":"ok"}');
  const { data: cancelled } = await call('tasks', { messages: [] }, b.browserToken);
  await tool('litgraph_next_task');
  await call('tasks/' + cancelled.id, null, b.browserToken, 'DELETE');
  assert.equal((await tool('litgraph_submit_result', { id: cancelled.id, result: 'late' })).code, 400);
  const blocked = await fetch(base + '/__litgraph/bootstrap', { method: 'POST', headers: { Origin: 'https://evil.example' } });
  assert.equal(blocked.status, 403);
  await call('disconnect', {}, b.browserToken);
  assert.equal((await tool('litgraph_context')).code, 401);
  const second = (await call('instructions', {}, b.browserToken)).data;
  const child = spawn(process.execPath, ['scripts/litgraph-mcp.mjs', base, second.token], { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiters = new Map(); let seq = 0;
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', line => { const message = JSON.parse(line); waiters.get(message.id)?.(message); });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; const timeout = setTimeout(() => reject(new Error('MCP timeout')), 5000);
    waiters.set(id, message => { clearTimeout(timeout); waiters.delete(id); resolve(message.result); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    assert.equal((await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).serverInfo.name, 'litgraph');
    assert.equal((await request('tools/list')).tools.length, 5);
    const connected = await request('tools/call', { name: 'litgraph_connect', arguments: { model: 'MCP protocol test' } });
    assert.equal(JSON.parse(connected.content[0].text).connected, true);
    const pending = (await call('tasks', { messages: [{ role: 'user', content: 'MCP roundtrip' }] }, b.browserToken)).data;
    const received = await request('tools/call', { name: 'litgraph_next_task', arguments: { wait_ms: 0 } });
    assert.equal(JSON.parse(received.content[0].text).id, pending.id);
    await request('tools/call', { name: 'litgraph_submit_result', arguments: { id: pending.id, result: 'MCP result' } });
    assert.equal((await call('tasks/' + pending.id, null, b.browserToken)).data.result, 'MCP result');
    console.log('MCP stdio protocol: initialize, tools/list, authenticated task/result roundtrip passed.');
  } finally { child.kill(); lines.close(); }
  console.log('Local bridge: handshake, routing, result, cancellation, revocation, token isolation, cross-origin rejection passed.');
} finally { await new Promise(resolve => server.close(resolve)); await rmdir(testRoot); }
