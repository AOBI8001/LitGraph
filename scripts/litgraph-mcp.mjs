// Local MCP stdio adapter. Stdout is reserved for JSON-RPC, never logs.
import readline from 'node:readline';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const [base, token] = process.argv.slice(2);
const dynamic=base==='--connection-file';
const localUrl=value=>/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(value||'');
if (dynamic?!path.isAbsolute(token||''):(!localUrl(base)||!token)) { process.stderr.write('Missing local connection configuration\n'); process.exit(1); }
let identity=null,connectedKey='';
async function endpoint(){
  if(!dynamic)return {url:base,token};
  const info=await readFile(token,'utf8').then(JSON.parse).catch(()=>null);
  if(!info?.enabled)throw Error('LitGraph access is not authorized. Open model access and copy the connection setup once.');
  if(!info.running||!localUrl(info.url)||typeof info.token!=='string')throw Error('LitGraph is not running. Open LitGraph; this saved MCP configuration will reconnect automatically.');
  return info;
}
async function invoke(info,params){
  const response=await fetch(`${info.url}/__litgraph/agent`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${info.token}`},body:JSON.stringify(params),signal:AbortSignal.timeout(params.name==='litgraph_scholarly_search'?165000:30000)});
  return {response,value:await response.json()};
}
const schema = properties => ({ type: 'object', properties, additionalProperties: false });
const acquisitionProperties={recordId:{type:'string'},projectId:{type:'string'},nodeId:{type:'string'},source:{type:'string',enum:['combined','open','institution']},portalUrl:{type:'string'},method:{type:'string',enum:['auto','webvpn','ezproxy','publisher']}};
const tools = [
  {name:'litgraph_download_status',description:'Check whether the shared LitGraph retrieval core is available. Does not reveal credentials.',inputSchema:schema({})},
  {name:'litgraph_scholarly_search',description:'Search actual scholarly sources through LitGraph. Only use when the user requested a search; normal search-planning tasks are executed by the app after you return their plan. Returns verified records, not full text.',inputSchema:{...schema({originalQuery:{type:'string',description:'Complete original user input or exact paper title, unchanged; searched before generated keywords.'},portalUrl:{type:'string',description:'Optional institution entry; the desktop uses the last saved browser page and session.'},subjectTerms:{type:'array',items:{type:'string'},maxItems:12,description:'Bilingual core subject names and close synonyms from the search plan.'},queries:{type:'array',items:{type:'string'},minItems:1,maxItems:7},exclude:{type:'array',items:{type:'string'}},filters:{type:'object',properties:{resultCount:{type:'integer',minimum:5,maximum:100},yearStart:{type:'integer'},yearEnd:{type:'integer'},language:{type:'string',enum:['any','en','zh']},articleType:{type:'string',enum:['any','research','review','meta','conference']},source:{type:'string',enum:['combined','open','institution']},sort:{type:'string',enum:['combined','relevance','newest','cited']}},required:['resultCount','yearStart','yearEnd','language','articleType','source'],additionalProperties:false}}),required:['queries','filters']}},
  {name:'litgraph_acquire_start',description:'Start acquisition of a source-verified record for an existing node in the currently open project. Only after user import/download authorization. Returns a taskId; poll status. Uses the app institution session, never request cookies from the user.',inputSchema:{...schema(acquisitionProperties),required:['recordId','projectId','nodeId','source']}},
  {name:'litgraph_acquire_status',description:'Poll a shared-engine acquisition task. Original saved is not conversion/analysis complete. Let the app resume its import workflow.',inputSchema:{...schema({taskId:{type:'string'}}),required:['taskId']}},
  {name:'litgraph_acquire_cancel',description:'Cancel one acquisition and abort its network requests. Retains previously saved original files.',inputSchema:{...schema({taskId:{type:'string'}}),required:['taskId']}},
  { name: 'litgraph_connect', description: '报告实际模型名称，开启 LitGraph 任务处理；成功后产品自动弹出接入成功提示，无需操作页面。随后必须持续 next_task 等待并完成任务。', inputSchema: { ...schema({ model: { type: 'string' }, vision: { type: 'boolean', description: '只有当前模型和工具确实能读取任务内图片才填 true' } }), required: ['model'] } },
  { name: 'litgraph_next_task', description: '领取网站请求；无任务时等待最多 25 秒。用户未要求结束时，继续等待。按 messages 执行并回传，禁止凭空伪造搜索。', inputSchema: schema({ wait_ms: { type: 'integer', minimum: 0, maximum: 25000 } }) },
  { name: 'litgraph_submit_result', description: '提交任务要求的原始结果字符串，通常是 JSON。已取消的任务不能提交。', inputSchema: { ...schema({ id: { type: 'string' }, result: { type: 'string' } }), required: ['id', 'result'] } },
  { name: 'litgraph_context', description: '读取当前页面报告的项目和选中论文，不提供 API 密钥。', inputSchema: schema({}) },
  { name: 'litgraph_disconnect', description: '停止处理网站任务并让网站显示离线。', inputSchema: schema({}) }
];
const output = value => process.stdout.write(JSON.stringify(value) + '\n');
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', async line => {
  let request;
  try {
    request = JSON.parse(line);
    if (request.id === undefined) return;
    let result;
    if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'litgraph', version: '1.0.0' }, instructions: 'This is a local LitGraph task bridge. Connect with your true model name, then remain in the next_task / submit_result loop until the user asks you to stop. Follow docs/LITGRAPH_AGENT_GUIDE.md.' };
    else if (request.method === 'ping') result = {};
    else if (request.method === 'tools/list') result = { tools };
    else if (request.method === 'tools/call') {
      if (!tools.some(t => t.name === request.params?.name)) throw new Error('Unknown tool');
      const info=await endpoint(),key=info.url+'|'+info.token;
      if(request.params.name==='litgraph_connect')identity=request.params.arguments;
      if(identity&&key!==connectedKey&&request.params.name!=='litgraph_connect'){
        const handshake=await invoke(info,{name:'litgraph_connect',arguments:identity});
        if(!handshake.response.ok)throw Error(handshake.value.error||'Reconnect failed');
        connectedKey=key;
      }
      let {response,value}=await invoke(info,request.params);
      if(!response.ok && identity && /会话已离线/.test(value.error||'') && request.params.name!=='litgraph_submit_result'){
        await invoke(info,{name:'litgraph_connect',arguments:identity});
        ({response,value}=await invoke(info,request.params));
      }
      if(response.ok&&request.params.name==='litgraph_connect')connectedKey=key;
      if(request.params.name==='litgraph_disconnect'){identity=null;connectedKey='';}
      const images = [];
      if (request.params.name === 'litgraph_next_task') for (const message of value.messages || []) {
        if (!Array.isArray(message.content)) continue;
        message.content = message.content.map(block => {
          const url = block.image_url?.url;
          if (block.type === 'image_url' && /^data:image\/(png|jpeg|webp);base64,/.test(url || '')) {
            images.push({ type: 'image', mimeType: url.slice(5, url.indexOf(';')), data: url.split(',')[1] });
            return { type: 'text', text: `用户附件图片 ${images.length} 见同次工具输出的 image 内容。` };
          }
          return block;
        });
      }
      result = { content: [{ type: 'text', text: JSON.stringify(value) }, ...images], isError: !response.ok };
    } else { output({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } }); return; }
    output({ jsonrpc: '2.0', id: request.id, result });
  } catch (error) {
    if(dynamic&&request?.params?.name==='litgraph_next_task'){
      await new Promise(resolve=>setTimeout(resolve,Math.min(25000,Math.max(1000,Number(request.params.arguments?.wait_ms)||1000))));
      output({jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify({waiting:true,connected:false,instruction:error.message+' Keep waiting unless the user asks you to stop.'})}]}});
    } else output({ jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32603, message: error.message } });
  }
});
