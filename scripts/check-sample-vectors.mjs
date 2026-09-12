import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {makeCandidates,fingerprint,CHUNK_VERSION} from '../src/research-evidence.js';
import {EMBEDDING_MODEL,EMBEDDING_REVISION} from '../src/research-embedding.js';
export async function checkSampleVectors(directory){
 const catalog=JSON.parse(await fs.readFile(path.join(directory,'index.json'),'utf8'));
 const vectors=JSON.parse(gunzipSync(await fs.readFile(path.join(directory,'vectors.e5.q8.json.gz'))));
 if(vectors.chunkVersion!==CHUNK_VERSION||vectors.model!==EMBEDDING_MODEL||vectors.revision!==EMBEDDING_REVISION||vectors.dimension!==384)throw Error('Sample vector version mismatch; regenerate before packaging');
 const known=new Map(vectors.records.map(r=>[r[0],r]));let chunks=0;
 for(const node of catalog.documents){const markdown=await fs.readFile(path.join(directory,node.file),'utf8');
  for(const chunk of makeCandidates([{node,document:{markdown}}])){chunks++;const input='passage: '+(chunk.heading||'')+'\n'+chunk.text,record=known.get(EMBEDDING_REVISION+':mean:q8:'+fingerprint(input));
   if(!record||record[1]!==input||Buffer.from(record[2],'base64').length!==384*4)throw Error('Missing current sample vector: '+node.id);
  }
 }
 return {documents:catalog.documents.length,chunks,uniqueVectors:known.size};
}
