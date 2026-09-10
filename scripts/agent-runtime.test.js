import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createAgentRuntime, invocation, parseAgentOutput, runAgent } from '../desktop/agent-runtime.mjs';
import { localService } from './local-service.js';

const fixture = async t => { const root = await mkdtemp(path.join(os.tmpdir(), 'litgraph-agent-test-')); t.after(() => rm(root, { recursive: true, force: true })); return root; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('CLI invocations isolate tasks and accept text through stdin, not shell arguments', () => {
  const text = '中文 $env:SECRET; --dangerously-bypass-approvals-and-sandbox';
  for (const provider of ['codex', 'claude']) {
    const request = invocation(provider, [{ role: 'user', content: text }]);
    assert.ok(request.prompt.includes(text));
    assert.ok(!request.args.includes(text));
    assert.ok(!request.args.some(a => /bypass|resume|continue/.test(a)));
  }
  assert.ok(invocation('codex', [{ role: 'user', content: 'a' }]).args.includes('--ignore-user-config'));
  assert.ok(invocation('claude', [{ role: 'user', content: 'a' }]).args.includes('--safe-mode'));
  assert.throws(() => invocation('codex', [{ role: 'user', content: [{ type: 'image_url' }] }]), /text only/);
});

test('parsers return final answers only and reject failed, reasoning-only and partial output', () => {
  const event = value => JSON.stringify(value);
  const codex = [event({ type: 'item.completed', item: { type: 'reasoning', text: 'hidden' } }), event({ type: 'item.completed', item: { type: 'agent_message', text: '最终回答' } }), event({ type: 'turn.completed' })].join('\n');
  assert.equal(parseAgentOutput('codex', codex), '最终回答');
  assert.throws(() => parseAgentOutput('codex', event({ type: 'turn.completed' })), /final answer/);
  assert.throws(() => parseAgentOutput('codex', event({ type: 'error' })), /could not complete/);
  assert.throws(() => parseAgentOutput('codex', event({ type: 'item.completed', item: { type: 'agent_message', text: 'partial' } })), /did not complete/);
  assert.equal(parseAgentOutput('claude', event({ subtype: 'success', result: '{"answer":"ok"}' })), '{"answer":"ok"}');
  assert.throws(() => parseAgentOutput('claude', event({ is_error: true, result: 'no' })), /could not complete/);
});

test('real subprocess transport handles stdin, UTF-8 boundaries, cancellation and timeouts without a shell', async t => {
  const cwd = await fixture(t);
  const launch = (file, args, options) => {
    assert.equal(options.shell, false);assert.equal(options.windowsHide, true);
    assert.equal(options.env.CODEX_THREAD_ID, undefined);
    return spawn(process.execPath, ['-e', `let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const output=Buffer.from(JSON.stringify({subtype:'success',result:'中文 ✔'}));for(const byte of output)process.stdout.write(Buffer.from([byte]));});`], options);
  };
  assert.equal(await runAgent({ provider: 'claude', executable: 'fixture', cwd, launch, messages: [{ role: 'user', content: 'test' }] }), '中文 ✔');
  const hang = (file, args, options) => spawn(process.execPath, ['-e', 'process.stdin.resume();setInterval(()=>{},1000);'], options);
  const controller = new AbortController();
  const waiting = runAgent({ provider: 'claude', executable: 'fixture', cwd, launch: hang, messages: [{ role: 'user', content: 'test' }], signal: controller.signal });
  const cancelled = assert.rejects(waiting, { name: 'AbortError' });
  controller.abort();await cancelled;
  await assert.rejects(runAgent({ provider: 'claude', executable: 'fixture', cwd, launch: hang, messages: [{ role: 'user', content: 'test' }], timeoutMs: 80 }), /timed out/);
});

test('runtime queues, cancels, preserves login configuration on restart and never retries a failed task', async t => {
  const root = await fixture(t), calls = [], pending = [];
  const execute = async request => {
    if (request.messages[0].role === 'system') return request.messages.at(-1).content;
    calls.push(request.messages[0].content);
    return new Promise((resolve, reject) => { pending.push({ resolve, reject }); request.signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }); });
  };
  const runner = await createAgentRuntime(root, { execute, discover: async () => 'fixture' });
  t.after(() => runner.close());
  assert.equal((await runner.connect('codex')).connected, true);
  const a = new AbortController(), b = new AbortController();
  const first = runner.submit([{ role: 'user', content: 'first' }], 200, a.signal);
  const firstFailure = assert.rejects(first, { name: 'AbortError' });
  const second = runner.submit([{ role: 'user', content: 'second' }], 200, b.signal);
  const secondFailure = assert.rejects(second, { name: 'AbortError' });
  assert.equal(runner.status().queued, 1);
  b.abort(); await secondFailure;
  while (!calls.length) await tick();
  a.abort(); await firstFailure; await tick();
  assert.deepEqual(calls, ['first']);
  const third = runner.submit([{ role: 'user', content: 'third' }], 200);
  const thirdFailure = assert.rejects(third, /quota/);
  while (calls.length < 2) await tick();
  pending.at(-1).reject(Error('quota')); await thirdFailure; await tick();
  assert.equal(calls.length, 2);
  const restored = await createAgentRuntime(root, { execute });
  assert.equal(restored.status().configured, true);
  await restored.disconnect(); await restored.close();
  assert.equal((await createAgentRuntime(root)).status().configured, false);
});

test('all application AI tasks run without MCP polling; failures and cancellation are observable', async t => {
  const root = await fixture(t), calls = [];
  const runner = await createAgentRuntime(root, { discover: async () => 'fixture', execute: async request => {
    if (request.messages[0].role === 'system') return request.messages.at(-1).content;
    const content = request.messages[0].content; calls.push(content);
    if (content === 'failure') throw Error('Fixture failure');
    if (content === 'wait') return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }));
    return JSON.stringify({ answer: content });
  } });
  await runner.connect('codex');
  const service = localService(root, { agentRunner: runner });
  const server = http.createServer((req, res) => service(req, res, () => res.end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await runner.close(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/__litgraph/`;
  let token = '';
  const call = async (route, data, method = data ? 'POST' : 'GET') => { const response = await fetch(base + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined }); return { status: response.status, ...await response.json() }; };
  token = (await call('bootstrap', {})).browserToken;
  assert.equal((await call('status')).managed, true);
  const cancelledId = randomUUID();
  await call(`tasks/${cancelledId}`, null, 'DELETE');
  assert.equal((await call('tasks', { requestId: cancelledId, messages: [{ role: 'user', content: 'must-not-run' }] })).status, 409);
  const duplicateId = randomUUID(), duplicate = { requestId: duplicateId, messages: [{ role: 'user', content: 'duplicate' }] };
  assert.equal((await call('tasks', duplicate)).id, duplicateId);
  assert.equal((await call('tasks', duplicate)).id, duplicateId);
  assert.equal((await call('tasks', { ...duplicate, maxTokens: 999 })).status, 400);
  for (const content of ['discovery-plan', 'discovery-relevance', 'paper-analysis', 'research-question']) {
    const { id } = await call('tasks', { messages: [{ role: 'user', content }], maxTokens: 200 });
    let state;
    for (let count = 0; count < 30; count++) { state = await call(`tasks/${id}`); if (state.state === 'done') break; await tick(); }
    assert.equal(state.result, JSON.stringify({ answer: content }));
    await call(`tasks/${id}`, null, 'DELETE');
  }
  const failed = await call('tasks', { messages: [{ role: 'user', content: 'failure' }] });
  assert.equal(calls.filter(c => c === 'duplicate').length, 1);
  let state;
  for (let count = 0; count < 30; count++) { state = await call(`tasks/${failed.id}`); if (state.state === 'failed') break; await tick(); }
  assert.equal(state.error, 'Fixture failure');
  const waiting = await call('tasks', { messages: [{ role: 'user', content: 'wait' }] });
  while (!calls.includes('wait')) await tick();
  await call(`tasks/${waiting.id}`, null, 'DELETE');
  assert.equal((await call(`tasks/${waiting.id}`)).status, 404);
  await call('disconnect', {});
  assert.equal((await call('status')).connected, false);
  assert.equal((await call('tasks', { messages: [] })).status, 409);
});
