export type DragAxis = "lane" | "row";

/** Pointer travel in CSS pixels, independent of renderer resolution. */
export class ArchiveDrag {
  axis: DragAxis | null = null;
  moved = false;
  private x = 0;
  private y = 0;
  private step = { lane: 1, row: 1 };
  private samples: { value: number; time: number }[] = [];
  value = 0;

  start(x: number, y: number, width: number, height: number) {
    this.axis = null;
    this.moved = false;
    this.x = x;
    this.y = y;
    this.value = 0;
    this.samples = [];
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
    this.value = -(this.axis === "lane" ? dx : dy) / this.step[this.axis];
    this.samples.push({ value: this.value, time });
    this.samples = this.samples
      .filter((sample) => time - sample.time <= 100)
      .slice(-12);
  }

  /** A short flick can add at most one cell; holding still removes momentum. */
  release(time: number, reduced: boolean) {
    const first = this.samples[0],
      last = this.samples.at(-1);
    if (
      reduced ||
      !first ||
      !last ||
      time - last.time > 80 ||
      last.time - first.time < 16
    )
      return this.value;
    const speed = (last.value - first.value) / (last.time - first.time);
    return this.value + Math.max(-0.45, Math.min(0.45, speed * 90));
  }
}
