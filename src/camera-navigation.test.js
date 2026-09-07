import assert from 'node:assert/strict';
import { closerCamera, translateCamera } from './camera-navigation.js';
const position = { x: 10, y: 20, z: 520 }, target = { x: 10, y: 20, z: 20 }, up = { x: 0, y: 1, z: 0 };
assert.deepEqual(closerCamera(position, target), { x: 10, y: 20, z: 380 });
const move = (...keys) => translateCamera(position, target, up, new Set(keys), 1 / 60);
assert.deepEqual(move('KeyW'), move('ArrowUp'));
assert.deepEqual(move('KeyS'), move('ArrowDown'));
assert.deepEqual(move('KeyA'), move('ArrowLeft'));
assert.deepEqual(move('KeyD'), move('ArrowRight'));
assert.ok(move('KeyW').position.z < position.z);
assert.ok(move('KeyS').position.z > position.z);
assert.ok(move('KeyA').position.x < position.x);
assert.ok(move('KeyD').position.x > position.x);
assert.equal(move('KeyW', 'KeyS'), null);
assert.deepEqual(move('KeyW', 'ArrowUp'), move('KeyW'));
for (const keys of [['KeyW'], ['KeyA'], ['KeyD', 'KeyW']]) {
  const next = move(...keys);
  for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs((next.position[axis] - next.target[axis]) - (position[axis] - target[axis])) < 1e-9);
}
const length = result => Math.hypot(...['x', 'y', 'z'].map(axis => result.position[axis] - position[axis]));
assert.ok(Math.abs(length(move('KeyW')) - length(move('KeyW', 'KeyD'))) < 1e-9);
const rotated = translateCamera({ x: 500, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, up, new Set(['KeyD']), 1/60);
assert.ok(rotated.position.z < 0);
console.log('3D navigation: target-relative approach, eight keys, camera-relative movement, stable orientation and normalized diagonals passed.');
