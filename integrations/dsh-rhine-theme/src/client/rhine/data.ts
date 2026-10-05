// DSH adapter: physical columns carry real workspaces; rows carry real sessions.
export interface ArchiveProject { id: string; title: string; files: readonly { id: string; title: string }[] }
interface FileRecord { id: string; title: string; project: string; lane: number; row: number }
export let archiveColumns: string[] = ['catalog', 'catalog', 'catalog']
export let records: FileRecord[] = [{ id: '__home__', title: 'RHINE LAB', project: '__home__', lane: 2, row: 12 }]
export function configureArchive(projects: readonly ArchiveProject[]) {
  archiveColumns = ['catalog', 'catalog', 'catalog', ...projects.map(project => project.id)]
  records = [{ id: '__home__', title: 'RHINE LAB', project: '__home__', lane: 2, row: 12 }]
  projects.forEach((project, index) => {
    const files = project.files.length ? project.files : [{ id: `empty:${project.id}`, title: project.title }]
    files.forEach((file, row) => records.push({ ...file, project: project.id, lane: index + 3, row: row + 12 }))
  })
}
export function columnFiles(lane: number) {
  const files = records.flatMap((record, index) => record.lane === lane ? [index] : [])
  return files.length ? files : [0]
}
export function fileLocation(index: number) {
  const file = records[index] ?? records[0]
  return { lane: file.lane, row: file.row, slot: index }
}
export function fileAtSlot(slot: number) { return records[slot] ? slot : 0 }
export function fileIndex(project: string | null, session: string | null) {
  if (!project) return 0
  const exact = session ? records.findIndex(file => file.id === session) : -1
  return exact >= 0 ? exact : Math.max(0, records.findIndex(file => file.project === project))
}
