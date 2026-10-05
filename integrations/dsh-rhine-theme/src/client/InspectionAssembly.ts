import * as THREE from 'three'
import type { ArchiveScene } from './rhine/scene.ts'

/** The same archive opens into its actual optical parts while inspecting it. */
export class InspectionAssembly {
  private value = 0
  private active = false
  private disposed = false
  private loading = false
  private asset?: Awaited<ReturnType<ArchiveScene['createAssemblyModel']>>
  private matrix = new THREE.Matrix4()
  private origins = new Map<THREE.Object3D, THREE.Vector3>()
  private offsets: Record<string, [number, number, number]> = {
    cover: [0, .12, .92], carrier: [0, .04, .28], substrate: [0, -.1, -.65],
    'optical-core': [0, 0, -.16], 'optical-lenses': [0, .08, .55], fasteners: [.12, .12, .7],
  }
  constructor(private archive: ArchiveScene, private wake: () => void) {}
  setActive(active: boolean) {
    this.active = active
    if (!active || this.asset || this.loading || this.disposed) return
    this.loading = true
    void this.archive.createAssemblyModel().then(asset => {
      if (this.disposed) { asset.dispose(); return }
      this.asset = asset
      asset.model.name = 'rhine-inspection-assembly'; asset.model.visible = false
      for (const child of asset.model.children) this.origins.set(child, child.position.clone())
      this.archive.scene.add(asset.model); this.wake()
    }).catch(error => { if (!this.disposed) console.warn('Rhine optical assembly unavailable', error) }).finally(() => { this.loading = false })
  }
  update(dt: number, reduced: boolean) {
    if (!this.asset) return false
    const previous = this.value, target = this.active ? 1 : 0
    this.value = reduced ? target : THREE.MathUtils.damp(this.value, target, 5.8, dt)
    if (Math.abs(this.value - target) < .0001) this.value = target
    const visible = this.value > 0
    const changed = previous !== this.value || visible !== this.asset.model.visible
    this.asset.model.visible = visible
    this.archive.showCassette(!visible)
    if (!visible) return changed
    this.archive.cardTransform(this.matrix).decompose(this.asset.model.position, this.asset.model.quaternion, this.asset.model.scale)
    this.asset.setClarity(.58 + this.value * .35)
    this.asset.setTheme(this.archive.themeAmount)
    for (const child of this.asset.model.children) {
      child.position.copy(this.origins.get(child)!)
      const offset = this.offsets[child.userData.assemblyPart]
      if (offset) {
        child.position.x += offset[0] * this.value
        child.position.y += offset[1] * this.value
        child.position.z += offset[2] * this.value
      }
    }
    return changed
  }
  dispose() { this.disposed = true; this.archive.showCassette(true); if (this.asset) { this.archive.scene.remove(this.asset.model); this.asset.dispose() }; this.origins.clear() }
}
