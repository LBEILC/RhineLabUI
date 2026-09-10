import assert from "node:assert/strict";
import { ArchiveDrag, ArchiveMomentum } from "../src/archive-drag.ts";

const drag = new ArchiveDrag();
drag.start(500, 500, 1920, 1080);
drag.move(504, 502, 10);
assert.equal(drag.axis, null);
assert.equal(drag.moved, false);
drag.move(520, 519, 20);
assert.equal(drag.axis, null, "Diagonal jitter does not pick both axes");
assert.equal(drag.moved, true, "Moving out and back cannot become a click");
drag.move(360, 515, 2000);
assert.equal(drag.axis, "lane", "Slow drags have no timeout");
assert.equal(drag.value, 0.5);
drag.move(220, 100, 2200);
assert.equal(
  drag.axis,
  "lane",
  "Keep the initial axis despite later diagonal travel",
);
assert.equal(drag.value, 1);
drag.move(780, 100, 2400);
assert.equal(drag.value, -1, "Reversal follows current pointer displacement");
assert.equal(
  drag.releaseVelocity(2600, false),
  0,
  "A pause removes flick momentum",
);

drag.start(200, 400, 390, 844);
drag.move(202, 360, 10);
assert.equal(drag.axis, "row");
drag.move(202, 280, 50);
assert.ok(drag.value > 1 && drag.value < 1.1);
assert.ok(
  drag.releaseVelocity(50, false) > 15,
  "Quick motion retains its actual release speed",
);
assert.equal(
  drag.releaseVelocity(50, true),
  0,
  "Reduced motion disables momentum",
);

drag.start(200, 400, 390, 844);
assert.equal(drag.axis, null, "A new gesture resets all previous state");
assert.equal(drag.moved, false);
drag.move(180, 400, 10);
drag.move(100, 400, 40);
assert.equal(drag.axis, "lane");
assert.ok(
  drag.releaseVelocity(40, false) > 20,
  "Columns have no artificial speed cap",
);
assert.equal(
  drag.releaseVelocity(140, false),
  0,
  "Holding before release removes momentum",
);
drag.move(140, 400, 200);
drag.move(180, 400, 225);
assert.ok(
  drag.releaseVelocity(225, false) < 0,
  "A reversed flick carries in the latest direction",
);
drag.start(500, 500, 1920, 1080, 0);
drag.move(300, 500, 20);
drag.move(300, 500, 30);
drag.move(310, 500, 45);
assert.ok(drag.releaseVelocity(45, false) < 0, "Stationary samples at the turning point cannot retain the old direction");
console.log(
  "Drag axis lock, slow travel, reversal, flick and reduced-motion checks passed.",
);

// Equal pointer travel at different speeds must produce different travel distances.
const fling = (duration) => {
  const input = new ArchiveDrag();
  input.start(500, 500, 1920, 1080, 0);
  for (let i = 1; i <= 12; i++)
    input.move(500, 500 - i * 20, (duration * i) / 12);
  return new ArchiveMomentum(
    input.value,
    input.releaseVelocity(duration, false),
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
