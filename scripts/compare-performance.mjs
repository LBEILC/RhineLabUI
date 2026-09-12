import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const {PNG}=createRequire(import.meta.url)(process.env.PNGJS_MODULE || 'pngjs');
const [from='baseline',to='candidate']=process.argv.slice(2);
const a=JSON.parse(await readFile(`verification/performance/${from}/results.json`));
const b=JSON.parse(await readFile(`verification/performance/${to}/results.json`));
const results=[];
for(const item of b.results){
  const before=a.results.find(r=>r.scenario===item.scenario);if(!before)continue;
  const left=PNG.sync.read(await readFile(`verification/performance/${from}/${item.scenario}.png`));
  const right=PNG.sync.read(await readFile(`verification/performance/${to}/${item.scenario}.png`));
  if(left.width!==right.width||left.height!==right.height)throw Error('Size mismatch');
  const diff=new PNG({width:left.width,height:left.height});
  let pixels=0,over2=0,max=0,sum=0;
  for(let i=0;i<left.data.length;i+=4){let peak=0;for(let c=0;c<3;c++){const d=Math.abs(left.data[i+c]-right.data[i+c]);sum+=d;max=Math.max(max,d);peak=Math.max(peak,d);diff.data[i+c]=Math.min(255,d*8);}diff.data[i+3]=255;if(peak)pixels++;if(peak>2)over2++;}
  await writeFile(`verification/performance/${to}/${item.scenario}-diff.png`,PNG.sync.write(diff));
  results.push({scenario:item.scenario,before:before.summary,after:item.summary,image:{pixels,over2,max,mean:sum/(left.width*left.height*3)}});
}
await writeFile(`verification/performance/${to}/comparison-${from}.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
