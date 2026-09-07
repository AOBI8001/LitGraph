export function layoutBounds(nodes) {
  const points = nodes.filter(n => Number.isFinite(n.x) && Number.isFinite(n.y));
  if (!points.length) return null;
  const axes = ['x', 'y', 'z'];
  const center = {}, span = {};
  for (const axis of axes) {
    const values = points.map(n => Number.isFinite(n[axis]) ? n[axis] : 0);
    const min = Math.min(...values), max = Math.max(...values);
    center[axis] = (min + max) / 2;
    span[axis] = Math.max(1, max - min);
  }
  return { center, span };
}

export function capture2dFraming(nodes, camera, width, height) {
  const bounds = layoutBounds(nodes);
  if (!bounds) return null;
  return {
    occupancy: Math.max(bounds.span.x * camera.k / width, bounds.span.y * camera.k / height),
    centerX: (bounds.center.x * camera.k + camera.x) / width,
    centerY: (bounds.center.y * camera.k + camera.y) / height
  };
}

export function match2dFraming(nodes, reference, width, height) {
  const bounds = layoutBounds(nodes);
  if (!bounds || !reference) return null;
  const k = reference.occupancy / Math.max(bounds.span.x / width, bounds.span.y / height);
  return { k, x: reference.centerX * width - bounds.center.x * k, y: reference.centerY * height - bounds.center.y * k };
}
