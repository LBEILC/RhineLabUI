import * as THREE from "three";
import { glassRevealGLSL, frostedTransmissionGLSL, FROSTED_ROUGHNESS } from "./glass-reveal.ts";
import { internalOpticsFragment } from "./internal-optics.ts";
import { themeMaterial } from "./theme-material";

type Surface = THREE.MeshPhysicalMaterial;
type Palette = { high: Surface; low?: Surface };

// The array and selected file share geometry. Morph their surface properties
// on one mesh so transparent shells never overlap during a quality change.
export class CardAppearance {
  private palettes = new Map<string, Palette>();
  disposeSources() {
    for (const palette of this.palettes.values()) { palette.high.dispose(); palette.low?.dispose(); }
    this.palettes.clear();
  }

  register(name: string, high: Surface, low?: Surface) {
    this.palettes.set(name, { high, low });
  }

  prepare(group: THREE.Group) {
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      const name = mesh.userData.surface as string;
      const palette = this.palettes.get(name);
      if (!palette) {
        mesh.userData.themeAmount = themeMaterial(mesh.material as THREE.Material, "Printed_Canvas");
        continue;
      }
      const mat = palette.high.clone();
      const amount = { value: 0 };
      const clarity = { value: 0 };
      mesh.material = mat;
      if (mat.userData.opticalOrder)
        mesh.renderOrder = mat.userData.opticalOrder;
      mesh.userData.appearance = amount;
      mesh.userData.glassClarity = clarity;
      mat.onBeforeCompile = (shader) => {
        if (mat.userData.opticalOrder)
          shader.fragmentShader = internalOpticsFragment(shader.fragmentShader);
        shader.uniforms.archiveQuality = amount;
        shader.uniforms.archiveClarity = clarity;
        shader.fragmentShader =
          "uniform float archiveQuality;\nuniform float archiveClarity;\n" +
          shader.fragmentShader;
        if (name === "Frosted_Polymer") {
          shader.vertexShader =
            "varying float vArchiveHeight;\nvarying vec2 vArchiveProjectedAxis;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvArchiveHeight = position.y / 3.7;",
          );
          shader.fragmentShader =
            "varying float vArchiveHeight;\nvarying vec2 vArchiveProjectedAxis;\n" +
            glassRevealGLSL +
            shader.fragmentShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            "#include <project_vertex>\nvArchiveProjectedAxis = 1.85 * vec2(projectionMatrix[0][0] * modelViewMatrix[1][0], projectionMatrix[1][1] * modelViewMatrix[1][1]) / max(0.0001, abs(mvPosition.z));",
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <transmission_pars_fragment>",
            frostedTransmissionGLSL + "\n" + THREE.ShaderChunk.transmission_pars_fragment.replace(
              "float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );",
              "float lod = archiveTransmissionLod(roughness, ior, transmissionSamplerSize);",
            ),
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            "#include <color_fragment>\ndiffuseColor.rgb *= mix(mix(vec3(0.40, 0.30, 0.20), vec3(1.0, 0.98, 0.94), smoothstep(0.1, 1.0, vArchiveHeight)), vec3(1.0), archiveQuality);",
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.28, ${FROSTED_ROUGHNESS}, archiveQuality), 0.025, glassRevealAtHeight(archiveClarity, vArchiveHeight));`,
          );
        } else if (!palette.low) {
          // Stable screen-space coverage adds internal geometry without an
          // abrupt visibility toggle or a second transparent body.
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            "#include <color_fragment>\nfloat coverage = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\nif (archiveQuality <= coverage) discard;",
          );
        }
      };
      mat.customProgramCacheKey = () =>
        `archive-surface-clarity-${name}-${Boolean(palette.low)}`;
      mesh.userData.subduedIndex = { value: 0 };
      mesh.userData.themeAmount = themeMaterial(mat, name, false, mesh.userData.subduedIndex);
    }
  }

  setClarity(group: THREE.Group, value: number) {
    const clarity = THREE.MathUtils.clamp(value, 0, 1);
    // Traversal still works after the viewer reparents meshes into part groups.
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.userData.glassClarity)
        return;
      child.userData.glassClarity.value = clarity;
      if (child.userData.surface !== "Frosted_Polymer") return;
      const mat = child.material as Surface;
      const palette = this.palettes.get("Frosted_Polymer")!;
      const quality = child.userData.appearance.value as number;
      const baseline = (
        key: "thickness" | "transmission" | "attenuationDistance",
      ) =>
        THREE.MathUtils.lerp(
          palette.low?.[key] ?? palette.high[key],
          palette.high[key],
          quality,
        );
      mat.thickness = THREE.MathUtils.lerp(
        baseline("thickness"),
        0.018,
        clarity,
      );
      mat.transmission = THREE.MathUtils.lerp(
        baseline("transmission"),
        0.985,
        clarity,
      );
      mat.attenuationDistance = THREE.MathUtils.lerp(
        baseline("attenuationDistance"),
        8,
        clarity,
      );
    });
  }

  setTheme(group: THREE.Group, value: number, subduedIndex: boolean | number = false) {
    group.traverse(child => {
      if (child.userData.themeAmount) child.userData.themeAmount.value = value;
      if (child.userData.subduedIndex) child.userData.subduedIndex.value = THREE.MathUtils.clamp(Number(subduedIndex), 0, 1);
    });
  }

  apply(group: THREE.Group, value: number) {
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      const palette = this.palettes.get(mesh.userData.surface);
      if (!palette) {
        // The printed canvas belongs to this file, including returning copies.
        (mesh.material as THREE.MeshBasicMaterial).opacity = value;
        continue;
      }
      mesh.userData.appearance.value = value;
      const { high, low } = palette;
      if (!low) continue;
      const mat = mesh.material as Surface;
      mat.color.copy(low.color).lerp(high.color, value);
      if (
        mat.attenuationColor &&
        low.attenuationColor &&
        high.attenuationColor
      ) {
        mat.attenuationColor
          .copy(low.attenuationColor)
          .lerp(high.attenuationColor, value);
        mat.attenuationDistance =
          Number.isFinite(low.attenuationDistance) &&
          Number.isFinite(high.attenuationDistance)
            ? THREE.MathUtils.lerp(
                low.attenuationDistance,
                high.attenuationDistance,
                value,
              )
            : high.attenuationDistance;
      }
      for (const key of [
        "roughness",
        "metalness",
        "transmission",
        "thickness",
        "clearcoat",
        "clearcoatRoughness",
      ] as const) {
        mat[key] = THREE.MathUtils.lerp(low[key] ?? 0, high[key] ?? 0, value);
      }
      // Keep the same transmission shader/pass throughout the transition.
      if (high.transmission > 0)
        mat.transmission = Math.max(0.000001, mat.transmission);
    }
  }

  dispose(group: THREE.Group) {
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (!mesh.userData.surface) mat.map?.dispose();
      mat.dispose();
    }
  }
}
