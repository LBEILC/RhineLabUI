// Times are seconds from the reference video's 05:00 frame (25 fps).
export const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (10 + t * (-15 + 6 * t));
};
const bell = (x: number, width: number) => Math.exp(-0.5 * (x / width) ** 2);
export function archiveWave(row: number, lane: number, time: number) {
  const t = time - 22;
  // Both authored envelopes are exactly zero outside this interval.
  if (t <= 0 || t >= 4.35) return 0;
  const phase = row + (lane - 2) * 0.65;
  const enter = smooth(t / 0.32);
  const first = 3 + t * 19;
  const returning = 32 - (t - 2.3) * 24;
  // A crest has shoulders and a trailing trough: neighboring files describe
  // one continuous surface, rather than independent staggered tweens.
  const packet = (distance: number) =>
    2.5 * bell(distance, 3.8) - 0.58 * bell(distance - 6, 3.5);
  return (
    enter *
    (packet(phase - first) * (1 - smooth((t - 2.15) / 0.65)) +
      packet(phase - returning) *
        smooth((t - 2.17) / 0.32) *
        (1 - smooth((t - 3.5) / 0.85)))
  );
}
export function extraction(time: number) {
  return (
    0.4 * smooth((time - 25.58) / 0.82) + 2.95 * smooth((time - 27.55) / 1.3)
  );
}
// The returning scan leaves two moving shoulders around the selected file.
// Their delay grows with distance, so the neighboring files keep moving during
// the first extraction and settle before the second extraction.
export function settlingWave(distance: number, time: number) {
  const age = time - 25.05 - Math.abs(distance) * 0.065;
  const envelope = Math.max(
    -0.42,
    2.15 - 0.17 * (Math.sqrt(distance * distance + 1) - 1),
  );
  const rise = smooth(age / 0.62);
  const ring = age > 0 ? Math.sin(age * 5.1) * Math.exp(-age * 1.3) : 0;
  return envelope * (rise + 0.18 * ring * smooth(age / 0.16));
}
export function baselineSelectionWave(distance: number, age: number) {
  if (age < 0 || age > 3.2) return 0;
  return (
    0.8 *
    smooth(age / 0.2) *
    Math.exp(-age * 1.15) *
    Math.cos((distance - age * 8) * 0.58) *
    bell(distance - age * 8, 3.4)
  );
}

// Retained for the comparison experiments; the user chose the signed baseline.
export function selectionWave(distance: number, age: number) {
  return Math.max(0, baselineSelectionWave(distance, age));
}

// The source stays still while the crest expands around it. Squaring the
// positive cosine gives the ripple zero velocity at its leading/trailing edge.
export function rippleEnvelope(distance: number, age: number) {
  return (
    smooth(distance / 2.5) * Math.max(0, Math.cos((distance - age * 8) * 0.58))
  );
}

export function columnStrength(lane: number, focus: number, progress = 1) {
  const selected = 0.25 + 0.75 * bell(lane - focus, 0.55);
  return 1 + (selected - 1) * smooth(progress);
}

// A quiet idle drift, with neighboring cards slightly out of phase.
// Maximum displacement is 0.102, under 3% of a card's height.
export function idleWave(row: number, lane: number, time: number) {
  return (
    0.075 * Math.sin((time * Math.PI * 2) / 8 + row * 0.3 - lane * 0.45) +
    0.027 * Math.sin((time * Math.PI * 2) / 13 - row * 0.17 + lane * 0.3)
  );
}

export function cinematicField(
  row: number,
  lane: number,
  time: number,
  center = 12,
  focus = 2,
) {
  const handoff = smooth((time - 24.95) / 0.45);
  const selection = smooth((time - 25.4) / 0.95);
  const shoulderTime = time + 0.3 * handoff * (1 - selection);
  return (
    archiveWave(row, lane, time) * (1 - handoff) +
    settlingWave(row - center, shoulderTime) *
      columnStrength(lane, focus, (time - 25.4) / 0.95)
  );
}

export const INSPECTION_LIFT = 4.05;
export const ALIGNMENT_EPSILON = 0.001;
// Hold altitude while facing back into the slot. Descent begins only once
// alignment is complete; this also applies to independently returning copies.
export function returnStep(angle: number, dt: number, reduced = false) {
  const next = angle * Math.exp(-dt * (reduced ? 35 : 7));
  return Math.abs(next) <= ALIGNMENT_EPSILON ? 0 : next;
}
export interface Spring {
  value: number;
  velocity: number;
}
export function damp(s: Spring, target: number, rate: number, dt: number) {
  const delta = s.value - target;
  const impulse = s.velocity + rate * delta;
  const decay = Math.exp(-rate * dt);
  s.value = target + (delta + impulse * dt) * decay;
  s.velocity = (s.velocity - rate * impulse * dt) * decay;
}
