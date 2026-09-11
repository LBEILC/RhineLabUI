import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Static Build Output API packaging does not require downloading production
// environment variables. Run npm run build first, then vercel deploy --prebuilt.
const metadata = JSON.parse(await readFile('dist/pwa-build.json', 'utf8'));
if (!metadata.files.some(path => path.includes('NovecentoSansWideNormal/font.woff2')))
  throw new Error('Install the locally licensed Novecento kit before packaging the official deployment.');
await mkdir('.vercel/output', { recursive: true });
await cp(resolve('dist'), resolve('.vercel/output/static'), { recursive: true });
await writeFile('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes: [
    { src: '^/fonts/misans-webfont-4.3.1/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/assets/(archive-(?:cassette|assembly)\\.[a-f0-9]{16}\\.glb)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/update(.*)$', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }, continue: true },
    { src: '^/(sw\\.js|manifest\\.webmanifest|pwa-build\\.json)$', headers: { 'Cache-Control': 'no-cache, must-revalidate' }, continue: true },
    { handle: 'filesystem' },
  ],
}, null, 2));
console.log(`Packaged official static deployment ${metadata.version}.`);
