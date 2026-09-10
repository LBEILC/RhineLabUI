// Classic script runs before deferred modules, retaining initial host callbacks.
window.rhineWallpaperHost = { properties: {}, fps: 30, paused: false };
window.wallpaperPropertyListener = {
  applyUserProperties(properties) {
    Object.assign(window.rhineWallpaperHost.properties, properties);
    window.dispatchEvent(new CustomEvent("rhine-wallpaper-properties", { detail: properties }));
  },
  applyGeneralProperties(properties) {
    if (Number.isFinite(properties.fps) && properties.fps > 0)
      window.rhineWallpaperHost.fps = properties.fps;
  },
  setPaused(paused) {
    window.rhineWallpaperHost.paused = !!paused;
    window.dispatchEvent(new Event("rhine-wallpaper-pause"));
  },
};
