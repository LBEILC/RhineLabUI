export function Icon({ kind, size = 20 }: { kind: 'plus' | 'index' | 'arrow' | 'close' | 'layers' | 'reset' | 'sun' | 'focus' | 'folder' | 'chevron' | 'settings'; size?: number }) {
  const paths = {
    plus: 'M12 4v16M4 12h16', index: 'M4 5h16M4 12h16M4 19h16M8 5v14',
    arrow: 'M4 12h16m-6-6 6 6-6 6', close: 'm5 5 14 14M19 5 5 19',
    layers: 'm3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5',
    reset: 'M4 10a8 8 0 1 1 1 8M4 4v6h6', sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    focus: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6', folder: 'M3 6h7l2 3h9v11H3V6Z',
    chevron: 'm6 9 6 6 6-6', settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><path d={paths[kind]} /></svg>
}
export function Mark() { return <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 27V9h9l6 9-6 9H8Zm9-18v18m-9-9h20M23 9l5 9-5 9" /></svg> }
