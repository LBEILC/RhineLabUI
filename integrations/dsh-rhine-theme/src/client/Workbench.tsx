import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ComposerBlocks, EmptyWorkspaceOwnerProps, InputZone } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useRhine } from './runtime.tsx'
import { Icon } from './Icons.tsx'
import { Lettering, OpticalSignal } from './OpticalMotion.tsx'
export type WorkbenchProps = PropsRuntime<'main.conversation'> & PropsLocale<'conversation'> & PropsRenderSlots<
  'conversation.header' | 'conversation.session' | 'conversation.composer' | 'conversation.composer.bar' | 'conversation.input.dock' | 'conversation.hero.workspace' | 'conversation.hero.agentPreset'> & {
    selectWorkspace(id: Parameters<EmptyWorkspaceOwnerProps['onPick']>[0]): Promise<void>; composerBlocks: ComposerBlocks
  }
export function Workbench({ sessionId, useSession, useSessions, useConversation, useInput, useWorkspaces, useSessionStatus, selectWorkspace, composerBlocks, renderSlot, renderSlotChain, t }: WorkbenchProps) {
  const { copy } = useRhine()
  const session = useSession(s => s), conversation = useConversation(s => s), input = useInput(s => s), workspaces = useWorkspaces(s => s)
  const pending = useSessionStatus(s => sessionId === undefined ? undefined : s.get(sessionId)?.pendingInteraction)
  const summaryBlank = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.blank)
  const cwd = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.cwd)
  const source = useMemo(() => sessionId === undefined ? undefined : composerBlocks.storeFor(sessionId), [composerBlocks, sessionId])
  const subscribe = useCallback((fn: () => void) => source?.subscribe(fn) ?? (() => {}), [source])
  const snapshot = useCallback(() => source?.getSnapshot(), [source])
  const blocked = useSyncExternalStore(subscribe, snapshot, snapshot)
  const active = session !== undefined && ((conversation?.activeTargets.size ?? 0) > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running || session.promptAttempted)
  const hero = sessionId === undefined || (!active && (session?.openState === 'open' || summaryBlank === true))
  const settling = sessionId !== undefined && ((!active && session?.openState === 'loading' && summaryBlank !== true) || (session?.subagent?.address.mode === 'continuable' && session.subagent.parentAvailable === undefined))
  const phase = settling ? 'settling' : hero ? 'hero' : 'active'
  const [pickerOpen, setPickerOpen] = useState(false), [workspaceError, setWorkspaceError] = useState(false)
  const [trajectoryCompose, setTrajectoryCompose] = useState(false)
  const [pendingWorkspace, setPendingWorkspace] = useState<Parameters<EmptyWorkspaceOwnerProps['onPick']>[0]>()
  const anchor = useRef<HTMLButtonElement>(null), root = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null), seat = useRef<HTMLDivElement>(null)
  const request = useRef(0), alive = useRef(true)
  const workspace = workspaces.items.find(item => item.sessionIds.includes(sessionId!))
  const label = workspaces.items.find(item => item.workspaceId === pendingWorkspace)?.title ?? workspace?.title ?? (workspaces.phase !== 'ready' ? cwd?.split(/[\\/]/).filter(Boolean).at(-1) : undefined)
  const inert = sessionId === undefined || (hero && label === undefined)
  const zone: InputZone | undefined = session && input ? { session, input } : undefined
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current++ } }, [])
  useEffect(() => { if (workspace?.workspaceId === pendingWorkspace) setPendingWorkspace(undefined) }, [workspace?.workspaceId, pendingWorkspace])
  useEffect(() => { if (!hero) setPickerOpen(false) }, [hero])
  useEffect(() => { setTrajectoryCompose(false) }, [sessionId])
  useEffect(() => {
    const editor = seat.current, history = scroller.current
    if (!editor || !history) return
    // Keep the host's wheel-at-editor-edge behavior after separating the two rows.
    const wheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || !event.deltaY) return
      let node = event.target instanceof HTMLElement ? event.target : null
      while (node && editor.contains(node)) {
        const scrollable = /auto|scroll/.test(getComputedStyle(node).overflowY)
        if (scrollable && (event.deltaY < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1)) return
        node = node.parentElement
      }
      if (history.scrollHeight <= history.clientHeight) return
      event.preventDefault()
      history.scrollTop += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? history.clientHeight : 1)
    }
    editor.addEventListener('wheel', wheel, { passive: false })
    return () => editor.removeEventListener('wheel', wheel)
  }, [])
  useLayoutEffect(() => {
    const body = root.current, scroll = scroller.current, editor = seat.current
    if (!body || !scroll || !editor) return
    const measure = () => {
      // The composer occupies its own layout row; the message viewport needs no overlay reservation.
      scroll.style.setProperty('--dsh-composer-height', '0px')
      scroll.style.setProperty('--dsh-conversation-viewport-height', `${scroll.clientHeight}px`)
      body.style.setProperty('--dsh-conversation-column-width', `${body.clientWidth}px`)
    }
    const observer = new ResizeObserver(measure); observer.observe(body); observer.observe(scroll); observer.observe(editor); measure()
    return () => observer.disconnect()
  }, [])
  const fallback = <div className={'rh-writing-sheet' + (phase === 'active' ? ' is-active' : '')}>
    <div className="rh-sheet-heading"><span>{copy(hero ? 'note' : 'continue')}</span><span>FIELD NOTE</span></div>
    <div className="rh-workspace-row" hidden={!hero}>
      <button ref={anchor} type="button" aria-haspopup="menu" aria-expanded={pickerOpen} onClick={() => setPickerOpen(value => !value)} aria-label={copy('workspace')}><Icon kind="folder" size={16} /><span>{label ?? copy('workspace')}</span><Icon kind="chevron" size={14} /></button>
      {renderSlot('conversation.hero.workspace', { open: pickerOpen, anchorRef: anchor, selectedId: pendingWorkspace ?? workspace?.workspaceId,
        onPick: id => { const generation = ++request.current; setPickerOpen(false); setPendingWorkspace(id); setWorkspaceError(false); void selectWorkspace(id).catch(() => { if (!alive.current || request.current !== generation) return; setPendingWorkspace(undefined); setWorkspaceError(true) }) }, onClose: () => setPickerOpen(false) })}
      {renderSlot('conversation.hero.agentPreset', {})}
    </div>
    {workspaceError && <p className="rh-error" role="alert">{copy('workspaceError')}</p>}
    {zone && renderSlot('conversation.input.dock', zone)}
    {renderSlot('conversation.composer.bar', { variant: hero ? 'hero' : 'composer', ...(inert ? { disabled: true, placeholder: t('placeholder.workspace'), workspacePickerOpen: pickerOpen, onRequestWorkspace: () => setPickerOpen(true) } : blocked ? { blocked, placeholder: blocked.reason } : hero ? { placeholder: t('placeholder.hero') } : {}) })}
    <div className="rh-sheet-bottom"><span>{copy('hint')}</span><span aria-hidden="true">RH / INPUT</span></div>
  </div>
  return <div ref={root} className="rh-workbench" data-phase={phase} data-trajectory-compose={trajectoryCompose}>
    <div className={'rh-native-header' + (phase === 'hero' ? ' is-hero' : '')}>{sessionId !== undefined && renderSlot('conversation.header', {})}</div>
    <div className={'rh-conversation-body' + (phase === 'hero' ? ' is-hero' : '')} data-conversation-content data-conversation-session={sessionId} data-conversation-region="chat" data-content-phase={phase}>
      <div ref={scroller} className={'rh-scroll' + (phase === 'hero' ? ' is-hero' : '') + (phase === 'active' ? ' is-active' : '')} data-conversation-scroll>
        {sessionId !== undefined && renderSlot('conversation.session', {})}
        {settling && <p className="rh-loading" role="status">{copy('loading')}</p>}
      </div>
        <div className="rh-trajectory-compose-bar"><OpticalSignal sequence={sessionId} /><button type="button" aria-expanded={trajectoryCompose} onClick={() => setTrajectoryCompose(value => !value)}><Icon kind="chevron" size={15} />{copy(trajectoryCompose ? 'hideComposer' : 'showComposer')}</button></div>
        <div ref={seat} className={'rh-composer-seat' + (phase === 'hero' ? ' is-hero' : '') + (phase === 'active' ? ' is-active' : '') + (phase === 'settling' ? ' is-settling' : '')} data-composer-seat data-conversation-region="composer">
          {hero && <div className="rh-blank-file"><Lettering phrase="welcome" reveal /><h1>{copy('blankFile')}</h1><p>{copy('blankDescription')}</p></div>}
          {(session?.running || pending) && <div className="rh-research-state" role="status"><OpticalSignal active={!!session?.running} sequence={pending ? 'pending' : 'running'} /><span>{copy(pending ? 'attention' : 'running')}</span><Lettering phrase={pending ? 'request' : 'processing'} reveal /></div>}
          {renderSlotChain('conversation.composer', { sessionId, session, pendingInteraction: pending }, { fallback, fallbackOnly: sessionId === undefined, overlay: true })}
        </div>
    </div>
  </div>
}
