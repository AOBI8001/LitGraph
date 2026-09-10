import test from 'node:test';
import assert from 'node:assert/strict';
import {isVerifiedDocument,confirmStableVerification} from '../desktop/browser-verification.mjs';
import {waitForManualVerification,MANUAL_VERIFICATION_TIMEOUT_MS} from '../desktop/browser-verification.mjs';
import {EventEmitter} from 'node:events';
const article={html:'<title>Article</title><p>Full text</p>',text:'Article Full text',url:'https://example.org/paper',readyState:'complete',hasVisibleChallenge:false};
test('blank/redirect/loading and challenge documents never resume the queue',()=>{
  assert.equal(isVerifiedDocument(article),true);
  for(const change of [{text:'',html:'<html><body></body></html>'},{readyState:'loading'},{url:'about:blank'},{html:'<title>Just a moment...</title>'},{hasVisibleChallenge:true}])assert.equal(isVerifiedDocument({...article,...change}),false);
});

test('manual timeout is item-local, cleans listeners and ignores late Save',async()=>{
  assert.equal(MANUAL_VERIFICATION_TIMEOUT_MS,120000);
  const controller=new AbortController(),contents=new EventEmitter();let resume;
  await assert.rejects(waitForManualVerification({state:'challenge',contents,signal:controller.signal,timeoutMs:15,onWait:fn=>resume=fn}),{code:'institution_verification_timeout'});
  assert.equal(controller.signal.aborted,false);assert.equal(contents.listenerCount('did-finish-load'),0);
  resume(); // Stale save cannot revive a skipped item.
  await waitForManualVerification({state:'login',contents,signal:controller.signal,onWait:fn=>fn()});
});
test('initial and post-navigation blocking skips without waiting for a human',async()=>{
  let called=false;
  await assert.rejects(waitForManualVerification({state:'blocked',onWait:()=>called=true}),{code:'institution_page_blocked'});
  assert.equal(called,false);
  const contents=new EventEmitter();contents.isDestroyed=()=>false;
  const task=waitForManualVerification({state:'challenge',contents,timeoutMs:1000,read:async()=>({...article,html:'<h1>Sorry, you have been blocked</h1>'}),onWait:()=>{}});
  contents.emit('did-finish-load');await assert.rejects(task,{code:'institution_page_blocked'});
  assert.equal(contents.listenerCount('did-finish-load'),0);
});
test('user cancellation is distinct from automatic skipping',async()=>{
  const controller=new AbortController(),reason=Error('Paused by user');
  const task=waitForManualVerification({state:'challenge',signal:controller.signal,onWait:()=>{}});
  controller.abort(reason);await assert.rejects(task,e=>e===reason);
});
test('save requires three stable checks; a challenge returning between checks stays paused',async()=>{
  const contents={isDestroyed:()=>false,isLoadingMainFrame:()=>false};
  let reads=0;
  assert.equal(await confirmStableVerification(contents,{read:async()=>{reads++;return article;},pause:async()=>{}}),true);
  assert.equal(reads,3);
  reads=0;
  assert.equal(await confirmStableVerification(contents,{read:async()=>++reads===2?{...article,hasVisibleChallenge:true}:article,pause:async()=>{}}),false);
  reads=0;
  assert.equal(await confirmStableVerification(contents,{read:async()=>({...article,url:article.url+(reads++)}),pause:async()=>{}}),false);
  assert.equal(await confirmStableVerification(contents,{read:async()=>{throw Error('Navigation');},pause:async()=>{}}),false);
});
