import { normalizeMaxFps } from '../../preferences.ts'

/** Presentation-aligned rate cap. Keep fractional deadlines on mixed-refresh
 * displays, but never replay missed frames after a stall or background sleep.
 * Input wakes do not reset the budget. The GPU fence remains a separate gate.
 */
export class FrameRateLimit {
  private fps = 60
  private next: number | null = null
  setMaxFps(value: number) {
    const fps = normalizeMaxFps(value)
    if (fps === this.fps) return
    this.fps = fps
    this.next = null
  }
  canRender(time: number) { return this.fps === 0 || this.next === null || time + 0.05 >= this.next }
  rendered(time: number) {
    if (!this.fps) return
    const interval = 1000 / this.fps
    this.next = this.next === null || time - this.next >= interval ? time + interval : this.next + interval
  }
}
