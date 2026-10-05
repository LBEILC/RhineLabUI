/** Desktop-only camera framing. Portrait/mobile branches are intentionally absent. */
export function archiveFraming(width: number, height: number, span: number, detail: number, _compact: boolean) {
  const base = span + (6.8 - span) * detail
  return { span: Math.max(base, base * (16 / 9) / (width / height)), portrait: false, previewY: .5, detailX: .285, detailY: .55 }
}
