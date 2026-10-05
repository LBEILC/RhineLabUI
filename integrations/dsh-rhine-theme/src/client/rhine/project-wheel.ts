/** Discrete project navigation; never replay accumulated touchpad inertia. */
export class ProjectWheel {
  private total = 0
  private lastEvent = -Infinity
  private lastStep = -Infinity

  reset() { this.total = 0; this.lastEvent = -Infinity }

  push(deltaY: number, deltaMode: number, pageHeight: number, now: number): number {
    const delta = deltaY * (deltaMode === 1 ? 40 : deltaMode === 2 ? pageHeight : 1)
    if (!Number.isFinite(delta) || !Number.isFinite(now) || delta === 0) return 0
    if (now - this.lastEvent > 180 || Math.sign(delta) !== Math.sign(this.total)) this.total = 0
    this.lastEvent = now
    // Drop cooldown events instead of banking them for a surprise later jump.
    // Selection calls reset(), but must not clear the last step's cooldown.
    if (now - this.lastStep < 280) { this.total = 0; return 0 }
    this.total += Math.max(-300, Math.min(300, delta))
    if (Math.abs(this.total) < 80) return 0
    const direction = Math.sign(this.total)
    this.total = 0; this.lastStep = now
    return direction
  }
}

export function adjacentProject<T extends { id: string }>(projects: readonly T[], current: string | null, direction: number): T | undefined {
  if (!projects.length || !direction) return undefined
  const index = projects.findIndex(project => project.id === current)
  if (index < 0) return direction > 0 ? projects[0] : projects[projects.length - 1]
  return projects[(index + Math.sign(direction) + projects.length) % projects.length]
}
