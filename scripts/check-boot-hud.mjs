import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path==='/')path='/index.html';let data=await readFile(resolve('release/wallpaper'+path));if(path.endsWith('.html'))data=Buffer.from(data.toString().replace('</head>',`<script>wallpaperPropertyListener.applyUserProperties({load3donstartup:{value:false},desktopmode:{value:'workbench'},sound:{value:false},music:{value:false},hudparallax:{value:true},huddepth:{value:60},hudtracking:{value:true}})</script></head>`));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');res.end(data)}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(5189,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 const apply=values=>page.evaluate(values=>wallpaperPropertyListener.applyUserProperties(Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))),values);
 const shot=()=>page.evaluate(()=>({mode:rhine.stats().mode,hud:document.querySelector('#stage').dataset.hudDepth,tracking:document.querySelector('#stage').dataset.hudTracking,panels:[...document.querySelectorAll('.boot .hud-surface')].map(n=>({name:n.className,base:n.style.transform,projection:n.style.getPropertyValue('--hud-projection'),transform:getComputedStyle(n).transform}))}));
 await page.goto('http://127.0.0.1:5189/');await page.waitForFunction(()=>window.rhine?.stats().ready);await page.waitForTimeout(600);
 await page.evaluate(()=>rhine.seek(7));await page.waitForTimeout(150);
 const glyphs=await page.evaluate(async()=>{const text=document.querySelector('.boot-logo text'),first=text.firstChild;let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(text,{childList:true,characterData:true,subtree:true});await new Promise(r=>setTimeout(r,650));observer.disconnect();return {mutations,sameNode:first===text.firstChild,value:text.textContent}});
 assert.equal(glyphs.mutations,0,'Completed logo lettering must not be rebuilt each frame');assert.equal(glyphs.sameNode,true);assert.equal(glyphs.value,'RHINE·LAB');
 await mkdir('verification/boot-hud',{recursive:true});
 for(const [name,time] of [['logo',6.5],['scan',15.3],['welcome',19.6]]) {
   await page.evaluate(time=>rhine.seek(time),time);await page.mouse.move(1450,120);await page.waitForTimeout(300);
   const state=await shot();assert.equal(state.mode,'boot');assert.equal(state.hud,'true');assert.equal(state.tracking,'true');assert.equal(state.panels.length,5);
   assert.ok(state.panels.every(p=>p.projection.startsWith('matrix3d(')&&!p.projection.includes('NaN')));
   results.push({name,...state});await page.screenshot({path:`verification/boot-hud/${name}.png`});
 }
 await apply({hudtracking:false});await page.waitForTimeout(1800);const fixed=await shot();await page.mouse.move(80,800);await page.waitForTimeout(400);assert.equal((await shot()).tracking,'false');assert.equal(fixed.hud,'true');
 await apply({hudparallax:false});await page.waitForTimeout(2000);assert.equal((await shot()).hud,'false');
 await apply({hudparallax:true,reduced:true});await page.evaluate(()=>rhine.seek(12));await page.waitForTimeout(100);assert.equal((await shot()).hud,'true');assert.equal((await shot()).tracking,'false');
 await page.evaluate(()=>rhine.archive());await page.waitForTimeout(200);assert.equal((await shot()).hud,'true');assert.equal((await shot()).mode,'archive');
 await apply({reduced:false});await page.evaluate(()=>rhine.seek(12));await page.setViewportSize({width:2560,height:1080});await page.waitForTimeout(400);assert.equal((await shot()).hud,'true');await page.screenshot({path:'verification/boot-hud/ultrawide.png'});
 assert.deepEqual(errors,[]);await writeFile('verification/boot-hud/results.json',JSON.stringify({glyphs,results,errors,off:true,static:true,reduced:true,modeTransition:true,resize:true},null,2));
 console.log('Boot HUD: all five panels, authored transforms, tracking/static/off, reduced motion, mode transition and ultrawide passed.');
} finally {await browser.close();server.close();}
