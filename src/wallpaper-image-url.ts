/** Host file properties may contain a raw Windows path or an escaped path. */
export function wallpaperImageUrl(value: string) {
  let path = value.replaceAll("\\", "/");
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (/^file:/i.test(path)) {
    // This is already a URL: preserve escaped filename characters, but repair
    // an escaped drive separator without escaping the percent sign again.
    return path.replace(/^(file:\/{2,3})([a-z])%3a(?=\/)/i, "$1$2:");
  }
  if (/^\/?[a-z]%3a(?:\/|%2f)/i.test(path)) {
    try { path = decodeURIComponent(path); }
    catch { path = path.replace(/^\/?([a-z])%3a/i, "$1:"); }
  }
  const encodePath = (text: string) => text.split("/").map(part => encodeURIComponent(part)).join("/");
  const drive = path.match(/^\/?([a-z]):\//i);
  // Keep the drive outside the encoding operation entirely.
  if (drive) return `file:///${drive[1]}:/${encodePath(path.slice(drive[0].length))}`;
  if (path.startsWith("//")) {
    const [server, ...parts] = path.slice(2).split("/");
    return `file://${server}/${encodePath(parts.join("/"))}`;
  }
  return path.startsWith("/") ? `file://${encodePath(path)}` : encodePath(path);
}
