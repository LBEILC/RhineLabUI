import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SlotMap, StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'

type SlotName = keyof SlotMap & string
type ChildName = keyof SlotMap & string

/** Mutable view of the registration fields this adapter re-composes. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type MutableEntry = Mutable<Pick<StoredEntry, 'component' | 'children' | 'locale'>>

/**
 * Widen one host registration's render contract with child slots the replacement
 * composes itself.
 *
 * dsh 0.1.7 moved the Conversation body, Composer, input dock, and hero seats out
 * of `main.conversation` and into the `conversation.content` Factory, handing the
 * panel only the resident header. The framework authorizes every `renderSlot`
 * call against the live `entry.children` table (ui-renderer `scoped-slots.tsx`)
 * and reads `entry.locale` at render time, so a presentation host that composes
 * those children on its own entry adopts their live specs here — no second
 * declarer, no `register()` conflict. Restored on dispose.
 */
export interface HostContract {
  /** Child slots the replacement renders; each must be declared (its spec read
   * through the public registry) before installation proceeds. */
  readonly children: readonly ChildName[]
  /** Locale namespace for the adopted `t` seat. */
  readonly locale?: string | undefined
}

/** Child slots a replacement renders; the host registration must declare them all
 * before the replacement is installed. */
function declaresChildren(entry: StoredEntry, required: readonly string[]): boolean {
  if (required.length === 0) return true
  const children = entry.children as Readonly<Record<string, unknown>> | undefined
  return children !== undefined && required.every(key => Object.hasOwn(children, key))
}

/** Snapshot of the fields the adapter overwrites, for exact restoration. */
function capture(entry: StoredEntry): MutableEntry {
  return { component: entry.component, children: entry.children, locale: entry.locale }
}

/** Overwrite the mutable registration fields from one captured snapshot. */
function restore(entry: StoredEntry, previous: MutableEntry): void {
  const target: MutableEntry = entry
  target.component = previous.component
  target.children = previous.children
  target.locale = previous.locale
}

/** Decorate the standard DSH registration's render component in place.
 * This version permits only one declarer of a child slot: a second registration
 * cannot reclaim those children. Retain the original entry identity, injection,
 * store and render authority, and swap only its React component. A transient
 * lower-precedence entry publishes the registry revision on enable and restore.
 * This compatibility adapter uses mutable StoredEntry fields, rather than a
 * portable public replacement API; this desktop adapter is tested against 0.2.0-rc.2.
 * @param ctx - Active theme context.
 * @param slot - A single host slot to replace.
 * @param component - React component compatible with that host's existing props.
 * @param requiredChildren - Child slots that must already be declared on the host
 * registration before the replacement is installed.
 * @param contract - Optional child slots the replacement composes itself (see
 * {@link HostContract}); installation waits until every one is declared so a
 * render can never outrun the widened contract.
 * @returns Disposer that restores the original registration if still owned here.
 */
export function replaceHostSlot(
  ctx: Context,
  slot: SlotName,
  component: unknown,
  requiredChildren: readonly string[] = [],
  contract?: HostContract,
): () => void {
  const slots = ctx.slots
  let active: { entry: StoredEntry; previous: MutableEntry } | undefined
  let disposed = false
  // StoredEntry intentionally erases the component's proven props. The temporary
  // publisher renders nothing and never wins a single-slot election.
  const register = slots.register.bind(slots) as (options: { name: SlotName; priority: number }, component: unknown) => () => void
  const publish = () => {
    const priority = Math.max(...slots.entries(slot).map(entry => entry.options.priority ?? 0)) + 1
    register({ name: slot, priority }, () => null)()
  }
  const synchronize = () => {
    if (disposed) return
    const entry = slots.entries(slot).find(item => (item.options.priority ?? 0) === 0)
    if (entry === undefined || active?.entry === entry) return
    // The host owns the contract: skip (and stay skipped) while its registration
    // does not declare every child this component renders.
    if (!declaresChildren(entry, requiredChildren)) return
    let adopted: StoredEntry['children']
    if (contract !== undefined) {
      const specs: Record<string, NonNullable<StoredEntry['children']>[string]> = {}
      for (const key of contract.children) {
        // Specs are declared with the Factory that owns these children; wait for
        // the whole table rather than rendering against a half-owned contract.
        const spec = slots.spec(key)
        if (spec === undefined) return
        specs[key] = spec
      }
      adopted = specs
    }
    const previous = capture(entry)
    const target: MutableEntry = entry
    if (adopted !== undefined) {
      target.children = { ...(entry.children ?? {}), ...adopted }
      if (contract?.locale !== undefined) target.locale = contract.locale
    }
    entry.component = component
    active = { entry, previous }
    try { publish() } catch (error) { restore(entry, previous); active = undefined; throw error }
  }
  // Child occupants registered through slots.inject can arrive after the package's
  // apply returns. Observe the ledger rather than treating that boot order as failure.
  const unsubscribers = [slots.subscribe(slot, synchronize)]
  // A late child declaration must still install the adopted contract.
  for (const key of contract?.children ?? []) unsubscribers.push(slots.subscribe(key, synchronize))
  try { synchronize() } catch (error) { disposed = true; for (const off of unsubscribers) off(); throw error }
  return () => {
    if (disposed) return
    disposed = true
    for (const off of unsubscribers) off()
    if (active === undefined) return
    const { entry, previous } = active
    if (entry.component !== component) return
    restore(entry, previous)
    if (slots.entries(slot).includes(entry)) publish()
  }
}
