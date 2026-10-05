/** Compare rendered inputs with a subpixel tolerance; simulation remains untouched. */
export class RenderState {
  private values: (number | string | undefined)[] = [];
  private cursor = 0;
  private changed = true;
  begin() { this.cursor = 0; }
  add(...values: (number | string | undefined)[]) {
    for (const value of values) {
      if (this.values[this.cursor] !== value) this.changed = true;
      this.values[this.cursor++] = value;
    }
  }
  floats(...values: (number | undefined)[]) {
    // At this scene's closest framing 1e-6 world units is below .001 pixels.
    // Compare to the last accepted value so small movements accumulate normally.
    // IDs and texture/buffer versions still use exact add().
    for (const input of values) {
      const value = input === undefined ? undefined : Math.fround(input);
      const previous = this.values[this.cursor];
      if (value === previous || (typeof previous === 'number' && typeof value === 'number' && Math.abs(value - previous) <= 1e-6)) {
        this.cursor++; continue;
      }
      this.changed = true; this.values[this.cursor++] = value;
    }
  }
  end() {
    const changed = this.changed || this.values.length !== this.cursor;
    this.values.length = this.cursor;
    this.changed = false;
    return changed;
  }
  invalidate() { this.changed = true; }
}
