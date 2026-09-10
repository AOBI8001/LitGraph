import assert from 'node:assert/strict';
import {scholarlyService,fromOpenAlex,fromCrossref,mergeMetadata,pdfLinksFromHtml,acquisitionError} from './scholarly-service.js';
import {publicAddress,publicFetch} from './public-fetch.js';
for(const ip of ['127.0.0.1','10.1.0.2','169.254.169.254','172.20.1.1','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(publicAddress(ip),false);
assert.ok(publicAddress('8.8.8.8'));await assert.rejects(()=>publicFetch('https://127.0.0.1/x'));await assert.rejects(()=>publicFetch('http://example.org'));
const fixture=i=>({id:`https://openalex.org/W${i}`,doi:`https://doi.org/10.1234/${i}`,title:`Test ${i}`,publication_year:2024,authorships:[{author:{display_name:'A'}},{author:{display_name:'B'}}],language:'en',type:'article',open_access:{is_oa:true},best_oa_location:{is_oa:true,pdf_url:'https://example.org/p.pdf'},primary_location:{landing_page_url:'https://example.org/p'},referenced_works:['https://openalex.org/W9'],abstract_inverted_index:{Source:[0],abstract:[1]},cited_by_count:i===1?0:undefined});
const a=fromOpenAlex(fixture(1)),b=fromOpenAlex(fixture(2));assert.equal(a.citations,0);assert.equal(b.citations,null);assert.equal(a.abstract,'Source abstract');assert.equal(a.authors.length,2);
const c=fromCrossref({DOI:'10.1234/1',title:['Test 1'],author:[{family:'A'}],published:{'date-parts':[[2024]]},reference:[{DOI:'10.1234/9'}],'is-referenced-by-count':999});
assert.equal(mergeMetadata(a,c).citations,0);assert.deepEqual(mergeMetadata(a,c).referenceDois,['10.1234/9']);
const filled=mergeMetadata(b,c);assert.equal(filled.citations,999);assert.equal(filled.citationSource,'Crossref');assert.equal(filled.citationRetrievedAt,c.citationRetrievedAt);
const crossrefOA=fromCrossref({DOI:'10.1234/open',license:[{URL:'https://creativecommons.org/licenses/by/4.0/','content-version':'vor',start:{timestamp:1}}],link:[{URL:'https://example.org/p.pdf','content-type':'application/pdf','intended-application':'text-mining'}],resource:{primary:{URL:'https://example.org/p'}}});
assert.equal(crossrefOA.isOpenAccess,true);assert.equal(crossrefOA.pdfUrl,'https://example.org/p.pdf');assert.ok(crossrefOA.oaLandingUrls.includes('https://example.org/p'));
assert.equal(fromCrossref({license:[{URL:'https://creativecommons.org/licenses/by/4.0/',start:{timestamp:Date.now()+86400000}}]}).isOpenAccess,false);
let calls=0;
const service=scholarlyService({json:async address=>{calls++;const url=new URL(address);assert.equal(url.hostname,'api.openalex.org');return {results:Array.from({length:50},(_,i)=>fixture(i+1+(url.searchParams.get('cursor')==='*'?0:50))),meta:{next_cursor:url.searchParams.get('cursor')==='*'?'next':null}};}});
const f={yearStart:2020,yearEnd:2026,language:'en',articleType:'any',source:'open',resultCount:100,sort:'cited'};
const result=await service.search({queries:['test'],filters:f});assert.equal(result.papers.length,100);assert.equal(calls,2);assert.equal(new Set(result.papers.map(p=>p.doi)).size,100);
await assert.rejects(()=>service.search({queries:['test'],filters:{...f,resultCount:1}}));
await assert.rejects(()=>service.search({queries:['test'],filters:{...f,resultCount:101}}));
const languages=[];
const englishFirstService=scholarlyService({json:async address=>{
 const url=new URL(address);
 if(url.hostname==='api.openalex.org'){
  const english=url.searchParams.get('filter').includes('language:en');languages.push(english?'en':'any');
  return {results:english?[fixture(1),fixture(2)]:[...Array.from({length:3},(_,i)=>({...fixture(i+3),language:'zh',title:'中文文献 '+i})),fixture(1)],meta:{next_cursor:null}};
 }
 return {};
}});
const mixed=await englishFirstService.search({queries:['中文研究问题'],filters:{...f,language:'any',resultCount:5}});
assert.deepEqual(languages,['en','any']);assert.deepEqual(mixed.papers.map(p=>p.language),['en','zh','en','zh','zh']);
assert.equal(new Set(mixed.papers.map(p=>p.doi)).size,5);
const lookupService=scholarlyService({json:async address=>{
 const url=new URL(address);
 if(url.hostname==='api.openalex.org')throw Error('Unavailable');
 if(url.hostname==='api.crossref.org')return {message:{DOI:'10.1234/lookup',title:['Verified title'],author:[{given:'A',family:'Example'},{given:'B',family:'Example'}],published:{'date-parts':[[2024]]},'is-referenced-by-count':17,reference:[{DOI:'10.1234/peer'}]}};
 return {};
}});
const lookedUp=await lookupService.lookup({doi:'10.1234/lookup',title:'1-s2-filename'});
assert.equal(lookedUp.title,'Verified title');assert.equal(lookedUp.authors.length,2);assert.equal(lookedUp.citations,17);assert.equal(lookedUp.metadataSource,'Crossref');
assert.deepEqual(lookedUp.referenceDois,['10.1234/peer']);
const mismatch=scholarlyService({json:async()=>({results:[fixture(1)]})});
assert.equal(await mismatch.lookup({title:'Unrelated filename'}),null);
assert.deepEqual(pdfLinksFromHtml('<meta content="/download/article.pdf?a=1&amp;b=2" name="citation_pdf_url"><a href="supplement.pdf">supplement</a>','https://example.org/article'),['https://example.org/download/article.pdf?a=1&b=2']);
assert.deepEqual(pdfLinksFromHtml('<a href="reference.pdf">A referenced article</a>','https://example.org/article'),[]);
assert.deepEqual(pdfLinksFromHtml('<a class="pdf" href="/one.pdf">PDF</a><a class="pdf" href="/two.pdf">PDF</a>','https://example.org/article'),[]);
assert.equal(acquisitionError(Object.assign(Error('Source HTTP 403'),{status:403})).code,'access_denied');
assert.equal(acquisitionError(Object.assign(Error('Source HTTP 404'),{status:404})).code,'not_found');
assert.equal(acquisitionError(Object.assign(Error('The operation was aborted'),{name:'AbortError'})).code,'timeout');
const pmc=scholarlyService({fetchSource:async()=>({bytes:Buffer.from('<ListBucketResult><Contents><Key>metadata/PMC123.2.json</Key></Contents><Contents><Key>metadata/PMC123.3.json</Key></Contents></ListBucketResult>')}),json:async address=>address.endsWith('.2.json')?{pmcid:'PMC123',doi:'10.1234/pmc',version:2,is_manuscript:true,license_code:'CC BY',pdf_url:'s3://pmc-oa-opendata/PMC123.2/PMC123.2.pdf'}:{pmcid:'PMC123',doi:'10.1234/pmc',version:3,is_manuscript:false,license_code:'CC BY',pdf_url:'s3://pmc-oa-opendata/PMC123.3/PMC123.3.pdf'}});
const resolved=await pmc.resolveOpenAccess({pmcid:'PMC123',doi:'10.1234/pmc',isOpenAccess:true,pdfUrls:['https://example.org/stale.pdf']});
assert.equal(resolved.pdfUrl,'https://pmc-oa-opendata.s3.amazonaws.com/PMC123.3/PMC123.3.pdf');assert.equal(resolved.fulltextVersion,3);assert.equal(resolved.pdfUrls.length,3);
const noGuess=scholarlyService({fetchSource:async()=>({bytes:Buffer.from('<ListBucketResult/>')}),json:async()=>{throw Error('Must not guess version one');}});
assert.equal((await noGuess.resolveOpenAccess({pmcid:'PMC123'})).pdfUrl,undefined);
console.log('Scholarly sources: cursor pagination, 5–100 validation, provenance, complete authors, references, unknown counts and private-network rejection passed.');
const keepAlive=setTimeout(()=>{},1000);
try {
 let retrieved=0;
 const bounded=scholarlyService({searchBudgetMs:40,searchRequestMs:1000,json:async(_address,{signal})=>{
  if(!retrieved++)return {results:[fixture(1)],meta:{next_cursor:'slow'}};
  await new Promise((_,reject)=>signal.aborted?reject(signal.reason):signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 }});
 const partial=await bounded.search({queries:['test'],filters:{...f,resultCount:5}});
 assert.equal(partial.papers.length,1);assert.equal(partial.incomplete,true);assert.ok(partial.warnings.some(w=>w.includes('time limit')));
 retrieved=0;
 const mixedPartial=await bounded.search({queries:['test'],filters:{...f,language:'any',resultCount:5}});
 assert.equal(mixedPartial.papers.length,1);assert.equal(mixedPartial.papers[0].language,'en');assert.equal(mixedPartial.incomplete,true);
 const controller=new AbortController();controller.abort();
 await assert.rejects(bounded.search({queries:['test'],filters:{...f,resultCount:5}},controller.signal),{name:'AbortError'});
}finally{clearTimeout(keepAlive);}
const fullTitle='Online impulsive buying in social commerce: A mixed-methods research';
const rawQueries=[];
const titleService=scholarlyService({json:async address=>{
 const u=new URL(address);
 if(u.hostname==='api.openalex.org'){
   rawQueries.push(u.searchParams.get('search'));
   if(u.searchParams.get('per-page')==='3')return {results:[{...fixture(99),title:fullTitle,open_access:{is_oa:false},best_oa_location:null}]};
   return {results:[fixture(1)],meta:{}};
 }
 return {};
}});
const exactInstitution=await titleService.search({originalQuery:fullTitle,queries:['unrelated generated keyword'],filters:{...f,resultCount:5,source:'institution',sort:'combined'}});
assert.equal(exactInstitution.papers[0].title,fullTitle);
assert.equal(exactInstitution.papers[0].exactTitleMatch,true);
assert.equal(rawQueries[0],fullTitle);
assert.equal(rawQueries[1],fullTitle);
const exactOA=await titleService.search({originalQuery:fullTitle,queries:['keyword'],filters:{...f,resultCount:5}});
assert.equal(exactOA.papers.some(p=>p.title===fullTitle),false);
assert.ok(exactOA.warnings.some(w=>w.includes('not verified open access')));
const crossrefTitleService=scholarlyService({json:async address=>{
 const u=new URL(address);if(u.hostname==='api.openalex.org')return {results:[]};
 if(u.hostname==='api.crossref.org'){assert.equal(u.searchParams.get('query.title'),fullTitle);return {message:{items:[{DOI:'10.1016/example',title:[fullTitle],author:[{family:'Source author'}],published:{'date-parts':[[2024]]}}]}};}
}});
assert.equal((await crossrefTitleService.lookup({title:fullTitle,fast:true})).title,fullTitle);
console.log('Complete input is searched first; exact restricted titles are prioritized or explained, with Crossref title fallback.');

const searchedQueries=[];
const bilingual=scholarlyService({json:async address=>{
 const u=new URL(address);searchedQueries.push(u.searchParams.get('search'));
 return {results:Array.from({length:5},(_,i)=>fixture(i)),meta:{}};
}});
const bilingualResult=await bilingual.search({queries:['frog behavior','青蛙 行为','frog anatomy','青蛙 解剖'],filters:{...f,resultCount:5}});
assert.deepEqual(searchedQueries,['frog behavior','青蛙 行为','frog anatomy','青蛙 解剖']);
assert.equal(bilingualResult.papers.length,5);
assert.equal(bilingualResult.queryReports.filter(r=>r.status==='completed').length,4);
assert.equal(bilingualResult.papers[0].searchMatches.length,4);

const topicService=scholarlyService({json:async address=>{
 const u=new URL(address);if(u.hostname!=='api.openalex.org')return {};
 return {results:[{...fixture(1),title:'A review of industrial robots'},{...fixture(2),title:'Frog anatomy and locomotion'}],meta:{}};
}});
const topical=await topicService.search({queries:['frog anatomy'],subjectTerms:['frog','青蛙'],filters:{...f,resultCount:5,sort:'combined'}});
assert.equal(topical.papers.length,1);assert.equal(topical.papers[0].title,'Frog anatomy and locomotion');
assert.ok(topical.warnings.some(w=>w.includes('core subject')));
