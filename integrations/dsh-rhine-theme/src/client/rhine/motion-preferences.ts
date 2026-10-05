export type MotionKey =
  | "boot"
  | "selectionWave"
  | "idleWave"
  | "pointerParallax"
  | "dragMomentum"
  | "selectionTransition"
  | "detailTransition"
  | "modelDecryption"
  | "documentReveal"
  | "rollingText"
  | "rollingNumbers"
  | "surfaceTransitions"
  | "viewerNavigation"
  | "viewerModelTransition";

export type MotionPreferences = Record<MotionKey, boolean>;
export type MotionPreset = "full" | "reduced" | "custom";

export type StoredMotion = Partial<MotionPreferences> & {
  preset?: MotionPreset;
};

export const MOTION_LABELS: Record<
  MotionKey,
  { title: string; description: string; group: string }
> = {
  boot: {
    title: "BOOT SEQUENCE",
    description: "开机标志、扫描与欢迎画面",
    group: "开场",
  },
  selectionWave: {
    title: "SELECTION WAVE",
    description: "选档时向阵列传播的波浪",
    group: "档案阵列",
  },
  idleWave: {
    title: "IDLE MOTION",
    description: "停止操作后的阵列起伏",
    group: "档案阵列",
  },
  pointerParallax: {
    title: "POINTER PARALLAX",
    description: "镜头随指针的轻微偏移",
    group: "档案阵列",
  },
  dragMomentum: {
    title: "DRAG MOMENTUM",
    description: "松手后按实际速度继续滑行",
    group: "档案阵列",
  },
  selectionTransition: {
    title: "SELECTION TRANSITION",
    description: "切列、切档时的轨道移动",
    group: "档案阵列",
  },
  detailTransition: {
    title: "DETAIL TRANSITION",
    description: "抽取、转正、归位与详情镜头",
    group: "档案详情",
  },
  modelDecryption: {
    title: "MODEL DECRYPTION",
    description: "模型解密线与磨砂揭示",
    group: "档案详情",
  },
  documentReveal: {
    title: "DOCUMENT REVEAL",
    description: "正文的遮罩揭示",
    group: "档案详情",
  },
  rollingText: {
    title: "ROLLING TEXT",
    description: "标题、分类与权限标签滚动",
    group: "界面",
  },
  rollingNumbers: {
    title: "ROLLING NUMBERS",
    description: "序号、列编号与档案编码滚动",
    group: "界面",
  },
  surfaceTransitions: {
    title: "SURFACE TRANSITIONS",
    description: "详情、检索、收藏与设置窗口过渡",
    group: "界面",
  },
  viewerNavigation: {
    title: "VIEWER NAVIGATION",
    description: "360° 旋转、平移、缩放与复位阻尼",
    group: "360° 查看器",
  },
  viewerModelTransition: {
    title: "VIEWER MODEL TRANSITION",
    description: "拆解、重组与清晰度变化",
    group: "360° 查看器",
  },
};

const FULL: MotionPreferences = {
  boot: true,
  selectionWave: true,
  idleWave: true,
  pointerParallax: true,
  dragMomentum: true,
  selectionTransition: true,
  detailTransition: true,
  modelDecryption: true,
  documentReveal: true,
  rollingText: true,
  rollingNumbers: true,
  surfaceTransitions: true,
  viewerNavigation: true,
  viewerModelTransition: true,
};

const REDUCED: MotionPreferences = {
  boot: false,
  selectionWave: false,
  idleWave: false,
  pointerParallax: false,
  dragMomentum: false,
  selectionTransition: false,
  detailTransition: false,
  modelDecryption: false,
  documentReveal: false,
  rollingText: false,
  rollingNumbers: false,
  surfaceTransitions: false,
  viewerNavigation: false,
  viewerModelTransition: false,
};

export function fullMotion(): MotionPreferences {
  return { ...FULL };
}

export function reducedMotion(): MotionPreferences {
  return { ...REDUCED };
}

export function motionPresetFor(motion: MotionPreferences): MotionPreset {
  if (Object.values(motion).every(Boolean)) return "full";
  if (Object.values(motion).every((value) => !value)) return "reduced";
  return "custom";
}

export function createMotionPreferences(
  stored: StoredMotion | undefined,
  legacyReduced: boolean | undefined,
): MotionPreferences {
  const base =
    stored?.preset === "full"
      ? FULL
      : stored?.preset === "reduced"
        ? REDUCED
        : legacyReduced === true
          ? REDUCED
          : FULL;
  const result = { ...base };
  if (stored) {
    for (const key of Object.keys(FULL) as MotionKey[]) {
      if (typeof stored[key] === "boolean")
        result[key] = stored[key] as boolean;
    }
  }
  return result;
}

export function motionEnabled(motion: MotionPreferences, key: MotionKey) {
  return motion[key];
}

export function motionSummary(motion: MotionPreferences) {
  const enabled = Object.values(motion).filter(Boolean).length;
  if (enabled === Object.keys(motion).length) return "当前使用完整动画。";
  if (enabled === 0) return "当前已减少动画。";
  const highlights: string[] = [];
  if (!motion.boot) highlights.push("开场已跳过");
  if (!motion.selectionWave && !motion.idleWave)
    highlights.push("阵列波动已关闭");
  if (!motion.rollingText && !motion.rollingNumbers)
    highlights.push("文字滚动已关闭");
  return `当前使用自定义动画（${highlights.slice(0, 2).join("、") || `启用 ${enabled} 项`}）。`;
}

export function motionSettingsMarkup(
  motion: MotionPreferences,
  preset?: MotionPreset,
) {
  const groups = [
    ...new Set(Object.values(MOTION_LABELS).map((entry) => entry.group)),
  ];
  const selected = preset ?? motionPresetFor(motion);
  const presetButton = (value: "full" | "reduced" | "custom", label: string) =>
    `<button type="button" data-action="motion-preset" data-preset="${value}" aria-pressed="${selected === value}"${value === "custom" ? " disabled" : ""}>${label}</button>`;
  return `<section id="motion-settings" class="motion-settings" aria-label="动效设置"><div class="motion-settings-head"><div><strong>ANIMATION CONTROLS</strong><span>完整、减少或按分项自定义；关闭后会立即收束当前动画（开场设置下次重播生效）</span></div>${presetButton("full", "完整")}${presetButton("reduced", "减少")}${presetButton("custom", "自定义")}</div><details class="motion-advanced"><summary>精细设置 <span>开场 / 阵列 / 详情 / 界面 / 360° 查看器</span></summary><div class="motion-groups">${groups
    .map(
      (group) =>
        `<fieldset><legend>${group}</legend>${(
          Object.keys(MOTION_LABELS) as MotionKey[]
        )
          .filter((key) => MOTION_LABELS[key].group === group)
          .map((key) => {
            const item = MOTION_LABELS[key];
            return `<label class="motion-setting"><div><strong>${item.title}</strong><span>${item.description}</span></div><input type="checkbox" data-motion="${key}" ${motion[key] ? "checked" : ""}/><i class="toggle"></i></label>`;
          })
          .join("")}</fieldset>`,
    )
    .join("")}</div></details></section>`;
}
