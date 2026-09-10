import {browserAccessState} from './browser-access.mjs';
import {institutionDomSnapshot, institutionDomAction} from './institution-dom.mjs';

const failure=(code,zh,en)=>Object.assign(Error(zh+' / '+en),{code,retryable:false});
const fingerprint=page=>JSON.stringify([page.papers?.map(p=>[p.sourceUrl,p.title]),page.empty]);
const rowKey=row=>row.contents.id+':'+(row.contextId?.frameTreeNodeId||'main');
function visibleCatalogueFrames(){
  return [...document.querySelectorAll('iframe,frame')].map((frame,index)=>{
    const rect=frame.getBoundingClientRect(),label=[frame.src,frame.title,frame.name,frame.id].join(' ');
    return {index,name:frame.name,visible:frame.getClientRects().length&&rect.width>=240&&rect.height>=160&&getComputedStyle(frame).visibility!=='hidden'&&!frame.closest('[hidden],[aria-hidden="true"]')&&!/doubleclick|googlesyndication|adservice|advertisement|recaptcha|hcaptcha|challenges\.cloudflare/i.test(label)};
  }).filter(frame=>frame.visible).slice(0,8);
}

// Both model modes search in-place in the persistent authenticated browser.
// No cookie export, replacement browser, or silent public-index fallback.
export async function searchInstitutionPage({contents,query,signal=new AbortController().signal,normalize,onVerification,subscribePopups=()=>()=>{},limit=20,timeoutMs=60000}){
  if(!String(query||'').trim())throw failure('institution_query_missing','请输入检索内容。','Enter a search query.');
  let deadline=Date.now()+timeoutMs,unsubscribe=()=>{},activeContents=contents,activeKey=contents.id+':main',waitingMs=0,humanHandoff=false;
  const activeTime=()=>Date.now()-waitingMs;
  const owned=new Map(),found=new Map(),visited=new Set(),diagnostics={pages:0,platforms:[],partial:false};
  const pause=ms=>new Promise((resolve,reject)=>{
    signal.throwIfAborted();const timer=setTimeout(done,ms);
    function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);}
    function done(){signal.removeEventListener('abort',abort);resolve();}
    signal.addEventListener('abort',abort,{once:true});
  });
  const bounded=async promise=>{
    signal.throwIfAborted();let timer,abort;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Institution page is still navigating.')),2500);abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});})]);}
    finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  };
  async function attach(target){
    const existing=owned.get(target.id);
    if(existing&&(humanHandoff||existing.attached))return existing;
    const record=existing||{contents:target,attached:false};owned.set(target.id,record);
    if(humanHandoff){record.ready=Promise.resolve();return record;}
    record.ready=(async()=>{
      if(!target.debugger.isAttached()){target.debugger.attach('1.3');record.attached=true;}
      await bounded(target.debugger.sendCommand('Page.enable'));
    })();
    record.ready.catch(()=>{});return record;
  }
  async function evaluate(target,fn,args,contextId){
    const expression='('+fn.toString()+')('+(args===undefined?'':JSON.stringify(args))+')';
    // WebFrameMain addresses out-of-process cross-origin frames as well. Those
    // cannot always be evaluated through the top document's CDP target.
    if(contextId?.executeJavaScript)return bounded(contextId.executeJavaScript(expression,true));
    const record=await attach(target);await record.ready;
    const response=await bounded(target.debugger.sendCommand('Runtime.evaluate',{
      expression,returnByValue:true,userGesture:true,...(contextId?{contextId}:{})
    }));
    if(response.exceptionDetails||response.result?.value===undefined)throw Error('Institution page changed during inspection.');
    return response.result.value;
  }
  async function snapshots(target){
    const result=[];
    try{result.push({page:await evaluate(target,institutionDomSnapshot),contents:target});}catch{signal.throwIfAborted();return result;}
    // Embedded catalogues keep their real origin and authentication. Each frame
    // is read in place, including cross-origin catalogues; credentials stay put.
    {
      try{
        const eligible=await evaluate(target,visibleCatalogueFrames);
        const frames=target.mainFrame.frames;
        for(const entry of eligible){
          const frame=(entry.name&&frames.find(f=>f.name===entry.name))||frames[entry.index];
          if(!frame||!/^https?:/.test(frame.url))continue;
          try{
            result.push({page:await evaluate(target,institutionDomSnapshot,undefined,frame),contents:target,contextId:frame});
          }catch{signal.throwIfAborted();}
        }
      }catch{signal.throwIfAborted();}
    }
    return result;
  }
  async function inspect(){
    signal.throwIfAborted();
    if(Date.now()>deadline)throw failure('institution_search_timeout','机构网页检索等待超时；请检查页面状态后重试。','Institution search timed out; check the browser page and retry.');
    const rows=[];
    for(const record of [...owned.values()].reverse()){
      if(record.contents.isDestroyed())continue;
      rows.push(...await snapshots(record.contents));
    }
    // An unrelated advertisement/login iframe must not block the selected
    // catalogue. Authentication belongs to the active document/frame only.
    for(const row of rows.filter(row=>rowKey(row)===activeKey)){
      const state=browserAccessState(row.page.html,row.page.url,row.page);
      if(state!=='page'){
        if(!onVerification)throw failure('institution_authentication_required','机构页面需要登录或验证。','Institution login or verification is required.');
        const start=Date.now();humanHandoff=true;
        await Promise.allSettled([...owned.values()].map(record=>record.ready));
        for(const record of owned.values()){
          if(!record.contents.isDestroyed()&&record.attached&&record.contents.debugger.isAttached())record.contents.debugger.detach();
          record.attached=false;
        }
        await onVerification({contents:row.contents,state,url:row.page.url});
        signal.throwIfAborted();humanHandoff=false;
        const waited=Date.now()-start;deadline+=waited;waitingMs+=waited;
        return [];
      }
    }
    return rows;
  }
  async function settled(previous){
    const before=previous?fingerprint(previous.page):'',started=activeTime();let last='',stableAt=activeTime(),sawBusy=false;
    for(;;){
      const rows=await inspect();
      const row=rows.find(r=>rowKey(r)===activeKey);
      if(row){
        const page=row.page,key=fingerprint(page);sawBusy ||= Boolean(page.busy);
        if(key!==last){last=key;stableAt=activeTime();}
        const changed=!previous||rowKey(row)!==rowKey(previous)||page.documentId!==previous.page.documentId||key!==before||page.resultRevision>previous.page.resultRevision;
        // URL and editable search-field changes are not a committed result.
        const accepted=changed||sawBusy;
        if(!page.busy&&accepted&&activeTime()-stableAt>=650&&(page.papers?.length||page.empty))return row;
      }
      if(activeTime()-started>16000){
        if(row?.page.resultCount>0&&!row.page.papers?.length)throw failure('institution_results_unrecognized','机构页面已有结果，但未能识别论文条目；不是没有找到论文。请打开机构页面检查结果格式。','The institution page has results, but its records could not be read. This does not mean no papers were found.');
        throw failure('institution_results_not_ready','未能确认机构网页已返回本次检索结果。请检查机构页面的检索状态；已保留登录会话。','The institution page did not expose confirmed results for this query. Check its search state; the session is retained.');
      }
      await pause(180);
    }
  }
  try{
    await attach(contents);
    unsubscribe=subscribePopups((target,opener)=>{if(owned.has(opener.id)){void attach(target).catch(()=>{});activeContents=target;activeKey=target.id+':main';}});
    let initial;const started=activeTime();
    while(!initial){
      const rows=await inspect();
      const score=row=>(row.page.platform&&row.page.platform!=='generic'?30:0)+(row.page.resultsRecognized?20:0)+(/catalog|discover|literature|publication|journal|article|primo|文献|论文|馆藏/i.test(row.page.search?.label||'')?15:0)+(row.contextId?0:2);
      initial=rows.filter(r=>r.page.search&&!r.page.busy).sort((a,b)=>score(b)-score(a))[0];
      if(!initial&&activeTime()-started>15000)throw failure('institution_search_form_missing','当前机构网页未找到可操作的检索框。请进入图书馆目录或出版商检索页面，再保存状态。','No usable search form was found. Open the library catalogue or publisher search page and save the session.');
      if(!initial)await pause(180);
    }
    activeContents=initial.contents;activeKey=rowKey(initial);
    const submitted=await evaluate(initial.contents,institutionDomAction,{kind:'search',query,token:initial.page.search.token},initial.contextId);
    if(submitted===false||submitted.ok===false)throw failure('institution_search_form_changed','机构检索控件已变化，请重新打开检索页。','The institution search control changed; reopen the search page.');
    let current=await settled(initial);
    const maxPages=Math.min(100,Math.max(2,Math.ceil(limit)+1));
    for(let index=0;index<maxPages;index++){
      const page=current.page;diagnostics.pages++;
      if(page.platform&&!diagnostics.platforms.includes(page.platform))diagnostics.platforms.push(page.platform);
      for(const item of page.papers||[]){
        try{const sourceUrl=normalize(item.sourceUrl);const key=item.doi?.toLowerCase()||sourceUrl;if(!found.has(key))found.set(key,{...item,sourceUrl});}catch{}
      }
      const state=fingerprint(page);visited.add(state);
      if(found.size>=limit||!page.next||page.empty)break;
      const advanced=await evaluate(current.contents,institutionDomAction,{kind:'next',token:page.next.token},current.contextId);
      if(advanced===false||advanced.ok===false){diagnostics.partial=true;break;}
      try{
        const next=await settled(current);
        if(visited.has(fingerprint(next.page))){diagnostics.partial=true;break;}
        current=next;activeContents=next.contents;activeKey=rowKey(next);
      }catch(error){if(signal.aborted)throw error;diagnostics.partial=true;diagnostics.warning=error.message;if(['institution_page_blocked','institution_verification_timeout'].includes(error.code))diagnostics.stopReason=error.code;break;}
      if(index===maxPages-1)diagnostics.partial=true;
    }
    return {papers:[...found.values()].slice(0,limit),sourceUrl:current.page.url,query,diagnostics};
  }finally{
    unsubscribe();
    for(const record of owned.values())if(!record.contents.isDestroyed()){
      record.contents.stop();
      if(record.attached&&record.contents.debugger.isAttached())record.contents.debugger.detach();
    }
  }
}
