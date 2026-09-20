import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5176/?scene=archive');
await page.waitForFunction(()=>window.wallpaperPropertyListener&&document.querySelector('.wb-clock')?.textContent);
async function apply(values){await page.evaluate(values=>window.wallpaperPropertyListener.applyUserProperties(Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))),values);await page.waitForTimeout(650)}
await apply({desktopmode:'workbench',boot:false,music:false,sound:false,reduced:true,hudtracking:false,uifrost:true,screenfinish:true,screengrain:20,screenfringe:20,screenvignette:20,task1:'记录本次实验结果',task2:'整理观测资料',task3:'完成今日工作'});
await page.waitForTimeout(1500);
const selectors=['.wb-overview','.wb-module','.brand','.wb-nav button','.relay-entry','.system-footer > span','.system-footer > button'];
async function measure(){return page.evaluate(selectors=>selectors.map(s=>{const n=document.querySelector(s),r=n.getBoundingClientRect(),c=getComputedStyle(n);return {s,x:r.x,y:r.y,w:r.width,h:r.height,overflowX:c.overflowX,overflowY:c.overflowY}}),selectors)}
const result=[];
for(const [width,height] of [[1920,1080],[2560,1440],[1600,900]]){
 await page.setViewportSize({width,height});
 for(const depth of [0,20,80]){
  await apply({hudparallax:depth>0,huddepth:depth,uimarginbottom:0});await page.waitForTimeout(5000);const baseline=await measure();
  for(const bottom of [60,192,300,-80,0]){
   await apply({uimarginbottom:bottom});const current=await measure();
   current.forEach((a,i)=>{const b=baseline[i],shift=i>=3?bottom:0;assert.ok(Math.abs(a.y-b.y+shift)<1.1,JSON.stringify({width,depth,bottom,a,b,shift}));for(const k of ['x','w','h'])assert.ok(Math.abs(a[k]-b[k])<1.1,`${a.s} ${k} changed`);if(i<2){assert.equal(a.overflowX,'visible');assert.equal(a.overflowY,'visible')}});
   result.push({width,height,depth,bottom,upperShift:current[3].y-baseline[3].y,lowerShift:current[5].y-baseline[5].y,middleShift:current[0].y-baseline[0].y});
  }
 }
}
await page.setViewportSize({width:1920,height:1080});await apply({hudparallax:true,huddepth:20,uimarginbottom:0});
await mkdir('verification/ui-insets',{recursive:true});await page.screenshot({path:'verification/ui-insets/bottom-0.png'});
await apply({uimarginbottom:192});await page.screenshot({path:'verification/ui-insets/bottom-192.png'});
assert.deepEqual(errors,[]);await writeFile('verification/ui-insets/results.json',JSON.stringify(result,null,2));
console.log(`Passed ${result.length} viewport/depth/margin combinations; fixed middle geometry, no overflow, identical lower-row translation.`);
await browser.close();

