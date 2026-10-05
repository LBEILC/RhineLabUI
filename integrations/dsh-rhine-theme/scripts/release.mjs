import { build } from 'esbuild'
import { readFile, writeFile, copyFile, mkdir, mkdtemp, cp, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = fileURLToPath(new URL('..', import.meta.url))
process.chdir(root)
if (process.platform !== 'win32') throw new Error('ZIP release assembly currently uses Windows Compress-Archive.')
const pkg = JSON.parse(await readFile('package.json','utf8'))
const name = `${pkg.name}-${pkg.version}`
const out = resolve('releases', pkg.version)
await mkdir(out,{recursive:true})
await mkdir('build',{recursive:true})
const stage = await mkdtemp(resolve('build/release-'))
const runtime = join(stage,'package'), bundle = join(stage,`${name}-windows`)
await mkdir(runtime); await mkdir(bundle)
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'})
const manifest = { name:pkg.name, version:pkg.version, description:pkg.description,
  type:pkg.type, license:pkg.license, main:pkg.main, exports:pkg.exports,
  files:['lib','cordis.patch.yml','README.md','INSTALL.md','LICENSE','THIRD_PARTY_NOTICES.md','licenses'],
  peerDependencies:pkg.peerDependencies, dependencies:{'@deepseek-ai/schemastery':pkg.dependencies['@deepseek-ai/schemastery']}, dsh:pkg.dsh }
await writeFile(join(runtime,'package.json'),JSON.stringify(manifest,null,2)+'\n')
await cp('lib',join(runtime,'lib'),{recursive:true})
await cp('licenses',join(runtime,'licenses'),{recursive:true})
for(const file of ['cordis.patch.yml','LICENSE','THIRD_PARTY_NOTICES.md'])await copyFile(file,join(runtime,file))
await copyFile('distribution/INSTALL.md',join(runtime,'INSTALL.md'))
await copyFile('distribution/RELEASE_NOTES.md',join(runtime,'README.md'))
// npm pack runs only against the sanitized, already-built package directory.
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')
const packed = JSON.parse(execFileSync(process.execPath,[npmCli,'pack',runtime,'--ignore-scripts','--json','--pack-destination',out],{encoding:'utf8'}))[0]
if(packed.files.some(f=>/^(src|assets|backups|verification|node_modules)\//.test(f.path)))throw new Error('Unexpected private/development files in tarball')
await copyFile(join(out,packed.filename),join(bundle,packed.filename))
for(const file of ['INSTALL.md','RELEASE_NOTES.md'])await copyFile(join('distribution',file),join(bundle,file))
for(const file of ['LICENSE','THIRD_PARTY_NOTICES.md'])await copyFile(file,join(bundle,file))
await cp('licenses',join(bundle,'licenses'),{recursive:true})
const native = join(bundle,'native')
await mkdir(native)
await mkdir(join(native,'desktop'))
for(const file of ['rhine-preload.cjs','rhine-window-policy.mjs'])await copyFile(join('desktop',file),join(native,'desktop',file))
const built = await build({entryPoints:['scripts/native-release.mjs'],outfile:join(native,'rhine-native.cjs'),
  bundle:true,platform:'node',format:'cjs',target:'node22',metafile:true,
  define:{'import.meta.url':'__rhineBundleURL'},
  banner:{js:'const __rhineBundleURL = require("node:url").pathToFileURL(__filename).href;'}, minify:false})
const packageRoots = new Set()
for(const input of Object.keys(built.metafile.inputs).filter(p=>p.includes('node_modules/'))) {
  let dir=dirname(resolve(input))
  while(dirname(dir)!==dir) {
    if(existsSync(join(dir,'package.json'))&&JSON.parse(await readFile(join(dir,'package.json'),'utf8')).name)break
    dir=dirname(dir)
  }
  packageRoots.add(dir)
}
let notice='# Native installer bundled dependencies\n\n'
for(const dir of [...packageRoots].sort()) {
  const meta=JSON.parse(await readFile(join(dir,'package.json'),'utf8'))
  const files=(await readdir(dir)).filter(f=>/^licen[cs]e(?:\.|$)/i.test(f))
  if(!files.length)throw new Error(`Missing license for ${meta.name}`)
  notice+=`## ${meta.name} ${meta.version}\n\nLicense: ${meta.license}\n\n`
  for(const f of files)notice+=await readFile(join(dir,f),'utf8')+'\n\n'
}
await writeFile(join(native,'THIRD_PARTY_NOTICES.md'),notice)
const sums=[]
async function collect(dir,prefix='') {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const rel=prefix+entry.name,full=join(dir,entry.name)
    if(entry.isDirectory())await collect(full,rel+'/')
    else sums.push(`${createHash('sha256').update(await readFile(full)).digest('hex')}  ${rel}`)
  }
}
await collect(bundle)
await writeFile(join(bundle,'CONTENTS.sha256'),sums.sort().join('\n')+'\n')
const zip=join(out,`${name}-windows.zip`)
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
  'Compress-Archive -LiteralPath $env:RHINE_ZIP_SOURCE -DestinationPath $env:RHINE_ZIP_OUT -Force'],
  {windowsHide:true,stdio:'inherit',env:{...process.env,RHINE_ZIP_SOURCE:bundle,RHINE_ZIP_OUT:zip}})
for(const file of ['INSTALL.md','RELEASE_NOTES.md'])await copyFile(join('distribution',file),join(out,file))
const publicFiles=[packed.filename,basename(zip),'INSTALL.md','RELEASE_NOTES.md']
await writeFile(join(out,'SHA256SUMS.txt'),(await Promise.all(publicFiles.map(async file=>`${createHash('sha256').update(await readFile(join(out,file))).digest('hex')}  ${file}`))).join('\n')+'\n')
await writeFile(join(stage,'pack-manifest.json'),JSON.stringify(packed,null,2))
console.log(JSON.stringify({out,stage,bundle,files:publicFiles,tarballFiles:packed.files.map(f=>f.path)},null,2))
