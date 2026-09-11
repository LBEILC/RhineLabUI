/** Rendering controls are independent of lighting, materials and animation. */
export type RenderQuality = {
  scale: number;
  pixelRatio: number;
  antialias: "off" | "smaa";
  shadows: number;
  aoSamples: number;
  aoResolution: number;
  depthOfField: number;
  transmission: number;
  anisotropy: number;
};

export const qualityPresets = {
  performance: {
    scale: 80,
    pixelRatio: 1,
    antialias: "off",
    shadows: 1024,
    aoSamples: 0,
    aoResolution: 0.5,
    depthOfField: 0,
    transmission: 0.5,
    anisotropy: 4,
  },
  original: {
    scale: 100,
    pixelRatio: 1.5,
    antialias: "off",
    shadows: 2048,
    aoSamples: 32,
    aoResolution: 1,
    depthOfField: 100,
    transmission: 1,
    anisotropy: 16,
  },
  high: {
    scale: 125,
    pixelRatio: 2,
    antialias: "smaa",
    shadows: 4096,
    aoSamples: 32,
    aoResolution: 1,
    depthOfField: 100,
    transmission: 1,
    anisotropy: 16,
  },
  ultra: {
    scale: 150,
    pixelRatio: 2,
    antialias: "smaa",
    shadows: 4096,
    aoSamples: 64,
    aoResolution: 1,
    depthOfField: 100,
    transmission: 1,
    anisotropy: 16,
  },
} as const satisfies Record<string, RenderQuality>;
export type QualityPreset = keyof typeof qualityPresets;
export const presetLabels: Record<QualityPreset, string> = {
  performance: "性能",
  original: "原始",
  high: "高",
  ultra: "极高",
};

const member = <T>(value: unknown, choices: readonly T[], fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback;
const range = (
  value: unknown,
  min: number,
  max: number,
  step: number,
  fallback: number,
) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value / step) * step))
    : fallback;

export function normalizeQuality(
  value: unknown,
  legacyHigh = true,
): RenderQuality {
  const base = qualityPresets.original;
  const v =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  // Older low quality retained full resolution, shadows and transmission.
  const fallback = legacyHigh
    ? base
    : { ...base, pixelRatio: 1, aoSamples: 0, depthOfField: 0 };
  return {
    scale: range(v.scale, 50, 200, 5, fallback.scale),
    pixelRatio: member(v.pixelRatio, [1, 1.5, 2, 3], fallback.pixelRatio),
    antialias: member(
      v.antialias,
      ["off", "smaa"] as const,
      fallback.antialias,
    ),
    shadows: member(v.shadows, [0, 1024, 2048, 4096], fallback.shadows),
    aoSamples: member(v.aoSamples, [0, 16, 32, 64], fallback.aoSamples),
    aoResolution: member(v.aoResolution, [0.5, 0.75, 1], fallback.aoResolution),
    depthOfField: range(v.depthOfField, 0, 150, 5, fallback.depthOfField),
    transmission: member(
      v.transmission,
      [0.25, 0.5, 0.75, 1],
      fallback.transmission,
    ),
    anisotropy: member(v.anisotropy, [1, 2, 4, 8, 16], fallback.anisotropy),
  };
}

export function matchingPreset(
  quality: RenderQuality,
): QualityPreset | "custom" {
  return (
    (Object.keys(qualityPresets) as QualityPreset[]).find((key) =>
      Object.entries(qualityPresets[key]).every(
        ([field, value]) => quality[field as keyof RenderQuality] === value,
      ),
    ) ?? "custom"
  );
}

export function renderDimensions(
  quality: RenderQuality,
  width: number,
  height: number,
  stageScale: number,
  deviceRatio: number,
  maxTextureSize: number,
  pixelBudget = 8_294_400,
) {
  const requested =
    (Math.min(deviceRatio, quality.pixelRatio) * stageScale * quality.scale) /
    100;
  // Bound all full-resolution postprocessing targets to 8.3 MP and device limits.
  const ratio = Math.min(
    requested,
    Math.sqrt(pixelBudget / Math.max(1, width * height)),
    maxTextureSize / Math.max(1, width, height),
  );
  return {
    ratio,
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
    limited: ratio < requested - 0.0001,
  };
}
