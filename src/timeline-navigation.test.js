import assert from 'node:assert/strict';
import * as THREE from 'three';
import {panTimelineCamera,orbitTimelineCamera} from './timeline-navigation.js';
const position=new THREE.Vector3(500,350,1500),target=new THREE.Vector3(0,100,0);
const camera=new THREE.PerspectiveCamera(50,1.5);camera.position.copy(position);camera.lookAt(target);
const next=panTimelineCamera(position,target,camera.quaternion,50,800,120,-60,THREE);
assert.ok(next.position.clone().sub(position).length()>0);
assert.ok(next.position.clone().sub(next.target).distanceTo(position.clone().sub(target))<1e-8);
const reverse=panTimelineCamera(next.position,next.target,camera.quaternion,50,800,-120,60,THREE);
assert.ok(reverse.position.distanceTo(position)<1e-8);
const limits=new THREE.Spherical().setFromVector3(position.clone().sub(target));
for(const sign of [-1,1]){
  const orbit=orbitTimelineCamera(position,target,limits,sign*1e5,sign*1e5,800,THREE);
  const angles=new THREE.Spherical().setFromVector3(orbit.position.clone().sub(target));
  assert.ok(Math.abs(angles.theta-limits.theta)<=Math.PI/4+1e-8);
  assert.ok(Math.abs(angles.phi-limits.phi)<=Math.PI/9+1e-8);
  assert.ok(Math.abs(orbit.position.distanceTo(target)-position.distanceTo(target))<1e-8);
}
console.log('Year-tree navigation: fixed-heading pan, reversible translation, bounded upright orbit passed.');
