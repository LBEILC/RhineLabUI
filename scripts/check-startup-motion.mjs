// Run against a built preview; optionally set REVIEW_CHANNEL=msedge.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const channel=process.env.REVIEW_CHANNEL || 'chrome';
const browser=await chromium.launch({channel,headless:true,args:process.platform==='win32'?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:[]});
const report={channel,version:browser.version(),checks:[]};
try {for(const browserMotion of ['no-preference','reduce']) {
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:browserMotion,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const loaded=async()=>{
   await page.waitForFunction(()=>window.rhine?.stats().ready);
   if(await page.locator('.entry-start').count())await page.locator('.entry-start').click();
   await page.waitForFunction(()=>!document.querySelector('#loading'));
 };
 await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5190/');await loaded();
 let state=await page.evaluate(()=>window.rhine.stats());
 const reduced=browserMotion==='reduce';
 assert.equal(state.mode,reduced?'archive':'boot');
 assert.equal(state.motion.reduced,reduced);
 assert.equal(state.motion.preset,reduced?'reduced':'full');
 await page.evaluate(()=>window.rhine.archive());
 await page.getByRole('button',{name:'系统设置',exact:true}).click();
 assert.equal(await page.locator('.settings-label').textContent(),'设置');
 assert.equal(await page.locator(`[data-action="motion-preset"][data-preset="${reduced?'reduced':'full'}"]`).getAttribute('aria-pressed'),'true');
 await page.locator('[data-action="motion-preset"][data-preset="full"]').click();
 await page.locator('.motion-advanced summary').click();
 const modelMotion=page.locator('[data-motion="modelDecryption"]');
 assert.equal(await modelMotion.isChecked(),true);
 await modelMotion.uncheck();
 await page.waitForTimeout(50);
 assert.equal(await page.locator('[data-motion="modelDecryption"]').isChecked(),false);
 assert.equal(await page.locator('.motion-advanced').evaluate(el=>el.open),true);
 assert.deepEqual(errors,[]);report.checks.push({browserMotion,passed:true});await context.close();
}}finally{await browser.close()}
await mkdir('.tools/responsive',{recursive:true});await writeFile(`.tools/responsive/startup-${channel}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
