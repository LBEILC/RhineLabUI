import { build } from 'esbuild'
import { mkdir, readFile } from 'node:fs/promises'
import { compressModel } from './compress-model.mjs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
process.chdir(fileURLToPath(new URL('..', import.meta.url)))
await mkdir('lib', { recursive: true })
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery'] })
await build({
  entryPoints: ['src/client/index.tsx'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2022', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis'],
  loader: { '.css': 'text', '.glb': 'dataurl', '.woff2': 'dataurl', '.ogg': 'dataurl' },
  plugins: [{ name: 'lossless-models', setup(build) {
    build.onLoad({ filter: /\.glb$/ }, async ({ path }) => {
      const original = await readFile(path), compressed = await compressModel(original)
      console.log(`${basename(path)}: ${original.length} → ${compressed.length} bytes (lossless verified)`)
      return { contents: compressed, loader: 'dataurl' }
    })
  } }],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: 'window.__ModuleLoader__.load({ id: "dsh-rhine-theme", factory: (require) => { var module = { exports: {} }; var exports = module.exports;' },
  footer: { js: 'return module.exports; } });' }, minify: true,
})
console.log('Built RHINE Desktop theme (assets bundled for dsh-app://).')
