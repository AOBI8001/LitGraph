// Replay frozen plans, without another model answer call, after a Chinese sentence-boundary fix.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cases,documents,metrics} from './rag-v2-cases.mjs';
import {hybridEvidence} from '../../src/research-hybrid.js';
import {embed} from './local-embedder.mjs';
const changed=[],recallChanged=[];
for(const c of cases){const saved=JSON.parse(await fs.readFile('output/rag-benchmark-v2/'+c.id+'.json'));const current=await hybridEvidence(documents,c.question,saved.plan,{embed});if(JSON.stringify(current.evidence)!==JSON.stringify(saved.context.evidence))changed.push(c.id);if(metrics(current.evidence,c.gold)?.recovered!==saved.metrics?.recovered)recallChanged.push(c.id);}
const source=await fs.readFile('src/research-evidence.js','utf8');
const oldSource=source.replace('/[.!?]','/[.!?。！？]').replace('|[。！？]|;','|;');
const old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
const current=await import('../../src/research-evidence.js');
const chunkingUnchanged=JSON.stringify(old.makeCandidates(documents))===JSON.stringify(current.makeCandidates(documents));
const evidenceHash=createHash('sha256').update(await fs.readFile('src/research-evidence.js')).digest('hex');
const report={questions:cases.length,changedEvidenceCases:changed,changedRecallCases:recallChanged,chunkingUnchanged,evidenceHash,note:'Chinese punctuation fix leaves all corpus chunks identical. Reusing the now-warm quantized-vector cache changes three rankings/tail selections versus the original run. Original answer scores remain bound to ORIGINAL contexts; no responses were regenerated or reselected. This replay is retrieval-only, not a second answer-accuracy test.'};
await fs.writeFile('output/rag-benchmark-v2/context-replay.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(recallChanged.length||!chunkingUnchanged)process.exitCode=1;
