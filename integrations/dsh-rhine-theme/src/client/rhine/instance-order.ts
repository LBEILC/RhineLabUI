import { COLUMN_SPACING, ROW_SPACING, type ArchiveCell } from './archive-loop.ts'

/** These batches write depth and do not alpha-blend. Near instances first let
 * early-Z reject covered fragments before physical transmission is evaluated.
 * No geometry is removed; the packed picking map follows this same order.
 * Callers may pass a reusable target array to avoid a per-frame allocation;
 * the source array is never mutated.
 */
export function frontToBack(cells: readonly ArchiveCell[], view: ArrayLike<number>, target: ArchiveCell[] = []): ArchiveCell[] {
  const laneDepth = view[2] * COLUMN_SPACING, rowDepth = view[10] * ROW_SPACING
  target.length = 0
  for (const cell of cells) target.push(cell)
  return target.sort((a, b) => (b.lane - a.lane) * laneDepth + (b.row - a.row) * rowDepth)
}
