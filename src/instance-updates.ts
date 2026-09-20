import { InstancedBufferAttribute } from 'three';

/** Compare the actual Float32 GPU values, then upload one contiguous changed range. */
export class InstanceUpdates {
  private first = Infinity;
  private last = -1;
  readonly attribute: InstancedBufferAttribute;
  constructor(attribute: InstancedBufferAttribute) { this.attribute = attribute; }
  set(offset: number, values: ArrayLike<number>) {
    const array = this.attribute.array;
    for (let j = 0; j < values.length; j++) {
      const i = offset + j, value = Math.fround(values[j]);
      if (array[i] === value) continue;
      array[i] = value;
      this.first = Math.min(this.first, i);
      this.last = Math.max(this.last, i);
    }
  }
  scalar(offset: number, value: number) {
    value = Math.fround(value);
    if (this.attribute.array[offset] === value) return;
    this.attribute.array[offset] = value;
    this.first = Math.min(this.first, offset);
    this.last = Math.max(this.last, offset);
  }
  commit() {
    if (this.last < 0) return false;
    // Do not discard ranges pending while no render took place.
    this.attribute.addUpdateRange(this.first, this.last - this.first + 1);
    this.attribute.needsUpdate = true;
    this.first = Infinity;
    this.last = -1;
    return true;
  }
}
