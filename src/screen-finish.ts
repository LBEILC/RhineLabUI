/** SourceGraphic includes WebGL, DOM controls, frosted surfaces and the viewer. */
export class ScreenFinish {
  private svg: SVGSVGElement;
  private filter: SVGFilterElement;
  private width = 0;
  private height = 0;
  private signature = "";
  private seed = -1;
  private mapCache?: { displacement: string; vignette: string };
  constructor(private stage: HTMLElement) {
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.classList.add("screen-finish-defs");
    this.svg.setAttribute("aria-hidden", "true");
    this.svg.innerHTML = `<defs><filter id="rhine-screen-finish" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"></filter></defs>`;
    document.body.append(this.svg);
    this.filter = this.svg.querySelector("filter")!;
  }
  private maps(width: number, height: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = Math.max(64, Math.round(384 * height / width));
    const ctx = canvas.getContext("2d")!;
    const map = ctx.createImageData(canvas.width, canvas.height);
    const vignette = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const u = x / (canvas.width - 1), v = y / (canvas.height - 1), i = (y * canvas.width + x) * 4;
      const edge = Math.min(1, Math.min(u, v, 1 - u, 1 - v) / .02);
      const fade = edge * edge * (3 - 2 * edge);
      map.data[i] = 128 + (u - .5) * 254 * fade;
      map.data[i + 1] = 128 + (v - .5) * 254 * height / width * fade;
      map.data[i + 2] = 128; map.data[i + 3] = 255;
      const radius = Math.hypot((u - .5) * 2, (v - .5) * 2) / Math.SQRT2;
      const shade = Math.round(255 * (1 - .85 * Math.pow(radius, 1.6)));
      vignette.data[i] = vignette.data[i + 1] = vignette.data[i + 2] = shade;
      vignette.data[i + 3] = 255;
    }
    ctx.putImageData(map, 0, 0); const displacement = canvas.toDataURL();
    ctx.putImageData(vignette, 0, 0); return { displacement, vignette: canvas.toDataURL() };
  }
  update(enabled: boolean, grain: number, fringe: number, vignette: number, size: number, time: number, reduced: boolean) {
    const active = enabled && (grain > 0 || fringe > 0 || vignette > 0);
    this.stage.dataset.screenFinish = String(active);
    if (!active) { this.stage.style.removeProperty("filter"); return; }
    const width = this.stage.offsetWidth, height = this.stage.offsetHeight;
    const signature = `${grain}/${fringe}/${vignette}/${size}/${width}/${height}`;
    if (signature !== this.signature) {
      this.signature = signature;
      const resized = width !== this.width || height !== this.height;
      this.width = width; this.height = height;
      this.filter.setAttribute("x", "0"); this.filter.setAttribute("y", "0");
      this.filter.setAttribute("width", String(width)); this.filter.setAttribute("height", String(height));
      const maps = (resized || !this.mapCache) ? this.maps(width, height) : this.mapCache;
      this.mapCache = maps;
      let input = "SourceGraphic", markup = "";
      const extent = `x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"`;
      if (fringe > 0) {
        const offset = fringe * 20 * width / 1920;
        markup += `<feImage href="${maps.displacement}" ${extent} result="encoded-map"/>
          <feColorMatrix in="encoded-map" values=".99609375 0 0 0 0  0 .99609375 0 0 0  0 0 1 0 0  0 0 0 1 0" result="channel-map"/>
          <feDisplacementMap in="SourceGraphic" in2="channel-map" scale="${offset}" xChannelSelector="R" yChannelSelector="G" result="red-shift"/>
          <feDisplacementMap in="SourceGraphic" in2="channel-map" scale="${-offset}" xChannelSelector="R" yChannelSelector="G" result="blue-shift"/>
          <feColorMatrix in="red-shift" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
          <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
          <feColorMatrix in="blue-shift" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
          <feBlend in="red" in2="green" mode="screen" result="rg"/>
          <feBlend in="rg" in2="blue" mode="screen" result="chroma"/>`;
        input = "chroma";
      }
      if (grain > 0) {
        markup += `<feTurbulence type="fractalNoise" baseFrequency="${.95 - size * .85}" numOctaves="1" seed="0" stitchTiles="stitch" result="noise"/>
          <feColorMatrix in="noise" type="saturate" values="0" result="mono-noise"/>
          <feComponentTransfer in="mono-noise" result="grain"><feFuncA type="linear" slope="0" intercept="${grain}"/></feComponentTransfer>
          <feBlend in="grain" in2="${input}" mode="soft-light" result="textured"/>`;
        input = "textured";
      }
      if (vignette > 0) markup += `<feImage href="${maps.vignette}" ${extent} result="edge-shade"/>
        <feComposite in="${input}" in2="edge-shade" operator="arithmetic" k1="${vignette}" k2="${1 - vignette}" k3="0" k4="0"/>`;
      this.filter.innerHTML = markup;
      this.seed = -1;
    }
    this.stage.style.filter = "url(#rhine-screen-finish)";
    const seed = reduced ? 0 : Math.floor(time * 12) % 97;
    if (grain > 0 && seed !== this.seed) {
      this.seed = seed;
      this.filter.querySelector("feTurbulence")?.setAttribute("seed", String(seed));
    }
  }
}
