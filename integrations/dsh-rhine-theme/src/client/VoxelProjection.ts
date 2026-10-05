import * as THREE from 'three'
import type { ArchiveScene } from './rhine/scene.ts'
import { projectionIsMoving } from './projection-motion.ts'

/** The 960 cube trajectories run in the vertex shader. CPU work is constant per frame. */
export class VoxelProjection {
  private readonly mesh: THREE.InstancedMesh
  private readonly center = new THREE.Vector3()
  private progress = 0
  private targetProgress = 0
  private reduced = false
  private dirty = true
  private panel: HTMLElement | null = null
  private wasMoving = false
  private readonly uniforms = {
    archiveProgress: { value: 0 },
    archiveCard: { value: new THREE.Matrix4() },
    archiveCamera: { value: new THREE.Matrix4() },
    archiveProjectionInverse: { value: new THREE.Matrix4() },
    archiveCameraPosition: { value: new THREE.Vector3() },
    archiveForward: { value: new THREE.Vector3() },
    archiveDepth: { value: 1 },
    archiveBounds: { value: new THREE.Vector4(.39, .17, .57, .74) },
    archiveBase: { value: new THREE.Color('#adab9e') },
    archiveAccent: { value: new THREE.Color('#8d6b39') },
  }
  constructor(private archive: ArchiveScene, private host: HTMLElement) {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const grid = new Float32Array(960 * 3), colors = new Float32Array(960)
    for (let i = 0; i < 960; i++) {
      grid.set([i % 40 / 39, Math.floor(i / 40) / 23, ((i * 73 + 19) % 997) / 997], i * 3)
      colors[i] = i % 6 === 0 ? 1 : 0
    }
    geometry.setAttribute('archiveGrid', new THREE.InstancedBufferAttribute(grid, 3))
    geometry.setAttribute('archiveColor', new THREE.InstancedBufferAttribute(colors, 1))
    const material = new THREE.MeshPhysicalMaterial({
      color: '#d5c7a9', roughness: .38, metalness: .32, transparent: true,
      opacity: .7, depthWrite: false, envMapIntensity: .55,
    })
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms)
      shader.vertexShader = /* glsl */`
        attribute vec3 archiveGrid;
        attribute float archiveColor;
        varying float vArchiveColor;
        uniform float archiveProgress, archiveDepth;
        uniform mat4 archiveCard, archiveCamera, archiveProjectionInverse;
        uniform vec3 archiveCameraPosition, archiveForward;
        uniform vec4 archiveBounds;
        float archiveSmooth(float t) { t = clamp(t, 0.0, 1.0); return t*t*(3.0-2.0*t); }
      ` + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', /* glsl */`
        float phase = clamp((archiveProgress - archiveGrid.z * .16) / .84, 0.0, 1.0);
        float travel = archiveSmooth(phase);
        float drift = sin(3.14159265359 * phase);
        float ax = drift * archiveGrid.z * 3.0, ay = drift * (1.0-archiveGrid.z) * 4.0;
        float cx = cos(ax), sx = sin(ax), cy = cos(ay), sy = sin(ay);
        mat3 cubeRotation = mat3(cy, sx*sy, -cx*sy, 0.0, cx, sx, sy, -sx*cy, cx*cy);
        #include <beginnormal_vertex>
        objectNormal = cubeRotation * objectNormal;
      `)
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', /* glsl */`
        vec2 uv = archiveGrid.xy;
        vec3 origin = (archiveCard * vec4((uv.x-.5)*4.4, .28+(1.0-uv.y)*3.12, .3, 1.0)).xyz;
        vec2 screen = archiveBounds.xy + uv * archiveBounds.zw;
        vec4 view = archiveProjectionInverse * vec4(screen.x*2.0-1.0, 1.0-screen.y*2.0, .5, 1.0);
        vec3 ray = (archiveCamera * vec4(view.xyz / view.w, 1.0)).xyz - archiveCameraPosition;
        vec3 target = archiveCameraPosition + ray * (archiveDepth / max(.0001, dot(ray, archiveForward)));
        vec3 point = mix(origin, target, travel);
        point.y += drift * (.18 + archiveGrid.z * .58);
        point.x += drift * (archiveGrid.z - .5) * .65;
        float edge = float(uv.x < .001 || uv.x > .999 || uv.y < .001 || uv.y > .999);
        float index = floor(uv.x*39.0+.5) + 40.0*floor(uv.y*23.0+.5);
        float hold = edge * float(mod(index, 3.0) < .5) * .23;
        float size = .033 * ((1.0-archiveSmooth((phase-.66)/.34))*sin(min(1.0,phase*5.0)*1.57079632679) + hold*travel);
        vec3 transformed = point + cubeRotation * position * size;
        vArchiveColor = archiveColor;
      `)
      shader.fragmentShader = 'varying float vArchiveColor; uniform vec3 archiveBase, archiveAccent;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(archiveBase, archiveAccent, vArchiveColor);')
    }
    material.customProgramCacheKey = () => 'rhine-voxel-gpu-v1'
    this.mesh = new THREE.InstancedMesh(geometry, material, 960)
    this.mesh.name = 'rhine-voxel-projection'
    this.mesh.userData.excludeFromAO = true
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    archive.scene.add(this.mesh)
    this.measure()
  }
  measure() {
    const panel = this.host.parentElement?.querySelector<HTMLElement>('.rh-body')
    if (!panel) return
    this.panel = panel
    const rect = panel.getBoundingClientRect(), scene = this.host.getBoundingClientRect()
    if (!scene.width || !scene.height) return
    this.uniforms.archiveBounds.value.set((rect.left-scene.left)/scene.width, (rect.top-scene.top)/scene.height, rect.width/scene.width, rect.height/scene.height)
    this.dirty = true
  }
  enter() { this.targetProgress = 1; this.progress = 0; this.dirty = true; this.measure() }
  leave() { this.targetProgress = 0 }
  configure(reduced: boolean, dark: boolean) {
    this.reduced = reduced
    this.uniforms.archiveBase.value.set(dark ? '#e3ded0' : '#adab9e')
    this.uniforms.archiveAccent.value.set(dark ? '#edc388' : '#8d6b39')
    this.dirty = true
  }
  get amount() { return this.progress }
  update(dt: number, visibility: number) {
    const moving = this.panel !== null && projectionIsMoving(this.panel)
    // Transform animation does not fire ResizeObserver. Track its visual bounds
    // only while it is moving, in the existing scene loop, then sample the end.
    if (moving || this.wasMoving) this.measure()
    this.wasMoving = moving
    const previous = this.progress, wasVisible = this.mesh.visible
    if (this.reduced) this.progress = this.targetProgress
    else if (!this.targetProgress) this.progress = Math.max(0, this.progress-dt*2.3)
    else if (visibility > .65) this.progress = Math.min(1, this.progress+dt/1.02)
    this.mesh.visible = !this.reduced && this.progress > .001
    const changed = this.dirty || previous !== this.progress || wasVisible !== this.mesh.visible
    this.dirty = false
    if (!this.mesh.visible) return changed
    const u = this.uniforms, camera = this.archive.camera
    u.archiveProgress.value = this.progress
    this.archive.cardTransform(u.archiveCard.value)
    camera.getWorldDirection(u.archiveForward.value)
    this.center.set(0, 1.85, .3).applyMatrix4(u.archiveCard.value)
    u.archiveDepth.value = this.center.sub(camera.position).dot(u.archiveForward.value)*.86
    u.archiveCamera.value.copy(camera.matrixWorld)
    u.archiveProjectionInverse.value.copy(camera.projectionMatrixInverse)
    u.archiveCameraPosition.value.copy(camera.position)
    return changed
  }
  dispose() {
    this.archive.scene.remove(this.mesh)
    this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose()
  }
}
