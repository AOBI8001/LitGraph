import { BrowserWindow, WebContentsView, session, ipcMain, shell, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isCompletePdf } from '../scripts/acquisition-core.js';
import { browserAccessState } from './browser-access.mjs';
import { confirmStableVerification, waitForManualVerification, MANUAL_VERIFICATION_TIMEOUT_MS } from './browser-verification.mjs';
import { browserPdf } from './browser-pdf.mjs';
import { searchInstitutionPage } from './institution-search.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const LIMIT=40*1024*1024;
const ACQUISITION_TIMEOUT=30000;
const doiKey=value=>String(value||'').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase();
function accessError(message,code='institution_access_required'){
  return Object.assign(Error(message),{code,status:'needs_access',retryable:false});
}
function withinSignal(promise,signal){
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
export function institutionBrowser({dataRoot,testing=false,engine,onDownload=()=>{}}){
  const directory=path.join(dataRoot,'data','incoming');
  const manifest=path.join(directory,'institution-downloads.json');
  const ready=mkdir(directory,{recursive:true});
  let inbox=[],window,view,context={},portal='',message='',language='zh',saving=Promise.resolve();
  const loaded=ready.then(()=>readFile(manifest,'utf8')).then(JSON.parse).then(rows=>{inbox=Array.isArray(rows)?rows.filter(r=>/^[a-f0-9-]{36}$/.test(r.id)):[];}).catch(()=>{});
  const ses=session.fromPartition('persist:litgraph-institution');
  // Use this runtime's real Chromium version without app-specific product
  // tokens. Browser navigation and native PDF requests must use the SAME UA.
  ses.setUserAgent(ses.getUserAgent().replace(/\s+(?:Electron|LitGraph|litgraph)\/[^\s]+/g,''));
  // Chromium does not restore every session cookie on restart. Keep a separate
  // OS-encrypted snapshot; it is never exposed through renderer or MCP APIs.
  const windows=new Map();
  let lastPage='',savedPortal='';
  const navigationPath=path.join(dataRoot,'institution-navigation.encrypted');
  const navigationReady=(async()=>{try{if(safeStorage.isEncryptionAvailable()){const data=JSON.parse(safeStorage.decryptString(await readFile(navigationPath)));lastPage=address(data.lastPage);savedPortal=address(data.portal||lastPage);}}catch{}})();
  let navigationWrite=Promise.resolve();
  const saveNavigation=(contents)=>{
    const selected=contents?.getURL();
    return navigationWrite=navigationWrite.catch(()=>{}).then(async()=>{
    if(selected&&/^https?:/.test(selected)){lastPage=address(selected);savedPortal=portal||lastPage;}
    if(lastPage&&safeStorage.isEncryptionAvailable()){
      const bytes=safeStorage.encryptString(JSON.stringify({lastPage,portal:savedPortal}));
      await writeFile(navigationPath+'.tmp',bytes,{mode:0o600});await rename(navigationPath+'.tmp',navigationPath);
    }
    });
  };
  const cookieSnapshot=path.join(dataRoot,'institution-session.encrypted');
  const cookiesReady=(async()=>{
    if(!safeStorage.isEncryptionAvailable())return;
    try{const saved=JSON.parse(safeStorage.decryptString(await readFile(cookieSnapshot)));
      for(const c of saved){if(c.expirationDate&&c.expirationDate<Date.now()/1000)continue;
        const domain=String(c.domain||'').replace(/^\./,'');
        if(!domain)continue;
        const value={url:`${c.secure?'https':'http'}://${domain}${c.path||'/'}`,name:c.name,value:c.value,path:c.path||'/',secure:c.secure,httpOnly:c.httpOnly,sameSite:c.sameSite};
        if(c.domain.startsWith('.'))value.domain=c.domain;if(c.expirationDate)value.expirationDate=c.expirationDate;
        await ses.cookies.set(value).catch(()=>{});
      }
    }catch{}
  })();
  let cookieWrite=Promise.resolve();
  const persistCookies=()=>cookieWrite=cookieWrite.catch(()=>{}).then(async()=>{
    await cookiesReady;await ses.cookies.flushStore();await ses.flushStorageData();if(!safeStorage.isEncryptionAvailable())return;
    const encrypted=safeStorage.encryptString(JSON.stringify(await ses.cookies.get({})));
    await writeFile(cookieSnapshot+'.tmp',encrypted,{mode:0o600});await rename(cookieSnapshot+'.tmp',cookieSnapshot);await ses.flushStorageData();
  });
  ses.cookies.on('changed',()=>{void persistCookies().catch(()=>{});});
  let automated=false, waitingForUser=null, waitingPage=null, acquisitionTail=Promise.resolve();
  const popupObservers=new Set();
  const popupOpeners=new Map();
  const remoteIds=new Set();
  const automatedContents=new Set();
  const downloadContexts=new Map();
  // During an owned download task, route top-level inline PDFs into Chromium's
  // native download event instead of its PDF-viewer extension. The original
  // authenticated request, redirects and response body remain unchanged.
  ses.webRequest.onHeadersReceived((details,callback)=>{
    const headers=details.responseHeaders||{};
    const type=Object.entries(headers).find(([key])=>key.toLowerCase()==='content-type')?.[1]?.join(';')||'';
    if(!automatedContents.has(details.webContentsId)||details.resourceType!=='mainFrame'||!/^application\/pdf(?:\s*;|$)/i.test(type)){callback({});return;}
    const updated={...headers},key=Object.keys(updated).find(key=>key.toLowerCase()==='content-disposition');
    if(key){updated[key]=updated[key].map(value=>/^inline\b/i.test(value)?value.replace(/^inline\b/i,'attachment'):value);}
    else updated['Content-Disposition']=['attachment'];
    callback({responseHeaders:updated});
  });

  const pending=new Set();
  const zh=(a,b)=>language==='en'?b:a;
  function address(value){
    const url=new URL(value);
    if(url.username||url.password||!['https:','http:'].includes(url.protocol))throw Error('Use an HTTP(S) institution website address.');
    if(!testing&&(/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname)||!url.hostname.includes('.')))throw Error('Use your institution’s public website address.');
    return url.href;
  }
  const persist=()=>{const snapshot=JSON.stringify(inbox);saving=saving.catch(()=>{}).then(async()=>{await ready;await writeFile(manifest+'.tmp',snapshot,{mode:0o600});await rename(manifest+'.tmp',manifest);});return saving;};
  const report=()=>{for(const record of windows.values()){
    if(record.window.isDestroyed())continue;
    const contents=record.view.webContents;
    record.window.webContents.send('institution:state',{url:contents.getURL()||portal,message,language,project:record.context.projectTitle||'',canGoBack:contents.navigationHistory.canGoBack(),canGoForward:contents.navigationHistory.canGoForward()});
  }};
  function note(value){message=value;report();}
  async function retain(bytes,fileName,identity,sourceUrl){
    if(!isCompletePdf(bytes))throw Error(zh('下载的 PDF 不完整或格式无效（最大 40 MB），未保存。','The downloaded PDF is incomplete or invalid (maximum 40 MB) and was not saved.'));
    await loaded;
    const id=randomUUID();
    await writeFile(path.join(directory,id+'.pdf'),bytes,{mode:0o600});
    inbox.push({id,fileName:path.basename(fileName||'institution-paper.pdf').replace(/[^\p{L}\p{N} ._()-]/gu,'_').replace(/\.pdf$/i,'')+'.pdf',context:identity,sourceUrl,createdAt:new Date().toISOString()});
    await persist();
    onDownload();
    note(zh('PDF 已保存，LitGraph 将接收并继续转换与分析。','PDF saved. LitGraph will receive it and continue conversion and analysis.'));
  }
  const permitted=permission=>testing&&['local-network','local-network-access','loopback-network'].includes(permission);
  ses.setPermissionRequestHandler((_contents,permission,callback)=>callback(permitted(permission)));
  ses.setPermissionCheckHandler((_contents,permission)=>permitted(permission));
  ses.on('will-download',(_event,item,contents)=>{
    if(automatedContents.has(contents?.id))return;
    if(!remoteIds.has(contents?.id)){item.cancel();return;}
    const identity={...(downloadContexts.get(contents.id)||{})};
    const fileName=item.getFilename();
    if(!/\.pdf$/i.test(fileName)&&item.getMimeType()!=='application/pdf'){item.cancel();note(zh('仅接收论文 PDF；其他文件不会自动保存。','Only paper PDFs are accepted; other files are not saved.'));return;}
    const temporary=path.join(directory,randomUUID()+'.part');
    item.setSavePath(temporary);pending.add(item);
    item.on('updated',()=>{if(item.getReceivedBytes()>LIMIT||item.getTotalBytes()>LIMIT)item.cancel();else note(zh('正在接收 PDF…','Receiving PDF…'));});
    item.once('done',async(_event,state)=>{
      pending.delete(item);
      try{if(state!=='completed')throw Error(zh('下载未完成，请检查认证或网络后重新点击下载。','Download incomplete. Check authentication or connection, then click download again.'));
        await retain(await readFile(temporary),fileName,identity,item.getURL());
      }catch(error){note(error.message);}
      // Temporary files belong solely to this download; finished originals remain in incoming.
      const {unlink}=await import('node:fs/promises');await unlink(temporary).catch(()=>{});
    });
  });
  function secureRemote(contents,sourceContext=context){
    downloadContexts.set(contents.id,{...sourceContext});
    remoteIds.add(contents.id);contents.once('destroyed',()=>{
      remoteIds.delete(contents.id);downloadContexts.delete(contents.id);popupOpeners.delete(contents.id);
      for(const [childId,opener] of popupOpeners)if(opener===contents)popupOpeners.delete(childId);
    });
    // Named window.open targets can reuse a live authentication / PDF popup.
    // Re-associate that navigation synchronously, before its download event, so
    // it belongs to the new parent task rather than the old manual-import inbox.
    const notifyPopupNavigation=url=>{
      const opener=popupOpeners.get(contents.id);
      if(!opener||opener.isDestroyed()||(automated&&!automatedContents.has(opener.id)))return;
      try{if(url!=='about:blank')address(url);}catch{return;}
      const nextContext={...(downloadContexts.get(opener.id)||{})};
      downloadContexts.set(contents.id,nextContext);
      for(const record of windows.values())if(record.view.webContents===contents)record.context={...nextContext};
      for(const observer of popupObservers)observer(contents,opener,url);
    };
    contents.on('will-navigate',(event,url)=>{try{address(url);notifyPopupNavigation(url);}catch{event.preventDefault();note(zh('该链接不能在机构窗口中打开。','This link cannot be opened in the institution window.'));}});
    contents.on('did-start-navigation',(_event,url,_inPlace,isMainFrame)=>{if(isMainFrame)notifyPopupNavigation(url);});
    contents.on('will-redirect',(event,url)=>{try{address(url);}catch{event.preventDefault();}});
    contents.setWindowOpenHandler(({url})=>{
      try{if(url!=='about:blank')address(url);return {action:'allow',createWindow:options=>{
        const child=createShell(downloadContexts.get(contents.id)||{},options,!automated);
        popupOpeners.set(child.view.webContents.id,contents);
        for(const observer of popupObservers)observer(child.view.webContents,contents,url);
        return child.view.webContents;
      }};}catch{return {action:'deny'};}
    });

  }
  let closing;
  async function saveAndClose(force=false,selectedContents=view?.webContents) {
    if(automated&&!force){
      if(waitingForUser){
        const resume=waitingForUser;
        const awaitingPage=waitingPage&&!waitingPage.isDestroyed()?waitingPage:view?.webContents;
        const verified=await confirmStableVerification(awaitingPage);
        if(waitingForUser!==resume)return;
        if(!verified){note(zh('仍需完成当前网页认证；下载队列保持暂停。','Authentication is still required; the download queue remains paused.'));return;}
        await saveNavigation(selectedContents);await persistCookies();
        if(waitingForUser!==resume)return;waitingForUser=null;waitingPage=null;
        for(const r of windows.values())r.window.hide();resume();
      }else {await saveNavigation(selectedContents);await persistCookies();for(const r of windows.values())r.window.hide();}
      return;
    }
    if(closing)return closing;
    closing=(async()=>{
      if(!force)await saveNavigation(selectedContents);
      await persistCookies();
      // Like ScanSci's persistent context: Save hides the entire session, not
      // destroys its renderer. This also retains sessionStorage and live SSO state.
      for(const record of [...windows.values()])if(!record.window.isDestroyed()){
        if(force)record.window.destroy();else record.window.hide();
      }
    })().finally(()=>{closing=null;});
    return closing;
  }
  async function clearSession() {
    for(const request of activeRequests.values())request.abort();
    for(const item of pending)item.cancel();
    await saveAndClose(true);await cookiesReady;
    lastPage=savedPortal='';const {unlink}=await import('node:fs/promises');await unlink(navigationPath).catch(()=>{});
    await ses.clearStorageData();await ses.clearAuthCache();await ses.clearCache();
    // Replace the encrypted snapshot with an empty session; retain all papers.
    await persistCookies();
  }
  let clearingCookies;
  function clearBrowserCookies(selected=view?.webContents,allStorage=false){
    if(clearingCookies)return clearingCookies;
    clearingCookies=(async()=>{
      const contents=selected;
      const target=contents?.getURL()||portal;
      for(const request of activeRequests.values())request.abort();
      for(const item of pending)item.cancel();
      for(const record of windows.values())if(record.view.webContents!==contents){record.view.webContents.stop();await record.view.webContents.loadURL('about:blank');}
      // Remove the live page while clearing, so its scripts cannot immediately
      // write the stale cookies back. Other browser storage and research data stay.
      if(contents&&!contents.isDestroyed()){contents.stop();await contents.loadURL('about:blank');}
      await cookiesReady;
      await ses.clearStorageData(allStorage?{}:{storages:['cookies']});
      if(allStorage)await ses.clearAuthCache();

      // Replace the encrypted restart snapshot as well as Chromium's cookie jar.
      await persistCookies();
      note(allStorage?zh('本机机构会话已清除。','Local institution session cleared.'):zh('Cookie 已清理，正在重新打开网页。可能需要重新登录。','Cookies cleared. Reopening the page; you may need to sign in again.'));
      if(contents&&!contents.isDestroyed())await contents.loadURL(address(target)).catch(()=>{});
    })().finally(()=>{clearingCookies=null;});
    return clearingCookies;
  }
  function identity(input){
    return {projectId:String(input.projectId||'').slice(0,160),projectTitle:String(input.projectTitle||'').slice(0,200),nodeId:String(input.nodeId||'').slice(0,160)};
  }
  function createShell(sourceContext={},options={},visible=true){
    const browserWindow=new BrowserWindow({show:visible,width:1160,height:840,minWidth:780,minHeight:560,title:zh('机构访问 · LitGraph','Institution access · LitGraph'),autoHideMenuBar:true,webPreferences:{preload:path.join(here,'institution-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
    browserWindow.setMenu(null);
    const browserView=new WebContentsView({...options.webContents?{webContents:options.webContents}:{},webPreferences:{...options.webPreferences,session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false,preload:undefined}});
    const record={window:browserWindow,view:browserView,context:{...sourceContext}};
    const shellId=browserWindow.webContents.id;windows.set(shellId,record);
    browserWindow.contentView.addChildView(browserView);secureRemote(browserView.webContents,sourceContext);
    const bounds=()=>{const [width,height]=browserWindow.getContentSize();browserView.setBounds({x:0,y:96,width,height:Math.max(1,height-96)});};
    browserWindow.on('resize',bounds);bounds();
    for(const event of ['did-navigate','did-navigate-in-page','did-finish-load'])browserView.webContents.on(event,report);
    browserWindow.on('close',event=>{event.preventDefault();void saveAndClose(false,browserView.webContents).catch(error=>note(error.message));});
    browserWindow.on('closed',()=>{windows.delete(shellId);if(!browserView.webContents.isDestroyed())browserView.webContents.close();if(window===browserWindow){window=null;view=null;}});
    browserView.webContents.once('destroyed',()=>{if(!browserWindow.isDestroyed())browserWindow.destroy();});
    record.ready=browserWindow.loadFile(path.join(here,'institution.html')).then(report);
    return record;
  }
  async function open(input,{navigate=true,show=true}={}){
    if(automated&&navigate&&window&&!window.isDestroyed()){
      const active=[...windows.values()].find(r=>r.view.webContents===waitingPage)?.window||window;
      active.show();active.focus();return {opened:true,waiting:Boolean(waitingForUser)};
    }
    await Promise.all([loaded,cookiesReady,navigationReady]);language=input.language==='en'?'en':'zh';portal=input.blank&&!input.portalUrl&&!savedPortal&&!lastPage?'':address(input.portalUrl||savedPortal||lastPage);context=identity(input);
    if(input.useSaved&&lastPage){const saved=[...windows.values()].find(r=>!r.view.webContents.isDestroyed()&&r.view.webContents.getURL()===lastPage);if(saved){window=saved.window;view=saved.view;}}
    if(!window||window.isDestroyed()){
      const record=createShell(context,{},show);window=record.window;view=record.view;await record.ready;
    }
    note('');
    if(show){window.show();window.focus();}
    for(const record of windows.values())if(record.view===view)record.context={...context};
    downloadContexts.set(view.webContents.id,{...context});
    let target=input.blank&&!portal&&!input.url&&!lastPage?'about:blank':address(input.useSaved&&lastPage?lastPage:input.url||lastPage||portal);
    if(!input.useSaved&&input.url&&input.url!==portal&&engine?.available())try{target=address((await engine.route({portalUrl:input.portalUrl,targetUrl:input.url})).url);}catch{}
    if(navigate&&(!input.useSaved||view.webContents.getURL()!==target))await view.webContents.loadURL(target).catch(()=>{});
    return {opened:true};
  }
  ipcMain.handle('institution:navigate',async(event,action,value)=>{
    const record=windows.get(event.sender.id);
    if(!record||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url!==pathToFileURL(path.join(here,'institution.html')).href)throw Error('Untrusted institution control');
    const contents=record.view.webContents;
    if(['navigate','home','back','forward'].includes(action)){record.context={...record.context,nodeId:''};downloadContexts.set(contents.id,{...record.context});}
    if(action==='navigate')await contents.loadURL(address(value)).catch(()=>{});
    else if(action==='home')await contents.loadURL(portal).catch(()=>{});
    else if(action==='back'&&contents.navigationHistory.canGoBack())contents.navigationHistory.goBack();
    else if(action==='forward'&&contents.navigationHistory.canGoForward())contents.navigationHistory.goForward();
    else if(action==='reload')contents.reload();
    else if(action==='external')await shell.openExternal(address(contents.getURL()));
    else if(action==='save-close')await saveAndClose(false,contents);
    else if(action==='clear-cookies')await clearBrowserCookies(contents);
    else if(action==='logout')await clearBrowserCookies(contents,true);
    else if(action==='state')report();
    return true;
  });
  async function acquire(input,externalSignal){
    const controller=new AbortController();
    const abort=()=>controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort',abort,{once:true});if(externalSignal?.aborted)abort();
    const taskId=String(input.taskId||randomUUID());activeRequests.set(taskId,controller);
    const previous=acquisitionTail;let release;
    acquisitionTail=new Promise(resolve=>{release=resolve;});
    let entered=false,verificationRemaining=testing&&Number.isFinite(input.verificationTimeoutMs)?Math.max(10,input.verificationTimeoutMs):MANUAL_VERIFICATION_TIMEOUT_MS;
    try{
      await withinSignal(previous,controller.signal);entered=true;
      controller.signal.throwIfAborted();
      await withinSignal(open(input,{navigate:false,show:false}),controller.signal);
      automated=true;
      let target=address(input.url);
      // A URL observed in the signed-in catalogue is already its authenticated
      // route (possibly an encoded proxy/OpenURL). Do not wrap or rewrite it.
      const observedRecord=input.institutionRecordUrl&&address(input.institutionRecordUrl)===target;
      if(!observedRecord&&engine?.route&&!(testing&&new URL(target).hostname==='127.0.0.1')){
        const routed=await withinSignal(engine.route({portalUrl:portal,targetUrl:target,method:input.method},controller.signal),controller.signal);
        target=address(routed?.url||target);
      }
      const result=await browserPdf({
        session:ses,url:target,signal:controller.signal,normalize:address,automatedContents,doi:input.doi,title:input.title,
        subscribePopups:observer=>{popupObservers.add(observer);return()=>popupObservers.delete(observer);},
        renderer:view,timeoutMs:testing&&Number.isFinite(input.timeoutMs)?Math.max(100,input.timeoutMs):ACQUISITION_TIMEOUT,
        onVerification:async({contents,state})=>{
          const started=Date.now();
          try{await waitForManualVerification({contents,state,signal:controller.signal,timeoutMs:Math.max(1,verificationRemaining),onWait:resolve=>{
            waitingPage=contents;waitingForUser=resolve;
            note(zh('等待完成网页认证。当前论文人工等待累计最多 2 分钟，超时自动跳过；完成后点击“保存状态并退出”继续。','Waiting for authentication. Up to 2 minutes of manual waiting per paper; on timeout it is skipped. Finish, then select Save session & close.'));
            const visible=[...windows.values()].find(r=>r.view.webContents===contents)?.window||window;
            visible.show();visible.focus();
          }});}catch(error){
            if(controller.signal.aborted)throw error;
            note(zh(error.code==='institution_page_blocked'?'网站已封锁访问，已跳过当前论文。':'人工验证等待超时，已跳过当前论文。',error.message));
            for(const r of windows.values())r.window.hide();
            throw error;
          }finally{verificationRemaining-=Date.now()-started;waitingForUser=null;waitingPage=null;}
        }
      });
      if(result?.pdf){await persistCookies();note(zh('PDF 已获取，正在继续保存与处理。','PDF acquired. Continuing storage and processing.'));for(const r of windows.values())r.window.hide();return result.pdf;}
      throw accessError(zh('当前页面没有可用的正文 PDF 下载入口，请确认机构订阅权限或补充原文。','No usable article PDF was found on this page. Check subscription access or supply the original.'));
    }finally{
      if(entered){automated=false;waitingForUser=null;waitingPage=null;release();}
      else previous.finally(release);
      externalSignal?.removeEventListener('abort',abort);activeRequests.delete(taskId);
    }
  }
  async function search(input,externalSignal){
    const controller=new AbortController(),abort=()=>controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort',abort,{once:true});if(externalSignal?.aborted)abort();
    const taskId=randomUUID();activeRequests.set(taskId,controller);
    const previous=acquisitionTail;let release;acquisitionTail=new Promise(resolve=>{release=resolve;});let entered=false;
    try{
      await withinSignal(previous,controller.signal);entered=true;
      await navigationReady;
      if(!lastPage&&!input.portalUrl)throw Error('请先打开机构或出版商检索页面并保存登录状态。 / Open your institution search page and save the session first.');
      await withinSignal(open({...input,portalUrl:input.portalUrl||savedPortal,url:lastPage||input.portalUrl,useSaved:true},{navigate:false,show:false}),controller.signal);
      // A stalled advertisement must not hold an otherwise usable catalogue
      // behind loadURL's full-load promise. The runner observes DOM readiness.
      const searchEntry=address(lastPage||input.portalUrl);
      const queries=[...new Set([input.originalQuery,...(input.queries||[])].filter(q=>typeof q==='string'&&q.trim()).map(q=>q.trim()))].slice(0,7);
      if(!queries.length)throw Error('Empty institution search terms.');
      const all=[],queryReports=[],sourceUrls=[],warnings=[];let lastResult;
      automated=true;
      for(const query of queries){
        controller.signal.throwIfAborted();
        try{
      if(view.webContents.getURL()!==searchEntry){
        const contents=view.webContents;let commit,timer;
        const committed=new Promise(resolve=>{commit=resolve;contents.once('did-navigate',commit);});
        try{await withinSignal(Promise.race([committed,contents.loadURL(searchEntry),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Institution search page navigation timed out.')),15000);})]),controller.signal);}
        finally{clearTimeout(timer);contents.removeListener('did-navigate',commit);}
      }
      const result=await searchInstitutionPage({contents:view.webContents,query,signal:controller.signal,normalize:address,limit:Number(input.filters?.resultCount)||20,
      subscribePopups:observer=>{popupObservers.add(observer);return()=>popupObservers.delete(observer);},
      onVerification:async({contents,state})=>{
        try{await waitForManualVerification({contents,state,signal:controller.signal,onWait:resolve=>{
          waitingPage=contents;waitingForUser=resolve;
          note(zh('等待完成网页认证。2 分钟内未完成将结束机构检索，保留已有结果；完成后点击“保存状态并退出”。','Waiting for authentication. Institution search ends after 2 minutes, retaining existing results. Finish and select Save session & close.'));
          const visible=[...windows.values()].find(r=>r.view.webContents===contents)?.window||window;
          visible.show();visible.focus();
        }});}finally{waitingForUser=null;waitingPage=null;}
      }});
        lastResult=result;sourceUrls.push(result.sourceUrl);
        all.push(...result.papers.map((p,i)=>({...p,searchMatches:[{source:'Institution browser: '+new URL(result.sourceUrl).hostname,query,rank:i+1}]})));
        queryReports.push({source:'Institution browser',query,status:'completed',count:result.papers.length});
        if(result.diagnostics?.warning)warnings.push(result.diagnostics.warning);
        if(result.diagnostics?.partial)warnings.push('Institution query returned partial results: '+query);
        if(result.diagnostics?.stopReason){for(const r of windows.values())r.window.hide();break;}
        }catch(error){controller.signal.throwIfAborted();queryReports.push({source:'Institution browser',query,status:'failed',error:error.message});warnings.push(error.message);
          if(['institution_page_blocked','institution_verification_timeout'].includes(error.code)){for(const r of windows.values())r.window.hide();break;}
        }
      }
      if(!lastResult)throw Error(warnings.join('; ')||'Institution search returned no readable response.');
      await persistCookies();return {...lastResult,papers:all,sourceUrls:[...new Set(sourceUrls)],queryReports,warnings:[...new Set(warnings)],diagnostics:{...lastResult.diagnostics,partial:warnings.length>0}};
    }finally{
      if(entered){view?.webContents.stop();automated=false;waitingForUser=null;waitingPage=null;release();}else previous.finally(release);
      externalSignal?.removeEventListener('abort',abort);activeRequests.delete(taskId);
    }
  }
  const activeRequests=new Map();
  return {open,acquire,search,clearSession,async saved(){await navigationReady;return {saved:Boolean(lastPage),url:lastPage,portalUrl:savedPortal};},receiveExternal:retain,cancel(id){activeRequests.get(id)?.abort();},
    async list(){await loaded;return inbox.map(({id,fileName,context,createdAt})=>({id,fileName,context,createdAt}));},
    async read(id){await loaded;if(!inbox.some(row=>row.id===id))throw Error('Unknown institutional download');return {data:(await readFile(path.join(directory,id+'.pdf'))).toString('base64')};},
    async acknowledge(id){await loaded;inbox=inbox.filter(row=>row.id!==id);await persist();},
    async close(){for(const request of activeRequests.values())request.abort();for(const item of pending)item.cancel();await saveAndClose(true);}
  };
}
