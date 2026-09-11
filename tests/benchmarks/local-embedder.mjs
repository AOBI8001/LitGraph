import fs from 'node:fs/promises';
import path from 'node:path';
import {pipeline,env} from '@huggingface/transformers';
import {createEmbedder,EMBEDDING_MODEL} from '../../src/research-embedding.js';
env.allowRemoteModels=false;env.localModelPath=path.resolve('public/models')+'/';
const folder=path.resolve('output/rag-vector-cache');await fs.mkdir(folder,{recursive:true});
export const embed=createEmbedder({load:()=>pipeline('feature-extraction',EMBEDDING_MODEL,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:2}}),read:key=>fs.readFile(path.join(folder,key.replaceAll(':','_')+'.json'),'utf8').then(JSON.parse).catch(()=>null),write:(key,value)=>fs.writeFile(path.join(folder,key.replaceAll(':','_')+'.json'),JSON.stringify(value))});
