import { usageSummary } from './summary.js';
import { dashboard } from './dashboard.js';
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
  // An offline event may arrive after a newer one: keep the actual earliest day.
  db.prepare('UPDATE installations SET first_day=MIN(first_day,?) WHERE install_hash=? AND EXISTS(SELECT 1 FROM events WHERE event_id=? AND install_hash=? AND processed=0)').bind(e.day,hash,e.eventId,hash),
  db.prepare(`INSERT INTO daily_activity(day,install_hash,launches,uses)
   SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE event_id=? AND install_hash=? AND processed=0)
   ON CONFLICT(day,install_hash) DO UPDATE SET launches=launches+excluded.launches,uses=uses+excluded.uses`).bind(e.day,hash,e.type==='launch'?1:0,e.type==='use'?1:0,e.eventId,hash),
  db.prepare('UPDATE events SET processed=1 WHERE event_id=? AND install_hash=?').bind(e.eventId,hash)
 ]);
}
export const retentionQuery = `SELECT i.first_day AS cohort,COUNT(*) AS installs,
 SUM(CASE WHEN d1.uses>0 THEN 1 ELSE 0 END) AS retained1,
 SUM(CASE WHEN d7.uses>0 THEN 1 ELSE 0 END) AS retained7,
 SUM(CASE WHEN d30.uses>0 THEN 1 ELSE 0 END) AS retained30
 FROM installations i
 LEFT JOIN daily_activity d1 ON d1.install_hash=i.install_hash AND d1.day=date(i.first_day,'+1 day')
 LEFT JOIN daily_activity d7 ON d7.install_hash=i.install_hash AND d7.day=date(i.first_day,'+7 day')
 LEFT JOIN daily_activity d30 ON d30.install_hash=i.install_hash AND d30.day=date(i.first_day,'+30 day')
 WHERE i.first_day>=? GROUP BY i.first_day ORDER BY i.first_day DESC`;
export function retentionCohorts(rows,today){
 return rows.map(row=>{
  const cohort={cohort:row.cohort,installs:row.installs};
  for(const day of [1,7,30]){
   const observedDay=new Date(Date.parse(row.cohort+'T00:00:00Z')+day*86400000).toISOString().slice(0,10);
   // Today's rate is live/provisional; future dates must never be represented as zero.
   const mature=observedDay<=today;
   const count=mature?Number(row['retained'+day]||0):null;
   cohort['day'+day]={count,rate:mature&&row.installs?count/row.installs:null,mature,provisional:observedDay===today};
  }
  return cohort;
 });
}
export default {
 async fetch(request,env){
  const pathname=new URL(request.url).pathname;
  const mounted=pathname.startsWith('/__metrics/');
  const path=mounted?pathname.slice('/__metrics'.length):pathname;
  if(path==='/'&&request.method==='GET')return new Response(mounted?dashboard.replace("fetch('/stats'", "fetch('/__metrics/stats'"):dashboard,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});
  if(path==='/health')return reply({service:'LitGraph metrics',version:'1.2.0'});
  if(path==='/stats'&&request.method==='GET'){
   if(!env.ADMIN_TOKEN||request.headers.get('authorization')!=='Bearer '+env.ADMIN_TOKEN)return reply({error:'Unauthorized'},401);
   const since=new Date(Date.now()+8*3600000-30*86400000).toISOString().slice(0,10);
   const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM installations').first();
   const result=await env.DB.prepare(`SELECT a.day,COUNT(*) AS activeInstalls,SUM(CASE WHEN a.uses>0 THEN 1 ELSE 0 END) AS usedInstalls,SUM(a.launches) AS launches,SUM(a.uses) AS uses,
    (SELECT COUNT(*) FROM installations i WHERE i.first_day=a.day) AS newInstalls FROM daily_activity a WHERE a.day>=? GROUP BY a.day ORDER BY a.day DESC`).bind(since).all();
   const cohorts=await env.DB.prepare(retentionQuery).bind(since).all();
   const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
   const summary=await usageSummary(env.DB,today);
   return reply({totalInstalls:total.n,summary,days:result.results,retention:retentionCohorts(cohorts.results,today),timeZone:'Asia/Shanghai'});
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
