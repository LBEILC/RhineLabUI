import { build } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
const outDir = 'release/model-precision';
await build({build:{outDir,rollupOptions:{input:{benchmark:'reference/performance.html',review:'reference/model-precision.html'}}}});
await mkdir(`${outDir}/reference/model-precision`,{recursive:true});
for(const tier of ['medium','low']) await cp(`reference/model-precision/${tier}.glb`,`${outDir}/reference/model-precision/${tier}.glb`);
