import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { compressModel } from '../scripts/compress-model.mjs'
import * as THREE from 'three'

async function source(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { archiveWave, smooth } = await source('../src/client/rhine/motion.ts')
const { ThemeWave } = await source('../src/client/rhine/theme-motion.ts')
const { ArchiveDrawCoverage, ArchiveShadowCoverage } = await source('../src/client/rhine/archive-draw-coverage.ts')

test('colour coverage keeps edge-straddling cards; offscreen shadows keep their own full buffer', () => {
  const camera=new THREE.PerspectiveCamera(45,16/9,1,100)
  camera.position.set(0,0,20);camera.updateMatrixWorld()
  const coverage=new ArchiveDrawCoverage();coverage.update(camera)
  assert.equal(coverage.contains(0,-2,0),true)
  assert.equal(coverage.contains(100,-2,0),false)
  const halfWidth=Math.tan(Math.PI/8)*20*16/9
  assert.equal(coverage.contains(halfWidth+2,-2,0),true)
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial()
  const source=new THREE.InstancedMesh(geometry,material,1);source.castShadow=true
  const shadow=new ArchiveShadowCoverage(source),matrix=new THREE.Matrix4()
  shadow.begin();shadow.add(matrix);shadow.add(matrix.makeTranslation(100,0,0))
  assert.equal(shadow.commit(),true);assert.equal(shadow.mesh.count,2)
  assert.equal(source.castShadow,false);assert.notEqual(shadow.mesh.instanceMatrix,source.instanceMatrix)
  shadow.mesh.onBeforeRender();assert.equal(shadow.mesh.count,0)
  shadow.mesh.onAfterRender();assert.equal(shadow.mesh.count,2)
  assert.equal(shadow.mesh.instanceMatrix.array[28],100)
  shadow.begin();shadow.add(matrix.identity());shadow.add(matrix.makeTranslation(100,0,0))
  assert.equal(shadow.commit(),false)
  shadow.begin();shadow.add(matrix.identity());assert.equal(shadow.commit(),true);assert.equal(shadow.mesh.count,1)
  shadow.mesh.dispose();source.dispose();geometry.dispose();material.dispose()
})

test('skip only the exactly zero scan envelope, including both boundary neighbourhoods', () => {
  const bell = (x,w) => Math.exp(-.5*(x/w)**2)
  const original = (row,lane,time) => {
    const t=time-22, phase=row+(lane-2)*.65, packet=x=>2.5*bell(x,3.8)-.58*bell(x-6,3.5)
    return smooth(t/.32)*(packet(phase-(3+t*19))*(1-smooth((t-2.15)/.65))+packet(phase-(32-(t-2.3)*24))*smooth((t-2.17)/.32)*(1-smooth((t-3.5)/.85)))
  }
  for (const t of [0,21.9,22-1e-10,22,22+1e-10,23,24,25.5,26.35-1e-10,26.35,26.35+1e-10,30,1000])
    for (let lane=-4;lane<9;lane++) for(let row=-20;row<60;row+=.5)
      assert.ok(Math.abs(archiveWave(row,lane,t)-original(row,lane,t))<1e-14)
})

test('settled theme shortcuts preserve interrupted, reversed and newly visible cells', () => {
  const wave = new ThemeWave(), origin={row:12,lane:2}, distant={row:120,lane:9}
  wave.set(true,10,origin)
  wave.beginFrame(); const near = wave.sample(origin,10.4), far=wave.sample(distant,10.4)
  assert.ok(near>far)
  wave.set(false,10.4,origin)
  assert.equal(wave.sample(origin,10.4),near)
  assert.equal(wave.sample(distant,10.4),far)
  wave.beginFrame(); assert.equal(wave.sample(origin,12),0); assert.equal(wave.sample(distant,12),0)
  wave.set(true,12,origin)
  assert.equal(wave.sample(origin,12),0)
  wave.beginFrame(); assert.equal(wave.sample(distant,14),1)
  wave.set(false,14,origin)
  assert.equal(wave.sample({row:-300,lane:-20},14),1)
})

test('both bundled models round-trip every byte and retain all scene/material/accessor definitions', async () => {
  for (const name of ['archive-cassette.glb','optical-archive.glb']) {
    const original=await readFile(new URL(`../assets/${name}`,import.meta.url)), packed=await compressModel(original)
    const json=b=>JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())
    const a=json(original),b=json(packed)
    for (const key of ['accessors','meshes','materials','nodes','scenes','textures','images']) assert.deepEqual(b[key],a[key])
    assert.ok(packed.length < original.length*.7)
    assert.equal(packed.readUInt32LE(8),packed.length)
  }
})
