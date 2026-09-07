import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {scholarlyService} from './scholarly-service.js';
import {publicFetch} from './public-fetch.js';

const digest = value => createHash('sha256').update(String(value)).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function localService(root, dependencies = {}) {
  const scholarly=dependencies.scholarly||scholarlyService();
  const download=dependencies.download||publicFetch;
  const clients = new Map();
  const indexRoot = path.join(root, 'projects', 'local-fulltext-index');
  const samplePath = path.join(root, 'projects', 'local-sample', 'graph.json');
  async function readSample() {
    try { return JSON.parse(await readFile(samplePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { nodes: [] }; throw error; }
  }
  async function sampleSource(node) {
    const sample = await readSample();
    const matches = sample.nodes.filter(p => node.doi && p.doi?.toLowerCase() === node.doi.toLowerCase());
    const found = sample.nodes.find(p => p.id === node.id && p.title === node.title) || (matches.length === 1 ? matches[0] : matches.find(p => p.title === node.title));
    if (!found?.localTextPath) return null;
    const text = await readFile(found.localTextPath, 'utf8').catch(() => '');
    if (!text.trim()) return null;
    const record = { markdown: `# ${found.title}\n\n${text.replace(/\r\n/g, '\n').replace(/\u0000/g, '')}`, fileName: path.basename(found.localTextPath).replace(/\.txt$/i, '.md'), sourceKind: 'extracted_text', originalPath: found.localTextPath, title: found.title, doi: found.doi };
    record.key = digest(`sample:${found.doi || found.title}${matches.length > 1 ? ':' + found.id : ''}`);
    await saveDocument(record);
    return record;
  }
  async function saveDocument(record) {
    await mkdir(indexRoot, { recursive: true });
    if(record.markdown){record.localMarkdownPath = path.join(indexRoot, record.key + '.md');record.markdownRelativePath=`projects/local-fulltext-index/${record.key}.md`;await writeFile(record.localMarkdownPath, record.markdown, 'utf8');}
    await writeFile(path.join(indexRoot, record.key + '.json'), JSON.stringify(record), 'utf8');
    return record;
  }
  const documentKey=data=>digest(`${data.projectId}:${data.nodeId}`);
  const readDocument=key=>/^[a-f0-9]{64}$/.test(key||'')?readFile(path.join(indexRoot,key+'.json'),'utf8').then(JSON.parse).catch(()=>null):Promise.resolve(null);
  async function saveOriginal(key,bytes,record={}){
    if(bytes.length>40*1024*1024)throw new Error('PDF exceeds 40 MB.');
    if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw new Error('The source returned a page instead of a PDF. Open the source to sign in or download manually.');
    await mkdir(indexRoot,{recursive:true});await writeFile(path.join(indexRoot,key+'.pdf'),bytes);
    return saveDocument({...record,key,originalRelativePath:`projects/local-fulltext-index/${key}.pdf`,originalType:'application/pdf'});
  }
  const active = c => c.agent && Date.now() - c.agent.lastSeen < 300000;
  const status = c => ({ connected: Boolean(active(c)), connectionId: active(c) ? c.agent.connectionId : null, model: active(c) ? c.agent.model : '', vision: active(c) && c.agent.vision === true });
  function clientFor(token) { return [...clients.values()].find(c => c.browserToken === token || c.agentToken === token); }
  async function rpc(c, name, args) {
    if (name === 'litgraph_connect') {
      if (typeof args.model !== 'string' || !args.model.trim()) throw new Error('必须报告实际模型名称；不知道时填 agent 名称（模型未知）。');
      const model=args.model.trim().slice(0, 120);
      const connectionId=active(c) && c.agent.model===model ? c.agent.connectionId : randomUUID();
      c.agent = { model, vision: args.vision === true, lastSeen: Date.now(), connectionId };
      return { ...status(c), instructions: '连接成功，LitGraph 将自动弹出“外部 Agent 接入成功”提示；无需操作页面或修改源码。保持任务循环：调用 litgraph_next_task，按任务 messages 执行，用 litgraph_submit_result 回传。没有任务不是完成，继续等待，直到用户让你停止。每 5 分钟内至少调用一次工具维持连接。不要伪造检索或模型身份。' };
    }
    if (!active(c)) throw new Error('会话已离线，请重新 litgraph_connect。');
    c.agent.lastSeen = Date.now();
    if (name === 'litgraph_disconnect') { c.agent = null; return { connected: false }; }
    if (name === 'litgraph_context') return c.context || { message: '请在 LitGraph 页面打开项目。' };
    if (name === 'litgraph_next_task') {
      const until = Date.now() + Math.min(25000, Math.max(0, Number(args.wait_ms) || 0));
      do {
        const job = [...c.jobs.values()].find(j => j.state === 'queued');
        if (job) { job.state = 'processing'; return { id: job.id, messages: job.messages, maxTokens: job.maxTokens, context: job.context }; }
        if (Date.now() < until) await sleep(200);
      } while (Date.now() < until);
      return { waiting: true, instruction: '暂无任务，继续调用 litgraph_next_task 等待。' };
    }
    if (name === 'litgraph_submit_result') {
      const job = c.jobs.get(args.id);
      if (!job || job.state !== 'processing') throw new Error('任务不存在、已取消或已完成，不得覆盖。');
      if (typeof args.result !== 'string' || !args.result.trim() || args.result.length > 500000) throw new Error('result 必须是任务要求的完整输出字符串。');
      job.state = 'done'; job.result = args.result; c.agent.lastSeen = Date.now();
      return { accepted: true };
    }
    throw new Error('未知工具');
  }
  return async (req, res, next) => {
    if (!req.url?.startsWith('/__litgraph/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
    try {
      // Loopback only; never accept ambient cookies or cross-origin browser requests.
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '') || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: '仅允许本机同源访问' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 62000000) return send(413, { error: '数据过大' }); }
      const data = body ? JSON.parse(body) : {};
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === '/__litgraph/bootstrap' && req.method === 'POST') {
        for (const [key, old] of clients) if (Date.now() - old.lastBrowserSeen > 3600000) clients.delete(key);
        // New page session gets independent credentials and job queue.
        const id = randomUUID();
        const c = { id, browserToken: randomUUID(), agentToken: randomUUID(), agent: null, jobs: new Map(), lastBrowserSeen: Date.now() };
        clients.set(id, c);
        return send(200, { browserToken: c.browserToken });
      }
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const c = clientFor(token);
      if (!c) return send(401, { error: '连接已失效，请重新复制接入说明。' });
      if (url.pathname === '/__litgraph/agent' && token === c.agentToken && req.method === 'POST') return send(200, await rpc(c, data.name, data.arguments || {}));
      if (token !== c.browserToken) return send(403, { error: '不允许访问此接口' });
      c.lastBrowserSeen = Date.now();
      const controller=new AbortController();res.once('close',()=>{if(!res.writableEnded)controller.abort();});
      if(url.pathname==='/__litgraph/search'&&req.method==='POST'){
        if(c.searchBusy)return send(409,{error:'A search is already running.'});
        c.searchBusy=true;
        try{const result=await scholarly.search(data,controller.signal);c.discovery=new Map(result.papers.map(p=>[p.recordId,p]));return send(200,result);}finally{c.searchBusy=false;}
      }
      if(url.pathname==='/__litgraph/acquire'&&req.method==='POST'){
        if(c.acquireBusy)return send(409,{error:'A download is already running.'});
        const candidate=c.discovery?.get(data.recordId);if(!candidate)throw new Error('Search record expired. Search again before importing.');
        if(!data.projectId||!data.nodeId)throw new Error('Missing document identity.');
        c.acquireBusy=true;
        try{
          const metadata=await scholarly.enrich(candidate,controller.signal),key=documentKey(data);
          let record=await saveDocument({...await readDocument(key),key,metadata,projectId:data.projectId,nodeId:data.nodeId});
          const errors=[];
          if(metadata.isOpenAccess)for(const address of [...new Set(metadata.pdfUrls||[metadata.pdfUrl])].filter(Boolean).slice(0,3)){
            try{const result=await download(address,{limit:40*1024*1024,signal:controller.signal});record=await saveOriginal(key,result.bytes,{...record,downloadedFrom:result.url,downloadedAt:new Date().toISOString()});return send(200,{metadata,key,originalRelativePath:record.originalRelativePath,data:result.bytes.toString('base64'),type:'application/pdf'});}catch(e){controller.signal.throwIfAborted();errors.push(e.message);}
          }
          return send(200,{metadata,key,status:metadata.isOpenAccess?'unavailable':'needs_access',error:errors.join('; ')||'No automatically accessible open PDF. Use the source or institution portal, then add the original file.'});
        }finally{c.acquireBusy=false;}
      }
      if(url.pathname==='/__litgraph/project'&&req.method==='POST'){
        if(!data.projectId||!Array.isArray(data.project?.nodes))throw new Error('Invalid project snapshot.');
        const folder=path.join(root,'projects','local-projects');await mkdir(folder,{recursive:true});
        await writeFile(path.join(folder,digest(data.projectId)+'.json'),JSON.stringify(data.project),'utf8');return send(200,{saved:true});
      }
      if (url.pathname === '/__litgraph/status') return send(200, status(c));
      if (url.pathname === '/__litgraph/context' && req.method === 'POST') { c.context = data; return send(200, { ok: true }); }
      if (url.pathname === '/__litgraph/instructions' && req.method === 'POST') {
        // Rotate access on every explicit copy; old MCP registrations cannot keep access.
        c.agentToken = randomUUID(); c.agent = null;
        return send(200, { root, node: process.execPath, script: path.join(root, 'scripts', 'litgraph-mcp.mjs'), url: `http://${req.headers.host}`, token: c.agentToken, guide: path.join(root, 'docs', 'LITGRAPH_AGENT_GUIDE.md') });
      }
      if (url.pathname === '/__litgraph/disconnect' && req.method === 'POST') { c.agentToken = randomUUID(); c.agent = null; c.jobs.clear(); return send(200, { ok: true }); }
      if (url.pathname === '/__litgraph/tasks' && req.method === 'POST') {
        if (!active(c)) return send(409, { error: '外部 Agent 已离线，请让它恢复等待任务，或使用 API 接入。' });
        if (!Array.isArray(data.messages)) throw new Error('缺少 messages');
        if ([...c.jobs.values()].filter(j => j.state !== 'done').length >= 8) throw new Error('等待中的任务过多，请先完成或取消现有任务。');
        const id = randomUUID();
        c.jobs.set(id, { id, state: 'queued', messages: data.messages, maxTokens: data.maxTokens, context: c.context, created: Date.now() });
        for (const [key, job] of c.jobs) if (Date.now() - job.created > 1800000) c.jobs.delete(key);
        return send(200, { id });
      }
      if (url.pathname.startsWith('/__litgraph/tasks/')) {
        const id = url.pathname.split('/').at(-1), job = c.jobs.get(id);
        if (req.method === 'DELETE') { c.jobs.delete(id); return send(200, { cancelled: true }); }
        if (!job) return send(404, { error: '任务已取消或失效' });
        return send(200, { state: job.state, result: job.result });
      }
      if (url.pathname === '/__litgraph/document' && req.method === 'POST') {
        if (data.markdown) {
          const key=documentKey(data);
          let record = { ...await readDocument(key), key, markdown: String(data.markdown), fileName: String(data.fileName || 'source.md'), sourceKind: data.sourceKind || 'markdown',conversionQuality:data.conversionQuality||'text_extraction',pageCount:data.pageCount||null };
          if(data.originalData)record=await saveOriginal(key,Buffer.from(data.originalData,'base64'),record);
          return send(200, await saveDocument(record));
        }
        if (data.key && /^[a-f0-9]{64}$/.test(data.key)) {const record=await readDocument(data.key);return send(200,record?.markdown?record:null);}
        return send(200, await sampleSource(data.node || {}));
      }
      if (url.pathname === '/__litgraph/original' && req.method === 'POST') {
        if(data.key&&/^[a-f0-9]{64}$/.test(data.key)){
          const bytes=await readFile(path.join(indexRoot,data.key+'.pdf')).catch(()=>null);
          return send(200,bytes&&bytes.length<=40*1024*1024?{data:bytes.toString('base64'),type:'application/pdf'}:null);
        }
        const sample = await readSample();
        const node = sample.nodes.find(n => n.id === data.id && n.title === data.title);
        if (!node?.localPdfPath) return send(200, null);
        const bytes = await readFile(node.localPdfPath).catch(() => null);
        if (!bytes || bytes.length > 40 * 1024 * 1024) return send(200, null);
        return send(200, { data: bytes.toString('base64'), type: 'application/pdf' });
      }
      send(404, { error: '接口不存在' });
    } catch (error) { send(400, { error: error.message }); }
  };
}
