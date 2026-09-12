import fs from 'node:fs';
import path from 'node:path';
import {makeCandidates} from '../../src/research-evidence.js';
import {hybridEvidence} from '../../src/research-hybrid.js';
import {quickQueryPlan,retrievalPolicy} from '../../src/research-query.js';
const [projectFile,recordsRoot]=process.argv.slice(2);if(!projectFile||!recordsRoot)throw Error('Provide a project JSON and records directory (read-only).');
const project=JSON.parse(fs.readFileSync(projectFile));const docs=project.nodes.filter(n=>!n.importCanvasHidden).map(node=>{let document=null;try{document=JSON.parse(fs.readFileSync(path.join(recordsRoot,node.fulltextKey+'.json')));}catch{}return {node,document};});
for(const n of [1,29,docs.length]){const scope=docs.slice(0,n),q='留学生规范有哪些',plan=quickQueryPlan(q);const start=performance.now();
 const result=await hybridEvidence(scope,q,plan,{...retrievalPolicy(plan,n),searchIndex:async()=>new Promise(()=>{})});
 console.log(JSON.stringify({documents:n,chunks:makeCandidates(scope).length,totalMs:performance.now()-start,evidence:result.evidence.length,retrieval:result.retrieval.timings,fallback:result.retrieval.warning}));
}
