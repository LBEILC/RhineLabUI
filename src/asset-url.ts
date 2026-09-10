/** Public resources work at the origin root and at a static-hosting subpath. */
declare const __RHINE_MODELS__: Record<string, string>;
export const assetUrl = (path: string) => {
  const key = path.replace(/^\//, "");
  const versioned = import.meta.env.PROD ? __RHINE_MODELS__[key] ?? key : key;
  return `${import.meta.env.BASE_URL}${versioned}`;
};
