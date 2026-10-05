// Upstream app time is reference video time minus 5s.
export const STARTUP_START = 1.76
export const STARTUP_HOLD = 21.12
export const STARTUP_2D_END = 21.92
// RhineLabUI's workbench branch stops before standalone file extraction.
export const STARTUP_END = 25.9
export const STARTUP_FADE_MS = 640
export const STARTUP_SETTLE_MS = 1200
export const STARTUP_MAX_WAIT_MS = 8000
const ease = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p) }
export interface OpeningCinema { reveal: number; lift: number; zoom: number; time: number }
/** Exact parameters from upstream main.ts bootFrame; no CSS camera substitute. */
export function openingCinema(time: number): OpeningCinema {
  return { time, reveal: ease((time - 22) / .4), lift: ease((time - 26) / 1.8), zoom: .55 * ease((time - 27.3) / 1.65) + .45 * ease((time - 29) / 5) }
}
export type StartupPhase = 'playing' | 'waiting' | 'cinematic' | 'settling' | 'handoff' | 'done'
export interface StartupFrame {
  time: number; phase: StartupPhase; path: 'full' | 'quick'; opacity: number
  artworkOpacity: number; uiProgress: number; sceneVisible: boolean; cinematic?: OpeningCinema
}
/** Independent full-film and quick-entry paths, with bounded resource waiting. */
export class StartupTimeline {
  time = STARTUP_START
  phase: StartupPhase = 'playing'
  private previous: number | undefined
  private waiting = 0
  private fading = 0
  private quick = false
  private sceneVisible = false
  private artworkOpacity = 1
  pause() { this.previous = undefined }
  skip() {
    if (this.phase === 'done' || this.phase === 'handoff') return
    this.quick = true; this.phase = 'handoff'; this.previous = undefined; this.fading = 0
  }
  advance(now: number, ready: boolean, sceneReady = ready): StartupFrame {
    const dt = this.previous === undefined ? 0 : Math.max(0, now - this.previous)
    this.previous = now
    if (this.phase === 'handoff' || this.phase === 'settling') {
      const duration = this.quick ? STARTUP_FADE_MS : STARTUP_SETTLE_MS
      this.fading = Math.min(duration, this.fading + dt)
      if (this.fading >= duration) this.phase = 'done'
    } else if (this.phase !== 'done') {
      const next = this.time + dt / 1000
      if (!ready && next >= STARTUP_HOLD && this.waiting < STARTUP_MAX_WAIT_MS) {
        this.waiting += Math.max(0, next - Math.max(this.time, STARTUP_HOLD)) * 1000
        this.time = STARTUP_HOLD; this.phase = 'waiting'
      } else {
        this.time = Math.min(STARTUP_END, next)
        if (this.time >= STARTUP_2D_END && !sceneReady) this.skip()
        else if (this.time >= STARTUP_END) { this.phase = 'settling'; this.sceneVisible = true; this.fading = 0 }
        else if (this.time >= STARTUP_2D_END) { this.phase = 'cinematic'; this.sceneVisible = true }
        else this.phase = 'playing'
      }
    }
    if (!this.quick) this.artworkOpacity = 1 - ease((this.time - STARTUP_2D_END) / .13)
    const exiting = this.phase === 'handoff' || this.phase === 'settling' || this.phase === 'done'
    const progress = exiting ? ease(this.fading / (this.quick ? STARTUP_FADE_MS : STARTUP_SETTLE_MS)) : 0
    return { time: this.time, phase: this.phase, path: this.quick ? 'quick' : 'full', opacity: 1 - progress,
      artworkOpacity: this.artworkOpacity, uiProgress: this.quick ? 1 : progress, sceneVisible: this.sceneVisible,
      cinematic: this.phase === 'cinematic' ? openingCinema(this.time) : undefined }
  }
}

let played = false
export const startupHasPlayed = () => played
export const markStartupPlayed = () => { played = true }
