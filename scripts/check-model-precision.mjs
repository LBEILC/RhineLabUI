import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const host = process.argv.includes('--host');
const smoke = process.argv.includes('--smoke');
const root = resolve('release/model-precision');
const output = `verification/model-precision/${host?'host':'browser'}${smoke?'-smoke':''}`;
await mkdir(output,{recursive:true});
const scenarios = (process.env.PRECISION_CASES || 'static,idle,navigate,detail,inspect,music').split(',');
const orders = smoke ? [['high','medium','low']] : [['high','medium','low'],['low','high','medium'],['medium','low','high']];
const count = smoke ? 12 : 96;
let tier, finish;
// This same function runs inside Edge and native Wallpaper Engine CEF.
async function runFixture({scenarios,count}) {
  const b = window.bench;
  b.scene.inputEvents.abort(); b.scene.setHover(null); b.scene.hoverLifts.clear(); b.scene.pointer.set(0,0);
  const results = [];
  for(const scenario of scenarios) {
    await b.prepare(scenario);
    // Compile/render the exact scenario before measuring; the measured sample
    // restarts its deterministic input index after this warm-up.
    await b.sample(scenario,60);
    await b.prepare(scenario);
    for(let i=0;i<60;i++){b.draw();await new Promise(r=>setTimeout(r,16));}
    const result = {scenario,...await b.sample(scenario,count)};
    b.scene.resize(); b.draw();
    result.image = b.scene.renderer.domElement.toDataURL('image/png');
    results.push(result);
  }
  return {userAgent:navigator.userAgent,results};
}
const server = createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='POST') {let body='';req.on('data',b=>body+=b);req.on('end',()=>{res.end('ok');finish?.(JSON.parse(body));});return;}
  try {
    const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(root+'/')&&!path.startsWith(root+'\\'))throw Error('outside root');
    let data=await readFile(path);
    if(host && path.endsWith('performance.html'))data=Buffer.from(data.toString().replace('<head>',`<head><base href="http://127.0.0.1:5197/"><script>
      window.__precisionTier=${JSON.stringify(tier)};
      const nativeTimeout=setTimeout;window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,Math.max(ms||0,16),...args);
      const send=data=>fetch('http://127.0.0.1:5197/',{method:'POST',body:JSON.stringify(data)});
      window.addEventListener('error',e=>send({error:e.message}));
      window.addEventListener('unhandledrejection',e=>send({error:String(e.reason)}));
      const timer=setInterval(async()=>{if(!window.bench)return;clearInterval(timer);try{send(await (${runFixture.toString()})(${JSON.stringify({scenarios,count})}));}catch(e){send({error:String(e),stack:e.stack});}},100);
    </script>`));
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');res.end(data);
  }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(5197,'127.0.0.1',r));
const errors=[], runs=[];
const exe=process.env.WALLPAPER_EXE||'D:/Game/Steam/steamapps/common/wallpaper_engine/wallpaper64.exe';
const location='Rhine model precision diagnostic';
const control=args=>new Promise((ok,no)=>{const p=spawn(exe,args,{windowsHide:true,stdio:'ignore'});p.once('error',no);p.once('exit',ok);});
let browser;
try {
  if(!host) browser=await require(process.env.PLAYWRIGHT_MODULE||'playwright').chromium.launch({channel:'msedge',headless:true});
  for(const [round,order] of orders.entries())for(tier of order){
    let data;
    console.log('START',host?'host':'browser',round+1,tier);
    if(host){
      const dir=resolve('.tools/performance/model-precision-host');await mkdir(dir,{recursive:true});
      await writeFile(dir+'/project.json',JSON.stringify({title:location,type:'web',file:'index.html'}));
      await writeFile(dir+'/index.html',await(await fetch('http://127.0.0.1:5197/reference/performance.html')).text());
      const result=new Promise(r=>finish=r);let timeout;
      try{
        await control(['-control','openWallpaper','-file',dir+'/project.json','-playInWindow',location,'-width','1920','-height','1080','-x','-30000','-y','-30000']);
        data=await Promise.race([result,new Promise((_,no)=>timeout=setTimeout(()=>no(Error('Native host timed out')),240000))]);
      }finally{clearTimeout(timeout);await control(['-control','closeWallpaper','-location',location]);}
    }else{
      const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/.test(m.text()))errors.push(m.text());});
      await page.goto(`http://127.0.0.1:5197/reference/performance.html?precision=${tier}`);
      await page.waitForFunction(()=>window.bench,{timeout:90000});
      data=await page.evaluate(runFixture,{scenarios,count});
      await page.close();
    }
    if(data.error)throw Error(data.error);
    for(const result of data.results){
      await writeFile(`${output}/${tier}-${round+1}-${result.scenario}.png`,Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
      const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]??null;
      result.summary=Object.fromEntries(['cpu','gpu','calls','triangles','uploadBytes'].map(k=>[k,median(result.samples.map(s=>s[k]).filter(v=>v!==null))]));
      console.log(tier,result.scenario,JSON.stringify(result.summary),JSON.stringify(result.geometry));
    }
    runs.push({tier,round:round+1,...data});
    await writeFile(`${output}/runs.json`,JSON.stringify({errors,runs},null,2));
  }
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser?.close();server.close();}
