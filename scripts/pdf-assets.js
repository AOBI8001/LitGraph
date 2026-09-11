import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.dirname(require.resolve('pdfjs-dist/package.json'));
export const pdfAssetFolders=['cmaps','standard_fonts','wasm'];
export function pdfAssetsPlugin(command){
 return {name:'litgraph-local-pdf-assets',
  async buildStart(){if(command!=='build')return;for(const folder of pdfAssetFolders)for(const name of await readdir(path.join(root,folder)))if(!/\.map$/i.test(name))this.emitFile({type:'asset',fileName:`pdfjs/${folder}/${name}`,source:await readFile(path.join(root,folder,name))});},
  configureServer(server){server.middlewares.use(async(req,res,next)=>{
   const match=/^\/pdfjs\/(cmaps|standard_fonts|wasm)\/([a-zA-Z0-9_.-]+)$/.exec((req.url||'').split('?')[0]);if(!match)return next();
   try{const data=await readFile(path.join(root,match[1],match[2]));res.setHeader('Content-Type',match[2].endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}
  });}
 };
}
