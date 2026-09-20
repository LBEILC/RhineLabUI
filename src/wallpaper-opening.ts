// Original-video seconds minus five, immediately before the standalone extraction.
export const ARRAY_OPENING_END = 25.9;
export function openingShowsDetail(value: unknown, workbench: boolean) {
  return value === "show" || (value !== "skip" && !workbench);
}
