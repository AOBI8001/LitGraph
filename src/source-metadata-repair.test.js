import assert from 'node:assert/strict';
import test from 'node:test';
import { repairSourceMetadata, bibliographyMessages } from './source-metadata-repair.js';
const title='Comparison of synthetic learning tasks';
const node=()=>({title:title+' 张三',fileName:title+'_张三.pdf',authors:[],year:2026,importedLocally:true,metadataChecked:true,metadataWarning:'no match',sourceMetadataVersion:1});
const document={markdown:`# ${title}_张三.pdf\n## PDF Page 1\n${title}\n张三，李四\n测试大学\n摘要\n测试`};
const applyRemote=(n,m)=>Object.assign(n,m);
test('lookup sees the recovered source title rather than the annotated filename',async()=>{
  const n=node();const seen=[];
  await repairSourceMetadata(n,document,{lookup:async input=>{seen.push(input);return {title,authors:['Source Example'],year:2024,metadataApiUrl:'https://example.org/verified'};},applyRemote,model:()=>assert.fail('complete fields must not trigger a model call')});
  assert.equal(seen.length,1);assert.equal(seen[0].title,title);assert.deepEqual(n.authors,['Source Example']);assert.equal(n.sourceMetadataState.status,'complete');
  await repairSourceMetadata(n,document,{lookup:()=>assert.fail('reuse successful identity'),applyRemote});
  assert.deepEqual(n.authors,['Source Example']);assert.equal(n.metadataOverrides.authors,undefined);
});
test('metadata service failure preserves verified local fields and remains retryable',async()=>{
  const n=node();
  await repairSourceMetadata(n,document,{lookup:async()=>{throw Error('network unavailable');},applyRemote});
  assert.deepEqual(n.authors,['张三','李四']);assert.equal(n.year,null);assert.match(n.metadataWarning,/network unavailable/);assert.equal(n.sourceMetadataState.status,'incomplete');
  let calls=0;await repairSourceMetadata(n,document,{lookup:async()=>{calls++;return {year:2023,metadataApiUrl:'https://example.org/verified'};},applyRemote});
  assert.equal(calls,1);assert.equal(n.year,2023);
});
test('model metadata is isolated, bounded to target, and cached for identical source',async()=>{
  const n=node();const doc={markdown:`${title}\nAuthors: not decoded\nAbstract\nSynthetic body`};let calls=0;
  const model=async messages=>{calls++;assert.match(messages[0].content,/TARGET paper/);return {authors:[{name:'Invented Person',quote:'Invented Person'}]};};
  await repairSourceMetadata(n,doc,{model});
  assert.equal(calls,1);assert.deepEqual(n.authors,[]);assert.ok(n.sourceMetadataState.missing.includes('authors'));
  await repairSourceMetadata(n,doc,{model});assert.equal(calls,1,'do not pay again for identical unsuccessful output');
  await repairSourceMetadata(n,{markdown:doc.markdown+'\nChanged source'},{model});assert.equal(calls,2);
});
test('malformed/transient model failures remain retryable and do not abort source preservation',async()=>{
  const n=node();const doc={markdown:`${title}\nAuthors: not decoded\nAbstract\nSynthetic body`};let calls=0;
  const model=async()=>{calls++;throw Error('invalid JSON');};
  await repairSourceMetadata(n,doc,{model});await repairSourceMetadata(n,doc,{model});
  assert.equal(calls,2);assert.match(n.sourceMetadataState.modelError,/invalid JSON/);assert.equal(n.sourceMetadataState.modelAttempt,undefined);assert.equal(n.title,title);
});
test('ambiguous input is not sent to model and cannot donate the first article author',async()=>{
  const n={...node(),title:'hash',fileName:'hash.pdf'};
  const doc={markdown:'First synthetic experiment\nJohn Smith\nTesting University\nAbstract\nBody.\nSecond synthetic experiment\nJane Doe\nTesting University\nAbstract\nBody.'};
  await repairSourceMetadata(n,doc,{model:()=>assert.fail('ambiguous identity must stay unresolved'),lookup:()=>assert.fail('no reliable identity to look up')});
  assert.deepEqual(n.authors,[]);assert.equal(n.sourceMetadataState.identityResolved,false);
});
test('abort propagates instead of being recorded as a metadata failure',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(repairSourceMetadata(node(),document,{signal:controller.signal}),{name:'AbortError'});
});
test('metadata prompt excludes earlier paper text',()=>{
  const source=`Other synthetic experiment\nOther Person\nTesting University\nAbstract\nBody.\n${title}\nJohn Smith\nTesting University\nAbstract\nBody.`;
  const messages=bibliographyMessages({title},source);
  assert.ok(!messages[1].content.includes('Other Person'));assert.ok(messages[1].content.includes('John Smith'));
});
test('changing API/model retries unresolved metadata without storing credentials',async()=>{
  const n=node(),doc={markdown:`${title}\nAuthors: undecoded\nAbstract\nSynthetic body`};let calls=0;
  const model=async()=>{calls++;return {authors:[]};};
  await repairSourceMetadata(n,doc,{model,modelIdentity:'api/model-a'});
  await repairSourceMetadata(n,doc,{model,modelIdentity:'api/model-b'});
  assert.equal(calls,2);assert.ok(!n.sourceMetadataState.modelAttempt.includes('model-b'));
});
