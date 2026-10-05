import { Vector3 } from 'three'
import type { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'

/** Avoid Three's repeating 4x4 scalar noise (only two tangent directions).
 * A stable per-pixel rotation plus a stratified kernel has no short tile period
 * and no time jitter. Filtering is performed on AO, never on the beauty image.
 */
export function stabilizeArchiveAO(pass: SSAOPass) {
  const kernel = pass.kernel
  for (let i = 0; i < kernel.length; i++) {
    const z = (i + .5) / kernel.length, radius = Math.sqrt(1 - z * z)
    const angle = i * 2.399963229728653
    const distance = ((i + .5) * .7548776662466927) % 1
    kernel[i] = new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z).multiplyScalar(.1 + .9 * distance * distance)
  }
  pass.ssaoMaterial.uniforms.kernel.value = kernel
  const shader = pass.ssaoMaterial.fragmentShader
  const start = shader.indexOf('vec2 noiseScale ='), end = shader.indexOf('float occlusion =', start)
  if (start < 0 || end < 0) throw new Error('Unsupported Three SSAO shader: archive noise hook missing')
  pass.ssaoMaterial.fragmentShader = shader.slice(0, start) + /* glsl */`
    vec2 pixel = floor(vUv * resolution);
    vec3 hash = fract(vec3(pixel.xyx) * .1031);
    hash += dot(hash, hash.yzx + 33.33);
    float angle = fract((hash.x + hash.y) * hash.z) * 6.28318530718;
    vec3 axis = abs(viewNormal.z) < .999 ? vec3(0.,0.,1.) : vec3(1.,0.,0.);
    vec3 baseTangent = normalize(cross(axis,viewNormal));
    vec3 baseBitangent = cross(viewNormal,baseTangent);
    vec3 tangent = baseTangent*cos(angle) + baseBitangent*sin(angle);
    vec3 bitangent = cross(viewNormal,tangent);
    mat3 kernelMatrix = mat3(tangent,bitangent,viewNormal);
  ` + shader.slice(end)
}
