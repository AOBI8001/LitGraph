export class AIResponseError extends Error {
  constructor(code, message) { super(message); this.name = 'AIResponseError'; this.code = code; }
}

const textBlocks = content => typeof content === 'string' ? content : Array.isArray(content)
  ? content.filter(item => ['text', 'output_text'].includes(item?.type)).map(item => typeof item.text === 'string' ? item.text : item.text?.value || '').join('\n') : '';

export function extractAIText(payload, protocol = 'openai-chat') {
  if (payload?.error) throw new AIResponseError('provider_error', payload.error.message || '模型服务返回错误，请检查账户额度或服务状态');
  const choice = payload?.choices?.[0];
  const reason = protocol === 'anthropic-messages' ? payload?.stop_reason : protocol === 'openai-responses' ? payload?.incomplete_details?.reason : choice?.finish_reason;
  if (['length', 'max_tokens', 'max_output_tokens'].includes(reason)) {
    throw new AIResponseError('output_limit', '模型达到输出上限，尚未完成最终回答。请缩小论文范围或简化问题后重试；这不是接口格式不兼容');
  }
  if (['content_filter', 'refusal'].includes(reason) || choice?.message?.refusal) throw new AIResponseError('refusal', '模型服务未提供此问题的回答，请调整问题后重试');
  if (protocol === 'openai-responses' && ['failed', 'incomplete', 'cancelled'].includes(payload?.status)) throw new AIResponseError('incomplete', '模型请求未完成，请重试或检查模型服务状态');
  const content = protocol === 'anthropic-messages' ? textBlocks(payload?.content)
    : protocol === 'openai-responses' ? textBlocks(payload?.output_text) || textBlocks(payload?.output?.flatMap(item => item.content || []))
      : textBlocks(choice?.message?.content);
  if (content.trim()) return content.trim();
  // Never substitute private reasoning for the final, evidence-grounded answer.
  if (choice?.message?.reasoning_content) throw new AIResponseError('reasoning_only', '模型返回了思考内容，但最终回答为空。可点击“用快速模式重试”；若快速模式仍失败，请检查服务商是否支持关闭思考或更换模型。未将思考内容当作答案');
  if (choice?.message?.tool_calls?.length) throw new AIResponseError('tool_calls', '模型要求调用工具，但当前研究问答未接入该工具；未获得最终回答');
  throw new AIResponseError('empty_answer', '模型服务没有返回可显示的最终回答。请确认所选接口协议，或稍后重试');
}

export async function readAIResponse(response, protocol) {
  let payload;
  try { payload = await response.json(); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new AIResponseError('invalid_json', `接口未返回有效 JSON（HTTP ${response.status}），请检查 API 地址或代理服务；不要填写普通聊天网页地址`);
  }
  if (!response.ok) throw new AIResponseError('http_error', payload?.error?.message || `模型服务返回 HTTP ${response.status}`);
  return extractAIText(payload, protocol);
}

export function researchTokenBudget(config, mode) {
  if (mode === 'quick' && !/reasoner/i.test(config?.model || '')) return 8192;
  if (mode === 'expert' && /deepseek-v4/i.test(config?.model || '')) return 32768;
  return /deepseek/i.test(`${config?.provider || ''} ${config?.model || ''} ${config?.endpoint || ''}`) ? 16384 : 8192;
}
