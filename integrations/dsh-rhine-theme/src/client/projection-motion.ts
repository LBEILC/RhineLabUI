const moving = new WeakSet<HTMLElement>()
export const projectionMotionEvent = 'rh-projection-motion'
export const projectionIsMoving = (element: HTMLElement) => moving.has(element)

type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
const same = (a: Box, b: Box) => (['left', 'top', 'width', 'height'] as const).every(key => Math.abs(a[key] - b[key]) < .1)

// Sample the original cubic-bezier(.16, 1, .3, 1) once. A single compositor
// animation retains the old 900 ms horizontal / 700 ms vertical timing.
function ease(time: number) {
  if (time >= 1) return 1
  let low = 0, high = 1
  for (let i = 0; i < 20; i++) {
    const t = (low + high) / 2, s = 1 - t
    if (3 * s * s * t * .16 + 3 * s * t * t * .3 + t * t * t < time) low = t
    else high = t
  }
  return 1 - (1 - (low + high) / 2) ** 3
}
const steps = Array.from({ length: 61 }, (_, i) => ({ offset: i / 60, x: ease(i / 60), y: ease(i / 60 * 900 / 700) }))

/** Layout changes once per action. Only transform changes between frames.
 * The real editor stays mounted: selection, draft, IME and popovers survive. */
export class ProjectionMotion {
  private box: Box
  private animation?: Animation
  private readonly media = matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)')
  private readonly resize: ResizeObserver
  private readonly preferences: MutationObserver
  private previousWillChange = ''

  constructor(private readonly element: HTMLElement) {
    this.box = element.getBoundingClientRect()
    this.resize = new ResizeObserver(() => {
      // The first notification after FLIP is for the new *layout*, not the
      // transformed visual box. Do not cancel our own animation or cache it.
      if (Math.abs(element.offsetWidth - this.box.width) > 1 || Math.abs(element.offsetHeight - this.box.height) > 1) this.reset()
    })
    this.resize.observe(element)
    this.preferences = new MutationObserver(this.preferenceChanged)
    this.preferences.observe(document.body, { attributes: true, attributeFilter: ['data-rhine-motion'] })
    this.media.addEventListener('change', this.preferenceChanged)
    window.addEventListener('resize', this.reset)
    document.addEventListener('visibilitychange', this.visibilityChanged)
  }

  private reduced = () => this.media.matches || document.body.dataset.rhineMotion === 'reduced'
  private preferenceChanged = () => { if (this.reduced()) this.reset() }
  private visibilityChanged = () => { if (document.hidden) this.reset() }
  private notify() { this.element.dispatchEvent(new Event(projectionMotionEvent)) }

  private cancel() {
    if (!this.animation) return
    this.animation.onfinish = null
    this.animation.cancel()
    this.animation = undefined
    moving.delete(this.element)
    if (this.previousWillChange) this.element.style.willChange = this.previousWillChange
    else this.element.style.removeProperty('will-change')
  }

  /** Called after React commits the destination class, before the next paint. */
  update(animate: boolean) {
    let previous = this.box
    if (this.animation) {
      // React has already changed the layout. Apply the current animated
      // matrix to the OLD destination to recover the on-screen position.
      // Measuring the new layout with the old transform would jump on reversal.
      const matrix = new DOMMatrixReadOnly(getComputedStyle(this.element).transform)
      previous = { left: previous.left + matrix.m41, top: previous.top + matrix.m42, width: previous.width * matrix.m11, height: previous.height * matrix.m22 }
    }
    this.cancel()
    const next = this.element.getBoundingClientRect()
    this.box = next
    if (!animate || this.reduced() || document.hidden || same(previous, next) || Math.min(previous.width, previous.height, next.width, next.height) <= 0) {
      this.notify()
      return
    }
    const dx = previous.left - next.left, dy = previous.top - next.top
    const sx = previous.width / next.width, sy = previous.height / next.height
    this.previousWillChange = this.element.style.willChange
    this.element.style.willChange = 'transform'
    this.animation = this.element.animate(steps.map(({ offset, x, y }) => ({
      offset,
      transform: `translate(${dx * (1 - x)}px, ${dy * (1 - y)}px) scale(${1 + (sx - 1) * (1 - x)}, ${1 + (sy - 1) * (1 - y)})`,
    })), { duration: 900, easing: 'linear', fill: 'both' })
    this.animation.id = 'rh-projection-flip'
    moving.add(this.element)
    this.animation.onfinish = () => { this.cancel(); this.notify() }
    this.notify()
  }

  reset = () => {
    this.cancel()
    this.box = this.element.getBoundingClientRect()
    this.notify()
  }

  dispose() {
    this.cancel()
    this.resize.disconnect()
    this.preferences.disconnect()
    this.media.removeEventListener('change', this.preferenceChanged)
    window.removeEventListener('resize', this.reset)
    document.removeEventListener('visibilitychange', this.visibilityChanged)
  }
}
