import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/.test(m.text()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:5194/reference/performance.html');await page.waitForFunction(()=>window.bench);
 const checks=await page.evaluate(async()=>{
  await bench.prepare('static');const scene=bench.scene,results=[];
  const check=(name,change)=>{const before=scene.getStats().renderedFrames;change();bench.draw();results.push({name,rendered:scene.getStats().renderedFrames>before});};
  check('unchanged',()=>{});
  check('resize',()=>scene.resize());
  check('theme',()=>scene.setTheme(true,true));
  check('selection',()=>scene.select(7));
  await bench.prepare('static');
  check('late label texture',()=>{scene.labelTexture.needsUpdate=true;});
  check('depth fallback',()=>scene.setQuality({...scene.quality,aoResolution:.5}));
  check('disable AO',()=>scene.setQuality({...scene.quality,aoSamples:0}));
  check('restore shared depth',()=>scene.setQuality({...scene.quality,aoSamples:32,aoResolution:1}));
  check('AA',()=>scene.setQuality({...scene.quality,antialias:'smaa'}));
  check('release transition',()=>scene.setPresentationVisible(false));
  check('reverse release',()=>scene.setPresentationVisible(true));
  await bench.prepare('static');
  scene.setReduced(false);check('music wakes canvas',()=>scene.setPlayfield(true,{low:1,mid:.5,high:.2,activity:1},1,1,null,false));
  // Capacity growth must retain one shared buffer and a valid picking sphere.
  scene.ensureInstanceCapacity(scene.instanceCapacity*2);
  bench.draw();results.push({name:'grown buffers shared',rendered:scene.instances.every(i=>i.instanceMatrix===scene.instances[0].instanceMatrix)&&!!scene.instances[0].boundingSphere});
  return results;
 });
 for(const check of checks)assert.equal(check.rendered,check.name!=='unchanged',check.name);
 assert.deepEqual(errors,[]);await writeFile('verification/performance/invalidation.json',JSON.stringify({checks,errors},null,2));console.log('Invalidation, quality transitions, resuming music and shared capacity growth passed.');
}finally{await browser.close();}
