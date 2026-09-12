import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const dir=resolve('.tools/performance/host');await mkdir(dir,{recursive:true});
await writeFile(dir+'/project.json',JSON.stringify({title:'Rhine performance diagnostic',type:'web',file:'index.html'}));
await writeFile(dir+'/index.html','<!doctype html><html><body style="margin:0;overflow:hidden"><iframe src="http://127.0.0.1:5195/reference/performance.html" style="border:0;width:100vw;height:100vh"></iframe></body></html>');
let root,finish;
const server=createServer(async(req,res)=>{
 if(req.method!=='POST' && /\.(js|glb|html)/.test(req.url))console.log('Host resource:',req.url);
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='POST'){let body='';req.on('data',b=>body+=b);req.on('end',()=>{res.end('ok');if(req.url==='/progress'){console.log('Host:',body);return;}finish(JSON.parse(body));});return;}
 try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root))throw Error();
 let data=await readFile(path);
 if(path.endsWith('performance.html'))data=Buffer.from(data.toString().replace('</head>',`<script>
 console.log('Host benchmark loaded');fetch('http://127.0.0.1:5195/progress',{method:'POST',body:'HTML loaded '+navigator.userAgent});
 // Allow the host GPU process to finish asynchronous timestamp queries between
 // samples. This wait is excluded from CPU and GPU measurements.
 const nativeTimeout=window.setTimeout;
 window.setTimeout=(fn,delay,...args)=>nativeTimeout(fn,Math.max(16,delay||0),...args);
 window.addEventListener('error',e=>fetch('http://127.0.0.1:5195/',{method:'POST',body:JSON.stringify({error:e.message})}));
 window.addEventListener('unhandledrejection',e=>fetch('http://127.0.0.1:5195/',{method:'POST',body:JSON.stringify({error:String(e.reason),stack:e.reason?.stack})}));
 const timer=setInterval(async()=>{if(!window.bench)return;clearInterval(timer);try{
 // The native host forwards the real desktop pointer even to an offscreen
 // window. Deterministic benchmarks supply their own input; interactive input
 // remains enabled in the separately tested application.
 bench.scene.inputEvents.abort();bench.scene.setHover(null);bench.scene.hoverLifts.clear();bench.scene.pointer.set(0,0);
 const results=[];for(const name of ['static','idle','navigate','detail','music']){
 fetch('http://127.0.0.1:5195/progress',{method:'POST',body:name});location.hash=name;await bench.prepare(name);
 for(let warm=0;warm<60;warm++){bench.draw();await new Promise(r=>setTimeout(r,16));}
 const result={scenario:name,...await bench.sample(name,96)};
 bench.scene.resize();bench.draw();const canvas=bench.scene.renderer.domElement,gl=bench.scene.renderer.getContext(),pixels=new Uint8Array(canvas.width*canvas.height*4);
 gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let hash=2166136261,sum=0;
 for(const value of pixels){hash=Math.imul(hash^value,16777619)>>>0;sum+=value;}
 result.pixelHash={hash:hash.toString(16),sum,width:canvas.width,height:canvas.height};result.image=canvas.toDataURL('image/png');results.push(result);}
 await fetch('http://127.0.0.1:5195/',{method:'POST',body:JSON.stringify({userAgent:navigator.userAgent,results})});
 }catch(e){fetch('http://127.0.0.1:5195/',{method:'POST',body:JSON.stringify({error:String(e)})});}},100);
 </script></head>`));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(5195,'127.0.0.1',r));
const exe=process.env.WALLPAPER_EXE||'D:/Game/Steam/steamapps/common/wallpaper_engine/wallpaper64.exe';
const location='Rhine performance diagnostic';
const run=args=>new Promise((ok,no)=>{const child=spawn(exe,args,{windowsHide:true,stdio:'ignore'});child.once('error',no);child.once('exit',ok)});
try{
 const completed=[];
 for(const [runIndex,label] of (process.env.HOST_ROUNDS==='3'?['baseline','candidate','candidate','baseline','baseline','candidate']:['baseline','candidate']).entries()){
  root=resolve(`release/performance-${label}`);
  // Load the fixture as the wallpaper document, avoiding CEF iframe lifecycle
  // and background-frame throttling; assets stay on the local diagnostic server.
  const html=await (await fetch('http://127.0.0.1:5195/reference/performance.html')).text();
  await writeFile(dir+'/index.html',html.replace('<head>','<head><base href="http://127.0.0.1:5195/">'));
  const result=new Promise(r=>finish=r);let timeout;
  try{
   await run(['-control','openWallpaper','-file',dir+'/project.json','-playInWindow',location,'-width','1920','-height','1080','-x','-30000','-y','-30000']);
   const data=await Promise.race([result,new Promise((_,no)=>timeout=setTimeout(()=>no(Error('Host timed out')),180000))]);
   await mkdir('verification/performance/host',{recursive:true});
   if(data.error)throw Error(data.error);
   const round=Math.floor(runIndex/2)+1;
   for(const r of data.results){
    if(r.image){const png=Buffer.from(r.image.split(',')[1],'base64');await writeFile(`verification/performance/host/${label}-${r.scenario}.png`,png);await writeFile(`verification/performance/host/${label}-${round}-${r.scenario}.png`,png);delete r.image;}
    r.summary={};for(const key of ['cpu','gpu','uploads','uploadBytes','calls','triangles']){const values=r.samples.map(s=>s[key]).filter(v=>v!==null).sort((a,b)=>a-b);r.summary[key]=values[Math.floor(values.length/2)]??null;}console.log(label,r.scenario,JSON.stringify(r.summary));}
   completed.push({label,round,...data});
   await writeFile(`verification/performance/host/${label}.json`,JSON.stringify(data,null,2));
   await writeFile('verification/performance/host/runs.json',JSON.stringify(completed,null,2));
  }finally{clearTimeout(timeout);await run(['-control','closeWallpaper','-location',location]);}
 }
}finally{server.close();}
