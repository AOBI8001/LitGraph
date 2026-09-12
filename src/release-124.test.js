import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {evidenceOpening,evidenceLocations} from './research-evidence.js';
import {extractSourceMetadata,applySourceMetadata,verifiedModelMetadata} from './local-metadata.js';
import {panTimelineCamera} from './timeline-navigation.js';
import {mountModelRotation} from './model-rotation.js';
test('evidence shows ten original English words, short sentence and Chinese segmentation',()=>{
 assert.equal(evidenceOpening('The emotional stop-signal paradigm here was coupled with the manipulation of being watched.'),'The emotional stop-signal paradigm here was coupled with the manipulation...');
 assert.equal(evidenceOpening('A short sentence. A second sentence.'),'A short sentence.');
 const chinese='本研究通过网络摄像头的开关设置观察条件，并比较参与者在不同实验条件下的任务表现。';
 const opening=evidenceOpening(chinese);assert.ok(opening.endsWith('...'));assert.ok(chinese.startsWith(opening.slice(0,-3)));
 assert.match(evidenceLocations('See [E1]',[{id:'E1',title:'Fixture',text:'One two three four five six seven eight nine ten eleven.',page:2,lineStart:4,lineEnd:8}]),/原句：“One two three four five six seven eight nine ten\.\.\.”/);
 assert.ok(!evidenceLocations('[E1]',[{id:'E1',text:'<script>alert(1)</script>'}]).includes('<script>'));
});
test('Chinese thesis byline/date override legacy placeholders, not supervisor',()=>{
 const md='# wrong-filename.pdf\n## PDF Page 1\n家庭经济压力对初中生社交退缩的影响\n姓   名：   张惠芳\n指导教师：尚元东\n答辩日期：2024 年 5 月 18 日\n## PDF Page 3\n参考文献\n作者：错误作者';
 const meta=extractSourceMetadata(md);assert.deepEqual(meta.authors,['张惠芳']);assert.equal(meta.year,2024);
 const n={authors:[],year:2026,metadataSource:'OpenAlex'};applySourceMetadata(n,meta);assert.deepEqual(n.authors,['张惠芳']);assert.equal(n.year,2024);assert.equal(n.citations,null);
});
test('spaced OCR journal author names and date exclude grant year',()=>{
 const meta=extractSourceMetadata('基金项目: 2 0 2 2 年重点课题\n论文标题\n●   苏 林 琴   胡 海 琳   范 小 萍\n摘   要\n正文\n2 0 2 5 年 3 月\n参考文献\n2010年1月');
 assert.deepEqual(meta.authors,['苏林琴','胡海琳','范小萍']);assert.equal(meta.year,2025);
});
test('unsupported source fields remain unknown and verified remote metadata is preserved',()=>{
 const n={authors:[],year:2026};applySourceMetadata(n,extractSourceMetadata('基金项目：2022年\n收稿日期：2023年\n无作者'));assert.equal(n.year,null);assert.deepEqual(n.authors,[]);
 const verified={authors:['Verified'],year:2020,openAlexId:'W123',citationSource:'OpenAlex',citations:15};applySourceMetadata(verified,{authors:['Other'],year:2023,evidence:{}});assert.equal(verified.year,2020);assert.deepEqual(verified.authors,['Verified']);assert.equal(verified.citations,15);
});
test('model bibliographic fields require original quote, omit fabricated values',()=>{
 const md='作者：王小明\n出版日期：2022年\n指导教师：李教授';
 const meta=verifiedModelMetadata({authors:[{name:'王小明',quote:'作者：王小明'},{name:'伪造',quote:'作者：王小明'},{name:'李教授',quote:'指导教师：李教授'}],year:{value:2022,quote:'出版日期：2022年'}},md);
 assert.deepEqual(meta.authors,['王小明']);assert.equal(meta.year,2022);assert.equal(verifiedModelMetadata({year:{value:2026,quote:'出版日期：2022年'}},md).year,null);
});
test('pan moves the picked world position by the same screen pixel delta',()=>{
 const camera=new THREE.PerspectiveCamera(50,1.5,1,10000);camera.position.set(40,30,400);const target=new THREE.Vector3();camera.lookAt(target);camera.updateMatrixWorld();
 const point=new THREE.Vector3();const before=point.clone().project(camera);const delta=panTimelineCamera(camera.position,target,camera.quaternion,camera.fov,800,-80,60,THREE);
 camera.position.copy(delta.position);camera.updateMatrixWorld();const after=point.clone().project(camera);
 assert.ok(Math.abs((after.x-before.x)*1200/2+80)<.001);assert.ok(Math.abs(-(after.y-before.y)*800/2-60)<.001);
});
test('mounted 3D controller pans both buttons in all four view/basis slots; Shift retains rotation',()=>{
 for(const mode of ['model','timeline'])for(const basis of ['argument','semantic']){
  const listeners=new Map(),host={ownerDocument:{addEventListener(){},removeEventListener(){}},style:{},focus(){},setPointerCapture(){},hasPointerCapture(){return false;},getBoundingClientRect(){return {left:0,top:0,width:1200,height:800};},addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(){}};
  const camera=new THREE.PerspectiveCamera(50,1.5,1,10000);camera.position.set(0,0,400);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const scene=new THREE.Scene(),root=new THREE.Group();root.graphData=()=>({});scene.add(root);const controls={target:new THREE.Vector3()};let enabled=true;
  const graph={scene:()=>scene,camera:()=>camera,controls:()=>controls,graphData:()=>({nodes:[{x:0,y:0,z:0}]}),cameraPosition(position,target){camera.position.copy(position);controls.target.copy(target);},enableNavigationControls(value){if(value===undefined)return enabled;enabled=value;}};
  const rotation=mountModelRotation(graph,THREE,host,{mode:()=>mode,slot:()=>mode+':'+basis,enabled:()=>true,guides:()=>null});
  const event=(button,x,y,shiftKey=false)=>({button,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',shiftKey,preventDefault(){},stopImmediatePropagation(){}});
  for(const button of [0,2]){const before=camera.position.clone(),heading=camera.quaternion.clone();listeners.get('pointerdown')(event(button,300,100));listeners.get('pointermove')(event(button,220,160));listeners.get('pointerup')(event(button,220,160));assert.ok(camera.position.distanceTo(before)>1);assert.ok(camera.quaternion.angleTo(heading)<1e-7);assert.equal(enabled,true);}
  const heading=camera.quaternion.clone();listeners.get('pointerdown')(event(0,300,100,true));listeners.get('pointermove')(event(0,360,140,true));listeners.get('pointerup')(event(0,360,140,true));
  assert.ok(mode==='model'?rotation.rotation.angleTo(new THREE.Quaternion())>.01:camera.quaternion.angleTo(heading)>.01);rotation.dispose();
 }
});
