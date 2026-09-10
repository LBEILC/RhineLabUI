import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
    : "playwright"
);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const report = [];
const stats = (page) => page.evaluate(() => window.rhine.stats());
const rest = (page) =>
  page.waitForFunction(() => !window.rhine.stats().archiveMomentum, null, {
    timeout: 12000,
  });
try {
  for (const mobile of [false, true]) {
    const width = mobile ? 390 : 1920,
      height = mobile ? 844 : 1080;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `${process.env.REVIEW_URL || "http://127.0.0.1:5202"}/?scene=archive`,
    );
    await page.waitForFunction(
      () => window.rhine?.stats().extraction >= 0.399,
      null,
      { timeout: 60000 },
    );
    await page.locator('[data-action="next"]').click();
    await page.waitForTimeout(2200);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    const x = width * 0.6,
      y = height * 0.38;
    const rowStep = Math.max(72, Math.min(150, height * 0.14));
    const laneStep = Math.max(100, Math.min(280, width * 0.24));
    const down = async () =>
      mobile
        ? cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y, id: 1 }],
          })
        : (await page.mouse.move(x, y), page.mouse.down());
    const move = async (px, py) =>
      mobile
        ? cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: px, y: py, id: 1 }],
          })
        : page.mouse.move(px, py);
    const up = async () =>
      mobile
        ? cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          })
        : page.mouse.up();
    const fling = async (delay, axis = "row") => {
      await down();
      const segments = delay < 30 ? 4 : 8;
      for (let i = 1; i <= segments; i++) {
        await page.waitForTimeout(delay);
        await move(
          axis === "lane" ? x - (laneStep * 1.8 * i) / segments : x,
          axis === "row" ? y - (rowStep * 1.8 * i) / segments : y,
        );
      }
      await up();
    };
    const startSlow = await stats(page);
    await fling(90);
    await rest(page);
    const slow = await stats(page);
    const slowDistance = slow.selectedCell.row - startSlow.selectedCell.row;
    await fling(8);
    const released = await stats(page);
    assert.equal(released.archiveMomentum?.phase, "coasting");
    assert.ok(released.archiveMomentum.velocity > 2);
    await page.waitForTimeout(450);
    const moving = await stats(page);
    assert.ok(
      moving.selectedCell.row > released.selectedCell.row,
      "Files change as the released array passes them",
    );
    assert.ok(
      moving.rail < released.rail - 0.3,
      "Released array keeps travelling",
    );
    assert.ok(
      moving.archiveMomentum.velocity < released.archiveMomentum.velocity,
      "Speed decays continuously",
    );
    await rest(page);
    const fast = await stats(page);
    const fastDistance = fast.selectedCell.row - slow.selectedCell.row;
    console.log({mobile,slowDistance,fastDistance,releaseVelocity:released.archiveMomentum.velocity});
    assert.ok(
      fastDistance > slowDistance,
      "Fast travel goes farther than identical slow travel",
    );
    assert.ok(
      fastDistance > 3,
      "Fast scrolling is no longer capped at three files",
    );

    // Catch the array without moving the pointer, then take over on another axis.
    await fling(8);
    await page.waitForTimeout(120);
    await down();
    const caught = await stats(page);
    assert.equal(caught.archiveMomentum, null);
    assert.equal(caught.holdingArchive, true);
    await page.waitForTimeout(220);
    const held = await stats(page);
    assert.equal(
      held.rail,
      caught.rail,
      "Pressing catches the current rail before direction lock",
    );
    assert.deepEqual(held.selectedCell, caught.selectedCell);
    await move(x - laneStep * 0.8, y);
    await page.waitForTimeout(160);
    await up();
    await rest(page);
    assert.equal(
      (await stats(page)).selectedCell.lane,
      caught.selectedCell.lane + 1,
    );

    await fling(8, "lane");
    const lateral = await stats(page);
    assert.equal(lateral.archiveMomentum?.axis, "lane");
    await page.waitForTimeout(250);
    assert.ok((await stats(page)).columnCamera > lateral.columnCamera + 0.5);
    await rest(page);

    await fling(8);
    await page.keyboard.press("ArrowDown");
    const keyboard = await stats(page);
    assert.equal(
      keyboard.archiveMomentum,
      null,
      "Keyboard selection stops the previous coast",
    );
    await page.waitForTimeout(500);
    assert.deepEqual((await stats(page)).selectedCell, keyboard.selectedCell);

    await page.locator('[data-action="settings"]').click();
    await page.locator('[data-pref="reduced"]').check({ force: true });
    await page.locator('[data-action="close-modal"]').click();
    await page.waitForFunction(
      () => !document.querySelector(".modal-backdrop"),
    );
    await fling(8);
    assert.equal(
      (await stats(page)).archiveMomentum,
      null,
      "Reduced motion skips continued scrolling",
    );
    assert.deepEqual(errors, []);
    report.push({
      mobile,
      slowDistance,
      fastDistance,
      releaseVelocity: released.archiveMomentum.velocity,
      releaseRow: released.selectedCell.row,
      movingRow: moving.selectedCell.row,
      checks: "passed",
    });
    console.log(report.at(-1));
    await context.close();
  }
} finally {
  await mkdir(".tools/array-input", { recursive: true });
  await writeFile(
    resolve(".tools/array-input/momentum.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
