/**
 * Origin the editor bundle is served from.
 *
 * In Shopify the page is the store, so root-relative paths like /assets/...
 * resolve to the store and 404. Static files under public/assets must be
 * requested from the host that served this bundle. Deriving it at runtime
 * keeps the code host-agnostic: no env var or hardcoded domain, and it works
 * on any deploy target as well as the Vite dev server.
 *
 * Order: import.meta.url (ES modules — set on every module/chunk),
 * then document.currentScript (classic scripts only — null in modules).
 * Falls back to "" so paths stay root-relative.
 */
function getAssetBase() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return new URL(import.meta.url).origin;
    }
  } catch {
    // Unparseable module URL — try the next strategy.
  }
  if (typeof document === "undefined") return "";
  try {
    const script = document.currentScript;
    if (script?.src) return new URL(script.src).origin;
  } catch {
    // Unparseable script URL — fall back to root-relative paths.
  }
  return "";
}

export const ASSET_BASE = getAssetBase();

/** Absolute URL for a file in public/assets, e.g. assetUrl("6-cloths/Cap_White.webp"). */
export const assetUrl = (path) => `${ASSET_BASE}/assets/${path}`;
