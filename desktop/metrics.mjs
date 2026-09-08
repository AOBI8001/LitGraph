import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export const METRICS_ENDPOINT = 'https://litgraph.aobi.qzz.io/__metrics/event';
const retention = 7 * 86400000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const usageActions = new Set(['search', 'question', 'import', 'sample', 'explore']);

// Runs in the desktop main process, never in website previews. The action name
// is only validated locally: every core action sends the same minimal use event.
export async function createMetrics(directory, { endpoint = METRICS_ENDPOINT, fetchImpl = fetch, now = Date.now, disabled = false, autoFlush = true } = {}) {
  const file = path.join(directory, 'metrics-state.json');
  let state;
  try { state = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') return disabledClient(); }
  if (state && (!uuid.test(state.installId) || !Array.isArray(state.queue))) return disabledClient();
  state ||= { installId: randomUUID(), enabled: true, queue: [] };
  let chain = Promise.resolve(), flushing = null, timer, stopped = false;
  const serial = task => { const result = chain.then(task); chain = result.catch(() => {}); return result; };
  const persist = async () => {
    await mkdir(directory, { recursive: true });
    await writeFile(file + '.tmp', JSON.stringify(state), { mode: 0o600 });
    await rename(file + '.tmp', file);
  };
  const prune = () => { state.queue = state.queue.filter(e => now() - Date.parse(e.occurredAt) < retention).slice(-1000); };
  async function record(type) {
    if (disabled || stopped || !state.enabled) return false;
    try {
      await serial(async () => {
        if (!state.enabled || stopped) return;
        prune();
        state.queue.push({ installId: state.installId, eventId: randomUUID(), type, occurredAt: new Date(now()).toISOString() });
        state.queue = state.queue.slice(-1000);
        await persist();
      });
      if (autoFlush) void flush();
      return true;
    } catch { return false; } // Failure never interrupts the user's task.
  }
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      if (disabled || stopped || !state.enabled) return;
      await serial(async () => { prune(); await persist(); });
      // Bounded batch; throttled installations retry next minute without losing IDs.
      for (let i = 0; i < 30 && !stopped && state.enabled; i++) {
        const event = await serial(() => state.queue[0]);
        if (!event) break;
        const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!response.ok && response.status !== 400) break;
        await serial(async () => { state.queue = state.queue.filter(e => e.eventId !== event.eventId); await persist(); });
      }
    })().catch(() => {}).finally(() => { flushing = null; });
    return flushing;
  }
  if (!disabled && autoFlush) { timer = setInterval(() => void flush(), 60000); timer.unref(); }
  return {
    launch: () => record('launch'),
    use: action => usageActions.has(action) ? record('use') : Promise.resolve(false),
    flush,
    enabled: () => !disabled && state.enabled,
    setEnabled: enabled => serial(async () => { state.enabled = enabled === true; if (!state.enabled) state.queue = []; await persist(); return state.enabled; }),
    close: async () => { stopped = true; clearInterval(timer); await chain; }
  };
}
function disabledClient() {
  return { launch: async () => false, use: async () => false, flush: async () => {}, enabled: () => false, setEnabled: async () => false, close: async () => {} };
}
