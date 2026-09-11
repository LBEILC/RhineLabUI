import artwork from "./boot-lettering-art.json";
import "./boot-lettering.css";
import { assetUrl } from "./asset-url";

declare const __RHINE_NOVECENTO__: boolean;
const letterings = new Set<BootLettering>();

/** Only a locally installed, licensed kit enables native webfont rendering. */
export async function loadBootWebfonts() {
  if (!__RHINE_NOVECENTO__) return false;
  const faces = ["Normal", "DemiBold", "Bold"].map(weight => new FontFace(
    `Rhine Novecento ${weight}`,
    `url("${assetUrl(`fonts/novecento/webFonts/NovecentoSansWide${weight}/font.woff2`)}") format("woff2")`,
    { weight: "400", style: "normal", display: "swap" },
  ));
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(faces.map(face => face.load())),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Novecento load timeout")), 8000); }),
    ]);
    faces.forEach(face => document.fonts.add(face));
    letterings.forEach(lettering => lettering.useWebfonts());
    return true;
  } catch (error) {
    console.warn("Novecento kit unavailable; retaining authored phrase graphics.", error);
    return false;
  } finally { clearTimeout(timeout); }
}

type PhraseKey = keyof typeof artwork;
const ns = "http://www.w3.org/2000/svg";

/** Fixed phrase reveal cells, backed by licensed webfonts or authored artwork. */
export class BootLettering {
  private label = document.createElement("span");
  private phrases: {
    text: string;
    node: HTMLSpanElement;
    letters: HTMLSpanElement[];
    weight: string;
  }[];
  private value: string | undefined;

  constructor(private host: HTMLElement, keys: PhraseKey[]) {
    this.label.className = "boot-phrase-label";
    this.phrases = keys.map((key) => {
      const art = artwork[key];
      const node = document.createElement("span");
      node.className = "boot-phrase";
      node.dataset.phrase = key;
      node.dataset.weight = art.weight;
      node.setAttribute("aria-hidden", "true");
      node.hidden = true;
      const letters = art.letters.map((letter) => {
        const cell = document.createElement("span");
        cell.className = "boot-phrase-letter";
        cell.style.width = `${letter.width}em`;
        if (letter.path) {
          const svg = document.createElementNS(ns, "svg");
          svg.classList.add("boot-letter-art");
          svg.setAttribute("viewBox", `0 0 ${letter.width * art.units} ${art.units}`);
          svg.setAttribute("focusable", "false");
          const path = document.createElementNS(ns, "path");
          path.setAttribute("d", letter.path);
          svg.append(path);
          cell.append(svg);
        }
        node.append(cell);
        return cell;
      });
      return { text: art.text, node, letters, weight: art.weight };
    });
    host.classList.add("has-boot-lettering");
    host.replaceChildren(this.label, ...this.phrases.map((p) => p.node));
    host.dataset.letteringRenderer = "artwork";
    letterings.add(this);
  }

  useWebfonts() {
    // Retain the measured cells and the reveal timeline. Only the glyph source
    // changes: actual WOFF2 text replaces each pre-authored SVG drawing.
    for (const phrase of this.phrases) {
      phrase.node.style.setProperty("--boot-webfont-family", `"Rhine Novecento ${phrase.weight}"`);
      phrase.letters.forEach((letter, i) => {
        letter.replaceChildren();
        letter.dataset.letter = phrase.text[i];
        letter.classList.add("boot-font-letter");
      });
    }
    this.host.dataset.letteringRenderer = "webfont";
  }

  setText(value: string) {
    if (this.value === value) return;
    this.value = value;
    this.label.textContent = value;
    const active = value ? this.phrases.find((p) => p.text.startsWith(value)) : undefined;
    // A new, unauthored phrase remains readable until its artwork is exported.
    this.host.classList.toggle("boot-lettering-fallback", Boolean(value && !active));
    for (const phrase of this.phrases) {
      const visible = phrase === active;
      if (phrase.node.hidden === visible) phrase.node.hidden = !visible;
      if (!visible) continue;
      phrase.letters.forEach((letter, i) => {
        const hidden = i >= value.length;
        if (letter.hidden !== hidden) letter.hidden = hidden;
      });
    }
  }
}
