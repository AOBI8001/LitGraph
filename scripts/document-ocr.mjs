import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Optional offline Windows OCR for damaged PDF frontmatter. No credentials,
// browser session, document text, or image is sent to an external service.
export async function documentOcr(root,image,{signal}={}){
  if(process.platform!=='win32')return {supported:false,reason:'local_ocr_unavailable'};
  const bytes=Buffer.from(String(image||''),'base64');
  if(bytes.length>10*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Expected a PNG smaller than 10 MB.');
  signal?.throwIfAborted();
  const temporary=path.join(os.tmpdir(),`litgraph-document-ocr-${randomUUID()}.png`);
  await writeFile(temporary,bytes,{mode:0o600});
  try{
    const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    const script=path.join(root,'desktop','document-ocr.ps1').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
    const output=await new Promise((resolve,reject)=>execFile(executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-ImagePath',temporary],
      {windowsHide:true,encoding:'utf8',maxBuffer:2*1024*1024,timeout:45000,signal},(error,stdout)=>error?reject(error):resolve(stdout)));
    const result=JSON.parse(output.replace(/^\uFEFF/,''));
    return {supported:result.supported===true,language:String(result.language||''),lines:(result.lines||[]).slice(0,250).map(line=>({text:String(line.text||'').slice(0,2000),x:Number(line.x)||0,y:Number(line.y)||0,width:Number(line.width)||0,height:Number(line.height)||0}))};
  }catch(error){signal?.throwIfAborted();return {supported:false,reason:'local_ocr_unavailable'};}
  finally{await unlink(temporary).catch(()=>{});}
}
