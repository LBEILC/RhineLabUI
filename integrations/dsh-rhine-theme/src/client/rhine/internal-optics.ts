import * as THREE from "three";

const surfaces: Record<
  string,
  { color: string; roughness: number; opacity: number; order: number }
> = {
  Optical_Glass_Body: {
    color: "#929894",
    roughness: 0.38,
    opacity: 0.27,
    order: 20,
  },
  Optical_Glass_Roof: {
    color: "#929b94",
    roughness: 0.34,
    opacity: 0.42,
    order: 24,
  },
  Optical_Glass_Edge: {
    color: "#edf0e7",
    roughness: 0.19,
    opacity: 0.9,
    order: 28,
  },
  Optical_Bridge_Glass: {
    color: "#a0aca2",
    roughness: 0.32,
    opacity: 0.36,
    order: 26,
  },
};

export function configureInternalOptics(
  name: string,
  mat: THREE.MeshPhysicalMaterial,
) {
  const surface = surfaces[name];
  if (!surface) return;
  mat.color.set(surface.color);
  mat.roughness = surface.roughness;
  mat.metalness = 0.015;
  mat.clearcoat = 0.42;
  mat.clearcoatRoughness = 0.24;
  mat.opacity = surface.opacity;
  // Three's outer transmission pass samples its opaque capture and omits other
  // transmissive meshes. Composite these thin frosted layers into that capture
  // with explicit alpha blending, after the opaque ribs/substrate. The exterior
  // cover can then refract the complete interior in both scenes.
  mat.transmission = 0;
  mat.transparent = false;
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.SrcAlphaFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.blendSrcAlpha = THREE.OneFactor;
  mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  mat.depthWrite = false;
  // These are closed volumes; rendering both shell faces doubles their density.
  mat.side = THREE.FrontSide;
  mat.userData.opticalOrder = surface.order;
}

export function internalOpticsFragment(source: string) {
  // Grazing edges accumulate density while the face stays lightly frosted.
  return source.replace(
    "#include <opaque_fragment>",
    `diffuseColor.a = min(0.86, opacity + 0.42 * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0));
     #include <opaque_fragment>`,
  );
}
