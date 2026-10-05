import { useEffect, useLayoutEffect, useRef } from 'react'
import { BootSequence } from './rhine/boot.ts'
import { startupMarkup } from './rhine/startup-markup.ts'
import { StartupTimeline } from './rhine/startup-timeline.ts'
import type { StartupFrame } from './rhine/startup-timeline.ts'
import { FrameRateLimit } from './rhine/frame-rate-limit.ts'
import { useRhine, useThemeView } from './runtime.tsx'

export function StartupSequence({ ready, sceneReady, onFrame, onReveal, onDone }: { ready: boolean; sceneReady: boolean; onFrame(frame: StartupFrame): void; onReveal(): void; onDone(): void }) {
  const { controls, copy } = useRhine(), { preferences } = useThemeView(controls)
  const root = useRef<HTMLDivElement>(null), artwork = useRef<HTMLDivElement>(null), skipButton = useRef<HTMLButtonElement>(null)
  const latest = useRef({ ready, sceneReady, preferences, onFrame, onReveal, onDone }); latest.current = { ready, sceneReady, preferences, onFrame, onReveal, onDone }
  const skip = useRef(() => {})
  useLayoutEffect(() => {
    const element = root.current, stage = artwork.current
    if (!element || !stage) return
    const frame = element.parentElement!
    const siblings = [...frame.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== element && !child.matches('.rh-titlebar, .rh-system-bar'))
    const inert = siblings.map(child => child.inert)
    siblings.forEach(child => { child.inert = true })
    // Full playback fades the workspace chrome in by writing opacity on these
    // elements directly; a frame-level custom property would force a style
    // recalc across the whole document on every playback frame.
    const uiTargets = siblings.filter(child => child.matches('.rh-header, .rh-home-caption, .rh-history, .rh-body, .rh-project-caption, .rh-bottom-navigation, .rh-footer'))
    uiTargets.forEach(child => { child.style.transition = 'none' })
    let raf = 0, disposed = false, revealed = false, completed = false
    const clock = new StartupTimeline(), limiter = new FrameRateLimit()
    const media = matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)')
    const reduced = () => media.matches || latest.current.preferences.motion === 'reduced'
    const finish = () => { if (completed || disposed) return; completed = true; cancelAnimationFrame(raf); latest.current.onDone() }
    const reveal = () => { if (revealed) return; revealed = true; latest.current.onReveal() }
    const paint = (state: StartupFrame) => {
      latest.current.onFrame(state)
      element.dataset.phase = state.phase; element.dataset.transparent = String(state.sceneVisible)
      element.style.opacity = String(state.opacity); stage.style.opacity = String(state.artworkOpacity)
      if (frame.dataset.startupPath !== state.path) frame.dataset.startupPath = state.path
      const ui = String(state.uiProgress)
      for (const target of uiTargets) {
        if (state.path === 'full') { if (target.style.opacity !== ui) target.style.opacity = ui }
        else if (target.style.opacity !== '') target.style.removeProperty('opacity')
      }
      if (state.cinematic) frame.dataset.layout = 'opening'; else frame.removeAttribute('data-layout')
      if (state.phase === 'cinematic' || state.phase === 'settling' || state.phase === 'handoff' || state.phase === 'done') reveal()
    }
    let sequence: BootSequence | undefined
    try { sequence = new BootSequence(stage); sequence.update(clock.time, latest.current.ready) }
    catch (error) { console.error('Rhine opening unavailable; entering workspace', error); raf = requestAnimationFrame(finish) }
    const resize = () => {
      // Uniformly fit the authored 1920 × 1080 stage; background covers all ratios.
      const scale = Math.min(element.clientWidth / 1920, element.clientHeight / 1080)
      stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')'
    }
    const observer = new ResizeObserver(resize); observer.observe(element); resize()
    const draw = (now: number) => {
      raf = 0
      if (disposed || completed || document.hidden) return
      if (!sequence || reduced()) { finish(); return }
      limiter.setMaxFps(Math.min(60, latest.current.preferences.maxFps || 60))
      if (limiter.canRender(now)) {
        limiter.rendered(now)
        try {
          const state = clock.advance(now, latest.current.ready, latest.current.sceneReady)
          sequence?.update(state.time, latest.current.ready)
          paint(state)
          if (state.phase === 'done') { finish(); return }
        } catch (error) { console.error('Rhine opening interrupted; entering workspace', error); finish(); return }
      }
      raf = requestAnimationFrame(draw)
    }
    skip.current = () => { if (reduced()) finish(); else { clock.skip(); paint(clock.advance(performance.now(), latest.current.ready, latest.current.sceneReady)); if (!raf) raf = requestAnimationFrame(draw) } }
    const visibility = () => { cancelAnimationFrame(raf); raf = 0; clock.pause(); if (!document.hidden && !completed) raf = requestAnimationFrame(draw) }
    const change = () => { if (reduced()) finish() }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); skip.current() }
    }
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('keydown', key, true)
    media.addEventListener('change', change)
    if (sequence) raf = requestAnimationFrame(draw)
    skipButton.current?.focus({ preventScroll: true })
    return () => {
      disposed = true; skip.current = () => {}; cancelAnimationFrame(raf); observer.disconnect()
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('keydown', key, true); media.removeEventListener('change', change)
      siblings.forEach((child, i) => { child.inert = inert[i] })
      for (const target of uiTargets) { target.style.removeProperty('opacity'); target.style.removeProperty('transition') }
      frame.removeAttribute('data-layout'); frame.removeAttribute('data-startup-path')
      if (element.contains(document.activeElement) || document.activeElement === document.body) frame.querySelector<HTMLButtonElement>('.rh-brand')?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => { if (preferences.motion === 'reduced') skip.current() }, [preferences.motion])
  return <div ref={root} className="rh-startup" data-phase="playing" role="region" aria-label={copy('startup')}>
    <div ref={artwork} className="rh-startup-stage" aria-hidden="true" dangerouslySetInnerHTML={{ __html: startupMarkup }} />
    <button ref={skipButton} type="button" className="rh-startup-skip" onClick={() => skip.current()}>{copy('skipStartup')}<kbd>Esc</kbd></button>
    <p className="rh-startup-status" role="status">{copy(ready ? 'startupReady' : 'startupLoading')}</p>
  </div>
}
