import assert from "node:assert/strict";
import {
  ArchiveDrag,
  ArchiveMomentum,
  ArchivePlaneMomentum,
} from "../src/archive-drag.ts";
const projection = { lane: { x: -240, y: 120 }, row: { x: -50, y: -15 } };
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, message);
const drag = new ArchiveDrag();
drag.start(500, 500, projection);
drag.move(504, 502, 10);
assert.equal(drag.active, false);
assert.equal(drag.moved, false);
// Every screen direction decomposes back into the same displayed displacement.
for (const [dx, dy] of [
  [-120, 60],
  [-100, -30],
  [100, 0],
  [0, -100],
  [50, 90],
  [-30, 20],
]) {
  drag.move(500 + dx, 500 + dy, 40);
  assert.equal(drag.active, true);
  close(
    drag.value.lane * projection.lane.x + drag.value.row * projection.row.x,
    dx,
  );
  close(
    drag.value.lane * projection.lane.y + drag.value.row * projection.row.y,
    dy,
  );
}
// A single held gesture can turn from one track into the other.
drag.move(380, 560, 60);
close(drag.value.lane, 0.5);
close(drag.value.row, 0);
drag.move(400, 470, 80);
close(drag.value.lane, 0);
close(drag.value.row, 2);
drag.move(500, 500, 100);
assert.equal(drag.moved, true, "Out-and-back cannot become a click");
close(drag.value.lane, 0);
close(drag.value.row, 0);
assert.deepEqual(drag.releaseVelocity(200, false), { lane: 0, row: 0 });
assert.deepEqual(drag.releaseVelocity(100, true), { lane: 0, row: 0 });
const alternate = { lane: { x: 180, y: 100 }, row: { x: 40, y: -12 } };
drag.start(500, 500, alternate);
alternate.lane.x = 0;
drag.move(590, 550, 40);
close(drag.value.lane, 0.5, "Freeze camera mapping for the gesture");
close(drag.value.row, 0);
for (const invalid of [
  { lane: { x: 1, y: 1 }, row: { x: 2, y: 2 } },
  { lane: { x: NaN, y: 1 }, row: { x: 0, y: 1 } },
]) {
  drag.start(0, 0, invalid);
  drag.move(100, 100, 50);
  assert.equal(
    drag.active,
    false,
    "Degenerate projection must not generate unbounded motion",
  );
}
// Reverse the full screen path: momentum follows the final direction.
drag.start(0, 0, projection);
drag.move(-100, -30, 20);
drag.move(-100, -30, 30);
drag.move(-75, -22.5, 45);
assert.ok(drag.releaseVelocity(45, false).row < 0);
console.log(
  "Free projection, direction changes, jitter, reversal and reduced motion passed.",
);
const fling = (duration) => {
  const input = new ArchiveDrag();
  input.start(0, 0, projection);
  for (let i = 1; i <= 12; i++)
    input.move(
      (projection.row.x * 1.6 * i) / 12,
      (projection.row.y * 1.6 * i) / 12,
      (duration * i) / 12,
    );
  return new ArchiveMomentum(
    input.value.row,
    input.releaseVelocity(duration, false).row,
  );
};
const fast = fling(80),
  slow = fling(800);
assert.ok(fast.velocity > slow.velocity * 8);
assert.equal(fast.value, slow.value);
const fastStart = fast.value;
const fastVelocity = fast.velocity;
fast.step(1 / 60);
assert.ok(
  fast.value > fastStart,
  "The first released frame continues from the pointer",
);
assert.ok(fast.velocity < fastVelocity && fast.velocity > fastVelocity * 0.9);
for (let i = 0; i < 600; i++) {
  fast.step(1 / 120);
  slow.step(1 / 120);
}
assert.equal(fast.phase, "idle");
assert.equal(slow.phase, "idle");
assert.ok(fast.value > slow.value + 5, "A fast flick crosses many more files");
assert.ok(
  fast.value - fastStart > 3,
  "Travel is no longer limited to three files",
);
assert.equal(fast.value, Math.round(fast.value));

const simulate = (fps) => {
  const motion = new ArchiveMomentum(12.3, 24);
  for (let i = 0; i < fps; i++) motion.step(1 / fps);
  return motion;
};
const at30 = simulate(30),
  at60 = simulate(60),
  at120 = simulate(120);
assert.ok(Math.abs(at30.value - at120.value) < 1e-10);
assert.ok(Math.abs(at60.velocity - at120.velocity) < 1e-10);
const backward = new ArchiveMomentum(-3.2, -35);
for (let i = 0; i < 600; i++) backward.step(1 / 120);
assert.equal(backward.phase, "idle");
assert.ok(backward.value < -15, "Negative positions continue through the loop");
console.log(
  JSON.stringify({
    fastRest: fast.value,
    slowRest: slow.value,
    frameRateIndependent: true,
  }),
);

const plane = new ArchivePlaneMomentum(
  { lane: 2.3, row: 12.8 },
  { lane: 2, row: 24 },
);
let previous = plane.value;
for (let i = 0; i < 90; i++) {
  if (plane.phase !== "coasting") break;
  plane.step(1 / 60);
  close(
    (plane.value.lane - previous.lane) * 12,
    plane.value.row - previous.row,
    "Both tracks keep the screen direction, even when the smaller component is slow",
  );
  previous = plane.value;
}
for (let i = 0; i < 600; i++) plane.step(1 / 120);
assert.equal(plane.phase, "idle");
assert.equal(plane.value.lane, Math.round(plane.value.lane));
assert.equal(plane.value.row, Math.round(plane.value.row));
console.log("Two-dimensional coasting and final grid snap passed.");
