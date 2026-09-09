// Uses a disposable HTTP server to exercise real service-worker updates/failures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const metadata=JSON.parse(await readFile('dist/pwa-build.json','utf8'));
let revision=1,fail=false;
const root=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain','.glb':'model/gltf-binary','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=resolve(root,`.${path}`);
  if(!file.startsWith(root+ '/'.replace('/',process.platform==='win32'?'\\':'/')))throw Error();
  if(fail&&path==='/icons/icon-192.png'){res.writeHead(503).end();return}
  let body=await readFile(file);
  if(path==='/sw.js'&&revision>1)body=Buffer.from(body.toString().replace(metadata.version,`${metadata.version}-test-${revision}`));
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);
}catch{res.writeHead(404).end()}});
await new Promise(resolve=>server.listen(5191,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
await context.addInitScript(()=>{if(!localStorage.getItem('rhine-settings'))localStorage.setItem('rhine-settings',JSON.stringify({reduced:true,sound:false,music:false}))});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>window.rhine?.stats().ready&&document.documentElement.dataset.offlineReady==='true'&&navigator.serviceWorker.controller&&!document.querySelector('#loading'),null,{timeout:90000});
const report={version:metadata.version,bytes:metadata.bytes,files:metadata.files.length,checks:[],errors};
try{
 await page.goto('http://127.0.0.1:5191/?scene=archive');await ready();
 const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel="manifest"]').href)).json());
 assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');assert.equal(manifest.icons.length,3);
 await page.evaluate(async()=>{await caches.open('unrelated-app');localStorage.setItem('rhine-saved','["X-001"]')});
 report.checks.push('manifest, installation, atomic full-resource cache');
 await context.setOffline(true);await page.reload();await ready();
 await page.locator('.read-file').click();await page.waitForFunction(()=>window.rhine.stats().decryption.clarity===1);
 const exported=await page.locator('.export-button').evaluate(async a=>{const r=await fetch(a.href);return {ok:r.ok,text:await r.text()}});assert.ok(exported.ok&&exported.text.includes('X-001'));
 await page.locator('.viewer-open').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('.model-viewer')?.dataset.stats||'{}').ready);
 await page.locator('[data-viewer="explode"]').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('.model-viewer').dataset.stats).spread===1);
 await mkdir('.tools/responsive',{recursive:true});await page.screenshot({path:'.tools/responsive/pwa-offline.png'});
 assert.ok(await page.evaluate(async()=>{const r=await fetch('/audio/motif.ogg');return r.ok&&(await r.arrayBuffer()).byteLength>100000}));
 report.checks.push('offline reload, fonts, document export, model viewer, explosion and audio resource');
 await page.locator('[data-viewer="close"]').click();await page.locator('[data-action="settings"]').click();
 await context.setOffline(false);revision=2;
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
 await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting),null,{timeout:90000});
 await page.waitForSelector('[data-pwa-action="update"]');
 assert.equal(await page.evaluate(()=>document.querySelector('#stage').dataset.mode),'detail','Waiting update must not interrupt the page');
 await Promise.all([page.waitForNavigation(),page.locator('[data-pwa-action="update"]').click()]);await ready();
 assert.equal(await page.evaluate(()=>localStorage.getItem('rhine-saved')),'["X-001"]');
 const keys=await page.evaluate(()=>caches.keys());assert.ok(keys.includes('unrelated-app'));assert.equal(keys.filter(k=>k.startsWith('rhine-lab:')).length,1);assert.ok(keys.some(k=>k.endsWith('-test-2')));
 report.checks.push('waiting update, explicit restart, old-cache cleanup and preserved preferences/bookmarks');
 revision=3;fail=true;
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting},null,{timeout:90000});
 await context.setOffline(true);await page.reload();await ready();
 assert.ok((await page.evaluate(()=>caches.keys())).some(k=>k.endsWith('-test-2')));
 assert.ok(!(await page.evaluate(()=>caches.keys())).some(k=>k.endsWith('-test-3')));
 report.checks.push('failed update leaves the previous complete offline release usable');
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
}finally{await writeFile('.tools/responsive/pwa-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r))}
