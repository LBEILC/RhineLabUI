import { adjacentProject } from './rhine/project-wheel.ts'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { StartupFrame } from './rhine/startup-timeline.ts'
import { ArchiveScene } from './rhine/scene.ts'
import { configureArchive, fileIndex, records } from './rhine/data.ts'
import type { ArchiveProject } from './rhine/data.ts'
import { desktopQuality } from './rhine/render-quality.ts'
import { VoxelProjection } from './VoxelProjection.ts'
import { useRhine, useThemeView } from './runtime.tsx'
import { FrameRateLimit } from './rhine/frame-rate-limit.ts'
import { FramePacing } from './rhine/frame-pacing.ts'
import { InspectionAssembly } from './InspectionAssembly.ts'
import { OpticalSignal, Lettering } from './OpticalMotion.tsx'
import { projectionMotionEvent } from './projection-motion.ts'

export type ArchiveMode = 'home' | 'project' | 'conversation'
export interface ArchiveStageProps {
  opening: boolean
  openingFrame: RefObject<StartupFrame | null>
  onStatus(status: 'loading' | 'ready' | 'error'): void
  mode: ArchiveMode; project: string | null; session: string | null
  projects: readonly ArchiveProject[]
  inspection: boolean
  onSettled(mode: ArchiveMode): void
  onPick(project: string, session: string | null): void
}

/** One persistent reference scene owns every application transition. */
export function ArchiveStage(props: ArchiveStageProps) {
  const { controls, copy } = useRhine(), { preferences } = useThemeView(controls)
  const host = useRef<HTMLDivElement>(null), engine = useRef<ArchiveScene>(), projection = useRef<VoxelProjection>()
  const latest = useRef(props); latest.current = props
  const settings = useRef(preferences); settings.current = preferences
  const apply = useRef<() => void>(() => {})
  const assembly = useRef<InspectionAssembly>()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [retry, setRetry] = useState(0)
  useEffect(() => { props.onStatus(status) }, [status, props.onStatus])
  useEffect(() => { apply.current() }, [props.opening])
  useEffect(() => {
    configureArchive(props.projects)
    if (!preferences.scene || status === 'error') { props.onSettled(props.mode); return }
    apply.current()
  }, [props.projects, props.mode, props.project, props.session, status, preferences.scene])
  useEffect(() => { assembly.current?.setActive(props.inspection); apply.current() }, [props.inspection])
  useEffect(() => {
    const element = host.current
    if (!element) return
    if (!preferences.scene) { setStatus('ready'); latest.current.onSettled(latest.current.mode); return }
    let scene: ArchiveScene
    try { scene = new ArchiveScene(element) } catch (error) { console.error('Rhine scene creation failed', error); setStatus('error'); latest.current.onSettled(latest.current.mode); return }
    engine.current = scene
    const frameRate = new FrameRateLimit()
    const pacing = new FramePacing(scene.renderer.getContext() as WebGL2RenderingContext)
    let disposed = false, loaded = false, loadFinished = false, raf = 0, changedAt = performance.now(), settled = false, selection = '', lastMode: ArchiveMode = 'home'
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    // The projection fade writes inline opacity on the projection box: a CSS
    // custom property on the frame would invalidate styles for the whole
    // document on every animation frame.
    const projectionBody = () => element.parentElement?.querySelector<HTMLElement>('.rh-body')
    let lastAmount = '', lastMotion = '', quietFrames = 0, primed = false
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'), contrast = matchMedia('(forced-colors: active)')
    const reduce = () => reduced.matches || settings.current.motion === 'reduced' || contrast.matches
    let configured = ''
    const configure = () => {
      const key = `${settings.current.maxFps}:${settings.current.quality}:${reduce()}:${document.body.dataset.rhine}`
      if (key === configured) return
      configured = key
      frameRate.setMaxFps(settings.current.maxFps)
      element.dataset.maxFps = String(settings.current.maxFps)
      scene.setReduced(reduce()); scene.setQuality(desktopQuality[settings.current.quality])
      scene.setTheme(document.body.dataset.rhine === 'dark', true)
      projection.current?.configure(reduce(), document.body.dataset.rhine === 'dark')
    }
    const synchronize = () => {
      if (!loaded || disposed) return
      const next = latest.current
      const index = next.mode === 'home' ? 0 : fileIndex(next.project, next.session)
      const key = `${next.mode}:${next.project}:${next.session}`
      if (key === selection) return
      selection = key; changedAt = performance.now(); settled = false
      scene.setMode(next.mode === 'conversation' ? 'detail' : 'archive')
      scene.setCollection(next.mode !== 'home')
      scene.select(index)
      scene.setLabel(records[index]?.title ?? 'RHINE LAB', index)
      if (next.mode === 'conversation') { projection.current?.enter(); lastAmount = ''; const body = projectionBody(); if (body) body.style.opacity = '0' } else projection.current?.leave()
      lastMode = next.mode
      wake()
    }
    apply.current = () => {
      if (!settings.current.scene) { latest.current.onSettled(latest.current.mode); return }
      if (loaded) configure()
      synchronize(); wake()
    }
    scene.onSelect = index => {
      const record = records[index]
      if (!record || record.project === '__home__') return
      latest.current.onPick(record.project, latest.current.mode === 'home' ? null : record.id.startsWith('empty:') ? null : record.id)
    }
    scene.onNavigate = (axis, direction) => {
      const next = latest.current
      if (axis === 'lane' || next.mode === 'home') {
        const project = adjacentProject(next.projects, next.project, direction)
        if (project) next.onPick(project.id, null)
      } else {
        const files = next.projects.find(project => project.id === next.project)?.files ?? []
        const current = Math.max(0, files.findIndex(file => file.id === next.session))
        const file = files[(current + direction + files.length) % files.length]
        if (file && next.project) next.onPick(next.project, file.id)
      }
    }
    const draw = (time: number) => {
      raf = 0
      if (disposed || !loaded || document.hidden || (latest.current.opening && primed)) return
      if (!frameRate.canRender(time) || !pacing.canSubmit()) { raf = requestAnimationFrame(draw); return }
      frameRate.rendered(time)
      // Low caps must reduce sampling, not slow the scene's closed-form motion.
      const opening = latest.current.openingFrame.current
      const cinematic = reduce() ? undefined : opening?.cinematic
      const shotText = cinematic ? cinematic.time.toFixed(3) : ''
      if (element.dataset.startupShot !== shotText) element.dataset.startupShot = shotText
      const pathText = opening?.path ?? ''
      if (element.dataset.startupPath !== pathText) element.dataset.startupPath = pathText
      const rendered = scene.update(time / 1000, cinematic, Math.max(.05, 1.5 / (settings.current.maxFps || 60)))
      if (rendered) { pacing.submitted(); primed = true }
      quietFrames = rendered ? 0 : quietFrames + 1
      const amount = projection.current?.amount ?? 0
      const amountText = amount.toFixed(3), motion = reduce() ? 'reduced' : 'full'
      if (amountText !== lastAmount) {
        element.dataset.projection = amountText
        const body = projectionBody()
        if (body) body.style.opacity = amountText
        lastAmount = amountText
      }
      if (motion !== lastMotion) { element.dataset.motion = motion; lastMotion = motion }
      if (!settled && (reduce() || (lastMode === 'conversation' ? amount >= .999 : time - changedAt > 1350))) {
        settled = true; latest.current.onSettled(lastMode)
      }
      // Keep the archive's ambient waves; a settled conversation sleeps until input.
      const sleeping = lastMode === 'conversation' && settled && quietFrames >= 18
      if (!sleeping && (!reduce() || time - changedAt < 2000)) raf = requestAnimationFrame(draw)
    }
    function wake() { quietFrames = 0; if (!raf && !disposed) raf = requestAnimationFrame(draw) }
    const resize = () => {
      changedAt = performance.now()
      // Suppress the projection box's layout transitions while the window is
      // being resized so it tracks the pointer instead of animating behind it.
      const frameEl = element.parentElement
      if (frameEl) {
        frameEl.classList.add('rh-resizing')
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => frameEl.classList.remove('rh-resizing'), 160)
      }
      if (loaded) { scene.resize(); projection.current?.measure() }
      wake()
    }
    const observer = new ResizeObserver(resize); observer.observe(element)
    const panel = element.parentElement?.querySelector<HTMLElement>('.rh-body')
    const panelChanged = () => { projection.current?.measure(); changedAt = performance.now(); wake() }
    const panelObserver = new ResizeObserver(panelChanged)
    if (panel) panelObserver.observe(panel)
    panel?.addEventListener(projectionMotionEvent, panelChanged)
    const scheme = new MutationObserver(() => { if (loaded) configure(); wake() }); scheme.observe(document.body, { attributeFilter: ['data-rhine', 'data-rhine-motion'] })
    const media = () => { changedAt = performance.now(); if (loaded) configure(); wake() }
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); raf = 0; loaded = false; setStatus('error'); latest.current.onSettled(latest.current.mode) }
    scene.renderer.domElement.addEventListener('webglcontextlost', lost)
    for (const event of ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'pointerleave']) element.addEventListener(event, wake, { passive: true })
    const visibility = () => { changedAt = performance.now(); wake() }
    document.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', media); contrast.addEventListener('change', media)
    setStatus('loading')
    void scene.load().then(() => {
      loadFinished = true
      if (disposed) { scene.dispose(); return }
      loaded = true; projection.current = new VoxelProjection(scene, element)
      assembly.current = new InspectionAssembly(scene, wake)
      assembly.current.setActive(latest.current.inspection)
      scene.beforeRender = dt => {
        const projected = projection.current?.update(dt, scene.detailVisibility) ?? false
        const inspecting = assembly.current?.update(dt, reduce()) ?? false
        return projected || inspecting
      }
      configure(); scene.setMode('archive'); scene.revealImmediately(); synchronize(); resize(); setStatus('ready'); wake()
    }).catch(error => {
      loadFinished = true
      if (disposed) { scene.dispose(); return }
      console.error('Rhine archive failed to load', error); setStatus('error'); latest.current.onSettled(latest.current.mode)
    })
    return () => {
      disposed = true; apply.current = () => {}; cancelAnimationFrame(raf); clearTimeout(resizeTimer); element.parentElement?.classList.remove('rh-resizing'); observer.disconnect(); panelObserver.disconnect(); panel?.removeEventListener(projectionMotionEvent, panelChanged); scheme.disconnect()
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', media); contrast.removeEventListener('change', media)
      scene.renderer.domElement.removeEventListener('webglcontextlost', lost)
      for (const event of ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'pointerleave']) element.removeEventListener(event, wake)
      pacing.dispose(); assembly.current?.dispose(); assembly.current = undefined; projection.current?.dispose(); projection.current = undefined; engine.current = undefined
      if (loaded || loadFinished) scene.dispose(); else scene.renderer.domElement.remove()
    }
  }, [preferences.scene, retry])
  useEffect(() => { apply.current() }, [preferences.motion, preferences.quality, preferences.maxFps])
  return <div ref={host} className="rh-archive-stage" data-scene-status={status} aria-label={copy('scene')}>
    {status === 'loading' && <div className="rh-scene-status" role="status"><OpticalSignal active /><Lettering phrase="database" reveal />{copy('sceneLoading')}</div>}
    {status === 'error' && <div className="rh-scene-status" role="status"><p>{copy('sceneError')}</p><button onClick={() => setRetry(value => value + 1)}>{copy('retry')}</button></div>}
  </div>
}
