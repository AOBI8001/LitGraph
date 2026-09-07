export const normalizeResearchMode = mode => mode === 'expert' ? 'expert' : 'quick';

export function researchModePolicy(mode) {
  return normalizeResearchMode(mode) === 'expert'
    ? { mode: 'expert', priority: 'depth', evidenceBudget: 42000, instruction: 'Expert is a provider-independent speed/depth preference, not a model identity or a request for longer prose. Prioritize depth over latency: carefully compare the supplied methods, results, contradictions, alternative explanations and limitations relevant to the question. Check whether conclusions really follow from the evidence. Give a focused final answer at the length the question needs; do not expose internal reasoning.' }
    : { mode: 'quick', priority: 'speed', evidenceBudget: 28000, instruction: 'Quick is a provider-independent speed/depth preference, not a model identity or merely a short-answer instruction. Prioritize a timely final answer: focus analysis on the most relevant evidence and the current question, avoid unnecessary exhaustive exploration, and state the key result directly. Keep the same evidence and uncertainty standards as expert mode; never sacrifice accuracy or replace missing evidence with guesses.' };
}

// Send vendor-specific controls only for known switchable DeepSeek models.
// Generic compatible APIs and external agents receive the mode instruction only.
export function researchThinkingOptions(config, protocol, mode) {
  const model = config?.model || '';
  const deepseek = /deepseek/i.test(`${config?.provider || ''} ${model} ${config?.endpoint || ''}`);
  if (!deepseek || !/deepseek-(?:v4|v3\.2|chat)(?:\b|[-/])/i.test(model)) return {};
  const expert = normalizeResearchMode(mode) === 'expert';
  if (protocol === 'openai-responses') return { reasoning: { effort: expert ? 'high' : 'none' } };
  const thinking = { type: expert ? 'enabled' : 'disabled' };
  if (protocol === 'anthropic-messages') return { thinking, ...(expert && /deepseek-v4/i.test(model) ? { output_config: { effort: 'high' } } : {}) };
  return { thinking, ...(expert && /deepseek-v4/i.test(model) ? { reasoning_effort: 'high' } : {}) };
}
