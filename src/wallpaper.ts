export const isWallpaper = import.meta.env.MODE === "wallpaper";
if (isWallpaper) document.documentElement.dataset.wallpaper = "true";
export type WallpaperProperties = Record<string, { value: unknown }>;
declare global {
  interface Window {
    rhineWallpaperPropertiesReady?: Promise<void>;
    rhineWallpaperHost?: { properties: WallpaperProperties; fps: number; paused: boolean };
  }
}
export const wallpaperHost = () => window.rhineWallpaperHost;
let lastFrame: number | undefined;
export function wallpaperFrame(ms: number) {
  if (!isWallpaper) return true;
  const host = wallpaperHost();
  if (host?.paused) { lastFrame = undefined; return false; }
  const interval = 1000 / (host?.fps ?? 30);
  if (lastFrame !== undefined && ms - lastFrame < interval - 0.5) return false;
  // Quantize elapsed intervals with the same tolerance as the admission check;
  // floating-point values just below one interval must not retain a full interval.
  lastFrame = lastFrame === undefined ? ms : lastFrame + Math.max(1, Math.floor((ms - lastFrame + 0.5) / interval)) * interval;
  return true;
}
