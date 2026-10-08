import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
await page.addInitScript(() => {
  localStorage.setItem(
    "rhine-settings",
    JSON.stringify({
      sound: false,
      music: false,
      reduced: true,
      superPerformance: true,
    }),
  );
  window.padPolls = 0;
  window.pad = {
    index: 0,
    id: "review",
    mapping: "standard",
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({
      pressed: false,
      value: 0,
      touched: false,
    })),
  };
  Object.defineProperty(navigator, "getGamepads", {
    value: () => {
      window.padPolls++;
      return [window.pad];
    },
  });
});
async function press(index, hold = 0) {
  const n = await page.evaluate((i) => {
    window.pad.buttons[i].pressed = true;
    return window.padPolls;
  }, index);
  await page.waitForFunction((n) => window.padPolls > n + 2, n);
  if (hold) await page.waitForTimeout(hold);
  const m = await page.evaluate((i) => {
    window.pad.buttons[i].pressed = false;
    return window.padPolls;
  }, index);
  await page.waitForFunction((n) => window.padPolls > n + 2, m);
}
try {
  await page.goto(
    `${process.env.REVIEW_URL || "http://127.0.0.1:5173"}/?scene=archive`,
  );
  await page.bringToFront();
  await page.waitForFunction(
    () =>
      window.rhine?.stats().startup === "started" &&
      !document.querySelector("#loading"),
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => document.activeElement.blur());
  const initial = await page.evaluate(() => rhine.stats().selected);
  await press(13);
  assert.notEqual(await page.evaluate(() => rhine.stats().selected), initial);
  await press(0);
  assert.equal(await page.evaluate(() => rhine.stats().mode), "detail");
  await press(1);
  checks.push(
    "Unfocused archive navigation and A/B work without Document target errors",
  );
  await page.locator('[data-action="settings"]').first().focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".terminal-modal");
  assert.equal(await page.evaluate(() => rhine.stats().mode), "archive");
  checks.push(
    "Connected controller does not hijack physical Enter on Settings",
  );
  await press(1);
  await page.waitForSelector(".terminal-modal", { state: "detached" });
  await page.locator('[data-action="settings"]').first().focus();
  await press(0);
  await page.waitForSelector(".terminal-modal");
  checks.push("A activates a focused native button");
  await page.locator('[data-action="close-modal"]').focus();
  await press(13);
  assert.equal(
    await page
      .locator('[data-action="close-modal"]')
      .evaluate((el) => el === document.activeElement),
    false,
  );
  checks.push("D-pad navigates modal controls");
  await press(1);
  await page.waitForSelector(".terminal-modal", { state: "detached" });
  await page.evaluate(() => {
    document.activeElement.blur();
    rhine.detail();
  });
  await page.waitForSelector('[data-action="model-viewer"]', {
    state: "visible",
  });
  await page.locator('[data-action="model-viewer"]').click();
  await page.waitForSelector(".viewer-canvas canvas");
  await press(3);
  assert.match(await page.locator(".viewer-help").innerText(), /LS/);
  await page.setViewportSize({ width: 1400, height: 900 });
  assert.match(await page.locator(".viewer-help").innerText(), /LS/);
  checks.push("Viewer preserves gamepad hint across resize");
  await press(1, 800);
  assert.equal(await page.evaluate(() => rhine.stats().mode), "detail");
  checks.push("Holding B closes only the viewer, not the parent detail");
  await page.evaluate(() => {
    window.pad.connected = false;
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  await page.waitForFunction(() =>
    document.querySelector(".archive-hint").textContent.includes("ENTER"),
  );
  checks.push("Disconnect restores keyboard hints");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
