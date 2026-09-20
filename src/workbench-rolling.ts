import { createRollingText } from "@kitlangton/rolling-number";

const controllers = new WeakMap<HTMLElement, ReturnType<typeof createRollingText>>();
const textMeasure = document.createElement("canvas").getContext("2d")!;
function fitMediaText(element: HTMLElement, text: string) {
  if (!element.matches(".wb-media h3, .wb-media p")) return text;
  element.title = text;
  const style = getComputedStyle(element);
  textMeasure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = element.parentElement!.clientWidth;
  if (!width) return text;
  const spacing = parseFloat(style.letterSpacing) || 0;
  const measure = (value: string) => textMeasure.measureText(value).width + [...value].length * spacing;
  if (measure(text) <= width) return text;
  const chars = [...text];
  let low = 0, high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(chars.slice(0, mid).join("") + "…") <= width) low = mid;
    else high = mid - 1;
  }
  return chars.slice(0, low).join("") + "…";
}
export function rollText(element: HTMLElement, text: string, animated: boolean) {
  const fullText = text;
  text = fitMediaText(element, text);
  let controller = controllers.get(element);
  if (!controller) {
    controller = createRollingText(element, { text, duration: 460, motionBlur: true, transition: "direct", stagger: "none", direction: "up", animated });
    controllers.set(element, controller);
  } else controller.update({ text, animated });
  if (!animated) controller.finish();
  if (element.matches(".wb-media h3, .wb-media p")) element.setAttribute("aria-label", fullText);
}

/** Patch in place so media callbacks retain active reels, artwork and focus. */
export function patchRollingPanel(parent: HTMLElement, html: string, animated: boolean) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const patch = (target: Node, source: Node) => {
    if (target instanceof HTMLElement && source instanceof HTMLElement) {
      if (source.hasAttribute("data-wb-roll")) {
        if (!controllers.has(target)) for (const attr of [...source.attributes]) target.setAttribute(attr.name, attr.value);
        rollText(target, source.textContent ?? "", animated); return;
      }
      if (controllers.has(target)) { controllers.get(target)!.destroy(); controllers.delete(target); }
      for (const attr of [...target.attributes]) if (!source.hasAttribute(attr.name)) target.removeAttribute(attr.name);
      for (const attr of [...source.attributes]) if (target.getAttribute(attr.name) !== attr.value) target.setAttribute(attr.name, attr.value);
    }
    [...source.childNodes].forEach((next, index) => {
      let current = target.childNodes[index];
      if (!current || current.nodeName !== next.nodeName) {
        const fresh = next.cloneNode(false) as ChildNode;
        if (current) { dispose(current); target.replaceChild(fresh, current); } else target.appendChild(fresh);
        current = fresh;
      }
      if (next.nodeType === Node.TEXT_NODE) { if (current.textContent !== next.textContent) current.textContent = next.textContent; }
      else patch(current, next);
    });
    while (target.childNodes.length > source.childNodes.length) { dispose(target.lastChild!); target.lastChild!.remove(); }
  };
  const dispose = (node: Node) => {
    if (node instanceof HTMLElement) {
      controllers.get(node)?.destroy(); controllers.delete(node);
      node.querySelectorAll<HTMLElement>("[data-wb-roll]").forEach(el => { controllers.get(el)?.destroy(); controllers.delete(el); });
    }
  };
  patch(parent, template.content);
}
