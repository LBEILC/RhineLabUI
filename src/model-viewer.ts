import * as THREE from "three";
import { disposeThreeTree } from "./three-resources";
import { themeEnvironment } from "./theme-material";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createArchiveLighting } from "./archive-lighting";
import { damp } from "./motion";
import { ViewerCameraMotion } from "./viewer-camera";
import { normalizeQuality, type RenderQuality } from "./render-quality";
import {
  applyTextureQuality,
  createViewerPipeline,
  resizeQuality,
} from "./quality-renderer";

const PARTS = [
  { id: "fasteners", label: "紧固件", en: "FASTENERS", depth: 2.75 },
  { id: "cover", label: "透明盖板", en: "OPTICAL COVER", depth: 1.85 },
  {
    id: "optical-lenses",
    label: "折射环组",
    en: "REFRACTIVE RINGS",
    depth: 0.75,
  },
  { id: "optical-core", label: "光学核心", en: "OPTICAL CORE", depth: -0.15 },
  { id: "substrate", label: "信息基板", en: "SUBSTRATE", depth: -1.1 },
  { id: "carrier", label: "背板与框架", en: "CARRIER", depth: -2.05 },
] as const;

type ModelSource = { model: THREE.Group; dispose: () => void; setClarity?: (value: number) => void };
export class ModelViewer {
  private themeAmount = 0;
  setTheme(value: number) { this.themeAmount = value; }
  readonly root: HTMLElement;
  private canvasHost: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private pipeline: ReturnType<typeof createViewerPipeline>;
  private quality = normalizeQuality(undefined);
  private superPerformance = false;
  dispose() {
    this.request++;
    if (this.isOpen) this.finishClose();
    this.controls.dispose();
    disposeThreeTree(this.scene);
    for (const pass of this.pipeline.composer.passes) pass.dispose();
    this.pipeline.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.root.remove();
  }
  setSuperPerformance(enabled: boolean) {
    if (this.superPerformance === enabled) return;
    this.superPerformance = enabled;
    this.resize();
  }
  private appliedQuality = "";
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 120);
  private controlCamera = this.camera.clone();
  private cameraMotion = new ViewerCameraMotion(this.camera);
  private controls: OrbitControls;
  private source?: ModelSource;
  private groups = new Map<string, THREE.Group>();
  private spread = { value: 0, velocity: 0 };
  private targetSpread = 0;
  private clarity = { value: 1, velocity: 0 };
  private targetClarity = 1;
  private lastTime = 0;
  private request = 0;
  private reduced = false;
  private loading = false;
  private closing = false;
  private transitions: Animation[] = [];
  private transitionId = 0;
  private status = "";
  private opener: HTMLElement | null = null;
  private siblings: { node: HTMLElement; inert: boolean }[] = [];
  private initialCamera = new THREE.Vector3(7.2, 3.8, 12);
  private onClose: () => void;
  private provider?: () => Promise<ModelSource>;
  isOpen = false;

  constructor(
    parent: HTMLElement,
    onClose: () => void,
    private onSound: (
      sound: "explode" | "assemble" | "tick",
    ) => void = () => {},
  ) {
    this.onClose = onClose;
    this.root = document.createElement("section");
    this.root.className = "model-viewer";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "viewer-title");
    this.root.innerHTML = `
      <div class="viewer-canvas"></div>
      <div class="scene-atmosphere viewer-atmosphere" aria-hidden="true"></div>
      <header class="viewer-header">
        <button class="viewer-back" data-viewer="close">← <span>返回档案</span><kbd>ESC</kbd></button>
        <div class="viewer-heading"><span>RHINE LAB / OBJECT STUDY</span><h2 id="viewer-title">档案模型</h2><p id="viewer-file"></p></div>
        <span class="viewer-index">360<span>°</span></span>
      </header>
      <div class="viewer-surface" role="group" aria-label="玻璃模式"><button data-viewer="clear" aria-pressed="true">清晰</button><button data-viewer="frosted" aria-pressed="false">磨砂</button></div>
      <aside class="viewer-parts" aria-label="模型装配结构"><div>ASSEMBLY / 装配结构</div>${PARTS.map((p, i) => `<p><span>${String(i + 1).padStart(2, "0")}</span><strong>${p.label}</strong><small>${p.en}</small></p>`).join("")}</aside>
      <div class="viewer-loading" role="status"><span>正在载入模型…</span><button data-viewer="retry" hidden>重新载入 ↗</button></div>
      <footer class="viewer-footer">
        <div class="viewer-help"><span>拖动旋转</span><span>↑ ↓ ← → 平移</span><span>滚轮缩放</span></div>
        <div class="viewer-actions"><button data-viewer="explode" aria-pressed="false"><span>＋</span> 拆解档案</button><button data-viewer="assemble" aria-pressed="true"><span>−</span> 一键重组</button></div>
        <button class="viewer-reset" data-viewer="reset">复位视角 <span>↗</span></button>
      </footer>
      <div class="viewer-state" aria-live="polite">已组装</div>`;
    parent.appendChild(this.root);
    this.canvasHost = this.root.querySelector(".viewer-canvas")!;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "档案三维模型：拖动旋转，方向键平移，滚轮或加减键缩放，Home 复位",
    );
    this.canvasHost.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color("#eae5e1");
    this.scene.fog = new THREE.Fog("#eae5e1", 13.5, 26.5);
    // Render-target textures belong to their WebGL context. Recreate the main
    // scene's light room here so this renderer receives its actual illumination.
    createArchiveLighting(this.renderer, this.scene);
    this.camera.position.copy(this.initialCamera);
    this.controlCamera.copy(this.camera);
    this.controls = new OrbitControls(
      this.controlCamera,
      this.renderer.domElement,
    );
    this.controls.enableDamping = false;
    this.pipeline = createViewerPipeline(
      this.renderer,
      this.scene,
      this.camera,
    );
    this.pipeline.smaa.enabled = false;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.7;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 28;
    this.controls.maxTargetRadius = 5;
    this.controls.screenSpacePanning = true;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.enabled = false;
    this.controls.update();
    this.cameraMotion.snap(this.controlCamera, this.controls.target);
    this.controls.addEventListener("start", () => this.interruptReset());
    this.root.addEventListener("click", (event) => {
      if (this.closing) return;
      const action = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-viewer]",
      )?.dataset.viewer;
      if (action === "close") this.close();
      if (action === "retry") void this.load();
      if (this.loading || !this.source) return;
      if (action === "clear" || action === "frosted") {
        this.setSurface(action === "clear");
        this.onSound("tick");
      }
      if (action === "explode" && this.targetSpread !== 1) {
        this.setExploded(true);
        this.onSound("explode");
      }
      if (action === "assemble" && this.targetSpread !== 0) {
        this.setExploded(false);
        this.onSound("assemble");
      }
      if (action === "reset") {
        this.resetView();
        this.onSound("tick");
      }
    });
    this.root.addEventListener("keydown", (event) => this.keydown(event));
  }

  open(
    id: string,
    title: string,
    provider: () => Promise<ModelSource>,
    reduced: boolean,
  ) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.closing = false;
    this.reduced = reduced;
    this.provider = provider;
    this.opener = document.activeElement as HTMLElement | null;
    this.siblings = [...this.root.parentElement!.children]
      .filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node !== this.root,
      )
      .map((node) => ({ node, inert: node.inert }));
    this.siblings.forEach(({ node }) => (node.inert = true));
    this.root.hidden = false;
    this.root.dataset.transition = "opening";
    this.root.querySelector("#viewer-title")!.textContent = title;
    this.root.querySelector("#viewer-file")!.textContent =
      "FILE " + id + " / INTERNAL DATABASE";
    this.spread = { value: 0, velocity: 0 };
    this.targetSpread = 0;
    this.clarity = { value: 1, velocity: 0 };
    this.setSurface(true);
    this.lastTime = 0;
    this.root.dataset.exploded = "false";
    this.resetView(false);
    this.resize();
    this.renderer.domElement.focus({ preventScroll: true });
    this.enter();
    void this.load();
  }

  private async load() {
    if (!this.provider || this.loading) return;
    const ticket = ++this.request;
    this.loading = true;
    this.controls.enabled = false;
    const loading = this.root.querySelector<HTMLElement>(".viewer-loading")!;
    loading.hidden = false;
    loading.querySelector("span")!.textContent = "正在载入模型…";
    loading.querySelector<HTMLElement>("button")!.hidden = true;
    this.setButtonsDisabled(true);
    try {
      const source = await this.provider();
      if (!this.isOpen || this.closing || ticket !== this.request) {
        source.dispose();
        return;
      }
      this.source = source;
      for (const part of PARTS) {
        const group = new THREE.Group();
        group.name = part.id;
        this.groups.set(part.id, group);
      }
      for (const child of [...source.model.children]) {
        const group = this.groups.get(child.userData.assemblyPart ?? "cover");
        group?.add(child);
      }
      for (const group of this.groups.values()) source.model.add(group);
      source.model.position.set(0, -1.85, 0);
      this.scene.add(source.model);
      applyTextureQuality(source.model, this.renderer, this.quality);
      this.loading = false;
      loading.hidden = true;
      this.controls.enabled = true;
      this.setButtonsDisabled(false);
      this.setExploded(false);
      this.setStatus("已组装");
      // Render before revealing the canvas so a new model never flashes in.
      this.update(this.lastTime);
      if (!this.reduced)
        this.transitions.push(
          this.canvasHost.animate(
            [
              { opacity: 0, transform: "scale(0.97)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          ),
        );
    } catch (error) {
      if (!this.isOpen || this.closing || ticket !== this.request) return;
      this.loading = false;
      loading.querySelector("span")!.textContent = "模型载入失败，请重试";
      loading.querySelector<HTMLElement>("button")!.hidden = false;
      console.error("Model viewer failed to load", error);
    }
  }

  private enter() {
    const ticket = ++this.transitionId;
    this.transitions.forEach((animation) => animation.cancel());
    this.transitions = [];
    if (this.reduced) {
      this.root.dataset.transition = "open";
      return;
    }
    const fade = this.root.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 320,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    this.transitions.push(fade);
    for (const selector of [
      ".viewer-header",
      ".viewer-footer",
      ".viewer-state",
    ]) {
      const element = this.root.querySelector<HTMLElement>(selector)!;
      this.transitions.push(
        element.animate(
          [
            { opacity: 0, translate: "0 10px" },
            { opacity: 1, translate: "0 0" },
          ],
          {
            duration: 300,
            delay: 60,
            fill: "backwards",
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ),
      );
    }
    void fade.finished
      .then(() => {
        if (ticket === this.transitionId) this.root.dataset.transition = "open";
      })
      .catch(() => {});
  }

  close() {
    if (!this.isOpen || this.closing) return;
    this.closing = true;
    this.request++;
    this.loading = false;
    this.controls.enabled = false;
    this.setButtonsDisabled(true);
    const ticket = ++this.transitionId;
    // Capture the current fade when Escape interrupts opening.
    const opacity = getComputedStyle(this.root).opacity;
    const canvasStyle = getComputedStyle(this.canvasHost);
    const canvasOpacity = canvasStyle.opacity;
    const transform = canvasStyle.transform;
    this.transitions.forEach((animation) => animation.cancel());
    this.transitions = [];
    this.root.dataset.transition = "closing";
    if (this.reduced) {
      this.finishClose();
      return;
    }
    const fade = this.root.animate([{ opacity }, { opacity: 0 }], {
      duration: 220,
      easing: "cubic-bezier(0.4, 0, 1, 1)",
      fill: "forwards",
    });
    this.transitions.push(
      fade,
      this.canvasHost.animate(
        [
          { transform, opacity: canvasOpacity },
          { transform: "scale(0.97)", opacity: 0 },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.4, 0, 1, 1)",
          fill: "forwards",
        },
      ),
    );
    void fade.finished
      .then(() => {
        if (ticket === this.transitionId) this.finishClose();
      })
      .catch(() => {});
  }

  private finishClose() {
    // Keep rendering and retain modal focus until the visible exit completes.
    this.isOpen = false;
    this.closing = false;
    this.root.hidden = true;
    this.transitions.forEach((animation) => animation.cancel());
    this.transitions = [];
    if (this.source) {
      this.scene.remove(this.source.model);
      this.source.dispose();
      this.source = undefined;
    }
    this.groups.clear();
    this.siblings.forEach(({ node, inert }) => (node.inert = inert));
    this.siblings = [];
    this.opener?.focus({ preventScroll: true });
    this.onClose();
  }

  private setButtonsDisabled(disabled: boolean) {
    for (const action of ["explode", "assemble", "reset", "clear", "frosted"]) {
      this.root.querySelector<HTMLButtonElement>(
        `[data-viewer="${action}"]`,
      )!.disabled = disabled;
    }
  }
  private setSurface(clear: boolean) {
    this.targetClarity = clear ? 1 : 0;
    this.root.dataset.surface = clear ? "clear" : "frosted";
    this.root.querySelector('[data-viewer="clear"]')!.setAttribute("aria-pressed", String(clear));
    this.root.querySelector('[data-viewer="frosted"]')!.setAttribute("aria-pressed", String(!clear));
    if (this.reduced) this.clarity = { value: this.targetClarity, velocity: 0 };
  }
  private setExploded(value: boolean) {
    this.targetSpread = value ? 1 : 0;
    this.root.dataset.exploded = String(value);
    this.root
      .querySelector('[data-viewer="explode"]')!
      .setAttribute("aria-pressed", String(value));
    this.root
      .querySelector('[data-viewer="assemble"]')!
      .setAttribute("aria-pressed", String(!value));
    this.setStatus(
      value ? "正在拆解" : this.spread.value > 0.001 ? "正在重组" : "已组装",
    );
    if (this.reduced) this.spread = { value: this.targetSpread, velocity: 0 };
  }
  private setStatus(value: string) {
    if (value !== this.status) {
      this.status = value;
      this.root.querySelector(".viewer-state")!.textContent = value;
    }
  }
  private resetView(animated = true) {
    this.controls.enabled = false;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.target.set(0, 0, 0);
    this.controlCamera.position.copy(this.initialCamera);
    this.controls.enableDamping = false;
    this.controls.update();
    if (animated && !this.reduced) this.cameraMotion.reset();
    else this.cameraMotion.snap(this.controlCamera, this.controls.target);
    this.controls.enabled =
      this.isOpen && !this.loading && Boolean(this.source);
  }
  private interruptReset() {
    if (!this.cameraMotion.resetting) return;
    this.cameraMotion.interruptReset(this.controlCamera, this.controls.target);
    this.controls.update();
  }
  private keydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }
    if (this.closing) {
      event.preventDefault();
      return;
    }
    if (event.key === "Tab") {
      const elements = [
        ...this.root.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([hidden]),canvas[tabindex="0"]',
        ),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (!this.source || this.loading) return;
    if (event.key === "Home") {
      event.preventDefault();
      this.resetView();
      this.onSound("tick");
      return;
    }
    if (["+", "=", "-"].includes(event.key)) {
      event.preventDefault();
      this.interruptReset();
      const distance = this.controlCamera.position.distanceTo(
        this.controls.target,
      );
      const next = THREE.MathUtils.clamp(
        distance * (event.key === "-" ? 1.12 : 1 / 1.12),
        5,
        28,
      );
      this.controlCamera.position
        .sub(this.controls.target)
        .multiplyScalar(next / distance)
        .add(this.controls.target);
      this.controls.update();
      return;
    }
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      this.interruptReset();
      const right = new THREE.Vector3().setFromMatrixColumn(
        this.camera.matrix,
        0,
      );
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
      const delta = new THREE.Vector3();
      const step =
        this.controlCamera.position.distanceTo(this.controls.target) * 0.025;
      if (event.key === "ArrowLeft") delta.addScaledVector(right, -step);
      if (event.key === "ArrowRight") delta.addScaledVector(right, step);
      if (event.key === "ArrowUp") delta.addScaledVector(up, step);
      if (event.key === "ArrowDown") delta.addScaledVector(up, -step);
      // Clamp the requested focus before moving the camera by the same amount.
      // This preserves orbit radius at the panning limit.
      const previous = this.controls.target.clone();
      this.controls.target.add(delta);
      this.controls.target.clampLength(0, this.controls.maxTargetRadius);
      this.controlCamera.position.add(
        this.controls.target.clone().sub(previous),
      );
      this.controls.update();
    }
  }

  setQuality(quality: RenderQuality) {
    const key = JSON.stringify(quality);
    if (this.appliedQuality === key) return;
    this.appliedQuality = key;
    this.quality = normalizeQuality(quality);
    this.pipeline.smaa.enabled = this.quality.antialias === "smaa";
    applyTextureQuality(this.scene, this.renderer, this.quality);
    this.resize();
  }

  resize() {
    if (!this.isOpen) return;
    const width = this.canvasHost.clientWidth,
      height = this.canvasHost.clientHeight;
    resizeQuality(
      this.renderer,
      this.pipeline.composer,
      this.canvasHost,
      this.quality,
      this.superPerformance,
    );
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.controlCamera.aspect = this.camera.aspect;
    this.controlCamera.updateProjectionMatrix();
    const touch = matchMedia("(pointer: coarse)").matches;
    const help = this.root.querySelector(".viewer-help")!;
    help.innerHTML = touch
      ? "<span>单指旋转</span><span>双指缩放 / 平移</span>"
      : "<span>拖动旋转</span><span>↑ ↓ ← → 平移</span><span>滚轮缩放</span>";
  }

  update(time: number) {
    if (!this.isOpen) return;
    themeEnvironment(this.scene, this.renderer, this.themeAmount);
    this.source?.model.traverse(child => { if (child.userData.themeAmount) child.userData.themeAmount.value = this.themeAmount; });
    const dt = Math.min(this.lastTime ? time - this.lastTime : 1 / 60, 0.05);
    this.lastTime = time;
    if (this.source) {
      damp(this.clarity, this.targetClarity, 8, dt);
      if (Math.abs(this.clarity.value - this.targetClarity) < .0001 && Math.abs(this.clarity.velocity) < .001)
        this.clarity = { value: this.targetClarity, velocity: 0 };
      this.source.setClarity?.(this.clarity.value);
      damp(this.spread, this.targetSpread, this.reduced ? 45 : 5.5, dt);
      if (
        Math.abs(this.spread.value - this.targetSpread) < 0.0001 &&
        Math.abs(this.spread.velocity) < 0.001
      ) {
        this.spread = { value: this.targetSpread, velocity: 0 };
        this.setStatus(this.targetSpread ? "已拆解" : "已组装");
      }
      for (const part of PARTS) {
        this.groups.get(part.id)!.position.z = part.depth * this.spread.value;
      }
    }
    this.controls.update();
    this.cameraMotion.update(
      this.controlCamera,
      this.controls.target,
      dt,
      this.reduced,
    );
    const portrait = this.root.closest<HTMLElement>("[data-layout]")?.dataset.layout === "portrait";
    const zoom = portrait ? Math.min(1.15, this.camera.aspect / 0.85) / (1 + 0.08 * this.spread.value) : 1;
    if (this.camera.zoom !== zoom) {
      this.camera.zoom = zoom;
      this.controlCamera.zoom = zoom;
      this.camera.updateProjectionMatrix();
      this.controlCamera.updateProjectionMatrix();
    }
    // Match the detail scene's gentle haze without washing out the object as
    // the user zooms. The assembled model is centered on the world origin.
    const fog = this.scene.fog as THREE.Fog;
    const objectDistance = this.camera.position.length();
    fog.near = Math.max(0, objectDistance - 1);
    fog.far = objectDistance + 12;
    if (this.quality.antialias === "smaa") this.pipeline.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.root.dataset.stats = JSON.stringify({
      ready: Boolean(this.source),
      clarity: this.clarity.value,
      targetClarity: this.targetClarity,
      spread: this.spread.value,
      target: this.targetSpread,
      distance: this.camera.position.distanceTo(this.cameraMotion.focus),
      targetPosition: this.cameraMotion.focus.toArray(),
      requestedTarget: this.controls.target.toArray(),
      requestedDistance: this.controlCamera.position.distanceTo(
        this.controls.target,
      ),
      cameraPosition: this.camera.position.toArray(),
      resetting: this.cameraMotion.resetting,
      azimuth: this.controls.getAzimuthalAngle(),
      polar: this.controls.getPolarAngle(),
      parts: [...this.groups].map(([id, group]) => ({
        id,
        z: group.position.z,
        meshes: group.children.length,
      })),
    });
  }
}
