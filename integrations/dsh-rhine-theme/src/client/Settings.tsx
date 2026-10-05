import { useRef, useEffect, useState, useId } from 'react'
import { useThemeView } from './runtime.tsx'
import type { ThemeControls } from './runtime.tsx'
import type { Copy } from './locales.ts'
import { FRAME_RATE_PRESETS, type Preferences } from '../preferences.ts'
import { primeSound } from './Soundscape.tsx'
export function Settings({ controls, copy }: { controls: ThemeControls; copy: Copy }) {
  const { preferences, ready, busy } = useThemeView(controls)
  const startupHintId = useId()
  const [error, setError] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const write = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setError(false); void controls.update(key, value).catch(() => { if (alive.current) setError(true) })
  }
  return <section className="rh-preferences" aria-busy={busy}>
    <h3>{copy('appearance')}</h3><p>{copy('settingsDescription')}</p>
    <label><span>{copy('enable')}</span><input type="checkbox" checked={preferences.enabled} disabled={!ready || busy} onChange={e => write('enabled', e.target.checked)} /></label>
    <label><span>{copy('startupAnimation')}</span><input type="checkbox" checked={preferences.startupAnimation} disabled={!ready || busy} aria-describedby={startupHintId} onChange={e => write('startupAnimation', e.target.checked)} /></label>
    <p id={startupHintId} className="rh-startup-setting-hint">{copy('startupAnimationHint')}</p>
    <label><span>{copy('sceneToggle')}</span><input type="checkbox" checked={preferences.scene} disabled={!ready || busy} onChange={e => write('scene', e.target.checked)} /></label>
    <label><span>{copy('motion')}</span><select value={preferences.motion} disabled={!ready || busy} onChange={e => write('motion', e.target.value as Preferences['motion'])}><option value="full">{copy('full')}</option><option value="reduced">{copy('reduced')}</option></select></label>
    <label><span>{copy('quality')}</span><select value={preferences.quality} disabled={!ready || busy} onChange={e => write('quality', e.target.value as Preferences['quality'])}><option value="balanced">{copy('balanced')}</option><option value="high">{copy('high')}</option></select></label>
    <FrameRateSetting value={preferences.maxFps} disabled={!ready || busy} copy={copy} save={value => controls.update('maxFps', value)} />
    <label title={copy('soundHint')}><span>{copy('sound')}</span><input type="checkbox" checked={preferences.sound} disabled={!ready || busy} onChange={e => { if (e.target.checked) primeSound(); write('sound', e.target.checked) }} /></label>
    {window.rhineDesktop?.windowAction && <button type="button" className="rh-enter-fullscreen" title={copy('fullscreenHint')} onClick={() => void window.rhineDesktop?.windowAction?.('fullscreen').catch(() => setError(true))}>{copy('enterFullscreen')}</button>}
    {error && <p role="alert">{copy('error')}</p>}
  </section>
}

function FrameRateSetting({ value, disabled, copy, save }: { value: number; disabled: boolean; copy: Copy; save(value: number): Promise<void> }) {
  const id = useId(), customId = useId(), hintId = useId(), errorId = useId()
  const [custom, setCustom] = useState(false), [draft, setDraft] = useState(String(value || 60))
  const [error, setError] = useState<'invalidFrameRate' | 'error' | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { setDraft(String(value || 60)) }, [value])
  const isPreset = (FRAME_RATE_PRESETS as readonly number[]).includes(value)
  const write = (next: number) => {
    setError(null)
    if (next === value) return
    void save(next).catch(() => { if (mounted.current) { setError('error'); setDraft(String(value || 60)) } })
  }
  const commit = () => {
    if (disabled) return
    const next = Number(draft)
    if (!draft.trim() || !Number.isInteger(next) || next < 1 || next > 360) { setError('invalidFrameRate'); return }
    write(next)
  }
  return <div className="rh-frame-rate-setting">
    <label htmlFor={id}><span>{copy('maxFps')}</span><select id={id} value={custom || !isPreset ? 'custom' : value} disabled={disabled} aria-describedby={hintId} onChange={event => {
      const next = event.target.value
      setError(null); setCustom(next === 'custom')
      if (next !== 'custom') write(Number(next))
    }}>
      {FRAME_RATE_PRESETS.map(fps => <option key={fps} value={fps}>{fps ? `${fps} FPS` : copy('unlimitedFps')}</option>)}
      <option value="custom">{copy('customFps')}</option>
    </select></label>
    {(custom || !isPreset) && <label htmlFor={customId}><span>{copy('customFps')}</span><input id={customId} type="number" inputMode="numeric" min={1} max={360} step={1} value={draft} disabled={disabled} aria-invalid={!!error} aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`} onChange={event => { setDraft(event.target.value); setError(null) }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} /></label>}
    <p id={hintId} className="rh-frame-rate-hint">{copy('frameRateHint')}</p>
    {error && <p id={errorId} role="alert">{copy(error)}</p>}
  </div>
}
