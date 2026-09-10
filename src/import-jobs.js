// Durable, provider-independent acquisition state. No binary files or credentials.
export const HISTORY_KEY = 'litgraph.discoveryHistory.v1';
export function restoreJobs(raw) {
  try { return JSON.parse(raw || '[]').filter(j => j?.id && j.projectId && Array.isArray(j.items)).map(j => ({ ...j, status: ['running', 'searching'].includes(j.status) ? 'paused' : j.status })); }
  catch { return []; }
}
export function createImportJob(projectId, query, filters, results = []) {
  return { id: crypto.randomUUID(), projectId, query, filters: { ...filters }, createdAt: new Date().toISOString(), status: 'searching', results, items: [], found: 0 };
}
export function jobCounts(job) {
  const items = job.items;
  return { total: items.length, downloaded: items.filter(i => i.downloaded).length, converted: items.filter(i => i.converted).length, analyzed: items.filter(i => i.analyzed).length, completed: items.filter(i => i.stage === 'done').length, errors: items.filter(i => i.error).length };
}
export function moveTab(tabs, sourceId, targetId, after = false) {
  if (sourceId === targetId) return tabs;
  const item = tabs.find(t => t.id === sourceId);
  if (!item || !tabs.some(t => t.id === targetId)) return tabs;
  const next = tabs.filter(t => t !== item);
  next.splice(next.findIndex(t => t.id === targetId) + Number(after), 0, item);
  return next;
}
// Index each acquired original immediately. Waiting for a whole batch of slow
// or unavailable sources before converting even its first PDF hides useful
// progress and leaves resumable originals unnecessarily unindexed.
// Analysis stays ordered, after indexing, so it can compare this batch's peers.
export async function processImportBatch(items, process, { signal, downloadConcurrency = 2 } = {}) {
  const pending = [...items].filter(item => item.stage !== 'done');
  const failed = new Set();
  let cursor = 0, fatalError;
  const prepare = async () => {
    while (cursor < pending.length && !fatalError) {
      signal?.throwIfAborted();
      const item = pending[cursor++];
      try { await process(item, ['downloading', 'converting']); }
      catch (error) { fatalError = error; throw error; }
      if (item.stage === 'error') failed.add(item);
    }
  };
  const workers = Math.max(1, Math.min(2, Math.floor(Number(downloadConcurrency) || 1), pending.length));
  const preparation = await Promise.allSettled(Array.from({ length: workers }, prepare));
  signal?.throwIfAborted();
  const failure = preparation.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  for (const item of pending) {
    signal?.throwIfAborted();
    if (!failed.has(item) && item.stage !== 'done') await process(item, ['analyzing']);
  }
}
export async function processImportItem(item, steps, signal, { maxAttempts = 1, wait = retryDelay, stages = ['downloading','converting','analyzing'] } = {}) {
  const run = async (stage, fn) => {
    for (let attempt=1; attempt<=maxAttempts; attempt++) {
      signal.throwIfAborted(); item.stage=stage; item.error=''; item.attempt=attempt; item.failedStage=stage; steps.save();
      try { await fn(); steps.save(); signal.throwIfAborted(); return; }
      catch (error) {
        signal.throwIfAborted();
        if (attempt===maxAttempts || error.permanent) throw error;
        item.error=error.message; steps.save(); await wait(attempt*700,signal);
      }
    }
  };
  try {
    // Reconcile files saved immediately before a pause/restart.
    await steps.reconcile(); signal.throwIfAborted();
    if (stages.includes('downloading') && !item.downloaded) await run('downloading', async () => { await steps.download(); item.downloaded = true; });
    if (stages.includes('converting') && item.downloaded && !item.converted) await run('converting', async () => { await steps.convert(); item.converted = true; });
    if (stages.includes('analyzing') && item.converted && !item.analyzed) await run('analyzing', async () => { await steps.analyze(); item.analyzed = true; });
    item.stage = item.downloaded && item.converted && item.analyzed ? 'done' : 'pending'; item.error = ''; delete item.failedStage; steps.save();
  } catch (error) {
    item.stage = signal.aborted ? 'paused' : 'error';
    item.error = signal.aborted ? '' : error.message;
    steps.save();
    if (signal.aborted) throw error;
  }
}
function retryDelay(ms, signal) {
  return new Promise((resolve,reject) => {
    signal.throwIfAborted();
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}
