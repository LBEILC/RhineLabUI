// Compare the previous production build with the current one on local HTTP.
// BASELINE_DIST defaults to .tools/issues-before; neither build is modified.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const baseline = resolve(process.env.BASELINE_DIST || '.tools/issues-before');
const current = resolve('dist');
const out = resolve('.tools/issues');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.glb':'model/gltf-binary','.ogg':'audio/ogg','.json':'application/json'};
const serve = async(root,port)=>{
  const server=createServer(async(req,res)=>{try {
    const url=new URL(req.url,'http://localhost');const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(!file.startsWith(root+sep))throw Error('path');const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(body);
  }catch{res.writeHead(404).end()}});
  await new Promise(r=>server.listen(port,'127.0.0.1',r));return server;
};
const servers=await Promise.all([serve(baseline,0),serve(current,0)]);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const report={cases:[],errors:[]};
try {
  for(const [name,port] of [['baseline',servers[0].address().port],['current',servers[1].address().port]]) {
    const context=await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:'block',reducedMotion:'no-preference'});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(()=>window.rhine?.stats().ready);
    await page.evaluate(()=>document.fonts.ready);
    const fonts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.endsWith('.woff2')).map(e=>({url:new URL(e.name).pathname,bytes:e.decodedBodySize})));
    const result={name,entryFontBytes:fonts.reduce((n,f)=>n+f.bytes,0),entryFontRequests:fonts.length};report.cases.push(result);
    await page.goto(`http://127.0.0.1:${port}/?time=8.48&freeze=1`);
    await page.waitForFunction(()=>window.rhine?.stats().ready&&!document.querySelector('#loading'));
    await page.evaluate(()=>document.fonts.ready);
    result.brand=await page.evaluate(()=>['.brand h1','.brand > div','.brand p'].map(selector=>{
      const el=document.querySelector(selector),r=document.createRange();r.selectNodeContents(el);const rect=r.getBoundingClientRect();
      return {selector,text:el.textContent,width:rect.width,height:rect.height,x:rect.x,y:rect.y,font:getComputedStyle(el).font};
    }));
    await page.screenshot({path:resolve(out,`brand-${name}.png`),clip:{x:45,y:100,width:300,height:135}});
    await page.goto(`http://127.0.0.1:${port}/?scene=detail`);
    await page.waitForFunction(()=>window.rhine?.stats().ready&&!document.querySelector('#loading'));
    await page.waitForFunction(()=>window.rhine.stats().decryption.clarity===1);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>!document.querySelector('.document-redaction-window'));
    await page.screenshot({path:resolve(out,`detail-${name}.png`)});
    result.document=await page.locator('.detail-content').evaluate(el=>({width:el.clientWidth,height:el.clientHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight}));
    await context.close();
  }
  report.fontByteReduction=1-report.cases[1].entryFontBytes/report.cases[0].entryFontBytes;
  assert.ok(report.fontByteReduction>.9);
  for(let i=0;i<3;i++)assert.ok(Math.abs(report.cases[1].brand[i].width-report.cases[0].brand[i].width)<.1,'Calibrated brand width must survive the font update');
  assert.equal(report.cases[1].document.scrollWidth,report.cases[1].document.width);
  assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
} finally {await writeFile(resolve(out,'font-loading.json'),JSON.stringify(report,null,2));await browser.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));}
