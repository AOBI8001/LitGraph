import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {development,documents,metrics} from './rag-v2-cases.mjs';
import {queryPlanMessages,normalizeQueryPlan} from '../../src/research-query.js';
import {hybridEvidence} from '../../src/research-hybrid.js';
import {embed} from './local-embedder.mjs';
import {runAgent,findAgent} from '../../desktop/agent-runtime.mjs';
const out=path.resolve('output/rag-v2-development');await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(out,'agent-work'),{recursive:true});
await fs.writeFile(path.join(out,'gold.json'),JSON.stringify(development,null,2));
const executable=await findAgent('codex'),results=[];
for(const c of development){const filename=path.join(out,c.id+'.json');let saved=await fs.readFile(filename,'utf8').then(JSON.parse).catch(()=>null);if(!saved){const start=Date.now(),raw=await runAgent({provider:'codex',executable,messages:queryPlanMessages(c.question),maxTokens:1500,mode:'quick',cwd:path.join(out,'agent-work'),timeoutMs:90000});saved={id:c.id,plan:normalizeQueryPlan(raw,c.question),planSeconds:(Date.now()-start)/1000};await fs.writeFile(filename,JSON.stringify(saved,null,2));}
 const sweeps=[];for(const topK of [8,12,20,32,48]){const start=Date.now(),result=await hybridEvidence(documents,c.question,saved.plan,{embed,topK});if(result.retrieval.warning)throw Error(result.retrieval.warning);sweeps.push({topK,metrics:metrics(result.evidence,c.gold),seconds:(Date.now()-start)/1000,characters:result.retrieval.characters});}results.push({id:c.id,sweeps});console.log(c.id,JSON.stringify(sweeps.map(x=>[x.topK,x.metrics.recovered,x.metrics.goldUnits])));}
const totals=[8,12,20,32,48].map(topK=>{const items=results.map(x=>x.sweeps.find(y=>y.topK===topK)),sum=f=>items.reduce((s,x)=>s+f(x),0);return {topK,recovered:sum(x=>x.metrics.recovered),goldUnits:sum(x=>x.metrics.goldUnits),characters:sum(x=>x.characters)/items.length};});
const best=Math.max(...totals.map(x=>x.recovered)),chosen=totals.find(x=>x.recovered===best).topK;
await fs.writeFile(path.join(out,'sweep.json'),JSON.stringify({rule:'Choose smallest K attaining maximum development reference recall under 28000-character budget.',developmentHash:createHash('sha256').update(JSON.stringify(development)).digest('hex'),chosen,totals,results},null,2));console.log(JSON.stringify({chosen,totals}));
