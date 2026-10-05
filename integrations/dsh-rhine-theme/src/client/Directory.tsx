import type { SidebarRootComponentProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { useRhine } from './runtime.tsx'
import { Icon, Mark } from './Icons.tsx'

/** Secondary management surface preserves the host's workspace and extension actions. */
export function Directory({ startSession, toggleSidebar, selectPanel, usePanels, usePanelInfo, renderSlot }: SidebarRootComponentProps) {
  const { copy } = useRhine(), panels = usePanels(s => s), panel = usePanelInfo(s => s.activePanelId)
  return <aside className="rh-directory-content">
    <div className="rh-directory-head"><div><h2>{copy('manage')}</h2><span>ARCHIVE ADMINISTRATION</span></div><button type="button" aria-label={copy('close')} onClick={toggleSidebar}><Icon kind="close" /></button></div>
    <button type="button" className="rh-directory-new" onClick={() => { startSession(); toggleSidebar() }}><span>{copy('new')}</span><Icon kind="plus" /></button>
    <div className="rh-workspaces" aria-label={copy('workspaces')}>{renderSlot('sidebar.workspaces', { wide: true, expandSidebar: () => {} })}</div>
    {panels.length > 0 && <div className="rh-panels"><h3>{copy('tools')}</h3>{panels.map(item => <button type="button" key={item.id} aria-current={panel === item.id ? 'page' : undefined} onClick={() => { selectPanel(item.id); toggleSidebar() }}>{renderSlot('sidebar.panellist', { size: 18, active: panel === item.id }, { only: item.id })}<span>{item.label}</span><Icon kind="arrow" size={16} /></button>)}</div>}
    <div className="rh-directory-footer"><Mark /><span>RHINE LAB</span>{renderSlot('sidebar.footer.action', { wide: false })}</div>
  </aside>
}
