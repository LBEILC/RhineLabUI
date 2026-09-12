import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const label = process.argv[2] || 'candidate';
const root = resolve(`release/performance-${label}`);
const output = `verification/performance/${process.env.PERF_OUTPUT || label}`;
await mkdir(output,{recursive:true});
const server = createServer(async(req,res)=>{try{
  const path = resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith(root)) throw new Error('outside root');
  const data = await readFile(path);
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');res.end(data);
}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(5193,'127.0.0.1',r));
const browser = await chromium.launch({channel:'msedge',headless:true});
const results = [], errors = [];
try {
  for(const scenario of (process.env.PERF_CASES || 'static,idle,navigate,detail,music,opening').split(',')) {
    const name = scenario.split('-')[0];
    const options = {dark:scenario.includes('dark'),rhythm:scenario.includes('wave')?'wave':scenario.includes('flow')?'lift':'legacy',quality:{}};
    if(scenario.includes('half')) options.quality.aoResolution=.5;
    if(scenario.includes('noao')) options.quality.aoSamples=0;
    if(scenario.includes('nodof')) options.quality.depthOfField=0;
    if(scenario.includes('smaa')) options.quality.antialias='smaa';
    const viewport=scenario.includes('portrait')?{width:900,height:1600}:scenario.includes('wide')?{width:2560,height:1080}:{width:1920,height:1080};
    const page = await browser.newPage({viewport,deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/.test(m.text()))errors.push(m.text())});
    await page.goto('http://127.0.0.1:5193/reference/performance.html');
    await page.waitForFunction(()=>window.bench,{timeout:90000});
    await page.evaluate(({name,options})=>bench.prepare(name,options),{name,options});
    const result = await page.evaluate(name=>bench.sample(name),name);
    await page.screenshot({path:`${output}/${scenario}.png`});
    const median = values => values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
    result.summary = Object.fromEntries(['cpu','total','gpu','uploads','uploadBytes','calls','triangles'].map(key=>[key,median(result.samples.map(s=>s[key]).filter(v=>v!==null))??null]));
    result.summary.cpuP95 = result.samples.map(s=>s.cpu).sort((a,b)=>a-b)[Math.floor(result.samples.length*.95)];
    results.push({scenario,...result});
    console.log(scenario,JSON.stringify(result.summary),result.renderer);
    await writeFile(`${output}/results.json`,JSON.stringify({label,errors,results},null,2));
    await page.close();
  }
  if(errors.length) throw new Error(errors.join('\n'));
}finally{await browser.close();server.close();}
