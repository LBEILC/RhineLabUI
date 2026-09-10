import * as THREE from "three";
import { ArchiveVisibility } from "./archive-visibility";
import { disposeThreeTree } from "./three-resources";
import { ThemeWave } from "./theme-motion";
import { themeMaterial, themeEnvironment } from "./theme-material";
import { RhythmMotion, rhythmDisplacement, quietBands, type MusicBands, type RhythmStyle } from "./archive-play-motion";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createArchiveLighting, type LightingLook } from "./archive-lighting";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { normalizeQuality, type RenderQuality } from "./render-quality";
import { applyTextureQuality, resizeQuality } from "./quality-renderer";
import { CardAppearance } from "./appearance";
import { configureInternalOptics } from "./internal-optics";
import { DecryptionController } from "./decryption";
import { fileAtSlot, fileLocation } from "./data";
import {
  cellKey,
  sameCell,
  selectionCell,
  fileAtCell,
  poolCell,
  LOOP_COLUMNS,
  LOOP_ROWS,
  COLUMN_SPACING,
  ROW_SPACING,
  type ArchiveCell,
  type ArchiveNavigation,
} from "./archive-loop";
import { labelMarkSvg } from "./brand";
import { archiveFraming } from "./viewport-layout";
import { ArchiveDrag, ArchivePlaneMomentum, type DragAxis, type DragProjection, type DragPosition } from "./archive-drag";
import { assetUrl as publicAsset } from "./asset-url";
import {
  archiveWave,
  extraction,
  baselineSelectionWave,
  rippleEnvelope,
  settlingWave,
  damp,
  columnStrength,
  idleWave,
  cinematicField,
  INSPECTION_LIFT,
  returnStep,
} from "./motion";

const ease = (t: number) => {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export class ArchiveScene {
  private inputEvents = new AbortController();
  private presence = 1;
  private presenceTarget = 1;
  setPresentationVisible(visible: boolean, immediate = false) {
    this.presenceTarget = Number(visible);
    if (immediate) this.presence = this.presenceTarget;
    if (!visible) this.cancelPointer();
  }
  get presentationHidden() { return this.presenceTarget === 0 && this.presence === 0; }
  private presentationDrop(cell: ArchiveCell) {
    const delay = .15 * (1 + Math.tanh((cell.row - this.selectedCell.row) * .1 + (cell.lane - this.selectedCell.lane) * .25));
    return 35 * Math.pow(THREE.MathUtils.clamp((1 - this.presence - delay) / .7, 0, 1), 2);
  }
  revealImmediately() { this.reveal = this.targetReveal; }
  dispose() {
    this.inputEvents.abort();
    this.cancelPointer();
    disposeThreeTree(this.scene);
    this.appearance.disposeSources();
    this.model.clear();
    this.outgoing = [];
    this.instances = [];
    this.assemblyTemplate?.then(disposeThreeTree).catch(() => {});
    this.assemblyTemplate = undefined;
    this.light.shadow.map?.dispose();
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.loaded = false;
  }
  uiOnlyParallax = false;
  private theme = new ThemeWave();
  private subduedIndex = { value: 0 };
  private selectedIndexOnly = false;
  private superPerformance = false;
  setSuperPerformance(enabled: boolean) {
    if (this.superPerformance === enabled) return;
    this.superPerformance = enabled;
    for (const inst of this.instances) {
      const original = (inst.userData.fullMaterial ??= inst.material) as THREE.MeshPhysicalMaterial;
      if (enabled && !inst.userData.fastMaterial) {
        const fast = original.clone();
        fast.onBeforeCompile = original.onBeforeCompile;
        fast.customProgramCacheKey = original.customProgramCacheKey.bind(original);
        fast.transmission = 0;
        fast.clearcoat = 0;
        fast.roughness = Math.max(.45, original.roughness);
        inst.userData.fastMaterial = fast;
      }
      inst.material = enabled ? inst.userData.fastMaterial : original;
      inst.visible = !enabled || original.name.replace(/\.\d+$/, "") !== "Titanium_Fasteners";
    }
    this.resize();
  }
  setSelectedIndexAccent(onlySelected: boolean) { this.selectedIndexOnly = onlySelected; }
  private themeAttribute?: THREE.InstancedBufferAttribute;
  get themeAmount() { return this.theme.background(performance.now() / 1000); }
  setTheme(dark: boolean, immediate = false) { this.theme.set(dark, performance.now() / 1000, this.selectedCell, immediate); }
  private playfield = { enabled: false, bands: quietBands(), strength: 1, flatten: 0, target: null as string | null, breathing: true };
  private flatMix = 0;
  private rhythm = new RhythmMotion();
  private rhythmStyle: RhythmStyle = "legacy";
  setRhythmStyle(style: RhythmStyle) { this.rhythmStyle = style; }
  private relayLifts = new Map<string, number>();
  private relayPoints = new Map<string, { cell: ArchiveCell; point: THREE.Vector3 }>();
  private relayActive = false;
  onRelayPick?: (key: string | null) => void;
  setPlayfield(enabled: boolean, bands: MusicBands, strength: number, flatten: number, target: string | null, breathing = true) {
    this.playfield = { enabled, bands, strength, flatten, target, breathing };
  }
  setRelayActive(active: boolean) {
    if (active === this.relayActive) return;
    this.cancelPointer(); this.setHover(null); this.relayActive = active;
    this.pointer.set(0, 0);
  }
  relayPulse(key: string) {
    const cell = this.relayPoints.get(key)?.cell;
    if (cell && !this.reduced) this.emitPulse(cell);
  }
  projectRelay(key: string) {
    const item = this.relayPoints.get(key);
    if (!item) return null;
    const point = item.point.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  }
  relayCandidates() {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.scene.updateMatrixWorld(true);
    return [...this.relayPoints.keys()].filter(key => {
      const p = this.projectRelay(key)!;
      const x = (p.x - rect.left) / rect.width, y = (p.y - rect.top) / rect.height;
      if (x < .18 || x > .82 || y < .32 || y > .76) return false;
      const hit = this.pickCell(p.x, p.y);
      return hit && cellKey(hit) === key;
    });
  }
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  // The reference uses a long lens 72–140 units from the cassette. A 0.1 near
  // plane quantizes adjacent optical layers to the same depth (visible shimmer).
  // All visible foreground geometry is beyond 5; retain the framing and lens.
  readonly camera = new THREE.PerspectiveCamera(34, 16 / 9, 5, 300);
  private composer: EffectComposer;
  private ao: SSAOPass;
  private bokeh: BokehPass;
  private instances: THREE.InstancedMesh[] = [];
  private visibility = new ArchiveVisibility();
  private instanceCapacity = LOOP_COLUMNS * LOOP_ROWS;
  private drawnCells: ArchiveCell[] = [];
  private extraCoverage = false;
  setArchiveCoverage(extra: boolean) { this.extraCoverage = extra; }
  private model = new THREE.Group();
  private appearance = new CardAppearance();
  private decryption = new DecryptionController();
  private cursor = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private dummy = new THREE.Object3D();
  private cells: ArchiveCell[] = [];
  private selectedCell: ArchiveCell = { lane: 2, row: 12 };
  private looping = false;
  private coordinateOrigin: ArchiveCell = { lane: 0, row: 0 };
  private lift = { value: 0, velocity: 0 };
  private rail = { value: 0, velocity: 0 };
  private shoulder = { value: 12, velocity: 0 };
  private laneFocus = { value: 2, velocity: 0 };
  private columnCamera = { value: 0, velocity: 0 };
  private returnY: number | null = null;
  private canInspect = false;
  private clearance = 0;
  private pulseGain = 1;
  private idleGain = 0;
  private lastInteraction = 0;
  private scanTime = 29.1;
  private scanBlend = 0;
  private cameraAim = new THREE.Vector3();
  private outgoing: {
    group: THREE.Group;
    slot: number;
    cell: ArchiveCell;
    lift: { value: number; velocity: number };
    returnY: number | null;
    clarity: number;
  }[] = [];
  private pulses: { row: number; lane: number; time: number }[] = [];
  private pendingPulse: ArchiveCell | null = null;
  private selectedSlot = 76;
  private detail = 0;
  private targetDetail = 0;
  private reveal = 0;
  private targetReveal = 0;
  private last = 0;
  private pointer = new THREE.Vector2();
  private dragging = false;
  private hoverCell: ArchiveCell | null = null;
  private hoverLifts = new Map<string, number>();
  private archiveDrag = new ArchiveDrag();
  private dragTrack: DragPosition | null = null;
  private navigatingDrag = false;
  private archiveMomentum: { motion: ArchivePlaneMomentum; time: number } | null = null;
  private holdingArchive = false;
  private cancelPointer = () => {};
  private rotation = 0;
  private targetRotation = 0;
  private light: THREE.DirectionalLight;
  private clock = 0;
  private loaded = false;
  private labelCanvas = document.createElement("canvas");
  private labelTexture?: THREE.CanvasTexture;
  private labelMark = new Image();
  private reduced = false;
  private quality = normalizeQuality(undefined);
  private appliedQuality = "";
  private smaa = new SMAAPass();
  private aoKernelSize = 32;
  private displayHeight = 0;
  private layoutKind = "";
  onSelect?: (index: number, cell?: ArchiveCell) => void;
  onHover?: (index: number | null) => void;
  onNavigate?: (axis: "row" | "lane", direction: number) => void;
  constructor(
    private container: HTMLElement,
    private readonly selectionPulse = baselineSelectionWave,
    private readonly deferSelectionPulse = false,
    private readonly lightingLook: LightingLook = "baseline",
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, 1.5) *
        Math.min(innerWidth / 1920, innerHeight / 1080),
    );
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "三维研究档案阵列，点击选择，左右拖动切列，上下拖动或滚轮切换列内档案",
    );
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color("#eae5e1");
    this.scene.fog = new THREE.Fog("#eae5e1", 22, 47);
    this.light = createArchiveLighting(this.renderer, this.scene, lightingLook);
    this.light.castShadow = true;
    Object.assign(this.light.shadow.camera, {
      left: -16,
      right: 16,
      top: 15,
      bottom: -15,
      near: 0.1,
      far: 45,
    });
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.normalBias = lightingLook === "refined" ? 0.018 : 0.035;
    this.light.shadow.bias = lightingLook === "refined" ? -0.00012 : -0.0003;
    this.light.shadow.radius = 4;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: "#d8c9b9", roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.name = "archive-floor";
    floor.position.y = -4.63;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.camera.position.set(-62.26, 35.98, 43.28);
    this.cameraAim.set(-0.5, 1.1, 0.4);
    this.camera.fov = 6.15;
    this.camera.lookAt(this.cameraAim);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new SSAOPass(
      this.scene,
      this.camera,
      container.clientWidth,
      container.clientHeight,
    );
    this.ao.kernelRadius = lightingLook === "refined" ? 0.44 : 0.38;
    this.ao.minDistance = 0.001;
    this.ao.maxDistance = 0.09;
    this.composer.addPass(this.ao);
    this.bokeh = new BokehPass(this.scene, this.camera, {
      focus: 25,
      aperture: 0.0018,
      maxblur: 0.011,
    });
    this.composer.addPass(this.bokeh);
    this.smaa.enabled = false;
    this.composer.addPass(this.smaa);
    this.composer.addPass(new OutputPass());
    this.bindPointer();
  }
  async load(assetUrl = publicAsset("assets/archive-cassette.glb")) {
    this.labelMark.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(labelMarkSvg)}`;
    await this.labelMark.decode();
    const gltf = await new GLTFLoader().loadAsync(
      assetUrl,
    );
    gltf.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    const count = LOOP_COLUMNS * LOOP_ROWS;
    for (let index = 0; index < count; index++) {
      const cell = poolCell(index);
      this.cells.push(cell);
    }
    for (const mesh of meshes) {
      const geom = mesh.geometry
        .clone()
        .applyMatrix4(mesh.matrixWorld)
        .scale(1, 1, 1);
      const source = mesh.material as THREE.MeshStandardMaterial;
      const name = source.name.replace(/\.\d+$/, "");
      const mat = source.clone() as THREE.MeshPhysicalMaterial;
      mat.envMapIntensity = 0.6;
      if (name === "Frosted_Polymer") {
        mat.color.set("#fffdfa");
        mat.transmission = 0.9;
        mat.thickness = 0.12;
        mat.roughness = 0.21;
        mat.ior = 1.46;
        mat.attenuationColor = new THREE.Color("#eee6df");
        mat.attenuationDistance = 2;
      }
      if (name === "Internal_Ceramic") {
        mat.color.set(this.lightingLook === "refined" ? "#c4baae" : "#c7beb6");
        mat.roughness = 0.6;
      }
      if (name === "Printed_Label") mat.color.set("#eae5dc");
      if (name === "Ivory_Edges") {
        mat.color.set("#f0e7df");
        mat.roughness = 0.31;
        mat.transmission = 0.65;
        mat.thickness = 0.04;
      }
      if (name === "Optical_Diffuser") {
        mat.color.set("#e2dad4");
        mat.transmission = 0;
        mat.roughness = 0.7;
      }
      if (name === "Subsurface_Optics") {
        mat.color.set(this.lightingLook === "refined" ? "#b9a796" : "#b9aba1");
        mat.roughness = 0.48;
        mat.metalness = 0.05;
      }
      if (name === "Optical_Edges") {
        // Internal refractive shoulders must be in the opaque capture: WebGL's
        // screen-space transmission cannot recursively sample another glass mesh.
        mat.transmission = 0;
        mat.color.set(this.lightingLook === "refined" ? "#d8c7b5" : "#d4c7be");
        mat.roughness = 0.26;
        mat.metalness = 0.08;
      }
      configureInternalOptics(name, mat);
      if (name === "Carbon_Ink") continue;
      const selectedMesh = new THREE.Mesh(geom, mat);
      selectedMesh.userData.surface = name;
      selectedMesh.castShadow = name === "Optical_Diffuser";
      selectedMesh.receiveShadow = true;
      this.model.add(selectedMesh);
      // Only the shell, edge and fasteners remain visible within tightly packed rows.
      // Keep sub-millimetre optical/typographic geometry on the extracted cassette.
      if (
        ![
          "Frosted_Polymer",
          "Ivory_Edges",
          "Titanium_Fasteners",
          "Index_Inlay",
          "Optical_Diffuser",
        ].includes(name)
      ) {
        this.appearance.register(name, mat);
        continue;
      }
      const arrayMat = mat.clone();
      if (name === "Frosted_Polymer") {
        arrayMat.transmission = 0.78;
        if (this.lightingLook === "refined") {
          // Longer oblique paths pick up the warm body tint, while the thin
          // edges and the extracted clear cover retain a brighter response.
          arrayMat.thickness = 0.28;
          arrayMat.attenuationColor.set("#d4c7b4");
          arrayMat.attenuationDistance = 1.2;
        }
        arrayMat.transparent = false;
        arrayMat.color.set("#fff7ed");
        arrayMat.onBeforeCompile = (shader) => {
          shader.vertexShader =
            "varying float vPanelHeight;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvPanelHeight = position.y / 3.7;",
          );
          shader.fragmentShader =
            "varying float vPanelHeight;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(0.40, 0.30, 0.20), vec3(1.0, 0.98, 0.94), smoothstep(0.1, 1.0, vPanelHeight));",
          );
        };
        arrayMat.roughness = 0.28;
        arrayMat.clearcoat = 0.3;
        arrayMat.clearcoatRoughness = 0.25;
      }
      if (name === "Optical_Diffuser") arrayMat.color.set("#806447");
      if (name === "Ivory_Edges") {
        arrayMat.transmission = 0;
        arrayMat.color.set(
          this.lightingLook === "refined" ? "#dcc9b0" : "#fff5e9",
        );
        arrayMat.roughness = 0.38;
      }
      if (name === "Index_Inlay") {
        arrayMat.color.set("#e4d6c5");
        arrayMat.metalness = 0.05;
      }
      this.appearance.register(name, mat, arrayMat);
      this.themeAttribute ??= new THREE.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute("archiveTheme", this.themeAttribute);
      themeMaterial(arrayMat, name, true, this.subduedIndex);
      const inst = new THREE.InstancedMesh(geom, arrayMat, count);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.castShadow = name === "Optical_Diffuser";
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      this.instances.push(inst);
      this.scene.add(inst);
    }
    this.labelCanvas.width = 1024;
    this.labelCanvas.height = 440;
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.labelTexture.anisotropy =
      this.renderer.capabilities.getMaxAnisotropy();
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.99, 0.46),
      new THREE.MeshBasicMaterial({
        map: this.labelTexture,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
      }),
    );
    label.position.set(-1.36, 3.04, 0.255);
    this.model.add(label);
    this.appearance.prepare(this.model);
    this.appearance.apply(this.model, 0);
    this.drawLabel(0);
    this.scene.add(this.model);
    this.model.position.copy(this.cellPosition(poolCell(this.selectedSlot)));
    this.loaded = true;
  }

  private assemblyTemplate?: Promise<THREE.Group>;
  async createAssemblyModel() {
    this.assemblyTemplate ??= new GLTFLoader()
      .loadAsync(publicAsset("assets/archive-assembly.glb"))
      .then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        return gltf.scene;
      })
      .catch((error) => {
        this.assemblyTemplate = undefined;
        throw error;
      });
    const template = await this.assemblyTemplate;
    const model = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    template.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const name = (object.material as THREE.Material).name.replace(
        /\.\d+$/,
        "",
      );
      const mesh = new THREE.Mesh(
        object.geometry.clone().applyMatrix4(object.matrixWorld),
        object.material,
      );
      mesh.userData.surface = name;
      mesh.userData.assemblyPart = object.userData.assemblyPart;
      model.add(mesh);
      meshes.push(mesh);
    });
    this.appearance.prepare(model);
    this.appearance.apply(model, 1);
    this.appearance.setClarity(model, this.decryption.clarity);
    this.appearance.setTheme(model, this.themeAmount);
    const canvas = document.createElement("canvas");
    canvas.width = this.labelCanvas.width;
    canvas.height = this.labelCanvas.height;
    canvas.getContext("2d")!.drawImage(this.labelCanvas, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.99, 0.46),
      new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
      }),
    );
    label.position.set(-1.36, 3.04, 0.255);
    label.userData.assemblyPart = "cover";
    label.userData.themeAmount = themeMaterial(label.material, "Printed_Canvas");
    label.userData.themeAmount.value = this.themeAmount;
    model.add(label);
    meshes.push(label);
    return {
      model,
      setClarity: (value: number) => this.appearance.setClarity(model, value),
      dispose: () => {
        for (const mesh of meshes) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
        texture.dispose();
      },
    };
  }
  setMode(mode: "hidden" | "archive" | "detail") {
    this.cancelPointer();
    this.setHover(null);
    if (mode === "detail") this.decryption.enter(this.scanBlend > .9 && this.decryption.clarity > .999);
    else this.decryption.leave();
    if (mode === "hidden") this.decryption.select();
    if (mode !== "archive") this.pendingPulse = null;
    this.looping = mode !== "hidden";
    if (!this.looping) {
      const canonical = fileLocation(fileAtSlot(this.selectedSlot));
      this.selectedCell = { lane: canonical.lane, row: canonical.row };
      this.coordinateOrigin = { lane: 0, row: 0 };
      for (const old of this.outgoing) {
        this.scene.remove(old.group);
        this.appearance.dispose(old.group);
      }
      this.outgoing = [];
    }
    this.lastInteraction = this.clock;
    this.targetReveal = mode === "hidden" ? 0 : 1;
    this.targetDetail = mode === "detail" ? 1 : 0;
    this.dragging = false;
    if (mode !== "detail") {
      this.targetRotation = 0;
      if (this.rotation !== 0) this.returnY = this.model.position.y;
    } else this.returnY = null;
  }
  setReduced(value: boolean) {
    if (value && !this.reduced) this.cancelPointer();
    this.reduced = value;
  }
  setQuality(value: RenderQuality | boolean) {
    const quality =
      typeof value === "boolean"
        ? normalizeQuality(undefined, value)
        : normalizeQuality(value);
    const key = JSON.stringify(quality);
    if (this.appliedQuality === key) return;
    this.appliedQuality = key;
    this.quality = quality;
    if (quality.aoSamples && quality.aoSamples !== this.aoKernelSize) {
      const old = this.ao;
      this.ao = new SSAOPass(this.scene, this.camera, 1, 1, quality.aoSamples);
      this.ao.kernelRadius = old.kernelRadius;
      this.ao.minDistance = old.minDistance;
      this.ao.maxDistance = old.maxDistance;
      const index = this.composer.passes.indexOf(old);
      this.composer.removePass(old);
      this.composer.insertPass(this.ao, index);
      old.dispose();
      this.aoKernelSize = quality.aoSamples;
    }
    this.ao.enabled = quality.aoSamples > 0;
    this.bokeh.enabled = quality.depthOfField > 0;
    this.smaa.enabled = quality.antialias === "smaa";
    this.renderer.shadowMap.enabled = quality.shadows > 0;
    const size = Math.min(
      quality.shadows || 1024,
      this.renderer.capabilities.maxTextureSize,
    );
    if (this.light.shadow.mapSize.x !== size) {
      this.light.shadow.map?.dispose();
      this.light.shadow.map = null;
      this.light.shadow.mapSize.set(size, size);
    }
    this.light.shadow.needsUpdate = true;
    applyTextureQuality(this.scene, this.renderer, quality);
    this.resize();
  }
  private cellPosition(cell: ArchiveCell) {
    return new THREE.Vector3(
      (cell.lane - 2) * COLUMN_SPACING,
      -4.6,
      (cell.row - 15.5) * ROW_SPACING,
    );
  }
  private rebaseCoordinates() {
    // Periodically reduce the logical coordinates while preserving every
    // relative position, spring velocity, ripple and idle phase.
    const shift = {
      lane:
        Math.abs(this.selectedCell.lane) > 2048
          ? Math.round((this.selectedCell.lane - 2) / 5) * 5
          : 0,
      row:
        Math.abs(this.selectedCell.row) > 2048
          ? Math.floor((this.selectedCell.row - 12) / 8) * 8
          : 0,
    };
    if (!shift.lane && !shift.row) return;
    this.setHover(null);
    this.hoverLifts.clear();
    this.selectedCell.lane -= shift.lane;
    this.selectedCell.row -= shift.row;
    this.coordinateOrigin.lane += shift.lane;
    this.coordinateOrigin.row += shift.row;
    this.laneFocus.value -= shift.lane;
    this.shoulder.value -= shift.row;
    this.columnCamera.value -= shift.lane * COLUMN_SPACING;
    this.rail.value += shift.row * ROW_SPACING;
    for (const old of this.outgoing) {
      old.cell.lane -= shift.lane;
      old.cell.row -= shift.row;
    }
    for (const pulse of this.pulses) {
      pulse.lane -= shift.lane;
      pulse.row -= shift.row;
    }
    if (this.pendingPulse) {
      this.pendingPulse.lane -= shift.lane;
      this.pendingPulse.row -= shift.row;
    }
  }
  select(index: number, navigation?: ArchiveNavigation) {
    if (!this.navigatingDrag) this.cancelPointer();
    this.setHover(null);
    this.lastInteraction = this.clock;
    const next = fileLocation(index).slot;
    const canonical = fileLocation(index);
    const cell = this.looping
      ? selectionCell(index, this.selectedCell, navigation)
      : { lane: canonical.lane, row: canonical.row };
    const changed = !sameCell(cell, this.selectedCell);
    if (this.looping && changed && this.loaded && this.lift.value > 0.0001) {
      const group = this.model.clone(true);
      const label = group.children[group.children.length - 1] as THREE.Mesh;
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 440;
      canvas.getContext("2d")!.drawImage(this.labelCanvas, 0, 0);
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      label.material = new THREE.MeshBasicMaterial({
        map,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
      });
      // Clone carries the selected label material by reference. Replace it
      // before installing appearance shaders, so theme hooks are not appended
      // to the original label a second time on every selection.
      this.appearance.prepare(group);
      this.appearance.apply(group, ease(this.lift.value / 0.4));
      this.appearance.setClarity(group, this.decryption.clarity);
      this.scene.add(group);
      this.outgoing.push({
        group,
        slot: this.selectedSlot,
        cell: { ...this.selectedCell },
        lift: { ...this.lift },
        returnY: group.rotation.y !== 0 ? group.position.y : null,
        clarity: this.decryption.clarity,
      });
      this.lift.value = 0;
      this.lift.velocity = 0;
    }
    this.selectedSlot = next;
    this.selectedCell = cell;
    if (changed) {
      this.decryption.select();
      this.rotation = 0;
      this.returnY = null;
    }
    const returning = this.outgoing.findIndex((o) => sameCell(o.cell, cell));
    if (returning >= 0) {
      const o = this.outgoing[returning];
      this.lift = { ...o.lift };
      this.rotation = o.group.rotation.y;
      this.returnY = o.returnY;
      this.decryption.select(o.clarity);
      this.scene.remove(o.group);
      this.appearance.dispose(o.group);
      this.outgoing.splice(returning, 1);
    }
    if (this.deferSelectionPulse) {
      this.pendingPulse = this.looping ? { ...cell } : null;
    } else this.emitPulse(cell);
    this.targetRotation = 0;
    this.drawLabel(index);
  }
  private emitPulse(cell: ArchiveCell) {
    this.pulses.push({ ...cell, time: this.clock });
    this.pulses = this.pulses.slice(-6);
  }
  private drawLabel(index: number) {
    if (!this.labelTexture) return;
    const c = this.labelCanvas.getContext("2d")!;
    c.fillStyle = "#e6e2d9";
    c.fillRect(0, 0, 1024, 440);
    c.fillStyle = "#171713";
    c.fillRect(12, 12, 1000, 6);
    c.fillRect(12, 419, 1000, 3);
    c.font = "bold 81px MiSans";
    c.fillText("RHINE LAB, LLC.", 22, 116);
    c.font = "32px MiSans";
    c.fillStyle = "#878476";
    c.fillText("INTERNAL DATABASE", 25, 174);
    c.fillStyle = "#171713";
    c.font = "bold 130px MiSans";
    c.fillText("NO." + String(index + 1).padStart(3, "0"), 22, 360);
    c.fillRect(782, 32, 221, 39);
    c.fillStyle = "#eee9de";
    c.font = "24px MiSans";
    c.fillText("R L / I S", 809, 61);
    c.fillStyle = "#171713";
    c.font = "bold 64px MiSans";
    c.fillText("INFO", 830, 143);
    c.drawImage(this.labelMark, 790, 242, 210, 98);
    this.labelTexture.needsUpdate = true;
  }
  private ensureInstanceCapacity(required: number) {
    if (required <= this.instanceCapacity) return;
    const capacity = Math.max(required, this.instanceCapacity * 2);
    for (const inst of this.instances) {
      inst.dispose();
      const matrix = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16).setUsage(THREE.DynamicDrawUsage);
      matrix.array.set(inst.instanceMatrix.array);
      inst.instanceMatrix = matrix;
    }
    const previousTheme = this.themeAttribute;
    this.themeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    if (previousTheme) this.themeAttribute.array.set(previousTheme.array);
    for (const inst of this.instances) inst.geometry.setAttribute("archiveTheme", this.themeAttribute);
    this.instanceCapacity = capacity;
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    const kind = this.container.closest<HTMLElement>("[data-layout]")?.dataset.layout ?? "";
    const displayHeight = this.container.getBoundingClientRect().height;
    if (this.layoutKind === "cinematic" && kind !== "cinematic" && this.displayHeight > 0) {
      // Removing letterboxing starts from the same apparent model size. The
      // existing camera interpolation then carries it to the responsive anchor.
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * displayHeight / this.displayHeight,
      ));
    }
    this.displayHeight = displayHeight;
    this.layoutKind = kind;
    const dimensions = resizeQuality(
      this.renderer,
      this.composer,
      this.container,
      this.quality,
      this.superPerformance,
    );
    this.ao.setSize(
      Math.max(1, Math.floor(dimensions.width * this.quality.aoResolution)),
      Math.max(1, Math.floor(dimensions.height * this.quality.aoResolution)),
    );
    this.container.dataset.renderQuality = JSON.stringify({
      ...JSON.parse(this.container.dataset.renderQuality!),
      aoSamples: this.ao.enabled ? this.aoKernelSize : 0,
      aoWidth: this.ao.width,
      aoHeight: this.ao.height,
      shadows: this.renderer.shadowMap.enabled
        ? this.light.shadow.mapSize.x
        : 0,
      depthOfField: this.bokeh.enabled ? this.quality.depthOfField : 0,
    });
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private canBrowse() {
    return (
      this.presenceTarget === 1 &&
      this.looping &&
      !this.targetDetail &&
      this.detail < 0.2 &&
      this.reveal >= 0.8 &&
      this.loaded &&
      !this.container.closest("[inert]")
    );
  }
  private setHover(cell: ArchiveCell | null) {
    if (
      (!cell && !this.hoverCell) ||
      (cell && this.hoverCell && sameCell(cell, this.hoverCell))
    )
      return;
    this.hoverCell = cell ? { ...cell } : null;
    this.onHover?.(cell ? fileAtCell(cell) : null);
  }
  private pickCell(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.cursor.set(
      ((x - r.left) / r.width) * 2 - 1,
      (-(y - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.cursor, this.camera);
    const hit = this.raycaster.intersectObjects(
      [this.instances[0], this.model, ...this.outgoing.map((o) => o.group)],
      true,
    )[0];
    if (!hit) return null;
    if (hit.instanceId !== undefined) return { ...this.drawnCells[hit.instanceId] };
    let object: THREE.Object3D | null = hit.object;
    while (object) {
      const copy = this.outgoing.find((o) => o.group === object);
      if (copy) return { ...copy.cell };
      object = object.parent;
    }
    return { ...this.selectedCell };
  }
  private trackCoordinate(axis: DragAxis, value: number) {
    return axis === "lane"
      ? value / COLUMN_SPACING + 2
      : (-value - 2.17) / ROW_SPACING + 15.5;
  }
  private dragProjection(): DragProjection {
    this.model.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const center = this.model.localToWorld(new THREE.Vector3(0, 1.85, 0));
    const rect = this.renderer.domElement.getBoundingClientRect();
    const project = (motion: THREE.Vector3) => {
      const from = center
        .clone()
        .addScaledVector(motion, -0.5)
        .project(this.camera);
      const to = center
        .clone()
        .addScaledVector(motion, 0.5)
        .project(this.camera);
      return {
        x: ((to.x - from.x) * rect.width) / 2,
        y: (-(to.y - from.y) * rect.height) / 2,
      };
    };
    // Positive navigation moves the array along -X for columns and -Z for rows.
    return {
      lane: project(new THREE.Vector3(-COLUMN_SPACING, 0, 0)),
      row: project(new THREE.Vector3(0, 0, -ROW_SPACING)),
    };
  }
  private trackPosition(axis: DragAxis, coordinate: number) {
    return axis === "lane"
      ? (coordinate - 2) * COLUMN_SPACING
      : -2.17 - (coordinate - 15.5) * ROW_SPACING;
  }
  private navigatePlane(coordinate: DragPosition) {
    const goal = { lane: Math.round(coordinate.lane), row: Math.round(coordinate.row) };
    if (sameCell(goal, this.selectedCell)) return;
    const from = { ...this.selectedCell };
    const steps = Math.min(64, Math.max(Math.abs(goal.lane - from.lane), Math.abs(goal.row - from.row)));
    this.navigatingDrag = true;
    try {
      // Select physical cells along the travelled segment in one update per cell.
      // Column memory is updated by onSelect, but never pulls a held plane away.
      for (let i = 1; i <= steps; i++) {
        const cell = {
          lane: Math.round(from.lane + (goal.lane - from.lane) * i / steps),
          row: Math.round(from.row + (goal.row - from.row) * i / steps),
        };
        if (!sameCell(cell, this.selectedCell)) this.onSelect?.(fileAtCell(cell), cell);
      }
    } finally {
      this.navigatingDrag = false;
    }
  }
  private stopMomentum() {
    if (this.archiveMomentum) {
      this.columnCamera.velocity = 0;
      this.rail.velocity = 0;
    }
    this.archiveMomentum = null;
  }
  private bindPointer() {
    const canvas = this.renderer.domElement;
    let activePointer: number | null = null;
    let previousX = 0,
      startX = 0,
      startY = 0,
      moved = false;
    let browse = false,
      cancelled = false;
    let startTrack = { lane: 0, row: 0 };
    let wheelTotal = 0,
      wheelTime = 0;
    const pointers = new Set<number>();
    const hover = (e: PointerEvent) => {
      if (
        e.pointerType !== "mouse" ||
        !this.canBrowse() ||
        this.archiveMomentum
      )
        return;
      const r = canvas.getBoundingClientRect();
      this.pointer.set(
        (e.clientX - r.left) / r.width - 0.5,
        (e.clientY - r.top) / r.height - 0.5,
      );
      const cell = this.pickCell(e.clientX, e.clientY);
      this.setHover(cell);
      canvas.style.cursor = cell ? "pointer" : "grab";
    };
    const reset = () => {
      const id = activePointer;
      activePointer = null;
      this.dragging = false;
      this.dragTrack = null;
      this.holdingArchive = false;
      browse = false;
      this.setHover(null);
      canvas.style.cursor = this.canBrowse() ? "grab" : "default";
      if (id !== null && canvas.hasPointerCapture(id))
        canvas.releasePointerCapture(id);
    };
    this.cancelPointer = () => {
      cancelled = true;
      this.stopMomentum();
      pointers.clear();
      wheelTotal = 0;
      reset();
    };
    const moveArchive = (e: PointerEvent) => {
      const pending = !this.archiveDrag.active;
      for (const sample of e.getCoalescedEvents?.() ?? []) {
        this.archiveDrag.move(sample.clientX, sample.clientY, sample.timeStamp);
      }
      this.archiveDrag.move(e.clientX, e.clientY, e.timeStamp);
      moved ||= this.archiveDrag.moved;
      if (!this.archiveDrag.active) return;
      if (pending) {
        startTrack = { lane: this.columnCamera.value, row: this.rail.value };
      }
      this.setHover(null);
      this.lastInteraction = this.clock;
      canvas.style.cursor = "grabbing";
      this.dragTrack = {
        lane: startTrack.lane + this.archiveDrag.value.lane * COLUMN_SPACING,
        row: startTrack.row - this.archiveDrag.value.row * ROW_SPACING,
      };
      this.columnCamera.value = this.dragTrack.lane;
      this.rail.value = this.dragTrack.row;
      this.columnCamera.velocity = this.rail.velocity = 0;
      this.navigatePlane({
        lane: this.trackCoordinate("lane", this.columnCamera.value),
        row: this.trackCoordinate("row", this.rail.value),
      });
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!this.canBrowse() && !this.canInspect) return;
      pointers.add(e.pointerId);
      if (pointers.size > 1) {
        cancelled = true;
        reset();
        return;
      }
      activePointer = e.pointerId;
      cancelled = false;
      moved = this.archiveMomentum !== null;
      startX = previousX = e.clientX;
      startY = e.clientY;
      browse = this.canBrowse();
      this.stopMomentum();
      if (browse) {
        this.columnCamera.velocity = 0;
        this.rail.velocity = 0;
      }
      this.holdingArchive = browse;
      this.dragging = !browse && this.canInspect;
      startTrack = { lane: this.columnCamera.value, row: this.rail.value };
      this.archiveDrag.start(e.clientX, e.clientY, this.dragProjection(), e.timeStamp);
      this.setHover(null);
      canvas.setPointerCapture(e.pointerId);
      if (this.relayActive) { this.holdingArchive = false; this.dragging = false; }
    }, { signal: this.inputEvents.signal });
    canvas.addEventListener("pointermove", (e) => {
      if (this.relayActive) {
        if (e.pointerId === activePointer) moved ||= Math.hypot(e.clientX - startX, e.clientY - startY) > 7;
        return;
      }
      if (activePointer !== null && e.pointerId !== activePointer) return;
      if (activePointer === null) {
        hover(e);
        return;
      }
      if (cancelled) return;
      moved ||= Math.hypot(e.clientX - startX, e.clientY - startY) > 7;
      if (browse) {
        if (!this.canBrowse()) {
          this.cancelPointer();
          return;
        }
        moveArchive(e);
        return;
      }
      if (this.dragging && this.canInspect) {
        this.targetRotation = THREE.MathUtils.clamp(
          this.targetRotation + (e.clientX - previousX) * 0.004,
          -0.8,
          0.8,
        );
        previousX = e.clientX;
      }
    }, { signal: this.inputEvents.signal });
    canvas.addEventListener("pointerup", (e) => {
      pointers.delete(e.pointerId);
      if (e.pointerId !== activePointer) return;
      if (this.relayActive) {
        if (!cancelled && !moved) { const cell = this.pickCell(e.clientX, e.clientY); this.onRelayPick?.(cell ? cellKey(cell) : null); }
        reset(); return;
      }
      if (!cancelled && browse && this.canBrowse()) {
        moveArchive(e);
        if (this.archiveDrag.active) {
          if (!this.reduced) {
            this.archiveMomentum = {
              time: performance.now() / 1000,
              motion: new ArchivePlaneMomentum(
                { lane: this.trackCoordinate("lane", this.columnCamera.value), row: this.trackCoordinate("row", this.rail.value) },
                this.archiveDrag.releaseVelocity(e.timeStamp, false),
              ),
            };
          }
        } else if (!moved) {
          const cell = this.pickCell(e.clientX, e.clientY);
          if (cell) this.onSelect?.(fileAtCell(cell), cell);
        }
      }
      reset();
    }, { signal: this.inputEvents.signal });
    canvas.addEventListener("pointercancel", (e) => {
      pointers.delete(e.pointerId);
      if (e.pointerId === activePointer) {
        cancelled = true;
        reset();
      }
    }, { signal: this.inputEvents.signal });
    canvas.addEventListener("lostpointercapture", (e) => {
      pointers.delete(e.pointerId);
      if (e.pointerId === activePointer) {
        cancelled = true;
        reset();
      }
    }, { signal: this.inputEvents.signal });
    canvas.addEventListener("pointerleave", () => {
      this.pointer.set(0, 0);
      this.setHover(null);
    }, { signal: this.inputEvents.signal });
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.relayActive) { e.preventDefault(); return; }
        if (
          !this.canBrowse() ||
          activePointer !== null ||
          e.ctrlKey ||
          Math.abs(e.deltaX) > Math.abs(e.deltaY)
        )
          return;
        e.preventDefault();
        if (this.archiveMomentum) this.stopMomentum();
        const now = performance.now();
        const delta = THREE.MathUtils.clamp(
          e.deltaY *
            (e.deltaMode === 1
              ? 40
              : e.deltaMode === 2
                ? canvas.clientHeight
                : 1),
          -300,
          300,
        );
        if (now - wheelTime > 180 || Math.sign(delta) !== Math.sign(wheelTotal))
          wheelTotal = 0;
        wheelTime = now;
        wheelTotal += delta;
        const steps = Math.min(3, Math.floor(Math.abs(wheelTotal) / 100));
        if (!steps) return;
        const direction = Math.sign(wheelTotal);
        wheelTotal -= direction * steps * 100;
        this.navigatingDrag = true;
        try {
          for (let i = 0; i < steps; i++) this.onNavigate?.("row", direction);
        } finally {
          this.navigatingDrag = false;
        }
      },
      { ...{ passive: false }, signal: this.inputEvents.signal },
    );
    window.addEventListener("blur", () => this.cancelPointer(), { signal: this.inputEvents.signal });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.cancelPointer();
    }, { signal: this.inputEvents.signal });
    window.addEventListener("resize", () => this.cancelPointer(), { signal: this.inputEvents.signal });
    // After multi-touch cancels capture, a finger can finish outside the canvas.
    window.addEventListener("pointerup", (e) => pointers.delete(e.pointerId), { signal: this.inputEvents.signal });
    window.addEventListener("pointercancel", (e) =>
      pointers.delete(e.pointerId), { signal: this.inputEvents.signal }
    );
  }
  update(
    time: number,
    cinematic?: { reveal: number; lift: number; zoom: number; time: number },
  ) {
    const elapsed = Math.max(0, time - this.last || 0.016);
    const dt = Math.min(elapsed, 0.05);
    this.last = time;
    this.clock = time;
    if (!this.loaded) return;
    const step = this.reduced ? 1 : Math.min(elapsed, .25) / 1.1;
    this.presence += Math.sign(this.presenceTarget - this.presence) * Math.min(step, Math.abs(this.presenceTarget - this.presence));
    this.renderer.domElement.style.opacity = String(THREE.MathUtils.clamp(this.presence / .16, 0, 1));
    this.theme.beginFrame();
    themeEnvironment(this.scene, this.renderer, this.themeAmount);
    const blend = 1 - Math.exp(-dt * (this.reduced ? 35 : 2.8));
    this.reveal = cinematic
      ? cinematic.reveal
      : THREE.MathUtils.lerp(this.reveal, this.targetReveal, blend);
    this.rotation = this.targetDetail
      ? THREE.MathUtils.lerp(this.rotation, this.targetRotation, blend)
      : returnStep(this.rotation, dt, this.reduced);
    const shot = cinematic?.time ?? 29.1;
    if (cinematic) {
      this.scanTime = shot;
      this.scanBlend = 1;
    } else {
      this.scanTime += dt;
      this.scanBlend *= Math.exp(-dt * 3);
    }
    if (!this.canBrowse()) {
      this.setHover(null);
      if (this.holdingArchive || this.archiveMomentum) this.cancelPointer();
    }
    if (this.looping && !cinematic && !this.holdingArchive && !this.archiveMomentum) this.rebaseCoordinates();
    const momentum = !cinematic ? this.archiveMomentum : null;
    if (momentum) {
      momentum.motion.step(Math.min(Math.max(time - momentum.time, 0), 0.25));
      momentum.time = time;
      this.navigatePlane(momentum.motion.value);
      this.lastInteraction = time;
    }
    const hoverKey = !cinematic && this.hoverCell ? cellKey(this.hoverCell) : null;
    if (hoverKey && !this.hoverLifts.has(hoverKey)) this.hoverLifts.set(hoverKey, 0);
    for (const [key, value] of this.hoverLifts) {
      const target = key === hoverKey ? 0.28 : 0;
      const next = cinematic ? 0 : this.reduced ? target : THREE.MathUtils.lerp(value, target, 1 - Math.exp(-dt * 14));
      if (target === 0 && next < 0.0001) this.hoverLifts.delete(key);
      else this.hoverLifts.set(key, next);
    }
    const hoverLift = (cell: ArchiveCell) => this.hoverLifts.get(cellKey(cell)) ?? 0;
    const chosen = this.cellPosition(this.selectedCell);
    const selectedRow = this.selectedCell.row;
    const selectedLane = this.selectedCell.lane;
    damp(this.shoulder, selectedRow, this.reduced ? 35 : 5, dt);
    damp(this.laneFocus, selectedLane, this.reduced ? 35 : 4, dt);
    // A held or freely coasting plane owns both tracks; selection cannot pull it.
    if (!this.holdingArchive && !momentum) {
      damp(this.columnCamera, chosen.x, this.reduced ? 35 : 3.7, dt);
      damp(this.rail, cinematic ? 0 : -2.17 - chosen.z, this.reduced ? 35 : 3.7, dt);
    }
    if (momentum) {
      this.columnCamera.value = this.trackPosition("lane", momentum.motion.lane.value);
      this.rail.value = this.trackPosition("row", momentum.motion.row.value);
      this.columnCamera.velocity = momentum.motion.lane.velocity * COLUMN_SPACING;
      this.rail.velocity = -momentum.motion.row.velocity * ROW_SPACING;
      if (momentum.motion.phase === "idle") this.archiveMomentum = null;
    }
    if (this.dragTrack && !cinematic) {
      this.columnCamera.value = this.dragTrack.lane;
      this.rail.value = this.dragTrack.row;
      this.columnCamera.velocity = this.rail.velocity = 0;
    }
    if (cinematic) {
      this.rail.value = 0;
      this.rail.velocity = 0;
      this.lift.value = extraction(shot);
      this.lift.velocity = 0;
      this.shoulder.value = selectedRow;
      this.laneFocus.value = selectedLane;
      this.laneFocus.velocity = 0;
      this.columnCamera.value = chosen.x;
      this.columnCamera.velocity = 0;
    }
    // Keep the illuminated set near the origin. Lateral navigation is a track
    // movement of the whole array, just like the existing front/back rail.
    const trackX = cinematic ? 0 : this.columnCamera.value;
    this.pulses = this.pulses.filter((p) => time - p.time < 3.2);
    const aligningCopy = this.outgoing.some((o) => o.returnY !== null);
    const idle =
      !cinematic &&
      !this.reduced &&
      this.targetReveal > 0 &&
      !this.targetDetail &&
      this.detail < 0.01 &&
      this.returnY === null &&
      !aligningCopy &&
      time - this.lastInteraction > 2.5;
    this.idleGain = cinematic
      ? 0
      : THREE.MathUtils.lerp(
          this.idleGain,
          idle ? (this.playfield.enabled ? (this.playfield.breathing && !this.relayActive ? 1 - this.playfield.bands.activity : 0) : 1) : 0,
          1 - Math.exp(-dt * (idle ? 0.8 : 4)),
        );
    this.pulseGain = THREE.MathUtils.lerp(
      this.pulseGain,
      this.targetDetail || this.returnY !== null || aligningCopy ? 0 : 1,
      1 - Math.exp(-dt * 8),
    );
    const play = this.playfield;
    const activePlay = !cinematic && !this.targetDetail && play.enabled;
    const rhythm = this.rhythm.update(activePlay && !this.reduced ? play.bands : quietBands(), time, dt, this.rhythmStyle);
    this.flatMix += ((activePlay ? play.flatten : 0) - this.flatMix) * (this.reduced ? 1 : 1 - Math.exp(-dt * 4));
    this.subduedIndex.value = Math.max(Number(this.selectedIndexOnly), this.flatMix);
    const indexDim = (lift: number) => this.selectedIndexOnly
      ? 1 - ease(lift / .4) * (1 - this.flatMix)
      : this.flatMix;
    const gameTarget = activePlay ? play.target : null;
    if (gameTarget && !this.relayLifts.has(gameTarget)) this.relayLifts.set(gameTarget, 0);
    for (const [key, height] of this.relayLifts) {
      const next = height + ((key === gameTarget ? .95 : 0) - height) * (this.reduced ? 1 : 1 - Math.exp(-dt * 8));
      if (next < .001 && key !== gameTarget) this.relayLifts.delete(key); else this.relayLifts.set(key, next);
    }
    const spectrumPoint = new THREE.Vector3();
    const screenX = (row: number, lane: number) => {
      spectrumPoint.set((lane - 2) * COLUMN_SPACING - trackX, -4.6, (row - 15.5) * ROW_SPACING + this.rail.value).project(this.camera);
      return (spectrumPoint.x + 1) / 2;
    };
    const field = (row: number, lane: number) => {
      if (cinematic)
        return cinematicField(
          row,
          lane,
          shot,
          this.shoulder.value,
          this.laneFocus.value,
        );
      const height =
        archiveWave(
          row + this.coordinateOrigin.row,
          lane + this.coordinateOrigin.lane,
          this.scanTime,
        ) *
          this.scanBlend;
      const breathing = idleWave(
          row + this.coordinateOrigin.row,
          lane + this.coordinateOrigin.lane,
          time,
        ) *
          this.idleGain;
      let pulseHeight = 0;
      if (!cinematic && !this.reduced) {
        let ripple = 0;
        for (const p of this.pulses) {
          const distance = Math.hypot(row - p.row, (lane - p.lane) * 2.2);
          const age = time - p.time;
          ripple +=
            this.selectionPulse(distance, age) *
            (this.deferSelectionPulse ? rippleEnvelope(distance, age) : 1);
        }
        pulseHeight = THREE.MathUtils.clamp(ripple, -0.6, 0.6) * this.pulseGain;
      }
      const distance = row - this.shoulder.value;
      return (
        (height +
        settlingWave(distance, 26.56) *
          columnStrength(lane, this.laneFocus.value)) * (1 - this.flatMix) + breathing + pulseHeight +
        (activePlay && !this.reduced ? rhythmDisplacement(row, lane, time, play.bands, play.strength, rhythm, screenX(row, lane)) : 0) +
        (this.relayLifts.get(cellKey({ row, lane })) ?? 0)
      );
    };
    const selectedBase = chosen.y + field(selectedRow, selectedLane);
    if (!cinematic) {
      if (this.returnY !== null && this.rotation !== 0) {
        this.lift.value = this.returnY - selectedBase;
        this.lift.velocity = 0;
      } else {
        this.returnY = null;
        damp(
          this.lift,
          this.targetDetail
            ? INSPECTION_LIFT
            : this.outgoing.some(
                  (o) =>
                    o.returnY !== null &&
                    o.cell.lane === selectedLane &&
                    Math.abs(o.cell.row - selectedRow) < 5,
                )
              ? 0
              : 0.4 * this.targetReveal * (1 - this.flatMix),
          this.reduced
            ? 35
            : this.deferSelectionPulse &&
                !this.targetDetail &&
                this.lift.value < 0.4
              ? 7.6
              : 4.2,
          dt,
        );
      }
    }
    const cameraTarget = this.targetDetail
      ? ease((this.lift.value - 0.8) / 2.4)
      : this.returnY !== null
        ? this.detail
        : ease((this.lift.value - 0.4) / (INSPECTION_LIFT - 0.4));
    this.detail = cinematic
      ? cinematic.zoom
      : THREE.MathUtils.lerp(this.detail, cameraTarget, blend);
    const detail = this.detail;
    this.decryption.update(dt, detail > .78 && this.lift.value > 3.3, this.reduced,
      cinematic ? shot + 5 : undefined);
    this.appearance.apply(this.model, ease(this.lift.value / 0.4));
    this.appearance.setClarity(this.model, this.decryption.clarity);
    // Reference 26.92–27.76: the array travels horizontally into a white field.
    const entry = cinematic ? ease((shot - 21.9) / 0.86) : this.reveal;
    const entranceTime = THREE.MathUtils.clamp((shot - 21.92) / 0.75, 0, 1);
    const entryZ = cinematic
      ? -23 * (1 - entranceTime) ** 2
      : -28 * (1 - entry);
    for (let i = this.outgoing.length - 1; i >= 0; i--) {
      const o = this.outgoing[i];
      const p = this.cellPosition(o.cell);
      const baseY = p.y + field(o.cell.row, o.cell.lane);
      o.group.rotation.y = returnStep(o.group.rotation.y, dt, this.reduced);
      if (o.returnY !== null) {
        o.lift.value = o.returnY - baseY;
        o.lift.velocity = 0;
        if (o.group.rotation.y === 0) o.returnY = null;
      } else damp(o.lift, 0, this.reduced ? 35 : 4.5, dt);
      o.group.position.set(
        p.x - trackX,
        baseY + o.lift.value + hoverLift(o.cell) - this.presentationDrop(o.cell),
        p.z + entryZ + this.rail.value,
      );
      const quality = ease(o.lift.value / 0.4);
      this.appearance.apply(o.group, quality);
      this.appearance.setTheme(o.group, this.theme.sample(o.cell, time), indexDim(o.lift.value));
      o.clarity = this.reduced ? 0 : o.clarity * Math.exp(-dt * 9);
      this.appearance.setClarity(o.group, o.clarity);
      const { row, lane } = o.cell;
      o.group.rotation.x =
        (field(row + 0.5, lane) - field(row - 0.5, lane)) *
        0.024 *
        (1 - detail) *
        (1 - quality);
      if (o.lift.value < 0.0001 && Math.abs(o.group.rotation.y) < 0.0001) {
        this.scene.remove(o.group);
        this.appearance.dispose(o.group);
        this.outgoing.splice(i, 1);
      }
    }
    if (
      this.pendingPulse &&
      !cinematic &&
      !this.targetDetail &&
      this.targetReveal
    ) {
      const selectedY = selectedBase + this.lift.value;
      const oldCardsLower = this.outgoing.every(
        (old) =>
          old.cell.lane !== selectedLane ||
          Math.abs(old.cell.row - selectedRow) > 4 ||
          old.group.position.y + 0.015 < selectedY,
      );
      // The new file causes the wave: finish most of its rise and let nearby
      // outgoing files get below it before starting the outward pulse.
      if (this.lift.value >= 0.35 && this.returnY === null && oldCardsLower) {
        if (!this.reduced) this.emitPulse(this.pendingPulse);
        this.pendingPulse = null;
      }
    }
    this.appearance.setTheme(this.model, this.theme.sample(this.selectedCell, time), indexDim(this.lift.value));
    this.model.position.set(
      chosen.x - trackX,
      chosen.y + field(selectedRow, selectedLane) + this.lift.value + hoverLift(this.selectedCell) - this.presentationDrop(this.selectedCell),
      chosen.z + entryZ + this.rail.value,
    );
    // Extraction only changes elevation. Reframing belongs to the camera.
    this.model.rotation.set(
      (field(selectedRow + 0.5, selectedLane) -
        field(selectedRow - 0.5, selectedLane)) *
        0.024 *
        (1 - detail) *
        (1 - ease(this.lift.value / 0.4)),
      cinematic ? 0 : this.rotation,
      0,
    );
    // Measured from frame 787: X edge (382,-204), adjacent row (78,38).
    // The label vertical edge constrains height; the file base is occluded.
    // Do not calibrate field of view from the visible fragment of a file.
    const orbit = ease((shot - 22.6) / 1.6);
    const settle = ease((shot - 24.25) / 2.25);
    const yaw = THREE.MathUtils.degToRad(89 - 22 * orbit - 8 * settle);
    const elevation = THREE.MathUtils.degToRad(
      3 + 40 * ease((shot - 21.96) / 0.22) - 8 * orbit - 16 * settle,
    );
    const span = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(10.8, 10.3, orbit),
      7.33,
      settle,
    );
    const responsiveOpening = Boolean(cinematic) && this.container.closest<HTMLElement>("[data-layout]")?.dataset.layout === "opening";
    const openingAspect = responsiveOpening ? this.container.clientWidth / this.container.clientHeight / (16 / 9) : 1;
    const openingSpan = (value: number) => value / Math.min(1, openingAspect);
    const distance = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(28 + 7 * orbit, 140, settle),
      72,
      detail,
    );
    const arrayAim = new THREE.Vector3(
      -1.091,
      THREE.MathUtils.lerp(-2.55 + 0.4 * orbit, -0.045, settle),
      THREE.MathUtils.lerp(2.48, 0.481, settle),
    );
    const cameraAim = arrayAim.clone();
    const viewDirection = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(yaw) * Math.cos(elevation),
    );
    if (cinematic) {
      const earlyTurn = ease((shot - 27.3) / 1.3);
      const finalTurn = ease((shot - 28.6) / 5.4);
      const shotYaw =
        yaw - THREE.MathUtils.degToRad(9 * earlyTurn + 32 * finalTurn);
      const shotElevation =
        elevation - THREE.MathUtils.degToRad(1.5 * earlyTurn + 3.7 * finalTurn);
      viewDirection.set(
        -Math.sin(shotYaw) * Math.cos(shotElevation),
        Math.sin(shotElevation),
        Math.cos(shotYaw) * Math.cos(shotElevation),
      );
    } else {
      viewDirection
        .lerp(new THREE.Vector3(-0.277, 0.238, 0.931), detail)
        .normalize();
    }
    if (cinematic) {
      const pan = ease((shot - 25.4) / 0.95);
      const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), viewDirection)
        .normalize();
      cameraAim.addScaledVector(
        right,
        -2.05 * (1 - pan) * ease((shot - 24.2) / 0.8),
      );
    }
    if (cinematic && shot >= 25.05 && shot <= 27.3) {
      // Frames 760–785: the camera carries the same physical column from the
      // right into the selected position while the neighboring crests subside.
      const pan = ease((shot - 25.4) / 1.05);
      const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), viewDirection)
        .normalize();
      const up = new THREE.Vector3()
        .crossVectors(viewDirection, right)
        .normalize();
      const pixelScale = 1080 / openingSpan(span);
      const anchorAim = this.model.position
        .clone()
        .add(new THREE.Vector3(-2.5, 3.7, 0));
      anchorAim.addScaledVector(
        right,
        -(THREE.MathUtils.lerp(840, 518, pan) - 960) * openingAspect / pixelScale,
      );
      anchorAim.addScaledVector(
        up,
        -(540 - THREE.MathUtils.lerp(340, 288, pan)) / pixelScale,
      );
      cameraAim.lerp(anchorAim, ease((shot - 25.05) / 0.35));
    }
    if (cinematic && shot > 27.3) {
      const close = ease((shot - 27.3) / 6.7);
      const extractionCamera = ease((shot - 27.3) / 1.25);
      const screenX = THREE.MathUtils.lerp(
        518 - 98 * extractionCamera,
        618,
        close,
      );
      const screenY = THREE.MathUtils.lerp(
        296 + 34 * extractionCamera,
        287,
        close,
      );
      const pixelScale = 1080 / openingSpan(THREE.MathUtils.lerp(span, 5.9, detail));
      const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), viewDirection)
        .normalize();
      const up = new THREE.Vector3()
        .crossVectors(viewDirection, right)
        .normalize();
      const anchorAim = this.model.position
        .clone()
        .add(new THREE.Vector3(-2.5, 3.7, 0));
      anchorAim.addScaledVector(right, -(screenX - 960) * openingAspect / pixelScale);
      anchorAim.addScaledVector(up, -(540 - screenY) / pixelScale);
      cameraAim.lerp(anchorAim, ease((shot - 27.3) / 0.5));
    }
    const framing = archiveFraming(this.container.clientWidth, this.container.clientHeight, span, detail,
      this.container.closest<HTMLElement>("[data-layout]")?.dataset.layout === "compact");
    if (!cinematic) {
      const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), viewDirection)
        .normalize();
      const up = new THREE.Vector3()
        .crossVectors(viewDirection, right)
        .normalize();
      const width = this.container.clientWidth, height = this.container.clientHeight;
      const pixelScale = height / framing.span;
      if (framing.portrait) {
        // Keep the preview camera independent of the live lift, wave and rail.
        // Following model.position here would visually cancel those motions.
        const previewAim = new THREE.Vector3(0, -4.6 + settlingWave(0, 26.56) + 0.4 + 1.85, -2.17);
        previewAim.addScaledVector(up, (framing.previewY - 0.5) * height / pixelScale);
        cameraAim.copy(previewAim);
      }
      const detailAim = this.model.position
        .clone()
        .add(new THREE.Vector3(0, 1.85, 0));
      detailAim.addScaledVector(right, (0.5 - framing.detailX) * width / pixelScale);
      detailAim.addScaledVector(up, (framing.detailY - 0.5) * height / pixelScale);
      cameraAim.lerp(detailAim, detail);
    }
    const cameraPosition = cameraAim
      .clone()
      .addScaledVector(viewDirection, distance);
    if (!cinematic && !this.reduced && !this.uiOnlyParallax) {
      cameraPosition.x += this.pointer.x * 0.12;
      cameraPosition.y -= this.pointer.y * 0.12;
    }
    const cameraBlend = cinematic ? 1 : 1 - Math.exp(-dt * 5);
    this.camera.position.lerp(cameraPosition, cameraBlend);
    this.cameraAim.lerp(cameraAim, cameraBlend);
    this.camera.lookAt(this.cameraAim);
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      THREE.MathUtils.radToDeg(
        2 * Math.atan((cinematic ? openingSpan(THREE.MathUtils.lerp(span, 5.9, detail)) : framing.span) / (2 * distance)),
      ),
      cameraBlend,
    );
    const fog = this.scene.fog as THREE.Fog;
    // The camera position is damped after its target distance changes. Anchor
    // fog to the rendered camera, or entry puts the array behind the far plane
    // until the camera catches up (a brief white wash that exit never showed).
    const renderedDistance = this.camera.position.distanceTo(this.cameraAim);
    const fogTheme = this.themeAmount;
    fog.near = renderedDistance + THREE.MathUtils.lerp(5 - 4 * fogTheme, -1, detail);
    fog.far = renderedDistance + THREE.MathUtils.lerp(25 - 9 * fogTheme, 12, detail);

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // Build and compact the instance set only after the actual damped camera
    // is final for this frame. Picking uses the same packed index-to-cell map.
    const fixed = (Boolean(cinematic) || !this.looping) && !responsiveOpening;
    this.cells = fixed ? Array.from({ length: 160 }, (_, i) => poolCell(i))
      : this.visibility.update(this.camera, fog.far, trackX, entryZ + this.rail.value, this.extraCoverage);
    const hidden = new Set(this.outgoing.map(o => cellKey(o.cell)));
    hidden.add(cellKey(this.selectedCell));
    this.drawnCells = [];
    this.relayPoints.clear();
    for (const cell of this.cells) {
      const { row, lane } = cell;
      if (hidden.has(cellKey(cell))) continue;
      const x = (lane - 2) * COLUMN_SPACING - trackX;
      const y = -4.6 + field(row, lane) + hoverLift(cell) - this.presentationDrop(cell);
      const z = (row - 15.5) * ROW_SPACING + entryZ + this.rail.value;
      if (!fixed && !this.visibility.intersects(x, y, z)) continue;
      const i = this.drawnCells.length;
      this.ensureInstanceCapacity(i + 1);
      this.drawnCells.push(cell);
      this.themeAttribute?.setX(i, this.theme.sample(cell, time));
      const slope = field(row + .5, lane) - field(row - .5, lane);
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(slope * .024 * (1 - detail), 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      if (play.enabled) this.relayPoints.set(cellKey(cell), { cell: { ...cell }, point: new THREE.Vector3(0, 3.5, 0).applyMatrix4(this.dummy.matrix) });
      for (const inst of this.instances) inst.setMatrixAt(i, this.dummy.matrix);
    }
    for (const inst of this.instances) {
      inst.count = this.drawnCells.length;
      inst.instanceMatrix.needsUpdate = true;
    }
    // Picking uses only the first instanced surface. The other batches disable
    // renderer culling and do not need an O(n) bound recomputation each frame.
    this.instances[0]?.computeBoundingSphere();
    if (this.themeAttribute) this.themeAttribute.needsUpdate = true;
    let neighborTop = -Infinity;
    const lane = selectedLane,
      row = selectedRow;
    for (let r = row - 5; r <= row + 5; r++) {
      if (r !== row)
        neighborTop = Math.max(neighborTop, -4.6 + field(r, lane) + 3.76);
    }
    for (const o of this.outgoing) {
      if (o.cell.lane === lane && Math.abs(o.cell.row - row) <= 5) {
        neighborTop = Math.max(neighborTop, o.group.position.y + 3.76);
      }
    }
    this.clearance = this.model.position.y - neighborTop;
    this.canInspect =
      !cinematic &&
      Boolean(this.targetDetail) &&
      detail > 0.9 &&
      this.pulseGain < 0.01 &&
      this.clearance > 0.3;
    this.container.dataset.inspection =
      this.returnY !== null
        ? "aligning"
        : this.canInspect
          ? "ready"
          : this.targetDetail
            ? "lifting"
            : "preview";
    const focalPoint = this.model.position
      .clone()
      .add(new THREE.Vector3(0, 2, 0))
      .applyMatrix4(this.camera.matrixWorldInverse);
    const bokehUniforms = this.bokeh.uniforms as Record<
      string,
      { value: number }
    >;
    bokehUniforms.focus.value = -focalPoint.z;
    bokehUniforms.aperture.value =
      (THREE.MathUtils.lerp(0.0003, 0.0008, detail) *
        this.quality.depthOfField) /
      100;
    this.renderer.info.reset();
    if (this.superPerformance) this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }
  projectCard(x: number, y: number) {
    this.model.updateMatrixWorld(true);
    const p = this.model
      .localToWorld(new THREE.Vector3(x, y, 0.255))
      .project(this.camera);
    return [(p.x + 1) * this.container.clientWidth / 2, (1 - p.y) * this.container.clientHeight / 2];
  }
  get decryptionFrame() { return this.decryption.frame; }
  finishDecryption() { this.decryption.finish(); }
  get detailVisibility() {
    return ease((this.detail - 0.25) / 0.55);
  }
  getStats() {
    this.model.updateMatrixWorld(true);
    const project = (x: number, y: number, z: number) => {
      const p = this.model
        .localToWorld(new THREE.Vector3(x, y, z))
        .project(this.camera);
      return [Math.round((p.x + 1) * this.container.clientWidth / 2), Math.round((1 - p.y) * this.container.clientHeight / 2)];
    };
    return {
      decryption: { ...this.decryption.frame, clarity: this.decryption.clarity },
      topLeft: project(-2.5, 3.7, 0),
      topRight: project(2.5, 3.7, 0),
      labelTopLeft: project(-1.855, 3.27, 0.255),
      labelBottomLeft: project(-1.855, 2.81, 0.255),
      modelPosition: this.model.position
        .toArray()
        .map((v) => Math.round(v * 10000) / 10000),
      cameraPosition: this.camera.position
        .toArray()
        .map((v) => Math.round(v * 10000) / 10000),
      fieldOfView: this.camera.fov,
      loaded: this.loaded,
      drawCalls: this.renderer.info.render.calls,
      superPerformance: this.superPerformance,
      presentation: this.presence,
      triangles: this.renderer.info.render.triangles,
      archiveCount: this.drawnCells.length,
      archiveCandidates: this.cells.length,
      archiveCulled: this.cells.length - this.drawnCells.length,
      archiveCapacity: this.instanceCapacity,
      archiveCoverage: this.extraCoverage ? "extra" : "standard",
      returningFiles: this.outgoing.length,
      selectionPhase: this.pendingPulse
        ? "lifting"
        : this.pulses.length
          ? "wave"
          : "settled",
      pendingPulse: this.pendingPulse ? { ...this.pendingPulse } : null,
      pulses: this.pulses.map((pulse) => ({ ...pulse })),
      referenceTime: Math.round((this.scanTime + 5) * 100) / 100,
      selectedSlot: this.selectedSlot,
      selectedLane: Math.floor(this.selectedSlot / 32),
      selectedCell: { ...this.selectedCell },
      hoverCell: this.hoverCell ? { ...this.hoverCell } : null,
      hoverLifts: Object.fromEntries(this.hoverLifts),
      dragTrack: this.dragTrack ? { ...this.dragTrack } : null,
      archiveMomentum: this.archiveMomentum ? {
        phase: this.archiveMomentum.motion.phase,
        value: this.archiveMomentum.motion.value,
        velocity: this.archiveMomentum.motion.velocity,
      } : null,
      holdingArchive: this.holdingArchive,
      dragProjection: this.dragProjection(),
      dragMapping: this.archiveDrag.active ? "free" : null,
      coordinateOrigin: { ...this.coordinateOrigin },
      poolBounds: {
        minLane: Math.min(...this.cells.map((c) => c.lane)),
        maxLane: Math.max(...this.cells.map((c) => c.lane)),
        minRow: Math.min(...this.cells.map((c) => c.row)),
        maxRow: Math.max(...this.cells.map((c) => c.row)),
      },
      laneFocus: this.laneFocus.value,
      columnCamera: this.columnCamera.value,
      rotation: this.rotation,
      clearance: this.clearance,
      canInspect: this.canInspect,
      returnPhase: this.returnY !== null ? "aligning" : "lowering",
      extraction: Math.round(this.lift.value * 1000) / 1000,
      appearance: Math.round(ease(this.lift.value / 0.4) * 1000) / 1000,
      cameraDetail: Math.round(this.detail * 1000) / 1000,
      idleGain: this.idleGain,
      flatten: this.flatMix,
      spectrumActivity: this.playfield.bands.activity,
      selectedIndexDim: this.model.children.find(child => child.userData.surface === "Index_Inlay")?.userData.subduedIndex?.value,
      returningIndexDims: this.outgoing.map(o => ({ cell: o.cell, dim: o.group.children.find(child => child.userData.surface === "Index_Inlay")?.userData.subduedIndex?.value })),
      cameraDistance: this.camera.position.distanceTo(this.cameraAim),
      cameraNear: this.camera.near,
      cameraFar: this.camera.far,
      fogNear: (this.scene.fog as THREE.Fog).near,
      fogFar: (this.scene.fog as THREE.Fog).far,
      returningAppearance: this.outgoing.map((o) => ({
        slot: o.slot,
        cell: { ...o.cell },
        lift: o.lift.value,
        quality: ease(o.lift.value / 0.4),
        rotation: o.group.rotation.y,
        worldY: o.group.position.y,
        phase: o.returnY !== null ? "aligning" : "lowering",
      })),
      rail: Math.round(this.rail.value * 1000) / 1000,
    };
  }
}
