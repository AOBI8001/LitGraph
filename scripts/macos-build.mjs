// Explicit developer release operations. Tokens are kept in memory and sent
// only to GitHub API; artifact redirects are fetched without credentials.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const [action,runId]=process.argv.slice(2),base='https://api.github.com/repos/AOBI8001/LitGraph';
if(execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim()!=='https://github.com/AOBI8001/LitGraph.git')throw Error('Unexpected repository');
const credential=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'}),token=credential.split(/\r?\n/).find(s=>s.startsWith('password='))?.slice(9);
if(!token)throw Error('Missing GitHub credential');
async function api(route,options={}){const r=await fetch(base+route,{...options,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',...options.headers},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('GitHub HTTP '+r.status);return r.status===204?{}:r.json();}
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(action==='dispatch'){
 if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit reviewed source first');
 if(!execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).startsWith(commit))throw Error('Push reviewed source first');
 await api('/actions/workflows/macos.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main'})});console.log('Dispatched macOS build for '+commit);
}else if(action==='status'){
 const runs=await api('/actions/workflows/macos.yml/runs?per_page=5');for(const r of runs.workflow_runs){const jobs=await api(`/actions/runs/${r.id}/jobs`);console.log(JSON.stringify({id:r.id,commit:r.head_sha,status:r.status,conclusion:r.conclusion,url:r.html_url,jobs:jobs.jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}))}));}
}else if(action==='download'||action==='logs'){
 if(!/^\d+$/.test(runId||''))throw Error('Expected run ID');
 const run=await api('/actions/runs/'+runId);if(run.head_sha!==commit)throw Error('Run does not match checked-out commit');
 if(action==='download'&&run.conclusion!=='success')throw Error('Build/tests did not all pass');
 await mkdir('output/macos-artifacts',{recursive:true});
 const assets=action==='logs'?[{name:'logs-'+runId,url:base+`/actions/runs/${runId}/logs`}]:
  (await api(`/actions/runs/${runId}/artifacts`)).artifacts.filter(a=>a.name==='macos-arm64').map(a=>({name:a.name,url:a.archive_download_url}));
 if(action==='download'&&assets.length!==1)throw Error('Expected native Apple Silicon artifact');
 for(const a of assets){
  if(new URL(a.url).hostname!=='api.github.com')throw Error('Unexpected artifact URL');
  const redirect=await fetch(a.url,{headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(60000)}),url=new URL(redirect.headers.get('location'));
  if(url.protocol!=='https:'||!/(?:\.blob\.core\.windows\.net|\.githubusercontent\.com|\.actions\.githubusercontent\.com)$/.test(url.hostname))throw Error('Unexpected artifact download host');
  const r=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('Artifact download failed');
  await writeFile(`output/macos-artifacts/${a.name}.zip`,Buffer.from(await r.arrayBuffer()));console.log('Downloaded '+a.name);
 }
}else throw Error('Expected dispatch, status, download RUN_ID or logs RUN_ID');
