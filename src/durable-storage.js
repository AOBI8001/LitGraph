// Desktop state is disk-backed. Chromium's ~5 MB localStorage quota is only
// a cache limit, not a limit on the user's papers or conversations.
export function createDurableStorage(storage, initial = {}) {
  const values = new Map(Object.entries(initial).filter(([key,value]) => key.startsWith('litgraph.') && typeof value === 'string'));
  const native = Object.fromEntries(['getItem','setItem','removeItem'].map(key => [key, storage[key].bind(storage)]));
  const managed = key => String(key).startsWith('litgraph.');
  const writeCache = (key,value) => {
    try { native.setItem(key,value); }
    catch (error) {
      if (error.name !== 'QuotaExceededError') throw error;
      native.removeItem(key); // Never leave a stale smaller value in the cache.
    }
  };
  for (const [key,value] of values) writeCache(key,value);
  return {
    getItem(key) { key=String(key); return managed(key) ? values.get(key) ?? null : native.getItem(key); },
    setItem(key,value) { key=String(key);value=String(value);if(!managed(key))return native.setItem(key,value);writeCache(key,value);values.set(key,value); },
    removeItem(key) { key=String(key);native.removeItem(key);values.delete(key); },
    clear() { for(const key of values.keys())native.removeItem(key);values.clear(); },
    snapshot() { return Object.fromEntries([...values].filter(([key])=>key!=='litgraph.aiConfig')); }
  };
}
