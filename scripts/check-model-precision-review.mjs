import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:5198/reference/model-precision.html');
  for(const [tier,array] of [['high','4,200'],['medium','2,072'],['low','1,554']]){
    await page.selectOption('#tier',tier);
    await page.waitForFunction(array=>document.querySelector('#note').textContent.includes(array),array,{timeout:60000});
    checks.push({tier,note:await page.locator('#note').innerText()});
  }
  await page.selectOption('#scenario','inspect');
  await page.waitForFunction(()=>document.querySelector('#note').textContent.includes('1,554'),{},{timeout:60000});
  let frame=await page.locator('#view').contentFrame();
  await page.waitForFunction(()=>document.querySelector('#view').contentWindow.bench?.scene.getStats().cameraDetail===1);
  await page.check('#dark');
  await page.waitForFunction(()=>document.querySelector('#note').textContent.includes('1,554'),{},{timeout:60000});
  const dark=await page.evaluate(()=>document.querySelector('#view').contentWindow.bench.scene.scene.background.getHexString());
  checks.push({dark});
  await page.click('#pause');
  const before=await page.evaluate(()=>{const s=document.querySelector('#view').contentWindow.bench.scene.getStats();return s.renderedFrames+s.reusedFrames;});
  await page.waitForTimeout(250);
  const after=await page.evaluate(()=>{const s=document.querySelector('#view').contentWindow.bench.scene.getStats();return s.renderedFrames+s.reusedFrames;});
  assert.equal(before,after,'Pause must stop stepping');
  await page.click('#pause');
  await page.waitForFunction(before=>{const s=document.querySelector('#view').contentWindow.bench.scene.getStats();return s.renderedFrames+s.reusedFrames>before;},before);
  checks.push({pause:true,resume:true});
  assert.deepEqual(errors,[]);
  await writeFile('verification/model-precision/review-check.json',JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
