import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
const preferences = await transform(await readFile(new URL('../src/preferences.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' })
const { resolvePreferences } = await import('data:text/javascript;base64,' + Buffer.from(preferences.code).toString('base64'))

// Execute the real plugin lifecycle with host/DOM boundaries stubbed; no 3D scene.
const source = (await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8'))
  .replace(/^import .*$/gm, '')
const { code } = await transform(source, { loader: 'tsx', format: 'cjs' })
function harness() {
  let snapshot = { status: 'loading', value: undefined, writable: false }, notify
  const events = [], module = { exports: {} }
  const noop = () => () => {}
  runInNewContext(code, {
    module, exports: module.exports, NAMESPACE: 'rhine', resolvePreferences,
    zh: {}, en: {}, TOKENS: {}, css: '', startupCss: '', sansFont: '', sansBold: '',
    document: { createElement: () => ({ dataset: {}, remove() {} }), head: { append() {} }, body: { dataset: {}, removeAttribute() {} } },
    window: { location: { reload: () => events.push('reload') } },
    setDesktopScene: active => events.push(`scene:${active}`),
    replaceHostSlot: (_ctx, slot) => { events.push(`install:${slot}`); return () => events.push(`restore:${slot}`) },
    Directory: () => null,
  })
  const ctx = {
    effect: fn => fn(), locale: { register: noop, bind: () => key => key },
    configForms: { get: () => ({ getSnapshot: () => snapshot, subscribe: fn => { notify = fn; return () => {} } }) },
    slots: { inject() {} }, on: noop,
    theme: { overrideTokens: () => { events.push('tokens'); return () => events.push('clearTokens') }, getTheme: () => ({ active: { colorScheme: 'dark' } }) },
  }
  module.exports.apply(ctx)
  return { events, update(next) { snapshot = next; notify() } }
}

test('loading configuration never briefly installs the default-enabled theme', () => {
  const h = harness()
  assert.deepEqual(h.events, [])
  h.update({ status: 'ready', value: { enabled: false }, writable: true })
  assert.deepEqual(h.events, ['scene:false'])
})

test('disabling an active theme reloads before revoking mounted slot contracts', () => {
  const h = harness()
  h.update({ status: 'ready', value: { enabled: true }, writable: true })
  assert.ok(h.events.includes('install:root'))
  assert.ok(h.events.includes('install:main.conversation'))
  h.events.length = 0
  h.update({ status: 'ready', value: { enabled: false }, writable: true })
  assert.deepEqual(h.events, ['reload'])
})
