import { build } from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const label = process.argv[2] || 'candidate';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid benchmark label');
await mkdir('.tools/performance',{recursive:true});
await writeFile('.tools/performance/hud-baseline.ts',execFileSync('git',['show','75f7eac83d65dcb70a6177437d7994ce5a0933f2:src/hud-projection.ts']));
const originalFiles=['scene.ts','hud-projection.ts','archive-visibility.ts'];
const baseline=label==='baseline'?{name:'performance-baseline',enforce:'pre',load(id){
 const name=originalFiles.find(name=>id.replaceAll('\\','/').endsWith('/src/'+name));
 if(name)return execFileSync('git',['show',`75f7eac83d65dcb70a6177437d7994ce5a0933f2:src/${name}`],{encoding:'utf8'});
}}:null;
await build({plugins:baseline?[baseline]:[],build:{outDir:`release/performance-${label}`,rollupOptions:{input:{benchmark:'reference/performance.html',hud:'reference/hud-performance.html',app:'index.html'}}}});
