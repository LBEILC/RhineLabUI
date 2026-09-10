import {
  matchingPreset,
  presetLabels,
  type QualityPreset,
  type RenderQuality,
} from "./render-quality";
import { isWallpaper } from "./wallpaper";
import { escapeHtml } from "./html";

function choiceControl(attributes: string, label: string, value: string | number, choices: (readonly [string | number, string])[]) {
  if (isWallpaper) {
    const text = choices.find(([key]) => key === value)?.[1] ?? "自定义";
    return `<button type="button" ${attributes} class="quality-cycle" aria-label="${label}" title="点击切换${label}" value="${value}" data-quality-choices="${escapeHtml(JSON.stringify(choices))}"><span data-quality-label>${text}</span><span aria-hidden="true">↻</span></button>`;
  }
  return `<select ${attributes} aria-label="${label}">${choices.map(([key, text]) => `<option value="${key}" ${key === value ? "selected" : ""}>${text}</option>`).join("")}${value === "custom" ? '<option value="custom" disabled selected>自定义</option>' : ""}</select>`;
}

if (isWallpaper) document.addEventListener("click", event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-quality-choices]");
  if (!button || button.disabled) return;
  const choices = JSON.parse(button.dataset.qualityChoices!) as [string | number, string][];
  const index = choices.findIndex(([value]) => String(value) === button.value);
  const [value, label] = choices[(index + 1) % choices.length];
  button.value = String(value);
  button.querySelector("[data-quality-label]")!.textContent = label;
  button.dispatchEvent(new Event("change", { bubbles: true }));
});

function select(
  quality: RenderQuality,
  key: keyof RenderQuality,
  label: string,
  hint: string,
  choices: (readonly [string | number, string])[],
) {
  return `<label class="quality-control"><span>${label}<small>${hint}</small></span>${choiceControl(`data-quality="${key}"`, label, quality[key], choices)}</label>`;
}
function range(
  quality: RenderQuality,
  key: "scale" | "depthOfField",
  label: string,
  hint: string,
  min: number,
  max: number,
) {
  return `<label class="quality-control quality-range"><span>${label}<small>${hint}</small></span><div><input type="range" data-quality="${key}" aria-label="${label}" min="${min}" max="${max}" step="5" value="${quality[key]}"/><output data-quality-output="${key}">${quality[key]}%</output></div></label>`;
}
export function qualityMarkup(quality: RenderQuality) {
  const preset = matchingPreset(quality);
  return `<section class="quality-settings" aria-label="画质设置">
    <div class="quality-heading"><h3>RENDER QUALITY <span>渲染画质</span></h3>${choiceControl('id="quality-preset"', "画质预设", preset, (Object.keys(presetLabels) as QualityPreset[]).map(key => [key, presetLabels[key]]))}</div>
    <p class="quality-summary" id="quality-summary" aria-live="polite"></p>
    <details class="quality-advanced"><summary>精细设置 <span>清晰度 / 材质 / 阴影</span></summary><div class="quality-grid">
    ${range(quality, "scale", "渲染比例", "相对屏幕像素，受密度上限限制；高比例改善细线", 50, 200)}
    ${select(
      quality,
      "pixelRatio",
      "像素密度上限",
      "控制高密度屏幕的原生像素倍率",
      [1, 1.5, 2, 3].map((v) => [v, `${v}×`]),
    )}
    ${select(quality, "antialias", "抗锯齿", "SMAA 平滑模型边缘与后处理结果", [
      ["off", "原始"],
      ["smaa", "SMAA"],
    ])}
    ${select(
      quality,
      "anisotropy",
      "纹理过滤",
      "改善倾斜视角下的标签细节",
      [1, 2, 4, 8, 16].map((v) => [v, `${v}×`]),
    )}
    ${select(
      quality,
      "transmission",
      "透明材质分辨率",
      "控制盖板折射画面的清晰度",
      [0.25, 0.5, 0.75, 1].map((v) => [v, `${v * 100}%`]),
    )}
    ${select(
      quality,
      "shadows",
      "阴影分辨率 · 阵列",
      "更高分辨率保留更细的投影边缘",
      [
        [0, "关闭"],
        [1024, "1024"],
        [2048, "2048"],
        [4096, "4096"],
      ],
    )}
    ${select(
      quality,
      "aoSamples",
      "环境遮蔽 · 阵列",
      "采样越多，接缝暗部越细腻",
      [
        [0, "关闭"],
        [16, "16 采样"],
        [32, "32 采样"],
        [64, "64 采样"],
      ],
    )}
    ${select(
      quality,
      "aoResolution",
      "遮蔽分辨率 · 阵列",
      "降低可减轻环境遮蔽的渲染负担",
      [0.5, 0.75, 1].map((v) => [v, `${v * 100}%`]),
    )}
    ${range(quality, "depthOfField", "景深强度 · 阵列", "0% 关闭；100% 保留原始镜头虚化", 0, 150)}
    </div></details><p class="quality-note">${isWallpaper ? "即时生效，仅限当前运行；长期设置请在 Wallpaper Engine 中调整。" : "即时生效并自动保存。"}清晰度与材质设置同步至 360° 查看器。高渲染比例更适合静态观察；缓冲上限为 829 万像素，硬件限制时自动收敛。</p>
  </section>`;
}

export function syncQualityUI(quality: RenderQuality) {
  const preset = document.querySelector<HTMLSelectElement | HTMLButtonElement>("#quality-preset");
  if (!preset) return;
  preset.value = matchingPreset(quality);
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("[data-quality]")
    .forEach((control) => {
      const key = control.dataset.quality as keyof RenderQuality;
      control.value = String(quality[key]);
      control.disabled = key === "aoResolution" && quality.aoSamples === 0;
    });
  document.querySelectorAll<HTMLButtonElement>("[data-quality-choices]").forEach(button => {
    const choices = JSON.parse(button.dataset.qualityChoices!) as [string | number, string][];
    button.querySelector("[data-quality-label]")!.textContent = choices.find(([value]) => String(value) === button.value)?.[1] ?? "自定义";
  });
  document
    .querySelectorAll<HTMLOutputElement>("[data-quality-output]")
    .forEach((output) => {
      output.value = `${quality[output.dataset.qualityOutput as keyof RenderQuality]}%`;
    });
}
