import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { installHash } from '../cloudflare/metrics/worker.js';
const base = 'https://litgraph.aobi.qzz.io/__metrics';
const secrets = JSON.parse(await readFile(new URL('../output/metrics-admin.local.json', import.meta.url)));
const stats = async () => {
 const r = await fetch(base + '/stats', { headers: { Authorization: `Bearer ${secrets.ADMIN_TOKEN}` } });
 assert.equal(r.status, 200); return r.json();
};
const before = await stats();
assert.equal((await fetch(base + '/health')).status, 200);
assert.equal((await fetch(base + '/stats')).status, 401);
const installId = randomUUID(), hash = await installHash(installId, secrets.INSTALL_SALT);
// Recovery file is written before any synthetic request. It only targets this
// test's HMAC installation ID, never real installations or the whole table.
assert.match(hash, /^[a-f0-9]{64}$/);
await writeFile(new URL('../output/metrics-test-cleanup.sql', import.meta.url),
 `DELETE FROM events WHERE install_hash='${hash}';\nDELETE FROM daily_activity WHERE install_hash='${hash}';\nDELETE FROM installations WHERE install_hash='${hash}';\n`);
const event = { installId, eventId: randomUUID(), occurredAt: new Date().toISOString(), type: 'launch' };
const send = async e => { const r = await fetch(base + '/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) }); assert.equal(r.status, 200); };
await send(event); await send(event);
await send({ ...event, eventId: randomUUID(), type: 'use' });
await send({ ...event, eventId: randomUUID(), type: 'use' });
const after = await stats();
const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const previous = before.days.find(d => d.day === day) || {};
const current = after.days.find(d => d.day === day);
assert.equal(after.totalInstalls - before.totalInstalls, 1);
for (const [key, increment] of Object.entries({ newInstalls: 1, activeInstalls: 1, usedInstalls: 1, launches: 1, uses: 2 })) assert.equal(current[key] - (previous[key] || 0), increment, key);
console.log('Live Cloudflare verified: duplicate launch counted once, two uses counted twice, installation and daily active deduplicated; stats are private. Apply output/metrics-test-cleanup.sql to remove only this synthetic installation.');
