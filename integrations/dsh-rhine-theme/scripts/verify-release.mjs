import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { createPackage } from '@electron/asar'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
let bundle=resolve(process.argv[2]??'')
if(bundle.endsWith('.zip')) {
  const extracted=await mkdtemp(join(tmpdir(),'rhine-zip-check-'))
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
    'Expand-Archive -LiteralPath $env:RHINE_ZIP_FILE -DestinationPath $env:RHINE_ZIP_CHECK'],
    {windowsHide:true,env:{...process.env,RHINE_ZIP_FILE:bundle,RHINE_ZIP_CHECK:extracted}})
  const dirs=await readdir(extracted);assert.equal(dirs.length,1)
  bundle=join(extracted,dirs[0])
}
assert.ok(existsSync(join(bundle,'native/rhine-native.cjs')),'Pass the extracted release bundle directory')
const native=join(bundle,'native/rhine-native.cjs'),temp=await mkdtemp(join(tmpdir(),'rhine-release-check-'))
const report={temp,checks:[]}
for(const line of (await readFile(join(bundle,'CONTENTS.sha256'),'utf8')).trim().split('\n')) {
  const [hash,file]=line.split('  ')
  assert.equal(createHash('sha256').update(await readFile(join(bundle,file))).digest('hex'),hash,file)
}
report.checks.push('all extracted ZIP file hashes match CONTENTS.sha256')
const originalMain='const BrowserWindow = {};\n// unrelated main patch\n'
const originalPreload='const contextBridge = {};\nconst color = nativeColor(style.backgroundColor);\nconst config = { attributeFilter: ["data-ds-dark-theme", "style"] };\n'
const run=(command,exe)=>execFileSync(process.execPath,[native,command,exe],{encoding:'utf8',timeout:30000})
for(const kind of ['unpacked','asar']){
  const root=join(temp,kind),app=join(root,'resources/app'),exe=join(root,'DeepSeek Harness.exe')
  await mkdir(join(app,'lib'),{recursive:true});await writeFile(exe,'fixture only')
  await writeFile(join(app,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh-desktop',version:'0.2.0-rc.2'}))
  await writeFile(join(app,'lib/main.js'),originalMain);await writeFile(join(app,'lib/preload-app.cjs'),originalPreload)
  if(kind==='asar'){
    await createPackage(app,join(root,'resources/app.asar'))
    const {rename}=await import('node:fs/promises');await rename(app,join(root,'fixture-source'))
  }
  run('install',exe)
  assert.ok((await readFile(join(app,'lib/main.js'),'utf8')).includes('rhine-window-policy.mjs'))
  if(kind==='asar')assert.ok(existsSync(join(root,'resources/app.asar.rhine-original')))
  await writeFile(join(app,'lib/preload-app.cjs'),await readFile(join(app,'lib/preload-app.cjs'),'utf8')+'\n// later third-party patch\n')
  run('install',exe);run('uninstall',exe)
  assert.equal(await readFile(join(app,'lib/main.js'),'utf8'),originalMain)
  const removed=await readFile(join(app,'lib/preload-app.cjs'),'utf8')
  assert.ok(removed.includes('// later third-party patch'));assert.ok(!removed.includes('RHINE_DESKTOP_PRELOAD_BEGIN'))
  assert.ok(removed.includes('nativeColor(style.backgroundColor)'))
  report.checks.push(`${kind}: install/update/uninstall and unrelated patch preservation`)
  await writeFile(join(app,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh-desktop',version:'0.3.0'}))
  assert.throws(()=>run('install',exe),/Only DSH/)
  assert.equal(await readFile(join(app,'lib/main.js'),'utf8'),originalMain)
  report.checks.push(`${kind}: unsupported version rejected without entrypoint changes`)
}
// The native fixture checks run in CI without installing DSH. When supplied,
// also exercise the matching Desktop backend in an isolated profile.
if (process.env.DSH_SOURCE_ROOT) {
const host = resolve(process.env.DSH_SOURCE_ROOT)
// Use the same backend as Desktop's plugin manager, in an isolated profile.
const home=join(temp,'dsh-home'),profile=join(home,'profiles/desktop')
await mkdir(profile,{recursive:true})
await writeFile(join(profile,'package.json'),JSON.stringify({name:'rhine-release-smoke',private:true,dependencies:{},dsh:{profile:{bundles:[]}}},null,2))
// The installed build bundles this internal function into index.js. Expose it
// only in this test copy, retaining its real dependency resolution and behavior.
const manager=join(host,'packages/boot/plugin-manager/lib/index.js'),require=createRequire(pathToFileURL(manager))
const managerCode=(await readFile(manager,'utf8')).replace(/from "([^"\n]+)"/g,(all,spec)=>spec.startsWith('node:')?all:`from ${JSON.stringify(pathToFileURL(require.resolve(spec)).href)}`)
const {runProfilePnpm}=await import('data:text/javascript;base64,'+Buffer.from(managerCode+'\nexport { runProfilePnpm };').toString('base64'))
const context={profile:'desktop',dir:profile,home,installAnchor:join(host,'apps/cli/package.json'),cwd:process.cwd()}
const options={command:process.execPath,args:[process.env.DSH_PNPM_CLI ?? join(host,'desktop/resources/runtime/pnpm/bin/pnpm.cjs')],
  env:{DSH_HOME:home},execution:'service',outputBytes:16384,idleTimeoutMs:60000,lookupTimeoutMs:30000}
const tarball=join(bundle,'dsh-rhine-theme-1.0.0.tgz')
const added=await runProfilePnpm(context,['add',tarball],options)
assert.equal(added.exitCode,0,added.output)
const manifest=JSON.parse(await readFile(join(profile,'package.json'),'utf8'))
assert.ok(manifest.dependencies['dsh-rhine-theme'])
assert.ok(manifest.dsh.profile.bundles.includes('dsh-rhine-theme'))
const installed=join(profile,'node_modules/dsh-rhine-theme')
assert.ok(existsSync(join(installed,'lib/client.js')))
const runtime=JSON.parse(await readFile(join(installed,'package.json'),'utf8'))
assert.equal(runtime.scripts,undefined);assert.equal(runtime.devDependencies,undefined)
execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(join(installed,'lib/index.js')).href)})`],{encoding:'utf8'})
report.checks.push('Desktop package-manager backend installs tarball and activates bundle in isolated profile')
report.checks.push('installed host entry imports successfully; no build scripts or devDependencies')
const uninstalled=await runProfilePnpm(context,['remove','dsh-rhine-theme'],options)
assert.equal(uninstalled.exitCode,0,uninstalled.output)
const removed=JSON.parse(await readFile(join(profile,'package.json'),'utf8'))
assert.ok(!removed.dsh.profile.bundles.includes('dsh-rhine-theme'))
report.checks.push('Desktop package-manager backend removes isolated bundle registration')
} else {
  report.hostIntegration = 'Not run: set DSH_SOURCE_ROOT to a built DSH 0.2.0-rc.2 checkout to test its package manager.'
}
await mkdir('verification/release',{recursive:true})
await writeFile('verification/release/report.json',JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
