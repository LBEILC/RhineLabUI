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

// Register immediately: the host may deliver media before the module is ready.
window.rhineWallpaperMedia = {};
for (const kind of ["Status", "Properties", "Thumbnail", "Playback", "Timeline"]) {
  const register = window["wallpaperRegisterMedia" + kind + "Listener"];
  if (typeof register === "function") register(function (event) {
    window.rhineWallpaperMedia[kind.toLowerCase()] = event;
    if (kind === "Properties") {
      delete window.rhineWallpaperMedia.thumbnail;
      delete window.rhineWallpaperMedia.timeline;
    }
    if (kind === "Playback") {
      const constants = window.wallpaperMediaIntegration || {};
      window.rhineWallpaperMedia.playing = event.state === (constants.PLAYBACK_PLAYING ?? constants.playback?.PLAYING ?? 1);
    }
    window.dispatchEvent(new Event("rhine-wallpaper-media"));
  });
}
