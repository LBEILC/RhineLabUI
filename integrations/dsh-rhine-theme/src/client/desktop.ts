interface RhineDesktopBridge { windowAction?(action: 'minimize' | 'fullscreen' | 'close'): Promise<void>; setActive(active: boolean): Promise<{ width: number; height: number; minWidth: number; minHeight: number; fullscreen: boolean }> }
declare global { interface Window { rhineDesktop?: RhineDesktopBridge } }
/** The native bridge is supplied by the theme's reversible desktop installation. */
export async function setDesktopScene(active: boolean): Promise<void> {
  if (!window.rhineDesktop) return
  try {
    const result = await window.rhineDesktop.setActive(active)
    document.documentElement.toggleAttribute('data-fullscreen', result.fullscreen)
  }
  catch (error) { console.error('Rhine desktop window policy failed', error) }
}
