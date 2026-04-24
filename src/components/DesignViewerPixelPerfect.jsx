import React, { useCallback, useMemo, useState, memo } from "react";
import { Stage, Layer, Image, Rect, Group } from "react-konva";
import useImage from "use-image";
import useDisableInteractions from "../hooks/useDisableInteractions";
import PrintInfoCard from "./PrintInfoCard";
import { DISCOUNT_TABLE_ROWS } from "../lib/pricingConfig";

/**
 * DesignViewerPixelPerfect - Pixel-perfect mockup rendering with Konva.js
 *
 * Replaces Fabric.js with a layered Konva Stage for sharp, filter-free previews.
 * Supports high-resolution designs (3000px+), 6 simultaneous previews, and
 * pre-rendered garment color variants. No filters or rasterization pipelines.
 *
 * Layer order (bottom to top):
 * 1. Garment base image
 * 2. Color tint (multiply) - tints white garment to selected color when no colorVariants
 * 3. User design layer
 * 4. Fabric texture overlay (optional, multiply blend)
 * 5. Shadow overlay (optional, multiply blend)
 *
 * Props:
 * - imageUrl: Uploaded design image URL
 * - tintColor: Selected garment color (hex)
 * - onColorChange: Callback when color changes
 * - assetUrls: Product image URLs and optional colorVariants
 */

// Stage internal resolution (display size is CSS-scaled via scaleFactor)
const STAGE_WIDTH  = 500;
const STAGE_HEIGHT = 600;

const GARMENT_PADDING = 1.1;
const DESIGN_SIZE_RATIO = 0.3;
const DESIGN_SIZE_RATIO_CAP = 0.25;
/** Polo: smaller logo on top-right (e.g. chest logo) */
const DESIGN_SIZE_RATIO_POLO = 0.18;
const POLO_OFFSET_X = 0.12; // right of center
const POLO_OFFSET_Y = -0.16; // top

// #292929
// #333

/** Tint layer opacity: lower = more garment detail (folds, shading) visible; higher = stronger flat color */
const TINT_OPACITY = 0.9;

/**
 * Fixed design area per product (fraction of garment width/height).
 * Uploaded image is scaled to fit inside this area and never overflows.
 * Order: tshirt, hoodie, polo, cap, apron, tote
 */
const FIXED_DESIGN_AREAS = [
  { maxWidth: 0.28, maxHeight: 0.31 }, // tshirt
  { maxWidth: 0.32, maxHeight: 0.35 }, // hoodie
  { maxWidth: 0.16, maxHeight: 0.16 }, // polo (small chest area)
  { maxWidth: 0.28, maxHeight: 0.2 }, // cap
  { maxWidth: 0.28, maxHeight: 0.2 }, // apron
  { maxWidth: 0.36, maxHeight: 0.34 }, // tote
];

/** UV-DTF product design areas. Order: bottle, mug, tumbler, laptop, carBack, keychain */
const UVDTF_DESIGN_AREAS = [
  { maxWidth: 0.14, maxHeight: 0.18 }, // bottle (narrow label)
  { maxWidth: 0.24, maxHeight: 0.22 }, // mug (body)
  { maxWidth: 0.18, maxHeight: 0.22 }, // tumbler
  { maxWidth: 0.34, maxHeight: 0.18 }, // laptop lid
  { maxWidth: 0.40, maxHeight: 0.22 }, // car back panel
  { maxWidth: 0.16, maxHeight: 0.16 }, // keychain disc (smaller)
];

const CLOTH_KEYS = ["tshirt", "hoodie", "polo", "cap", "apron", "tote"];
const CLOTH_LABELS = ["T-Shirt", "Hoodie", "Polo Shirt", "Cap", "Apron", "Tote Bag"];

const UVDTF_KEYS = ["bottle", "mug", "tumbler", "laptop", "carBack", "keychain"];
const UVDTF_LABELS = ["Bottle", "Mug", "Tumbler", "Laptop", "Car Back", "Keychain"];

/** Routes that render the 6 cloth previews. */
const CLOTH_ROUTES = [
  "/products/sublimation-by-size",
  "/products/dtf-transfers-by-size",
];
/** Detect which preview set to render based on the current route. */
function getPreviewSet() {
  if (typeof window === "undefined") return "cloths";
  const path = (window.location.pathname || "").toLowerCase();
  if (path.includes("uv")) return "uvdtf";
  if (CLOTH_ROUTES.some((r) => path.includes(r))) return "cloths";
  return "cloths";
}

/**
 * Reference print area in real-world inches for each garment.
 * Used both for the default size badge and for proportionally scaling
 * the user's selected design relative to the garment — so a 4" design
 * looks visibly smaller than a 20" design on the same shirt.
 *
 * `FIXED_DESIGN_AREAS` represents the pixel footprint of these reference sizes.
 */
const PRINTABLE_AREAS_INCHES = [
  { w: 11, h: 11 },   // tshirt
  { w: 4, h: 2.5 },   // hoodie
  { w: 3.5, h: 3.5 }, // polo
  { w: 7, h: 7 },     // cap
  { w: 9, h: 9 },     // apron
  { w: 5, h: 5 },     // tote
];

/** UV-DTF reference print areas (inches) matching UVDTF_DESIGN_AREAS index order. */
const UVDTF_PRINTABLE_AREAS_INCHES = [
  { w: 3, h: 4 },    // bottle
  { w: 3.5, h: 3 },  // mug
  { w: 3, h: 4 },    // tumbler
  { w: 6, h: 3 },    // laptop
  { w: 8, h: 4 },    // car back
  { w: 2, h: 2 },    // keychain
];

const SIZES = PRINTABLE_AREAS_INCHES.map(({ w, h }) => `${w}" x ${h}"`);
const UVDTF_SIZES = UVDTF_PRINTABLE_AREAS_INCHES.map(({ w, h }) => `${w}" x ${h}"`);

/**
 * Minimum visible scale so very small designs (e.g., 1" × 1" on a shirt)
 * remain recognisable in the mockup thumbnail. Below this the preview
 * wouldn't convey anything useful to the customer.
 */
const MIN_DESIGN_SCALE_FRACTION = 0.2;

const COLOR_SWATCHES = [
  "#f0e7e7",
  "#000000",
  "#d8d8d8",
  "#ff3900",
  "#ffc121",
  "#f5e851",
  "#82d145",
  "#caf7e5",
  "#5e87a3",
  "#005bd3",
];

const CDN = "https://shopify-ext.vercel.app";
const CLOTH_ASSETS = {
  tshirt: `${CDN}/assets/6-cloths/full-front.webp`,
  hoodie: `${CDN}/assets/6-cloths/Hoodie_White.webp`,
  polo: `${CDN}/assets/6-cloths/polo-tshirt.webp`,
  cap: `${CDN}/assets/6-cloths/Cap_White.webp`,
  apron: `${CDN}/assets/6-cloths/Apron_White.webp`,
  tote: `${CDN}/assets/6-cloths/Tote_White.png`,
};
const UVDTF_ASSETS = {
  bottle: `${CDN}/assets/6-products/bottle.webp`,
  mug: `${CDN}/assets/6-products/mug.webp`,
  tumbler: `${CDN}/assets/6-products/tumbler.webp`,
  laptop: `${CDN}/assets/6-products/laptop.webp`,
  carBack: `${CDN}/assets/6-products/car-back.webp`,
  keychain: `${CDN}/assets/6-products/keychain.webp`,
};

function getPreviewConfig(previewSet) {
  if (previewSet === "uvdtf") {
    return {
      set: "uvdtf",
      keys: UVDTF_KEYS,
      labels: UVDTF_LABELS,
      assets: UVDTF_ASSETS,
      designAreas: UVDTF_DESIGN_AREAS,
      printableInches: UVDTF_PRINTABLE_AREAS_INCHES,
      sizes: UVDTF_SIZES,
    };
  }
  return {
    set: "cloths",
    keys: CLOTH_KEYS,
    labels: CLOTH_LABELS,
    assets: CLOTH_ASSETS,
    designAreas: FIXED_DESIGN_AREAS,
    printableInches: PRINTABLE_AREAS_INCHES,
    sizes: SIZES,
  };
}

function getGarmentUrl(assetUrls, productKey, color, assets) {
  const colorVariants = assetUrls?.colorVariants;
  if (colorVariants?.[color]?.[productKey]) {
    return colorVariants[color][productKey];
  }
  // Always use Vercel CDN — ignore Shopify assetUrls for garments
  return assets[productKey];
}

/**
 * Design offset factor (Y) by product index for chest/center placement.
 * Multiplied by garment height; negative = up, positive = down.
 */
function getDesignOffsetFactor(index) {
  switch (index) {
    case 3:
      return -0.12; // cap
    case 4:
      return 0.17; // apron
    case 5:
      return -0.04; // tote
    default:
      return -0.04; // tshirt, hoodie, polo
  }
}

/** Y offset factor for UV-DTF products (fraction of garment height). */
function getUvdtfOffsetFactor(index) {
  switch (index) {
    case 0: return 0.02;   // bottle — around label
    case 1: return 0.0;    // mug — center
    case 2: return 0.00;   // tumbler — body (below straw)
    case 3: return 0.0;    // laptop — center of lid
    case 4: return -0.09;  // car back — up a bit toward the window
    case 5: return 0.18;   // keychain — lower on the disc
    default: return 0.0;
  }
}

/** X offset factor for UV-DTF products (fraction of garment width). Negative = left, positive = right. */
function getUvdtfXOffsetFactor(index) {
  switch (index) {
    case 0: return -0.02;  // bottle
    case 1: return -0.04;  // mug (shift off the handle side)
    case 2: return -0.055;  // tumbler
    case 3: return -0.02;  // laptop
    case 4: return -0.0;  // car back
    case 5: return -0.0;  // keychain
    default: return -0.02;
  }
}

/**
 * Single product preview: one Konva Stage with layered images.
 * Memoized to avoid unnecessary rerenders when parent updates.
 */
// Cap at 2 — anything above 2× DPR gives no visible benefit and doubles canvas cost
const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 2;

const SingleProductPreview = memo(function SingleProductPreview({
  garmentUrl,
  designUrl,
  textureUrl,
  shadowUrl,
  productIndex,
  tintColor,
  designWidth = 0,
  designHeight = 0,
  previewSet = "cloths",
}) {
  const containerRef = React.useRef(null);
  const [scaleFactor, setScaleFactor] = React.useState(0.4);
  const interactionBlockProps = useDisableInteractions({ enabled: true });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w > 0) setScaleFactor(w / STAGE_WIDTH);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const [garmentImage] = useImage(garmentUrl, "anonymous");
  const [designImage] = useImage(designUrl || "", "anonymous");
  const [textureImage] = useImage(textureUrl || "", "anonymous");
  const [shadowImage] = useImage(shadowUrl || "", "anonymous");

  const scale = useMemo(() => {
    if (!garmentImage) return 1;
    return Math.min(
      (STAGE_WIDTH * GARMENT_PADDING) / garmentImage.width,
      (STAGE_HEIGHT * GARMENT_PADDING) / garmentImage.height,
    );
  }, [garmentImage]);

  const garmentWidth = garmentImage ? garmentImage.width * scale : 0;
  const garmentHeight = garmentImage ? garmentImage.height * scale : 0;

  const designScale = useMemo(() => {
    if (!designImage || !garmentImage) return 0;
    const areas = previewSet === "uvdtf" ? UVDTF_DESIGN_AREAS : FIXED_DESIGN_AREAS;
    const printable = previewSet === "uvdtf" ? UVDTF_PRINTABLE_AREAS_INCHES : PRINTABLE_AREAS_INCHES;
    const area = areas[productIndex] ?? areas[0];
    const ref = printable[productIndex] ?? printable[0];

    // Pixel footprint of the garment's *reference* print area (what
    // FIXED_DESIGN_AREAS represents in real-world inches — see ref.w × ref.h).
    const refPxWidth = garmentWidth * area.maxWidth;
    const refPxHeight = garmentHeight * area.maxHeight;

    // If the user has entered real dimensions, scale the design proportionally
    // relative to the reference. Otherwise fall back to "fit to reference area"
    // so the default preview still looks right before any selection.
    const hasUserSize = designWidth >= 0.5 && designHeight >= 0.5;
    const sizeFraction = hasUserSize
      ? Math.max(
          MIN_DESIGN_SCALE_FRACTION,
          Math.min(1, Math.max(designWidth / ref.w, designHeight / ref.h)),
        )
      : 1;

    const allowedWidth = refPxWidth * sizeFraction;
    const allowedHeight = refPxHeight * sizeFraction;

    // Always constrain by the tighter axis so the design never overflows
    const scaleToFitWidth = allowedWidth / designImage.width;
    const scaleToFitHeight = allowedHeight / designImage.height;
    return Math.min(scaleToFitWidth, scaleToFitHeight);
  }, [designImage, garmentImage, garmentWidth, garmentHeight, productIndex, designWidth, designHeight, previewSet]);

  const designX = useMemo(() => {
    // Polo chest-logo offset only applies to the cloths set (index 2 = polo).
    if (previewSet === "cloths" && productIndex === 2) {
      return STAGE_WIDTH / 2 + garmentWidth * POLO_OFFSET_X;
    }
    if (previewSet === "uvdtf") {
      return STAGE_WIDTH / 2 + garmentWidth * getUvdtfXOffsetFactor(productIndex);
    }
    return STAGE_WIDTH / 2;
  }, [garmentWidth, productIndex, previewSet]);

  const designY = useMemo(() => {
    if (previewSet === "cloths" && productIndex === 2) {
      return STAGE_HEIGHT / 2 + garmentHeight * POLO_OFFSET_Y;
    }
    const factor =
      previewSet === "uvdtf"
        ? getUvdtfOffsetFactor(productIndex)
        : getDesignOffsetFactor(productIndex);
    return STAGE_HEIGHT / 2 + garmentHeight * factor;
  }, [garmentHeight, productIndex, previewSet]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: !garmentImage ? "#f3f4f6" : "transparent",
      }}
    >
      {!garmentImage ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 10, color: "#9ca3af" }}>Loading…</span>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `scale(${scaleFactor})`,
            transformOrigin: "0 0",
            // GPU-accelerated layer — avoids sub-pixel softening on CSS transform
            willChange: "transform",
            imageRendering: "high-quality",
          }}
        >
          <Stage
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            pixelRatio={DPR}
          >
            <Layer listening={false}>
              {/* 1. Garment base image */}
              <Image
                image={garmentImage}
                x={STAGE_WIDTH / 2}
                y={STAGE_HEIGHT / 2}
                offsetX={garmentImage.width / 2}
                offsetY={garmentImage.height / 2}
                scaleX={scale}
                scaleY={scale}
                listening={false}
              />

              {/* 2. Color tint only on cloth area: tint rect masked by garment alpha, then multiply; opacity preserves fabric detail */}
              {tintColor && (
                <Group
                  globalCompositeOperation="multiply"
                  opacity={TINT_OPACITY}
                  listening={false}
                >
                  <Rect
                    x={0}
                    y={0}
                    width={STAGE_WIDTH}
                    height={STAGE_HEIGHT}
                    fill={tintColor}
                    listening={false}
                  />
                  <Image
                    image={garmentImage}
                    x={STAGE_WIDTH / 2}
                    y={STAGE_HEIGHT / 2}
                    offsetX={garmentImage.width / 2}
                    offsetY={garmentImage.height / 2}
                    scaleX={scale}
                    scaleY={scale}
                    globalCompositeOperation="destination-in"
                    listening={false}
                  />
                </Group>
              )}

              {/* 3. User design layer - never filtered, stays crisp */}
              {designImage && designUrl && designScale > 0 && (
                <Image
                  image={designImage}
                  x={designX}
                  y={designY}
                  offsetX={designImage.width / 2}
                  offsetY={designImage.height / 2}
                  scaleX={designScale}
                  scaleY={designScale}
                  listening={false}
                />
              )}

              {/* 4. Fabric texture overlay (multiply blend) */}
              {textureImage && textureUrl && (
                <Image
                  image={textureImage}
                  x={STAGE_WIDTH / 2}
                  y={STAGE_HEIGHT / 2}
                  offsetX={textureImage.width / 2}
                  offsetY={textureImage.height / 2}
                  scaleX={scale}
                  scaleY={scale}
                  globalCompositeOperation="multiply"
                  listening={false}
                />
              )}

              {/* 5. Shadow overlay (multiply blend) */}
              {shadowImage && shadowUrl && (
                <Image
                  image={shadowImage}
                  x={STAGE_WIDTH / 2}
                  y={STAGE_HEIGHT / 2}
                  offsetX={shadowImage.width / 2}
                  offsetY={shadowImage.height / 2}
                  scaleX={scale}
                  scaleY={scale}
                  globalCompositeOperation="multiply"
                  listening={false}
                />
              )}
            </Layer>
          </Stage>
        </div>
      )}
      <div
        {...interactionBlockProps}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          background: "transparent",
          ...interactionBlockProps.style,
        }}
        aria-hidden
      />
    </div>
  );
});

/**
 * DesignViewerPixelPerfect - Grid of 6 Konva product previews.
 */
function DesignViewerPixelPerfect({
  imageUrl,
  tintColor: propTintColor,
  onColorChange,
  assetUrls = {},
  designWidth = 0,
  designHeight = 0,
}) {
  const [localTintColor, setLocalTintColor] = useState("#6b7280");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showDiscounts, setShowDiscounts] = useState(true);
  const tintColor =
    propTintColor !== undefined ? propTintColor : localTintColor;

  const previewConfig = useMemo(() => getPreviewConfig(getPreviewSet()), []);

  const products = useMemo(() => {
    return previewConfig.keys.map((key, index) => ({
      key,
      garmentUrl: getGarmentUrl(assetUrls, key, tintColor, previewConfig.assets),
      size: previewConfig.sizes[index],
      textureUrl: assetUrls[`${key}Texture`] || null,
      shadowUrl: assetUrls[`${key}Shadow`] || null,
    }));
  }, [assetUrls, tintColor, previewConfig]);

  const changeColor = useCallback(
    (color) => {
      if (propTintColor === undefined) setLocalTintColor(color);
      if (onColorChange) onColorChange(color);
    },
    [propTintColor, onColorChange],
  );

  return (
    <div>
      <div style={{ width: "100%" }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#111827", letterSpacing: "-0.015em", display: "flex", alignItems: "center", gap: "0.5rem", lineHeight: 1.3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "1.75rem", height: "1.75rem", background: "linear-gradient(135deg, #6366f1, #9333ea)", borderRadius: "0.5rem", flexShrink: 0, boxShadow: "0 2px 6px rgba(99,102,241,0.35)" }}>
                <svg style={{ width: "1rem", height: "1rem", color: "#fff" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </span>
              Live Preview
            </h2>
            <p style={{ margin: "0.125rem 0 0 2.25rem", fontSize: "0.75rem", color: "#9ca3af" }}>Your design across 6 popular styles</p>
          </div>
          {imageUrl && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", backgroundColor: "#d1fae5", color: "#065f46", fontWeight: 600, padding: "0.25rem 0.625rem", borderRadius: "9999px", border: "1px solid #a7f3d0", whiteSpace: "nowrap" }}>
              <span style={{ width: "0.375rem", height: "0.375rem", backgroundColor: "#10b981", borderRadius: "9999px", display: "inline-block", flexShrink: 0 }} />
              Live
            </span>
          )}
        </div>

        {/* 2-column product grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", overflow: "visible" }}>
          {products.map((product, index) => (
            <div
              key={product.key}
              style={{
                display: "flex",
                paddingTop: "0.75rem",
                flexDirection: "column",
                alignItems: "center",
                transform: hoveredIndex === index ? "scale(1.7) translateY(-4px)" : "scale(1) translateY(0)",
                transition: "transform 0.3s ease",
                willChange: "transform",
                zIndex: hoveredIndex === index ? 100 : 10 - index,
                position: "relative",
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div style={{
                borderRadius: "0.75rem",
                padding: "0.5rem",
                width: "100%",
                background: hoveredIndex === index
                  ? "linear-gradient(180deg, rgba(238,242,255,0.5) 0%, #ffffff 100%)"
                  : "linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)",
                border: hoveredIndex === index ? "1px solid #c7d2fe" : "1px solid #f3f4f6",
                boxShadow: hoveredIndex === index ? "0 6px 16px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                boxSizing: "border-box",
                transition: "all 0.3s ease",
              }}>
                <div style={{ width: "100%", borderRadius: "0.5rem", overflow: "hidden", aspectRatio: "5/6" }}>
                  <SingleProductPreview
                    garmentUrl={product.garmentUrl}
                    designUrl={imageUrl}
                    textureUrl={product.textureUrl}
                    shadowUrl={product.shadowUrl}
                    productIndex={index}
                    tintColor={tintColor}
                    designWidth={designWidth}
                    designHeight={designHeight}
                    previewSet={previewConfig.set}
                  />
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, marginTop: "0.5rem", color: hoveredIndex === index ? "#4f46e5" : "#6b7280", transition: "color 0.2s" }}>
                  {previewConfig.labels[index]}
                </span>
                {(() => {
                  const hasUserSize = designWidth >= 0.5 && designHeight >= 0.5;
                  const sizeLabel = hasUserSize
                    ? `${designWidth}" × ${designHeight}"`
                    : previewConfig.sizes[index];
                  return (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.2rem",
                      marginTop: "0.1875rem",
                      fontSize: "0.625rem", fontWeight: 600,
                      color: hasUserSize
                        ? "#7b2cbf"
                        : (hoveredIndex === index ? "#7b2cbf" : "#9ca3af"),
                      backgroundColor: hasUserSize
                        ? "rgba(123,44,191,0.1)"
                        : (hoveredIndex === index ? "rgba(123,44,191,0.08)" : "rgba(0,0,0,0.03)"),
                      padding: "0.125rem 0.375rem", borderRadius: "0.25rem",
                      border: hasUserSize ? "1px solid rgba(123,44,191,0.2)" : "1px solid transparent",
                      transition: "all 0.2s",
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                      </svg>
                      {sizeLabel}
                    </span>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        {/* Color picker */}
        <div style={{ marginTop: "1.25rem", padding: "1rem", background: "linear-gradient(145deg, #eef2ff 0%, rgba(245,243,255,0.6) 50%, #ffffff 100%)", borderRadius: "1rem", border: "1px solid #c7d2fe", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", fontWeight: 700, color: "#1f2937", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "1.25rem", height: "1.25rem", background: "linear-gradient(135deg, #8b5cf6, #ec4899)", borderRadius: "9999px", flexShrink: 0, boxShadow: "0 1px 4px rgba(139,92,246,0.4)" }}>
              <svg style={{ width: "0.75rem", height: "0.75rem", color: "#fff" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </span>
            Garment Color
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                onClick={() => changeColor(color)}
                style={{
                  width: "1.75rem",
                  height: "1.75rem",
                  flexShrink: 0,
                  borderRadius: "9999px",
                  border: tintColor === color ? "2px solid #6366f1" : "2px solid #ffffff",
                  backgroundColor: color,
                  boxShadow: tintColor === color
                    ? "0 0 0 3px rgba(99,102,241,0.25), 0 1px 4px rgba(0,0,0,0.18)"
                    : "0 1px 4px rgba(0,0,0,0.18)",
                  cursor: "pointer",
                  transform: tintColor === color ? "scale(1.2)" : "scale(1)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  padding: 0,
                  outline: "none",
                }}
              />
            ))}
            <label style={{ position: "relative", width: "1.75rem", height: "1.75rem", flexShrink: 0, cursor: "pointer", borderRadius: "9999px", border: "2px solid #ffffff", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", display: "block" }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "block",
                  borderRadius: "9999px",
                  background: "conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #88ff00, #00ff00, #00ff88, #00ffff, #0088ff, #0000ff, #8800ff, #ff00ff, #ff0088, #ff0000)",
                }}
              />
              <input
                type="color"
                value={tintColor}
                onChange={(e) => changeColor(e.target.value)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", opacity: 0 }}
                aria-label="Pick custom color"
              />
            </label>
          </div>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setShowDiscounts((prev) => !prev)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid #c7d2fe",
              background: "#ffffff",
              borderRadius: "0.625rem",
              padding: "0.5rem 0.625rem",
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "#3730a3",
              cursor: "pointer",
            }}
          >
            <span>Show Discounts</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: showDiscounts ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" ,marginLeft: "0.25rem",marginTop: "0.25rem"}}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showDiscounts && (
            <div
              style={{
                marginTop: "0.5rem",
                border: "1px solid #e5e7eb",
                borderRadius: "0.625rem",
                overflow: "hidden",
                backgroundColor: "#ffffff",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", color: "#374151" }}>
                    <th style={{ textAlign: "left", padding: "0.45rem 0.65rem", fontWeight: 700 }}>Buy</th>
                    <th style={{ textAlign: "left", padding: "0.45rem 0.65rem", fontWeight: 700 }}>Get</th>
                  </tr>
                </thead>
                <tbody>
                  {DISCOUNT_TABLE_ROWS.map((row) => (
                    <tr key={row.minSubtotal} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.45rem 0.65rem", color: "#111827", fontWeight: 600 }}>
                        {row.buyLabel}
                      </td>
                      <td style={{ padding: "0.45rem 0.65rem", color: "#374151" }}>
                        {row.getLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <PrintInfoCard />
      </div>
    </div>
  );
}

export default memo(DesignViewerPixelPerfect);
