import { copyFile, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const root = resolve("release/wallpaper");
const project = JSON.parse(await readFile("wallpaper/project.json", "utf8"));
if (project.general?.supportsaudioprocessing !== true || Object.hasOwn(project, "supportsaudioprocessing"))
  throw new Error("Wallpaper audio requires general.supportsaudioprocessing=true");
// Only trim generated output, never the source public directory.
for (const name of ["update.html", "update.js", "manifest.webmanifest", "audio/observatory-preview.mp3", "assets/archive-cassette.glb", "assets/archive-assembly.glb"]) {
  const target = resolve(root, name);
  if (!target.startsWith(root + sep)) throw new Error("Output path escapes wallpaper directory");
  await rm(target, { force: true });
}
await copyFile("wallpaper/project.json", resolve(root, "project.json"));
await copyFile("docs/media/archive.jpg", resolve(root, "preview.jpg"));
if (project.preview === "preview.gif") await copyFile("wallpaper/preview.gif", resolve(root, "preview.gif"));
await copyFile("LICENSE", resolve(root, "LICENSE"));
const html = await readFile(resolve(root, "index.html"), "utf8");
if (/\b(?:src|href)=["']\//.test(html)) throw new Error("Wallpaper HTML contains root-relative URLs");
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push({ path: relative(root, path).replaceAll("\\", "/"), bytes: (await stat(path)).size });
  }
}
await walk(root);
await writeFile(resolve(root, "build-files.json"), JSON.stringify(files, null, 2) + "\n");
console.log(`Wallpaper ready: ${root} (${files.length} files, ${(files.reduce((n, f) => n + f.bytes, 0) / 1048576).toFixed(1)} MiB)`);
