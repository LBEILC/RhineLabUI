import { readFile, writeFile, copyFile, mkdir, rename, mkdtemp, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { extractAll } from '@electron/asar'
import { patchNative } from './native-release-core.mjs'

async function run() {
const [command, supplied] = process.argv.slice(2)
if (!['install', 'uninstall', 'check'].includes(command) || !supplied) {
  console.error('Usage: node rhine-native.cjs <check|install|uninstall> "C:\\path\\DeepSeek Harness.exe"')
  process.exitCode = 1
} else {
  try {
    const location = resolve(supplied)
    const root = location.toLowerCase().endsWith('.exe') ? dirname(location) : location
    const executable = join(root, 'DeepSeek Harness.exe')
    await access(executable)
    const resources = join(root, 'resources'), app = join(resources, 'app'), archive = join(resources, 'app.asar')
    const assetRoot = join(dirname(resolve(process.argv[1])), 'desktop')
    if (process.platform !== 'win32') throw new Error('This native integration supports Windows only.')
    const running = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-Process | ForEach-Object { if ($_.ProcessName -eq "DeepSeek Harness" -and $_.Path -eq $env:RHINE_CHECK_EXE) { $_.Id } }'],
      { encoding: 'utf8', windowsHide: true, env: { ...process.env, RHINE_CHECK_EXE: executable } }).trim()
    if (running) throw new Error('Fully quit DSH from its menu/tray before continuing.')
    let source = app, staged = false
    // Electron searches app.asar before app. Never silently patch an inactive tree.
    if (existsSync(archive)) {
      if (existsSync(app)) throw new Error('Both resources/app and app.asar exist. Resolve the custom installation layout first.')
      if (command === 'uninstall') throw new Error('No unpacked RHINE native installation found; nothing changed.')
      source = await mkdtemp(join(resources, '.rhine-staging-'))
      extractAll(archive, source)
      staged = true
    }
    const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    const mainPath = join(source, 'lib/main.js'), preloadPath = join(source, 'lib/preload-app.cjs')
    const originalMain = await readFile(mainPath, 'utf8'), originalPreload = await readFile(preloadPath, 'utf8')
    const bridge = await readFile(join(assetRoot, 'rhine-preload.cjs'), 'utf8')
    const patched = patchNative(pkg, originalMain, originalPreload, bridge, command === 'uninstall')
    if (command === 'check') {
      console.log(`Compatible: ${pkg.version}; ${staged ? 'app.asar' : 'unpacked app'}. No application files changed.`)
      if (staged) console.log(`Inspection copy retained at ${source}; it is not loaded by DSH.`)
    } else {
      const backup = await mkdtemp(join(resources, 'rhine-native-backup-'))
      await writeFile(join(backup, 'main.js'), originalMain)
      await writeFile(join(backup, 'preload-app.cjs'), originalPreload)
      const policy = join(source, 'lib/rhine-window-policy.mjs')
      const hadPolicy = existsSync(policy)
      if (hadPolicy) await copyFile(policy, join(backup, 'rhine-window-policy.mjs'))
      // Complete all validation and backups before writing either entrypoint.
      try {
        if (command === 'install') await copyFile(join(assetRoot, 'rhine-window-policy.mjs'), policy)
        await writeFile(mainPath, patched.main)
        await writeFile(preloadPath, patched.preload)
        if (staged) {
          const archiveBackup = join(resources, 'app.asar.rhine-original')
          if (existsSync(archiveBackup)) throw new Error('Original archive backup already exists; refusing to overwrite it.')
          await rename(source, app)
          try { await rename(archive, archiveBackup) }
          catch (error) { await rename(app, source); throw error }
          console.log(`Original archive preserved: ${archiveBackup}`)
        }
      } catch (error) {
        await writeFile(mainPath, originalMain)
        await writeFile(preloadPath, originalPreload)
        if (hadPolicy) await copyFile(join(backup, 'rhine-window-policy.mjs'), policy)
        throw error
      }
      console.log(`${command === 'install' ? 'Installed' : 'Removed'} RHINE native integration. Backup: ${backup}`)
      console.log('Restart DSH. Profile settings and conversations were not modified.')
      if (command === 'uninstall') console.log('The inactive policy file and unpacked application are retained; no unrelated files were deleted.')
    }
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
}
void run()
