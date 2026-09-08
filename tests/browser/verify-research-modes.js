async (page) => {
  const backup = await page.evaluate(() => ({ ...localStorage }));
  const pattern = '**/src/main.js*';
  const inject = async route => { const response = await route.fetch(); await route.fulfill({response, body: await response.text() + `\nwindow.__researchQA={async setup(){activateProjectData(createSampleProject(),'qa-research-'+crypto.randomUUID());for(const node of nodes)await saveFulltext(currentProjectId,node,{fileName:'fixture.md',sourceKind:'markdown',markdown:'# Synthetic test source\\n\\n这是一段自动化测试用的原文，不是实际论文结论。研究方法采用实验设计，测量抑制控制和反应时间，并比较参与者的任务表现。主要结果说明研究设计、样本和测量指标需要共同考虑。'});saveCurrentProject()}};`}); };
  const requests = [];
  let behavior = 'answer';
  const blocked = [];
  const answer = { answer: '研究空间交互测试：回答依据本次提供的原文片段，不额外显示证据编号。\n\n【AI 推断】这一句是用于检查推断标记的模拟内容，不是实际论文分析。', suggested_followups: ['该研究怎样测量抑制控制？', '哪些设计差异值得进一步比较？', '这一解释还缺少什么信息？'] };
  const handler = async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    if (behavior === 'pending') { blocked.push(route); return; }
    const message = behavior === 'reasoning' ? { content: '', reasoning_content: 'PRIVATE_TEST_REASONING' } : { content: JSON.stringify(answer) };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message }] }) });
  };
  const waitRequests = async count => { for (let i=0; i<120 && requests.length<count; i++) await page.waitForTimeout(250); if(requests.length<count) throw new Error('No model request'); };
  const send = async text => { await page.locator('#deep-read-input').fill(text); await page.locator('#deep-read-input').press('Enter'); };
  try {
    await page.route(pattern, inject);
    await page.route('https://litgraph-model.test/**', handler);
    await page.evaluate(() => {
      localStorage.setItem('litgraph.language', 'zh');
      localStorage.setItem('litgraph.aiConfig', JSON.stringify({ model: 'deepseek-v4-pro', endpoint: 'https://litgraph-model.test/v1', apiKey: 'fixture-not-a-key', provider: 'deepseek', protocol: 'openai-chat', verified: true }));
      localStorage.removeItem('litgraph.researchMode');
      Object.keys(localStorage).filter(k => k.startsWith('litgraph.chat.')).forEach(k => localStorage.removeItem(k));
    });
    await page.setViewportSize({ width: 1329, height: 958 }); await page.reload();
    await page.waitForFunction(() => window.__researchQA);
    await page.evaluate(() => window.__researchQA.setup());
    await page.getByRole('button', { name: '研究空间', exact: true }).click();
    if(await page.locator('#research-response-mode').inputValue() !== 'quick') throw new Error('Quick not default');
    await send('比较所有论文的主要结果'); await waitRequests(1);
    await page.locator('.chat-turn.assistant[data-status="done"]').waitFor();
    const quick = requests[0], payload = JSON.parse(quick.messages[1].content);
    if(quick.thinking.type !== 'disabled' || quick.max_tokens !== 8192 || payload.response_mode !== 'quick') throw new Error('Quick controls not sent');
    if(payload.evidence_level !== 'retrieved_source_excerpts' || payload.coverage.length !== 50) throw new Error('Paper scope/evidence lost');
    if(payload.evidence.reduce((n,e)=>n+e.text.length,0)>28000) throw new Error('Quick evidence exceeds budget');
    if(payload.documents.some(d=>d.ai_summary || d.abstract)) throw new Error('Duplicate fulltext abstracts/summaries');
    if(await page.locator('.research-sources').count()) throw new Error('Unwanted source display');
    if(await page.locator('.research-prompt-list button').count() !== 3) throw new Error('Followups missing');
    await page.locator('#research-response-mode').selectOption('expert'); behavior='reasoning';
    await send('请深入比较这些研究的方法差异'); await waitRequests(2);
    await page.locator('.research-retry-quick').waitFor();
    if(requests[1].thinking.type!=='enabled' || requests[1].reasoning_effort!=='high' || requests[1].max_tokens!==32768) throw new Error('Expert controls not sent');
    if((await page.locator('.deep-read-history').innerText()).includes('PRIVATE_TEST_REASONING')) throw new Error('Reasoning leaked');
    await page.waitForTimeout(1200); if(requests.length!==2) throw new Error('Unexpected automatic retry');
    behavior='answer'; await page.locator('.research-retry-quick').click(); await waitRequests(3);
    await page.locator('.chat-turn.assistant[data-status="done"]').nth(1).waitFor();
    if(requests[2].thinking.type!=='disabled') throw new Error('Recovery did not switch thinking');
    if(await page.locator('.chat-turn.user').count() !== 2) throw new Error('Recovery duplicated question');
    const geometry=await page.locator('.deep-read-window').evaluate(el=>{
      const r=el.getBoundingClientRect(),h=el.querySelector('.deep-read-history'),f=el.querySelector('.deep-read-form'),s=el.querySelector('.research-send').getBoundingClientRect(),m=el.querySelector('#research-response-mode').getBoundingClientRect();
      return {width:r.width,height:r.height,right:innerWidth-r.right,historyHeight:h.getBoundingClientRect().height,composerHeight:f.getBoundingClientRect().height,overflow:el.scrollWidth>el.clientWidth,alignment:Math.abs(s.y+s.height/2-m.y-m.height/2)};
    });
    if(geometry.historyHeight<500 || geometry.composerHeight>90 || geometry.right<20 || geometry.overflow || geometry.alignment>1) throw new Error(JSON.stringify(geometry));
    await page.screenshot({ path:'output/playwright/research-modes-light.png' });
    await page.getByRole('button',{name:'切换到夜间模式',exact:true}).click();
    await page.screenshot({ path:'output/playwright/research-modes-dark.png' });
    behavior='pending'; await page.locator('#research-response-mode').selectOption('expert');
    await send('暂停再继续测试'); await waitRequests(4);
    await page.locator('.research-send[data-mode="pause"]').click();
    await page.locator('.research-send[data-mode="resume"]').waitFor();
    await page.locator('#research-response-mode').selectOption('quick');
    await page.locator('.research-send[data-mode="resume"]').click(); await waitRequests(5);
    if(requests[4].thinking.type !== 'enabled') throw new Error('Resume changed captured mode');
    await page.locator('.research-send[data-mode="pause"]').click();
    for(const route of blocked) await route.abort().catch(()=>{});
    await page.getByRole('button',{name:'关闭研究空间',exact:true}).click();
    await page.getByRole('button',{name:'研究空间',exact:true}).click();
    if(await page.locator('#research-response-mode').inputValue() !== 'quick') throw new Error('Mode preference not retained');
    return { verified:'actual request controls, 50-paper fulltext scope, source-free answer, inference display, no auto retry, manual recovery, followups, pause/resume mode snapshot, light/dark geometry', geometry, evidenceChunks:payload.evidence.length, requestCharacters:JSON.stringify(quick).length };
  } finally {
    await page.unroute(pattern, inject);
    for(const route of blocked) await route.abort().catch(()=>{});
    await page.unroute('https://litgraph-model.test/**', handler);
    await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v));}, backup);
    await page.reload();
  }
}
