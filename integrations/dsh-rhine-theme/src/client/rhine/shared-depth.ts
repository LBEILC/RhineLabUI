import * as THREE from 'three';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { BokehPass, type BokehPassParameters } from 'three/addons/postprocessing/BokehPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { stabilizeArchiveAO } from './archive-occlusion.ts';

/** Full-resolution geometry depth, independently scaled AO and depth-aware filtering.
 * Legacy Bokeh can share its packed depth attachment when explicitly enabled.
 * The local Three revision uses _renderOverride as the normal-pass extension.
 */
export class SharedDepthAO extends SSAOPass {
  private packed: THREE.Texture;
  private sharing = true;
  private savedColor = new THREE.Color();
  private depthClear = new Float32Array([1, 1, 1, 1]);
  private resolutionScale = 1;
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, width: number, height: number, kernel = 32) {
    super(scene, camera, width, height, kernel);
    // These two passes cover the screen and only read the normal target's depth.
    // Keep RGBA16F colour precision, but allocate no unused depth attachments.
    this.ssaoRenderTarget.depthBuffer = false;
    this.blurRenderTarget.depthBuffer = false;
    stabilizeArchiveAO(this);
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
    const depth = { value: this.normalRenderTarget.depthTexture };
    const near = { value: camera.near }, far = { value: camera.far };
    Object.assign(this.blurMaterial.uniforms, { archiveDepth: depth, archiveNormal: { value: this.normalRenderTarget.texture }, archiveNear: near, archiveFar: far });
    // Filter only occlusion. Depth discontinuities must not blur model silhouettes.
    this.blurMaterial.fragmentShader = /* glsl */`
      uniform sampler2D tDiffuse, archiveDepth, archiveNormal;
      uniform vec2 resolution;
      uniform float archiveNear, archiveFar;
      varying vec2 vUv;
      #include <packing>
      float z(vec2 uv) { return perspectiveDepthToViewZ(texture2D(archiveDepth,uv).x,archiveNear,archiveFar); }
      void main() {
        float center = z(vUv), value = 0.0, total = 0.0;
        vec3 normal = unpackRGBToNormal(texture2D(archiveNormal,vUv).xyz);
        for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++) {
          vec2 uv = vUv + vec2(float(x),float(y))/resolution;
          vec3 sampleNormal = unpackRGBToNormal(texture2D(archiveNormal,uv).xyz);
          float w = exp(-abs(z(uv)-center)*12.0 - float(x*x+y*y)/4.5);
          w *= pow(max(dot(normal,sampleNormal),0.0),16.0);
          value += texture2D(tDiffuse,uv).r*w; total += w;
        }
        gl_FragColor = vec4(vec3(value/max(total,.00001)),1.0);
      }
    `;
    Object.assign(this.copyMaterial.uniforms, {
      archiveDepth: depth, archiveNear: near, archiveFar: far,
      archiveAOSize: { value: new THREE.Vector2(width, height) },
    });
    this.copyMaterial.fragmentShader = /* glsl */`
      uniform sampler2D tDiffuse, archiveDepth;
      uniform vec2 archiveAOSize;
      uniform float archiveNear, archiveFar, opacity;
      varying vec2 vUv;
      #include <packing>
      float z(vec2 uv) { return perspectiveDepthToViewZ(texture2D(archiveDepth,uv).x,archiveNear,archiveFar); }
      void main() {
        vec2 p = vUv*archiveAOSize-.5, f=fract(p), base=(floor(p)+.5)/archiveAOSize;
        float center=z(vUv), value=0.0, total=0.0;
        for(int y=0;y<=1;y++) for(int x=0;x<=1;x++) {
          vec2 uv=base+vec2(float(x),float(y))/archiveAOSize;
          float w=mix(1.0-f.x,f.x,float(x))*mix(1.0-f.y,f.y,float(y));
          w *= exp(-abs(z(uv)-center)*12.0);
          value += texture2D(tDiffuse,uv).r*w; total += w;
        }
        float ao = total>.00001 ? value/total : 1.0;
        gl_FragColor=vec4(vec3(ao),1.0)*opacity;
      }
    `;
  }
  setResolutionScale(value: number) { this.resolutionScale = value; }
  setSize(width: number, height: number) {
    super.setSize(width, height);
    const w = Math.max(1, Math.floor(width * (this.resolutionScale ?? 1)));
    const h = Math.max(1, Math.floor(height * (this.resolutionScale ?? 1)));
    this.ssaoRenderTarget.setSize(w, h); this.blurRenderTarget.setSize(w, h);
    this.ssaoMaterial.uniforms.resolution.value.set(w, h);
    this.blurMaterial.uniforms.resolution.value.set(w, h);
    this.copyMaterial.uniforms.archiveAOSize?.value.set(w, h);
  }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    // SSAOPass normally refreshes these only on resize; this camera changes FOV in flight.
    const uniforms = this.ssaoMaterial.uniforms, camera = this.camera as THREE.PerspectiveCamera;
    uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
    uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
    uniforms.cameraNear.value = camera.near; uniforms.cameraFar.value = camera.far;
    this.blurMaterial.uniforms.archiveNear.value = camera.near;
    this.blurMaterial.uniforms.archiveFar.value = camera.far;
    const hidden: THREE.Object3D[] = [];
    this.scene.traverseVisible(object => { if (object.userData.excludeFromAO) hidden.push(object); });
    for (const object of hidden) object.visible = false;
    try { super.render(renderer, write, read, 0, false); }
    finally { for (const object of hidden) object.visible = true; }
  }
  dispose() {
    super.dispose(); this.ssaoMaterial.dispose(); this.noiseTexture.dispose(); this.packed.dispose();
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
    if (!ao.enabled || !ao.normalRenderTarget.textures[1] || ao.width !== this.width || ao.height !== this.height) {
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
