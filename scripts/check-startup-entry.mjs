// Real browser checks for entry audio, first-load fonts and failure recovery.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const base = process.env.REVIEW_URL || 'http://127.0.0.1:5190/';
const engine = process.env.REVIEW_ENGINE || 'chromium';
const browser = engine === 'webkit' ? await webkit.launch({headless:true}) : await chromium.launch({channel:process.env.REVIEW_CHANNEL || 'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const report = {engine,version:browser.version(),checks:[],errors:[]};
const output = resolve('.tools/issues');await mkdir(output,{recursive:true});
const waitEntry = page => page.waitForFunction(()=>window.rhine?.stats().startup==='waiting',null,{timeout:60000});
const waitStart = page => page.waitForFunction(()=>window.rhine?.stats().startup==='started'&&!document.querySelector('#loading'),null,{timeout:60000});
async function fresh(options={},prefs) {
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',reducedMotion:'no-preference',...options});
  if(prefs)await context.addInitScript(prefs=>localStorage.setItem('rhine-settings',JSON.stringify(prefs)),prefs);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));return {context,page};
}
try {
  if(engine==='webkit') {
    // Windows WebKit lacks the required audio decoder. Exercise the entry
    // viewport and its real error path; never label this an iPhone audio test.
    const {context,page}=await fresh({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await page.goto(base);await waitEntry(page);
    await page.screenshot({path:resolve(output,'entry-webkit.png')});
    await page.locator('.entry-start').tap();
    await page.waitForFunction(()=>['started','error'].includes(window.rhine.stats().startup),null,{timeout:25000});
    const state=await page.evaluate(()=>window.rhine.stats().startup);
    if(state==='error')await page.locator('.entry-silent').tap();
    await waitStart(page);report.checks.push({name:'WebKit portrait entry and decoder fallback',audioResult:state});await context.close();
  } else {
    for(const [name,options,input,prefs] of [
      ['desktop',{},'click'],
      ['portrait',{viewport:{width:390,height:844},hasTouch:true,isMobile:true},'tap'],
      ['keyboard',{},'keyboard'],
      ['reduced',{reducedMotion:'reduce'},'click'],
      ['sound-only',{},'click',{sound:true,music:false}],
      ['music-only',{},'click',{sound:false,music:true}],
    ]) {
      const {context,page}=await fresh(options,prefs);
      await page.goto(base);await waitEntry(page);
      const before=await page.evaluate(()=>window.rhine.stats());
      assert.equal(before.audio.state,'locked');assert.equal(before.audio.tracks,0);
      assert.equal(await page.locator('#stage').evaluate(el=>el.inert),true);
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(()=>window.rhine.stats().bootTime),6.76);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.offlineReady),undefined);
      const fonts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.endsWith('.woff2')).map(e=>({url:new URL(e.name).pathname,bytes:e.decodedBodySize})));
      assert.ok(fonts.length>0&&fonts.every(f=>f.url.includes('/fonts/misans-webfont-4.3.1/')));
      assert.ok(fonts.reduce((n,f)=>n+f.bytes,0)<2*1024*1024,'Entry must not load entire font families');
      const rect=await page.locator('.entry-start').boundingBox(),vp=page.viewportSize();
      assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=vp.width&&rect.y+rect.height<=vp.height);
      if(name==='desktop'||name==='portrait')await page.screenshot({path:resolve(output,`entry-${name}.png`)});
      if(input==='keyboard')await page.keyboard.press('Enter');
      else if(input==='tap')await page.locator('.entry-start').tap();
      else await page.locator('.entry-start').click();
      await waitStart(page);
      const after=await page.evaluate(()=>window.rhine.stats());
      assert.equal(after.mode,name==='reduced'?'archive':'boot','Entry activation must not leak into skip/open');
      assert.equal(after.audio.state,'running');assert.equal(after.audio.loaded,name!=='sound-only');assert.equal(after.audio.tracks,name==='sound-only'?0:3);
      if(name!=='reduced') {
        assert.ok(after.bootTime<9,'Waiting time must not advance the animation');
        if(name!=='music-only')await page.waitForFunction(()=>window.rhine.stats().audio.playedKeys>0,null,{timeout:10000});
      }
      report.checks.push({name,entryFontBytes:fonts.reduce((n,f)=>n+f.bytes,0),fontRequests:fonts.length,audio:after.audio.state,tracks:after.audio.tracks});
      await context.close();
    }
    {
      const {context,page}=await fresh({}, {sound:false,music:false,reduced:true});
      await page.goto(base);await waitStart(page);assert.equal(await page.locator('.entry-start').count(),0);
      assert.equal(await page.evaluate(()=>window.rhine.stats().audio.state),'locked');
      report.checks.push({name:'Existing silent preference enters without opening audio'});await context.close();
    }
    {
      const {context,page}=await fresh();let fail=true;
      await page.route('**/audio/*.ogg',route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.continue());
      await page.goto(base);await waitEntry(page);await page.locator('.entry-start').click();
      await page.waitForFunction(()=>window.rhine.stats().startup==='error');
      assert.equal(await page.evaluate(()=>window.rhine.stats().bootTime),6.76);
      assert.equal(await page.evaluate(()=>window.rhine.stats().audio.tracks),0);
      fail=false;await page.locator('.entry-start').click();await waitStart(page);
      assert.equal(await page.evaluate(()=>window.rhine.stats().audio.tracks),3);
      report.checks.push({name:'Failed music leaves opening paused; retry downloads and starts all tracks'});await context.close();
    }
    {
      const {context,page}=await fresh();let unblock;
      const blocked=new Promise(r=>unblock=r);
      await page.route('**/audio/*.ogg',async route=>{await blocked;await route.continue().catch(()=>{});});
      await page.goto(base);await waitEntry(page);await page.locator('.entry-start').click();
      await page.waitForFunction(()=>window.rhine.stats().startup==='starting');
      await page.locator('.entry-start').click({force:true});assert.equal(await page.evaluate(()=>window.rhine.stats().startup),'starting');
      await page.locator('.entry-silent').click();unblock();await waitStart(page);await page.waitForTimeout(500);
      const state=await page.evaluate(()=>window.rhine.stats());assert.equal(state.audio.tracks,0);assert.equal(state.audio.preferences.sound,false);assert.equal(state.audio.preferences.music,false);
      report.checks.push({name:'Repeated entry is ignored; silent entry cancels pending music and does not start late'});await context.close();
    }
    {
      const {context,page}=await fresh();await page.goto(base+'?time=6.2&freeze=1');await waitStart(page);
      assert.equal(await page.evaluate(()=>window.rhine.stats().bootTime),11.2);
      await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.rhine.stats().bootTime),11.2);
      report.checks.push({name:'Frame review bypasses entry and preserves reference time'});await context.close();
    }
  }
  assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
} finally {await writeFile(resolve(output,`startup-${engine}-${process.env.REVIEW_CHANNEL||'chrome'}.json`),JSON.stringify(report,null,2));await browser.close();}
