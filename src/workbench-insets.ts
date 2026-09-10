/** Use layout coordinates so HUD projection and entrance animation cannot feed
 * their transformed bounds back into the collision layout. */
export function layoutWorkbenchInsets(stage: HTMLElement, bottom: number): boolean {
  const root = stage.querySelector<HTMLElement>(".workbench");
  if (!root) return false;
  let changed = false;
  const set = (node: HTMLElement, key: string, value: string) => {
    if (node.style.getPropertyValue(key) === value) return;
    changed = true;
    if (value) node.style.setProperty(key, value); else node.style.removeProperty(key);
  };
  const box = (node: HTMLElement) => {
    let x = 0, y = 0;
    for (let current: HTMLElement | null = node; current && current !== stage; current = current.offsetParent as HTMLElement | null) {
      x += current.offsetLeft; y += current.offsetTop;
    }
    return { x, y, right: x + node.offsetWidth, bottom: y + node.offsetHeight };
  };
  const visible = (node: HTMLElement) => node.offsetWidth > 0 && node.offsetHeight > 0 && getComputedStyle(node).visibility !== "hidden";
  const enabled = bottom > 0 && stage.dataset.workbench === "true" && stage.dataset.mode !== "boot" && !matchMedia("(max-width: 700px)").matches;
  const blockers = [...stage.querySelectorAll<HTMLElement>(".wb-nav button, .relay-entry, .system-footer > *")].filter(visible).map(box);
  const headers = [...stage.querySelectorAll<HTMLElement>(".brand, .system-nav")].filter(visible).map(box);
  const origin = box(root);
  for (const panel of root.querySelectorAll<HTMLElement>(".wb-overview, .wb-module")) {
    if (!enabled || panel.hidden || !panel.offsetWidth) {
      for (const key of ["top", "max-height", "overflow-y", "pointer-events"]) set(panel, key, "");
      continue;
    }
    const rect = box(panel), natural = panel.scrollHeight;
    const baseline = root.clientHeight * Number(getComputedStyle(panel).getPropertyValue("--wb-anchor-top")) / 100;
    const overlaps = (other: typeof rect) => other.right > rect.x && other.x < rect.right;
    const ceiling = Math.min(baseline, Math.max(0, ...headers.filter(overlaps).map(b => b.bottom - origin.y + 24)));
    const floor = Math.min(root.clientHeight, ...blockers.filter(overlaps).map(b => b.y - origin.y - 24));
    // Remain at the normal anchor until the lower controls actually approach.
    // Once the header limits travel, give the content its own scroll area.
    const top = Math.max(ceiling, Math.min(baseline, floor - natural));
    const height = Math.max(0, floor - top);
    set(panel, "top", `${top.toFixed(2)}px`);
    set(panel, "max-height", `${height.toFixed(2)}px`);
    set(panel, "overflow-y", "auto");
    set(panel, "pointer-events", "auto");
  }
  return changed;
}
