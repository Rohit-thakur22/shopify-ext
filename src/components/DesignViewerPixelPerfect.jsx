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

const PRODUCT_KEYS = ["tshirt", "hoodie", "polo", "cap", "apron", "tote"];
const PRODUCT_LABELS = ["T-Shirt", "Hoodie", "Polo Shirt", "Cap", "Apron", "Tote Bag"];
const SIZES = [
  '11" x 11"',
  '4" x 2.5"',
  '3.5" x 3.5"',
  '7" x 7"',
  '9" x 9"',
  '5" x 5"',
];

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
const DEFAULT_ASSETS = {
  tshirt: `${CDN}/assets/6-cloths/full-front.webp`,
  hoodie: `${CDN}/assets/6-cloths/Hoodie_White.webp`,
  polo: `${CDN}/assets/6-cloths/polo-tshirt.webp`,
  cap: `${CDN}/assets/6-cloths/Cap_White.webp`,
  apron: `${CDN}/assets/6-cloths/Apron_White.webp`,
  tote: `${CDN}/assets/6-cloths/Tote_White.png`,
};

function getGarmentUrl(assetUrls, productKey, color) {
  const colorVariants = assetUrls?.colorVariants;
  if (colorVariants?.[color]?.[productKey]) {
    return colorVariants[color][productKey];
  }
  // Always use Vercel CDN — ignore Shopify assetUrls for garments
  return DEFAULT_ASSETS[productKey];
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
    const area = FIXED_DESIGN_AREAS[productIndex] ?? FIXED_DESIGN_AREAS[0];
    // Allowed pixel dimensions inside the garment
    const allowedWidth = garmentWidth * area.maxWidth;
    const allowedHeight = garmentHeight * area.maxHeight;
    // Scale to fit both axes — whichever is more constrained wins
    const scaleToFitWidth = allowedWidth / designImage.width;
    const scaleToFitHeight = allowedHeight / designImage.height;
    // Always use the smaller of the two so the image NEVER overflows the cloth
    return Math.min(scaleToFitWidth, scaleToFitHeight);
  }, [designImage, garmentImage, garmentWidth, garmentHeight, productIndex]);

  const designX = useMemo(() => {
    if (productIndex === 2) {
      return STAGE_WIDTH / 2 + garmentWidth * POLO_OFFSET_X;
    }
    return STAGE_WIDTH / 2;
  }, [garmentWidth, productIndex]);

  const designY = useMemo(() => {
    if (productIndex === 2) {
      return STAGE_HEIGHT / 2 + garmentHeight * POLO_OFFSET_Y;
    }
    const factor = getDesignOffsetFactor(productIndex);
    return STAGE_HEIGHT / 2 + garmentHeight * factor;
  }, [garmentHeight, productIndex]);

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
}) {
  const [localTintColor, setLocalTintColor] = useState("#6b7280");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const tintColor =
    propTintColor !== undefined ? propTintColor : localTintColor;

  const products = useMemo(() => {
    return PRODUCT_KEYS.map((key, index) => ({
      key,
      garmentUrl: getGarmentUrl(assetUrls, key, tintColor),
      size: SIZES[index],
      textureUrl: assetUrls[`${key}Texture`] || null,
      shadowUrl: assetUrls[`${key}Shadow`] || null,
    }));
  }, [assetUrls, tintColor]);

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
                  />
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, marginTop: "0.5rem", color: hoveredIndex === index ? "#4f46e5" : "#6b7280", transition: "color 0.2s" }}>
                  {PRODUCT_LABELS[index]}
                </span>
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
