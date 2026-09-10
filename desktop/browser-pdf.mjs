import { WebContentsView } from 'electron';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { isCompletePdf } from '../scripts/acquisition-core.js';
import { publisherPdfCandidates, isArticlePdfCandidate } from './publisher-routes.mjs';
import { browserAccessState } from './browser-access.mjs';
import { institutionFullTextSnapshot, clickInstitutionFullTextControl } from './institution-fulltext.mjs';

// ScanSci's response -> page PDF discovery -> publisher route -> PDF control
// cascade, adapted to LitGraph's OWN persistent Electron session. Descendant
// popups belong to the same task. No separate browser or exported credentials.
function snapshot(){
  const visible=e=>e.getClientRects().length&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden';
  return {html:document.documentElement?.outerHTML||'',url:location.href,readyState:document.readyState,doi:document.querySelector('meta[name="citation_doi"],meta[name="dc.identifier"]')?.content||'',title:document.querySelector('meta[name="citation_title"]')?.content||'',hasVisiblePassword:[...document.querySelectorAll('input[type="password"]')].some(visible),hasVisibleChallenge:[...document.querySelectorAll('.g-recaptcha,.h-captcha,.cf-turnstile,iframe[src*="challenges.cloudflare.com"],iframe[src*="hcaptcha.com"],iframe[src*="recaptcha/api"]')].some(visible)};
}
function clickPdfControl(){
  const candidates=[...document.querySelectorAll('a,button,[role="button"]')].filter(e=>{
    const label=(e.getAttribute('aria-label')||e.textContent||'').replace(/\s+/g,' ').trim();
    const tagged=e.matches('.pdf-download-btn-link,[data-aa-name="download-pdf"],[data-test="pdf-link"]')||
      (e.id==='download'&&document.querySelector('#viewer,.pdfViewer'));
    return !e.disabled&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('form')&&
      !/supplement|supporting|preview|purchase|buy|subscribe|sign in|login|验证码|登录|购买/i.test(label)&&
      (tagged||/^(?:(?:download|view|open|read|下载|查看|阅读)\s*)?(?:full[ -]?text\s*)?PDF(?:\s*\([\d.]+\s*[KMG]?B\))?$/i.test(label))&&
      !e.hasAttribute('data-litgraph-clicked');
  });
  if(candidates.length!==1)return false;
  const element=candidates[0];
  if(element.tagName==='A'&&element.href&&!/^(https?:|blob:)/.test(element.href))return false;
  element.setAttribute('data-litgraph-clicked','1');
  element.click();return true;
}
export async function browserPdf({session,url,signal,normalize,automatedContents,doi='',title='',renderer:providedRenderer,onVerification,subscribePopups=()=>()=>{},timeoutMs=12000}){
  const limit=40*1024*1024,deadline=new AbortController();
  let remaining=timeoutMs,armedAt=0,timer;
  const arm=()=>{armedAt=Date.now();timer=setTimeout(()=>deadline.abort(new DOMException('Institution acquisition timed out.','TimeoutError')),remaining);};
  const pauseBudget=()=>{clearTimeout(timer);remaining=Math.max(1,remaining-(Date.now()-armedAt));};
  arm();signal=AbortSignal.any([signal,deadline.signal]);
  const renderer=providedRenderer||new WebContentsView({webPreferences:{session,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false}});
  const temporary=await mkdtemp(path.join(os.tmpdir(),'litgraph-paper-'));
  const pages=new Map(),transfers=new Set(),tasks=new Set(),visited=new Set([url]),followedFullText=new Set();
  let result,last,invalidPdf=false,activity=Date.now(),sequence=0,unsubscribe=()=>{},humanHandoff=false;
  let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});aborted.catch(()=>{});
  const key=value=>String(value||'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').trim().toLowerCase();
  const titleKey=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  // Electron executeJavaScript can wait for all page resources. A publisher's
  // stalled ad/metrics request must not hold up an already usable article DOM.
  const evaluate=async(contents,fn,userGesture=false,input)=>{
    const value=await Promise.race([contents.debugger.sendCommand('Runtime.evaluate',{expression:'('+fn.toString()+')('+(input===undefined?'':JSON.stringify(input))+')',returnByValue:true,userGesture}),aborted]);
    if(value.exceptionDetails)throw Error('The publisher page is still navigating.');
    return value.result.value;
  };
  const track=promise=>{tasks.add(promise);promise.catch(()=>{}).finally(()=>tasks.delete(promise));};
  const matches=(sourceUrl,record)=>isArticlePdfCandidate(sourceUrl,{sourceUrl:url,doi})&&isArticlePdfCandidate(sourceUrl,{sourceUrl:record.identityUrl||url,doi});
  const accept=(bytes,sourceUrl,record)=>{
    const checkedUrl=sourceUrl.startsWith('blob:')?(record.last?.url||url):sourceUrl;
    if(signal.aborted||result||!matches(checkedUrl,record))return;
    if(bytes.length>limit)return;
    if(!isCompletePdf(bytes)){if(bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))invalidPdf=true;return;}
    result={data:bytes.toString('base64'),sourceUrl:sourceUrl.startsWith('blob:')?(record.last?.url||url):sourceUrl,fileName:'institution-paper.pdf'};
  };
  const drain=record=>{
    for(const pending of record.pending){
      // An arbitrary PDF prefetched by HTML is not the requested article.
      // Inspect the article first, then accept declared PDF URLs or a response
      // resulting from its explicit PDF control. Direct PDF navigations have
      // no HTML document to inspect and remain bound to the requested URL.
      const allowed=pending.direct||(record.verified&&(record.allowedPdf.has(pending.sourceUrl)||record.controlActivated));
      if(allowed&&pending.generation===record.generation)accept(pending.bytes,pending.sourceUrl,record);
    }
    record.pending=record.pending.filter(p=>!record.verified&&!p.direct&&p.generation===record.generation);
  };
  const offer=(bytes,sourceUrl,record,direct=false,generation=record.generation)=>{
    if(signal.aborted||result||generation!==record.generation||bytes.length>limit||record.pending.length>=2)return;
    record.pending.push({bytes,sourceUrl,direct,generation});drain(record);
  };
  const onDownload=(_event,item,owner)=>{
    const record=pages.get(owner?.id);if(!record)return;
    if(signal.aborted||(!/\.pdf$/i.test(item.getFilename())&&item.getMimeType()!=='application/pdf')){item.cancel();return;}
    const target=path.join(temporary,(sequence++)+'.pdf'),generation=record.generation;
    const direct=Boolean(record.controlActivated)||(record.navigationAuthorized&&(item.getURLChain?.()||[item.getURL()]).includes(record.navigationUrl));
    transfers.add(item);item.setSavePath(target);activity=Date.now();
    item.on('updated',()=>{activity=Date.now();if(item.getReceivedBytes()>limit||item.getTotalBytes()>limit)item.cancel();});
    let finish;const done=new Promise(resolve=>{finish=resolve;});track(done);
    item.once('done',(_event,state)=>{void(async()=>{
      try{if(state==='completed')offer(await readFile(target),item.getURL(),record,direct,generation);}
      finally{transfers.delete(item);await unlink(target).catch(()=>{});finish();}
    })().catch(()=>finish());});
  };
  function attach(contents,identityUrl=url,navigationUrl=url,navigationAuthorized=true){
    if(pages.has(contents.id)||contents.isDestroyed())return;
    const record={contents,identityUrl,navigationUrl,navigationAuthorized,last:null,loaded:false,status:200,clicked:false,controlActivated:0,returnUrl:'',restored:false,responses:new Map(),candidates:[],attached:false,started:Date.now(),generation:0,verified:false,pending:[],allowedPdf:new Set()};
    pages.set(contents.id,record);automatedContents.add(contents.id);activity=Date.now();
    record.guard=(event,target)=>{try{normalize(target);}catch{event.preventDefault();}};
    record.ready=()=>{record.loaded=true;activity=Date.now();};
    record.start=(_event,_url,inPlace,isMainFrame)=>{if(!isMainFrame||inPlace)return;record.loaded=false;record.status=200;record.generation++;record.verified=false;record.pending=[];activity=Date.now();};
    record.network=(_event,method,params)=>{
      if(method==='Network.responseReceived'){
        const response=params.response;
        if(params.type==='Document'&&params.frameId===record.mainFrameId)record.status=response.status;
        if(response.status>=200&&response.status<300&&/application\/pdf|application\/octet-stream/i.test(response.mimeType)&&record.responses.size<8){
          try{normalize(response.url);if(matches(response.url,record))record.responses.set(params.requestId,{url:response.url,generation:record.generation,direct:params.type==='Document'&&params.frameId===record.mainFrameId&&(record.navigationAuthorized||Boolean(record.controlActivated))});}catch{}
        }
      }else if(method==='Network.loadingFinished'&&record.responses.has(params.requestId)){
        const response=record.responses.get(params.requestId);record.responses.delete(params.requestId);
        if(params.encodedDataLength>limit)return;
        track(contents.debugger.sendCommand('Network.getResponseBody',{requestId:params.requestId}).then(value=>offer(Buffer.from(value.body,value.base64Encoded?'base64':'utf8'),response.url,record,response.direct,response.generation)).catch(()=>{}));
      }else if(method==='Network.loadingFailed')record.responses.delete(params.requestId);
    };
    for(const event of ['will-navigate','will-redirect'])contents.on(event,record.guard);
    contents.on('dom-ready',record.ready);contents.on('did-start-navigation',record.start);
    record.initialized=(async()=>{
      if(contents===renderer.webContents&&!contents.getURL())await Promise.race([contents.loadURL('about:blank'),aborted]);
      if(!humanHandoff)await connect(record);
    })();
    record.initialized.catch(error=>{record.error=error;});
    return record;
  }
  async function connect(record){
    const contents=record.contents;
    if(contents.isDestroyed()||record.attached)return;
    contents.debugger.attach('1.3');record.attached=true;contents.debugger.on('message',record.network);
    await Promise.race([contents.debugger.sendCommand('Network.enable',{maxTotalBufferSize:limit,maxResourceBufferSize:limit}),aborted]);
    record.mainFrameId=(await Promise.race([contents.debugger.sendCommand('Page.getFrameTree'),aborted])).frameTree.frame.id;
  }
  function disconnect(record){
    record.contents.debugger.removeListener('message',record.network);
    if(!record.contents.isDestroyed()&&record.attached&&record.contents.debugger.isAttached())record.contents.debugger.detach();
    record.attached=false;record.responses.clear();
  }
  const stop=()=>{rejectAbort(signal.reason||Error('Browser acquisition finished'));for(const item of transfers)item.cancel();for(const p of pages.values())if(!p.contents.isDestroyed())p.contents.stop();};
  const navigate=(record,target,referrer)=>{
    record.navigationUrl=target;record.navigationAuthorized=true;record.loaded=false;record.error=null;record.clicked=false;record.controlActivated=0;record.verified=false;record.allowedPdf.clear();record.started=Date.now();activity=Date.now();
    void record.contents.loadURL(normalize(target),referrer?{httpReferrer:referrer}:{}).catch(error=>{record.error=error;});
  };
  const restoreArticle=record=>{
    if(!record.returnUrl||record.restored)return false;
    record.restored=true;navigate(record,record.returnUrl);return true;
  };
  session.on('will-download',onDownload);signal.addEventListener('abort',stop,{once:true});
  try{
    signal.throwIfAborted();
    unsubscribe=subscribePopups((contents,opener,target)=>{const parent=pages.get(opener.id);if(parent){parent.acquisitionPopup=contents.id;attach(contents,parent.identityUrl,target||contents.getURL(),Boolean(parent.verified&&parent.controlActivated));}});
    const main=attach(renderer.webContents);await main.initialized;
    if(!providedRenderer)renderer.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    // Reuse the live document on retry; never restart a user's challenge.
    if(providedRenderer&&renderer.webContents.getURL()===normalize(url))main.loaded=true;
    else navigate(main,url);
    while(!signal.aborted){
      if(invalidPdf)throw Error('The source returned an incomplete PDF; it was not saved.');
      if(result)return {...last,pdf:result};
      // Inspect all task descendants: an authentication or PDF popup must not
      // become a separate manual import while its parent task times out.
      let waiting=false;
      for(const record of [...pages.values()].reverse()){
        const contents=record.contents;if(contents.isDestroyed())continue;
        // Once an access/PDF control opens a child, finish that route before
        // considering the parent's other collection links.
        const child=pages.get(record.acquisitionPopup);
        if(child&&!child.contents.isDestroyed())continue;
        if(record.loaded||(contents.isLoadingMainFrame()&&Date.now()-record.started>600)){
          try{record.last=await evaluate(contents,snapshot);last=record.last;}catch{signal.throwIfAborted();continue;}
          const current=record.last,state=browserAccessState(current.html,current.url,current);
          if(['login','interactive','blocked','challenge'].includes(state)){
            if(!onVerification)return {...current,status:record.status};
            pauseBudget();humanHandoff=true;
            // Release instrumentation in ALL task windows before human input.
            // No inspection, navigation or PDF clicks run until explicit resume.
            await Promise.allSettled([...pages.values()].map(p=>p.initialized));
            for(const p of pages.values())disconnect(p);
            await onVerification({state,url:current.url,contents});
            signal.throwIfAborted();humanHandoff=false;
            for(const p of pages.values())await connect(p);
            arm();activity=Date.now();record.status=200;record.clicked=false;waiting=true;break;
          }
          if(doi&&current.doi&&/^10\./.test(key(current.doi))&&key(doi)!==key(current.doi))throw Error('The publisher page DOI does not match the requested paper.');
          if(title&&current.title&&titleKey(title)!==titleKey(current.title)&&!(doi&&key(current.doi)===key(doi)))throw Error('The publisher page title does not match the requested paper.');
          // A matching declared DOI lets a streamed article expose its PDF
          // before unrelated scripts finish. Otherwise wait for DOM readiness.
          if(current.readyState==='loading'&&!(doi&&key(current.doi)===key(doi)))continue;
          if(state==='page'&&!matches(current.url,record))throw Error('The publisher page article identity does not match the requested paper.');
          // A redirect from doi.org establishes the publisher's article identity.
          if(!/\/(?:pdf|pdfft|epdf|pdfdirect|stamp)(?:[/?]|$)|\.pdf(?:[?#]|$)/i.test(current.url)&&state==='page')record.identityUrl=current.url;
          if(record.status<400){
            for(const candidate of publisherPdfCandidates({url:current.url,doi,html:current.html,normalize})){
              record.allowedPdf.add(candidate);
              if(!visited.has(candidate)&&!record.candidates.includes(candidate))record.candidates.push(candidate);
            }
            record.verified=true;drain(record);if(result)continue;
          }
          const next=record.candidates.find(candidate=>!visited.has(candidate));
          if(next&&visited.size<7){
            // Preserve the real article before trying an advertised/derived
            // PDF route. A failed route must not strand us on its error page.
            if(!record.returnUrl&&state==='page'&&record.status<400)record.returnUrl=current.url;
            record.candidates.splice(record.candidates.indexOf(next),1);visited.add(next);
            navigate(record,next,current.url);
            continue;
          }
          if(!record.clicked&&record.status<400&&!tasks.size&&!transfers.size&&Date.now()-record.started>1200){
            record.clicked=true;
            // Mark intent before the click so synchronously created popups
            // inherit this task's validated article context.
            record.controlActivated=Date.now();
            if(await evaluate(contents,clickPdfControl,true).catch(()=>false)){activity=Date.now();drain(record);}
            else record.controlActivated=0;
          }
          // Library records and link resolvers expose the authenticated route
          // to the publisher as an access link, often a JS button / popup. Use
          // that observed control before giving up. Each bounded click remains
          // in this browser task and therefore keeps its current session.
          if(record.clicked&&!record.controlActivated&&record.status<400&&!tasks.size&&!transfers.size&&followedFullText.size<8){
            const controls=await evaluate(contents,institutionFullTextSnapshot).catch(()=>[]);
            const control=controls?.find(candidate=>{
              if(followedFullText.has(candidate.key))return false;
              if(!candidate.url)return true;
              try{return Boolean(normalize(candidate.url))&&matches(candidate.url,record);}catch{return false;}
            });
            if(control){
              followedFullText.add(control.key);
              record.controlActivated=Date.now();
              if(await evaluate(contents,clickInstitutionFullTextControl,true,control).catch(()=>false)){
                record.clicked=false;record.returnUrl='';record.restored=false;record.candidates=[];record.started=Date.now();activity=Date.now();
                // An in-page expansion need not navigate. Permit a newly
                // revealed access/PDF control once it has had time to render.
                drain(record);continue;
              }
              record.controlActivated=0;
            }
          }
          if(record.returnUrl&&current.url!==record.returnUrl&&!tasks.size&&!transfers.size&&
            (!record.controlActivated||Date.now()-record.controlActivated>1500)&&restoreArticle(record))continue;
        }else if(record.error&&!transfers.size&&Date.now()-record.started>1800){
          const next=record.candidates.find(candidate=>!visited.has(candidate));
          if(next&&visited.size<7){visited.add(next);navigate(record,next,record.returnUrl);continue;}
          if(restoreArticle(record))continue;
          if(pages.size===1)throw record.error;
        }
      }
      if(waiting)continue;
      if(result)continue;
      const loading=[...pages.values()].some(p=>!p.contents.isDestroyed()&&p.contents.isLoadingMainFrame());
      if(Date.now()-activity>5000&&!loading&&!tasks.size&&!transfers.size)return {...last,status:[...pages.values()].at(-1)?.status||200};
      await new Promise(resolve=>setTimeout(resolve,120));
    }
    signal.throwIfAborted();
  }finally{
    clearTimeout(timer);unsubscribe();signal.removeEventListener('abort',stop);stop();session.removeListener('will-download',onDownload);
    for(const [id,record] of pages){
      const c=record.contents;automatedContents.delete(id);
      if(c.isDestroyed())continue;
      c.removeListener('dom-ready',record.ready);c.removeListener('did-start-navigation',record.start);
      for(const event of ['will-navigate','will-redirect'])c.removeListener(event,record.guard);
      c.debugger.removeListener('message',record.network);if(record.attached&&c.debugger.isAttached())c.debugger.detach();
    }
    if(!providedRenderer&&!renderer.webContents.isDestroyed())renderer.webContents.close();
    await Promise.race([Promise.allSettled([...tasks]).then(()=>rmdir(temporary).catch(()=>{})),new Promise(resolve=>setTimeout(resolve,500))]);
  }
}
