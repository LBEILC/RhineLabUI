import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {PNG}=require(process.env.PNGJS_MODULE||'pngjs');
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]??null;
const report={};
const stableKeys=['modelPosition','cameraPosition','fieldOfView','archiveCount','archiveCandidates','selectedSlot','selectedCell','rotation','extraction','cameraDetail','cameraNear','cameraFar','fogNear','fogFar'];
for(const surface of process.argv.slice(2).length?process.argv.slice(2):['browser','host']){
  const root=`verification/model-precision/${surface}`;
  const {runs,errors}=JSON.parse(await readFile(`${root}/runs.json`));
  assert.deepEqual(errors,[]);
  const scenarios=runs[0].results.map(r=>r.scenario);
  const summary=[];
  for(const scenario of scenarios){
    const byTier={};
    for(const tier of ['high','medium','low']){
      const rows=runs.filter(r=>r.tier===tier).map(r=>r.results.find(x=>x.scenario===scenario));
      assert.equal(rows.length,3,'Expected three completed rounds');
      byTier[tier]={geometry:rows[0].geometry};
      byTier[tier].drawCallDifferences=[];
      for(const key of ['cpu','gpu','calls','triangles','uploadBytes']){
        const values=rows.map(r=>r.summary[key]).filter(v=>v!==null);
        byTier[tier][key]={median:median([...values]),min:Math.min(...values),max:Math.max(...values),rounds:values};
      }
      for(let i=0;i<rows.length;i++){
        const reference=runs.find(r=>r.tier==='high'&&r.round===i+1).results.find(r=>r.scenario===scenario);
        assert.equal(rows[i].quality,reference.quality);
        for(const key of stableKeys)assert.deepEqual(rows[i].stats[key],reference.stats[key],`${surface}/${scenario}/${tier}/${key}`);
        const differences=rows[i].samples.flatMap((s,frame)=>s.calls===reference.samples[frame].calls?[]:[{frame,high:reference.samples[frame].calls,actual:s.calls}]);
        // Reduced geometry changes Three's per-mesh bounding sphere slightly.
        // At one edge-of-frustum frame the low model issues three EXTRA calls;
        // retain this measured exception rather than claiming exact equality.
        if(differences.length){
          assert.equal(tier,'low');assert.equal(scenario,'navigate');
          assert.deepEqual(differences,[{frame:75,high:358,actual:361}]);
          byTier[tier].drawCallDifferences.push({round:i+1,differences});
        }
        assert.deepEqual(rows[i].samples.map(s=>s.uploadBytes),reference.samples.map(s=>s.uploadBytes),`${tier} changes animation uploads`);
      }
      byTier[tier].gpuReduction=byTier.high.gpu.median?1-byTier[tier].gpu.median/byTier.high.gpu.median:null;
    }
    summary.push({scenario,...byTier});
  }
  const images=[];
  for(const scenario of scenarios){
    const high=PNG.sync.read(await readFile(`${root}/high-1-${scenario}.png`));
    for(const tier of ['high','medium','low']){
      const path=`${root}/${tier}-1-${scenario}.png`;
      const bytes=await readFile(path), png=PNG.sync.read(bytes);
      assert.equal(png.width,high.width);assert.equal(png.height,high.height);
      let changedPixels=0,above3=0,sum=0,max=0;
      for(let i=0;i<png.data.length;i+=4){let change=0;for(let c=0;c<3;c++){const d=Math.abs(png.data[i+c]-high.data[i+c]);sum+=d;change=Math.max(change,d);}if(change)changedPixels++;if(change>3)above3++;max=Math.max(change,max);}
      images.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),changedPixels,above3,max,meanChannelError:sum/(png.width*png.height*3)});
    }
  }
  report[surface]={renderer:runs[0].results[0].renderer,userAgent:runs[0].userAgent,summary,images};
  await writeFile(`${root}/summary.json`,JSON.stringify(report[surface],null,2));
  console.log(surface);for(const row of summary)console.log(row.scenario,...['high','medium','low'].map(t=>`${t}: GPU ${row[t].gpu.median?.toFixed(3)} ms (${(100*(row[t].gpuReduction||0)).toFixed(1)}%), CPU ${row[t].cpu.median.toFixed(2)} ms`));
}
await writeFile('verification/model-precision/summary.json',JSON.stringify(report,null,2));
