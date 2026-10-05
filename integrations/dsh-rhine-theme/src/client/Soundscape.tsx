import { useEffect, useRef } from 'react'
import { useRhine, useThemeView } from './runtime.tsx'
import atmosphere from '../../assets/atmosphere.ogg'
import motif from '../../assets/motif.ogg'
import pulse from '../../assets/pulse.ogg'

let primed: AudioContext | undefined
/** Called in the user's checkbox gesture; loading still happens only after opt-in. */
export function primeSound() { primed ??= new AudioContext(); void primed.resume().catch(() => {}) }

export function Soundscape({ mode }: { mode: string }) {
  const { controls } = useRhine(), { preferences } = useThemeView(controls)
  const gains = useRef<GainNode[]>([]), currentMode = useRef(mode); currentMode.current = mode
  const mix = () => gains.current.forEach((gain, i) => gain.gain.setTargetAtTime(([.035, currentMode.current === 'conversation' ? .018 : .04, currentMode.current === 'home' ? .012 : .022])[i], gain.context.currentTime, .3))
  useEffect(() => { mix() }, [mode])
  useEffect(() => {
    if (!preferences.sound) return
    const context = primed ?? new AudioContext(); primed = undefined
    let disposed = false
    const sources: AudioBufferSourceNode[] = []
    const visibility = () => {
      if (disposed) return
      void (document.hidden || !document.hasFocus() ? context.suspend() : context.resume()).catch(() => {})
    }
    const start = async () => {
      const buffers = await Promise.all([atmosphere,motif,pulse].map(async url => context.decodeAudioData(await (await fetch(url)).arrayBuffer())))
      if (disposed) return
      const time = context.currentTime + .05
      for (const buffer of buffers) {
        const source = context.createBufferSource(), gain = context.createGain()
        source.buffer = buffer; source.loop = true; gain.gain.value = 0
        source.connect(gain).connect(context.destination); source.start(time)
        sources.push(source); gains.current.push(gain)
      }
      mix(); visibility()
    }
    void start().catch(error => { if (!disposed) console.warn('Rhine sound unavailable', error) })
    document.addEventListener('visibilitychange', visibility); window.addEventListener('focus', visibility); window.addEventListener('blur', visibility); window.addEventListener('pointerdown', visibility)
    return () => { disposed = true; document.removeEventListener('visibilitychange', visibility); window.removeEventListener('focus', visibility); window.removeEventListener('blur', visibility); window.removeEventListener('pointerdown', visibility); sources.forEach(source => { source.stop(); source.disconnect() }); gains.current.forEach(gain => gain.disconnect()); gains.current = []; void context.close() }
  }, [preferences.sound])
  return null
}
