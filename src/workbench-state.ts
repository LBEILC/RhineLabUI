export type TimerState = { phase: "focus" | "break"; status: "idle" | "running" | "paused" | "done"; remaining: number; deadline: number };
export const idleTimer = (): TimerState => ({ phase: "focus", status: "idle", remaining: 0, deadline: 0 });
export const dayKey = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
export function parseTarget(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", min = "00"] = m;
  const date = new Date(+y, +mo - 1, +d, +h, +min);
  return date.getFullYear() === +y && date.getMonth() === +mo - 1 && date.getDate() === +d && date.getHours() === +h && date.getMinutes() === +min ? date.getTime() : null;
}
export function timerLeft(timer: TimerState, now: number): number {
  return timer.status === "running" ? Math.max(0, timer.deadline - now) : timer.remaining;
}
export function restoreTimer(value: unknown): TimerState {
  const t = value as Partial<TimerState> | null;
  if (!t || !["focus", "break"].includes(t.phase ?? "") || !["idle", "running", "paused", "done"].includes(t.status ?? "") || typeof t.remaining !== "number" || !Number.isFinite(t.remaining) || t.remaining < 0 || t.remaining > 7200000 || typeof t.deadline !== "number" || !Number.isFinite(t.deadline) || t.deadline < 0) return idleTimer();
  return { phase: t.phase!, status: t.status!, remaining: t.remaining, deadline: t.deadline };
}
export function durationText(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
