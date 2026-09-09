import {
  SCAN_FROM,
  SCAN_TO,
  SCAN_CORNERS,
  type DecryptionFrame,
} from "./decryption";

export function inspectionSegments(frame: DecryptionFrame) {
  const point = (t: number): [number, number] => [
    SCAN_FROM[0] + (SCAN_TO[0] - SCAN_FROM[0]) * t,
    SCAN_FROM[1] + (SCAN_TO[1] - SCAN_FROM[1]) * t,
  ];
  return frame.intervals.map(([a, b]) => [point(a), point(b)] as const);
}

export class InspectionOverlay {
  private root = document.querySelector<SVGSVGElement>("#inspection-marks")!;
  private line = this.root.querySelector<SVGPathElement>("#inspection-lines")!;
  private corners = this.root.querySelector<SVGGElement>(
    "#inspection-corners",
  )!;
  private point =
    this.root.querySelector<SVGCircleElement>("#inspection-point")!;
  private label = document.querySelector<HTMLElement>("#inspection-text")!;

  render(
    frame: DecryptionFrame,
    project: (x: number, y: number) => number[],
    showLabel: boolean,
  ) {
    const host = document.querySelector<HTMLElement>("#three-scene")!;
    this.root.setAttribute("viewBox", `0 0 ${host.clientWidth} ${host.clientHeight}`);
    this.root.style.opacity =
      frame.intervals.length || frame.markers > 0 || frame.point > 0
        ? "1"
        : "0";
    this.root.dataset.phase = frame.phase;
    this.root.dataset.referenceTime = frame.time.toFixed(3);
    this.line.setAttribute(
      "d",
      inspectionSegments(frame)
        .map(([a, b]) => `M${project(...a)}L${project(...b)}`)
        .join(""),
    );
    this.corners.style.opacity = String(frame.markers);
    this.corners.innerHTML =
      frame.markers > 0
        ? SCAN_CORNERS.map(([x, y]) => {
            const [px, py] = project(x, y);
            return `<rect x="${px - 4}" y="${py - 4}" width="8" height="8"/>`;
          }).join("")
        : "";
    const [cx, cy] = project(
      (SCAN_FROM[0] + SCAN_TO[0]) / 2,
      (SCAN_FROM[1] + SCAN_TO[1]) / 2,
    );
    this.point.setAttribute("cx", String(cx));
    this.point.setAttribute("cy", String(cy));
    this.point.style.opacity = String(frame.point);
    this.label.style.opacity = String(showLabel ? frame.label : 0);
    this.label.querySelector<HTMLElement>("strong")!.style.opacity = String(
      frame.labelValue,
    );
  }
}
