// Only the JSON answer field is displayed; no reasoning or follow-up JSON leaks
// into the preview. Incomplete escapes are held until the next transport chunk.
export function partialAnswer(raw){
 const match=/"answer"\s*:\s*"/.exec(raw);if(!match)return '';let value='';
 for(let i=match.index+match[0].length;i<raw.length;i++){
  const c=raw[i];if(c==='"')break;
  if(c!=='\\'){value+=c;continue;}
  if(i+1>=raw.length)break;const next=raw[++i];
  if(next==='u'){const hex=raw.slice(i+1,i+5);if(!/^[0-9a-f]{4}$/i.test(hex))break;value+=String.fromCharCode(parseInt(hex,16));i+=4;}
  else {const escaped={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','"':'"','\\':'\\','/':'/'};if(!(next in escaped))break;value+=escaped[next];}
 }
 return value.replace(/[\uD800-\uDBFF]$/,'');
}
export function createTextStream(onText=()=>{},{requireCompletion=false}={}){
 let buffer='',output='',failure=null,completed=false;
 const fail=(code,message)=>{failure=Object.assign(Error(message),{code});};
 function event(frame){const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)return;if(data==='[DONE]'){completed=true;return;}
  let e;try{e=JSON.parse(data);}catch{return;}
  if(e.error||e.type==='error'||e.type==='response.failed')fail('provider_error','模型流式响应失败，请检查模型状态后重试。');
  const delta=e.choices?.[0]?.delta?.content ?? (e.type==='content_block_delta'&&e.delta?.type==='text_delta'?e.delta.text:null) ?? (e.type==='response.output_text.delta'?e.delta:null);
  if(typeof delta==='string'){output+=delta;onText(output);}
  const reason=e.choices?.[0]?.finish_reason??e.delta?.stop_reason;
  if(reason||e.type==='message_stop'||e.type==='response.completed')completed=true;
  if(['length','max_tokens'].includes(reason)||e.type==='response.incomplete')fail('output_limit','模型输出达到长度限制，请缩小问题范围。');
  if(['content_filter','refusal'].includes(reason)||e.choices?.[0]?.delta?.refusal||e.type==='response.refusal.delta')fail('refusal','模型服务未提供此问题的回答，请调整问题后重试。');
 }
 return {push(text){buffer=(buffer+text).replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){event(buffer.slice(0,end));buffer=buffer.slice(end+2);}},finish(){if(buffer.trim())event(buffer);buffer='';if(failure)throw failure;if(requireCompletion&&!completed)throw Object.assign(Error('回答传输中断，尚未完成。请重试。 / Answer stream interrupted; please retry.'),{code:'incomplete'});if(!output.trim())throw Error('模型未返回回答正文。');return output;}};
}
