import { build } from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const label = process.argv[2] || 'candidate';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid benchmark label');
const originalBaseline='75f7eac83d65dcb70a6177437d7994ce5a0933f2';
let baselineRef=process.env.PERF_BASELINE||originalBaseline;
try { execFileSync('git',['cat-file','-e',`${baselineRef}^{commit}`],{stdio:'ignore'}); }
catch(error) {
 if(process.env.PERF_BASELINE)throw error;
 // The standalone wallpaper repository carries transplanted commits. A fresh
 // clone can use its own pre-optimization revision without the other remote.
 const integrated=execFileSync('git',['log','-1','--format=%H','--fixed-strings','--grep=perf: reuse archive rendering work without lowering quality'],{encoding:'utf8'}).trim();
 if(!integrated)throw new Error('No baseline found; set PERF_BASELINE to a local pre-optimization revision.');
 baselineRef=`${integrated}^`;
}
const baselineCommit=execFileSync('git',['rev-parse',baselineRef],{encoding:'utf8'}).trim();
console.log('Performance baseline:',baselineCommit);
await mkdir('.tools/performance',{recursive:true});
await writeFile('.tools/performance/baseline.json',JSON.stringify({baselineCommit},null,2));
await writeFile('.tools/performance/hud-baseline.ts',execFileSync('git',['show',`${baselineCommit}:src/hud-projection.ts`]));
const originalFiles=['scene.ts','hud-projection.ts','archive-visibility.ts'];
const baseline=label==='baseline'?{name:'performance-baseline',enforce:'pre',load(id){
 const name=originalFiles.find(name=>id.replaceAll('\\','/').endsWith('/src/'+name));
 if(name)return execFileSync('git',['show',`${baselineCommit}:src/${name}`],{encoding:'utf8'});
}}:null;
await build({plugins:baseline?[baseline]:[],build:{outDir:`release/performance-${label}`,rollupOptions:{input:{benchmark:'reference/performance.html',hud:'reference/hud-performance.html',app:'index.html'}}}});
