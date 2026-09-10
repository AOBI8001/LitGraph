const controls=window.institutionControls;
for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>controls.act(button.dataset.action).catch(error=>document.querySelector('#message').textContent=error.message);
document.querySelector('#navigation').onsubmit=event=>{event.preventDefault();controls.act('navigate',document.querySelector('#address').value).catch(error=>document.querySelector('#message').textContent=error.message);};
controls.listen(state=>{
  const en=state.language==='en';document.documentElement.lang=en?'en':'zh';
  document.querySelector('#brand').textContent=en?'Institution access':'机构访问';
  for(const [action,zh,english] of [['logout','清除登录','Clear sign-in'],['clear-cookies','清理 Cookie','Clear cookies'],['save-close','保存状态并退出','Save session & close']])document.querySelector(`[data-action="${action}"]`).textContent=en?english:zh;
  document.querySelector('[data-action="clear-cookies"]').title=en?'Clear all institution browser cookies. You may need to sign in again. Project data is kept.':'清除机构浏览器全部 Cookie，可能需要重新登录。项目数据不受影响。';
  for(const [action,zh,english] of [['back','后退','Back'],['forward','前进','Forward'],['reload','刷新','Reload']])document.querySelector(`[data-action="${action}"]`).setAttribute('aria-label',en?english:zh);
  const address=document.querySelector('#address');address.setAttribute('aria-label',en?'Current page address':'当前网页地址');if(document.activeElement!==address)address.value=state.url==='about:blank'?'':state.url;
  document.querySelector('#message').textContent=state.message;document.querySelector('#project').textContent=state.project;
  document.querySelector('[data-action="back"]').disabled=!state.canGoBack;document.querySelector('[data-action="forward"]').disabled=!state.canGoForward;
});
void controls.act('state');
