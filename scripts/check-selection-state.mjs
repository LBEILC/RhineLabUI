import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/.test(m.text()))errors.push(m.text())});
await page.goto('http://127.0.0.1:5176/?scene=archive');await page.waitForFunction(()=>window.rhine?.stats().ready);
const apply=async(values)=>{await page.evaluate(values=>window.wallpaperPropertyListener.applyUserProperties(Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))),values);await page.waitForTimeout(300)};
const stats=()=>page.evaluate(()=>window.rhine.stats());
await apply({desktopmode:'workbench',boot:false,superperformance:true,screenfinish:false,hudparallax:false,uifrost:false,sound:false,music:false,reduced:false,colortheme:'dark',selectedindexaccent:true,selectionstyle:'music-flat',audioreactive:true});
await page.waitForFunction(()=>window.rhine.stats().selectedIndexDim<.02&&window.rhine.stats().extraction>.38);
const before=await stats();
// Simulate the host capturing the wallpaper's own sounds during a real drag.
await page.evaluate(()=>{window.localNoise=setInterval(()=>{const t=performance.now()/1000;window.dispatchEvent(new CustomEvent('rhine-local-sound',{detail:{until:t+.5}}));window.rhineWallpaperSpectrum={samples:Array(128).fill(.2),time:t}},35)});
await page.mouse.move(860,480);await page.mouse.down();await page.mouse.move(1120,570,{steps:18});await page.mouse.up();
await page.waitForTimeout(1200);const dragged=await stats();
await page.evaluate(()=>{clearInterval(window.localNoise);window.rhineWallpaperSpectrum={samples:Array(128).fill(0),time:performance.now()/1000}});
assert.equal(dragged.flatten,0);assert.equal(dragged.spectrumActivity,0);
await page.waitForFunction(()=>window.rhine.stats().selectedIndexDim<.02&&window.rhine.stats().extraction>.38&&!window.rhine.stats().archiveMomentum);
await page.evaluate(()=>{const n=Number(window.rhine.stats().selected.slice(2))-1;window.rhine.select((n+1)%40)});
const frames=[];for(let i=0;i<14;i++){await page.waitForTimeout(120);frames.push(await stats())}
assert.ok(frames.some(f=>f.selectedIndexDim>.03&&f.selectedIndexDim<.97),'New selected accent fades in');
assert.ok(frames.some(f=>f.returningIndexDims.some(x=>x.dim>.03&&x.dim<.97)),'Outgoing accent fades out');
await apply({selectionstyle:'flat'});await page.waitForFunction(()=>window.rhine.stats().flatten>.995);
const flat=await stats();assert.ok(flat.selectedIndexDim>.99);
await apply({selectedindexaccent:false});assert.ok((await stats()).selectedIndexDim>.99,'Flat disables accent even when all-label style is selected');
await mkdir('verification/selection-state',{recursive:true});await page.screenshot({path:'verification/selection-state/flat.png'});
await apply({selectedindexaccent:true,selectionstyle:'music-flat'});await page.waitForFunction(()=>window.rhine.stats().flatten<.01&&window.rhine.stats().selectedIndexDim<.02&&window.rhine.stats().extraction>.38);await page.screenshot({path:'verification/selection-state/silent-selected.png'});
assert.deepEqual(errors,[]);await writeFile('verification/selection-state/results.json',JSON.stringify({before,dragged,frames:frames.map(f=>({dim:f.selectedIndexDim,returning:f.returningIndexDims,lift:f.extraction})),flat,errors},null,2));
console.log('Silent drag retains unflattened array; both label directions interpolate; flat mode has no accent; restore passed.');
} finally {await browser.close()}
