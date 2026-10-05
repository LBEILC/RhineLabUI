import * as THREE from 'three'
import { InstanceUpdates } from './instance-updates.ts'

/** Colour/transmission/normal passes need only the actual camera frustum.
 * The wider existing archive pool remains intact for offscreen shadow casters.
 */
export class ArchiveDrawCoverage {
  private frustum = new THREE.Frustum()
  private matrix = new THREE.Matrix4()
  private box = new THREE.Box3()
  update(camera: THREE.PerspectiveCamera) {
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.matrix)
  }
  contains(x: number, y: number, z: number) {
    // Same conservative card bounds as the original pool, including its lean.
    this.box.min.set(x - 2.8, y - .3, z - 1.2)
    this.box.max.set(x + 2.8, y + 4.1, z + 1.2)
    return this.frustum.intersectsBox(this.box)
  }
}

export class ArchiveShadowCoverage {
  readonly mesh: THREE.InstancedMesh
  private updates: InstanceUpdates
  private count = 0
  constructor(source: THREE.InstancedMesh) {
    this.mesh = new THREE.InstancedMesh(source.geometry, source.material, source.instanceMatrix.count)
    this.mesh.name = 'archive-shadow-coverage'
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
    this.mesh.userData.excludeFromAO = true
    this.mesh.userData.shadowOnly = true
    // Three invokes separate onBeforeShadow/onBeforeRender hooks. Preserve full
    // shadow coverage, submit zero colour triangles, then restore the public count.
    this.mesh.onBeforeRender = () => { this.mesh.count = 0 }
    this.mesh.onAfterRender = () => { this.mesh.count = this.count }
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.updates = new InstanceUpdates(this.mesh.instanceMatrix)
    source.castShadow = false
  }
  begin() { this.count = 0 }
  add(matrix: THREE.Matrix4) {
    if (this.count === this.mesh.instanceMatrix.count) {
      const old = this.mesh.instanceMatrix
      this.mesh.dispose()
      this.mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(old.array.length * 2), 16).setUsage(THREE.DynamicDrawUsage)
      this.mesh.instanceMatrix.array.set(old.array)
      this.updates = new InstanceUpdates(this.mesh.instanceMatrix)
    }
    this.updates.set(this.count++ * 16, matrix.elements)
  }
  commit() {
    const countChanged = this.mesh.count !== this.count
    this.mesh.count = this.count
    return this.updates.commit() || countChanged
  }
}
