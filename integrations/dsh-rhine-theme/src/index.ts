import type { Context, Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
export const name = 'dsh-rhine-theme'
export interface Config { enabled: Volatile<boolean>; motion: Volatile<'full' | 'reduced'>; scene: Volatile<boolean>; quality: Volatile<'balanced' | 'high'>; maxFps: Volatile<number>; sound: Volatile<boolean>; startupAnimation: Volatile<boolean> }
export const Config = Schema.object({
  enabled: Schema.boolean().default(true).volatile(),
  motion: Schema.union(['full', 'reduced']).default('full').volatile(),
  scene: Schema.boolean().default(true).volatile(),
  quality: Schema.union(['balanced', 'high']).default('balanced').volatile(),
  maxFps: Schema.number().min(0).max(360).step(1).default(60).volatile(),
  sound: Schema.boolean().default(false).volatile(),
  startupAnimation: Schema.boolean().default(true).volatile(),
})
/** Appearance-only plugin; the loader owns persisted configuration. */
export function apply(_ctx: Context): void {}
