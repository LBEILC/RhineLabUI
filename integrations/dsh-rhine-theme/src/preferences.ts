export interface Preferences { enabled: boolean; motion: 'full' | 'reduced'; scene: boolean; quality: 'balanced' | 'high'; maxFps: number; sound: boolean; startupAnimation: boolean }
export const NAMESPACE = 'dsh-rhine-theme'
export const DEFAULTS: Readonly<Preferences> = { enabled: true, motion: 'full', scene: true, quality: 'balanced', maxFps: 60, sound: false, startupAnimation: true }
export const FRAME_RATE_PRESETS = [24, 30, 45, 60, 90, 120, 144, 165, 240, 360, 0] as const
/** Zero follows the display; invalid persisted values fall back to 60 FPS. */
export function normalizeMaxFps(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 360 ? value : DEFAULTS.maxFps
}
export function resolvePreferences(value: Partial<Preferences> | undefined): Preferences {
  return { ...DEFAULTS, ...value, maxFps: normalizeMaxFps(value?.maxFps), startupAnimation: typeof value?.startupAnimation === 'boolean' ? value.startupAnimation : DEFAULTS.startupAnimation }
}
