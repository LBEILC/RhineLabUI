export type HudPoint = { x: number; y: number };

/** Radial HUD surface with a bounded frame; tracking varies tangential terms. */
export function projectHudPoint(point: HudPoint, width: number, height: number, depth: number, pointer: HudPoint): HudPoint {
  const aspect = width / height;
  const x = (point.x / width * 2 - 1) * aspect, y = point.y / height * 2 - 1;
  const radius = x * x + y * y, curvature = depth * .08;
  const fit = 1 / (1 + curvature * (aspect * aspect + 1));
  const cx = pointer.x * .0075 * depth, cy = pointer.y * .0075 * depth;
  const tx = 2 * cy * x * y + cx * (radius + 2 * x * x);
  const ty = cy * (radius + 2 * y * y) + 2 * cx * x * y;
  return { x: width / 2 + (x * (1 + curvature * radius) - tx) * fit * height / 2,
    y: height / 2 + (y * (1 + curvature * radius) - ty) * fit * height / 2 };
}

/** Project a DOM box to four corners; browser hit testing follows the trapezoid. */
export function hudQuadMatrix(width: number, height: number, quad: HudPoint[]): number[] {
  const [a, b, c, d] = quad;
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(determinant) > 1e-9 ? (dx3 * dy2 - dx2 * dy3) / determinant : 0;
  const h = Math.abs(determinant) > 1e-9 ? (dx1 * dy3 - dx3 * dy1) / determinant : 0;
  return [(b.x - a.x + g * b.x) / width, (b.y - a.y + g * b.y) / width, 0, g / width,
    (d.x - a.x + h * d.x) / height, (d.y - a.y + h * d.y) / height, 0, h / height,
    0, 0, 1, 0, a.x, a.y, 0, 1];
}

type HudPanel = { node: HTMLElement; width: number; height: number; origin: HudPoint; corners: HudPoint[] };
const bootPanels = ".access-text, .boot-logo, .auth-status, .scan, .welcome";
const panels = ".brand, .system-nav, .system-footer > span, .system-footer > button, .powered, .wb-overview, .wb-module, .wb-nav > button, .archive-callout, .archive-counter, .archive-navigation, .column-navigation, .archive-hint, .detail-content, .back-button, .object-caption, .relay-entry, .relay-heading, .relay-actions";

export class HudProjection {
  private nodes: HTMLElement[];
  private measured: HudPanel[] = [];
  private dirty = true;
  private width = 1920;
  private height = 1080;
  private layout = "";
  private observer: ResizeObserver;
  constructor(private stage: HTMLElement) {
    this.nodes = [...stage.querySelectorAll<HTMLElement>(`${panels}, ${bootPanels}`)];
    this.nodes.forEach(node => node.classList.add("hud-surface"));
    this.observer = new ResizeObserver(() => this.invalidate());
    this.observer.observe(stage);
    this.nodes.forEach(node => this.observer.observe(node));
    document.fonts.ready.then(() => this.invalidate());
  }
  invalidate() { this.dirty = true; }
  private measure() {
    // Read rest poses without the HUD transform, retaining native responsive transforms.
    const enabled = this.stage.dataset.hudDepth;
    this.stage.dataset.hudDepth = "false";
    const stageRect = this.stage.getBoundingClientRect();
    this.width = this.stage.offsetWidth; this.height = this.stage.offsetHeight;
    const scale = stageRect.width / this.width;
    this.measured = [];
    const styles = new Map<HTMLElement, CSSStyleDeclaration>();
    const readStyle = (node: HTMLElement) => {
      if (!styles.has(node)) styles.set(node, getComputedStyle(node));
      return styles.get(node)!;
    };
    const boot = this.stage.dataset.mode === "boot";
    for (const node of this.nodes) {
      if (boot && !node.matches(`${bootPanels}, .brand, .powered`)) continue;
      if (!boot && node.matches(bootPanels)) continue;
      if (!node.offsetWidth || !node.offsetHeight || !node.getClientRects().length) continue;
      const style = readStyle(node), rect = node.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
      const [ox, oy] = style.transformOrigin.split(" ").map(parseFloat);
      const width = node.offsetWidth, height = node.offsetHeight;
      const corners = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }].map(p => {
        const q = matrix.transformPoint({ x: p.x - ox, y: p.y - oy });
        return { x: q.x / q.w + ox, y: q.y / q.w + oy };
      });
      // The workbench's separate entrance translation continues around this
      // static projection; do not bake an in-flight 9px offset into the rest pose.
      const entrance = { x: 0, y: 0 };
      for (let ancestor: HTMLElement | null = node; ancestor && ancestor !== this.stage; ancestor = ancestor.parentElement) {
        const translate = readStyle(ancestor).translate.split(" ");
        entrance.x += parseFloat(translate[0]) || 0;
        entrance.y += parseFloat(translate[1]) || 0;
      }
      const origin = { x: (rect.left - stageRect.left) / scale - entrance.x - Math.min(...corners.map(p => p.x)), y: (rect.top - stageRect.top) / scale - entrance.y - Math.min(...corners.map(p => p.y)) };
      this.measured.push({ node, width, height, origin, corners: corners.map(p => ({ x: p.x + origin.x, y: p.y + origin.y })) });
    }
    this.stage.dataset.hudDepth = enabled ?? "false";
    this.dirty = false;
  }
  update(depth: number, pointer: HudPoint) {
    const layout = `${this.stage.dataset.layout}/${this.stage.dataset.mode}/${this.stage.dataset.workbench}`;
    if (layout !== this.layout) { this.layout = layout; this.invalidate(); }
    if (depth < .00001) { this.stage.dataset.hudDepth = "false"; return; }
    // Boot transforms and text dimensions follow the authored timeline each frame.
    // Measure that current pose before composing the HUD, never cache an in-flight scale.
    if (this.dirty || this.stage.dataset.mode === "boot") this.measure();
    for (const panel of this.measured) {
      const corners = panel.corners.map(point => {
        const q = projectHudPoint(point, this.width, this.height, depth, pointer);
        return { x: q.x - panel.origin.x, y: q.y - panel.origin.y };
      });
      const matrix = hudQuadMatrix(panel.width, panel.height, corners);
      panel.node.style.setProperty("--hud-projection", `matrix3d(${matrix.map(n => Number(n.toFixed(9))).join(",")})`);
    }
    this.stage.dataset.hudDepth = "true";
  }
}
