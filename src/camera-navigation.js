const axes = ['x', 'y', 'z'];
export const navigationKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD']);

export function closerCamera(position, target, factor = 0.72) {
  return Object.fromEntries(axes.map(axis => [axis, target[axis] + (position[axis] - target[axis]) * factor]));
}

// Translate both the eye and orbit target: movement must not rotate the view.
export function translateCamera(position, target, up, keys, seconds) {
  const forwardAmount = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const rightAmount = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  if (!forwardAmount && !rightAmount) return null;
  const delta = axes.map(axis => target[axis] - position[axis]);
  const distance = Math.hypot(...delta);
  if (distance < 0.001) return null;
  const forward = delta.map(value => value / distance);
  const right = [forward[1] * up.z - forward[2] * up.y, forward[2] * up.x - forward[0] * up.z, forward[0] * up.y - forward[1] * up.x];
  const rightLength = Math.hypot(...right);
  // Orbit controls avoid the poles, but retain a stable fallback there.
  const lateral = rightLength > 0.0001 ? right.map(value => value / rightLength) : [1, 0, 0];
  const step = Math.max(50, Math.min(1000, distance * 0.55)) * Math.min(0.05, Math.max(0, seconds)) / Math.hypot(forwardAmount, rightAmount);
  const offset = axes.map((_, i) => (forward[i] * forwardAmount + lateral[i] * rightAmount) * step);
  return {
    position: Object.fromEntries(axes.map((axis, i) => [axis, position[axis] + offset[i]])),
    target: Object.fromEntries(axes.map((axis, i) => [axis, target[axis] + offset[i]]))
  };
}
