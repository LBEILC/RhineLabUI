import { wallpaperHost, type WallpaperProperties } from "./wallpaper";
import type { ArchiveScene } from "./scene";
import { HudProjection } from "./hud-projection";
import { ScreenFinish } from "./screen-finish";
import "./wallpaper-effects.css";

export function effectOptions(props: WallpaperProperties) {
  const flag = (key: string) => props[key]?.value === true;
  const amount = (key: string, fallback: number) => {
    const value = props[key]?.value;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : fallback;
  };
  return { parallax: flag("hudparallax"), tracking: props.hudtracking?.value !== false, depth: amount("huddepth", .4), frost: flag("uifrost"), frostStrength: amount("uifroststrength", .55), screen: flag("screenfinish"), grain: amount("screengrain", .2), grainSize: amount("screengrainsize", .35), fringe: amount("screenfringe", .2), vignette: amount("screenvignette", .25) };
}

/** DOM-only pointer depth. The renderer and its camera never receive this input. */
export class WallpaperEffects {
  private props: WallpaperProperties = {};
  private pointer = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private depth = 0;
  private last = 0;
  private projection: HudProjection;
  private finish: ScreenFinish;
  constructor(private stage: HTMLElement, private scene: () => ArchiveScene | undefined) {
    this.projection = new HudProjection(stage);
    this.finish = new ScreenFinish(stage);
    Object.assign(this.props, wallpaperHost()?.properties ?? {});
    window.addEventListener("rhine-wallpaper-properties", event => {
      Object.assign(this.props, (event as CustomEvent<WallpaperProperties>).detail);
      this.projection.invalidate();
    });
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
    stage.querySelectorAll<HTMLElement>(".brand, .system-nav, .system-footer > span, .system-footer > button, .wb-time, .wb-today, .wb-module, .wb-nav button, .archive-callout, .archive-counter, .column-navigation, .archive-hint, .detail-content, .back-button, .object-caption, .relay-heading, .relay-actions, .relay-entry").forEach(node => node.classList.add("frost-surface"));
  }
  update(time: number, reduced: boolean) {
    const options = effectOptions(this.props);
    const active = this.stage.dataset.mode !== "boot";
    const moving = active && options.parallax && options.tracking && !reduced && !this.stage.querySelector("#modal-root")?.childElementCount;
    const dt = this.last ? Math.min(.1, Math.max(0, time - this.last)) : 0;
    this.last = time;
    const blend = reduced ? 1 : 1 - Math.exp(-dt * 7);
    const tx = moving ? this.pointer.x : 0, ty = moving ? this.pointer.y : 0;
    this.current.x += (tx - this.current.x) * blend;
    this.current.y += (ty - this.current.y) * blend;
    this.depth += ((active && options.parallax ? options.depth : 0) - this.depth) * blend;
    this.projection.update(active ? this.depth : 0, this.current);
    this.stage.dataset.hudTracking = String(moving);
    this.stage.dataset.uiFrost = String(active && options.frost && options.frostStrength > 0);
    this.stage.style.setProperty("--frost-blur", `${options.frostStrength * 24}px`);
    this.stage.style.setProperty("--frost-tint", String(options.frostStrength * .65));
    const scene = this.scene();
    if (scene) {
      // Wallpaper pointer depth belongs exclusively to the HUD, including when
      // its switch is off. Explicit card dragging still uses the scene inputs.
      scene.uiOnlyParallax = true;
    }
    this.finish.update(options.screen, options.grain, options.fringe, options.vignette, options.grainSize, time, reduced);
  }
}
