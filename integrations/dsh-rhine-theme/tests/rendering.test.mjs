import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'

async function source(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const { desktopQuality, renderDimensions } = await source('../src/client/rhine/render-quality.ts')
const { VoxelProjection } = await source('../src/client/VoxelProjection.ts')
const { RenderState } = await source('../src/client/rhine/render-state.ts')
const { InstanceUpdates } = await source('../src/client/rhine/instance-updates.ts')
const { FramePacing } = await source('../src/client/rhine/frame-pacing.ts')
const { frontToBack } = await source('../src/client/rhine/instance-order.ts')

test('GPU pacing bounds queued frames without waiting and recovers after a failed fence', () => {
  const pending = new Map(), waits = [], deleted = []
  let id = 0
  const gl = { TIMEOUT_EXPIRED: 1, SYNC_GPU_COMMANDS_COMPLETE: 2,
    fenceSync: () => { const key = ++id; pending.set(key, 1); return key },
    clientWaitSync: (key, flags, timeout) => { waits.push([flags, timeout]); return pending.get(key) },
    deleteSync: key => { deleted.push(key); pending.delete(key) },
  }
  const pacing = new FramePacing(gl)
  assert.equal(pacing.canSubmit(), true); pacing.submitted(); pacing.submitted()
  assert.equal(pacing.canSubmit(), false)
  pending.set(1, 3); assert.equal(pacing.canSubmit(), true)
  pacing.submitted(); pending.set(2, 4); assert.equal(pacing.canSubmit(), true)
  assert.ok(waits.every(([flags, timeout]) => flags === 0 && timeout === 0))
  pacing.dispose(); assert.equal(pending.size, 0); assert.deepEqual(deleted, [1,2,3])
})

test('front-to-back packing preserves every archive identity and follows a reversed camera', () => {
  const cells = [{lane:0,row:3},{lane:1,row:1},{lane:0,row:1}], original = [...cells]
  const view = new THREE.Matrix4().elements
  const ordered = frontToBack(cells, view)
  assert.deepEqual(cells, original); assert.deepEqual(new Set(ordered), new Set(cells))
  assert.deepEqual(ordered.map(c => c.row), [3,1,1])
  view[10] = -1
  assert.deepEqual(frontToBack(cells, view).map(c => c.row), [1,1,3])
})

test('subpixel residue can sleep while accumulated movement and exact resource revisions invalidate', () => {
  const state = new RenderState()
  state.begin(); state.floats(0); state.add(16_777_216); assert.equal(state.end(), true)
  state.begin(); state.floats(.0000004); state.add(16_777_216); assert.equal(state.end(), false)
  state.begin(); state.floats(.0000008); state.add(16_777_216); assert.equal(state.end(), false)
  state.begin(); state.floats(.0000012); state.add(16_777_216); assert.equal(state.end(), true)
  state.begin(); state.floats(.0000012); state.add(16_777_217); assert.equal(state.end(), true)
  const attribute = new THREE.InstancedBufferAttribute(new Float32Array(16), 16)
  const updates = new InstanceUpdates(attribute)
  updates.set(0, [.0000004]); assert.equal(updates.commit(), false)
  updates.set(0, [.0000012]); assert.equal(updates.commit(), true)
  assert.equal(attribute.updateRanges[0].count, 1)
})

test('desktop retains native detail on 1440p and high-DPI 1080p, with a bounded 4K budget', () => {
  for (const quality of Object.values(desktopQuality)) {
    const native = renderDimensions(quality, 2560, 1440, 1, 1, 16384)
    assert.equal(native.width, 2560); assert.equal(native.height, 1440)
    const retina = renderDimensions(quality, 1920, 1080, 1, 2, 16384)
    assert.equal(retina.width, 3840); assert.equal(retina.height, 2160)
    const huge = renderDimensions(quality, 7680, 4320, 1, 2, 16384)
    assert.ok(huge.limited); assert.ok(huge.width * huge.height <= 8_294_400)
  }
})

test('voxel animation performs no per-frame instance uploads and settles without redraw requests', () => {
  const camera = new THREE.PerspectiveCamera(30, 16/9, 5, 300)
  camera.position.set(0, 0, 20); camera.updateMatrixWorld()
  const scene = new THREE.Scene(), card = new THREE.Matrix4()
  const projection = new VoxelProjection({ scene, camera, cardTransform: target => target.copy(card) }, { parentElement: null })
  const mesh = scene.children[0], version = mesh.instanceMatrix.version
  const matrices = Array.from(mesh.instanceMatrix.array)
  projection.enter()
  for (let i=0; i<90; i++) projection.update(1/60, 1)
  assert.equal(projection.amount, 1)
  assert.equal(projection.update(1/60, 1), false)
  assert.equal(mesh.instanceMatrix.version, version)
  assert.deepEqual(Array.from(mesh.instanceMatrix.array), matrices)
  assert.equal(mesh.instanceColor, null)
  projection.leave()
  for (let i=0; i<35; i++) projection.update(1/60, 1)
  assert.equal(projection.amount, 0); assert.equal(mesh.visible, false)
  projection.configure(true, false); projection.enter(); projection.update(1/60, 1)
  assert.equal(projection.amount, 1); assert.equal(mesh.visible, false)
  projection.dispose(); assert.equal(scene.children.length, 0)
})

test('archive AO removes short repeating noise and preserves depth/normal edge filtering', async () => {
  const { SharedDepthAO } = await source('../src/client/rhine/shared-depth.ts')
  const make = samples => new SharedDepthAO(new THREE.Scene(), new THREE.PerspectiveCamera(30,1,1,100), 800, 600, samples)
  const a=make(16),b=make(16),high=make(32)
  try {
    assert.deepEqual(a.kernel.map(v=>v.toArray()),b.kernel.map(v=>v.toArray()))
    assert.equal(high.kernel.length,32)
    assert.ok(a.kernel.every(v=>v.z>0&&v.length()<=1&&v.length()>=.1))
    assert.doesNotMatch(a.ssaoMaterial.fragmentShader,/texture2D\( tNoise|noiseScale/)
    assert.match(a.ssaoMaterial.fragmentShader,/floor\(vUv \* resolution\)/)
    assert.match(a.blurMaterial.fragmentShader,/y=-2;y<=2/)
    assert.ok(a.blurMaterial.uniforms.archiveNormal.value===a.normalRenderTarget.texture)
    a.setResolutionScale(.5);a.setSize(800,600)
    assert.equal(a.normalRenderTarget.width,800);assert.equal(a.ssaoRenderTarget.width,400)
    assert.deepEqual(a.copyMaterial.uniforms.archiveAOSize.value.toArray(),[400,300])
  } finally { a.dispose(); b.dispose(); high.dispose() }
})
