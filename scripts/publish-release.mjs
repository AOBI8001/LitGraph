// Run explicitly after review, commit, push, packaging and installer audit.
// Credentials remain in memory and are sent only to the repository's GitHub API.
import {execFileSync} from 'node:child_process';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {createHash} from 'node:crypto';
const version=JSON.parse(await readFile('package.json','utf8')).version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
const remote=execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim();
if(remote!=='https://github.com/AOBI8001/LitGraph.git')throw Error('Unexpected repository');
if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit reviewed source changes first');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).startsWith(commit))throw Error('Push the reviewed commit to main first');
const credential=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
const token=credential.split(/\r?\n/).find(s=>s.startsWith('password='))?.slice(9);if(!token)throw Error('Missing GitHub credential');
const base='https://api.github.com/repos/AOBI8001/LitGraph',tag='v'+version,names=[`LitGraph-Setup-${version}-x64.exe`,...['arm64','x64'].map(arch=>`LitGraph-${version}-macOS-${arch}.dmg`),'SHA256SUMS.txt'];
const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
async function api(url,options={}){const u=new URL(url);if(!['api.github.com','uploads.github.com'].includes(u.hostname))throw Error('Unexpected upload host');const r=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(options.body instanceof Blob?600000:60000)});if(!r.ok)throw Error('GitHub HTTP '+r.status);return r.json();}
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const audit=JSON.parse(await readFile(`output/package-audit-${version}.json`,'utf8'));
if(audit.sha256!==await hash(`release/${version}/${names[0]}`)||audit.samplePapers!==50||audit.forbidden.length)throw Error('Installer audit does not match');
for(const arch of ['arm64','x64']){
 const mac=JSON.parse(await readFile(`output/package-audit-macos-${arch}.json`,'utf8'));
 if(mac.version!==version||mac.arch!==arch||mac.commit!==commit||mac.samplePapers!==50||mac.forbidden.length||mac.sha256!==await hash(`release/${version}/LitGraph-${version}-macOS-${arch}.dmg`))throw Error('macOS audit/commit mismatch: '+arch);
}
await writeFile(`release/${version}/SHA256SUMS.txt`,(await Promise.all(names.filter(n=>n!=='SHA256SUMS.txt').map(async name=>`${await hash(`release/${version}/${name}`)}  ${name}`))).join('\n')+'\n');
let release=(await api(base+'/releases?per_page=100')).find(r=>r.tag_name===tag);
const action=process.argv[2];
if(action==='draft'){
 if(release&&!release.draft)throw Error('Already published; refusing changes');
 if(!release)release=await api(base+'/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,target_commitish:commit,name:'LitGraph '+version,body:(await readFile('RELEASE_NOTES.md','utf8')).split(/\r?\n---\r?\n/)[0],draft:true,prerelease:false})});
 console.log(JSON.stringify({id:release.id,tag:release.tag_name,draft:release.draft}));
}else if(action==='upload'){
 if(!release?.draft||release.target_commitish!==commit)throw Error('Expected matching unpublished draft');
 for(const name of names){const file=`release/${version}/${name}`,info=await stat(file),sha=await hash(file),old=release.assets.find(a=>a.name===name);
  if(old){if(old.size!==info.size||old.digest!=='sha256:'+sha||old.state!=='uploaded')throw Error('Existing asset mismatch');console.log(name+' already verified');continue;}
  const url=new URL(release.upload_url.split('{')[0]);url.searchParams.set('name',name);
  const asset=await api(url,{method:'POST',headers:{'Content-Type':name.endsWith('.txt')?'text/plain':'application/octet-stream','Content-Length':String(info.size)},body:await openAsBlob(file)});
  if(asset.state!=='uploaded'||asset.size!==info.size||asset.digest!=='sha256:'+sha)throw Error('Upload verification failed');console.log(JSON.stringify({name,size:asset.size,digest:asset.digest}));
 }
}else if(action==='publish'){
 if(!release?.draft||release.target_commitish!==commit)throw Error('Expected matching unpublished draft');
 for(const name of names){const asset=release.assets.find(a=>a.name===name);if(!asset||asset.state!=='uploaded'||asset.digest!=='sha256:'+await hash(`release/${version}/${name}`))throw Error('Missing or incorrect asset');}
 release=await api(base+'/releases/'+release.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:false,make_latest:'true'})});
 console.log(JSON.stringify({url:release.html_url,draft:release.draft,assets:release.assets.map(a=>({name:a.name,url:a.browser_download_url}))}));
}else throw Error('Expected draft, upload or publish');
