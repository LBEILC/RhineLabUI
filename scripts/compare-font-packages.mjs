// Unpack npm misans@4.1.0 and misans-webfont@4.3.1 under .tools/font-comparison first.
// This reads package files; it never executes upstream scripts or modifies glyphs.
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const root = resolve('.'), output = resolve('.tools/font-comparison');
const weights = [[300,'Light'],[400,'Regular'],[600,'Demibold'],[700,'Bold']];
const packages = ['original','dsrkafuu','mobeicanyue'];
const content = JSON.parse(await readFile('content/archives.json','utf8'));
const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const opening = 'RHINE LAB SYNTHESIZE INFORMATION ANALYSIS OS ACCESS JOYCE MOORE WELCOME TO INTERNAL DATABASE PERMISSION AUTHORIZED 身份信息确认请求已接收开始处理权限验证通过欢迎访问莱茵生命内部资料档案编号保密级别商业区选择档案0123456789：，。·＋－/';
const corpus = [...new Set([...strings(content).join('') + opening])].join('');
const scenarios = {opening, archives:corpus};
let css = '';
const report = { packages: {}, visual: [] };
for (const name of packages) {
  report.packages[name] = { scenarios:{}, allFontBytes:0, allFiles:0 };
  for (const [weight,label] of weights) {
    const source = name === 'original' ? '' : resolve(output, name, 'package', name === 'dsrkafuu' ? `lib/Normal/MiSans-${label}.min.css` : `misans/misans-${label.toLowerCase()}/result.css`);
    const originalDirectory = process.env.BASELINE_FONT_DIR || '.tools/issues-before/fonts';
    const faces = name === 'original' ? [{file:resolve(originalDirectory,`MiSans-${label}.woff2`),range:'U+0-10FFFF'}] : [...(await readFile(source,'utf8')).matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([,body])=>({
      file:resolve(dirname(source),body.match(/url\(['"]?([^'"\)]+)['"]?\)/)[1]),
      range:body.match(/unicode-range:([^;}]*)/i)[1],
    }));
    for (const face of faces) {
      face.bytes = (await stat(face.file)).size;
      face.ranges = face.range.split(',').map(r=>r.trim().replace(/^U\+/i,'').split('-').map(x=>parseInt(x,16)));
      css += `@font-face{font-family:${name};font-weight:${weight};font-display:swap;src:url('/${face.file.slice(root.length+1).replaceAll('\\','/')}');unicode-range:${face.range}}\n`;
      report.packages[name].allFontBytes += face.bytes;
      report.packages[name].allFiles++;
    }
    for (const [scenario,text] of Object.entries(scenarios)) {
      const points = [...text].map(c=>c.codePointAt(0));
      const hit = faces.filter(face=>points.some(p=>face.ranges.some(([a,b=a])=>p>=a && p<=b)));
      const missing = [...new Set([...text].filter(c=>!faces.some(face=>face.ranges.some(([a,b=a])=>c.codePointAt(0)>=a && c.codePointAt(0)<=b))))];
      report.packages[name].scenarios[`${scenario}-${weight}`] = {bytes:hit.reduce((n,f)=>n+f.bytes,0),files:hit.length,missing};
    }
  }
}
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'compare.css'),css);
const sample = ['RHINE LAB','SYNTHESIZE INFORMATION','ANALYSIS OS / X-001','莱茵生命 · 内部资料档案','身份信息确认：JOYCE MOORE','克丽斯腾／赫默／塞雷娅／缪尔赛思'];
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/ .tools/font-comparison/compare.css"><style>body{background:#e8e5e1;color:#171713;display:flex;gap:32px;padding:32px;margin:0}section{flex:1;min-width:0}h2{font:16px system-ui}p{margin:18px 0;white-space:nowrap}</style>${packages.map(name=>`<section><h2>${name}</h2>${weights.map(([weight])=>sample.map(text=>`<p style="font: ${weight} 22px ${name}">${text}</p>`).join('')).join('')}</section>`).join('')}`.replace('/ .tools','/.tools');
const server = createServer(async(req,res)=>{try {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end(html);return}
  const file = resolve(root,'.'+pathname);if(!file.startsWith(root+sep))throw Error('path');
  const body = await readFile(file);
  res.writeHead(200,{'Content-Type':extname(file)==='.css'?'text/css':extname(file)==='.woff2'?'font/woff2':'application/octet-stream'}).end(body);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(5195,'127.0.0.1',r));
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1920,height:1280}});
  await page.goto('http://127.0.0.1:5195/');
  report.visual = await page.evaluate(async({packages,weights,corpus,sample})=>{
    await Promise.all(packages.flatMap(name=>weights.map(([w])=>document.fonts.load(`${w} 24px ${name}`,corpus))));
    const render = (family,weight) => {
      const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=100+Math.ceil([...corpus].length/45)*32;
      const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#111';c.font=`${weight} 24px ${family}`;
      c.fillText(sample.slice(0,3).join(' '),0,30);
      [...corpus].forEach((char,i)=>c.fillText(char,(i%45)*26,70+Math.floor(i/45)*32));
      return {data:c.getImageData(0,0,canvas.width,canvas.height).data,widths:sample.map(s=>c.measureText(s).width)};
    };
    return weights.flatMap(([weight])=>{
      const original=render('original',weight);
      return packages.slice(1).map(name=>{
        const candidate=render(name,weight);let sum=0,changed=0;
        for(let i=0;i<original.data.length;i++){const d=Math.abs(original.data[i]-candidate.data[i]);sum+=d;if(d)changed++}
        return {name,weight,meanChannelDifference:sum/original.data.length,changedChannels:changed,widthDifferences:candidate.widths.map((w,i)=>w-original.widths[i])};
      });
    });
  },{packages,weights,corpus,sample});
  await page.screenshot({path:resolve(output,'comparison.png'),fullPage:true});
} finally { await browser.close();await new Promise(r=>server.close(r)); }
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
