import { Canvas, Image, filters } from "fabric";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * DesignViewer - React-controlled Fabric.js canvas component
 * 
 * Props:
 * - imageUrl: The uploaded image URL to display on products
 * - tintColor: The color to tint the garments (optional)
 * - onColorChange: Callback when user changes color (optional)
 * - assetUrls: Object containing Shopify CDN URLs for product images
 */
const DesignViewer = ({
  imageUrl,
  tintColor: propTintColor,
  onColorChange,
  assetUrls = {},
}) => {
  // Source images - use Shopify CDN URLs if available, fallback to local assets
  const sourceImages = useMemo(() => {
    return [
      assetUrls.tshirt || "/assets/tshirt.png",
      assetUrls.hoodie || "/assets/hoodie.png",
      assetUrls.polo || "/assets/polo.png",
      assetUrls.cap || "/assets/cap.png",
      assetUrls.apron || "/assets/apron.png",
      assetUrls.shorts || "/assets/shorts.png",
    ];
  }, [assetUrls]);

  const sizes = useMemo(
    () => [
      '11" x 11"',
      '4" x 2.5"',
      '3.5" x 3.5"',
      '7" x 7"',
      '9" x 9"',
      '5" x 5"',
    ],
    []
  );

  const products = useMemo(
    () =>
      sizes.map((size, index) => ({
        size,
        src: sourceImages[index],
      })),
    [sizes, sourceImages]
  );

  // Canvas refs
  const canvasRefs = useRef([]);
  const fabricCanvasesRef = useRef([]);
  const baseImagesRef = useRef([]);
  const logoImagesRef = useRef([]);
  const logoRequestIdRef = useRef(0);
  const prevImageUrlRef = useRef(null);

  const CANVAS_W = 140;
  const CANVAS_H = 180;

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

  // Use prop color if provided, otherwise use local state
  const [localTintColor, setLocalTintColor] = useState("#6b7280");
  const tintColor = propTintColor !== undefined ? propTintColor : localTintColor;
  const tintColorRef = useRef(tintColor);

  useEffect(() => {
    tintColorRef.current = tintColor;
  }, [tintColor]);

  // Initialize Fabric canvases
  useEffect(() => {
    fabricCanvasesRef.current = [];
    baseImagesRef.current = [];
    logoImagesRef.current = [];

    const id = requestAnimationFrame(() => {
      products.forEach((product, idx) => {
        const el = canvasRefs.current[idx];
        if (!el) return;

        const canvas = new Canvas(el, {
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: "transparent",
          selection: false,
          preserveObjectStacking: true,
          enableRetinaScaling: true,
          devicePixelRatio: window.devicePixelRatio || 1,
          imageSmoothing: true,
          imageSmoothingQuality: "high",
          renderOnAddRemove: true,
          skipTargetFind: true,
        });

        fabricCanvasesRef.current[idx] = canvas;

        Image.fromURL(product.src, {
          crossOrigin: "anonymous",
          enableRetinaScaling: true,
          imageSmoothing: true,
          imageSmoothingQuality: "high",
        }).then((img) => {
          const scale = Math.min(
            (CANVAS_W * 0.99) / img.width,
            (CANVAS_H * 0.99) / img.height
          );

          img.set({
            left: CANVAS_W / 2,
            top: CANVAS_H / 2,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
            scaleX: scale,
            scaleY: scale,
            imageSmoothing: true,
            imageSmoothingQuality: "high",
            dirty: true,
          });

          // Apply initial tint
          img.filters = [
            new filters.BlendColor({
              color: tintColorRef.current,
              mode: "tint",
              alpha: 0.65,
            }),
          ];
          img.dirty = true;
          img.applyFilters();

          baseImagesRef.current[idx] = img;
          canvas.add(img);
          canvas.renderAll();
        });
      });
    });

    return () => {
      cancelAnimationFrame(id);
      fabricCanvasesRef.current.forEach((c) => c && c.dispose());
      fabricCanvasesRef.current = [];
      baseImagesRef.current = [];
      logoImagesRef.current = [];
    };
  }, [products]);

  // Change color handler
  const changeColor = useCallback(
    (color) => {
      if (propTintColor === undefined) {
        setLocalTintColor(color);
      }

      if (onColorChange) {
        onColorChange(color);
      }

      baseImagesRef.current.forEach((img, idx) => {
        if (!img) return;
        img.filters = [
          new filters.BlendColor({ color, mode: "tint", alpha: 0.65 }),
        ];
        img.dirty = true;
        img.applyFilters();
        const canvas = fabricCanvasesRef.current[idx];
        if (canvas) canvas.renderAll();
      });
    },
    [propTintColor, onColorChange]
  );

  // Update tint color when prop changes
  useEffect(() => {
    if (!tintColor) return;

    baseImagesRef.current.forEach((img, idx) => {
      if (!img) return;
      img.filters = [
        new filters.BlendColor({ color: tintColor, mode: "tint", alpha: 0.65 }),
      ];
      img.dirty = true;
      img.applyFilters();
      const canvas = fabricCanvasesRef.current[idx];
      if (canvas) canvas.renderAll();
    });
  }, [tintColor]);

  // Place or replace logo on canvas
  const placeOrReplaceLogoOnCanvas = useCallback((idx, url, requestId) => {
    const canvas = fabricCanvasesRef.current[idx];
    const baseImg = baseImagesRef.current[idx];
    if (!canvas || !baseImg) return;

    // Remove existing logo
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj !== baseImg) {
        canvas.remove(obj);
      }
    });
    logoImagesRef.current[idx] = null;
    canvas.requestRenderAll();

    Image.fromURL(url, {
      crossOrigin: "anonymous",
      enableRetinaScaling: true,
      imageSmoothing: true,
      imageSmoothingQuality: "high",
    }).then((logo) => {
      // Ignore if a newer upload has started
      if (requestId !== logoRequestIdRef.current) {
        return;
      }

      const hoodiePixelWidth = baseImg.getScaledWidth();
      const targetWidth = hoodiePixelWidth * 0.25;
      const scale = targetWidth / logo.width;

      // Position adjustments based on product type
      const isLast = idx === products.length - 1;
      const isFourth = idx === 3;
      const isFifth = idx === 4;

      const offsetX = isLast ? baseImg.getScaledWidth() * 0 : 0;

      let offsetY;
      if (isFourth || isFifth) {
        offsetY = -baseImg.getScaledHeight() * 0.02;
      } else if (isLast) {
        offsetY = baseImg.getScaledHeight() * 0.02;
      } else {
        offsetY = -baseImg.getScaledHeight() * 0.12;
      }

      logo.set({
        originX: "center",
        originY: "center",
        left: baseImg.left + offsetX,
        top: baseImg.top + offsetY,
        selectable: false,
        evented: false,
        imageSmoothing: true,
        imageSmoothingQuality: "high",
        scaleX: scale,
        scaleY: scale,
        dirty: true,
      });

      canvas.add(logo);
      canvas.bringToFront(logo);
      logoImagesRef.current[idx] = logo;
      canvas.requestRenderAll();
    });
  }, [products.length]);

  // Update canvases when imageUrl prop changes
  useEffect(() => {
    // Skip if URL hasn't changed
    if (prevImageUrlRef.current === imageUrl) {
      return;
    }

    // Revoke previous blob URL if exists
    if (prevImageUrlRef.current && prevImageUrlRef.current.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(prevImageUrlRef.current);
      } catch (err) {
        console.error("Error revoking blob URL:", err);
      }
    }

    prevImageUrlRef.current = imageUrl;

    if (imageUrl) {
      // Bump request id to invalidate any in-flight image loads
      logoRequestIdRef.current += 1;
      const requestId = logoRequestIdRef.current;

      // Place logo on all canvases
      products.forEach((_, idx) => {
        placeOrReplaceLogoOnCanvas(idx, imageUrl, requestId);
      });
    } else {
      // Clear all logos
      logoRequestIdRef.current += 1;
      fabricCanvasesRef.current.forEach((canvas, idx) => {
        if (!canvas) return;
        const baseImg = baseImagesRef.current[idx];
        canvas.getObjects().forEach((obj) => {
          if (obj !== baseImg) {
            canvas.remove(obj);
          }
        });
        logoImagesRef.current[idx] = null;
        canvas.requestRenderAll();
      });
    }
  }, [imageUrl, products, placeOrReplaceLogoOnCanvas]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevImageUrlRef.current && prevImageUrlRef.current.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prevImageUrlRef.current);
        } catch (err) {
          console.error("Error revoking blob URL on unmount:", err);
        }
      }
    };
  }, []);

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
                key={index}
                className="group flex bg-white pt-3 flex-col items-center transform transition-all duration-200 ease-in-out hover:scale-150"
                style={{
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                  transform: "translateZ(0)",
                  zIndex: 10 - index,
                }}
              >
                <div className="rounded-lg p-2 w-full max-w-xs aspect-square flex items-center justify-center">
                  <div
                    className="w-36 h-44 mx-auto transform transition-transform duration-300 ease-out group-hover:scale-100 bg-white"
                    style={{
                      filter: "contrast(1.1) saturate(1.05)",
                    }}
                  >
                    <canvas
                      ref={(el) => (canvasRefs.current[index] = el)}
                      style={{
                        display: "block",
                        imageRendering: "crisp-edges",
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
                tintColor === color
                  ? "ring-2 ring-offset-2 ring-blue-500"
                  : ""
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

export default DesignViewer;
