import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { installCaptionPatch, removeCaptionPatch } from '../desktop/rhine-caption-patch.mjs'
const host = 'const color = nativeColor(style.backgroundColor);\nattributeFilter: ["data-ds-dark-theme", "style"]'
test('caption adapter is idempotent and reversible without rewriting other preload customizations', () => {
  const input = '// unrelated desktop customization\n' + host
  const patched = installCaptionPatch(input)
  assert.equal(installCaptionPatch(patched), patched)
  assert.equal(removeCaptionPatch(patched), input)
  assert.equal(removeCaptionPatch(input), input)
  assert.match(patched, /data-rhine/)
})
test('caption uses transparent theme fill, high contrast Canvas, or the unmodified host fallback', () => {
  const expression = installCaptionPatch(host).split('\n')[0].replace('const color = ', '').replace(/;$/, '')
  const evaluate = new Function('style', 'nativeColor', 'return ' + expression)
  for (const fill of ['transparent', 'Canvas', '']) {
    const style = { getPropertyValue: () => fill, backgroundColor: '#2b302a' }
    assert.equal(evaluate(style, value => value), fill || '#2b302a')
  }
})
test('caption installation fails closed for unsupported preload shapes', () => {
  assert.throws(() => installCaptionPatch(''), /entrypoint differs/)
  assert.throws(() => installCaptionPatch(host + host), /entrypoint differs/)
})
test('popover clipping exceptions and narrower plugin width stay scoped', async () => {
  const css = await readFile(new URL('../src/client/archive.css', import.meta.url), 'utf8')
  assert.match(css, /\.rh-composer-seat:has\(:is\(\[data-seat-panel\], \[data-trigger-menu\]\)\)/)
  assert.match(css, /\.rh-main:has\(\.rh-composer-seat :is\(\[data-seat-panel\], \[data-trigger-menu\]\)\) \{ overflow: visible; \}/)
  assert.match(css, /\.rh-composer-seat \{[^}]*overflow-y: auto/)
  const plugin = css.match(/\.rh-body\.is-panel:has\(\[data-plugin-panel\]\) \{([^}]+)\}/)[1]
  assert.match(plugin, /width: clamp\(960px, 76vw, 1440px\)/)
  assert.match(plugin, /max-width: 90vw/)
  assert.match(plugin, /margin-inline: auto/)
  assert.doesNotMatch(plugin, /(?:height|top|bottom):/)
})
