import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
const { code } = await transform(await readFile(new URL('../src/client/adapter.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' })
const { replaceHostSlot } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
function registry() {
  const callbacks = new Map(), records = new Map(), specs = new Map()
  let pulses = 0
  const notify = key => { for (const fn of [...(callbacks.get(key) ?? [])]) fn() }
  const slots = {
    entries: key => records.get(key) ?? [], spec: key => specs.get(key),
    subscribe: (key, fn) => { const set = callbacks.get(key) ?? new Set(); set.add(fn); callbacks.set(key,set); return () => set.delete(fn) },
    register: options => { pulses++; notify(options.name); return () => notify(options.name) },
  }
  return { ctx: { slots }, records, specs, notify, callbacks, pulses: () => pulses }
}
test('restores original component, injection identity and child authority on disable', () => {
  const r = registry(), original = () => 'native', next = () => 'theme', injected = {}
  const children = { header: { kind: 'single' } }
  const entry = { options: { priority: 0 }, component: original, children, locale: 'native', inject: injected }
  r.records.set('root', [entry]); r.specs.set('body', { kind: 'single', scope: 'session' })
  const undo = replaceHostSlot(r.ctx, 'root', next, ['header'], { children: ['body'], locale: 'conversation' })
  assert.equal(entry.component, next); assert.equal(entry.inject, injected); assert.ok(entry.children.body)
  undo(); assert.equal(entry.component, original); assert.equal(entry.children, children); assert.equal(entry.locale, 'native')
  assert.equal([...r.callbacks.values()].reduce((sum, set) => sum+set.size,0), 0)
  const count = r.pulses(); undo(); assert.equal(r.pulses(), count)
})
test('waits for late child declarations without replacing a half-ready host', () => {
  const r = registry(), original = () => 'native', next = () => 'theme'
  const entry = { options: {}, component: original, children: { header: {} } }
  r.records.set('root', [entry])
  const undo = replaceHostSlot(r.ctx, 'root', next, ['header'], { children: ['body'] })
  assert.equal(entry.component, original)
  r.specs.set('body', { kind: 'single' }); r.notify('body'); assert.equal(entry.component, next)
  undo(); assert.equal(entry.component, original)
})
test('does not overwrite a later component owner on teardown', () => {
  const r = registry(), original = () => 0, next = () => 1, later = () => 2
  const entry = { options: {}, component: original, children: {} }; r.records.set('root', [entry])
  const undo = replaceHostSlot(r.ctx, 'root', next)
  entry.component = later; undo(); assert.equal(entry.component, later)
})
