// Explicit network integration audit. Not part of the offline unit-test suite.
// Uses genuine source records and the same authenticated acquisition route as
// the product. Reports failures; it never substitutes fabricated/full-text fixtures.
import http from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {localService} from './local-service.js';
import {scholarlyService} from './scholarly-service.js';

const root=await mkdtemp(path.join(tmpdir(),'litgraph-real-downloads-'));
const probe=process.argv.includes('--repository-probe');
const source=scholarlyService();
const middleware=localService(root,probe?{scholarly:{...source,search:async()=>{
 const papers=[];
 for(const doi of ['10.1371/journal.pmed.1003583','10.3389/fpsyt.2021.519727','10.3389/fnhum.2014.00419']){
  const paper=await source.lookup({doi});if(paper)papers.push({...paper,recordId:doi});
 }
 return {papers,sources:['OpenAlex','Crossref','Europe PMC'],warnings:[]};
}}}:{});
const server=http.createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/__litgraph/`;
async function call(route,data,token,timeout=180000){
 const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token||''}`},body:JSON.stringify(data),signal:AbortSignal.timeout(timeout)});
 const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);return result;
}
const report={dataRoot:root,method:probe?'Three additional known-DOI repository regression probes, genuine source lookups, same acquire route. Separate from unselected first-ten search audit.':'First 10 source-verified open-access search records in each language; no cookies; same acquire route as product.',groups:[],papers:[]};
const output=path.resolve('output',probe?'real-repository-download-audit.json':'real-download-audit.json');await mkdir(path.dirname(output),{recursive:true});
const persist=()=>writeFile(output,JSON.stringify(report,null,2));
try{
 const searchToken=(await call('bootstrap',{})).browserToken;
 for(const group of probe?[{language:'en',queries:['Known DOI repository regression']}]:[{language:'zh',queries:['人工智能 教育','心理学']},{language:'en',queries:['generative artificial intelligence higher education','obsessive compulsive disorder']}]){
  let result;
  try{result=await call('search',{queries:group.queries,filters:{yearStart:2020,yearEnd:2026,language:group.language,articleType:'any',source:'open',resultCount:10,sort:'relevance'}},searchToken,180000);}
  catch(error){report.groups.push({...group,error:error.message,selected:0});await persist();console.log(`${group.language}: search failed: ${error.message}`);continue;}
  const papers=result.papers.slice(0,10);report.groups.push({...group,sources:result.sources,warnings:result.warnings,selected:papers.length});
  console.log(`${group.language}: testing ${papers.length} source records.`);
  let cursor=0;
  await Promise.all(Array.from({length:3},async()=>{
   const token=(await call('bootstrap',{})).browserToken;
   while(cursor<papers.length){
    const index=cursor++,paper=papers[index],started=Date.now();
    const row={language:group.language,index:index+1,title:paper.title,doi:paper.doi,metadataSource:paper.metadataSource,sourceUrl:paper.sourceUrl,isOpenAccess:paper.isOpenAccess,pdfUrls:paper.pdfUrls};
    try{
     const acquired=await call('acquire',{recordId:paper.recordId,projectId:'real-audit-'+group.language,nodeId:String(index)},token,150000);
     if(acquired.data){
      const bytes=Buffer.from(acquired.data,'base64');
      if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Acquisition returned invalid PDF bytes.');
      const disk=await readFile(path.join(root,acquired.originalRelativePath));
      if(!disk.equals(bytes))throw Error('Saved PDF differs from downloaded bytes.');
      Object.assign(row,{status:'downloaded',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),savedPath:path.join(root,acquired.originalRelativePath),repository:acquired.metadata.fulltextRepository||null});
     }else Object.assign(row,{status:acquired.status||'failed',error:acquired.error,attempts:acquired.attempts});
    }catch(error){Object.assign(row,{status:error.name==='TimeoutError'?'timeout':'failed',error:error.message});}
    row.elapsedSeconds=Math.round((Date.now()-started)/1000);report.papers.push(row);await persist();console.log(`${group.language} ${index+1}/${papers.length} ${row.status}: ${paper.title.slice(0,85)} (${row.elapsedSeconds}s)`);
   }
  }));
 }
 report.summary=Object.fromEntries(['zh','en'].map(language=>{const items=report.papers.filter(p=>p.language===language);return [language,{tested:items.length,downloaded:items.filter(p=>p.status==='downloaded').length,unavailable:items.filter(p=>p.status!=='downloaded').length}];}));
 await persist();console.log(JSON.stringify({report:output,...report.summary}));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
