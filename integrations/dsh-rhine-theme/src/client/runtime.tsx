import { createContext, useContext, useSyncExternalStore } from 'react'
import type { Preferences } from '../preferences.ts'
import type { Copy } from './locales.ts'
export interface ThemeView { preferences: Preferences; ready: boolean; loaded: boolean; busy: boolean }
export interface ThemeControls { getSnapshot(): ThemeView; subscribe(listener: () => void): () => void; update<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void>; toggleColor(): void; openSettings(): void }
export const ThemeContext = createContext<{ controls: ThemeControls; copy: Copy } | null>(null)
export function useRhine() { const value = useContext(ThemeContext); if (!value) throw new Error('RHINE context missing'); return value }
export function useThemeView(controls: ThemeControls) { return useSyncExternalStore(controls.subscribe, controls.getSnapshot, controls.getSnapshot) }
export function currentSession<Id extends string>(state: { byId: Readonly<Record<string, { id: Id; retainedBy?: Readonly<Partial<Record<'mainView', number>>> } | undefined>> }): Id | undefined {
  return Object.values(state.byId).find(item => (item?.retainedBy?.mainView ?? 0) > 0)?.id
}
