export const desktop = window.litgraphDesktop;
export const desktopBootstrap = desktop?.bootstrap();
if (desktopBootstrap) {
  for (const key of Object.keys(localStorage).filter(key => key.startsWith('litgraph.'))) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(desktopBootstrap.state || {})) localStorage.setItem(key, value);
  document.documentElement.classList.add('desktop-app');
  let timer;
  const snapshot = () => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('litgraph.') && key !== 'litgraph.aiConfig').map(key => [key, localStorage.getItem(key)]));
  const persist = () => { if (!desktop.saveState(snapshot())) console.warn('Local workspace backup could not be saved.'); };
  const setItem = Storage.prototype.setItem, removeItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (...args) { setItem.apply(this, args); if (this === localStorage) { clearTimeout(timer); timer = setTimeout(persist, 350); } };
  Storage.prototype.removeItem = function (...args) { removeItem.apply(this, args); if (this === localStorage) { clearTimeout(timer); timer = setTimeout(persist, 350); } };
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
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    const result = await desktop.modelRequest({ id, url, headers: options.headers, body: options.body });
    options.signal?.throwIfAborted();
    return new Response(result.body, { status: result.status, headers: { 'Content-Type': result.contentType } });
  } finally { options.signal?.removeEventListener('abort', cancel); }
}
