import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const dir=resolve('verification/wallpaper-image/host');await mkdir(dir,{recursive:true});
const source=await readFile('verification/wallpaper-image/test.html','utf8');
const raw='E:/AIProject/RhineLabUI/reference/extracted-3088099655/wallpaper-2.jpg';
const exe='D:/Game/Steam/steamapps/common/wallpaper_engine/wallpaper64.exe';
const location='Rhine Lab image diagnostic';
const run=args=>new Promise((ok,no)=>{const child=spawn(exe,args,{windowsHide:true,stdio:'ignore'});child.once('error',no);child.once('exit',ok)});
let finish;const result=new Promise(resolve=>finish=resolve);
const server=createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{res.setHeader('Access-Control-Allow-Origin','*');res.end('ok');try{finish(JSON.parse(body))}catch{}})});
await new Promise(resolve=>server.listen(5183,'127.0.0.1',resolve));
const probe=`window.wallpaperPropertyListener={applyUserProperties(props){if(!props.customwallpaperfile)return;const raw=props.customwallpaperfile.value,url=wallpaperImageUrl(raw),image=new Image();const report=ok=>fetch('http://127.0.0.1:5183/',{method:'POST',body:JSON.stringify({ok,raw,url,width:image.naturalWidth,height:image.naturalHeight})});image.onload=()=>report(true);image.onerror=()=>report(false);image.src=url;document.body.append(image)}};`;
await writeFile(dir+'/index.html',source.replace('</script>',probe+'</script>'));
await writeFile(dir+'/project.json',JSON.stringify({title:'Rhine Lab image diagnostic',type:'web',file:'index.html',general:{properties:{customwallpaperfile:{type:'file',value:raw,text:'image'}}}}));
let timeout;
try {
 await run(['-control','openWallpaper','-file',dir+'/project.json','-playInWindow',location,'-width','320','-height','200','-x','-30000','-y','-30000']);
 const data=await Promise.race([result,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('No host result within 30 seconds')),30000)})]);
 await writeFile('verification/wallpaper-image/host-results.json',JSON.stringify(data,null,2));console.log(data);
 assert.equal(data.ok,true);assert.equal(data.width,3200);assert.equal(data.height,2000);
}finally{
 clearTimeout(timeout);server.close();await run(['-control','closeWallpaper','-location',location]);
}
