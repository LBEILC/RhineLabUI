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

await mkdir('verification/ui-insets',{recursive:true});
await apply({colortheme:'dark',hudparallax:false,selectionstyle:'original',audioreactive:false,idlebreathing:false});await page.waitForTimeout(2500);
await apply({selectedindexaccent:false});await page.screenshot({path:'verification/ui-insets/dark-all-accent.png'});
await apply({selectedindexaccent:true});await page.screenshot({path:'verification/ui-insets/dark-selected-accent.png'});
await apply({colortheme:'light'});await page.waitForTimeout(2500);await page.screenshot({path:'verification/ui-insets/light-selected-accent.png'});
assert.deepEqual(errors,[]);console.log('Dark label toggle rendered without page exceptions.');await browser.close();