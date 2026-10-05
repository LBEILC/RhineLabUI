import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const browser = await chromium.connectOverCDP(process.env.DSH_CDP_URL ?? 'http://127.0.0.1:9224')
const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url() === 'dsh-app://app/')
if (!page) throw new Error('No DSH Desktop renderer on port 9224')
const cdp = await page.context().newCDPSession(page)
const out = new URL('../verification/focus-motion/', import.meta.url)
await mkdir(out, { recursive: true })
const report = { checks: [], errors: [], samples: [] }
function check(name, passed) { report.checks.push({ name, passed }); assert.ok(passed, name) }
page.on('pageerror', error => report.errors.push(error.message))
async function sample() {
  return page.evaluate(() => {
    const host = document.querySelector('.rh-archive-stage'), panel = document.querySelector('.rh-body')
    let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber$'))], scene, projection
    for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      const ref = hook.memoizedState?.current
      if (ref?.getStats) scene = ref
      if (ref?.uniforms?.archiveBounds) projection = ref
    }
    const box = panel.getBoundingClientRect(), stage = host.getBoundingClientRect(), button = document.querySelector('.rh-focus-toggle').getBoundingClientRect()
    return { viewport: [innerWidth, innerHeight, devicePixelRatio], rect: box.toJSON(), transform: getComputedStyle(panel).transform,
      animation: panel.getAnimations().find(animation => animation.id === 'rh-projection-flip')?.playState ?? null,
      projection: projection?.uniforms.archiveBounds.value.toArray(), expected: [(box.left - stage.left) / stage.width, (box.top - stage.top) / stage.height, box.width / stage.width, box.height / stage.height],
      focused: panel.classList.contains('is-focus'), buttonHit: !!document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2)?.closest('.rh-focus-toggle'),
      renderedFrames: scene?.getStats().renderedFrames, assembly: scene?.scene.getObjectByName('rhine-inspection-assembly')?.visible }
  })
}
try {
  await page.locator('.rh-archive-stage[data-scene-status=ready]').waitFor({ timeout: 45000 })
  if (await page.locator('.rh-frame').getAttribute('data-focus') === 'true') {
    await page.locator('.rh-focus-toggle').click()
    await page.waitForTimeout(1000)
  }
  // Open a disposable test conversation before running this script. Never
  // navigate by a developer's private project or conversation title.
  await page.locator('.rh-frame[data-phase=conversation]').waitFor({ timeout: 20000 })
  await page.locator('[data-composer-input]').waitFor()
  if (await page.locator('.rh-body').evaluate(element => element.classList.contains('is-focus'))) await page.locator('.rh-focus-toggle').click()
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__rhFocusEditor = document.querySelector('[data-composer-input]'); window.__rhFocusDraft = window.__rhFocusEditor.textContent })
  const before = await sample()
  check('Desktop loaded the unclipped motion implementation', await page.locator('.rh-body').evaluate(element => getComputedStyle(element).clipPath === 'none' && getComputedStyle(element).transformOrigin === '0px 0px'))
  const initial = await page.evaluate(() => {
    document.querySelector('.rh-focus-toggle').click()
    return new Promise(resolve => requestAnimationFrame(() => {
      const panel = document.querySelector('.rh-body'), animation = panel.getAnimations().find(animation => animation.id === 'rh-projection-flip')
      if (animation) { animation.pause(); animation.currentTime = 220 }
      resolve(!!animation)
    }))
  })
  check('React focus toggle creates a real expanding animation', initial)
  await page.waitForTimeout(120)
  const middle = await sample(); report.samples.push({ before, middle })
  check('Midpoint moves the complete panel and keeps its controls reachable', middle.rect.left < before.rect.left && middle.rect.width > before.rect.width && middle.buttonHit)
  check('3D edge voxels track the animated visual rectangle', middle.projection?.every((value, i) => Math.abs(value - middle.expected[i]) < .002))
  if (process.argv.includes('--capture')) await page.screenshot({ path: fileURLToPath(new URL('desktop-live-midpoint.png', out)) })
  await page.evaluate(() => document.querySelector('.rh-body').getAnimations().find(animation => animation.id === 'rh-projection-flip').play())
  await page.waitForTimeout(2000)
  const end = await sample(); report.samples.push({ end })
  check('Settled focus has no transform residue and displays the optical assembly', end.focused && end.transform === 'none' && !end.animation && end.assembly)
  check('3D edge voxels also reach the final rectangle', end.projection?.every((value, i) => Math.abs(value - end.expected[i]) < .002))
  await cdp.send('Performance.enable')
  await page.evaluate(() => {
    window.__rhFocusSizes = []
    window.__rhFocusObserver = new ResizeObserver(entries => entries.forEach(entry => window.__rhFocusSizes.push({ target: entry.target.className, width: entry.contentRect.width, height: entry.contentRect.height })))
    window.__rhFocusObserver.observe(document.querySelector('.rh-body'))
    window.__rhFocusObserver.observe(document.querySelector('.rh-scroll'))
  })
  await page.waitForTimeout(40)
  await page.evaluate(() => { window.__rhFocusSizes = [] })
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]))
  const first = await metric()
  await page.locator('.rh-focus-toggle').click(); await page.waitForTimeout(1100)
  const last = await metric()
  report.collapse = { layouts: last.LayoutCount - first.LayoutCount, layoutMs: 1000 * (last.LayoutDuration - first.LayoutDuration), styleMs: 1000 * (last.RecalcStyleDuration - first.RecalcStyleDuration) }
  report.collapse.sizes = await page.evaluate(() => window.__rhFocusSizes)
  // Desktop also animates small SVG orbit circles (Layout events for 14 nodes).
  // Observe the expensive chat subtree itself instead of counting all SVG work
  // as chat reflow. The trace diagnosis is saved alongside this report.
  check('Real panel and conversation each resize only once during collapse', report.collapse.sizes.length === 2 && new Set(report.collapse.sizes.map(item => item.target)).size === 2)
  await page.evaluate(() => document.querySelector('.rh-focus-toggle').click()); await page.waitForTimeout(130)
  await page.keyboard.press('Escape'); await page.waitForTimeout(1000)
  check('Escape safely reverses an active expansion', !(await sample()).focused && !(await sample()).animation)
  check('Real editor and saved draft survive all focus toggles unchanged', await page.evaluate(() => window.__rhFocusEditor === document.querySelector('[data-composer-input]') && window.__rhFocusDraft === window.__rhFocusEditor.textContent))
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('.rh-focus-toggle').click()
  check('Desktop reduced-motion setting bypasses WAAPI', !(await sample()).animation)
  await page.locator('.rh-focus-toggle').click(); await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(4000)
  const idleStart = await sample(); await page.waitForTimeout(1500); const idleEnd = await sample()
  check('Settled conversation returns to sleeping without a permanent animation loop', idleStart.renderedFrames === idleEnd.renderedFrames)
  check('No Desktop renderer errors', report.errors.length === 0)
} finally {
  await page.emulateMedia({ reducedMotion: null, forcedColors: null })
  await page.evaluate(() => { document.querySelector('.rh-body')?.getAnimations().forEach(animation => { if (animation.id === 'rh-projection-flip') animation.finish() }); window.__rhFocusObserver?.disconnect(); delete window.__rhFocusObserver; delete window.__rhFocusSizes; delete window.__rhFocusEditor; delete window.__rhFocusDraft })
  await writeFile(new URL('desktop-report.json', out), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await cdp.detach(); await browser.close()
}
