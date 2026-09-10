const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export type MusicBands = { low: number; mid: number; high: number; activity: number };
export const quietBands = (): MusicBands => ({ low: 0, mid: 0, high: 0, activity: 0 });
export class SpectrumEnvelope {
  bands = quietBands();
  private target = quietBands();
  private received = -Infinity;
  private audible = -Infinity;
  ingest(samples: ArrayLike<number>, time: number) {
    if (samples.length !== 128) return;
    const band = (start: number, end: number) => {
      let energy = 0;
      for (let i = start; i < end; i++) {
        const l = Number.isFinite(samples[i]) ? clamp(samples[i]) : 0;
        const r = Number.isFinite(samples[i + 64]) ? clamp(samples[i + 64]) : 0;
        energy += (l * l + r * r) / 2;
      }
      return Math.sqrt(energy / (end - start));
    };
    this.target = { low: band(0, 8), mid: band(8, 32), high: band(32, 64), activity: 0 };
    this.received = time;
    if (Math.max(this.target.low, this.target.mid, this.target.high) > .012) this.audible = time;
  }
  update(dt: number, time: number, enabled: boolean): MusicBands {
    const fresh = enabled && time - this.received < .5;
    for (const key of ["low", "mid", "high"] as const) {
      const target = fresh ? this.target[key] : 0;
      const rate = target > this.bands[key] ? 16 : 3.2;
      this.bands[key] += (target - this.bands[key]) * (1 - Math.exp(-Math.min(dt, .1) * rate));
    }
    const active = fresh && time - this.audible < 1.5 ? 1 : 0;
    this.bands.activity += (active - this.bands.activity) * (1 - Math.exp(-Math.min(dt, .1) * (active ? 3 : 1.5)));
    return { ...this.bands };
  }
}
export function musicDisplacement(row: number, lane: number, time: number, bands: MusicBands, strength: number) {
  const bass = bands.low * .8 * (.5 + .5 * Math.sin(row * .29 - lane * .5 - time * 2.7));
  const middle = bands.mid * .48 * (.5 + .5 * Math.sin(row * .72 + lane * .9 - time * 4.3));
  const treble = bands.high * .18 * Math.pow(Math.max(0, Math.sin(row * 1.7 - lane * 2.2 - time * 6.4)), 4);
  return clamp((bass + middle + treble) * clamp(strength, 0, 2), 0, 1.8);
}
export type RelayStatus = "idle" | "preparing" | "playing" | "over";
export class RelayRound {
  status: RelayStatus = "idle";
  score = 0;
  target: string | null = null;
  remaining = 0;
  total = 0;
  reason = "";
  start() { this.status = "preparing"; this.score = 0; this.target = null; this.remaining = .8; this.reason = ""; }
  stop() { this.status = "idle"; this.target = null; this.remaining = 0; }
  aim(target: string, pace: "gentle" | "normal" | "quick") {
    this.target = target; this.status = "playing";
    const base = pace === "gentle" ? 8 : pace === "quick" ? 4 : 6;
    this.total = this.remaining = Math.max(base * .55, base - this.score * .12);
  }
  tick(dt: number, paused: boolean) {
    if (paused || (this.status !== "playing" && this.status !== "preparing")) return;
    this.remaining = Math.max(0, this.remaining - Math.max(0, dt));
    if (this.status === "playing" && this.remaining === 0) this.finish("这道波纹停下了");
  }
  hit(target: string | null) {
    if (this.status !== "playing") return false;
    if (target !== this.target) { this.finish("接力结束"); return false; }
    this.score++; this.status = "preparing"; this.target = null; this.remaining = .28; return true;
  }
  finish(reason: string) { this.status = "over"; this.target = null; this.reason = reason; }
}
