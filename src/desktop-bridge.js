import { createDurableStorage } from './durable-storage.js';
export const desktop = window.litgraphDesktop;
export const desktopBootstrap = desktop?.bootstrap();
let durableStorage;
export const workspaceSnapshot = () => durableStorage?.snapshot() || Object.fromEntries(Object.keys(localStorage).map(key => [key,localStorage.getItem(key)]));
export function flushDesktopState() {
  if (desktop && !desktop.saveState(workspaceSnapshot())) throw Error('Workspace could not be saved to disk. Check available space and retry.');
}
if (desktopBootstrap) {
  for (const key of Object.keys(localStorage).filter(key => key.startsWith('litgraph.'))) localStorage.removeItem(key);
  durableStorage = createDurableStorage(localStorage, desktopBootstrap.state || {});
  document.documentElement.classList.add('desktop-app');
  let timer;
  const persist = () => { try { flushDesktopState(); } catch(error) { console.warn(error.message); } };
  const setItem = Storage.prototype.setItem, removeItem = Storage.prototype.removeItem, getItem = Storage.prototype.getItem, clear = Storage.prototype.clear;
  Storage.prototype.getItem = function (...args) { return this === localStorage ? durableStorage.getItem(...args) : getItem.apply(this,args); };
  Storage.prototype.setItem = function (...args) { if(this!==localStorage)return setItem.apply(this,args);durableStorage.setItem(...args);clearTimeout(timer);timer=setTimeout(persist,350); };
  Storage.prototype.removeItem = function (...args) { if(this!==localStorage)return removeItem.apply(this,args);durableStorage.removeItem(...args);clearTimeout(timer);timer=setTimeout(persist,350); };
  Storage.prototype.clear = function () { if(this!==localStorage)return clear.call(this);durableStorage.clear();clear.call(this);clearTimeout(timer);timer=setTimeout(persist,350); };
  // The application saves its final graph state in its own beforeunload handler.
  // Flush after all handlers, not before those final writes.
  window.addEventListener('beforeunload', () => queueMicrotask(persist));
}
export function recordUse(action) { if (desktop) void desktop.recordUse(action).catch(() => {}); }
export async function modelFetch(url, options) {
  if (!desktop) return fetch(url, options);
  options.signal?.throwIfAborted();
  const id = crypto.randomUUID();
  const cancel = () => { void desktop.cancelModel(id); };
  const unsubscribe=options.onChunk?desktop.onModelChunk?.(data=>{if(data.id===id&&!options.signal?.aborted)options.onChunk(data.text);}):null;
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    const result = await desktop.modelRequest({ id, url, headers: options.headers, body: options.body,stream:Boolean(options.onChunk) });
    options.signal?.throwIfAborted();
    return new Response(result.body, { status: result.status, headers: { 'Content-Type': result.contentType } });
  } finally { unsubscribe?.();options.signal?.removeEventListener('abort', cancel); }
}
