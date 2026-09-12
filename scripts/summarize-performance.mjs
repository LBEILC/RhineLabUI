import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {PNG}=createRequire(import.meta.url)(process.env.PNGJS_MODULE||'pngjs');
const root='verification/performance';
const runs=JSON.parse(await readFile(`${root}/host/runs.json`));
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const host=[];
for(const name of runs[0].results.map(r=>r.scenario)){
 const pair={};
 for(const label of ['baseline','candidate']){
  const values=runs.filter(r=>r.label===label).map(r=>r.results.find(s=>s.scenario===name));
  pair[label]={};
  for(const key of ['cpu','gpu','calls','uploadBytes']){
   const samples=values.map(v=>v.summary[key]);assert.ok(samples.every(v=>v!==null),`${label}/${name}/${key} unavailable`);
   pair[label][key]={median:median([...samples]),min:Math.min(...samples),max:Math.max(...samples)};
  }
 }
 const pictures=runs.map(r=>r.results.find(s=>s.scenario===name).pixelHash);
 const pixelHashesEqual=pictures.every(p=>JSON.stringify(p)===JSON.stringify(pictures[0]));
 const images=[];
 for(const round of [...new Set(runs.map(r=>r.round))]){
  const a=PNG.sync.read(await readFile(`${root}/host/baseline-${round}-${name}.png`));
  const b=PNG.sync.read(await readFile(`${root}/host/candidate-${round}-${name}.png`));
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  let pixels=0,max=0,sum=0;const points=[];
  for(let i=0;i<a.data.length;i+=4){let peak=0;for(let c=0;c<3;c++){const d=Math.abs(a.data[i+c]-b.data[i+c]);sum+=d;max=Math.max(max,d);peak=Math.max(peak,d);}if(peak){pixels++;if(points.length<16)points.push({x:i/4%a.width,y:Math.floor(i/4/a.width),delta:peak});}}
  // Report all differences, including single-level rounding. Human review of
  // these metrics is required; an unequal hash is never silently called equal.
  images.push({round,pixels,max,sum,mean:sum/(a.width*a.height*3),points});
 }
 host.push({scenario:name,...pair,pixelHashesEqual,images,gpuReduction:1-pair.candidate.gpu.median/pair.baseline.gpu.median});
}
await writeFile(`${root}/host/summary.json`,JSON.stringify(host,null,2));
const files=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){
 const path=`${dir}/${e.name}`;if(e.isDirectory()){if(!['debug','reuse'].includes(e.name))await scan(path);}
 else if(e.name.endsWith('.png'))files.push({path:path.slice(root.length+1),sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
}}
await scan(root);await writeFile(`${root}/image-manifest.json`,JSON.stringify(files,null,2));
console.log(JSON.stringify(host,null,2));
