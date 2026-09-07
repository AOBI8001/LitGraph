import assert from 'node:assert/strict';
import * as THREE from 'three';
import { framePerspectiveModel, initialFramingPoints } from './perspective-framing.js';
for(const aspect of [.75,1.5,2.5])for(const size of [30,800,6000]){
  const camera=new THREE.PerspectiveCamera(50,aspect,.1,100000);
  camera.position.set(500,200,800);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const points=[];
  for(const x of [-size,size])for(const y of [-size,size])for(const z of [-size,size])points.push({x:x+120,y,z});
  const fit=framePerspectiveModel(points,camera,THREE);
  camera.position.copy(fit.position);camera.lookAt(fit.target);camera.updateMatrixWorld();
  const projected=points.map(p=>new THREE.Vector3(p.x,p.y,p.z).project(camera));
  assert.ok(projected.every(p=>Math.abs(p.x)<=.81&&Math.abs(p.y)<=.81&&p.z<1));
  assert.ok(Math.max(...projected.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]))>.45);
}
console.log('Perspective framing: sparse/dense bounds, depth, aspect ratios and comfortable occupancy passed.');
const core=Array.from({length:49},(_,i)=>({x:Math.sin(i)*150,y:Math.cos(i)*150,z:Math.sin(i*.3)*150}));
const outlier={x:20000,y:-20000,z:0};
assert.equal(initialFramingPoints([...core,outlier]).length,49);
assert.equal(initialFramingPoints([...core,outlier]).includes(outlier),false);
assert.equal(initialFramingPoints(core).length,49);
