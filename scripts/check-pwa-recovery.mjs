// Preserve an earlier production dist, then set PWA_PREVIOUS_DIST to its path.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
if(!process.env.PWA_PREVIOUS_DIST) throw Error('Set PWA_PREVIOUS_DIST to an earlier built release.');
const oldRoot=resolve(process.env.PWA_PREVIOUS_DIST),newRoot=resolve('dist');
const metadata=JSON.parse(await readFile(resolve(newRoot,'pwa-build.json'),'utf8'));
let deployed=false,broken=false;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain','.glb':'model/gltf-binary','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{try {
 const root=deployed?newRoot:oldRoot,url=new URL(req.url,'http://localhost');
 const path=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=resolve(root,'.'+path);
 if(!file.startsWith(root+sep))throw Error('path');
 if(broken&&path==='/icons/icon-192.png'){res.writeHead(503).end();return}
 let body=await readFile(file);
 if(broken&&path==='/sw.js')body=Buffer.from(body.toString().replace(metadata.version,metadata.version+'-broken'));
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(5192,'127.0.0.1',r));
const channel=process.env.REVIEW_CHANNEL||'chrome';
const browser=await chromium.launch({channel,headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const report={channel,version:browser.version(),release:metadata.version,checks:[],errors:[]};
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{if(!localStorage.getItem('rhine-settings'))localStorage.setItem('rhine-settings',JSON.stringify({reduced:true,sound:false,music:false}))});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.rhine?.stats().ready&&document.documentElement.dataset.offlineReady==='true'&&navigator.serviceWorker.controller&&!document.querySelector('#loading'),null,{timeout:90000});
 const base='http://127.0.0.1:5192/';
 await page.goto(base);await ready();assert.equal(await page.locator('.settings-label').count(),0);
 await page.evaluate(()=>localStorage.setItem('rhine-saved','["X-001"]'));
 deployed=true;
 const cdp=await context.newCDPSession(page);await cdp.send('Network.clearBrowserCache');await cdp.detach();
 await page.reload();await ready();
 await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting),null,{timeout:90000});
 assert.equal(await page.locator('.settings-label').count(),0);
 report.checks.push('clearing HTTP cache and reloading still serves the previous service-worker release');
 await page.goto(base+'update.html');await page.getByRole('button',{name:'更新并返回'}).click();
 await page.waitForURL(base);await ready();assert.equal(await page.locator('.settings-label').textContent(),'设置');
 assert.ok((await page.evaluate(()=>caches.keys())).some(k=>k.endsWith(metadata.version)));
 assert.equal(await page.evaluate(()=>localStorage.getItem('rhine-saved')),'["X-001"]');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rhine-settings')).reduced),true);
 report.checks.push('network recovery replaces the old page and preserves bookmarks and motion preference');
 broken=true;
 await page.goto(base+'update.html');await page.getByRole('button',{name:'更新并返回'}).click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('更新未完成'));
 assert.equal(new URL(page.url()).pathname,'/update.html');assert.equal(await page.locator('#update').isEnabled(),true);
 report.checks.push('failed recovery download reports failure and retains the previous release');broken=false;
 await page.goto(base);await ready();
 await context.setOffline(true);await page.reload();await ready();assert.equal(await page.locator('.settings-label').textContent(),'设置');
 report.checks.push('recovered release works after offline reload');await context.close();
 const fresh=await browser.newContext();const freshPage=await fresh.newPage();
 await freshPage.goto(base+'update.html');await freshPage.getByRole('button',{name:'更新并返回'}).click();await freshPage.waitForURL(base,{timeout:90000});
 report.checks.push('recovery also works without a previous service worker');await fresh.close();
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
}finally{await mkdir('.tools/responsive',{recursive:true});await writeFile(`.tools/responsive/recovery-${channel}.json`,JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r))}
