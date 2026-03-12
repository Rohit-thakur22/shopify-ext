import { Canvas, Image } from "fabric";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * DesignViewerPro - Professional mockup rendering architecture
 *
 * High-resolution, filter-free canvas system for crisp garment previews.
 * Uses layered rendering (base garment → user design → texture overlay → shadow)
 * instead of Fabric filters. Supports pre-rendered color variants for instant
 * color switching without quality degradation.
 *
 * Props:
 * - imageUrl: The uploaded image URL to display on products
 * - tintColor: The selected garment color (hex)
 * - onColorChange: Callback when user changes color
 * - assetUrls: Object containing product image URLs and optional color variants
 *
 * Asset structure for color variants (optional):
 *   assetUrls.colorVariants = {
 *     "#ffffff": { tshirt: "url", hoodie: "url", polo: "url", cap: "url", apron: "url", tote: "url" },
 *     "#000000": { ... },
 *   }
 * When colorVariants is not provided, base URLs are used for all colors.
 */

// High internal resolution for pixel-perfect rendering (scaled down via CSS)
const CANVAS_W = 400;
const CANVAS_H = 500;

// Display size (CSS only) - canvas element keeps width/height attrs = render resolution
const DISPLAY_W = 140;
const DISPLAY_H = 180;

// Garment fit: scale so image fits inside canvas with padding (no overflow)
const GARMENT_PADDING = 0.5;

// Product keys matching the original DesignViewer order
const PRODUCT_KEYS = ["tshirt", "hoodie", "polo", "cap", "apron", "tote"];

// Print sizes for display labels
const SIZES = [
  '11" x 11"',
  '4" x 2.5"',
  '3.5" x 3.5"',
  '7" x 7"',
  '9" x 9"',
  '5" x 5"',
];

const COLOR_SWATCHES = [
  "#ffffff", // White
  "#000000", // Black
  "#d8d8d8", // Gray
  "#ff3900", // Orange
  "#ffc121", // Gold
  "#f5e851", // Yellow
  "#82d145", // Green
  "#caf7e5", // Mint
  "#5e87a3", // Denim
  "#005bd3", // Blue
];

// Default asset URLs (fallback when assetUrls not provided)
const CDN = "https://shopify-ext.vercel.app";
const DEFAULT_ASSETS = {
  tshirt: `${CDN}/assets/6-cloths/full-front.webp`,
  hoodie: `${CDN}/assets/6-cloths/Hoodie_White.png`,
  polo: `${CDN}/assets/6-cloths/polo-tshirt.png`,
  cap: `${CDN}/assets/6-cloths/Cap_White.png`,
  apron: `${CDN}/assets/6-cloths/Apron_White.png`,
  tote: `${CDN}/assets/6-cloths/Tote_White.png`,
};

/**
 * Get the base garment URL for a product at a given color.
 * Always uses Vercel CDN — ignores assetUrls from Shopify.
 * Color variants still supported if they point to Vercel URLs.
 */
function getGarmentUrl(assetUrls, productKey, color) {
  const colorVariants = assetUrls?.colorVariants;
  if (colorVariants?.[color]?.[productKey]) {
    return colorVariants[color][productKey];
  }
  // Always fall back to CDN — never use Shopify assetUrls for garments
  return DEFAULT_ASSETS[productKey];
}

const DesignViewerPro = ({
  imageUrl,
  tintColor: propTintColor,
  onColorChange,
  assetUrls = {},
}) => {
  const [localTintColor, setLocalTintColor] = useState("#6b7280");
  const tintColor =
    propTintColor !== undefined ? propTintColor : localTintColor;

  // Refs - avoid recreating canvas instances
  const canvasRefs = useRef([]);
  const fabricCanvasesRef = useRef([]);
  const baseImagesRef = useRef([]);
  const textureOverlaysRef = useRef([]);
  const logoImagesRef = useRef([]);
  const logoRequestIdRef = useRef(0);
  const prevImageUrlRef = useRef(null);
  const prevTintColorRef = useRef(tintColor);
  const currentBaseUrlsRef = useRef({}); // idx -> URL, for change detection

  // Build product config: each product has src (garment URL) and size label
  const products = useMemo(() => {
    return PRODUCT_KEYS.map((key, index) => ({
      key,
      src: getGarmentUrl(assetUrls, key, tintColor),
      size: SIZES[index],
    }));
  }, [assetUrls, tintColor]);

  // Fabric canvas options - high-res internal; display size controlled by CSS
  const canvasOptions = useMemo(
    () => ({
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: "transparent",
      selection: false,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      renderOnAddRemove: true,
      skipTargetFind: true,
    }),
    [],
  );

  /**
   * Load and add base garment image to canvas.
   * No filters applied - image is used as-is for crisp rendering.
   */
  const loadBaseGarment = useCallback(
    (canvas, product, idx) => {
      const src = getGarmentUrl(assetUrls, product.key, tintColor);
      return Image.fromURL(src, {
        crossOrigin: "anonymous",
      }).then((img) => {
        const scale = Math.min(
          (CANVAS_W * GARMENT_PADDING) / img.width,
          (CANVAS_H * GARMENT_PADDING) / img.height,
        );

        img.set({
          originX: "center",
          originY: "center",
          left: CANVAS_W / 2,
          top: CANVAS_H / 2,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          objectCaching: false,
          perPixelTargetFind: false,
        });

        baseImagesRef.current[idx] = img;
        currentBaseUrlsRef.current[idx] = src;
        canvas.add(img);
        return img;
      });
    },
    [assetUrls, tintColor],
  );

  /**
   * Initialize all Fabric canvases once. Reuse on color change by swapping base image.
   */
  useEffect(() => {
    fabricCanvasesRef.current = [];
    baseImagesRef.current = [];
    textureOverlaysRef.current = [];
    logoImagesRef.current = [];

    const initPromises = products.map((product, idx) => {
      const el = canvasRefs.current[idx];
      if (!el) return Promise.resolve();

      const canvas = new Canvas(el, canvasOptions);
      fabricCanvasesRef.current[idx] = canvas;

      return loadBaseGarment(canvas, product, idx).then(() => {
        canvas.requestRenderAll();
      });
    });

    return () => {
      fabricCanvasesRef.current.forEach((c) => c && c.dispose());
      fabricCanvasesRef.current = [];
      baseImagesRef.current = [];
      textureOverlaysRef.current = [];
      logoImagesRef.current = [];
    };
  }, []); // Intentionally empty - init once, products/color change handled in separate effects

  /**
   * When tintColor changes: swap base garment image if color variants exist.
   * Otherwise keep current (base URLs are typically white/neutral).
   */
  useEffect(() => {
    if (prevTintColorRef.current === tintColor) return;
    prevTintColorRef.current = tintColor;

    const hasColorVariants = assetUrls?.colorVariants?.[tintColor];
    if (!hasColorVariants) {
      // No color variants - base images are already loaded (white/neutral)
      return;
    }

    // Swap base image for each product
    products.forEach((product, idx) => {
      const canvas = fabricCanvasesRef.current[idx];
      const oldBase = baseImagesRef.current[idx];
      if (!canvas || !oldBase) return;

      const newSrc = getGarmentUrl(assetUrls, product.key, tintColor);
      if (!newSrc || newSrc === currentBaseUrlsRef.current[idx]) return;

      Image.fromURL(newSrc, { crossOrigin: "anonymous" }).then((img) => {
        const scale = Math.min(
          (CANVAS_W * GARMENT_PADDING) / img.width,
          (CANVAS_H * GARMENT_PADDING) / img.height,
        );

        img.set({
          originX: "center",
          originY: "center",
          left: CANVAS_W / 2,
          top: CANVAS_H / 2,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          objectCaching: false,
          perPixelTargetFind: false,
        });

        canvas.remove(oldBase);
        baseImagesRef.current[idx] = img;
        currentBaseUrlsRef.current[idx] = newSrc;
        canvas.insertAt(0, img);

        // Re-add logo on top if exists
        const logo = logoImagesRef.current[idx];
        if (logo) {
          canvas.bringToFront(logo);
        }

        canvas.requestRenderAll();
      });
    });
  }, [tintColor, assetUrls, products]);

  // Reload base images when assetUrls change (e.g. Shopify CDN URLs loaded)
  useEffect(() => {
    if (fabricCanvasesRef.current.length === 0) return;

    products.forEach((product, idx) => {
      const canvas = fabricCanvasesRef.current[idx];
      const baseImg = baseImagesRef.current[idx];
      if (!canvas || !baseImg) return;

      const newSrc = getGarmentUrl(assetUrls, product.key, tintColor);
      if (newSrc === currentBaseUrlsRef.current[idx]) return;

      Image.fromURL(newSrc, { crossOrigin: "anonymous" }).then((img) => {
        const scale = Math.min(
          (CANVAS_W * GARMENT_PADDING) / img.width,
          (CANVAS_H * GARMENT_PADDING) / img.height,
        );

        img.set({
          originX: "center",
          originY: "center",
          left: CANVAS_W / 2,
          top: CANVAS_H / 2,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          objectCaching: false,
          perPixelTargetFind: false,
        });

        canvas.remove(baseImg);
        baseImagesRef.current[idx] = img;
        currentBaseUrlsRef.current[idx] = newSrc;
        canvas.insertAt(0, img);

        const logo = logoImagesRef.current[idx];
        if (logo) canvas.bringToFront(logo);
        canvas.requestRenderAll();
      });
    });
  }, [products, assetUrls, tintColor]);

  const changeColor = useCallback(
    (color) => {
      if (propTintColor === undefined) {
        setLocalTintColor(color);
      }
      if (onColorChange) {
        onColorChange(color);
      }
    },
    [propTintColor, onColorChange],
  );

  /**
   * Place or replace logo on a canvas. No filters - maintains original resolution.
   * Proportional scaling relative to garment width.
   */
  const placeOrReplaceLogoOnCanvas = useCallback((idx, url, requestId) => {
    const canvas = fabricCanvasesRef.current[idx];
    const baseImg = baseImagesRef.current[idx];
    if (!canvas || !baseImg) return;

    // Remove existing logo
    const logo = logoImagesRef.current[idx];
    if (logo) {
      canvas.remove(logo);
      logoImagesRef.current[idx] = null;
    }
    canvas.requestRenderAll();

    Image.fromURL(url, {
      crossOrigin: "anonymous",
    }).then((logo) => {
      if (requestId !== logoRequestIdRef.current) return;

      const garmentWidth = baseImg.getScaledWidth();
      const sizeMultiplier = idx === 3 ? 0.15 : 0.2; // Cap is smaller
      const targetWidth = garmentWidth * sizeMultiplier;
      const scale = targetWidth / logo.width;

      // Position offsets by product type
      const isCap = idx === 3;
      const isApron = idx === 4;
      const isTote = idx === 5;

      let offsetX = 0;
      let offsetY;

      if (isCap) {
        offsetY = -baseImg.getScaledHeight() * 0.08;
      } else if (isApron) {
        offsetY = baseImg.getScaledHeight() * 0.05;
      } else if (isTote) {
        offsetY = baseImg.getScaledHeight() * 0.08;
      } else {
        offsetY = -baseImg.getScaledHeight() * 0.05;
      }

      logo.set({
        originX: "center",
        originY: "center",
        left: baseImg.left + offsetX,
        top: baseImg.top + offsetY,
        selectable: false,
        evented: false,
        scaleX: scale,
        scaleY: scale,
        objectCaching: false,
        perPixelTargetFind: false,
      });

      canvas.add(logo);
      canvas.bringToFront(logo);
      logoImagesRef.current[idx] = logo;
      canvas.requestRenderAll();
    });
  }, []);

  // Update logos when imageUrl changes
  useEffect(() => {
    if (prevImageUrlRef.current === imageUrl) return;
    prevImageUrlRef.current = imageUrl;

    if (imageUrl) {
      logoRequestIdRef.current += 1;
      const requestId = logoRequestIdRef.current;
      products.forEach((_, idx) => {
        placeOrReplaceLogoOnCanvas(idx, imageUrl, requestId);
      });
    } else {
      logoRequestIdRef.current += 1;
      fabricCanvasesRef.current.forEach((canvas, idx) => {
        if (!canvas) return;
        const baseImg = baseImagesRef.current[idx];
        const logo = logoImagesRef.current[idx];
        if (logo) {
          canvas.remove(logo);
          logoImagesRef.current[idx] = null;
        }
        canvas.requestRenderAll();
      });
    }
  }, [imageUrl, products, placeOrReplaceLogoOnCanvas]);

  return (
    <div className="design-viewer">
      <div className="w-full">
        <div className="max-w-2xl p-3 bg-white h-max">
          <div className="text-start space-y-2">
            <h2 className="text-md font-bold text-black">Preview</h2>
            <p className="text-xs text-gray-600">
              See your design on our most popular styles
            </p>
          </div>

          <div
            className="dv-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "1.5rem",
            }}
          >
            {products.map((product, index) => (
              <div
                key={product.key}
                className="group flex bg-white pt-3 flex-col items-center transform transition-all duration-200 ease-in-out hover:scale-200"
                style={{
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                  transform: "translateZ(0)",
                  zIndex: 10 - index,
                }}
              >
                <div className="rounded-lg p-2 w-full max-w-xs aspect-square flex items-center justify-center">
                  {/* Parent controls display size; canvas keeps high internal resolution */}
                  <div
                    className="mx-auto transform transition-transform duration-300 ease-out group-hover:scale-100 bg-white flex items-center justify-center"
                    style={{
                      width: DISPLAY_W,
                      height: DISPLAY_H,
                      filter: "contrast(1.1) saturate(1.05)",
                    }}
                  >
                    <canvas
                      ref={(el) => (canvasRefs.current[index] = el)}
                      width={CANVAS_W}
                      height={CANVAS_H}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        transform: "translateZ(0)",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-black font-bold mt-2">
          Change your preview items to any color below:
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              className={`h-6 w-6 shrink-0 rounded-md border border-gray-300 ${
                tintColor === color ? "ring-2 ring-offset-2 ring-blue-500" : ""
              }`}
              style={{ backgroundColor: color }}
              onClick={() => changeColor(color)}
            />
          ))}
          <label className="relative h-6 w-6 shrink-0 cursor-pointer rounded-md border border-gray-300 overflow-hidden shadow-sm">
            <span
              className="absolute inset-0 block rounded-md"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #88ff00, #00ff00, #00ff88, #00ffff, #0088ff, #0000ff, #8800ff, #ff00ff, #ff0088, #ff0000)",
              }}
            />
            <input
              type="color"
              value={tintColor}
              onChange={(e) => changeColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Pick custom color"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default DesignViewerPro;
