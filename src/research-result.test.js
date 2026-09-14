import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeResearchResult} from './research-result.js';
import {createTextStream} from './ai-stream.js';
import {groundedEvidenceAnswer} from './research-evidence.js';
const answer='比较研究设计与任务。[E1]\n\n【AI 推断】差异可能来自测量。[E999]';
test('complete answers do not depend on three well-formed suggestions',()=>{
 for(const suggested_followups of [undefined,null,{},[],['同一问题？','同一问题？',7,'x'.repeat(161),'别的问题？']]){
  const result=normalizeResearchResult(JSON.stringify({answer,suggested_followups}));
  assert.equal(result.answer,answer);assert.ok(result.suggested_followups.length<=3);
 }
 assert.equal(normalizeResearchResult(JSON.stringify({answer,suggested_followups:['1','2','3','4']})).suggested_followups.length,3);
});
test('recover complete answer field without inventing follow-ups or modifying citations',()=>{
 for(const raw of [`{"answer":${JSON.stringify(answer)},"suggested_followups":["task?",]}`,`{"answer":${JSON.stringify(answer)},"suggested_followups":`,JSON.stringify({answer}).replaceAll('\\n','\n')]){
  const result=normalizeResearchResult(raw);assert.equal(result.answer,answer);assert.deepEqual(result.suggested_followups,[]);
  const checked=groundedEvidenceAnswer(result.answer,[{id:'E1',text:'One two three four five six seven eight nine ten eleven words.',title:'Source'}]);
  assert.equal(checked.sources.length,1);assert.deepEqual(checked.invalidEvidenceIds,['E999']);assert.match(checked.answer,/引用未核验/);
 }
});
test('plain Markdown, fenced JSON, braces within text and double encoding are supported',()=>{
 for(const raw of [answer,'```json\n'+JSON.stringify({answer})+'\n```',JSON.stringify(JSON.stringify({answer})), 'Here is the result:\n'+JSON.stringify({answer})+'\nEnd.'])assert.equal(normalizeResearchResult(raw).answer,answer);
 assert.equal(normalizeResearchResult(JSON.stringify({answer:'A {brace} in prose.'})).answer,'A {brace} in prose.');
});
test('never promote incomplete JSON, nested output, HTML or reasoning to an answer',()=>{
 for(const raw of ['', '{"answer":"unfinished', '{"answer":"unfinished\\', '{"reasoning":{"answer":"secret"}}', '{"answer":null}', '<think>private reasoning</think>', '```json\n{"answer":"unfinished', '{"answer":"unescaped "quotation" ends here"}'])assert.throws(()=>normalizeResearchResult(raw));
});
const frame=e=>'data: '+JSON.stringify(e)+'\n\n';
test('stream completion is checked across providers, while length/refusal failures stay failures',()=>{
 for(const terminal of [{choices:[{finish_reason:'stop'}]},{type:'message_stop'},{type:'response.completed'}]){
  const s=createTextStream(()=>{},{requireCompletion:true});s.push(frame({choices:[{delta:{content:'{"answer":"ok"}'}}]})+frame(terminal));assert.equal(normalizeResearchResult(s.finish()).answer,'ok');
 }
 for(const [terminal,code] of [[{choices:[{finish_reason:'length'}]},'output_limit'],[{type:'message_delta',delta:{stop_reason:'max_tokens'}},'output_limit'],[{type:'response.incomplete'},'output_limit'],[{choices:[{finish_reason:'content_filter'}]},'refusal'],[{type:'error',error:{message:'bad'}},'provider_error']]){
  const s=createTextStream(()=>{},{requireCompletion:true});s.push(frame({choices:[{delta:{content:'{"answer":"partial"}'}}]})+frame(terminal)+'data: [DONE]\n\n');assert.throws(()=>s.finish(),{code});
 }
 const s=createTextStream(()=>{},{requireCompletion:true});s.push(frame({choices:[{delta:{content:'{"answer":"partial"}'}}]}));assert.throws(()=>s.finish(),{code:'incomplete'});
});
