import assert from 'node:assert/strict';
import * as THREE from 'three';
import { modelCenter } from './model-rotation.js';
assert.deepEqual(modelCenter([], THREE).toArray(), [0,0,0]);
assert.deepEqual(modelCenter([{x:-20,y:5,z:10},{x:60,y:15,z:30}], THREE).toArray(), [20,10,20]);
assert.deepEqual(modelCenter([{x:NaN,y:Infinity},{x:8,y:4,z:2}], THREE).toArray(), [8,4,2]);
const core=Array.from({length:49},(_,i)=>({x:(i%7)*20,y:Math.floor(i/7)*20,z:(i%3)*8}));
const withOutlier=[...core,{x:-8000,y:5000,z:9000}];
assert.deepEqual(modelCenter(withOutlier,THREE).toArray(),modelCenter(core,THREE).toArray(),'A remote node must not displace the rotation center');
const pivot=new THREE.Vector3(20,10,20);
const root=new THREE.Group();
root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/3);
root.position.copy(pivot).sub(pivot.clone().applyQuaternion(root.quaternion));
root.updateMatrixWorld(true);
assert.ok(root.localToWorld(pivot.clone()).distanceTo(pivot)<1e-8);
const mainCenter=modelCenter(core,THREE),rotationPivot=modelCenter(withOutlier,THREE);
for(const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0)]){
  root.quaternion.setFromAxisAngle(axis,Math.PI/2);
  root.position.copy(rotationPivot).sub(rotationPivot.clone().applyQuaternion(root.quaternion));root.updateMatrixWorld(true);
  assert.ok(root.localToWorld(mainCenter.clone()).distanceTo(mainCenter)<1e-8,'Main body must spin in place, not orbit the outlier');
}
console.log('Model rotation: finite bounds and fixed-center transform passed.');
