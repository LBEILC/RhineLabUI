export type DragAxis = "lane" | "row";
export type DragPosition = Record<DragAxis, number>;
export type DragProjection = Record<DragAxis, { x: number; y: number }>;

/** Invert the camera's two projected tracks so the plane follows any pointer path. */
export class ArchiveDrag {
  active = false;
  moved = false;
  value: DragPosition = { lane: 0, row: 0 };
  private x = 0;
  private y = 0;
  private inverse: DragProjection | null = null;
  private samples: { value: DragPosition; time: number }[] = [];
  private lastMotion = -Infinity;
  private motionDirection = { x: 0, y: 0 };
  private pointer = { x: 0, y: 0 };

  start(x: number, y: number, projection: DragProjection, time = 0) {
    this.active = false;
    this.moved = false;
    this.x = x;
    this.y = y;
    this.value = { lane: 0, row: 0 };
    this.samples = [{ value: this.value, time }];
    this.lastMotion = -Infinity;
    this.motionDirection = { x: 0, y: 0 };
    this.pointer = { x, y };
    const { lane, row } = projection;
    const determinant = lane.x * row.y - row.x * lane.y;
    const area = Math.hypot(lane.x, lane.y) * Math.hypot(row.x, row.y);
    this.inverse =
      Number.isFinite(area) && area > 0 && Math.abs(determinant) > area * 0.001
        ? {
            lane: { x: row.y / determinant, y: -row.x / determinant },
            row: { x: -lane.y / determinant, y: lane.x / determinant },
          }
        : null;
  }

  move(x: number, y: number, time: number) {
    const dx = x - this.x,
      dy = y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 7) this.moved = true;
    if (!this.inverse || (!this.active && distance < 10)) return;
    this.active = true;
    const value = {
      lane: dx * this.inverse.lane.x + dy * this.inverse.lane.y,
      row: dx * this.inverse.row.x + dy * this.inverse.row.y,
    };
    const previous = this.samples.at(-1);
    if (previous) {
      const delta = { x: x - this.pointer.x, y: y - this.pointer.y };
      if (Math.hypot(delta.x, delta.y) > 1e-9) {
        this.lastMotion = time;
        // A reversal starts a fresh estimate, without locking either axis.
        if (
          delta.x * this.motionDirection.x + delta.y * this.motionDirection.y <
          0
        )
          this.samples = [previous];
        this.motionDirection = delta;
      }
    }
    this.pointer = { x, y };
    this.value = value;
    if (previous?.time === time)
      this.samples[this.samples.length - 1] = { value, time };
    else this.samples.push({ value, time });
    this.samples = this.samples
      .filter((sample) => time - sample.time <= 120)
      .slice(-32);
  }

  /** Actual release velocity in both tracks, in cells/second. */
  releaseVelocity(time: number, reduced: boolean): DragPosition {
    const first = this.samples[0],
      last = this.samples.at(-1);
    if (
      reduced ||
      !first ||
      !last ||
      time - this.lastMotion > 80 ||
      last.time - first.time < 8
    )
      return { lane: 0, row: 0 };
    const scale = 1000 / (last.time - first.time);
    return {
      lane: (last.value.lane - first.value.lane) * scale,
      row: (last.value.row - first.value.row) * scale,
    };
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

  step(dt: number, coasting = this.phase === "coasting") {
    if (coasting) {
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

/** Both components coast together, preserving the released screen direction. */
export class ArchivePlaneMomentum {
  readonly lane: ArchiveMomentum;
  readonly row: ArchiveMomentum;
  constructor(value: DragPosition, velocity: DragPosition) {
    this.lane = new ArchiveMomentum(value.lane, velocity.lane);
    this.row = new ArchiveMomentum(value.row, velocity.row);
  }
  get phase() {
    return this.lane.phase === "coasting" || this.row.phase === "coasting"
      ? "coasting"
      : this.lane.phase === "idle" && this.row.phase === "idle"
        ? "idle"
        : "snapping";
  }
  get value(): DragPosition {
    return { lane: this.lane.value, row: this.row.value };
  }
  get velocity(): DragPosition {
    return { lane: this.lane.velocity, row: this.row.velocity };
  }
  step(dt: number) {
    const coasting = this.phase === "coasting";
    this.lane.step(dt, coasting);
    this.row.step(dt, coasting);
  }
}
