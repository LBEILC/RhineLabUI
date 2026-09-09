// Rasterize the existing shared vector mark; no alternate logo or generated art.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { labelMarkSvg } from "../src/brand.ts";
const {default:sharp}=await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : 'sharp');
const mark=labelMarkSvg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#e8e5e1"/><g transform="translate(91 179) scale(1.0645)" color="#171713">${mark}</g></svg>`;
await mkdir('public/icons',{recursive:true});
await writeFile('public/icons/app-icon.svg',svg);
for(const [name,size] of [['apple-touch-icon',180],['icon-192',192],['icon-512',512],['icon-maskable-512',512]])
  await sharp(Buffer.from(svg)).resize(size,size).png().toFile(`public/icons/${name}.png`);
console.log('Shared Rhine Lab mark exported to four home-screen icons.');
