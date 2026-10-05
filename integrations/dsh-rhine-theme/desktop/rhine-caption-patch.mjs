/** Version-gated preload edits. Preserve the host observer, symbol colour and IPC. */
const patches = [
  ['const color = nativeColor(style.backgroundColor);', 'const color = nativeColor(style.getPropertyValue("--rh-native-caption-fill").trim() || style.backgroundColor);'],
  ['attributeFilter: ["data-ds-dark-theme", "style"]', 'attributeFilter: ["data-ds-dark-theme", "style", "data-rhine"]'],
]
export function installCaptionPatch(source) {
  for (const [original, replacement] of patches) {
    if (source.includes(replacement)) continue
    if (source.split(original).length !== 2) throw new Error('Desktop caption entrypoint differs from DSH 0.2.0-rc.2; no files were changed.')
    source = source.replace(original, replacement)
  }
  return source
}
export function removeCaptionPatch(source) {
  for (const [original, replacement] of patches) source = source.replace(replacement, original)
  return source
}
