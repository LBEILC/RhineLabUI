import type { WallpaperProperties } from "./wallpaper";
import { wallpaperImageUrl } from "./wallpaper-image-url";

/** A DOM image remains available after the WebGL contexts have been released. */
export class WallpaperBackground {
  private path = "";
  private ticket = 0;
  private enabled = false;
  private released = false;
  private reduced = false;
  private image?: HTMLImageElement;
  private failed = false;
  private root = document.createElement("div");
  constructor(private parent: HTMLElement, private notify: (message: string) => void) {
    this.root.className = "wallpaper-background";
    this.root.setAttribute("aria-hidden", "true");
    // Above the opaque WebGL canvas so the image can fade while it restarts,
    // beneath the atmosphere and all normal interface elements.
    parent.querySelector("#three-scene")!.after(this.root);
  }
  update(properties: WallpaperProperties, released: boolean, reduced: boolean, retry = false) {
    this.enabled = properties.customwallpaper?.value === true;
    this.released = released;
    this.reduced = reduced;
    const amount = Number(properties.customwallpapermask?.value ?? 100);
    const range = Number.isFinite(amount) ? Math.max(0, Math.min(100, amount)) : 100;
    this.parent.style.setProperty("--wallpaper-mask-range", `${range}%`);
    this.parent.style.setProperty("--wallpaper-mask-visible", range === 0 ? "0" : "1");
    this.root.style.transitionDuration = reduced ? "0s" : "650ms";
    const path = String(properties.customwallpaperfile?.value || "");
    if (path !== this.path || (retry && this.failed && path)) {
      this.path = path;
      this.failed = false;
      const ticket = ++this.ticket;
      if (!path) { this.image?.remove(); this.image = undefined; }
      else {
        const next = new Image();
        next.alt = "";
        next.onload = () => {
          if (ticket !== this.ticket) return;
          const old = this.image;
          this.image = next;
          next.style.opacity = "0";
          this.root.append(next);
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (ticket !== this.ticket) { next.remove(); return; }
            next.style.opacity = "1";
            if (old) {
              old.style.opacity = "0";
              setTimeout(() => old.remove(), this.reduced ? 0 : 700);
            }
          }));
          this.paint();
        };
        next.onerror = () => {
          if (ticket !== this.ticket) return;
          this.failed = true;
          this.image?.remove(); this.image = undefined; this.paint();
          this.notify("自定义壁纸无法读取，请在 Wallpaper Engine 属性中重新选择图片。");
        };
        next.src = wallpaperImageUrl(path);
      }
    }
    this.paint();
  }
  private paint() {
    this.parent.dataset.customWallpaperVisible = String(this.enabled && this.released && Boolean(this.image));
    this.root.style.opacity = this.enabled && this.released && this.image ? "1" : "0";
    this.root.dataset.ready = String(Boolean(this.image));
    this.root.dataset.reduced = String(this.reduced);
  }
}
