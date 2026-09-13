import test from 'node:test';
import assert from 'node:assert/strict';
import {compactResearchAnswer,asksRetrievalDiagnostics} from './research-answer-style.js';
import {coverageNotice} from './research-coverage.js';
import {researchMessages} from './research-agent.js';
const boilerplate='本次共 50 篇论文，只有 7 篇送回了片段，且每篇均为少量摘录而非完整正文；其余 43 篇虽有可检索全文，但本次未送回任何片段，因此无法判断它们是否提到观察，这不等同于它们没有相关内容。另外，前一轮对话中出现过的若干论文编号并未出现在本次送回的片段中，那些说法本次无法用现有证据核实，故不在此列出。';
test('compress repeated accounting without removing the supported answer',()=>{
 const result=compactResearchAnswer('摄像头开启代表被观察。[E1]\n\n'+boilerplate);
 assert.match(result,/摄像头开启代表被观察。\[E1\]/);assert.doesNotMatch(result,/50|43|送回|前一轮/);assert.match(result,/尚需核对原文/);
});
test('keep concrete uncertainty, citations, quoted originals and requested diagnostics',()=>{
 for(const text of ['无法确定实验是否随机分组。','研究发现显著差异。'+boilerplate,boilerplate+' [E2]','原文：“'+boilerplate+'”'])assert.equal(compactResearchAnswer(text),text);
 assert.equal(compactResearchAnswer(boilerplate,'zh',{diagnostics:true}),boilerplate);
 assert.ok(asksRetrievalDiagnostics('为什么只送回7篇片段？'));assert.equal(asksRetrievalDiagnostics('哪些论文讨论观察？'),false);
});
test('no routine footer, but real failed batches stay visible',()=>{
 assert.equal(coverageNotice({strategy:'scope-coverage',scopePaperCount:50,coveredPaperCount:7,fallbackPaperCount:20}),'');
 assert.match(coverageNotice({strategy:'scope-coverage',failedPaperCount:8}),/8 篇处理失败/);
});
test('prior boilerplate is not fed back into follow-up prompts; history is not mutated',()=>{
 const history=[{role:'assistant',text:boilerplate,status:'done'}];const messages=researchMessages([],history,'哪些论文讨论观察？');
 assert.doesNotMatch(JSON.parse(messages[1].content).recent_conversation[0].content,/送回/);assert.equal(history[0].text,boilerplate);
 assert.match(messages[0].content,/Do not narrate retrieval bookkeeping/);
});
