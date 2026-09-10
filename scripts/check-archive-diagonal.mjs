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
await mkdir(".tools/array-input", { recursive: true });
const stats = (page) => page.evaluate(() => rhine.stats());
try {
  for (const [width, height, mobile] of [
    [1920, 1080, false],
    [390, 844, true],
    [844, 390, true],
  ].filter(
    ([w, h]) =>
      !process.env.REVIEW_CASES ||
      process.env.REVIEW_CASES.split(",").includes(`${w}x${h}`),
  )) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `${process.env.REVIEW_URL || "http://127.0.0.1:5203"}/?scene=archive`,
    );
    await page.waitForFunction(
      () => window.rhine?.stats().extraction >= 0.399,
      null,
      { timeout: 60000 },
    );
    await page.locator('[data-action="next"]').click();
    await page.waitForTimeout(2200);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    const landscape = mobile && width > height;
    const x = width * (landscape ? 0.4 : 0.65),
      y = height * (landscape ? 0.52 : 0.3);
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
    const results = [];
    for (const axis of ["lane", "row"])
      for (const sign of [1, -1]) {
        const before = await stats(page);
        const vector = before.dragProjection[axis];
        assert.ok(
          Math.abs(vector.x) > 1 && Math.abs(vector.y) > 1,
          "The actual camera produces diagonal axes",
        );
        const amount = (axis === "lane" ? 0.8 : 1.8) * sign;
        await down();
        const captured = await stats(page);
        assert.ok(
          captured.holdingArchive,
          "Gesture starts in the canvas, clear of the document controls",
        );
        // Use the camera at pointer-down; mouse parallax can slightly change it.
        const direction = captured.dragProjection[axis];
        await move(x + direction.x * amount, y + direction.y * amount);
        await page.waitForTimeout(160);
        const during = await stats(page);
        assert.equal(
          during.dragMapping,
          "scene",
          `${width}x${height}: ${axis} uses the camera projection`,
        );
        assert.equal(during.dragTrack.axis, axis);
        const track = axis === "lane" ? "columnCamera" : "rail",
          spacing = axis === "lane" ? 5.2 : -0.62;
        assert.ok(
          Math.abs((during[track] - captured[track]) / spacing - amount) < 0.04,
          "Projected travel follows the requested physical distance",
        );
        assert.equal(
          during.selectedCell[axis],
          before.selectedCell[axis] + Math.round(amount),
        );
        if (axis === "row")
          assert.equal(
            during.selectedCell.lane,
            before.selectedCell.lane,
            "Depth drag keeps its column",
          );
        await up();
        await page.waitForFunction(() => !rhine.stats().archiveMomentum, null, {
          timeout: 12000,
        });
        results.push({ axis, sign, direction, mapping: during.dragMapping });
      }
    await page.screenshot({
      path: resolve(`.tools/array-input/diagonal-${width}x${height}.png`),
    });
    assert.deepEqual(errors, []);
    report.push({ width, height, mobile, results, checks: "passed" });
    console.log(`${width}x${height}: diagonal axes and reversals passed`);
    await context.close();
  }
} finally {
  await mkdir(".tools/array-input", { recursive: true });
  await writeFile(
    ".tools/array-input/diagonal.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
