import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
async function load(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { FrameRateLimit } = await load('../src/client/rhine/frame-rate-limit.ts')
const { DEFAULTS, normalizeMaxFps, resolvePreferences } = await load('../src/preferences.ts')
const { Config } = await load('../src/index.ts')

test('60 FPS defaults migrate old settings; caps are integral, bounded and persisted by host schema', () => {
  assert.equal(DEFAULTS.maxFps, 60)
  assert.equal(resolvePreferences({ quality: 'high' }).maxFps, 60)
  assert.equal(Config({}).maxFps.get(), 60)
  for (const value of [undefined, null, NaN, Infinity, -1, 361, 59.5, '30']) assert.equal(normalizeMaxFps(value), 60)
  for (const value of [0, 1, 30, 73, 165, 360]) {
    assert.equal(resolvePreferences({ maxFps: value }).maxFps, value)
    assert.equal(Config({ maxFps: value }).maxFps.get(), value)
  }
  for (const value of [-1, 361, 59.5]) assert.throws(() => Config({ maxFps: value }))
})

test('rate caps retain fractional deadlines on mixed-refresh displays without rounding down', () => {
  for (const refresh of [60, 120, 144, 165, 240]) for (const cap of [0, 1, 24, 30, 45, 60, 73, 90, 144, 240, 360]) {
    const gate = new FrameRateLimit(); gate.setMaxFps(cap)
    let count = 0
    for (let i = 0; i < refresh * 10; i++) {
      const time = i * 1000 / refresh
      if (gate.canRender(time)) { gate.rendered(time); count++ }
    }
    const expected = Math.min(refresh, cap || refresh) * 10
    assert.ok(Math.abs(count - expected) <= 1, `${refresh} Hz, ${cap} cap: ${count} instead of ${expected}`)
  }
})

test('pointer wake/repeated config cannot bypass cap; GPU backpressure consumes no budget', () => {
  const gate = new FrameRateLimit(); gate.setMaxFps(30)
  assert.ok(gate.canRender(0)); gate.rendered(0)
  for (let t = 1; t < 33; t++) { gate.setMaxFps(30); assert.equal(gate.canRender(t), false) }
  assert.ok(gate.canRender(34)); assert.ok(gate.canRender(35)); gate.rendered(35)
  assert.equal(gate.canRender(36), false)
  gate.setMaxFps(120); assert.ok(gate.canRender(36)); gate.rendered(36)
  assert.equal(gate.canRender(37), false)
  gate.setMaxFps(0); assert.ok(gate.canRender(37))
})

test('a stalled/hidden scene resumes once, never repays missed frames in a burst', () => {
  const gate = new FrameRateLimit(); gate.setMaxFps(30); gate.rendered(0)
  assert.ok(gate.canRender(60000)); gate.rendered(60000)
  assert.equal(gate.canRender(60001), false)
  assert.ok(gate.canRender(60034))
})
