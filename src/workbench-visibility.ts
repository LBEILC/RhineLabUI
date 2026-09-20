export const workbenchElements = [
  ["clock", "时钟与日期"], ["tasks", "今日事项"], ["module", "右侧功能内容"],
  ["navigation", "底部功能导航"], ["brand", "品牌文字"], ["footer", "页脚信息"],
  ["settings", "设置入口"],
] as const;
export type WorkbenchElement = typeof workbenchElements[number][0];
export type WorkbenchVisibility = Record<WorkbenchElement, boolean>;
export const defaultWorkbenchVisibility = (): WorkbenchVisibility => ({ clock: true, tasks: true, module: true, navigation: true, brand: true, footer: true, settings: true });
export function applyVisibilityProperties(current: WorkbenchVisibility, properties: Record<string, { value: unknown }>): WorkbenchVisibility {
  const result = { ...current };
  for (const [key] of workbenchElements) {
    const value = properties[`show${key}`]?.value;
    if (typeof value === "boolean") result[key] = value;
  }
  return result;
}
