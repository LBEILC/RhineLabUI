import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {wallpaperImageUrl} from '../src/wallpaper-image-url.ts';
const raw='E:/AIProject/RhineLabUI/reference/extracted-3088099655/wallpaper-2.jpg';
const expected='file:///'+raw;
for(const path of [raw,raw.replaceAll('/','\\'),'E%3A'+raw.slice(2),encodeURIComponent(raw),'file:///E%3A'+raw.slice(2),expected])
  assert.equal(wallpaperImageUrl(path),expected,path);
assert.equal(wallpaperImageUrl('C:/图片/100% #1.jpg'),'file:///C:/%E5%9B%BE%E7%89%87/100%25%20%231.jpg');
assert.equal(wallpaperImageUrl('file:///C:/folder/a%20b.jpg'),'file:///C:/folder/a%20b.jpg');
const require=createRequire(import.meta.url),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=resolve('verification/wallpaper-image');await mkdir(dir,{recursive:true});
const sources=await Promise.all(['src/wallpaper-image-url.ts','src/wallpaper-background.ts'].map(p=>readFile(p,'utf8')));
const js=ts.transpileModule(sources.join('\n').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
await writeFile(dir+'/test.html',`<!doctype html><div id="stage"><div id="three-scene"></div></div><script>${js}\nwindow.background=new WallpaperBackground(document.querySelector('#stage'),message=>(window.messages??=[]).push(message));</script>`);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();await page.goto(pathToFileURL(dir+'/test.html').href);
 const apply=(path,retry=false)=>page.evaluate(({path,retry})=>background.update({customwallpaper:{value:true},customwallpaperfile:{value:path}},true,true,retry),{path,retry});
 await apply('E%3A'+raw.slice(2));await page.waitForFunction(()=>document.querySelector('.wallpaper-background').dataset.ready==='true');
 assert.deepEqual(await page.locator('.wallpaper-background img').evaluate(el=>[el.naturalWidth,el.naturalHeight]),[3200,2000]);
 // Fail, create the same file, then reselect exactly the same path.
 const retryPath=dir+'/retry-'+Date.now()+'.jpg';
 await apply(retryPath);await page.waitForFunction(()=>window.messages?.length===1);
 await copyFile(raw,retryPath);
 await apply(retryPath,true);await page.waitForFunction(()=>document.querySelector('.wallpaper-background').dataset.ready==='true');
 assert.equal(await page.locator('.wallpaper-background img').last().evaluate(el=>el.naturalWidth),3200);
 await rm(retryPath);
 await writeFile(dir+'/results.json',JSON.stringify({raw,encoded:'E%3A'+raw.slice(2),url:expected,dimensions:[3200,2000],samePathRetry:true},null,2));
 console.log('Raw/escaped drive, whole escaped path, special characters, real local JPEG and same-path retry passed.');
}finally{await browser.close()}
