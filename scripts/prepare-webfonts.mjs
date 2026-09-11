import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

// This is the license owner's existing Vercel project, not a font source for
// third-party forks. Other checkouts retain the authored phrase artwork.
const officialBuild = process.env.VERCEL_PROJECT_ID === 'prj_KyOQlIfl3qhHkI4SUpiD5tbFTE5w';
const sources = JSON.parse(await readFile(new URL('../verification/boot-lettering/webfont-sources.json', import.meta.url), 'utf8'));
const files = [
  ...Object.entries(sources).map(([weight, source]) => ({
    path: `webFonts/NovecentoSansWide${weight}/font.woff2`, hash: source.sha256,
  })),
  { path: 'RhineLabNovecento.css', hash: '9495a310fe80cc0c06c56cb9e04926ae4135e41ce674bacb6cd38c0d5f4f0f7a' },
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let restored = 0;
for (const file of files) {
  const target = resolve('public/fonts/novecento', file.path);
  let bytes;
  try { bytes = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!bytes && officialBuild) {
    // Bootstrap once from the owner's local kit. Later Git builds preserve
    // those same licensed bytes from the currently active production site.
    const url = `https://rhine.lubeiluchen.cc/fonts/novecento/${file.path}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Licensed font restore failed (${response.status}): ${file.path}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== file.hash) throw new Error(`Licensed font checksum mismatch: ${file.path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    restored++;
  }
  if (bytes && digest(bytes) !== file.hash) throw new Error(`Local licensed font checksum mismatch: ${file.path}`);
}
if (restored) console.log(`Restored ${restored} verified licensed assets for the owner's website build.`);
