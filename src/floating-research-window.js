// Keep each tool's user-resized bounds independent; research now opens larger.
const savedBounds = new Map();

export function mountResearchWindow(element, layer) {
  element.classList.add('research-floating-window');
  const kind = element.classList.contains('deep-read-window') ? 'research' : 'discovery';
  const gutter = 24;
  const leftBoundary = () => {
    const sidebar = document.querySelector('.sidebar');
    return sidebar && sidebar.getBoundingClientRect().width > 0 ? sidebar.offsetWidth + gutter : gutter;
  };
  const apply = (bounds) => {
    // Fit only the initial window. Subsequent gestures may cross any workspace edge.
    const { width, height, left, top } = bounds;
    Object.assign(element.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px`, transform: 'none' });
    return { width, height, left, top };
  };
  const width = Math.min(kind === 'research' ? 940 : 860, layer.clientWidth - leftBoundary() - gutter);
  const height = Math.min(kind === 'research' ? 680 : 580, layer.clientHeight - gutter * 2);
  apply(savedBounds.get(kind) || { width, height, left: leftBoundary() + (layer.clientWidth - leftBoundary() - gutter - width) / 2, top: (layer.clientHeight - height) / 2 });
  element.tabIndex = -1;
  element.setAttribute('role', 'dialog');
  const interactive = 'button, input, textarea, select, a, label, [contenteditable="true"], .discovery-institution-popover';
  const direction = (event) => {
    const rect = element.getBoundingClientRect();
    const edge = 6;
    return `${event.clientY - rect.top < edge ? 'n' : rect.bottom - event.clientY < edge ? 's' : ''}${event.clientX - rect.left < edge ? 'w' : rect.right - event.clientX < edge ? 'e' : ''}`;
  };
  let gesture = null;
  element.addEventListener('pointermove', (event) => {
    if (!gesture) {
      const dir = direction(event);
      element.style.cursor = dir ? `${({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' })[dir]}-resize` : '';
      return;
    }
    const dx = (event.clientX - gesture.x) / gesture.scale;
    const dy = (event.clientY - gesture.y) / gesture.scale;
    const b = { ...gesture.bounds };
    if (!gesture.dir) { b.left += dx; b.top += dy; }
    else {
      const minW = Math.min(520, layer.clientWidth - leftBoundary() - gutter);
      const minH = Math.min(360, layer.clientHeight - gutter * 2);
      if (gesture.dir.includes('e')) b.width = Math.max(minW, b.width + dx);
      if (gesture.dir.includes('s')) b.height = Math.max(minH, b.height + dy);
      if (gesture.dir.includes('w')) { const d = Math.min(dx, b.width - minW); b.left += d; b.width -= d; }
      if (gesture.dir.includes('n')) { const d = Math.min(dy, b.height - minH); b.top += d; b.height -= d; }
    }
    savedBounds.set(kind, apply(b));
  });
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('.discovery-institution-popover')) return;
    const dir = direction(event);
    const isHeader = event.target.closest('.summary-window-header, .discovery-window-header');
    const isBlank = event.target.matches('article, section, .discovery-window-body, .deep-read-body, .deep-read-history, .research-tabbar');
    if (!dir && (event.target.closest(interactive) || (!isHeader && !isBlank))) return;
    event.preventDefault();
    gesture = { dir, x: event.clientX, y: event.clientY, scale: element.getBoundingClientRect().width / element.offsetWidth,
      bounds: { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight } };
    element.setPointerCapture(event.pointerId);
    element.classList.add('window-manipulating');
  });
  const finish = () => { gesture = null; element.classList.remove('window-manipulating'); element.style.cursor = ''; };
  element.addEventListener('pointerup', finish);
  element.addEventListener('pointercancel', finish);
  element.addEventListener('lostpointercapture', finish);
  const observer = new ResizeObserver(() => {
    if (!gesture) apply({ left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight });
  });
  observer.observe(layer);
  return () => observer.disconnect();
}
