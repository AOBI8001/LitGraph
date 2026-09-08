const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function installHash(id,secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id)))).map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function validateEvent(body,now=Date.now()){
 if(!body||Object.keys(body).sort().join(',')!=='eventId,installId,occurredAt,type')throw Error('Invalid fields');
 if(!uuid.test(body.installId)||!uuid.test(body.eventId)||!['launch','use'].includes(body.type))throw Error('Invalid event');
 const time=Date.parse(body.occurredAt);
 if(!Number.isFinite(time)||time>now+300000||time<now-7*86400000)throw Error('Event expired or invalid time');
 return {...body,day:new Date(time+8*3600000).toISOString().slice(0,10)};
}
export async function recordEvent(db,event,hash){
 const e=event;
 // One atomic batch; only a newly accepted, unprocessed event increments counters.
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO events(event_id,install_hash,day,kind) VALUES(?,?,?,?)').bind(e.eventId,hash,e.day,e.type),
  db.prepare('INSERT OR IGNORE INTO installations(install_hash,first_day) SELECT ?,? WHERE EXISTS(SELECT 1 FROM events WHERE event_id=? AND install_hash=? AND processed=0)').bind(hash,e.day,e.eventId,hash),
  db.prepare(`INSERT INTO daily_activity(day,install_hash,launches,uses)
   SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE event_id=? AND install_hash=? AND processed=0)
   ON CONFLICT(day,install_hash) DO UPDATE SET launches=launches+excluded.launches,uses=uses+excluded.uses`).bind(e.day,hash,e.type==='launch'?1:0,e.type==='use'?1:0,e.eventId,hash),
  db.prepare('UPDATE events SET processed=1 WHERE event_id=? AND install_hash=?').bind(e.eventId,hash)
 ]);
}
const dashboard=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LitGraph 统计</title><style>
body{font:15px system-ui;color:#242137;background:#f7f6fb;max-width:1040px;margin:50px auto;padding:0 22px}h1{font-size:26px}p{color:#736b85;line-height:1.7}form{display:flex;gap:10px}input,button{border:1px solid #dcd5e7;border-radius:8px;padding:10px}input{width:300px}button{background:#6945cf;color:white;cursor:pointer}table{width:100%;border-collapse:collapse;background:white;margin-top:25px}td,th{padding:14px;border-bottom:1px solid #eee;text-align:left}#summary{margin-top:24px;font-size:20px}#error{color:#a33333}</style>
<h1>LitGraph 1.0 · 使用统计</h1><p>新增安装以首次启动为准；日活按安装去重。打开次数和核心功能使用次数分别统计。同一人在不同电脑上使用会按不同安装计算。每日按北京时间划分。</p>
<form id="login"><input id="token" type="password" placeholder="管理口令" required autocomplete="off"><button>查看统计</button></form><p id="error"></p><div id="summary"></div><table><thead><tr><th>日期</th><th>新增安装</th><th>活跃安装</th><th>实际使用安装</th><th>打开次数</th><th>使用次数</th></tr></thead><tbody id="rows"></tbody></table>
<script>
document.querySelector('#login').onsubmit=async e=>{e.preventDefault();document.querySelector('#error').textContent='';try{const r=await fetch('/stats',{headers:{Authorization:'Bearer '+document.querySelector('#token').value}});if(!r.ok)throw Error(r.status===401?'管理口令不正确':'暂时无法读取统计');const data=await r.json();document.querySelector('#summary').textContent='累计安装：'+data.totalInstalls;const rows=document.querySelector('#rows');rows.replaceChildren();for(const row of data.days){const tr=document.createElement('tr');for(const key of ['day','newInstalls','activeInstalls','usedInstalls','launches','uses']){const td=document.createElement('td');td.textContent=row[key];tr.append(td);}rows.append(tr);}}catch(e){document.querySelector('#error').textContent=e.message;}};
</script></html>`;
export default {
 async fetch(request,env){
  const pathname=new URL(request.url).pathname;
  const mounted=pathname.startsWith('/__metrics/');
  const path=mounted?pathname.slice('/__metrics'.length):pathname;
  if(path==='/'&&request.method==='GET')return new Response(mounted?dashboard.replace("fetch('/stats'", "fetch('/__metrics/stats'"):dashboard,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});
  if(path==='/health')return reply({service:'LitGraph metrics',version:'1.0'});
  if(path==='/stats'&&request.method==='GET'){
   if(!env.ADMIN_TOKEN||request.headers.get('authorization')!=='Bearer '+env.ADMIN_TOKEN)return reply({error:'Unauthorized'},401);
   const since=new Date(Date.now()+8*3600000-30*86400000).toISOString().slice(0,10);
   const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM installations').first();
   const result=await env.DB.prepare(`SELECT a.day,COUNT(*) AS activeInstalls,SUM(CASE WHEN a.uses>0 THEN 1 ELSE 0 END) AS usedInstalls,SUM(a.launches) AS launches,SUM(a.uses) AS uses,
    (SELECT COUNT(*) FROM installations i WHERE i.first_day=a.day) AS newInstalls FROM daily_activity a WHERE a.day>=? GROUP BY a.day ORDER BY a.day DESC`).bind(since).all();
   return reply({totalInstalls:total.n,days:result.results,timeZone:'Asia/Shanghai'});
  }
  if(path!=='/event'||request.method!=='POST')return reply({error:'Not found'},404);
  if(!env.INSTALL_SALT||!env.DB)return reply({error:'Not configured'},503);
  if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required'},415);
  if(Number(request.headers.get('content-length'))>1024)return reply({error:'Too large'},413);
  try{
   const raw=await request.text();if(raw.length>1024)return reply({error:'Too large'},413);
   const event=validateEvent(JSON.parse(raw));
   const hash=await installHash(event.installId,env.INSTALL_SALT);
   if(env.RATE_LIMITER){const limit=await env.RATE_LIMITER.limit({key:hash});if(!limit.success)return reply({error:'Rate limited'},429);}
   await recordEvent(env.DB,event,hash);return reply({accepted:true});
  }catch(error){const invalid=error instanceof SyntaxError||/Invalid|expired/.test(error.message);return reply({error:invalid?'Invalid event':'Unable to record event'},invalid?400:503);}
 },
 async scheduled(controller,env){
  const before=new Date(Date.now()+8*3600000-8*86400000).toISOString().slice(0,10);
  await env.DB.prepare('DELETE FROM events WHERE day<?').bind(before).run();
 }
};
