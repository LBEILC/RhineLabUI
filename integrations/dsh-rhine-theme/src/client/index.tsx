import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { ConversationController, InputActions, InputState, SessionInputResolver } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarRootInjected } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { Directory } from './Directory.tsx'
import { Frame } from './ArchiveFrame.tsx'
import type { FrameProps, ArchiveNavigation } from './ArchiveFrame.tsx'
import { Workbench } from './Workbench.tsx'
import type { WorkbenchProps } from './Workbench.tsx'
import { replaceHostSlot } from './adapter.ts'
import { Settings } from './Settings.tsx'
import { zh, en } from './locales.ts'
import type { CopyKey } from './locales.ts'
import type { ThemeControls, ThemeView } from './runtime.tsx'
import { TOKENS } from './palette.ts'
import { NAMESPACE, resolvePreferences } from '../preferences.ts'
import type { Preferences } from '../preferences.ts'
import css from './archive.css'
import startupCss from './startup.css'
import sansFont from '../../assets/MiSans-Regular.woff2'
import sansBold from '../../assets/MiSans-Bold.woff2'
import { setDesktopScene } from './desktop.ts'
import { Lettering, OpticalMark } from './OpticalMotion.tsx'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { rhine: CopyKey } }
export const name = 'dsh-rhine-theme-client'
export const inject = ['slots', 'theme', 'locale', 'configForms', 'uiWorkspace', 'conversation', 'layout']
type SessionId = NonNullable<WorkbenchProps['sessionId']>
type DraftInput = Pick<InputActions, 'setDraft' | 'addAttachments' | 'removeAttachment'> & { snapshot: Pick<InputState, 'draft' | 'attachmentIds'> }
type ResidentInput = SessionInputResolver & { shell(id: SessionId): DraftInput }

/** DSH Desktop 0.2.0-rc.2 client integration, with reversible presentation changes. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('rhine', { zh, en }), 'rhine: locale')
  ctx.effect(() => {
    const style = document.createElement('style'); style.dataset.plugin = NAMESPACE
    style.textContent = `@font-face{font-family:MiSans;src:url("${sansFont}") format("woff2");font-weight:300 600;font-display:swap;}@font-face{font-family:MiSans;src:url("${sansBold}") format("woff2");font-weight:700 900;font-display:swap;}\n${css}\n${startupCss}`
    document.head.append(style); return () => style.remove()
  }, 'rhine: stylesheet and local typeface')
  const scope = ctx.configForms.get<Preferences>(NAMESPACE), listeners = new Set<() => void>()
  let busy = false, disposed = false
  const read = (): ThemeView => { const state = scope.getSnapshot(); return { preferences: resolvePreferences(state.value), ready: state.status === 'ready' && state.writable, loaded: state.status === 'ready', busy } }
  let view = read()
  const publish = () => { if (disposed) return; view = read(); for (const fn of listeners) fn() }
  const controls: ThemeControls = {
    getSnapshot: () => view,
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } },
    update: async (key, value) => {
      if (disposed || busy || !view.ready) throw new Error('RHINE preferences are not writable')
      busy = true; publish()
      try { if (!await scope.set(key, value)) throw new Error('RHINE preference save was refused') }
      finally { busy = false; publish() }
    },
    toggleColor: () => ctx.theme.setTheme(ctx.theme.getTheme().active.colorScheme === 'dark' ? 'light' : 'dark'),
    openSettings: () => {
      // Desktop 0.2.0 exposes the same singleton store to its settings button and shortcuts.
      const store = ctx.slots.entries('sidebar.settings').find(entry => (entry.options.priority ?? 0) === 0)?.store as { create(): { actions: { open(): void } } } | undefined
      store?.create().actions.open()
    },
  }
  const copy = ctx.locale.bind('rhine')
  const navigation: ArchiveNavigation = {
    openSession: id => ctx.uiWorkspace.openSession(id),
    newSession: id => ctx.uiWorkspace.openWorkspace(id),
    showConversation: () => ctx.layout.selectPanel(null),
  }
  const Root = (props: FrameProps) => <Frame {...props} controls={controls} copy={copy} navigation={navigation} />
  const Content = (props: WorkbenchProps) => <Workbench {...props} composerBlocks={ctx.conversation.blocks} selectWorkspace={id => {
    const conversation = ctx.conversation as ConversationController, input = conversation.input as ResidentInput
    return ctx.uiWorkspace.openWorkspace(id, nextId => {
      if (props.sessionId === undefined || props.sessionId === nextId) return
      const from = input.shell(props.sessionId), next = input.shell(nextId), { draft, attachmentIds } = from.snapshot
      if (attachmentIds.length && !next.addAttachments(attachmentIds)) return
      conversation.rebindDraftFiles(nextId, attachmentIds)
      if (draft) { next.setDraft(draft); from.setDraft('') }
      for (const attachment of attachmentIds) from.removeAttachment(attachment)
    })
  }} />
  ctx.effect(() => {
    let restore: (() => void) | undefined, clearTokens: (() => void) | undefined
    const clear = () => { restore?.(); restore = undefined; document.body.removeAttribute('data-rhine'); document.body.removeAttribute('data-rhine-motion'); clearTokens?.(); clearTokens = undefined; void setDesktopScene(false) }
    const scheme = () => { if (clearTokens) document.body.dataset.rhine = ctx.theme.getTheme().active.colorScheme }
    const adopt = () => {
      const preference = resolvePreferences(scope.getSnapshot().value)
      if (preference.enabled) {
        if (!clearTokens) clearTokens = ctx.theme.overrideTokens(NAMESPACE, TOKENS)
        scheme(); document.body.dataset.rhineMotion = preference.motion
        if (!restore) {
          void setDesktopScene(true)
          const disposers: (() => void)[] = []
          try {
            disposers.push(replaceHostSlot(ctx, 'root', Root, ['sidebar', 'main', 'rightbar', 'shell.overlay'], { children: ['sidebar.settings'] }))
            disposers.push(replaceHostSlot(ctx, 'sidebar', Directory, ['sidebar.workspaces', 'sidebar.panellist', 'sidebar.settings', 'sidebar.footer.action']))
            disposers.push(replaceHostSlot(ctx, 'settings.header', () => <span className="rh-settings-heading"><OpticalMark /><span>{copy('systemSettings')}</span><Lettering phrase="database" reveal /></span>))
            disposers.push(replaceHostSlot(ctx, 'main.conversation', Content, ['conversation.header'], { children: ['conversation.session', 'conversation.composer', 'conversation.composer.bar', 'conversation.input.dock', 'conversation.hero.workspace', 'conversation.hero.agentPreset'], locale: 'conversation' }))
          } catch (error) { for (const fn of disposers.reverse()) fn(); clear(); throw error }
          restore = () => { for (const fn of disposers.toReversed()) fn() }
        }
      } else clear()
      publish()
    }
    const off = scope.subscribe(adopt), offTheme = ctx.on('theme/change', scheme)
    adopt()
    return () => { disposed = true; off(); offTheme(); clear(); listeners.clear() }
  }, 'rhine: desktop composition and lifecycle')
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({ name: 'settings.general.item', id: 'rhine-theme', order: 8, locale: 'rhine' }, () => <Settings controls={controls} copy={copy} />))
}
