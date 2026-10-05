import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import artwork from './rhine/boot-lettering-art.json'
import { scanOrbitTrack } from './rhine/boot-orbit-tracks.ts'
import { bootLogoTrack } from './rhine/boot-logo-tracks.ts'
import { bootMarkContour } from './rhine/brand.ts'

const orbitFrames = Array.from({ length: 26 }, (_, i) => scanOrbitTrack(543 + i))
const finalOrbit = orbitFrames.at(-1)!
const logoFrames = Array.from({ length: 36 }, (_, i) => bootLogoTrack(229 + i))
const motionAllowed = () => document.body.dataset.rhineMotion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)').matches

/** Measured upstream arcs, played once per real transition. No render loop. */
export function OpticalSignal({ sequence = '', active = false }: { sequence?: string; active?: boolean }) {
  const root = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const element = root.current
    if (!element || !motionAllowed()) return
    const animations: Animation[] = []
    const play = (node: SVGCircleElement, frames: Keyframe[]) => {
      const animation = node.animate(frames, { duration: 760, fill: 'both' })
      // A completed SVG effect with fill:both still participates in layout during
      // ancestor transforms. Keep its exact last pose as ordinary inline style.
      animation.onfinish = () => {
        Object.assign(node.style, frames.at(-1))
        animation.cancel()
      }
      animations.push(animation)
    }
    element.querySelectorAll<SVGCircleElement>('[data-orbit-side]').forEach((node, index) => {
      const end = finalOrbit.sides[index], length = 2 * Math.PI * end.radius
      play(node, orbitFrames.map(frame => {
        const side = frame.sides[index]
        return { transform: `translate(${side.x-end.x}px, ${side.y-end.y}px) rotate(${side.start*180/Math.PI}deg) scale(${side.radius/end.radius})`, strokeDasharray: `${side.sweep/(2*Math.PI)*length} ${length}`, opacity: frame.sideVisible ? 1 : 0 }
      }))
    })
    element.querySelectorAll<SVGCircleElement>('[data-satellite]').forEach((node, index) => {
      const end = finalOrbit.satellites[index]
      play(node, orbitFrames.map(frame => {
        const dot = frame.satellites[index]
        return { transform: `translate(${dot.x-end.x}px, ${dot.y-end.y}px) scale(${dot.radius/Math.max(end.radius,.1)})` }
      }))
    })
    const media = matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)')
    const stop = () => animations.forEach(animation => animation.cancel())
    media.addEventListener('change', stop)
    return () => { stop(); media.removeEventListener('change', stop) }
  }, [sequence])
  return <span className="rh-optical-signal" data-active={active} aria-hidden="true"><svg ref={root} viewBox="777 483 364 115">
    {finalOrbit.sides.map((side, i) => <circle key={i} data-orbit-side="" cx={side.x} cy={side.y} r={side.radius} fill="none" stroke="currentColor" strokeWidth="2" />)}
    <circle cx="959.5" cy="539.5" r="10" fill="currentColor" />
    {finalOrbit.satellites.map((dot, i) => <circle key={i} data-satellite="" cx={dot.x} cy={dot.y} r={dot.radius} fill="currentColor" />)}
  </svg></span>
}

export function OpticalMark() {
  const path = useRef<SVGPathElement>(null)
  useEffect(() => {
    if (!path.current || !motionAllowed()) return
    const animation = path.current.animate(logoFrames.map(frame => ({ strokeDasharray: `${frame.length*1000} 1000`, strokeDashoffset: -frame.start*1000, strokeWidth: frame.strokeWidth })), {duration: 980})
    return () => animation.cancel()
  }, [])
  return <svg className="rh-optical-mark" viewBox="0 0 310 145" aria-hidden="true"><path ref={path} pathLength="1000" d={bootMarkContour} fill="none" stroke="currentColor" strokeWidth="15" /></svg>
}

type Phrase = 'brand' | 'welcome' | 'database' | 'processing' | 'request' | 'access'
/** Reuse only phrases that describe real DSH state; fictional identity is excluded. */
export function Lettering({ phrase, reveal = false }: { phrase: Phrase; reveal?: boolean }) {
  const art = artwork[phrase]
  let x = 0
  const glyphs = art.letters.map((letter, i) => {
    const left = x; x += letter.width * art.units
    return <g key={i} transform={`translate(${left} 0)`}><path d={letter.path} style={{ '--rh-letter-delay': `${i * 18}ms` } as CSSProperties} /></g>
  })
  return <svg className="rh-lettering" data-reveal={reveal} viewBox={`0 0 ${x} ${art.units}`} role="img" aria-label={art.text}>{glyphs}</svg>
}
