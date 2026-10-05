import assert from 'node:assert/strict'
import { MeshoptEncoder } from 'meshoptimizer/encoder'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/** Transport compression only: no quantization, topology changes or index
 * reordering. Verify every decoded byte with the decoder shipped in the app.
 */
export async function compressModel(source) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  assert.equal(source.readUInt32LE(0), 0x46546c67)
  const jsonLength = source.readUInt32LE(12)
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString())
  assert.equal(json.buffers.length, 1)
  assert.ok(!json.extensionsUsed?.includes('EXT_meshopt_compression'))
  const binary = source.subarray(28 + jsonLength)
  const parts = []
  let offset = 0
  for (let index = 0; index < json.bufferViews.length; index++) {
    const view = json.bufferViews[index]
    const accessors = json.accessors.filter(a => a.bufferView === index)
    assert.ok(accessors.length, 'Unexpected non-geometry buffer view')
    const accessor = accessors[0]
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type]
    const bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType]
    const stride = view.byteStride ?? components * bytes
    assert.ok(stride > 0 && view.byteLength % stride === 0)
    const mode = view.target === 34963 ? 'INDICES' : 'ATTRIBUTES'
    const count = view.byteLength / stride
    const original = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    // INDICES preserves exact index order, including the starting vertex of triangles.
    const encoded = MeshoptEncoder.encodeGltfBuffer(original, count, stride, mode)
    const decoded = new Uint8Array(view.byteLength)
    MeshoptDecoder.decodeGltfBuffer(decoded, count, stride, encoded, mode, 'NONE')
    assert.deepEqual(Buffer.from(decoded), original, `Buffer view ${index} is not lossless`)
    view.buffer = 1
    view.extensions = { ...view.extensions, EXT_meshopt_compression: {
      buffer: 0, byteOffset: offset, byteLength: encoded.length, byteStride: stride, count, mode, filter: 'NONE',
    } }
    parts.push(Buffer.from(encoded)); offset += encoded.length
    const pad = (4 - offset % 4) % 4
    if (pad) { parts.push(Buffer.alloc(pad)); offset += pad }
  }
  json.extensionsUsed = [...(json.extensionsUsed ?? []), 'EXT_meshopt_compression']
  json.extensionsRequired = [...(json.extensionsRequired ?? []), 'EXT_meshopt_compression']
  json.buffers = [{ byteLength: offset }, { byteLength: json.buffers[0].byteLength, extensions: { EXT_meshopt_compression: { fallback: true } } }]
  const text = Buffer.from(JSON.stringify(json)), pad = (4 - text.length % 4) % 4
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(28 + text.length + pad + offset, 8)
  header.writeUInt32LE(text.length + pad, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(offset, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, text, Buffer.alloc(pad, 32), binHeader, ...parts])
}
