import { app, BrowserWindow, ipcMain, screen } from 'electron'

const windows = new Map()
const fraction = Math.sqrt(.7)
function limits(window, display = screen.getDisplayMatching(window.getBounds())) {
  const area = display.workAreaSize
  return { width: Math.ceil(area.width * fraction), height: Math.ceil(area.height * fraction) }
}
function enforce(window, display) {
  if (window.isDestroyed()) return
  const minimum = limits(window, display), existing = window.getMinimumSize()
  if (existing[0] !== minimum.width || existing[1] !== minimum.height) window.setMinimumSize(minimum.width, minimum.height)
  if (!window.isFullScreen() && !window.isMaximized()) {
    const bounds = window.getBounds()
    if (bounds.width < minimum.width || bounds.height < minimum.height) window.setSize(Math.max(bounds.width, minimum.width), Math.max(bounds.height, minimum.height))
  }
}
function updateTitle(window, saved) {
  if (window.isDestroyed()) return
  const title = saved.title + (window.isFullScreen() ? '' : ' — 按 F11 全屏')
  if (window.getTitle() !== title) window.setTitle(title)
}
function restore(window) {
  const saved = windows.get(window)
  if (!saved) return
  windows.delete(window)
  window.removeListener('resize', saved.update); window.removeListener('move', saved.update)
  window.removeListener('leave-full-screen', saved.leaveFullscreen)
  window.removeListener('enter-full-screen', saved.enterFullscreen)
  clearTimeout(saved.centerTimer)
  if (!window.webContents.isDestroyed()) window.webContents.removeListener('before-input-event', saved.keydown)
  window.removeListener('page-title-updated', saved.pageTitle)
  if (window.isDestroyed()) return
  window.setTitle(saved.title)
  window.setMinimumSize(...saved.minimum)
  if (!saved.fullscreen && window.isFullScreen()) window.setFullScreen(false)
}
ipcMain.handle('rhine-desktop:scene-policy', (event, active) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith('dsh-app://app/') || typeof active !== 'boolean') throw new Error('Invalid archive window request')
  if (active && !windows.has(window)) {
    const saved = { minimum: window.getMinimumSize(), fullscreen: window.isFullScreen(), title: window.getTitle(), displayId: screen.getDisplayMatching(window.getBounds()).id, centerTimer: undefined, enterFullscreen: () => {
      clearTimeout(saved.centerTimer); saved.centerTimer = undefined; saved.update()
    }, leaveFullscreen: () => {
      clearTimeout(saved.centerTimer)
      // On Windows this event fires BEFORE isFullScreen()/getBounds() change.
      // Defer one native turn, and cancel if re-entered or the theme is removed.
      saved.centerTimer = setTimeout(() => {
      saved.centerTimer = undefined
      if (!windows.has(window) || window.isDestroyed() || window.isFullScreen()) return
      // Center once after the native restore, never on ordinary move/resize.
      // Electron workArea uses DIP coordinates, including taskbars and displays
      // whose origins are negative; do not assume the primary display is (0, 0).
      const display = screen.getAllDisplays().find(item => item.id === saved.displayId) ?? screen.getDisplayMatching(window.getBounds())
      const minimum = limits(window, display), existing = window.getMinimumSize()
      if (existing[0] !== minimum.width || existing[1] !== minimum.height) window.setMinimumSize(minimum.width, minimum.height)
      if (!window.isMaximized()) {
        const area = display.workArea, bounds = window.getBounds()
        // Windows may still report the old restored size after setMinimumSize.
        // Compute final dimensions before centering; never center stale bounds.
        const width = Math.min(Math.max(bounds.width, minimum.width), area.width), height = Math.min(Math.max(bounds.height, minimum.height), area.height)
        window.setBounds({ x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2), width, height })
      }
      updateTitle(window, saved)
      window.webContents.send('rhine-desktop:fullscreen', false)
      }, 0)
    }, update: () => {
      if (window.isDestroyed()) return
      if (window.isFullScreen()) saved.displayId = screen.getDisplayMatching(window.getBounds()).id
      enforce(window)
      updateTitle(window, saved)
      window.webContents.send('rhine-desktop:fullscreen', window.isFullScreen())
    }, pageTitle: (event, title) => {
      // Keep the renderer's real document title intact. Only decorate the
      // native caption, and track new session titles while the theme is active.
      saved.title = title
      event.preventDefault()
      updateTitle(window, saved)
    }, keydown: (event, input) => {
      if (input.key !== 'F11' || input.alt || input.control || input.meta || input.shift) return
      if (!window.webContents.getURL().startsWith('dsh-app://app/')) return
      // Handle this before renderer shortcuts, including focused editors/modals.
      // Suppress repeats and Chromium's own accelerator to avoid double toggles.
      event.preventDefault()
      if (input.type === 'keyDown' && !input.isAutoRepeat && !window.isDestroyed()) window.setFullScreen(!window.isFullScreen())
    } }
    windows.set(window, saved)
    window.webContents.on('before-input-event', saved.keydown)
    window.on('page-title-updated', saved.pageTitle)
    window.on('resize', saved.update); window.on('move', saved.update); window.on('leave-full-screen', saved.leaveFullscreen); window.on('enter-full-screen', saved.enterFullscreen)
    window.once('closed', () => { clearTimeout(saved.centerTimer); windows.delete(window) })
    enforce(window); window.setFullScreen(true); updateTitle(window, saved)
  } else if (!active) restore(window)
  else enforce(window)
  const [minWidth, minHeight] = window.getMinimumSize(), { width, height } = window.getBounds()
  return { width, height, minWidth, minHeight, fullscreen: window.isFullScreen() }
})
app.whenReady().then(() => {
  screen.on('display-metrics-changed', () => { for (const window of windows.keys()) enforce(window) })
  screen.on('display-removed', () => { for (const window of windows.keys()) enforce(window) })
})

ipcMain.handle('rhine-desktop:window', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith('dsh-app://app/')) throw new Error('Invalid window request')
  switch (action) {
    case 'minimize': window.minimize(); break
    case 'fullscreen': window.setFullScreen(!window.isFullScreen()); break
    case 'close': window.close(); break
    default: throw new Error('Unknown window action')
  }
})
