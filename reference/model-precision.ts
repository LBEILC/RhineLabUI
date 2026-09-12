import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ArchiveScene } from '../src/scene';

export type Precision = 'high' | 'medium' | 'low';
const medium = new Set(['Titanium_Fasteners', 'Ivory_Edges']);
const low = new Set([...medium, 'Internal_Ceramic', 'Optical_Edges', 'Subsurface_Optics',
  'Optical_Film_Edge', 'Amber_Optical_Inlay', 'Case_Engraving', 'Case_Engraving_Highlight', 'Moulded_Lettering']);
const canonical = (name: string) => name.replace(/(?:\.\d+)+$/, '');

// Experimental geometry substitution only. The application still supplies all
// materials, lighting, animation, instancing and postprocessing unchanged.
export async function applyPrecision(scene: ArchiveScene, tier: Precision) {
  const internal = scene as any;
  const replaced: string[] = [];
  if (tier !== 'high') {
    const gltf = await new GLTFLoader().loadAsync(new URL(`/reference/model-precision/${tier}.glb`, document.baseURI).href);
    gltf.scene.updateMatrixWorld(true);
    const geometry = new Map<string, THREE.BufferGeometry>();
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const name = canonical((object.material as THREE.Material).name);
      if (geometry.has(name)) throw new Error(`Duplicate precision surface: ${name}`);
      geometry.set(name, object.geometry.clone().applyMatrix4(object.matrixWorld));
    });
    const changed = tier === 'medium' ? medium : low;
    const replace = (object: THREE.Mesh, array: boolean) => {
      const name = canonical((object.material as THREE.Material).name);
      if (!changed.has(name)) return;
      const source = geometry.get(name);
      if (!source) throw new Error(`Missing precision surface: ${name}`);
      const next = source.clone();
      const before = object.geometry;
      before.computeBoundingBox(); next.computeBoundingBox();
      const delta = before.boundingBox!.min.distanceTo(next.boundingBox!.min)
        + before.boundingBox!.max.distanceTo(next.boundingBox!.max);
      if (delta > .035) throw new Error(`Precision changes bounds: ${name}, ${delta}`);
      if (array) next.setAttribute('archiveTheme', internal.themeAttribute);
      object.geometry = next;
      replaced.push(`${array ? 'array' : 'selected'}:${name}`);
    };
    for (const instance of internal.instances) replace(instance, true);
    if (tier === 'low') internal.model.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) replace(object, false);
    });
    for (const value of geometry.values()) value.dispose();
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    });
    internal.renderState?.invalidate();
    scene.resize();
  }
  const triangles = (object: THREE.Mesh) => (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
  return { tier, replaced,
    arrayTriangles: internal.instances.reduce((sum: number, o: THREE.Mesh) => sum + triangles(o), 0),
    selectedTriangles: internal.model.children.filter((o: any) => o.isMesh).reduce((sum: number, o: THREE.Mesh) => sum + triangles(o), 0),
  };
}
