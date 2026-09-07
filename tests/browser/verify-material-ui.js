async (page) => {
await page.reload();
await page.getByRole('button',{name:'研究空间',exact:true}).click();
if (!process.env.LITGRAPH_TEST_PDF) throw new Error('Set LITGRAPH_TEST_PDF to a local PDF fixture before running this optional material test.');
await page.locator('.research-file-input').setInputFiles(process.env.LITGRAPH_TEST_PDF);
await page.locator('[data-remove-attachment]').waitFor({timeout:30000});
const pdfChip = await page.locator('.research-attachments').innerText();
if (!pdfChip.includes('.pdf')) throw new Error('PDF not parsed into attachment');
await page.locator('.deep-read-form').evaluate(el => { const dt=new DataTransfer(); dt.items.add(new File(['# Dragged source\n\nA test passage.'],'dragged.md',{type:'text/markdown'})); window.__testDrop=dt; el.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:dt})); });
if (!(await page.locator('.research-drop-feedback').isVisible()))throw new Error('drag feedback missing');
await page.screenshot({path:'output/playwright/research-file-drop.png'});
await page.locator('.deep-read-form').evaluate(el=>el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__testDrop})));
await page.waitForFunction(()=>document.querySelector('.research-attachments').textContent.includes('dragged.md'));
if(await page.locator('#paper-import-modal').isVisible())throw new Error('chat drop leaked to general importer');
await page.getByRole('button',{name:'切换到夜间模式',exact:true}).click();
await page.screenshot({path:'output/playwright/research-window-dark-verified.png'});
await page.getByRole('button',{name:'文献发现 AI',exact:true}).click();
await page.screenshot({path:'output/playwright/discovery-window-dark-verified.png'});
const geometry=await page.locator('.literature-discovery-window').evaluate(el=>({width:el.getBoundingClientRect().width,right:innerWidth-el.getBoundingClientRect().right,scroll:el.scrollWidth>el.clientWidth,conditionScroll:el.querySelector('.discovery-conditions').scrollHeight>el.querySelector('.discovery-conditions').clientHeight}));
await page.getByRole('button',{name:'切换到日间模式',exact:true}).click();
await page.reload();
return {pdfChip,dragDrop:'passed',geometry};
}
