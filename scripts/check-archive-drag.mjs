import assert from "node:assert/strict";
import { ArchiveDrag } from "../src/archive-drag.ts";

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
assert.equal(drag.release(2600, false), -1, "A pause removes flick momentum");

drag.start(200, 400, 390, 844);
drag.move(202, 360, 10);
assert.equal(drag.axis, "row");
drag.move(202, 280, 50);
assert.ok(drag.value > 1 && drag.value < 1.1);
assert.ok(drag.release(50, false) > drag.value + 2, "A quick row flick carries across multiple files");
assert.ok(drag.release(50, false) <= drag.value + 3);
assert.equal(
  drag.release(50, true),
  drag.value,
  "Reduced motion disables momentum",
);
drag.start(200, 400, 390, 844);
assert.equal(drag.axis, null, "A new gesture resets all previous state");
assert.equal(drag.moved, false);
drag.move(180, 400, 10);
drag.move(100, 400, 40);
assert.equal(drag.axis, "lane");
assert.equal(drag.release(40, false), drag.value + 2, "Column momentum has a shorter two-column cap");
assert.equal(drag.release(140, false), drag.value, "Holding before release removes momentum");
drag.move(140, 400, 200);
drag.move(180, 400, 225);
assert.ok(drag.release(225, false) < drag.value, "A reversed flick carries in the latest direction");
console.log(
  "Drag axis lock, slow travel, reversal, flick and reduced-motion checks passed.",
);
