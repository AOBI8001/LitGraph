let boot;
let state = { connected: false };
export const externalState = () => state;
export async function copyTextToClipboard(text, language = 'zh') {
  if (typeof text !== 'string') throw new TypeError('Clipboard text must be a string');
  if (window.litgraphDesktop?.copyText) {
    if (await window.litgraphDesktop.copyText(text) !== true) throw new Error(language === 'en' ? 'The clipboard could not be updated.' : '未能更新剪贴板。');
    return true;
  }
  // Browser preview uses the standard API first. A delayed network response can
  // expire user activation, so retain a selectable-text fallback for that case.
  if (!document.hasFocus()) window.focus();
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch {}
  const previousFocus = document.activeElement;
  const selection = document.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-label', language === 'en' ? 'Text to copy' : '待复制文本');
  textarea.style.cssText = 'position:fixed;inset:0 auto auto 0;width:1px;height:1px;opacity:0;pointer-events:none;';
  // Keep the fallback inside an active modal dialog, where other content is inert.
  (document.querySelector('dialog[open]') || document.body).append(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (document.execCommand('copy')) return true;
  } catch {} finally {
    textarea.remove();
    if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
    if (selection && ranges.length) { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range); }
  }
  const error = new Error(language === 'en' ? 'The browser blocked clipboard access. Focus this window and try again, or copy the displayed instructions manually.' : '浏览器阻止了剪贴板访问。请先点击此窗口后重试，或手动复制接入说明。');
  error.copyText = text;
  throw error;
}
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
  const config = { command: data.node, args: [...(data.argsPrefix || [data.script]), ...(data.connectionFile?['--connection-file',data.connectionFile]:[data.url,data.token])] };
  if (data.env) config.env = data.env;
  if (language === 'en') return `Act as my external LitGraph agent and handle AI requests from the application.
Current installation folder: ${data.installRoot}
Current user data folder: ${data.root}
Current paper project: ${context.title}
Read this guide first: ${data.guide}
Literature discovery contract: ${data.contracts.discovery}
Research space contract: ${data.contracts.research}
Shared retrieval/download contract: ${data.contracts.downloads}
Do not modify application source code or read any model API keys.
Register this local STDIO MCP server once in your agent tool's persistent configuration. On desktop, its connection file discovers the current running LitGraph instance after restarts; do not hard-code the port or copy credentials out of that file. Keep the configuration private:
${JSON.stringify(config, null, 2)}
If your current session cannot reload MCP configuration, follow the guide to run the equivalent local HTTP task loop. Do not claim success after merely writing configuration.
A successful litgraph_connect handshake automatically triggers the product dialog “External agent connected”. Complete the handshake to trigger this UI confirmation; do not simulate it by editing the page or source, and do not merely claim success in chat. Call litgraph_connect with your actual model name and image-reading capability. Report "Unknown model" if the name is unavailable. Keep calling litgraph_next_task(wait_ms=25000), follow each task's messages contract, and return a result string through litgraph_submit_result. For literature discovery, follow the search-plan JSON contract in each task. LitGraph performs real database retrieval and lawful downloads; do not generate paper records from memory or require your own web-search tool for these tasks. Research answers must cite factual claims with supplied evidence IDs such as [E2]; LitGraph appends their actual PDF page / Markdown line locations. Cite comparison papers separately and mark your own inferences as [AI inference]. Research answer is a Markdown string inside the required JSON with three plain-text suggested_followups; paper summaries are plain-text paragraphs in the summary/classification/relationships JSON. Follow the same presentation contract as API mode and the requested quick/expert preference and response language.
Keep waiting when idle until I ask you to stop, then disconnect. I will send questions from LitGraph. Keep this task running; do not end after saying "connected". If your tool cannot keep waiting, tell me instead of pretending the website's AI features are available.`;
  return `请作为我的 LitGraph 外部 Agent 处理应用中的 AI 请求。\n当前安装文件夹：${data.installRoot}\n当前用户数据文件夹：${data.root}\n当前论文项目：${context.title}\n先阅读：${data.guide}\n文献发现规范：${data.contracts.discovery}\n研究空间规范：${data.contracts.research}\n共用检索下载规范：${data.contracts.downloads}\n不要修改软件源码或读取任何模型 API 密钥。\n请在你所在工具的持久化设置中一次性注册名为 litgraph 的本地 STDIO MCP 服务。安装版通过连接文件自动发现当前运行的 LitGraph，软件重启后不需要重新复制配置，不要把端口写死或把连接文件中的凭据另行复制出来。配置如下（请勿公开）：\n${JSON.stringify(config, null, 2)}\n若 MCP 配置不能在当前会话重新加载，可按指南通过本机 HTTP 接口执行同样的任务循环；不要仅写好配置就声称接入成功。\n调用 litgraph_connect 成功后，LitGraph 会自动弹窗显示“外部 Agent 接入成功”。请完成此握手来触发产品内确认，不要仅在聊天中声称成功，也不要修改页面或源码来伪造弹窗。使用 litgraph_connect 报告真实模型名称及实际图片读取能力，不知道模型名称则明确写“模型未知”。然后持续调用 litgraph_next_task(wait_ms=25000)，按任务提供的 messages 规范处理，并以 litgraph_submit_result 回传 result 字符串。文献发现仅生成检索策略，遵守对应 JSON 规范，不进行候选论文的二次评估；LitGraph 负责数据库检索和合法下载，不要凭记忆生成文献，也不要因自身没有联网工具而拒绝检索策略任务；研究回答依据提供的原文，事实后标注本次证据编号如 [E2]，软件显示真实 PDF 文件页或 MD 行号；比较论文分别标注，自己的推断标记【AI 推断】，研究回答在 JSON 的 answer 字段内使用 Markdown，并另外提供三个纯文本 suggested_followups；论文总结按纯文本段落返回，保留分类和关系 JSON。两种接入方式遵守同一格式规范，按本次快速或专家偏好回答。无任务时继续等待，直到我要求停止；停止前 disconnect。\n我将在 LitGraph 应用中发送问题。你必须保持当前任务运行，不能发送“已连接”后结束。若你的工具无法持续等待，请直接告诉我，不能假装应用功能已可用。`;
}
export async function externalCompletion(messages, maxTokens, signal, researchMode = 'quick') {
  signal?.throwIfAborted();
  const id = crypto.randomUUID();
  const cancel = () => { void localRequest(`tasks/${id}`, undefined, { method: 'DELETE' }).catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) { cancel(); signal.throwIfAborted(); }
    await localRequest('tasks', { requestId: id, messages, maxTokens, researchMode }, { signal });
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const job = await localRequest(`tasks/${id}`, undefined, { signal });
      if (job.state === 'done') return job.result;
      if (job.state === 'failed') throw new Error(job.error || 'Agent task failed.');
      if (job.state === 'cancelled') throw new DOMException('Agent task cancelled.', 'AbortError');
      await new Promise(resolve => setTimeout(resolve, 700));
      if (!(await refreshExternal()).connected) throw new Error('外部 Agent 已离线，请在模型接入中重新连接；手动 MCP 接入需要恢复任务循环。');
    }
    throw new Error('外部 Agent 超过 15 分钟未返回，请检查它的任务状态。');
  } finally { signal?.removeEventListener('abort', cancel); cancel(); }
}
