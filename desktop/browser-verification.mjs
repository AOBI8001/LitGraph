import {browserAccessState} from './browser-access.mjs';

export const MANUAL_VERIFICATION_TIMEOUT_MS=120000;
export const verificationFailure=code=>Object.assign(Error(code==='institution_page_blocked'
  ?'Institution page blocked; skipped this paper. Saved files are retained.'
  :'Institution verification timed out; skipped this paper. Saved files are retained.'),{code,retryable:false});

// Timeout ends only this item, never the batch's AbortSignal. Authentication
// remains manual; a completed load is inspected solely for explicit denial.
export async function waitForManualVerification({state,contents,signal,timeoutMs=MANUAL_VERIFICATION_TIMEOUT_MS,onWait,read=()=>contents.executeJavaScript('('+verificationPageSnapshot.toString()+')()')}){
  signal?.throwIfAborted();
  if(state==='blocked')throw verificationFailure('institution_page_blocked');
  return new Promise((resolve,reject)=>{
    let settled=false,reading=false;
    const finish=error=>{
      if(settled)return;settled=true;clearTimeout(timer);
      signal?.removeEventListener('abort',abort);contents?.removeListener('did-finish-load',inspectDenial);
      error?reject(error):resolve();
    };
    const abort=()=>finish(signal.reason);
    const inspectDenial=async()=>{
      if(settled||reading||contents.isDestroyed())return;reading=true;
      try{const page=await read();if(!settled&&browserAccessState(page.html,page.url,page)==='blocked')finish(verificationFailure('institution_page_blocked'));}
      catch{}finally{reading=false;}
    };
    const timer=setTimeout(()=>finish(verificationFailure('institution_verification_timeout')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});contents?.on('did-finish-load',inspectDenial);
    try{onWait(()=>finish());}catch(error){finish(error);}
  });
}

// Called only after the user explicitly saves. A transient blank document
// between challenge redirects is not proof of successful authentication.
export function verificationPageSnapshot(){
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';};
  return {html:document.documentElement?.outerHTML||'',url:location.href,readyState:document.readyState,
    text:document.body?.innerText?.trim()||'',
    hasVisiblePassword:[...document.querySelectorAll('input[type="password"]')].some(visible),
    hasVisibleChallenge:[...document.querySelectorAll('.g-recaptcha,.h-captcha,.cf-turnstile,iframe[src*="challenges.cloudflare.com"],iframe[src*="hcaptcha.com"],iframe[src*="recaptcha/api"]')].some(visible)};
}
export function isVerifiedDocument(page){
  return /^https?:/.test(page?.url||'')&&page.readyState!=='loading'&&
    Boolean(page.text?.length||/name=["']citation_(?:title|doi)["']/i.test(page.html||''))&&
    browserAccessState(page.html,page.url,page)==='page';
}
export async function confirmStableVerification(contents,{read=()=>contents.executeJavaScript('('+verificationPageSnapshot.toString()+')()'),pause=ms=>new Promise(r=>setTimeout(r,ms)),intervalMs=500}={}){
  let firstUrl='';
  for(let i=0;i<3;i++){
    if(contents.isDestroyed()||contents.isLoadingMainFrame())return false;
    let timer;
    const page=await Promise.race([read().catch(()=>null),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),2000);})]).finally(()=>clearTimeout(timer));
    if(!isVerifiedDocument(page)||(firstUrl&&page.url!==firstUrl))return false;
    firstUrl=page.url;
    if(i<2)await pause(intervalMs);
  }
  return !contents.isDestroyed()&&!contents.isLoadingMainFrame();
}
