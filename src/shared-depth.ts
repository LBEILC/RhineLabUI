import * as THREE from 'three';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { BokehPass, type BokehPassParameters } from 'three/addons/postprocessing/BokehPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Emit BokehPass's original packed HalfFloat depth alongside the AO normal.
 * A raw hardware depth texture has different precision; do not substitute it.
 * The local three revision uses _renderOverride as the normal-pass extension.
 */
export class SharedDepthAO extends SSAOPass {
  private packed: THREE.Texture;
  private sharing = true;
  private savedColor = new THREE.Color();
  private depthClear = new Float32Array([1, 1, 1, 1]);
  constructor(scene: THREE.Scene, camera: THREE.Camera, width: number, height: number, kernel = 32) {
    super(scene, camera, width, height, kernel);
    this.packed = this.normalRenderTarget.texture.clone();
    this.packed.name = 'Archive.packedDepth';
    this.normalRenderTarget.textures.push(this.packed);
    this.normalMaterial.onBeforeCompile = shader => {
      if (!this.sharing) return;
      shader.vertexShader = 'varying vec2 vArchiveZW;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvArchiveZW = gl_Position.zw;');
      shader.fragmentShader = 'varying vec2 vArchiveZW;\nlayout(location = 1) out vec4 archivePackedDepth;\n#include <packing>\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'void main() {\narchivePackedDepth = packDepthToRGBA(0.5 * vArchiveZW.x / vArchiveZW.y + 0.5);');
    };
    this.normalMaterial.customProgramCacheKey = () => `archive-normal-packed-depth-v1-${this.sharing}`;
  }
  setSharing(enabled: boolean) {
    if (enabled === this.sharing) return;
    this.normalRenderTarget.dispose();
    this.sharing = enabled;
    this.normalRenderTarget.textures.length = 1;
    if (enabled) this.normalRenderTarget.textures.push(this.packed);
    this.normalMaterial.needsUpdate = true;
  }
  _renderOverride(renderer: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget, color: THREE.ColorRepresentation, alpha: number) {
    renderer.getClearColor(this.savedColor);
    const savedAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
    const override = this.scene.overrideMaterial;
    renderer.setRenderTarget(target);
    renderer.autoClear = false;
    renderer.setClearColor(color, alpha);
    renderer.clear();
    // AO's normal clear remains unchanged; the packed depth background is white.
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (this.sharing) gl.clearBufferfv(gl.COLOR, 1, this.depthClear);
    this.scene.overrideMaterial = material;
    try { renderer.render(this.scene, this.camera); }
    finally {
      this.scene.overrideMaterial = override;
      renderer.autoClear = autoClear;
      renderer.setClearColor(this.savedColor, savedAlpha);
    }
  }
}

export class SharedDepthBokeh extends BokehPass {
  private width = 1;
  private height = 1;
  private quad: FullScreenQuad;
  constructor(scene: THREE.Scene, camera: THREE.Camera, params: BokehPassParameters, private source: () => SharedDepthAO) {
    super(scene, camera, params);
    this.quad = new FullScreenQuad(this.materialBokeh);
  }
  setSize(width: number, height: number) { super.setSize(width, height); this.width = width; this.height = height; }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget, delta: number, mask: boolean) {
    const ao = this.source(), uniforms = this.uniforms as Record<string, {value: any}>;
    // Lower resolution AO must retain the original full resolution depth pass.
    if (!ao.enabled || ao.width !== this.width || ao.height !== this.height) {
      return super.render(renderer, write, read, delta, mask);
    }
    const originalDepth = uniforms.tDepth.value;
    uniforms.tDepth.value = ao.normalRenderTarget.textures[1];
    uniforms.tColor.value = read.texture;
    uniforms.nearClip.value = (this.camera as THREE.PerspectiveCamera).near;
    uniforms.farClip.value = (this.camera as THREE.PerspectiveCamera).far;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : write);
    if (!this.renderToScreen) renderer.clear();
    try { this.quad.render(renderer); }
    finally { uniforms.tDepth.value = originalDepth; renderer.autoClear = autoClear; }
  }
  dispose() { super.dispose(); this.quad.dispose(); }
}
