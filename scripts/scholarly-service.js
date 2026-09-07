import {randomUUID} from 'node:crypto';
import {publicJson} from './public-fetch.js';
import {cleanDoi,paperKey,matchesDiscovery,discoveryCount,titleKey} from '../src/discovery-contract.js';
const fields='id,doi,title,publication_year,cited_by_count,authorships,referenced_works,abstract_inverted_index,primary_location,best_oa_location,locations,open_access,type,language,biblio';
const count=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.floor(v):null;
const strip=s=>String(s||'').replace(/<\/(?:p|jats:p)>/gi,'\n\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
const url=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
function abstract(index){const words=[];for(const [word,positions]of Object.entries(index||{}))for(const p of positions)if(Number.isInteger(p)&&p>=0&&p<100000)words[p]=word;return words.join(' ').trim();}
function kind(type,title=''){if(/meta[ -]analysis|meta[ -]analys[ei]s|元分析|荟萃分析/i.test(title))return 'meta';return /review/i.test(type)?'review':/conference|proceeding/i.test(type)?'conference':/article|research|journal/i.test(type)?'research':'unknown';}
function stamp(p,source,api){return {...p,metadataSource:source,metadataRetrievedAt:new Date().toISOString(),metadataApiUrl:api,citationSource:p.citations===null?'':source,citationRetrievedAt:p.citations===null?null:new Date().toISOString(),referenceDois:p.referenceDois||[],references:p.references||[],referenceRecords:p.referenceRecords||[]};}
export function fromOpenAlex(w,api=''){
 const locations=[w.best_oa_location,...(w.locations||[]),w.primary_location].filter(Boolean),oa=locations.filter(l=>l.is_oa===true),doi=cleanDoi(w.doi);
 const pdfUrls=[...new Set(oa.map(l=>url(l.pdf_url)).filter(Boolean))];
 return stamp({openAlexId:w.id,doi,title:w.title||'',year:Number(w.publication_year),authors:(w.authorships||[]).map(a=>a.author?.display_name).filter(Boolean),language:w.language||'unknown',articleType:kind(w.type,w.title),abstract:abstract(w.abstract_inverted_index),citations:count(w.cited_by_count),references:w.referenced_works||[],journal:w.primary_location?.source?.display_name||'',volume:w.biblio?.volume||'',issue:w.biblio?.issue||'',pages:[w.biblio?.first_page,w.biblio?.last_page].filter(Boolean).join('-'),sourceUrl:url(w.primary_location?.landing_page_url)|| (doi?`https://doi.org/${doi}`:url(w.id)),pdfUrl:pdfUrls[0]||'',pdfUrls,isOpenAccess:w.open_access?.is_oa===true},'OpenAlex',api);
}
export function fromCrossref(w,api=''){
 const doi=cleanDoi(w.DOI),title=w.title?.[0]||'',referenceRecords=(w.reference||[]).map(r=>({doi:cleanDoi(r.DOI),text:r.unstructured||'',author:r.author||'',year:r.year||'',title:r['article-title']||''}));
 return stamp({doi,title,year:Number((w.published||w.issued)?.['date-parts']?.[0]?.[0]),authors:(w.author||[]).map(a=>a.name||[a.given,a.family].filter(Boolean).join(' ')).filter(Boolean),language:w.language||'unknown',articleType:kind(w.type,title),abstract:strip(w.abstract),citations:count(w['is-referenced-by-count']),referenceDois:referenceRecords.map(r=>r.doi).filter(Boolean),referenceRecords,journal:w['container-title']?.[0]||'',volume:w.volume||'',issue:w.issue||'',pages:w.page||'',sourceUrl:doi?`https://doi.org/${doi}`:url(w.URL),pdfUrl:'',pdfUrls:[],isOpenAccess:false},'Crossref',api);
}
export function fromEuropePMC(w,api=''){
 const links=w.fullTextUrlList?.fullTextUrl||[],pdfUrls=links.filter(l=>l.availability==='Open access'&&l.documentStyle==='pdf').map(l=>url(l.url)).filter(Boolean);
 return stamp({doi:cleanDoi(w.doi),pmcid:w.pmcid||'',title:w.title||'',year:Number(w.pubYear),authors:(w.authorList?.author||[]).map(a=>a.fullName).filter(Boolean),language:({eng:'en',chi:'zh',zho:'zh'})[w.language]||w.language||'unknown',articleType:kind((w.pubTypeList?.pubType||[]).join(' '),w.title),abstract:strip(w.abstractText),citations:count(w.citedByCount),journal:w.journalInfo?.journal?.title||'',volume:w.journalInfo?.volume||'',issue:w.journalInfo?.issue||'',pages:w.pageInfo||'',sourceUrl:w.pmcid?`https://europepmc.org/articles/${w.pmcid}`:`https://europepmc.org/article/${w.source}/${w.id}`,pdfUrl:pdfUrls[0]||'',pdfUrls,isOpenAccess:w.isOpenAccess==='Y'},'Europe PMC',api);
}
export function mergeMetadata(a,b){
 // Never replace a source-specific citation count with a count from another index.
 return {...a,authors:a.authors?.length>=b.authors?.length?a.authors:b.authors,abstract:a.abstract||b.abstract,abstractSource:a.abstract?(a.abstractSource||a.metadataSource):b.metadataSource,volume:a.volume||b.volume,issue:a.issue||b.issue,pages:a.pages||b.pages,referenceDois:[...new Set([...(a.referenceDois||[]),...(b.referenceDois||[])])],referenceRecords:b.referenceRecords?.length?b.referenceRecords:a.referenceRecords,references:[...new Set([...(a.references||[]),...(b.references||[])])],pdfUrls:[...new Set([...(a.pdfUrls||[]),...(b.pdfUrls||[])])],pdfUrl:a.pdfUrl||b.pdfUrl,isOpenAccess:a.isOpenAccess||b.isOpenAccess,metadataSources:[...new Set([...(a.metadataSources||[a.metadataSource]),b.metadataSource])],citations:a.citations??b.citations,citationSource:a.citations==null?b.citationSource:a.citationSource,citationRetrievedAt:a.citations==null?b.citationRetrievedAt:a.citationRetrievedAt};
}
export function scholarlyService({json=publicJson}={}){
 const options={};if(process.env.LITGRAPH_CONTACT_EMAIL)options.mailto=process.env.LITGRAPH_CONTACT_EMAIL;
 async function search({queries,filters,exclude=[]},signal){
  const requested=discoveryCount(filters.resultCount),from=Number(filters.yearStart),to=Number(filters.yearEnd);
  const candidateLimit=Math.min(1000,requested<=100?Math.max(5,requested*2):requested);
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1900||to<from||to>new Date().getFullYear())throw new Error('Invalid publication year range.');
  if(!['any','en','zh'].includes(filters.language)||!['any','research','review','meta','conference'].includes(filters.articleType)||!['open','institution'].includes(filters.source))throw new Error('Invalid discovery filters.');
  const terms=[...new Set((queries||[]).filter(q=>typeof q==='string'&&q.trim()).map(q=>q.trim().slice(0,200)))].slice(0,3);if(!terms.length)throw new Error('Empty search terms.');
  const found=new Map(),excluded=new Set(exclude),warnings=[],sources=new Set();let inspected=0;
  const add=p=>{inspected++;if(!matchesDiscovery(p,filters)||excluded.has(p.doi)||excluded.has(p.openAlexId)||excluded.has(titleKey(p.title)))return;const key=paperKey(p);if(found.has(key))found.set(key,mergeMetadata(found.get(key),p));else found.set(key,{...p,recordId:randomUUID()});};
  for(const q of terms){
   let cursor='*';
   for(let page=0;page<Math.ceil(requested/200)+2&&found.size<requested;page++){
    signal?.throwIfAborted();const f=[`from_publication_date:${from}-01-01`,`to_publication_date:${to}-12-31`];if(filters.language!=='any')f.push(`language:${filters.language}`);if(filters.source==='open')f.push('is_oa:true');
    const params=new URLSearchParams({...options,search:q,filter:f.join(','),per_page:'200',cursor,select:fields,sort:'relevance_score:desc'});if(process.env.OPENALEX_API_KEY)params.set('api_key',process.env.OPENALEX_API_KEY);if(filters.sort==='newest')params.set('sort','publication_date:desc');if(filters.sort==='cited')params.set('sort','cited_by_count:desc');
    const address=`https://api.openalex.org/works?${params}`;
    try{const data=await json(address,{signal});sources.add('OpenAlex');for(const w of data.results||[])add(fromOpenAlex(w,address.replace(/api_key=[^&]*/,'api_key=REDACTED')));const next=data.meta?.next_cursor;if(!next||next===cursor||!data.results?.length)break;cursor=next;}catch(e){signal?.throwIfAborted();warnings.push(`OpenAlex: ${e.message}`);break;}
   }
   if(found.size>=requested)break;
  }
  // Independent scholarly records, not model-generated fallbacks.
  for(const provider of ['Europe PMC','Crossref']){
   if(found.size>=requested)break;
   for(const q of terms){
    let cursor='*';
    for(let page=0;page<Math.ceil(requested/100)+1&&found.size<requested;page++){
     signal?.throwIfAborted();let address;
     if(provider==='Europe PMC'){
      const query=`(${q.replace(/[():]/g,' ')}) FIRST_PDATE:[${from}-01-01 TO ${to}-12-31]${filters.source==='open'?' OPEN_ACCESS:Y':''}${filters.language==='en'?' LANG:eng':filters.language==='zh'?' LANG:chi':''}`;
      address='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+new URLSearchParams({query,format:'json',resultType:'core',pageSize:'100',cursorMark:cursor});
     }else address='https://api.crossref.org/works?'+new URLSearchParams({...options,query:q,filter:`from-pub-date:${from}-01-01,until-pub-date:${to}-12-31`,rows:'100',cursor});
     try{const d=await json(address,{signal});sources.add(provider);const items=provider==='Europe PMC'?d.resultList?.result:d.message?.items;for(const w of items||[])add(provider==='Europe PMC'?fromEuropePMC(w,address):fromCrossref(w,address));const next=provider==='Europe PMC'?d.nextCursorMark:d.message?.['next-cursor'];if(!items?.length||!next||next===cursor)break;cursor=next;}catch(e){signal?.throwIfAborted();warnings.push(`${provider}: ${e.message}`);break;}
    }
    if(found.size>=requested)break;
   }
  }
  if(!sources.size&&warnings.length)throw new Error(warnings.join('; '));
  let papers=[...found.values()];if(filters.sort==='newest')papers.sort((a,b)=>b.year-a.year);if(filters.sort==='cited')papers.sort((a,b)=>(b.citations??-1)-(a.citations??-1));
  return {papers:papers.slice(0,candidateLimit),requested,inspected,sources:[...sources],warnings:[...new Set(warnings)],incomplete:papers.length<requested};
 }
 async function enrich(p,signal){
  let result=p;
  if(p.doi)try{const address=`https://api.crossref.org/works/${encodeURIComponent(p.doi)}`;const d=await json(address,{signal});if(cleanDoi(d.message?.DOI)===cleanDoi(p.doi))result=mergeMetadata(result,fromCrossref(d.message,address));}catch(e){signal?.throwIfAborted();result={...result,metadataWarning:`Crossref: ${e.message}`};}
  if(!result.pdfUrl&&p.doi)try{const address='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+new URLSearchParams({query:`DOI:"${p.doi.replace(/"/g,'')}"`,format:'json',resultType:'core',pageSize:'5'});const data=await json(address,{signal});const w=data.resultList?.result?.find(w=>cleanDoi(w.doi)===p.doi);if(w)result=mergeMetadata(result,fromEuropePMC(w,address));}catch(e){signal?.throwIfAborted();}
  return result;
 }
 return {search,enrich};
}
