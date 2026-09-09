// Run against a built preview; optionally set REVIEW_CHANNEL=msedge.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const channel=process.env.REVIEW_CHANNEL || 'chrome';
const browser=await chromium.launch({channel,headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const report={channel,version:browser.version(),checks:[]};
try {for(const reducedMotion of ['no-preference','reduce']) {
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const loaded=()=>page.waitForFunction(()=>window.rhine?.stats().ready&&!document.querySelector('#loading'));
 await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5190/');await loaded();
 let state=await page.evaluate(()=>window.rhine.stats());
 assert.equal(state.mode,reducedMotion==='reduce'?'archive':'boot');
 assert.equal(state.motion.reduced,reducedMotion==='reduce');
 await page.evaluate(()=>window.rhine.archive());
 await page.getByRole('button',{name:'系统设置',exact:true}).click();
 assert.equal(await page.locator('.settings-label').textContent(),'设置');
 const checkbox=page.locator('[data-pref="reduced"]');
 assert.equal(await checkbox.isChecked(),reducedMotion==='reduce');
 if(reducedMotion==='reduce') {
   await page.getByRole('button',{name:'启用完整动效并重播'}).click();
   await page.waitForFunction(()=>window.rhine.stats().mode==='boot');
   assert.equal(await page.locator('.modal-backdrop').count(),0);
   state=await page.evaluate(()=>window.rhine.stats());
   assert.equal(state.motion.reduced,false);assert.equal(state.motion.systemReduced,true);
   await page.evaluate(()=>window.rhine.archive());await page.waitForTimeout(1000);
   await page.locator('[data-action="next"]').click();await page.waitForTimeout(150);
   assert.equal(await page.locator('#stage').evaluate(el=>el.classList.contains('reduce-motion')),false);
   assert.ok((await page.evaluate(()=>window.rhine.stats().pulses.length))>0);
   await page.locator('.read-file').click();
   // The app override also restores document reveals under an OS reduce preference.
   await page.waitForSelector('.document-redaction-window',{state:'attached'});
   assert.equal(await page.locator('.document-redaction-window').first().evaluate(el=>getComputedStyle(el).display),'block');
   await page.reload();await loaded();assert.equal((await page.evaluate(()=>window.rhine.stats())).mode,'boot');
 }
 assert.deepEqual(errors,[]);report.checks.push({reducedMotion,passed:true});await context.close();
}}finally{await browser.close()}
await mkdir('.tools/responsive',{recursive:true});await writeFile(`.tools/responsive/startup-${channel}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
