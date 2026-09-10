export const normalizeResearchMode = mode => mode === 'expert' ? 'expert' : 'quick';

export function researchModePolicy(mode) {
  return normalizeResearchMode(mode) === 'expert'
    ? { mode: 'expert', priority: 'depth', evidenceBudget: 42000, instruction: 'Expert is a provider-independent speed/depth preference, not a model identity or a request for longer prose. Prioritize depth over latency: carefully compare the supplied methods, results, contradictions, alternative explanations and limitations relevant to the question. Check whether conclusions really follow from the evidence. Give a focused final answer at the length the question needs; do not expose internal reasoning.' }
    : { mode: 'quick', priority: 'speed', evidenceBudget: 28000, instruction: 'Quick is a provider-independent speed/depth preference, not a model identity or merely a short-answer instruction. Prioritize a timely final answer: focus analysis on the most relevant evidence and the current question, avoid unnecessary exhaustive exploration, and state the key result directly. Keep the same evidence and uncertainty standards as expert mode; never sacrifice accuracy or replace missing evidence with guesses.' };
}

// Only documented model/protocol combinations receive native controls.
// Unknown compatible APIs and external agents retain the shared instructions.
export function researchThinkingOptions(config, protocol, mode) {
  const model = config?.model || '';
  const effort=normalizeResearchMode(mode)==='expert'?'high':'low';
  if(model==='gpt-6-astra'&&protocol==='openai-responses')return {reasoning:{effort}};
  if(model==='kimi-k3'&&protocol==='openai-chat')return {reasoning_effort:effort};
  if(model==='glm-5.3'&&protocol==='openai-chat')return {thinking:{type:'enabled'},reasoning_effort:effort};
  if(model==='kimi-k2.6'&&protocol==='openai-chat')return {thinking:{type:effort==='high'?'enabled':'disabled'}};
  const deepseek = /deepseek/i.test(`${config?.provider || ''} ${model} ${config?.endpoint || ''}`);
  if (!deepseek || !/deepseek-(?:v4|v3\.2|chat)(?:\b|[-/])/i.test(model)) return {};
  const expert = normalizeResearchMode(mode) === 'expert';
  if (protocol === 'openai-responses') return { reasoning: { effort: expert ? 'high' : 'none' } };
  const thinking = { type: expert ? 'enabled' : 'disabled' };
  if (protocol === 'anthropic-messages') return { thinking, ...(expert && /deepseek-v4/i.test(model) ? { output_config: { effort: 'high' } } : {}) };
  return { thinking, ...(expert && /deepseek-v4/i.test(model) ? { reasoning_effort: 'high' } : {}) };
}

export function compatibleModelBody(body, config, protocol, options={}) {
  const model=config?.model||'';
  const kimi=/^kimi-(?:k3|k2\.6|k2\.7-code(?:-highspeed)?)$/.test(model)&&protocol==='openai-chat';
  const reasoning=kimi||(/^glm-5\.3(?:-flash)?$/.test(model)&&protocol==='openai-chat')||(model==='gpt-6-astra'&&protocol==='openai-responses');
  if(kimi||(/^claude-(?:fable-5|opus-5|sonnet-5)/.test(model)&&protocol==='anthropic-messages'))delete body.temperature;
  if(reasoning){
    const key=protocol==='openai-responses'?'max_output_tokens':'max_tokens';
    body[key]=Math.max(body[key]||0,options.connectionTest?2048:options.researchMode==='expert'?16384:8192);
  }
  return body;
}
