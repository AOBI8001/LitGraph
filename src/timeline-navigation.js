// Screen-space pan: move the eye and its target together without rotating.
export function panTimelineCamera(position, target, rotation, fov, height, dx, dy, THREE) {
  const scale = 2 * position.distanceTo(target) * Math.tan(fov * Math.PI / 360) / Math.max(1, height);
  const offset = new THREE.Vector3(-dx * scale, dy * scale, 0).applyQuaternion(rotation);
  return {position:position.clone().add(offset), target:target.clone().add(offset)};
}

// Optional depth inspection, bounded around this layout's original heading.
// World Y stays up: no roll, pole crossing or upside-down year axes.
export function orbitTimelineCamera(position, target, limits, dx, dy, height, THREE) {
  const spherical = new THREE.Spherical().setFromVector3(position.clone().sub(target));
  const speed = Math.PI / Math.max(220, height);
  spherical.theta = THREE.MathUtils.clamp(spherical.theta - dx * speed, limits.theta - Math.PI / 4, limits.theta + Math.PI / 4);
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - dy * speed, Math.max(.15, limits.phi - Math.PI / 9), Math.min(Math.PI - .15, limits.phi + Math.PI / 9));
  return {position:new THREE.Vector3().setFromSpherical(spherical).add(target), target:target.clone()};
}
