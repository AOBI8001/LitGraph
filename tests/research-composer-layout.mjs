import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const url=process.env.LITGRAPH_VISUAL_URL||'http://127.0.0.1:4372/';
const output=path.resolve('output/playwright');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/src/main.js*',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:await response.text()+`\nwindow.__researchVisual={set(lang,themeName){
    language=lang;applyLanguage();applyTheme(themeName);openDeepReadWindow();
    researchTabs=[projectResearchTab(),{id:'paper.visual-a',type:'paper',nodeIds:[],label:'Fineberg et al. · 2020'},{id:'paper.visual-b',type:'paper',nodeIds:[],label:'Response inhibition · 2023'}];
    activeResearchTabId='project';const key=researchTabChatKey(researchTabs[0]);
    const en=lang==='en';localStorage.setItem(key,JSON.stringify([
      {role:'user',text:en?'What do these studies agree on, and where do their methods differ?':'这些研究有哪些共同结论？研究方法上又有哪些差异？',time:'14:20'},
      {role:'assistant',status:'done',text:en?'### Shared findings and differences\\n\\nThe papers approach **response inhibition** from complementary perspectives. Compare each study’s task, participant group, and outcome measure before combining its conclusions.\\n\\n- **Shared finding:** the task context matters when interpreting performance.\\n- **Methodological difference:** response time and error rate capture different aspects of the task.\\n\\n> AI inference: the differences may help explain why results vary across studies.':'### 共同结论与方法差异\\n\\n这些论文从不同角度讨论了**反应抑制**。综合结论前，需要先对照各研究的任务设计、参与者群体与测量指标。\\n\\n- **共同发现：** 解释任务表现时，需要考虑任务所处的情境。\\n- **方法差异：** 反应时与错误率分别反映任务表现的不同侧面。\\n\\n> AI 推断：这些差异可能有助于解释不同研究之间的结果变化。',time:'14:20',suggested_followups:en?['Compare the tasks','Explain the limitations','Identify the next question']:['比较任务设计','说明研究局限','提出后续问题']}
    ]));renderResearchDesk();
  }};`});
});
try{
  await page.goto(url);await page.waitForFunction(()=>window.__researchVisual);
  const checks=[];
  for(const [language,theme,narrow] of [['zh','light',false],['en','light',false],['zh','dark',false],['en','dark',true]]){
    await page.evaluate(([lang,themeName])=>window.__researchVisual.set(lang,themeName),[language,theme]);
    if(narrow)await page.locator('.research-floating-window.deep-read-window').evaluate(el=>Object.assign(el.style,{width:'530px',height:'410px'}));
    await page.locator('#deep-read-input').fill(language==='en'?'How can we compare the findings more carefully?':'进一步比较这些论文的方法与结论。');
    const layout=await page.locator('.deep-read-form').evaluate(form=>{
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      return {form:rect(form),input:rect(form.querySelector('textarea')),add:rect(form.querySelector('.research-add-file')),mode:rect(form.querySelector('.research-mode-control')),send:rect(form.querySelector('.research-send')),scroll:form.scrollWidth,client:form.clientWidth,shadow:getComputedStyle(form).boxShadow};
    });
    assert.equal(layout.shadow,'none');
    assert.ok(layout.scroll<=layout.client+1,'Composer has horizontal overflow');
    for(const field of ['add','mode','send']){
      assert.ok(Math.abs(layout[field].height-layout.add.height)<1,'Toolbar heights differ');
      assert.ok(Math.abs(layout[field].y-layout.add.y)<1,'Toolbar baseline differs');
    }
    assert.ok(layout.input.bottom<=layout.add.y+1,'Text and controls overlap');
    assert.ok(layout.send.right<layout.form.right,'Send exceeds input surface');
    assert.ok(layout.mode.right<=layout.send.x && layout.send.x-layout.mode.right<=8,'Response mode must sit immediately to the left of Send');
    assert.equal(await page.locator('.research-send').isEnabled(),true);
    const file=path.join(output,`research-flat-${language}-${theme}${narrow?'-narrow':''}.png`);
    await page.screenshot({path:file});checks.push({language,theme,narrow,layout,screenshot:file});
  }
  await page.locator('#deep-read-input').fill('First line\nSecond line\nThird line');
  assert.ok(await page.locator('#deep-read-input').evaluate(el=>el.clientHeight>36),'Multiline input did not expand');
  await page.locator('#research-response-mode').selectOption('expert');
  assert.equal(await page.evaluate(()=>localStorage.getItem('litgraph.researchMode')),'expert');
  const add=await page.locator('.research-add-file').boundingBox(),send=await page.locator('.research-send').boundingBox();
  assert.ok(Math.abs(add.y-send.y)<1,'Multiline content moved toolbar controls out of alignment');
  await page.locator('.research-file-input').setInputFiles({name:'Research-notes.md',mimeType:'text/markdown',buffer:Buffer.from('# Research notes\nA short note for the isolated layout test.')});
  await page.locator('.attachment-name').waitFor();
  assert.equal(await page.locator('.attachment-name').innerText(),'Research-notes.md');
  assert.ok(await page.locator('#deep-read-input').evaluate(el=>el.clientHeight>36),'Attachment re-render collapsed multiline draft');
  await page.screenshot({path:path.join(output,'research-flat-en-dark-attachment.png')});
  await page.locator('[data-remove-attachment]').click();
  assert.equal(await page.locator('.attachment-name').count(),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks}));
}finally{await context.close();await browser.close();}
