import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {EMBEDDING_MODEL,EMBEDDING_REVISION} from '../src/research-embedding.js';
const root=fileURLToPath(new URL('../',import.meta.url)),folder=path.join(root,'public/models',EMBEDDING_MODEL);
const manifest={model:EMBEDDING_MODEL,revision:EMBEDDING_REVISION,files:{}};
for(const name of ['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/model_quantized.onnx']){
 const file=path.join(folder,name);await fs.mkdir(path.dirname(file),{recursive:true});
 let bytes=await fs.readFile(file).catch(()=>null);
 if(!bytes){const r=await fetch(`https://huggingface.co/${EMBEDDING_MODEL}/resolve/${EMBEDDING_REVISION}/${name}`,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error(`${name}: HTTP ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());await fs.writeFile(file,bytes);}
 manifest.files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};console.log(name,bytes.length);
}
await fs.writeFile(path.join(root,'public/models/manifest.json'),JSON.stringify(manifest,null,2));
