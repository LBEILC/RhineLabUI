import content from '../.generated/site-records.json';

export const site = content.site;

export interface ArchiveRecord {
  id: string;
  title: string;
  en: string;
  department: string;
  category: string;
  date: string;
  lead: string;
  clearance: string;
  abstract: string;
  findings: string[];
  source: string;
  tags?: string[];
  reference?: string;
}

export const records: ArchiveRecord[] = content.records;
export const archiveColumns: string[] = content.categories;
export const categories = ['全部档案', ...archiveColumns];
export function columnFiles(lane: number) {
  const category = archiveColumns[((lane % archiveColumns.length) + archiveColumns.length) % archiveColumns.length];
  return records.flatMap((record, index) => record.category === category ? [index] : []);
}
export function fileLocation(index: number) {
  const lane = archiveColumns.indexOf(records[index].category);
  const row = 12 + columnFiles(lane).indexOf(index);
  return { lane, row, slot: lane * 32 + row };
}
export function fileAtSlot(slot: number) {
  const files = columnFiles(Math.floor(slot / 32));
  return files[Math.max(0, Math.min(files.length - 1, (slot % 32) - 12))];
}
