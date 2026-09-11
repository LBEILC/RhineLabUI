import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='reference/workshop-preview';await mkdir(out+'/frames',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5176/?scene=archive');
 await page.waitForFunction(()=>window.rhine?.stats().ready);
 const apply=values=>page.evaluate(values=>window.wallpaperPropertyListener.applyUserProperties(Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))),values);
 await apply({desktopmode:'workbench',boot:false,renderquality:'original',superperformance:false,sound:false,music:false,reduced:false,colortheme:'light',hudparallax:true,huddepth:20,hudtracking:false,screenfinish:false,uifrost:true,audioreactive:true,selectionstyle:'music-flat',rhythmstyle:'legacy',task1:'整理今日记录',task2:'阅读与学习',task3:'留一点时间休息'});
 await page.waitForTimeout(3500);
 await page.evaluate(()=>{window.previewSpectrum=setInterval(()=>{const t=performance.now()/1000;window.rhineWallpaperSpectrum={time:t,samples:Array.from({length:128},(_,i)=>.02+.065*(.5+.5*Math.sin(t*3-i*.21))*(.5+.5*Math.sin(t*1.7+i*.08)))}},33)});
 const frames=[],start=Date.now();let phase=0;
 for(let i=0;Date.now()-start<22000;i++) {
   const time=Date.now()-start;
   if(time>6000&&phase===0){await page.locator('[data-wb-lane="4"]').click();phase=1}
   if(time>10500&&phase===1){await apply({colortheme:'dark'});phase=2}
   if(time>16500&&phase===2){await page.locator('[data-wb-lane="0"]').click();await apply({colortheme:'light'});phase=3}
   const file=`frames/${String(i).padStart(4,'0')}.png`;
   await page.screenshot({path:out+'/'+file});frames.push({file,time:Date.now()-start});
   await page.waitForTimeout(95);
 }
 await writeFile(out+'/frames.json',JSON.stringify(frames,null,2));
 console.log(`Captured ${frames.length} actual browser frames over ${frames.at(-1).time}ms.`);
}finally{await browser.close()}
