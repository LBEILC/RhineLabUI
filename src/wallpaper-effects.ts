import { wallpaperHost, type WallpaperProperties } from "./wallpaper";
import type { ArchiveScene } from "./scene";
import "./wallpaper-effects.css";

export function effectOptions(props: WallpaperProperties) {
  const flag = (key: string) => props[key]?.value === true;
  const amount = (key: string, fallback: number) => {
    const value = props[key]?.value;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : fallback;
  };
  return { parallax: flag("hudparallax"), depth: amount("huddepth", .4), frost: flag("uifrost"), frostStrength: amount("uifroststrength", .55), screen: flag("screenfinish"), grain: amount("screengrain", .2), fringe: amount("screenfringe", .2), vignette: amount("screenvignette", .25) };
}

/** DOM-only pointer depth. The renderer and its camera never receive this input. */
export class WallpaperEffects {
  private props: WallpaperProperties = {};
  private pointer = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private last = 0;
  constructor(private stage: HTMLElement, private scene: () => ArchiveScene | undefined) {
    Object.assign(this.props, wallpaperHost()?.properties ?? {});
    window.addEventListener("rhine-wallpaper-properties", event => Object.assign(this.props, (event as CustomEvent<WallpaperProperties>).detail));
    stage.addEventListener("pointermove", event => {
      if (event.pointerType === "touch") return;
      const rect = stage.getBoundingClientRect();
      this.pointer.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      this.pointer.y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    }, { passive: true });
    const reset = () => { this.pointer.x = this.pointer.y = 0; };
    stage.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    stage.querySelectorAll<HTMLElement>(":scope > .brand, :scope > .system-nav, :scope > .system-footer, :scope > #archive-ui, :scope > #detail-ui, :scope > .powered, :scope > .workbench, :scope > .relay-entry, :scope > .relay-hud").forEach(node => node.classList.add("hud-depth-layer"));
    stage.querySelectorAll<HTMLElement>(".brand, .system-nav, .system-footer, .wb-time, .wb-today, .wb-module, .wb-nav button, .archive-callout, .archive-counter, .column-navigation, .archive-hint, .detail-content, .back-button, .object-caption, .relay-heading, .relay-actions, .relay-entry").forEach(node => node.classList.add("frost-surface"));
  }
  update(time: number, reduced: boolean) {
    const options = effectOptions(this.props);
    const active = this.stage.dataset.mode !== "boot";
    const moving = active && options.parallax && !reduced && !this.stage.querySelector("#modal-root")?.childElementCount;
    const dt = this.last ? Math.min(.1, Math.max(0, time - this.last)) : 0;
    this.last = time;
    const blend = reduced ? 1 : 1 - Math.exp(-dt * 7);
    const tx = moving ? this.pointer.x * options.depth : 0, ty = moving ? this.pointer.y * options.depth : 0;
    this.current.x += (tx - this.current.x) * blend;
    this.current.y += (ty - this.current.y) * blend;
    const { x, y } = this.current, length = Math.hypot(x, y);
    this.stage.dataset.hudDepth = String(active && (options.parallax || length > .0001) && !reduced);
    this.stage.dataset.uiFrost = String(active && options.frost && options.frostStrength > 0);
    this.stage.style.setProperty("--hud-x", `${x * 14}px`);
    this.stage.style.setProperty("--hud-y", `${y * 10}px`);
    this.stage.style.setProperty("--hud-axis-x", String(length ? -y / length : 1));
    this.stage.style.setProperty("--hud-axis-y", String(length ? x / length : 0));
    this.stage.style.setProperty("--hud-angle", `${length * 1.5}deg`);
    this.stage.style.setProperty("--frost-blur", `${options.frostStrength * 24}px`);
    this.stage.style.setProperty("--frost-tint", String(options.frostStrength * .65));
    const scene = this.scene();
    if (scene) {
      scene.uiOnlyParallax = options.parallax;
      scene.setScreenEffects(active && options.screen, options.grain, options.fringe, options.vignette);
    }
  }
}
