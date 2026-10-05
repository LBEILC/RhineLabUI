;(() => {
  const { contextBridge, ipcRenderer } = require('electron')
  if (location.protocol === 'dsh-app:' && location.hostname === 'app' && process.isMainFrame) {
    ipcRenderer.on('rhine-desktop:fullscreen', (_event, fullscreen) => document.documentElement?.toggleAttribute('data-fullscreen', fullscreen))
    contextBridge.exposeInMainWorld('rhineDesktop', {
      setActive: active => ipcRenderer.invoke('rhine-desktop:scene-policy', active),
      windowAction: action => ipcRenderer.invoke('rhine-desktop:window', action),
    })
  }
})()
