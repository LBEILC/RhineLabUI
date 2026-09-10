export type DragAxis = "lane" | "row";

/** Pointer travel in CSS pixels, independent of renderer resolution. */
export class ArchiveDrag {
  axis: DragAxis | null = null;
  moved = false;
  private x = 0;
  private y = 0;
  private step = { lane: 1, row: 1 };
  private samples: { value: number; time: number }[] = [];
  private lastMotion = -Infinity;
  private motionDirection = 0;
  value = 0;

  start(x: number, y: number, width: number, height: number, time = 0) {
    this.axis = null;
    this.moved = false;
    this.x = x;
    this.y = y;
    this.value = 0;
    this.samples = [{ value: 0, time }];
    this.lastMotion = -Infinity;
    this.motionDirection = 0;
    this.step = {
      lane: Math.max(100, Math.min(280, width * 0.24)),
      row: Math.max(72, Math.min(150, height * 0.14)),
    };
  }

  move(x: number, y: number, time: number) {
    const dx = x - this.x,
      dy = y - this.y;
    if (Math.hypot(dx, dy) > 7) this.moved = true;
    if (!this.axis) {
      const major = Math.max(Math.abs(dx), Math.abs(dy));
      const minor = Math.min(Math.abs(dx), Math.abs(dy));
      if (major < 10 || major < minor * 1.25) return;
      this.axis = Math.abs(dx) > Math.abs(dy) ? "lane" : "row";
    }
    const value = -(this.axis === "lane" ? dx : dy) / this.step[this.axis];
    const previous = this.samples.at(-1);
    if (previous && value !== previous.value) {
      this.lastMotion = time;
      const direction = Math.sign(value - previous.value);
      // A reversal starts a fresh velocity estimate from the turning point.
      if (
        this.motionDirection && direction !== this.motionDirection
      ) {
        this.samples = [previous];
      }
      this.motionDirection = direction;
    }
    this.value = value;
    if (previous?.time === time)
      this.samples[this.samples.length - 1] = { value, time };
    else this.samples.push({ value, time });
    this.samples = this.samples
      .filter((sample) => time - sample.time <= 120)
      .slice(-32);
  }

  /** Actual release speed in cells/second; no target or travel-distance cap. */
  releaseVelocity(time: number, reduced: boolean) {
    const first = this.samples[0],
      last = this.samples.at(-1);
    if (
      reduced ||
      !first ||
      !last ||
      time - this.lastMotion > 80 ||
      last.time - first.time < 8
    )
      return 0;
    return ((last.value - first.value) / (last.time - first.time)) * 1000;
  }
}

/** Free scrolling first, then a short spring to the nearest resting cell. */
export class ArchiveMomentum {
  value: number;
  velocity: number;
  phase: "coasting" | "snapping" | "idle";
  target: number;
  private readonly friction = 2.4;

  constructor(value: number, velocity: number) {
    this.value = value;
    this.velocity = velocity;
    this.phase = Math.abs(velocity) >= 0.75 ? "coasting" : "snapping";
    this.target = Math.round(value);
  }

  step(dt: number) {
    if (this.phase === "coasting") {
      const decay = Math.exp(-this.friction * dt);
      this.value += (this.velocity * (1 - decay)) / this.friction;
      this.velocity *= decay;
      if (Math.abs(this.velocity) < 0.6) {
        this.target = Math.round(this.value + this.velocity / this.friction);
        this.phase = "snapping";
      }
    } else if (this.phase === "snapping") {
      const rate = 10;
      const delta = this.value - this.target;
      const impulse = this.velocity + rate * delta;
      const decay = Math.exp(-rate * dt);
      this.value = this.target + (delta + impulse * dt) * decay;
      this.velocity = (this.velocity - rate * impulse * dt) * decay;
      if (
        Math.abs(this.value - this.target) < 0.0001 &&
        Math.abs(this.velocity) < 0.005
      ) {
        this.value = this.target;
        this.velocity = 0;
        this.phase = "idle";
      }
    }
  }
}
