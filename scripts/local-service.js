import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import {scholarlyService} from './scholarly-service.js';
import {scansciService} from './scansci-service.js';
import {isCompletePdf} from './acquisition-core.js';
import {loadSampleDocument} from '../src/sample-corpus.js';
import {chunkDocument,CHUNK_VERSION} from '../src/research-evidence.js';
import {createVectorService} from './rag-vector-service.mjs';
import {cleanDoi,titleKey,discoveryCount,rankDiscovery,mergeDiscovery,usesInstitution,topicMatch} from '../src/discovery-contract.js';

const digest = value => createHash('sha256').update(String(value)).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// A cancelled queued request settles immediately, but its queue slot is not
// released ahead of its predecessor (which may be waiting for authentication).
function waitQueue(previous,signal){
  signal?.throwIfAborted();if(!signal)return previous;
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    previous.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
const institutionRouteFields=['institutionRecordUrl','institutionSearchUrl','institutionPdfUrls','institutionFullTextUrls'];
function observedWebUrl(value){
  try{const address=new URL(value);return ['http:','https:'].includes(address.protocol)&&!address.username&&!address.password?address.href:'';}catch{return '';}
}
function observedUrls(...values){return [...new Set(values.flat().map(observedWebUrl).filter(Boolean))];}
function observedLanguage(value){
  const language=String(value||'').trim().toLowerCase();
  if(/^(?:en(?:[-_]\w+)?|eng|english|英语|英文)$/.test(language))return 'en';
  if(/^(?:zh(?:[-_]\w+)?|chi|zho|chinese|汉语|中文)$/.test(language))return 'zh';
  return /^[a-z]{2,3}$/.test(language)?language:'unknown';
}
function observedArticleType(value){
  const type=String(value||'').trim().toLowerCase();
  if(/\bmeta(?:[ -]analys[ei]s)?\b|元分析|荟萃分析/.test(type))return 'meta';
  if(/review|综述/.test(type))return 'review';
  if(/conference|proceeding|会议/.test(type))return 'conference';
  if(/article|research|研究论文|期刊论文/.test(type))return 'research';
  return 'unknown';
}
function observedInstitutionRecord(candidate,searchUrl){
  if(!candidate||typeof candidate!=='object')return null;
  const title=String(candidate.title||'').replace(/\s+/g,' ').trim(),sourceUrl=observedWebUrl(candidate.sourceUrl);
  if(!titleKey(title)||!sourceUrl)return null;
  const doi=cleanDoi(candidate.doi),year=Number(candidate.year);
  const authors=Array.isArray(candidate.authors)?candidate.authors.filter(a=>typeof a==='string'&&a.trim()).map(a=>a.trim()):[];
  const citations=Number.isInteger(candidate.citations)&&candidate.citations>=0?candidate.citations:null;
  return {title,sourceUrl,doi:/^10\.\d{4,9}\/\S+$/i.test(doi)?doi:'',authors,
    year:Number.isInteger(year)&&year>=1000&&year<=new Date().getFullYear()+1?year:null,
    journal:typeof candidate.journal==='string'?candidate.journal:'',abstract:typeof candidate.abstract==='string'?candidate.abstract:'',
    language:observedLanguage(candidate.language),articleType:observedArticleType(candidate.articleType||candidate.type),
    citations,citationSource:citations===null?'':'Institution browser',isOpenAccess:typeof candidate.isOpenAccess==='boolean'?candidate.isOpenAccess:null,
    institutionRecordUrl:sourceUrl,institutionSearchUrl:observedWebUrl(searchUrl),
    // An institution PDF link is not evidence of open access. Keep these routes
    // out of the unauthenticated OA transport; the native browser follows them.
    institutionPdfUrls:observedUrls(candidate.institutionPdfUrls||[],candidate.pdfUrls||[],candidate.pdfUrl),
    institutionFullTextUrls:observedUrls(candidate.institutionFullTextUrls||[],candidate.fullTextUrls||[],candidate.fulltextUrls||[],candidate.fullTextUrl,candidate.fulltextUrl)};
}
function enrichInstitutionRecord(observed,metadata){
  const observedDoi=cleanDoi(observed.doi),metadataDoi=cleanDoi(metadata?.doi);
  const doiConflict=Boolean(observedDoi&&metadataDoi&&observedDoi!==metadataDoi);
  const identityMatches=!doiConflict&&Boolean(observedDoi&&metadataDoi&&observedDoi===metadataDoi||titleKey(observed.title)&&titleKey(observed.title)===titleKey(metadata?.title));
  const enriched=Boolean(metadata&&identityMatches),paper={...observed};
  if(enriched){
    Object.assign(paper,metadata);
    // Preserve canonical fields when supplied; missing service metadata must
    // not erase details actually displayed by the authenticated source.
    for(const key of ['title','doi','journal','abstract','language','articleType'])if(!paper[key]||paper[key]==='unknown')paper[key]=observed[key];
    if(!Array.isArray(paper.authors)||!paper.authors.length)paper.authors=observed.authors;
    if(!Number.isInteger(paper.year)||paper.year<1000)paper.year=observed.year;
    if(!Number.isInteger(paper.citations)||paper.citations<0){paper.citations=observed.citations;paper.citationSource=observed.citationSource;}
    paper.isOpenAccess=typeof paper.isOpenAccess==='boolean'?paper.isOpenAccess:observed.isOpenAccess;
  }
  paper.sourceUrl=observed.sourceUrl;
  for(const key of institutionRouteFields)paper[key]=observed[key];
  paper.metadataSource=enriched?(metadata.metadataSource||'Verified scholarly metadata'):'Institution browser';
  paper.metadataSources=[...new Set([...(enriched?(metadata.metadataSources||[paper.metadataSource]):[]),'Institution browser'])];
  paper.metadataVerification=enriched?'metadata-enriched':'source-observed';
  paper.metadataRetrievedAt=metadata?.metadataRetrievedAt&&enriched?metadata.metadataRetrievedAt:new Date().toISOString();
  paper.sourceRecord={url:observed.sourceUrl,searchUrl:observed.institutionSearchUrl,title:observed.title,doi:observed.doi,observedAt:new Date().toISOString()};
  return {paper,enriched,identityConflict:Boolean(metadata&&!identityMatches)};
}
function institutionFilterReason(paper,filters){
  // Authors and citation counts are optional source metadata, not discovery
  // eligibility criteria. Unknown constrained fields remain explicitly unknown.
  if(!Number.isInteger(paper.year))return 'unknownYear';
  if(paper.year<Number(filters.yearStart)||paper.year>Number(filters.yearEnd))return 'year';
  if(filters.language!=='any'){
    if(!paper.language||paper.language==='unknown')return 'unknownLanguage';
    if(paper.language!==filters.language||filters.language==='en'&&/[\u3400-\u9fff]/.test(paper.title))return 'language';
  }
  if(filters.articleType!=='any'){
    if(!paper.articleType||paper.articleType==='unknown')return 'unknownType';
    if(paper.articleType!==filters.articleType)return 'articleType';
  }
  return '';
}
export function localService(root, dependencies = {}) {
  const dataRoot = dependencies.dataRoot || root;
  const embed=dependencies.embed || createVectorService(root,dataRoot);
  if(!dependencies.embed)embed.start?.();
  const scholarly=dependencies.scholarly||scholarlyService();
  const engine=dependencies.engine || scansciService(root,{scholarly,download:dependencies.download});
  const acquiringDocuments = new Set();
  let acquisitionQueue=Promise.resolve();
  const clients = new Map();
  const legacyIndexRoot = path.join(dataRoot, 'projects', 'local-fulltext-index');
  const libraryRoot = path.join(dataRoot, 'data');
  const folders = Object.fromEntries(['originals', 'markdown', 'chunks', 'analysis', 'vectors', 'projects', 'records'].map(name => [name, path.join(libraryRoot, name)]));
  let foldersReady;
  const ensureFolders = () => foldersReady ||= Promise.all(Object.values(folders).map(folder => mkdir(folder, { recursive: true })));
  const samplePath = path.join(dataRoot, 'projects', 'local-sample', 'graph.json');
  const catalogPath = path.join(folders.records, 'discovery-records.json');
  const readCompatible = async (file, oldFile) => readFile(file, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return readFile(oldFile, 'utf8'); });
  const catalogReady = readCompatible(catalogPath, path.join(dataRoot, 'projects', 'discovery-records.json')).then(JSON.parse).then(records => new Map(records)).catch(() => new Map());
  let catalogWrite = Promise.resolve();
  const historyPath = path.join(folders.records, 'discovery-history.json');
  let historyWrite = Promise.resolve();
  const projectWrites = new Map();
  async function atomicWrite(file, content) {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = file + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, content, 'utf8');
    // Windows may briefly hold a source record open while the background
    // indexer/antivirus reads it. Keep the old file intact and retry replacement.
    for(let attempt=0;;attempt++)try{await rename(temporary,file);break;}catch(error){
      if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=5)throw error;
      await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));
    }
  }
  async function readSample() {
    try { return JSON.parse(await readFile(samplePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { nodes: [] }; throw error; }
  }
  async function sampleSource(node) {
    if (node.isSample) {
      // Same bundle used by the web preview and installed application. No author-machine paths.
      for (const directory of [path.join(root, 'public', 'sample-fulltext'), path.join(root, 'dist', 'sample-fulltext')]) {
        const bundled = await loadSampleDocument(node, file => readFile(path.join(directory, file), 'utf8').catch(error => {
          if (error.code === 'ENOENT') return null;
          throw error;
        }));
        if (bundled) {
          // Distinct graph nodes may share one original. Their chunk IDs must
          // not repeatedly overwrite each other's index under a shared key.
          const key=digest(`sample-md:${node.id}:${bundled.corpusHash}`),existing=await readDocument(key);
          if(existing?.corpusHash===bundled.corpusHash&&existing.markdown===bundled.markdown){
            void embed.index?.('enqueue',{documents:[{key,node:{id:node.id,title:node.title}}]}).catch(()=>{});
            return existing;
          }
          return saveDocument({ ...bundled, nodeId:node.id, paperMetadata:{title:node.title,authors:node.authors,year:node.year,doi:node.doi}, key });
        }
      }
      return null;
    }
    const sample = await readSample();
    const matches = sample.nodes.filter(p => node.doi && p.doi?.toLowerCase() === node.doi.toLowerCase());
    const found = sample.nodes.find(p => p.id === node.id && p.title === node.title) || (matches.length === 1 ? matches[0] : matches.find(p => p.title === node.title));
    if (!found?.localTextPath) return null;
    const text = await readFile(found.localTextPath, 'utf8').catch(() => '');
    if (!text.trim()) return null;
    const record = { markdown: `# ${found.title}\n\n${text.replace(/\r\n/g, '\n').replace(/\u0000/g, '')}`, fileName: path.basename(found.localTextPath).replace(/\.txt$/i, '.md'), sourceKind: 'extracted_text', originalPath: found.localTextPath, title: found.title, doi: found.doi };
    record.key = digest(`sample:${found.doi || found.title}${matches.length > 1 ? ':' + found.id : ''}`);
    await saveDocument(record);
    return record;
  }
  async function saveDocument(record) {
    await ensureFolders();
    if(record.markdown){record.localMarkdownPath = path.join(folders.markdown, record.key + '.md');record.markdownRelativePath=`data/markdown/${record.key}.md`;await atomicWrite(record.localMarkdownPath, record.markdown);}
    const chunks=record.markdown?chunkDocument(record,{...record.metadata,...record.paperMetadata,id:record.nodeId||record.key}):[];
    await atomicWrite(path.join(folders.chunks,record.key+'.json'),JSON.stringify({version:CHUNK_VERSION,key:record.key,chunks}));
    record.chunkCount=chunks.length;record.chunkVersion=CHUNK_VERSION;
    await atomicWrite(path.join(folders.records, record.key + '.json'), JSON.stringify(record));
    if(record.markdown)void embed.index?.('enqueue',{documents:[{key:record.key,node:{...record.paperMetadata,id:record.nodeId||record.key}}],changed:true}).catch(()=>{});
    return record;
  }
  const documentKey=data=>digest(`${data.projectId}:${data.nodeId}`);
  async function readDocument(key) {
    if (!/^[a-f0-9]{64}$/.test(key || '')) return null;
    let record, legacy = false;
    try { record = JSON.parse(await readFile(path.join(folders.records, key + '.json'), 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { record = JSON.parse(await readFile(path.join(legacyIndexRoot, key + '.json'), 'utf8')); legacy = true; }
      catch (oldError) { if (oldError.code === 'ENOENT') return null; throw oldError; }
    }
    record.key = key;
    // Copy-on-read migration retains every legacy file. Paths always derive from
    // the validated key, never from JSON-supplied absolute/relative paths.
    if (legacy) {
      await ensureFolders();
      if (record.originalRelativePath) {
        try {
          await copyFile(path.join(legacyIndexRoot, key + '.pdf'), path.join(folders.originals, key + '.pdf'));
          record.originalRelativePath = `data/originals/${key}.pdf`;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          delete record.originalRelativePath;
          record.originalMissing = true;
        }
      }
      return saveDocument(record);
    }
    if (record.markdown) record.localMarkdownPath = path.join(folders.markdown, key + '.md');
    return record;
  }
  async function saveOriginal(key,bytes,record={}){
    if(bytes.length>40*1024*1024)throw new Error('PDF exceeds 40 MB.');
    if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw new Error('The source returned a page instead of a PDF. Open the source to sign in or download manually.');
    if(!isCompletePdf(bytes))throw new Error('The source returned an incomplete PDF.');
    await ensureFolders();await writeFile(path.join(folders.originals,key+'.pdf'),bytes);
    return saveDocument({...record,key,originalRelativePath:`data/originals/${key}.pdf`,originalType:'application/pdf'});
  }
  const active = c => c.agent && Date.now() - c.agent.lastSeen < 300000;
  const status = c => dependencies.agentRunner?.status().configured ? dependencies.agentRunner.status() : ({ connected: Boolean(active(c)), connectionId: active(c) ? c.agent.connectionId : null, model: active(c) ? c.agent.model : '', vision: active(c) && c.agent.vision === true });
  function clientFor(token) { return [...clients.values()].find(c => c.browserToken === token || c.agentToken === token); }
  const cancelAcquisitions=c=>{for(const task of c.acquisitions?.values()||[])if(task.state==='processing')task.controller.abort();};
  async function searchRecords(c,data,signal) {
    if(c.searchBusy)throw Error('A search is already running.');
    c.searchBusy=true;
    try {
      // One aggregate search budget is owned by the scholarly service so it
      // can retain verified partial results rather than discard them on expiry.
      let result;
      if(data.filters?.source==='combined'){
        const reports=[],warnings=[],all=[],sources=[],queryReports=[];
        // Sequential channels avoid issuing further requests while the
        // institution browser is paused for human authentication.
        for(const source of ['open','institution']){
          signal?.throwIfAborted();
          try{
            const branch=await searchRecords({searchBusy:false}, {...data,filters:{...data.filters,source}},signal);
            all.push(...branch.papers);sources.push(...branch.sources);warnings.push(...branch.warnings);
            queryReports.push(...(branch.queryReports||[]));
            reports.push({source,status:'completed',sources:branch.sources,count:branch.papers.length,incomplete:branch.incomplete});
          }catch(error){signal?.throwIfAborted();reports.push({source,status:'failed',error:error.message});warnings.push(source+': '+error.message);}
        }
        if(reports.every(r=>r.status==='failed'))throw Error(warnings.join('; '));
        const requested=discoveryCount(data.filters.resultCount),papers=rankDiscovery(mergeDiscovery(all),data.filters,data.originalQuery,data.subjectTerms).slice(0,requested);
        result={papers,requested,sources:[...new Set(sources)],warnings:[...new Set(warnings)],sourceReports:reports,queryReports,incomplete:papers.length<requested||reports.some(r=>r.status==='failed'||r.incomplete)};
      }else if(data.filters?.source==='institution'){
        if(!dependencies.searchInstitution)throw Error('Institution search requires the desktop application’s authenticated browser session. Open the installed application to search this source.');
        const previous=acquisitionQueue;let release;acquisitionQueue=new Promise(resolve=>{release=resolve;});
        try{
          await waitQueue(previous,signal);signal?.throwIfAborted();
          const browser=await dependencies.searchInstitution(data,signal);
          if(!Array.isArray(browser?.papers))throw Error('The institution browser did not return readable search records. Open the institution window and check the current results page.');
          const papers=[],warnings=[...(browser.warnings||[])],excluded=new Set(data.exclude||[]),seen=new Set(),seenTitles=new Set();
          if(browser.diagnostics?.warning)warnings.push(browser.diagnostics.warning);
          else if(browser.diagnostics?.partial)warnings.push('Institution pagination stopped before all pages were read; records already found are retained.');
          const diagnostics={browser:browser.diagnostics||null,observed:browser.papers.length,invalid:0,enriched:0,sourceOnly:0,identityConflicts:0,duplicates:0,excluded:0,filtered:{}};
          // The browser supplies candidates; metadata services enrich those
          // exact titles/DOIs only. They do not replace the institution search.
          const candidates=mergeDiscovery(browser.papers).sort((a,b)=>Number(titleKey(b?.title)===titleKey(data.originalQuery))-Number(titleKey(a?.title)===titleKey(data.originalQuery)));
          diagnostics.duplicates=browser.papers.length-candidates.length;
          const metadataDeadline=Date.now()+20000;
          for(const candidate of candidates){
            signal?.throwIfAborted();
            const observed=observedInstitutionRecord(candidate,browser.sourceUrl);
            if(!observed){diagnostics.invalid++;continue;}
            let metadata;
            if(Date.now()<metadataDeadline&&scholarly.lookup)try{metadata=await scholarly.lookup({doi:observed.doi,title:observed.title,fast:true},AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,Math.min(8000,metadataDeadline-Date.now())))].filter(Boolean)));}catch{signal?.throwIfAborted();}
            const merged=enrichInstitutionRecord(observed,metadata),paper={...merged.paper,searchSource:'Institution browser',searchMatches:candidate.searchMatches||[],recordId:randomUUID(),exactTitleMatch:titleKey(observed.title)===titleKey(data.originalQuery)};
            diagnostics[merged.enriched?'enriched':'sourceOnly']++;
            if(merged.identityConflict)diagnostics.identityConflicts++;
            const reason=data.subjectTerms?.length&&!paper.exactTitleMatch&&!topicMatch(paper,data.subjectTerms)?'topic':institutionFilterReason(paper,data.filters);
            if(reason){diagnostics.filtered[reason]=(diagnostics.filtered[reason]||0)+1;continue;}
            if(excluded.has(paper.doi)||excluded.has(paper.openAlexId)||excluded.has(titleKey(paper.title))){diagnostics.excluded++;continue;}
            const key=cleanDoi(paper.doi)||paper.sourceUrl,title=titleKey(paper.title);
            if(seen.has(key)||seenTitles.has(title)){diagnostics.duplicates++;continue;}
            seen.add(key);seenTitles.add(title);papers.push(paper);
          }
          if(diagnostics.filtered.topic)warnings.push('Some institution records were excluded because their title and available abstract did not match the core subject.');
          if(diagnostics.sourceOnly)warnings.push('Institution source records are retained; unavailable supplementary metadata and citation counts remain unknown.');
          if(diagnostics.identityConflicts)warnings.push('Supplementary metadata for a different paper was ignored; the institution source record and its access route were preserved.');
          if(diagnostics.filtered.unknownYear||diagnostics.filtered.unknownLanguage||diagnostics.filtered.unknownType)warnings.push('Some source records lack a year, language or article type needed to verify the selected filters. Open the source record or broaden the filters.');
          if(Object.keys(diagnostics.filtered).some(key=>!key.startsWith('unknown')))warnings.push('Some institution results were outside the selected year, language or article-type filters.');
          if(!papers.length&&diagnostics.excluded)warnings.push('Matching institution records already exist in the current project and were excluded from new results.');
          if(!papers.length&&diagnostics.invalid)warnings.push('The institution page contained unreadable result records. Open the institution window to check the current page.');
          papers.splice(0,papers.length,...rankDiscovery(papers,data.filters,data.originalQuery));
          const requested=discoveryCount(data.filters.resultCount);
          result={papers:papers.slice(0,requested),requested,sources:[...new Set((browser.sourceUrls||[browser.sourceUrl]).filter(Boolean).map(url=>'Institution browser: '+new URL(url).hostname))],queryReports:browser.queryReports||[],warnings:[...new Set(warnings)],diagnostics,incomplete:Boolean(browser.diagnostics?.partial)||papers.length<requested};
        }finally{previous.finally(release);}
      }else result=await scholarly.search(data,signal);
      result.sourceReports ||= [{source:data.filters?.source||'open',status:'completed',sources:result.sources,count:result.papers.length,incomplete:result.incomplete}];
      c.discovery=new Map(result.papers.map(p=>[p.recordId,p]));
      const catalog=await catalogReady;
      for(const [id,paper] of c.discovery)catalog.set(id,paper);
      catalogWrite=catalogWrite.catch(()=>{}).then(()=>atomicWrite(catalogPath,JSON.stringify([...catalog])));await catalogWrite;
      return result;
    } finally {c.searchBusy=false;}
  }
  async function acquireWithEngine(c,data,signal) {
    const candidate=c.discovery?.get(data.recordId)||(await catalogReady).get(data.recordId);
    if(!candidate||!data.projectId||!data.nodeId)throw Error('A verified search record and document identity are required.');
    const key=documentKey(data),previous=await readDocument(key);
    if(previous?.originalRelativePath){const bytes=await readFile(path.join(folders.originals,key+'.pdf')).catch(()=>null);if(bytes)return {metadata:previous.metadata||candidate,key,originalRelativePath:previous.originalRelativePath,data:bytes.toString('base64'),type:'application/pdf'};}
    let metadata=candidate, record=await saveDocument({...previous,key,metadata,projectId:data.projectId,nodeId:data.nodeId});
    const started=Date.now();
    let result,error,institutionAttempted=false;
    try{result=await engine.acquire(metadata,signal);}catch(e){signal?.throwIfAborted();error=e.message;}
    metadata=result?.metadata||metadata;
    if(candidate.institutionSearchUrl){metadata={...metadata,sourceUrl:candidate.sourceUrl};for(const key of institutionRouteFields)if(candidate[key]!==undefined)metadata[key]=candidate[key];}
    record={...record,metadata};
    if(!result?.bytes && usesInstitution(data.source)) {
      if(dependencies.acquireInstitution) {
        institutionAttempted=true;
        try {
          const acquired=await dependencies.acquireInstitution({...data,...Object.fromEntries(institutionRouteFields.filter(key=>metadata[key]!==undefined).map(key=>[key,metadata[key]])),url:metadata.institutionRecordUrl||metadata.sourceUrl||`https://doi.org/${metadata.doi}`,doi:metadata.doi,title:metadata.title},signal);
          if(acquired?.data)result={...result,success:true,bytes:Buffer.from(acquired.data,'base64'),source:'Institution session',url:acquired.sourceUrl};
        } catch(e){signal?.throwIfAborted();error=e.message;}
      } else error='Institution authentication is available in the desktop application, not this browser preview. Open-access acquisition was attempted; supply the original or use the installed application.';
    }
    const diagnostics={attempts:result?.attempts||[],elapsedMs:Date.now()-started,institutionAttempted,engine:'LitGraph retrieval core'};
    if(result?.bytes) {
      record=await saveOriginal(key,result.bytes,{...record,downloadedFrom:result.source,sourceUrl:result.url,downloadedAt:new Date().toISOString(),acquisitionEngine:diagnostics.engine,acquisitionAttempts:diagnostics.attempts});
      return {metadata,key,originalRelativePath:record.originalRelativePath,data:result.bytes.toString('base64'),type:'application/pdf',...diagnostics};
    }
    error=error||result?.error||'No accessible original was obtained. Sign in through the institution window or supply the original.';
    await saveDocument({...record,acquisitionAttempts:diagnostics.attempts,acquisitionError:error});
    return {metadata,key,status:usesInstitution(data.source)?'needs_access':result?.status||'unavailable',error,retryable:false,...diagnostics};
  }
  async function runAcquisition(c,data,signal) {
    const key=documentKey(data);
    if(acquiringDocuments.has(key))throw Error('This paper is already being acquired.');
    if((c.acquireCount||0)>=2)throw Error('Two downloads are already running. Wait for a slot.');
    acquiringDocuments.add(key);c.acquireCount=(c.acquireCount||0)+1;
    const previous=acquisitionQueue;let release;acquisitionQueue=new Promise(resolve=>{release=resolve;});
    try{
      // Serialize the complete OA + institution chain across clients. While a
      // browser is waiting for human verification no subsequent source starts.
      await waitQueue(previous,signal);signal?.throwIfAborted();
      return await acquireWithEngine(c,data,signal);
    }finally{previous.finally(release);acquiringDocuments.delete(key);c.acquireCount--;}
  }
  async function rpc(c, name, args) {
    if (name === 'litgraph_connect') {
      if (dependencies.agentRunner?.status().configured) throw Error('LitGraph is using on-demand CLI execution. Disconnect it in Model connection before using manual MCP.');
      if (typeof args.model !== 'string' || !args.model.trim()) throw new Error('必须报告实际模型名称；不知道时填 agent 名称（模型未知）。');
      const model=args.model.trim().slice(0, 120);
      const connectionId=active(c) && c.agent.model===model ? c.agent.connectionId : randomUUID();
      c.agent = { model, vision: args.vision === true, lastSeen: Date.now(), connectionId };
      return { ...status(c), instructions: '连接成功，LitGraph 将自动弹出“外部 Agent 接入成功”提示；无需操作页面或修改源码。保持任务循环：调用 litgraph_next_task，按任务 messages 执行，用 litgraph_submit_result 回传。没有任务不是完成，继续等待，直到用户让你停止。每 5 分钟内至少调用一次工具维持连接。不要伪造检索或模型身份。' };
    }
    if (dependencies.agentRunner?.status().configured) throw Error('On-demand CLI execution is active. Manual MCP task processing is disabled.');
    if (!active(c)) throw new Error('会话已离线，请重新 litgraph_connect。');
    c.agent.lastSeen = Date.now();
    if(name==='litgraph_download_status')return engine.status();
    if(name==='litgraph_scholarly_search')return searchRecords(c,args,AbortSignal.timeout(150000));
    if(name==='litgraph_acquire_start'){
      if(!engine.available())throw Error('The retrieval core is unavailable.');
      if((c.acquireCount||0)>=2)throw Error('Two downloads are already running.');
      if(!c.context?.projectId||args.projectId!==c.context.projectId)throw Error('Acquisition must target the currently open project.');
      const selected=c.context.papers?.find(p=>p.id===args.nodeId);
      const candidate=c.discovery?.get(args.recordId)||(await catalogReady).get(args.recordId);
      const nodeDoi=cleanDoi(selected?.doi),sourceDoi=cleanDoi(candidate?.doi);
      const identityMatches=nodeDoi&&sourceDoi ? nodeDoi===sourceDoi :
        Boolean(selected?.openAlexId&&selected.openAlexId===candidate?.openAlexId || titleKey(selected?.title)&&titleKey(selected.title)===titleKey(candidate?.title));
      if(!selected||!candidate||!identityMatches)throw Error('The verified record must match an existing project paper.');
      const taskId=randomUUID(),controller=new AbortController();c.acquisitions ||= new Map();
      if(c.acquisitions.size>100)for(const [id,t]of c.acquisitions)if(t.state!=='processing')c.acquisitions.delete(id);
      const task={state:'processing',controller};c.acquisitions.set(taskId,task);
      void runAcquisition(c,args,controller.signal).then(value=>{const {data:pdf,...result}=value;task.result={...result,originalSaved:Boolean(pdf),nextAction:pdf?'Continue the application import job to convert and analyze; downloading alone is not analysis.':'Complete institution authentication or supply the original.'};task.state='done';}).catch(error=>{task.state=controller.signal.aborted?'cancelled':'failed';task.error=error.message;});
      return {taskId,state:'processing'};
    }
    if(name==='litgraph_acquire_status'){const task=c.acquisitions?.get(args.taskId);if(!task)throw Error('Unknown acquisition task.');return {state:task.state,result:task.result,error:task.error};}
    if(name==='litgraph_acquire_cancel'){const task=c.acquisitions?.get(args.taskId);if(!task)throw Error('Unknown acquisition task.');task.controller.abort();return {cancelled:true};}
    if (name === 'litgraph_disconnect') { cancelAcquisitions(c);c.agent = null; return { connected: false }; }
    if (name === 'litgraph_context') return c.context || { message: '请在 LitGraph 页面打开项目。' };
    if (name === 'litgraph_next_task') {
      const until = Date.now() + Math.min(25000, Math.max(0, Number(args.wait_ms) || 0));
      do {
        const job = [...c.jobs.values()].find(j => j.state === 'queued' && !j.managed);
        if (job) { job.state = 'processing'; return { id: job.id, messages: job.messages, maxTokens: job.maxTokens, context: job.context }; }
        if (Date.now() < until) await sleep(200);
      } while (Date.now() < until);
      return { waiting: true, instruction: '暂无任务，继续调用 litgraph_next_task 等待。' };
    }
    if (name === 'litgraph_submit_result') {
      const job = c.jobs.get(args.id);
      if (!job || job.managed || job.state !== 'processing') throw new Error('任务不存在、已取消或已完成，不得覆盖。');
      if (typeof args.result !== 'string' || !args.result.trim() || args.result.length > 500000) throw new Error('result 必须是任务要求的完整输出字符串。');
      job.state = 'done'; job.result = args.result; c.agent.lastSeen = Date.now();
      return { accepted: true };
    }
    throw new Error('未知工具');
  }
  let clearing=false,activeMutations=0;
  const middleware=async (req, res, next) => {
    if (!req.url?.startsWith('/__litgraph/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
    if(clearing)return send(409,{error:'Research data is being cleared; reload the application.'});
    const mutating=req.method==='POST'&&/^\/__litgraph\/(?:document|project|acquire|discovery-history)(?:\?|$)/.test(req.url);if(mutating)activeMutations++;
    try {
      // Loopback only; never accept ambient cookies or cross-origin browser requests.
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '') || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: '仅允许本机同源访问' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 62000000) return send(413, { error: '数据过大' }); }
      const data = body ? JSON.parse(body) : {};
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === '/__litgraph/bootstrap' && req.method === 'POST') {
        if(dependencies.connectionFile && clients.size){
          const existing=[...clients.values()][0];existing.lastBrowserSeen=Date.now();
          dependencies.onAgentSession?.(existing.agentToken);
          return send(200,{browserToken:existing.browserToken});
        }
        for (const [key, old] of clients) if (Date.now() - old.lastBrowserSeen > 3600000) clients.delete(key);
        // New page session gets independent credentials and job queue.
        const id = randomUUID();
        const c = { id, browserToken: randomUUID(), agentToken: randomUUID(), agent: null, jobs: new Map(), lastBrowserSeen: Date.now() };
        clients.set(id, c);
        dependencies.onAgentSession?.(c.agentToken);
        return send(200, { browserToken: c.browserToken });
      }
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const c = clientFor(token);
      if (!c) return send(401, { error: '连接已失效，请重新复制接入说明。' });
      if (url.pathname === '/__litgraph/agent' && token === c.agentToken && req.method === 'POST') return send(200, await rpc(c, data.name, data.arguments || {}));
      if (token !== c.browserToken) return send(403, { error: '不允许访问此接口' });
      c.lastBrowserSeen = Date.now();
      const controller=new AbortController();res.once('close',()=>{if(!res.writableEnded)controller.abort();});
      if(url.pathname==='/__litgraph/embeddings'&&req.method==='POST')return send(200,{vectors:await embed(data.texts,data.kind,controller.signal)});
      if(url.pathname==='/__litgraph/vector-index'&&req.method==='POST'){
        if(!embed.index)throw Error('Vector indexing is unavailable');
        if(!['search','enqueue','status','control'].includes(data.operation))throw Error('Invalid index operation');
        if(data.operation==='search'&&(!Array.isArray(data.documents)||data.documents.length>5000||!Array.isArray(data.queries)||data.queries.length>8||data.queries.some(q=>typeof q!=='string'||q.length>4000)))throw Error('Invalid index search');
        if(data.operation==='enqueue'&&(!Array.isArray(data.documents)||data.documents.length>5000))throw Error('Invalid index documents');
        if(data.operation==='control'&&!['pause','resume','retry'].includes(data.action))throw Error('Invalid index action');
        return send(200,await embed.index(data.operation,data,controller.signal));
      }
      if (url.pathname === '/__litgraph/data-folder' && req.method === 'POST') {
        await ensureFolders();
        // Make the current project's legacy originals visible in this folder
        // before opening it; keys are validated by readDocument, never paths.
        if(Array.isArray(data.keys))for(const key of [...new Set(data.keys)].slice(0,5000))await readDocument(key);
        if (dependencies.openDataFolder) await dependencies.openDataFolder(libraryRoot);
        return send(200, { opened: Boolean(dependencies.openDataFolder), path: libraryRoot });
      }
      if (url.pathname === '/__litgraph/discovery-history') {
        if (req.method === 'POST') {
          if (!Array.isArray(data.jobs) || data.jobs.some(j => !j?.id || !j.projectId || !Array.isArray(j.items))) throw new Error('Invalid discovery history.');
          historyWrite = historyWrite.catch(() => {}).then(() => atomicWrite(historyPath, JSON.stringify(data.jobs)));
          await historyWrite;
          return send(200, { saved: true });
        }
        if (req.method === 'GET') {
          await historyWrite;
          const jobs = await readCompatible(historyPath, path.join(dataRoot, 'projects', 'discovery-history.json')).then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
          return send(200, { jobs });
        }
      }
      if(url.pathname==='/__litgraph/metadata'&&req.method==='POST'){
        const metadata=await scholarly.lookup({doi:String(data.doi||'').slice(0,240),title:String(data.title||'').slice(0,500)},AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]));
        return send(200,{metadata});
      }
      if(url.pathname==='/__litgraph/search'&&req.method==='POST'){
        return send(200,await searchRecords(c,data,controller.signal));
      }
      if(url.pathname==='/__litgraph/download-engine'&&req.method==='POST')return send(200,await engine.status());
      if(url.pathname==='/__litgraph/acquire'&&req.method==='POST'){
        return send(200,await runAcquisition(c,data,controller.signal));
      }
      if(url.pathname==='/__litgraph/project'&&req.method==='POST'){
        if(!data.projectId||!Array.isArray(data.project?.nodes))throw new Error('Invalid project snapshot.');
        const previous=projectWrites.get(data.projectId)||Promise.resolve();
        const write=previous.catch(()=>{}).then(async()=>{
        await ensureFolders();
        await atomicWrite(path.join(folders.projects,digest(data.projectId)+'.json'),JSON.stringify(data.project));
        const nodes=data.project.nodes;
        await atomicWrite(path.join(folders.analysis,digest(data.projectId)+'.json'),JSON.stringify({projectId:data.projectId,papers:nodes.map(node=>({id:node.id,title:node.title,analysisStatus:node.analysisStatus,summary:node.summary||node.aiSummary,summaryZh:node.aiSummaryZh,summaryEn:node.aiSummaryEn,claimLabel:node.claimLabel||node.claim,keywords:node.keywords,primaryTheory:node.primaryTheory,analysisCoverage:node.analysisCoverage,analysisWarnings:node.analysisWarnings})),theories:data.project.theories,semanticLinks:data.project.semanticLinks,citationLinks:data.project.citationLinks}));
        await atomicWrite(path.join(folders.vectors,digest(data.projectId)+'.json'),JSON.stringify({projectId:data.projectId,papers:nodes.filter(node=>node.embedding||node.semanticVector||node.vector).map(node=>({id:node.id,embedding:node.embedding||node.semanticVector||node.vector,method:node.semanticVectorMethod})),note:'Only computed vectors are saved. An empty list means no vectors have been generated.'}));
        });
        projectWrites.set(data.projectId,write);
        try { await write; } finally { if(projectWrites.get(data.projectId)===write)projectWrites.delete(data.projectId); }
        return send(200,{saved:true});
      }
      if (url.pathname === '/__litgraph/status') return send(200, status(c));
      if (url.pathname === '/__litgraph/document-state' && req.method === 'POST') {
        const key = data.key || documentKey(data);
        return send(200, await readDocument(key));
      }
      if (url.pathname === '/__litgraph/open-native' && req.method === 'POST') {
        const record = await readDocument(data.key);
        if (!record) throw new Error('Original file unavailable.');
        const extension = record.originalRelativePath ? '.pdf' : record.markdown ? '.md' : '';
        if (!extension) throw new Error('Original file unavailable.');
        const file = path.join(extension === '.pdf' ? folders.originals : folders.markdown, record.key + extension);
        await readFile(file);
        if (!dependencies.openOriginal) return send(200, { opened: false });
        await dependencies.openOriginal(file);
        return send(200, { opened: true });
      }
      if (url.pathname === '/__litgraph/context' && req.method === 'POST') { c.context = data; return send(200, { ok: true }); }
      if (url.pathname === '/__litgraph/instructions' && req.method === 'POST') {
        if (dependencies.agentRunner?.status().configured) throw Error('Disconnect on-demand execution before enabling manual MCP.');
        // Rotate access on every explicit copy; old MCP registrations cannot keep access.
        if(!dependencies.connectionFile){c.agentToken = randomUUID(); c.agent = null;}
        dependencies.onAgentAuthorize?.(c.agentToken);
        const guide = dependencies.guide || path.join(root, 'docs', 'LITGRAPH_AGENT_GUIDE.md');
      return send(200, { root: dataRoot, installRoot: dependencies.installRoot || root, node: dependencies.nodeCommand || process.execPath, argsPrefix: dependencies.argsPrefix, env: dependencies.nodeEnv, connectionFile:dependencies.connectionFile, script: path.join(root, 'scripts', 'litgraph-mcp.mjs'), url: `http://${req.headers.host}`, token: c.agentToken, guide, contracts: { discovery: path.join(path.dirname(guide), 'literature-discovery-agent-spec.md'), research: path.join(path.dirname(guide), 'research-space-rag-agent-spec.md'), downloads:path.join(path.dirname(guide),'scansci-integration.md') } });
      }
      if (url.pathname === '/__litgraph/disconnect' && req.method === 'POST') { await dependencies.agentRunner?.disconnect();cancelAcquisitions(c);c.agentToken = randomUUID(); c.agent = null; for(const job of c.jobs.values())job.controller?.abort();c.jobs.clear(); dependencies.onAgentRevoke?.();return send(200, { ok: true }); }
      if (url.pathname === '/__litgraph/tasks' && req.method === 'POST') {
        const managed = dependencies.agentRunner?.status().configured === true;
        if (!managed && !active(c)) return send(409, { error: '外部 Agent 已离线，请连接桌面端按需调用，或恢复手动 MCP 任务循环。' });
        if (!Array.isArray(data.messages)) throw new Error('缺少 messages');
        if (data.requestId && !/^[a-f\d-]{36}$/i.test(data.requestId)) throw Error('Invalid task ID.');
        const id = data.requestId || randomUUID();
        const fingerprint = digest(JSON.stringify([data.messages, data.maxTokens, data.researchMode]));
        if (c.cancelledRequests?.has(id)) return send(409, { error: 'Agent task cancelled.' });
        if (c.jobs.has(id)) {
          if (c.jobs.get(id).fingerprint !== fingerprint) throw Error('Task ID already used.');
          return send(200, { id });
        }
        if ([...c.jobs.values()].filter(j => ['queued','processing'].includes(j.state)).length >= 8) throw new Error('等待中的任务过多，请先完成或取消现有任务。');
        const job = { id, fingerprint, state: 'queued', messages: data.messages, maxTokens: data.maxTokens, context: c.context, created: Date.now(), managed, controller: new AbortController() };
        c.jobs.set(id, job);
        if (managed) {
          void Promise.resolve().then(() => dependencies.agentRunner.submit(job.messages, job.maxTokens, job.controller.signal, () => { job.state = 'processing'; }, data.researchMode,partial=>{if(!job.controller.signal.aborted)job.partial=partial;}))
            .then(result => { if (!job.controller.signal.aborted) { job.state = 'done'; job.result = result; } })
            .catch(error => { job.state = job.controller.signal.aborted ? 'cancelled' : 'failed'; job.error = error.message; });
        }
        for (const [key, old] of c.jobs) if (Date.now() - old.created > 1800000) { old.controller?.abort(); c.jobs.delete(key); }
        return send(200, { id });
      }
      if (url.pathname.startsWith('/__litgraph/tasks/')) {
        const id = url.pathname.split('/').at(-1), job = c.jobs.get(id);
        if (req.method === 'DELETE') {
          job?.controller?.abort();c.jobs.delete(id);
          if (/^[a-f\d-]{36}$/i.test(id)) { c.cancelledRequests ||= new Map();c.cancelledRequests.set(id, Date.now());for (const [key, time] of c.cancelledRequests) if (Date.now() - time > 1800000 || c.cancelledRequests.size > 1000) c.cancelledRequests.delete(key); }
          return send(200, { cancelled: true });
        }
        if (!job) return send(404, { error: '任务已取消或失效' });
        return send(200, { state: job.state, result: job.result, error: job.error,partial:job.partial });
      }
      if (url.pathname === '/__litgraph/document' && req.method === 'POST') {
        if (data.markdown || data.originalData) {
          const key=documentKey(data);
          const previous=await readDocument(key);
          let record = { ...previous, key, projectId: data.projectId, nodeId: data.nodeId, markdown: data.markdown ? String(data.markdown) : previous?.markdown, fileName: String(data.fileName || 'source.md'), sourceKind: data.sourceKind || 'markdown',conversionQuality:data.conversionQuality||'text_extraction',pageCount:data.pageCount||null };
          if(data.paperMetadata)record.paperMetadata={title:String(data.paperMetadata.title||'').slice(0,2000),authors:Array.isArray(data.paperMetadata.authors)?data.paperMetadata.authors.filter(x=>typeof x==='string').slice(0,200):[],year:data.paperMetadata.year,doi:String(data.paperMetadata.doi||'').slice(0,500)};
          if(data.replaceOriginal===true && data.originalData){delete record.markdown;delete record.markdownRelativePath;delete record.localMarkdownPath;delete record.metadata;}
          if(data.originalData)return send(200,await saveOriginal(key,Buffer.from(data.originalData,'base64'),record));
          return send(200, await saveDocument(record));
        }
        if (data.key && /^[a-f0-9]{64}$/.test(data.key)) {const record=await readDocument(data.key);return send(200,record?.markdown?record:null);}
        return send(200, await sampleSource(data.node || {}));
      }
      if (url.pathname === '/__litgraph/original' && req.method === 'POST') {
        if(data.key&&/^[a-f0-9]{64}$/.test(data.key)){
          const record=await readDocument(data.key);
          const bytes=record?.originalRelativePath ? await readFile(path.join(folders.originals,data.key+'.pdf')).catch(()=>null) : null;
          return send(200,bytes&&bytes.length<=40*1024*1024?{data:bytes.toString('base64'),type:'application/pdf'}:null);
        }
        const sample = await readSample();
        const node = sample.nodes.find(n => n.id === data.id && n.title === data.title);
        if (!node?.localPdfPath) return send(200, null);
        const bytes = await readFile(node.localPdfPath).catch(() => null);
        if (!bytes || bytes.length > 40 * 1024 * 1024) return send(200, null);
        return send(200, { data: bytes.toString('base64'), type: 'application/pdf' });
      }
      send(404, { error: '接口不存在' });
    } catch (error) { send(400, { error: error.message }); }finally{if(mutating)activeMutations--;}
  };
  middleware.prepareDataClear=async()=>{
    if(activeMutations||acquiringDocuments.size||[...clients.values()].some(c=>[...c.jobs.values()].some(j=>['queued','processing'].includes(j.state))))throw Error('Please finish or cancel active tasks before clearing data.');
    clearing=true;await Promise.allSettled([...projectWrites.values(),historyWrite,catalogWrite]);await embed.close?.();
  };
  middleware.finishDataClear=()=>{foldersReady=null;clearing=false;clients.clear();void catalogReady.then(c=>c.clear());};
  return middleware;
}
