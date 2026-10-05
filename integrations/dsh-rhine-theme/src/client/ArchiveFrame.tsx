import { adjacentProject } from './rhine/project-wheel.ts'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsRuntime, PropsRenderSlots, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { PanelInfo } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { currentSession, ThemeContext, useThemeView } from './runtime.tsx'
import type { ThemeControls } from './runtime.tsx'
import type { Copy } from './locales.ts'
import { Icon } from './Icons.tsx'
import { Settings } from './Settings.tsx'
import { ArchiveStage } from './ArchiveStage.tsx'
import type { ArchiveMode } from './ArchiveStage.tsx'
import { Lettering, OpticalSignal } from './OpticalMotion.tsx'
import { Soundscape } from './Soundscape.tsx'
import { StartupSequence } from './StartupSequence.tsx'
import { startupHasPlayed, markStartupPlayed } from './rhine/startup-timeline.ts'
import type { StartupFrame } from './rhine/startup-timeline.ts'
import { ProjectionMotion } from './projection-motion.ts'

interface LayoutState { panelInfo: PanelInfo; layoutInfo: { sidebar: number; viewportWidth: number; narrowExpanded: boolean; rightbar: number | null; rightbarShown: boolean; rightbarTrack: boolean; rightbarFullscreen: boolean; rightbarInstant: boolean } }
export type FrameProps = PropsRuntime<'root'> & PropsRenderSlots<'sidebar' | 'main' | 'rightbar' | 'shell.overlay' | 'sidebar.settings'> & {
  useStore: SnapshotSelectorHook<LayoutState>
  actions: { setViewportWidth(width: number): void; toggleSidebar(): void; setRightbar(width: number): void }
}
export interface ArchiveNavigation { openSession(id: SessionId): void; newSession(id: WorkspaceId): Promise<void>; showConversation(): void }

export function Frame({ useStore, useSessions, useWorkspaces, usePanelInfo, actions, renderSlot, controls, copy, navigation }: FrameProps & { controls: ThemeControls; copy: Copy; navigation: ArchiveNavigation }) {
  const geometry = useStore(s => s.layoutInfo), panel = usePanelInfo(s => s.activePanelId)
  const sessions = useSessions(s => s), workspaces = useWorkspaces(s => s)
  const selected = currentSession(sessions), summary = selected ? sessions.byId[selected] : undefined
  const frame = useRef<HTMLDivElement>(null), drawer = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null)
  const index = useRef<HTMLDivElement>(null), indexButton = useRef<HTMLButtonElement>(null), settingsPanel = useRef<HTMLDivElement>(null), history = useRef<HTMLElement>(null)
  const lastSession = useRef(selected), requested = useRef<SessionId>(), alive = useRef(true)
  const [mode, setMode] = useState<ArchiveMode>('home'), [phase, setPhase] = useState('home')
  const [projectId, setProjectId] = useState<string | null>(null), [fileId, setFileId] = useState<SessionId | null>(null)
  const [indexOpen, setIndexOpen] = useState(false), [settings, setSettings] = useState(false), [query, setQuery] = useState('')
  const [focus, setFocus] = useState(false), [creating, setCreating] = useState(false), [error, setError] = useState('')
  const [systemSettings, setSystemSettings] = useState(false)
  const { preferences, loaded: preferencesLoaded } = useThemeView(controls)
  const [starting, setStarting] = useState<boolean | null>(() => startupHasPlayed() ? false : null), [revealing, setRevealing] = useState(false)
  const [sceneStatus, setSceneStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const openingFrame = useRef<StartupFrame | null>(null)
  const finishStartup = useCallback(() => { markStartupPlayed(); openingFrame.current = null; setStarting(false) }, [])
  const revealStartup = useCallback(() => setRevealing(true), [])
  const updateStartup = useCallback((value: StartupFrame) => { openingFrame.current = value }, [])
  useEffect(() => {
    if (starting !== null) return
    if (preferencesLoaded) {
      const play = preferences.startupAnimation && preferences.motion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)').matches
      if (play) setStarting(true); else finishStartup()
      return
    }
    // Missing configuration must not trap the workspace or flash a disabled intro.
    const timeout = setTimeout(finishStartup, 2000)
    return () => clearTimeout(timeout)
  }, [starting, preferencesLoaded, preferences.startupAnimation, preferences.motion, finishStartup])
  const open = geometry.sidebar > 0 || geometry.narrowExpanded
  const projects = useMemo(() => {
    const archived = new Set(workspaces.archivedSessionIds), mapped = new Set(workspaces.items.flatMap(item => item.sessionIds))
    const known = workspaces.items.map(item => ({ id: item.workspaceId as string, title: item.title, files: item.sessionIds.filter(id => !archived.has(id)).map(id => ({ id, title: sessions.byId[id]?.displayTitle || copy('untitled') })) }))
    const ungrouped = sessions.ids.map(id => sessions.byId[id]).filter(item => item && !item.parentId && item.origin !== 'subagent' && !mapped.has(item.id) && !archived.has(item.id)).map(item => ({ id: item.id, title: item.displayTitle || copy('untitled') }))
    if (ungrouped.length) known.push({ id: '__ungrouped__', title: copy('ungrouped'), files: ungrouped })
    return known
  }, [workspaces.items, workspaces.archivedSessionIds, sessions.byId, copy])
  const project = projects.find(item => item.id === projectId), projectIndex = projects.findIndex(item => item.id === projectId)
  const files = project?.files ?? [], visibleFiles = files.filter(file => file.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const fileIndex = files.findIndex(file => file.id === fileId)
  const available = Math.max(0, geometry.viewportWidth * .88 - 580), right = Math.min(available, geometry.rightbar ?? geometry.viewportWidth * .32)
  const showBody = panel !== null || mode === 'conversation'
  const enterProject = useCallback((id: string) => {
    if (mode === 'project' && projectId === id) { setIndexOpen(false); return }
    setIndexOpen(false); setProjectId(id); setFileId(null); setQuery(''); setFocus(false)
    setMode('project'); setPhase('travel'); setError(''); navigation.showConversation()
  }, [navigation, mode, projectId])
  const enterFile = useCallback((id: SessionId, group?: string) => {
    if (mode === 'conversation' && fileId === id) return
    requested.current = id; setFileId(id); if (group) setProjectId(group)
    setMode('conversation'); setPhase('extracting'); setError(''); setIndexOpen(false); navigation.openSession(id)
  }, [navigation, mode, fileId])
  const home = useCallback(() => { if (mode !== 'home') setPhase('returning'); setMode('home'); setFileId(null); setProjectId(null); setIndexOpen(false); setFocus(false); navigation.showConversation() }, [navigation, mode])
  const back = useCallback(() => {
    if (mode === 'conversation' && projectId) { setMode('project'); setPhase('returning'); setFileId(null); setFocus(false); navigation.showConversation() } else home()
  }, [mode, projectId, home, navigation])
  const newFile = async () => {
    const workspace = workspaces.items.find(item => item.workspaceId === projectId)
    if (!workspace) { setIndexOpen(true); return }
    setCreating(true); setError('')
    try { await navigation.newSession(workspace.workspaceId); if (alive.current) { setMode('conversation'); setPhase('extracting') } }
    catch { if (alive.current) setError(copy('newError')) }
    finally { if (alive.current) setCreating(false) }
  }
  const pick = useCallback((group: string, id: string | null) => {
    const file = projects.find(item => item.id === group)?.files.find(item => item.id === id)
    if (file) enterFile(file.id, group); else enterProject(group)
  }, [projects, enterFile, enterProject])
  const settled = useCallback((next: ArchiveMode) => setPhase(next), [])
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    // The settings portal is a direct body child; streaming messages are not observed.
    const update = () => setSystemSettings(!!document.querySelector('[data-shortcut-modal="settings"]'))
    const observer = new MutationObserver(update); observer.observe(document.body, { childList: true }); update()
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const element = frame.current; if (!element) return
    if (open) actions.toggleSidebar()
    const resize = () => actions.setViewportWidth(element.clientWidth)
    const observer = new ResizeObserver(resize); observer.observe(element); resize()
    return () => observer.disconnect()
  }, [actions])
  useLayoutEffect(() => {
    if (drawer.current) drawer.current.inert = !open
    if (body.current) body.current.inert = !showBody || (panel === null && phase !== 'conversation')
    if (history.current) history.current.inert = mode === 'home'
  }, [open, showBody, phase, panel, mode])
  const projectionMotion = useRef<ProjectionMotion>()
  const geometryKey = `${mode}|${focus}|${panel !== null}|${geometry.rightbarShown}|${geometry.rightbarFullscreen}`
  useLayoutEffect(() => {
    const element = body.current
    if (!element) return
    const motion = new ProjectionMotion(element)
    projectionMotion.current = motion
    return () => { motion.dispose(); projectionMotion.current = undefined }
  }, [])
  useLayoutEffect(() => {
    projectionMotion.current?.update(showBody && (panel !== null || phase === 'conversation') && preferences.motion !== 'reduced')
  }, [geometryKey, showBody, phase, preferences.motion])
  useEffect(() => {
    if (selected === lastSession.current) return
    const previous = lastSession.current; lastSession.current = selected
    if (!selected || (!previous && mode === 'home' && !requested.current)) return
    if (requested.current === selected) { requested.current = undefined; return }
    const group = projects.find(item => item.files.some(file => file.id === selected))
    setProjectId(group?.id ?? null); setFileId(selected); setMode('conversation'); setPhase('extracting')
    if (open) actions.toggleSidebar()
  }, [selected, projects, mode, open, actions])
  useEffect(() => { if (!creating && mode === 'conversation' && fileId === null && selected) setFileId(selected) }, [creating, mode, fileId, selected])
  useEffect(() => {
    const title = document.title; document.title = `${summary?.displayTitle || 'ARCHIVE'} — RHINE LAB / DSH`
    return () => { document.title = title }
  }, [summary?.displayTitle])
  useEffect(() => {
    if (!indexOpen) return
    const outside = (event: PointerEvent) => { if (!index.current?.contains(event.target as Node) && !indexButton.current?.contains(event.target as Node)) setIndexOpen(false) }
    document.addEventListener('pointerdown', outside)
    const id = requestAnimationFrame(() => index.current?.querySelector<HTMLButtonElement>('button')?.focus())
    return () => { document.removeEventListener('pointerdown', outside); cancelAnimationFrame(id) }
  }, [indexOpen])
  useEffect(() => {
    if (!open && !settings) return
    const container = open ? drawer.current : settingsPanel.current, previous = document.activeElement as HTMLElement | null
    const id = requestAnimationFrame(() => container?.querySelector<HTMLElement>('button, input, select')?.focus())
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return
      const items = [...container.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(item => item.getClientRects().length)
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { cancelAnimationFrame(id); document.removeEventListener('keydown', trap); previous?.focus({ preventScroll: true }) }
  }, [open, settings])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || starting !== false) return
      const typing = (event.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')
      if (event.key === '/' && !typing) { event.preventDefault(); setIndexOpen(value => !value); return }
      if (event.key !== 'Escape') return
      if (settings) { setSettings(false); return }
      if (indexOpen) { setIndexOpen(false); indexButton.current?.focus(); return }
      if (open) { actions.toggleSidebar(); return }
      if (focus) { setFocus(false); return }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (!typing) back()
    }
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key)
  }, [settings, indexOpen, open, focus, actions, back, starting])
  const stepProject = (direction: number) => { const item = adjacentProject(projects, projectId, direction); if (item) enterProject(item.id) }
  const stepFile = (direction: number) => { const file = files[(Math.max(0, fileIndex) + direction + files.length) % files.length]; if (file) enterFile(file.id) }
  const windowAction = (action: 'minimize' | 'fullscreen' | 'close') => { void window.rhineDesktop?.windowAction?.(action).catch(() => setError(copy('windowError'))) }
  return <ThemeContext.Provider value={{ controls, copy }}>
    <Soundscape mode={mode} />
    <div ref={frame} className="rh-frame" data-startup={starting === null ? 'pending' : starting} data-mode={mode} data-phase={phase} data-focus={focus} data-panel={panel !== null} data-directory={open} data-settings={settings}
      data-rightbar-shown={geometry.rightbarShown} data-rightbar-fullscreen={geometry.rightbarFullscreen} style={{ '--rh-right': `${geometry.rightbarTrack ? right : 0}px` } as CSSProperties}>
      <ArchiveStage opening={starting !== false && !revealing} openingFrame={openingFrame} onStatus={setSceneStatus} mode={mode} project={projectId} session={fileId} projects={projects} inspection={mode === 'conversation' && (focus || settings || systemSettings)} onSettled={settled} onPick={pick} />
      <div className="rh-atmosphere" aria-hidden="true" />
      <div className="rh-titlebar" data-window-drag><span>RHINE LAB / ARCHIVE SYSTEM</span></div>
      <div className="rh-system-bar" data-startup={starting === true ? 'true' : undefined}>
        <button className="rh-system-open" type="button" onClick={controls.openSettings}><Icon kind="settings" size={17} /><span>{copy('systemSettings')}</span></button>
        <div className="rh-system-settings" title={copy('systemSettings')}>{renderSlot('sidebar.settings', { wide: true })}</div>
        {window.rhineDesktop?.windowAction && <div className="rh-window-controls" role="group" aria-label={copy('windowControls')}>
          <button type="button" onClick={() => windowAction('minimize')} title={copy('minimize')} aria-label={copy('minimize')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14" /></svg></button>
          <button type="button" onClick={() => windowAction('fullscreen')} title={copy('windowMode')} aria-label={copy('windowMode')}><Icon kind="focus" size={17} /></button>
          <button type="button" onClick={() => windowAction('close')} title={copy('exit')} aria-label={copy('exit')}><Icon kind="close" size={17} /></button>
        </div>}
      </div>
      <header className="rh-header">
        <button type="button" className="rh-brand" onClick={home} aria-label={copy('home')}><Lettering phrase="brand" /><span>SYNTHESIZE INFORMATION</span><span className="rh-brand-os">ANALYSIS <b>OS</b></span></button>
        <nav aria-label={copy('archive')}>
          <button ref={indexButton} type="button" className="rh-index-button" aria-expanded={indexOpen} aria-controls="rh-project-index" onClick={() => setIndexOpen(value => !value)}><Icon kind="index" size={18} /><span>{copy('directory')}</span><kbd>/</kbd></button>
          <button type="button" onClick={() => { if (mode === 'home') setIndexOpen(true); else void newFile() }} disabled={creating}><Icon kind="plus" size={17} /><span>{copy('new')}</span></button>
          <button type="button" aria-label={copy('manage')} title={copy('manage')} onClick={actions.toggleSidebar}><Icon kind="folder" size={18} /></button>
          <button type="button" aria-label={copy('settings')} title={copy('settings')} aria-expanded={settings} onClick={() => setSettings(value => !value)}><Icon kind="settings" size={18} /></button>
        </nav>
      </header>
      {indexOpen && <div ref={index} id="rh-project-index" className="rh-project-index" role="menu" aria-label={copy('projects')} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault(); const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')], current = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }}>
        <div className="rh-index-heading"><span>{copy('projects')}</span><OpticalSignal /><span>{String(projects.length).padStart(2, '0')}</span></div>
        <div className="rh-project-items">{projects.map((item, i) => <button key={item.id} type="button" role="menuitem" onClick={() => enterProject(item.id)}><span className="rh-project-number">{String(i + 1).padStart(2, '0')}</span><span className="rh-project-name">{item.title}</span><Icon kind="arrow" size={18} /></button>)}</div>
        {!projects.length && <p>{copy(workspaces.state === 'error' ? 'workspaceError' : workspaces.phase !== 'ready' ? 'loading' : 'noProjects')}</p>}
        <button type="button" role="menuitem" className="rh-index-manage" onClick={() => { setIndexOpen(false); actions.toggleSidebar() }}><Icon kind="plus" size={15} />{copy('manage')}</button>
      </div>}
      <section className={'rh-home-caption' + (mode !== 'home' ? ' is-away' : '') + (panel !== null ? ' is-panel' : '')} aria-hidden={mode !== 'home'}>
        <p>INTERNAL DATABASE <span>/</span> {copy('archive')}</p><h1>PROJECT ARCHIVE</h1>
        <div className="rh-home-rule"><span>{copy('homeDescription')}</span><span>REFERENCE AREA</span></div>
        <button type="button" tabIndex={mode === 'home' ? 0 : -1} onClick={() => setIndexOpen(true)}>{copy('access')}<Icon kind="arrow" size={25} /></button>
      </section>
      <aside ref={history} className={'rh-history' + (mode === 'home' ? ' is-home' : '') + (geometry.rightbarShown ? ' is-hidden' : '') + (panel !== null ? ' is-panel' : '') + (focus ? ' is-focus' : '')} aria-label={copy('history')} aria-hidden={mode === 'home'}>
        <button type="button" className="rh-back" onClick={mode === 'conversation' ? back : home}><Icon kind="arrow" size={18} /><span>{copy(mode === 'conversation' ? 'backProject' : 'home')}</span></button>
        <div className="rh-history-title"><h2 title={project?.title}>{project?.title ?? copy('projects')}</h2><span>{files.length} {copy('records')}</span></div>
        <label className="rh-history-search"><Icon kind="index" size={14} /><input aria-label={copy('filterHistory')} placeholder={copy('filterHistory')} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="rh-history-list">{visibleFiles.map(file => <button type="button" key={file.id} className="rh-history-item" aria-current={file.id === fileId ? 'page' : undefined} onClick={() => enterFile(file.id)}>
          <span className="rh-file-number">{String(files.indexOf(file) + 1).padStart(2, '0')}</span><span className="rh-file-name">{file.title}</span><i data-running={sessions.byId[file.id]?.running || undefined} />
        </button>)}{!visibleFiles.length && <p className="rh-empty">{copy(query ? 'noResults' : 'empty')}</p>}</div>
        <button type="button" className="rh-new-file" disabled={creating || !workspaces.items.some(item => item.workspaceId === projectId)} onClick={() => void newFile()}><Icon kind="plus" size={16} />{copy('new')}</button>
      </aside>
      <section className={'rh-project-caption' + (mode === 'project' ? ' is-project' : '') + (panel !== null ? ' is-panel' : '')} aria-hidden={mode !== 'project'}><span>{copy('collection')}</span><h2>{project?.title}</h2><p>{copy('chooseFile')}</p><span className="rh-coordinate">{String(projectIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</span></section>
      <div ref={body} className={'rh-body' + (mode === 'conversation' ? ' is-conversation' : '') + (phase === 'conversation' ? ' is-settled' : '') + (geometry.rightbarShown ? ' is-rightbar' : '') + (panel !== null ? ' is-panel' : '') + (focus ? ' is-focus' : '')} aria-hidden={!showBody}>
        <div className="rh-projection-label"><span><OpticalSignal sequence={`${panel}:${focus}:${fileId}`} />{copy('projection')}</span><span>FILE / {String(fileIndex + 1).padStart(3, '0')}</span><button type="button" className="rh-focus-toggle" aria-label={copy(focus ? 'exitFocus' : 'focus')} aria-pressed={focus} onClick={() => setFocus(value => !value)}><Icon kind="focus" size={17} /></button><button type="button" aria-label={copy('backProject')} onClick={back}><Icon kind="close" size={17} /></button></div>
        <div className={'rh-projection-content' + (panel !== null ? ' is-panel' : '')}><main className="rh-main">{renderSlot('main', {}, { entryKey: panel ?? 'conversation' })}</main><div className={'rh-rightbar' + (geometry.rightbarShown ? ' is-shown' : '') + (geometry.rightbarFullscreen ? ' is-fullscreen' : '')} data-rightbar-col>{renderSlot('rightbar', { width: right, viewportWidth: geometry.viewportWidth, canShow: right > 0 })}</div>
          {geometry.rightbarShown && !geometry.rightbarFullscreen && right > 0 && <div className="rh-resizer" role="separator" tabIndex={0} aria-label={copy('panelWidth')} aria-orientation="vertical" aria-valuemin={260} aria-valuemax={available} aria-valuenow={Math.round(right)} style={{ right }}
            onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); actions.setRightbar(Math.min(available, Math.max(260, right + (event.key === 'ArrowLeft' ? 24 : -24)))) }}
            onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) actions.setRightbar(Math.max(260, Math.min(available, (body.current?.getBoundingClientRect().right ?? geometry.viewportWidth) - event.clientX))) }} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)} />}
        </div>
      </div>
      <div className={'rh-bottom-navigation' + (mode === 'conversation' || panel !== null ? ' is-away' : '')}><div><span>ARCHIVE / SELECT</span><p>{String(mode === 'home' ? 0 : projectIndex + 1).padStart(2, '0')}<em>/</em><small>{String(projects.length).padStart(2, '0')}</small></p></div>
        <div className="rh-file-navigation"><button aria-label={copy('previousFile')} disabled={!files.length} onClick={() => stepFile(-1)}><Icon kind="arrow" /></button><span className="rh-ticks" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} data-active={i === Math.max(0, fileIndex) % 9} />)}</span><button aria-label={copy('nextFile')} disabled={!files.length} onClick={() => stepFile(1)}><Icon kind="arrow" /></button></div>
        <div className="rh-column-navigation"><button aria-label={copy('previousProject')} disabled={!projects.length} onClick={() => stepProject(-1)}><Icon kind="arrow" /></button><span><small>COLUMN {String(Math.max(0, projectIndex) + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</small>{project?.title ?? copy('projects')}</span><button aria-label={copy('nextProject')} disabled={!projects.length} onClick={() => stepProject(1)}><Icon kind="arrow" /></button></div>
        <span className="rh-powered">POWERED BY <b>RHINE LAB</b><i /></span>
      </div>
      <footer className="rh-footer"><span><i data-running={summary?.running} />{copy(summary?.running ? 'running' : 'ready')}</span><span>{copy(mode === 'home' ? 'homeHint' : mode === 'project' ? 'projectHint' : 'conversationHint')}</span><span>DEEPSEEK HARNESS <b>/</b> RHINE LAB</span></footer>
      {error && <div className="rh-notice" role="alert">{error}<button onClick={() => setError('')} aria-label={copy('close')}><Icon kind="close" size={15} /></button></div>}
      {(open || settings) && <button type="button" className="rh-scrim" tabIndex={-1} aria-label={copy('close')} onClick={() => { if (open) actions.toggleSidebar(); setSettings(false) }} />}
      <div ref={drawer} className={'rh-drawer' + (open ? ' is-open' : '')} role="dialog" aria-modal={open || undefined} aria-label={copy('manage')} aria-hidden={!open}>{renderSlot('sidebar', { collapsed: !open, width: 400 })}</div>
      {settings && <div ref={settingsPanel} className="rh-quick-settings" role="dialog" aria-modal="true" aria-label={copy('settings')}><button className="rh-close" type="button" aria-label={copy('close')} onClick={() => setSettings(false)}><Icon kind="close" size={17} /></button><Settings controls={controls} copy={copy} /><button className="rh-color-button" onClick={controls.toggleColor}><Icon kind="sun" size={16} />{copy('color')}</button></div>}
      <div className="rh-overlays" data-shell-overlay>{renderSlot('shell.overlay', {})}</div>
      {starting === null && <div className="rh-startup-pending" aria-hidden="true" />}
      {starting === true && <StartupSequence ready={sceneStatus !== 'loading'} sceneReady={sceneStatus === 'ready' && preferences.scene} onFrame={updateStartup} onReveal={revealStartup} onDone={finishStartup} />}
    </div>
  </ThemeContext.Provider>
}
