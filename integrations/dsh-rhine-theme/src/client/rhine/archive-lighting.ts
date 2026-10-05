import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type LightingLook = "baseline" | "refined";

// The archive and its independent viewer use the same studio illumination.
// Each renderer needs its own PMREM render target / WebGL texture.
export function createArchiveLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  look: LightingLook = "baseline",
) {
  const refined = look === "refined";
  renderer.toneMappingExposure = refined ? 1.0 : 1.05;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environmentIntensity = refined ? 0.52 : 0.48;
  scene.add(
    new THREE.HemisphereLight(
      "#fffaf5",
      refined ? "#b49b80" : "#b4a18c",
      refined ? 0.5 : 0.65,
    ),
  );
  const key = new THREE.DirectionalLight(
    refined ? "#fff4e5" : "#fff7ed",
    refined ? 1.7 : 1.4,
  );
  key.position.set(
    ...((refined ? [-8, 14, 4] : [-6, 14, -5]) as [number, number, number]),
  );
  const fill = new THREE.DirectionalLight("#ffffff", refined ? 0.3 : 0.6);
  fill.position.set(7, 8, -10);
  scene.add(key, fill);
  return key;
}
