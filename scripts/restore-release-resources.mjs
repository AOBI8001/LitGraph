// Reuse ONLY the already-public bundled sample and offline model from a pinned
// release. Never upload or read a developer's application profile on CI.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,cp,access} from 'node:fs/promises';
import path from 'node:path';
import {checkSampleVectors} from './check-sample-vectors.mjs';
const require=createRequire(import.meta.url),builder=createRequire(require.resolve('electron-builder')),app=createRequire(builder.resolve('app-builder-lib')),asar=app('@electron/asar');
const name='LitGraph-Setup-1.2.8-x64.exe',sha='23cb4a48055a98218c2e0c86652651e1246d504b79d7eb6d30da89e8e50ccc6a';
await mkdir('output',{recursive:true});const temp=await mkdtemp(path.resolve('output/public-resources-'));
const local=process.env.LITGRAPH_RESOURCE_INSTALLER;
const bytes=local?await readFile(local):Buffer.from(await (await fetch('https://github.com/AOBI8001/LitGraph/releases/download/v1.2.8/'+name,{signal:AbortSignal.timeout(300000)})).arrayBuffer());
if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Public resource installer checksum mismatch');
const installer=path.join(temp,name);await writeFile(installer,bytes);
const seven=process.env.SEVEN_ZIP||'7zz';
execFileSync(seven,['x','-t7z','-y',installer,'resources/app.asar','resources/app.asar.unpacked/dist/models/*','-o'+temp],{stdio:'inherit'});
const archive=path.join(temp,'resources/app.asar');
const publicRoot=process.argv.includes('--verify-only')?path.join(temp,'public'):path.resolve('public');
for(const folder of ['sample-fulltext','models']){
 const dest=path.resolve(publicRoot,folder);
 try{await access(dest);throw Error('Refusing to overwrite existing resource folder: '+folder);}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(path.dirname(dest),{recursive:true});
 if(folder==='models')await cp(path.join(temp,'resources/app.asar.unpacked/dist/models'),dest,{recursive:true,errorOnExist:true,force:false});
 else for(const entry of asar.listPackage(archive)){
  const file=entry.replaceAll('\\','/').replace(/^\//,'');
  if(!file.startsWith('dist/sample-fulltext/')||asar.statFile(archive,path.normalize(file)).files)continue;
  const relative=file.slice('dist/sample-fulltext/'.length),target=path.resolve(dest,relative);
  if(!target.startsWith(dest+path.sep))throw Error('Unsafe resource path');
  await mkdir(path.dirname(target),{recursive:true});await writeFile(target,asar.extractFile(archive,path.normalize(file)));
 }
}
console.log(await checkSampleVectors(path.join(publicRoot,'sample-fulltext')));
console.log('Restored pinned public sample and model assets only.');
