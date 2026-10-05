import ts from 'typescript'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const project = fileURLToPath(new URL('..', import.meta.url))
if (!process.env.DSH_SOURCE_ROOT) {
  throw new Error('Set DSH_SOURCE_ROOT to a built DSH 0.2.0-rc.2 source checkout. See README.md for type-check requirements.')
}
const host = path.resolve(process.env.DSH_SOURCE_ROOT)
if (!existsSync(path.join(host, 'packages/client/ui-renderer/package.json'))) {
  throw new Error('DSH_SOURCE_ROOT does not contain packages/client/ui-renderer/package.json')
}
const config = ts.readConfigFile(path.join(project, 'tsconfig.json'), ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, project)

// Published client .d.ts files reference development-only DSH type packages.
// A source checkout supplies its already-built declaration faces. All paths are
// discovered from export maps, never from another theme or an absolute tool path.
const hostRequire = createRequire(path.join(host, 'packages/client/ui-renderer/package.json'))
const paths = { 'react-dom/client': [path.join(path.dirname(hostRequire.resolve('@types/react-dom/package.json')), 'client.d.ts')] }
function walk(directory) {
  if (!existsSync(directory)) return
  const manifest = path.join(directory, 'package.json')
  if (existsSync(manifest)) {
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    if (pkg.name?.startsWith('@deepseek-ai/')) {
      // Desktop compatibility is checked against the matching built host,
      // even when the build tools are linked from the Web theme's install.
      for (const [key, value] of Object.entries(pkg.exports ?? {})) {
        const types = typeof value === 'object' && value !== null ? value.types : undefined
        if (typeof types !== 'string') continue
        const resolved = path.resolve(directory, types)
        if (existsSync(resolved)) paths[pkg.name + (key === '.' ? '' : key.slice(1))] = [resolved]
      }
    }
    return
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !['node_modules', '.git', 'lib', 'src'].includes(entry.name)) walk(path.join(directory, entry.name))
  }
}
walk(path.join(host, 'packages'))
walk(path.join(host, 'vendor'))
if (Object.keys(paths).length) parsed.options.paths = { ...parsed.options.paths, ...paths }
const program = ts.createProgram(parsed.fileNames, parsed.options)
const diagnostics = ts.getPreEmitDiagnostics(program)
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => project, getNewLine: () => '\n' }))
  process.exitCode = 1
} else console.log('RHINE: strict TypeScript check passed against the installed DSH declarations.')
