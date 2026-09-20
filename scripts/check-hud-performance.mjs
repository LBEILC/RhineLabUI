import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],errors=[];
await mkdir('verification/performance/hud',{recursive:true});
try{
 for(const size of [{width:1920,height:1080},{width:2560,height:1080},{width:900,height:1600}]){
  const runs=[];
  for(const version of ['baseline','candidate']){
   const page=await browser.newPage({viewport:size});page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:5194/reference/hud-performance.html?${version}`);await page.waitForFunction(()=>window.hudBench);
   await page.evaluate(()=>hudBench.frame(1.76));await page.waitForTimeout(100);
   const frames=await page.evaluate(()=>{
    const out=[];for(let i=0;i<650;i++){const time=1.76+i/30;out.push(hudBench.frame(time,.6,Math.sin(i/90)*.7,Math.cos(i/80)*.4));}return out;
   });
   for(const time of [6.5,12,15.3,19.6,21.4]){await page.evaluate(t=>hudBench.frame(t),time);await page.screenshot({path:`verification/performance/hud/${size.width}-${version}-${time}.png`});}
   runs.push({version,frames});await page.close();
  }
  let max=0,first=null;
  for(let i=0;i<runs[0].frames.length;i++)for(let j=0;j<runs[0].frames[i].panels.length;j++){
   const a=runs[0].frames[i].panels[j].projection,b=runs[1].frames[i].panels[j].projection;
   if(a===b)continue;
   const nums=s=>(s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)||[]).map(Number);
   const aa=nums(a),bb=nums(b);for(let k=0;k<aa.length;k++){const delta=Math.abs(aa[k]-bb[k]);if(delta>max){max=delta;first={frame:i,panel:j,a,b};}}
  }
  const summary=runs.map(r=>({version:r.version,measurements:r.frames.at(-1).measures,cpuMs:r.frames.reduce((n,f)=>n+f.cpu,0)}));
  results.push({size,maxMatrixDelta:max,worst:first,summary});console.log(JSON.stringify(results.at(-1)));
 }
 await writeFile('verification/performance/hud/results.json',JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();}
