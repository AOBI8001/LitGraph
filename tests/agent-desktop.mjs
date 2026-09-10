import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
await mkdir('output/desktop', { recursive: true });
const dataRoot = await mkdtemp(path.join(root, 'output/desktop/agent-'));
const live = process.env.LITGRAPH_LIVE_AGENT_TEST === '1';
const options = { executablePath: process.env.LITGRAPH_TEST_EXECUTABLE || path.join(root, 'node_modules/electron/dist/electron.exe'), args: process.env.LITGRAPH_TEST_EXECUTABLE ? [] : [root], env: { ...process.env, LITGRAPH_TEST_MODE: '1', LITGRAPH_TEST_DATA: dataRoot }, timeout: 45000 };
delete options.env.ELECTRON_RUN_AS_NODE;
let application;
const errors = [];
try {
  application = await electron.launch(options);
  let page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#empty-model-access').click();
  assert.equal(await page.locator('#connect-agent-runtime').textContent(), '连结并验证');
  for(const id of ['gpt-6-astra','claude-fable-5-1','kimi-k3','kimi-k2.7-code','glm-5.3','glm-5.3-flash'])assert.equal(await page.locator(`#api-model option[value="${id}"]`).count(),1);
  assert.equal(await page.locator('.manual-agent-access').getAttribute('open'), null);
  await page.screenshot({ path: 'output/desktop/agent-connection-zh.png' });
  if (live) {
    await page.locator('#connect-agent-runtime').click();
    await page.locator('#agent-connected-dialog[open]').waitFor({ timeout: 100000 });
    assert.match(await page.locator('#agent-connected-dialog').innerText(), /按需调用/);
    await page.locator('#agent-connected-dialog .primary').click();
    for (const purpose of ['literature-discovery', 'paper-analysis', 'research-question']) {
      const response = await page.evaluate(async purpose => {
        const { browserToken } = await fetch('/__litgraph/bootstrap', { method: 'POST' }).then(r => r.json());
        const headers = { Authorization: `Bearer ${browserToken}`, 'Content-Type': 'application/json' };
        const messages = [{ role: 'system', content: 'LitGraph transport test with synthetic evidence. Return JSON only: {"purpose":string,"value":number}. No tools.' }, { role: 'user', content: `Purpose: ${purpose}. A synthetic study had three groups of ten participants. Return the total participants as value.` }];
        const { id, error } = await fetch('/__litgraph/tasks', { method: 'POST', headers, body: JSON.stringify({ messages, maxTokens: 150, researchMode: 'quick' }) }).then(r => r.json());
        if (!id) throw Error(error);
        try {
          const end = Date.now() + 90000;
          while (Date.now() < end) {
            const job = await fetch(`/__litgraph/tasks/${id}`, { headers }).then(r => r.json());
            if (job.state === 'done') return job.result;
            if (job.state === 'failed') throw Error(job.error);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          throw Error('Live task timed out');
        } finally { await fetch(`/__litgraph/tasks/${id}`, { method: 'DELETE', headers }); }
      }, purpose);
      assert.deepEqual(JSON.parse(response.replace(/^```(?:json)?\s*|\s*```$/g, '')), { purpose, value: 30 });
      console.log(`Live Codex roundtrip passed: ${purpose}`);
    }
    await application.close();
    application = await electron.launch(options);page = await application.firstWindow();
    await page.locator('#agent-connected-dialog[open]').waitFor({ timeout: 15000 });
    await page.locator('#agent-connected-dialog .primary').click();
    assert.equal(await page.evaluate(async () => (await window.litgraphDesktop.agentRuntime('status')).configured), true);
    await page.locator('#empty-model-access').click();
    await page.locator('#disconnect-agent').click();
    assert.equal(await page.evaluate(async () => (await window.litgraphDesktop.agentRuntime('status')).configured), false);
  }
  await page.locator('[data-close-modal="api"]').first().click();
  await page.locator('[data-panel="literature-discovery"]').click();
  await page.locator('[data-discovery-value="institution"]').click();
  assert.equal(await page.locator('.discovery-institution-popover label > span').count(), 0);
  assert.equal(await page.locator('.discovery-strategy button').count(), 0);
  assert.equal(await page.locator('.discovery-strategy p').textContent(), '模型制定检索策略并分析；软件检索 OpenAlex 等真实来源。因部分原文可能受限，目标检索数量可能不等于实际导入数量。');
  await page.screenshot({ path: 'output/desktop/institution-copy-zh.png' });
  await page.evaluate(() => { localStorage.setItem('litgraph.language', 'en'); window.litgraphDesktop.saveState({ ...localStorage }); });
  await page.reload();await page.locator('#empty-model-access').click();
  assert.equal(await page.locator('#connect-agent-runtime').textContent(), 'Connect & verify');
  assert.match(await page.locator('.manual-agent-access summary').textContent(), /manual MCP/);
  await page.screenshot({ path: 'output/desktop/agent-connection-en.png' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, live, tests: ['Agent UI', 'institution copy', 'removed extra button', 'bilingual labels', ...(live ? ['Codex login verification', 'three task types', 'restart and disconnect'] : [])] }));
} finally { await application?.close().catch(() => {}); }
