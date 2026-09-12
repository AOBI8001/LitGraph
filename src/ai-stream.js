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
export function createTextStream(onText=()=>{}){
 let buffer='',output='',failure=null;
 function event(frame){const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')return;
  let e;try{e=JSON.parse(data);}catch{return;}
  if(e.error||e.type==='error'||e.type==='response.failed')failure=Error('模型流式响应失败，请检查模型状态后重试。');
  const delta=e.choices?.[0]?.delta?.content ?? (e.type==='content_block_delta'&&e.delta?.type==='text_delta'?e.delta.text:null) ?? (e.type==='response.output_text.delta'?e.delta:null);
  if(typeof delta==='string'){output+=delta;onText(output);}
  if(e.choices?.[0]?.finish_reason==='length'||e.type==='response.incomplete')failure=Error('模型输出达到长度限制，请缩小问题范围。');
 }
 return {push(text){buffer=(buffer+text).replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){event(buffer.slice(0,end));buffer=buffer.slice(end+2);}},finish(){if(buffer.trim())event(buffer);buffer='';if(failure)throw failure;if(!output.trim())throw Error('模型未返回回答正文。');return output;}};
}
