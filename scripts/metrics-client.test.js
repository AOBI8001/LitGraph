import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMetrics } from '../desktop/metrics.mjs';

test('desktop events persist across restarts; retries preserve event IDs; use contains no action or content', async () => {
 const dir = await mkdtemp(path.join(os.tmpdir(), 'litgraph-metrics-test-'));
 let online = false; const sent = [];
 const fetchImpl = async (url, options) => { sent.push(JSON.parse(options.body)); if (!online) throw Error('offline'); return { ok: true }; };
 try {
  let client = await createMetrics(dir, { fetchImpl, autoFlush: false });
  await client.launch(); await client.use('question'); await client.use('search');
  assert.equal(await client.use('private paper title'), false);
  await client.flush(); await client.close();
  online = true;
  client = await createMetrics(dir, { fetchImpl, autoFlush: false });
  await client.flush(); await client.launch(); await client.flush();
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(new Set(sent.map(e => e.installId)).size, 1);
  assert.deepEqual(sent.slice(1).map(e => e.type), ['launch', 'use', 'use', 'launch']);
  assert.deepEqual(Object.keys(sent[1]).sort(), ['eventId', 'installId', 'occurredAt', 'type']);
  await client.setEnabled(false); assert.equal(await client.use('question'), false);
  await client.close();
  client = await createMetrics(dir, { fetchImpl, autoFlush: false });
  assert.equal(client.enabled(), false); assert.equal(await client.launch(), false);
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'metrics-state.json'))).queue, []);
  await client.close();
 } finally { await rm(dir, { recursive: true, force: true }); }
});

test('test mode never sends or creates an installation record', async () => {
 const dir = await mkdtemp(path.join(os.tmpdir(), 'litgraph-metrics-test-'));
 try {
  const client = await createMetrics(dir, { disabled: true, fetchImpl: () => assert.fail('must not send') });
  assert.equal(await client.launch(), false); assert.equal(await client.use('import'), false);
  await client.flush(); await client.close();
  await assert.rejects(readFile(path.join(dir, 'metrics-state.json')), { code: 'ENOENT' });
 } finally { await rm(dir, { recursive: true, force: true }); }
});
