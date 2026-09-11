import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
let enabled=false;
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path==='/')path='/index.html';let data=await readFile(resolve('release/wallpaper'+path));if(path.endsWith('.html'))data=Buffer.from(data.toString().replace('</head>',`<script>setTimeout(()=>wallpaperPropertyListener.applyUserProperties({load3donstartup:{value:${enabled}},desktopmode:{value:'workbench'},sound:{value:false},music:{value:false}}),1800)</script></head>`));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');res.end(data)}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(5184,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:720}}),models=[],errors=[];
await page.addInitScript(()=>{window.wallpaperRegisterAudioListener=()=>{}});
page.on('request',r=>{if(r.url().includes('.glb'))models.push(r.url())});page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5184/');await page.waitForTimeout(600);assert.equal(await page.locator('canvas').count(),0);assert.equal(models.length,0);await page.waitForFunction(()=>window.rhine?.stats().startup==='started');
assert.equal(await page.locator('canvas').count(),0);assert.equal(models.length,0);assert.equal(await page.evaluate(()=>rhine.stats().mode),'boot');
await page.evaluate(()=>rhine.seek(21.8));await page.waitForFunction(()=>rhine.stats().mode==='archive');assert.equal(await page.locator('canvas').count(),0);
await page.locator('[data-action="toggle-three"]').click();await page.waitForFunction(()=>rhine.stats().threeState==='on',{},{timeout:60000});assert.ok(models.length>0);assert.equal(await page.locator('#three-scene canvas').count(),1);
await page.evaluate(()=>wallpaperPropertyListener.applyUserProperties({load3donstartup:{value:false}}));assert.equal(await page.evaluate(()=>rhine.stats().threeState),'on');
await mkdir('verification/startup-2d',{recursive:true});await page.screenshot({path:'verification/startup-2d/manual-on.png'});
enabled=true;await page.reload();await page.waitForFunction(()=>rhine.stats().startup==='started');assert.equal(await page.locator('#three-scene canvas').count(),1);assert.equal(await page.evaluate(()=>rhine.stats().threeState),'on');assert.deepEqual(errors,[]);
await writeFile('verification/startup-2d/results.json',JSON.stringify({delayedHostCallbackMs:1800,noInitialCanvas:true,noInitialModelRequests:true,bootTo2d:true,manualLoad:true,startupOnly:true,default3d:true,errors},null,2));console.log('2D startup, no canvas/model requests, boot completion, manual load, startup-only property and default 3D passed.');
}finally{await browser.close();server.close()}

