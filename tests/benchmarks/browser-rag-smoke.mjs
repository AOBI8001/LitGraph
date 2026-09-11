import {retrieveInWorker} from '/src/research-worker-client.js';
import {evidenceLocations} from '/src/research-evidence.js';
const output=document.querySelector('#result');
try{
 const markdown=await fetch('/sample-fulltext/paper-001.md').then(r=>r.text());
 const documents=[{node:{id:'a',title:'OCD response inhibition',authors:['Test Author'],year:2020},document:{markdown,fileName:'paper-001.md',sourceKind:'pdf_text'}}];
 const question='OCD patients compared with healthy controls: what is the mean SSRT difference in milliseconds?',plan={queries:[question],high_level_keywords:['response inhibition group difference'],low_level_keywords:['SSRT mean difference milliseconds'],sections:['abstract','results']};
 const times=[],runs=[];
 for(let i=0;i<2;i++){const start=performance.now(),result=await retrieveInWorker(documents,question,plan,{signal:AbortSignal.timeout(180000)});times.push(Math.round(performance.now()-start));runs.push(result);}
 const found=runs[0].evidence.find(e=>e.text.includes('23.43'));
 if(!found||runs.some(x=>x.retrieval.warning))throw Error('Dense retrieval failed or original answer not retrieved: '+JSON.stringify(runs.map(x=>x.retrieval)));
 output.textContent=JSON.stringify({status:'PASS',method:runs[0].retrieval.method,runMilliseconds:times,source: evidenceLocations('23.43 ms ['+found.id+']',runs[0].evidence,'en'),metadata:{authors:found.authors,year:found.year,section:found.section,page:found.page}},null,2);
}catch(error){output.textContent='FAIL: '+error.message;}
