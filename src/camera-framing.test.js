import assert from 'node:assert/strict';
import { capture2dFraming, match2dFraming } from './camera-framing.js';
const original = [{x:-100,y:-50,z:-20},{x:100,y:50,z:20}];
const shiftedScaled = [{x:-170,y:-60,z:-10},{x:230,y:140,z:70}];
const framing = capture2dFraming(original,{k:2,x:500,y:350},1000,700);
const camera = match2dFraming(shiftedScaled,framing,1000,700);
assert.deepEqual(capture2dFraming(shiftedScaled,camera,1000,700),framing);
assert.equal(match2dFraming([],framing,1000,700),null);
console.log('Camera framing: 2D occupancy and centering passed.');
