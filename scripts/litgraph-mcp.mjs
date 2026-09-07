// Local MCP stdio adapter. Stdout is reserved for JSON-RPC, never logs.
import readline from 'node:readline';
const [base, token] = process.argv.slice(2);
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base || '') || !token) { process.stderr.write('Missing local URL / access token\n'); process.exit(1); }
const schema = properties => ({ type: 'object', properties, additionalProperties: false });
const tools = [
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
      const response = await fetch(`${base}/__litgraph/agent`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(request.params), signal: AbortSignal.timeout(30000) });
      const value = await response.json();
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
  } catch (error) { output({ jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32603, message: error.message } }); }
});
