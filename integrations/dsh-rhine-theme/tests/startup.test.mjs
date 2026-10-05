import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
async function load(file) {
 const result = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' })
 return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { StartupTimeline, STARTUP_START, STARTUP_END, STARTUP_HOLD, openingCinema, startupHasPlayed, markStartupPlayed } = await load('../src/client/rhine/startup-timeline.ts')
const { bootMotion } = await load('../src/client/rhine/boot-motion.ts')
test('opening preserves calibrated access, logo, scan and welcome sequencing without a fictional identity', () => {
 const phases = new Set()
 for (let t = STARTUP_START; t <= STARTUP_END; t += .04) {
  const s = bootMotion(t); phases.add(s.step)
  assert.doesNotMatch(s.auth, /JOYCE|ID CONFIRMED/)
  assert.ok(s.welcomePanel <= .06, 'large full-contrast flashes are suppressed')
  assert.ok(Number.isFinite(s.scan.radius)); assert.equal(s.scanOrbit.satellites.length, 6)
 }
 assert.deepEqual([...phases], ['access', 'logo', 'auth', 'scan', 'welcome'])
})
test('startup clock runs once, hands off, then stops', () => {
 const t = new StartupTimeline(); t.advance(0, true)
 let state
 for (let now = 16; now <= 28000; now += 16) state = t.advance(now, true)
 assert.equal(state.phase, 'done'); assert.equal(state.opacity, 0); assert.equal(state.time, STARTUP_END)
 assert.equal(startupHasPlayed(), false); markStartupPlayed(); assert.equal(startupHasPlayed(), true)
})
test('startup holds for actual readiness but an unavailable scene cannot trap the workspace', () => {
 const t = new StartupTimeline(); t.advance(0, false)
 for (let now = 20; now <= 21000; now += 20) t.advance(now, false)
 assert.equal(t.phase, 'waiting'); assert.equal(t.time, STARTUP_HOLD)
 for (let now = 21020; now <= 32000; now += 20) t.advance(now, false)
 assert.equal(t.phase, 'done')
})
test('a loaded scene releases the hold; skip works before resources finish and is idempotent', () => {
 const t = new StartupTimeline(); t.advance(0, false); t.advance(20000, false)
 assert.equal(t.phase, 'waiting'); t.advance(20200, true); assert.equal(t.phase, 'playing')
 const skipped = new StartupTimeline(); skipped.skip(); skipped.advance(0, false); skipped.advance(400, false); skipped.skip()
 assert.equal(skipped.advance(650, false).phase, 'done')
})
test('hidden-tab time is excluded without slowing low frame caps', () => {
 const t = new StartupTimeline(); t.advance(0, true); t.advance(1000, true); const before = t.time
 t.pause(); t.advance(60000, true); assert.equal(t.time, before)
 t.advance(61000, true); assert.ok(Math.abs(t.time - before - 1) < 1e-9)
})
test('opening tears down observers and RAF and does not retain detached lettering globally', async () => {
 const component = await readFile(new URL('../src/client/StartupSequence.tsx', import.meta.url), 'utf8')
 const lettering = await readFile(new URL('../src/client/rhine/boot-lettering.ts', import.meta.url), 'utf8')
 assert.match(component, /cancelAnimationFrame/); assert.match(component, /observer.disconnect/)
 assert.match(component, /removeEventListener\('visibilitychange'/); assert.match(component, /removeEventListener\('keydown'/)
 assert.match(component, /prefers-reduced-motion: reduce/); assert.match(component, /forced-colors: active/)
 assert.doesNotMatch(lettering, /letterings.add|new Set/)
})


test('full playback reaches the upstream cinematic array before settling, rather than taking the quick fade', () => {
 const t = new StartupTimeline(); const phases = new Set(); let cinematicFrames = 0
 t.advance(0, true)
 for (let now=16;now<=27000;now+=16) {
  const frame=t.advance(now,true,true);phases.add(frame.phase)
  assert.equal(frame.path,'full')
  if(frame.cinematic){cinematicFrames++;assert.ok(frame.time>=21.92&&frame.time<25.9);assert.deepEqual(frame.cinematic,openingCinema(frame.time));assert.equal(frame.sceneVisible,true)}
 }
 assert.ok(cinematicFrames>200);assert.ok(phases.has('cinematic'));assert.ok(phases.has('settling'));assert.ok(!phases.has('handoff'));assert.equal(t.phase,'done')
})
test('Esc before or during cinema always chooses the quick path and stops cinematic frames', () => {
 for(const ms of [1000,21000,23500]) {
  const t=new StartupTimeline();t.advance(0,true);t.advance(ms,true,true);t.skip()
  const first=t.advance(ms,true,true);assert.equal(first.path,'quick');assert.equal(first.cinematic,undefined)
  assert.equal(first.sceneVisible,ms>=20160)
  assert.equal(t.advance(ms+641,true,true).phase,'done')
 }
})
test('unavailable 3D uses the quick handoff without an invisible cinematic delay', () => {
 const t=new StartupTimeline();t.advance(0,true,false)
 const state=t.advance(20500,true,false);assert.equal(state.path,'quick');assert.equal(state.cinematic,undefined)
})
test('startup playback option migrates existing profiles and belongs to the writable host schema', async () => {
 const {DEFAULTS,resolvePreferences}=await load('../src/preferences.ts')
 const {Config}=await load('../src/index.ts')
 assert.equal(DEFAULTS.startupAnimation,true)
 assert.equal(resolvePreferences({}).startupAnimation,true)
 for(const invalid of [undefined,null,'false',0])assert.equal(resolvePreferences({startupAnimation:invalid}).startupAnimation,true)
 for(const value of [false,true]){assert.equal(resolvePreferences({startupAnimation:value}).startupAnimation,value);assert.equal(Config({startupAnimation:value}).startupAnimation.get(),value)}
 const frame=await readFile(new URL('../src/client/ArchiveFrame.tsx',import.meta.url),'utf8')
 assert.match(frame,/preferencesLoaded/);assert.match(frame,/preferences.startupAnimation/)
})
