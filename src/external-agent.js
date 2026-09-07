let boot;
let state = { connected: false };
export const externalState = () => state;
export async function localRequest(route, data, options = {}) {
  boot ||= fetch('/__litgraph/bootstrap', { method: 'POST' }).then(async r => { if (!r.ok) throw new Error('本地服务不可用，请使用 LitGraph 本地启动器打开。'); return r.json(); }).catch(e => { boot = null; throw e; });
  const { browserToken } = await boot;
  const response = await fetch(`/__litgraph/${route}`, { method: data === undefined ? 'GET' : 'POST', ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${browserToken}` }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (response.status === 401) boot = null;
  if (!response.ok) throw new Error(result.error || '本地服务请求失败');
  return result;
}
export async function refreshExternal() { try { state = await localRequest('status'); } catch { state = { connected: false }; } return state; }
export async function externalInstructions(context, language = 'zh') {
  await localRequest('context', context);
  const data = await localRequest('instructions', {});
  state = { connected: false };
  const config = { command: data.node, args: [data.script, data.url, data.token] };
  if (language === 'en') return `Act as my external LitGraph agent and handle AI requests from the application.
Current workspace folder: ${data.root}
Current paper project: ${context.title}
Read this guide first: ${data.guide}
Do not modify application source code or read any model API keys.
Add a local STDIO MCP server named litgraph in your agent tool using this configuration. These are private credentials for this page; do not publish them:
${JSON.stringify(config, null, 2)}
If your current session cannot reload MCP configuration, follow the guide to run the equivalent local HTTP task loop. Do not claim success after merely writing configuration.
A successful litgraph_connect handshake automatically triggers the product dialog “External agent connected”. Complete the handshake to trigger this UI confirmation; do not simulate it by editing the page or source, and do not merely claim success in chat. Call litgraph_connect with your actual model name and image-reading capability. Report "Unknown model" if the name is unavailable. Keep calling litgraph_next_task(wait_ms=25000), follow each task's messages contract, and return a result string through litgraph_submit_result. For literature discovery, follow the search-plan or relevance-assessment JSON contract in each task. LitGraph performs real database retrieval and lawful downloads; do not generate paper records from memory or require your own web-search tool for these tasks. Research answers should use the supplied full text without extra source labels by default; mark your own inferences as [AI inference]. Follow the requested quick/expert speed-versus-depth preference and response language.
Keep waiting when idle until I ask you to stop, then disconnect. I will send questions from LitGraph. Keep this task running; do not end after saying "connected". If your tool cannot keep waiting, tell me instead of pretending the website's AI features are available.`;
  return `请作为我的 LitGraph 外部 Agent 处理网站中的 AI 请求。\n当前工作文件夹：${data.root}\n当前论文项目：${context.title}\n先阅读：${data.guide}\n不要修改软件源码或读取任何模型 API 密钥。\n请在你所在工具中添加名为 litgraph 的本地 STDIO MCP 服务，配置如下（这是连接本次页面的私有凭据，不要公开）：\n${JSON.stringify(config, null, 2)}\n若 MCP 配置不能在当前会话重新加载，可按指南通过本机 HTTP 接口执行同样的任务循环；不要仅写好配置就声称接入成功。\n调用 litgraph_connect 成功后，LitGraph 会自动弹窗显示“外部 Agent 接入成功”。请完成此握手来触发产品内确认，不要仅在聊天中声称成功，也不要修改页面或源码来伪造弹窗。使用 litgraph_connect 报告真实模型名称及实际图片读取能力，不知道模型名称则明确写“模型未知”。然后持续调用 litgraph_next_task(wait_ms=25000)，按任务提供的 messages 规范处理，并以 litgraph_submit_result 回传 result 字符串。文献发现按每次任务生成检索策略或评估提供的真实文献记录，遵守对应 JSON 规范；LitGraph 负责数据库检索和合法下载，不要凭记忆生成文献，也不要因自身没有联网工具而拒绝策略或相关性评估任务；研究回答默认依据提供的原文但不额外标注来源，自己的推断标记【AI 推断】，按本次快速或专家模式的任务要求回答。无任务时继续等待，直到我要求停止；停止前 disconnect。\n我将在 LitGraph 网页中发送问题。你必须保持当前任务运行，不能发送“已连接”后结束。若你的工具无法持续等待，请直接告诉我，不能假装网站功能已可用。`;
}
export async function externalCompletion(messages, maxTokens, signal) {
  signal?.throwIfAborted();
  const { id } = await localRequest('tasks', { messages, maxTokens }, { signal });
  const cancel = () => { void localRequest(`tasks/${id}`, undefined, { method: 'DELETE' }).catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) { cancel(); signal.throwIfAborted(); }
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const job = await localRequest(`tasks/${id}`, undefined, { signal });
      if (job.state === 'done') return job.result;
      await new Promise(resolve => setTimeout(resolve, 700));
      if (!(await refreshExternal()).connected) throw new Error('外部 Agent 已离线，请让它恢复任务循环后重试。');
    }
    throw new Error('外部 Agent 超过 15 分钟未返回，请检查它的任务状态。');
  } finally { signal?.removeEventListener('abort', cancel); cancel(); }
}
