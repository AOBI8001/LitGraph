import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {dashboard} from '../cloudflare/metrics/dashboard.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let authenticated=false;
 await page.route('https://metrics.test/**',async route=>{
  if(route.request().url().endsWith('/stats'))return route.fulfill(authenticated?{json:{totalInstalls:12,summary:{today:'2026-09-11',weekStart:'2026-09-05',monthStart:'2026-08-13',dau:3,wau:6,mau:9,actionsToday:12,newInstalls30:10,activated30:6,activationRate30:.6,returningToday:2,dauMauRatio:1/3,actionsPerActive:4},days:[{day:'2026-09-11',newInstalls:1,usedInstalls:3,activeInstalls:4,launches:6,uses:12}],retention:[{cohort:'2026-09-10',installs:2,day1:{mature:true,count:1,rate:.5,provisional:true},day7:{mature:false},day30:{mature:false}}]}}:{status:401,json:{error:'Unauthorized'}});
  return route.fulfill({contentType:'text/html',body:dashboard});
 });
 await page.goto('https://metrics.test/');
 assert.equal(await page.locator('#report').isVisible(),false);
 await page.locator('#token').fill('synthetic-test-key');await page.locator('#load').click();
 await page.waitForFunction(()=>document.querySelector('#error').textContent.includes('密钥不正确'));
 assert.equal(await page.locator('#report').isVisible(),false);
 authenticated=true;await page.locator('#load').click();await page.locator('#report').waitFor();
 assert.equal(await page.locator('.card').count(),9);
 assert.ok((await page.locator('#retention-rows').textContent()).includes('待观察'));
 await mkdir('output/playwright',{recursive:true});
 for(const width of [1280,375]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'output/playwright/metrics-'+width+'.png',fullPage:true});}
 assert.deepEqual(errors,[]);
 console.log('Metrics dashboard: authorization errors, summary/retention rendering, desktop/mobile layouts and no page errors passed.');
}finally{await browser.close();}
