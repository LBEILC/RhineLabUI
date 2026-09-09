/** Public resources work at the origin root and at a static-hosting subpath. */
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
