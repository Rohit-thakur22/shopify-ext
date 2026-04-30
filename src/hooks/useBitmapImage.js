import { useEffect, useState } from "react";

// Global cache so multiple SingleProductPreview instances reusing the same
// garment / texture / shadow URL share a single decoded ImageBitmap.
const cache = new Map(); // url -> ImageBitmap | HTMLImageElement
const inflight = new Map(); // url -> Promise

const supportsBitmap =
  typeof window !== "undefined" && typeof window.createImageBitmap === "function";

function loadViaBitmap(url) {
  return fetch(url, { mode: "cors", credentials: "omit" })
    .then((res) => {
      if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
      return res.blob();
    })
    .then((blob) => createImageBitmap(blob));
}

function loadViaImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      // .decode() resolves once the bitmap is ready off-thread on Chromium/WebKit.
      if (typeof img.decode === "function") {
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
}

function loadImage(url) {
  if (cache.has(url)) return Promise.resolve(cache.get(url));
  if (inflight.has(url)) return inflight.get(url);

  const loader = supportsBitmap
    ? loadViaBitmap(url).catch(() => loadViaImageElement(url))
    : loadViaImageElement(url);

  const promise = loader
    .then((result) => {
      cache.set(url, result);
      inflight.delete(url);
      return result;
    })
    .catch((err) => {
      inflight.delete(url);
      throw err;
    });

  inflight.set(url, promise);
  return promise;
}

/**
 * Drop-in replacement for `use-image` that decodes via createImageBitmap()
 * (off main thread on Chromium/WebKit) and shares results across components.
 *
 * Returns [image, status] where image is an ImageBitmap or HTMLImageElement —
 * both implement CanvasImageSource so Konva/Fabric accept them transparently.
 */
export default function useBitmapImage(url) {
  const [image, setImage] = useState(() => (url && cache.has(url) ? cache.get(url) : null));
  const [status, setStatus] = useState(() => (url && cache.has(url) ? "loaded" : "loading"));

  useEffect(() => {
    if (!url) {
      setImage(null);
      setStatus("loading");
      return;
    }

    if (cache.has(url)) {
      setImage(cache.get(url));
      setStatus("loaded");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    loadImage(url)
      .then((result) => {
        if (cancelled) return;
        setImage(result);
        setStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setImage(null);
        setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return [image, status];
}
