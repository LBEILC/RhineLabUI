import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/** Original screen finish; no reference artwork or shaders are bundled. */
export function createScreenFinish() {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, grain: { value: 0 }, fringe: { value: 0 }, vignette: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float grain;uniform float fringe;uniform float vignette;varying vec2 vUv;
      void main(){
        vec2 p=vUv-.5;
        vec2 offset=p*dot(p,p)*fringe*.002;
        vec4 base=texture2D(tDiffuse,vUv);
        vec3 color=vec3(texture2D(tDiffuse,clamp(vUv+offset,0.,1.)).r,base.g,texture2D(tDiffuse,clamp(vUv-offset,0.,1.)).b);
        float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
        color+=noise*grain*.025;
        color*=1.-vignette*.3*smoothstep(.12,.5,dot(p,p));
        gl_FragColor=vec4(max(color,vec3(0.)),base.a);
      }`,
  });
  pass.enabled = false;
  return pass;
}
