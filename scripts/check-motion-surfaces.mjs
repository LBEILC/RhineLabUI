// Run against built web and wallpaper previews. Uses the same environment as check-motion-integration.mjs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.REVIEW_CHANNEL || 'msedge', headless: true });
const errors = [], report = {};
const watch = page => page.on('pageerror', error => errors.push(error.message));
const settings = async page => {
  await page.locator('[data-action="settings"]').click();
  await page.locator('.motion-advanced summary').click();
};
const closeSettings = async page => {
  await page.locator('[data-action="close-modal"]').click();
  await page.waitForFunction(() => !document.querySelector('.modal-backdrop'));
};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rhine-settings', JSON.stringify({
    sound: false, music: false, superPerformance: true, colorTheme: 'dark',
    motion: { boot: false, surfaceTransitions: false, detailTransition: true, modelDecryption: false, documentReveal: false },
  })));
  const page = await context.newPage(); watch(page);
  await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5190');
  await page.waitForFunction(() => window.rhine?.stats().startup === 'started' && !document.querySelector('#loading'));
  await settings(page);
  report.contrast = await page.evaluate(() => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const panel = getComputedStyle(document.querySelector('.terminal-modal')).backgroundColor;
    return [...document.querySelectorAll('.motion-settings-head button, .motion-settings-head span, .motion-advanced summary span, .motion-settings legend, .motion-setting span')].map(el => {
      const style = getComputedStyle(el), background = style.backgroundColor === 'rgba(0, 0, 0, 0)' ? panel : style.backgroundColor;
      const a = luminance(style.color), b = luminance(background);
      return { text: el.textContent, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  assert.ok(report.contrast.every(item => item.ratio >= 4.5), JSON.stringify(report.contrast));
  await mkdir('.tools/motion-surfaces', { recursive: true });
  await page.locator('.motion-settings-head').screenshot({ path: '.tools/motion-surfaces/dark-controls.png' });
  await closeSettings(page);
  const entry = await page.evaluate(() => {
    window.rhine.detail();
    return { animations: document.querySelector('#detail-ui').getAnimations().length, camera: window.rhine.stats().cameraDetail };
  });
  assert.equal(entry.animations, 0, 'Disabled surface transition does not fade the detail panel');
  assert.ok(entry.camera < .95, 'Independent 3D detail transition still runs');
  await page.waitForFunction(() => window.rhine.stats().cameraDetail > .95);
  await page.locator('[data-tab="notes"]').click();
  assert.equal(await page.locator('.tab-indicator').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  assert.equal(await page.locator('#tab-panel').evaluate(el => el.getAnimations().length), 0);
  await page.evaluate(() => window.rhine.archive());
  assert.equal(await page.locator('#detail-ui').evaluate(el => el.hidden), true, 'Detail exit completes immediately');
  await settings(page);
  await page.locator('[data-motion="detailTransition"]').uncheck();
  await page.locator('[data-motion="surfaceTransitions"]').check();
  await closeSettings(page);
  assert.ok(await page.evaluate(() => {
    window.rhine.detail();
    return document.querySelector('#detail-ui').getAnimations().some(a => a.playState === 'running');
  }), 'UI fade remains available when only the 3D transition is disabled');
  await context.close();

  const wall = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const wp = await wall.newPage(); watch(wp);
  await wp.goto(process.env.WALLPAPER_URL || 'http://127.0.0.1:5176');
  await wp.waitForFunction(() => window.rhine?.stats().ready);
  await wp.evaluate(() => window.wallpaperPropertyListener.applyUserProperties({
    boot: { value: false }, sound: { value: false }, music: { value: false }, reduced: { value: false },
    superperformance: { value: true }, desktopmode: { value: 'archive' },
  }));
  await wp.waitForFunction(() => window.rhine.stats().startup === 'started');
  await wp.evaluate(() => window.rhine.detail());
  await wp.waitForFunction(() => window.rhine.stats().cameraDetail > .95);
  // Same-turn host updates exercise the transition before any animation can end naturally.
  report.viewerEnter = await wp.evaluate(() => {
    document.querySelector('[data-action="model-viewer"]').click();
    window.wallpaperPropertyListener.applyUserProperties({ reduced: { value: true } });
    const root = document.querySelector('.model-viewer');
    return { state: root.dataset.transition, animations: root.getAnimations({ subtree: true }).filter(a => a instanceof Animation && !(a instanceof CSSAnimation) && !(a instanceof CSSTransition) && a.playState === 'running').length };
  });
  assert.deepEqual(report.viewerEnter, { state: 'open', animations: 0 });
  await wp.waitForFunction(() => JSON.parse(document.querySelector('.model-viewer').dataset.stats || '{}').ready);
  report.viewerExit = await wp.evaluate(() => {
    window.wallpaperPropertyListener.applyUserProperties({ reduced: { value: false } });
    document.querySelector('[data-viewer="close"]').click();
    window.wallpaperPropertyListener.applyUserProperties({ reduced: { value: true } });
    const root = document.querySelector('.model-viewer');
    return { hidden: root.hidden, state: root.dataset.transition, focus: document.activeElement.dataset.action, detailInert: document.querySelector('#detail-ui').inert };
  });
  assert.deepEqual(report.viewerExit, { hidden: true, state: 'closed', focus: 'model-viewer', detailInert: false });
  await wp.evaluate(() => {
    window.wallpaperPropertyListener.applyUserProperties({ reduced: { value: false } });
    document.querySelector('[data-action="model-viewer"]').click();
  });
  await wp.waitForFunction(() => JSON.parse(document.querySelector('.model-viewer').dataset.stats || '{}').ready && document.querySelector('.model-viewer').dataset.transition === 'open');
  await wp.waitForTimeout(400);
  assert.equal(await wp.locator('.model-viewer').evaluate(el => el.hidden), false, 'Stale close callback cannot close a reopened viewer');
  await wp.locator('[data-viewer="close"]').click();
  await wp.waitForFunction(() => document.querySelector('.model-viewer').hidden);
  await settings(wp);
  await wp.locator('[data-motion="surfaceTransitions"]').uncheck();
  await closeSettings(wp);
  await wp.locator('[data-action="model-viewer"]').click();
  await wp.waitForFunction(() => document.querySelector('.viewer-canvas').getAnimations().some(a => a.playState === 'running' && a.effect.getTiming().duration === 380));
  const modelOnly = await wp.evaluate(() => {
    // An unrelated host save must not cancel a still-enabled model entry.
    window.wallpaperPropertyListener.applyUserProperties({ sound: { value: false } });
    const canvas = document.querySelector('.viewer-canvas');
    const before = canvas.getAnimations().some(a => a.playState === 'running' && a.effect.getTiming().duration === 380);
    window.wallpaperPropertyListener.applyUserProperties({ reduced: { value: true } });
    const after = canvas.getAnimations().some(a => a.playState === 'running' && a.effect.getTiming().duration === 380);
    return { before, after };
  });
  assert.deepEqual(modelOnly, { before: true, after: false });
  await wall.close();
  assert.deepEqual(errors, []);
  await writeFile('.tools/motion-surfaces/report.json', JSON.stringify(report, null, 2));
  console.log('Passed: independent UI/3D transitions, dark text contrast, interrupted viewer enter/exit, focus restoration and immediate reopen; no page errors.');
} finally { await browser.close(); }
