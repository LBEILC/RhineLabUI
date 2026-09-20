import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';

// Package only the public application, using the same release list as the PWA.
// A fresh directory per release prevents stale files from previous builds.
const source = resolve('dist');
const metadata = JSON.parse(await readFile(resolve(source, 'pwa-build.json'), 'utf8'));
if (!/^[a-f0-9]{16}$/.test(metadata.version)) throw Error('Invalid PWA release version.');
// Pages Git builds need a stable output path; each hosted build starts clean.
const output = resolve('release/cloudflare', process.env.CF_PAGES === '1' ? 'site' : metadata.version);
const fonts = JSON.parse(await readFile('verification/boot-lettering/webfont-sources.json', 'utf8'));
for (const [weight, font] of Object.entries(fonts)) {
  const path = `fonts/novecento/webFonts/NovecentoSansWide${weight}/font.woff2`;
  if (!metadata.files.includes(path)) throw Error(`Official release requires licensed font: ${weight}`);
  const bytes = await readFile(resolve(source, path));
  if (createHash('sha256').update(bytes).digest('hex') !== font.sha256)
    throw Error(`Licensed font checksum mismatch: ${weight}`);
}
const files = [...new Set([...metadata.files, 'sw.js', 'pwa-build.json', 'update.html', 'update.js',
  'fonts/novecento/RhineLabNovecento.css'])].sort();
const entries = [];
for (const path of files) {
  const from = resolve(source, path);
  if (!from.startsWith(source + sep)) throw Error(`Invalid release path: ${path}`);
  const bytes = await readFile(from);
  if (bytes.length > 25 * 1024 * 1024) throw Error(`Cloudflare file exceeds 25 MiB: ${path}`);
  entries.push({ path, bytes });
}
if (files.length + 2 > 20000) throw Error('Cloudflare free plan file count exceeded.');
await mkdir(output, { recursive: true });
const allowed = new Set([...files, '_headers', '404.html']);
for (const path of await readdir(output, { recursive: true })) {
  if ((await stat(resolve(output, path))).isFile() && !allowed.has(path.replaceAll('\\', '/')))
    throw Error(`Unexpected existing file in package: ${path}`);
}
for (const { path, bytes } of entries) {
  const target = resolve(output, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
const immutable = files.filter(path => /^assets\/archive-(cassette|assembly)\.[a-f0-9]{16}\.glb$/.test(path));
const headers = [
  '/fonts/misans-webfont-4.3.1/*\n  Cache-Control: public, max-age=31536000, immutable',
  ...immutable.map(path => `/${path}\n  Cache-Control: public, max-age=31536000, immutable`),
  ...['/', '/index.html', '/update*', '/sw.js'].map(path => `${path}\n  Cache-Control: no-cache, no-store, must-revalidate`),
  ...['/manifest.webmanifest', '/pwa-build.json'].map(path => `${path}\n  Cache-Control: no-cache, must-revalidate`),
];
await writeFile(resolve(output, '_headers'), headers.join('\n\n') + '\n');
// Missing assets must return 404 instead of being mistaken for successful HTML.
await writeFile(resolve(output, '404.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面不存在 · Rhine Lab</title><h1>页面不存在</h1><p><a href="/">返回首页</a></p></html>');
await writeFile('release/cloudflare/latest.json', JSON.stringify({
  version: metadata.version, directory: output, files: files.length + 2,
  bytes: entries.reduce((total, entry) => total + entry.bytes.length, 0),
  largestFileBytes: Math.max(...entries.map(entry => entry.bytes.length)),
}, null, 2));
console.log(`Cloudflare package ready: ${output}\n${files.length + 2} files; licensed fonts verified.`);
