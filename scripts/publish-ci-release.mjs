// Publish only installers already audited and tested by the two build workflows.
// Authentication stays in the runner environment; no user profile is downloaded.
import fs from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
assert.match(version,/^\d+\.\d+\.\d+$/);
const base='https://api.github.com/repos/AOBI8001/LitGraph';
const token=process.env.GITHUB_TOKEN;assert.ok(token,'Missing runner token');
async function api(address,options={}){
 const url=new URL(address);assert.ok(['api.github.com','uploads.github.com'].includes(url.hostname));
 const response=await fetch(address,{...options,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...options.headers},signal:AbortSignal.timeout(options.body instanceof Blob?600000:60000)});
 if(!response.ok)throw Error('Release API HTTP '+response.status);
 return response.json();
}
const json=value=>({'Content-Type':'application/json'});
const windowsRun=process.env.WINDOWS_RUN,macRun=process.env.MACOS_RUN;
for(const id of [windowsRun,macRun])assert.match(id||'',/^\d+$/);
const runs=await Promise.all([windowsRun,macRun].map(id=>api(base+'/actions/runs/'+id)));
for(const run of runs){assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');}
assert.equal(runs[0].head_sha,runs[1].head_sha,'Both installers must come from the same source commit');
const commit=runs[0].head_sha;
// A publication-only workflow addition may follow the build commit. All product
// files must still be identical to the tested source; no untested fixes allowed.
execFileSync('git',['diff','--exit-code',commit,'HEAD','--','.',':!.github/workflows/publish.yml',':!scripts/publish-ci-release.mjs'],{stdio:'inherit'});
const files=[];
async function walk(folder){for(const entry of await fs.readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())await walk(file);else files.push(file);}}
await walk('artifacts');
const find=name=>{const matched=files.filter(file=>path.basename(file)===name);assert.equal(matched.length,1,'Missing or duplicate artifact: '+name);return matched[0];};
const names=[`LitGraph-Setup-${version}-x64.exe`,`LitGraph-${version}-macOS-arm64.dmg`];
const audits=[JSON.parse(await fs.readFile(find(`package-audit-${version}.json`),'utf8')),JSON.parse(await fs.readFile(find('package-audit-macos-arm64.json'),'utf8'))];
assert.equal(audits[1].arch,'arm64');
const hashes=[];
await fs.mkdir('release-assets',{recursive:true});
for(let i=0;i<names.length;i++){
 const audit=audits[i],file=find(names[i]),bytes=await fs.readFile(file),hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(audit.version,version);assert.equal(audit.commit,commit);assert.equal(audit.samplePapers,50);assert.deepEqual(audit.forbidden,[]);assert.equal(audit.size,bytes.length);assert.equal(audit.sha256,hash);
 await fs.copyFile(file,path.join('release-assets',names[i]));hashes.push(hash);
}
await fs.writeFile('release-assets/SHA256SUMS.txt',names.map((name,i)=>`${hashes[i]}  ${name}`).join('\n')+'\n');
const allNames=[...names,'SHA256SUMS.txt'];
let release=(await api(base+'/releases?per_page=100')).find(item=>item.tag_name==='v'+version);
if(release){assert.equal(release.draft,true,'Refusing to modify a published release');assert.equal(release.target_commitish,commit);}
else release=await api(base+'/releases',{method:'POST',headers:json(),body:JSON.stringify({tag_name:'v'+version,target_commitish:commit,name:'LitGraph '+version,body:(await fs.readFile('RELEASE_NOTES.md','utf8')).split(/\r?\n---\r?\n/)[0],draft:true,prerelease:false})});
for(const name of allNames){
 const file=path.join('release-assets',name),bytes=await fs.readFile(file),hash=createHash('sha256').update(bytes).digest('hex');
 const existing=release.assets.find(asset=>asset.name===name);
 if(existing){assert.equal(existing.state,'uploaded');assert.equal(existing.size,bytes.length);assert.equal(existing.digest,'sha256:'+hash);continue;}
 const url=new URL(release.upload_url.split('{')[0]);url.searchParams.set('name',name);
 const asset=await api(url.href,{method:'POST',headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.length)},body:await openAsBlob(file)});
 assert.equal(asset.state,'uploaded');assert.equal(asset.size,bytes.length);assert.equal(asset.digest,'sha256:'+hash);
 console.log(JSON.stringify({name,size:asset.size,sha256:hash}));
}
release=await api(base+'/releases/'+release.id);
assert.deepEqual(release.assets.map(asset=>asset.name).sort(),allNames.sort());
release=await api(base+'/releases/'+release.id,{method:'PATCH',headers:json(),body:JSON.stringify({draft:false,make_latest:'true'})});
assert.equal(release.draft,false);console.log(JSON.stringify({published:release.html_url,commit,version}));
