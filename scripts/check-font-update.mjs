// Migrate an installed pre-split-font release to this build, then test offline.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const oldRoot=resolve(process.env.BASELINE_DIST || '.tools/issues-before'),newRoot=resolve('dist');
const metadata=JSON.parse(await readFile(resolve(newRoot,'pwa-build.json'),'utf8'));
const report={release:metadata.version,checks:[],errors:[]};let deployed=false;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.glb':'model/gltf-binary','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try {
  const root=deployed?newRoot:oldRoot,url=new URL(req.url,'http://localhost');
  const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+sep))throw Error('path');const body=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(5198,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.REVIEW_CHANNEL||'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
try {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>{if(!localStorage.getItem('rhine-settings'))localStorage.setItem('rhine-settings',JSON.stringify({sound:false,music:false,reduced:true}))});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>window.rhine?.stats().ready&&!document.querySelector('#loading')&&navigator.serviceWorker.controller&&document.documentElement.dataset.offlineReady==='true',null,{timeout:120000});
  await page.goto('http://127.0.0.1:5198/');await ready();
  await page.evaluate(()=>localStorage.setItem('rhine-saved','["X-001","X-009"]'));
  const oldKeys=await page.evaluate(()=>caches.keys());
  assert.ok(await page.evaluate(()=>caches.match('/fonts/MiSans-Regular.woff2').then(Boolean)));
  deployed=true;
  await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update()});
  await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting),null,{timeout:120000});
  assert.equal(await page.locator('.entry-start').count(),0);
  await page.locator('#pwa-update-notice [data-pwa-action="update"]').click();await page.waitForLoadState('load');await ready();
  assert.equal(await page.evaluate(()=>window.rhine.stats().startup),'started');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rhine-saved')),'["X-001","X-009"]');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rhine-settings')).sound),false);
  const newKeys=await page.evaluate(()=>caches.keys());assert.ok(newKeys.some(k=>k.endsWith(metadata.version)));assert.ok(oldKeys.every(k=>!newKeys.includes(k)));
  assert.equal(await page.evaluate(()=>caches.match('/fonts/MiSans-Regular.woff2').then(Boolean)),false);
  report.checks.push('Previous complete release updates atomically; obsolete whole fonts removed; bookmarks and preferences retained');
  // Enable audio only for the next entry, then prove its cached resources work.
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('rhine-settings'));p.sound=true;p.music=true;localStorage.setItem('rhine-settings',JSON.stringify(p))});
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.rhine?.stats().startup==='waiting');
  await page.locator('.entry-start').click();await ready();
  assert.equal(await page.evaluate(()=>window.rhine.stats().audio.tracks),3);
  await page.locator('.read-file').click();await page.waitForFunction(()=>window.rhine.stats().decryption.clarity===1);
  await page.locator('.viewer-open').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('.model-viewer')?.dataset.stats||'{}').ready);
  await page.locator('[data-viewer="explode"]').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('.model-viewer').dataset.stats).spread===1);
  report.checks.push('Updated release enters offline with all three music tracks, split fonts, hashed main/viewer models and explosion');
  assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
} finally {await mkdir('.tools/issues',{recursive:true});await writeFile('.tools/issues/font-update.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
