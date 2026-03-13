import React, { useCallback, useMemo, useState, memo } from "react";
import { Stage, Layer, Image, Rect, Group } from "react-konva";
import useImage from "use-image";

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

// Stage internal resolution (high DPI); display size controlled by CSS
const STAGE_WIDTH = 500;
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

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0] && entries[0].contentRect.width > 0) {
        setScaleFactor(entries[0].contentRect.width / STAGE_WIDTH);
      }
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
          }}
        >
          <Stage
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            style={{ imageRendering: "auto" }}
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
    <div className="design-viewer">
      <div className="w-full">
        <div className="max-w-3xl p-6 bg-white rounded-2xl border border-gray-100 shadow-sm h-max">
          <div className="text-start space-y-1 mb-6">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">
              Preview
            </h2>
            <p className="text-sm text-gray-500">
              See your design on our most popular styles
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {products.map((product, index) => (
              <div
                key={product.key}
                className="group flex pt-3 flex-col items-center transform transition-all duration-300 ease-in-out hover:scale-180 hover:-translate-y-1"
                style={{
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                  transform: "translateZ(0)",
                  zIndex: hoveredIndex === index ? 100 : 10 - index,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="rounded-xl p-2 sm:p-3 w-full bg-gray-50/50 border border-gray-100 shadow-inner group-hover:shadow-md group-hover:bg-white group-hover:border-indigo-100 transition-all duration-300 flex items-center justify-center overflow-hidden">
                  <div
                    className="w-full max-w-[200px] rounded-lg overflow-hidden"
                    style={{
                      aspectRatio: "5/6",
                      filter: "contrast(1.1) saturate(1.05)",
                    }}
                  >
                    <SingleProductPreview
                      garmentUrl={product.garmentUrl}
                      designUrl={imageUrl}
                      textureUrl={product.textureUrl}
                      shadowUrl={product.shadowUrl}
                      productIndex={index}
                      tintColor={tintColor}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-6 p-2 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 shadow-sm"
          style={{ marginTop: 5 }}
        >
          <p className="text-sm text-gray-800 font-semibold mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            Change preview items to any color below:
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                className={`h-8 w-8 shrink-0 rounded-full border border-gray-200 shadow-sm hover:scale-110 transition-transform duration-200 focus:outline-none ${
                  tintColor === color
                    ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                    : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => changeColor(color)}
              />
            ))}
            <label className="relative h-8 w-8 shrink-0 cursor-pointer rounded-full border border-gray-200 overflow-hidden shadow-sm hover:scale-110 transition-transform duration-200">
              <span
                className="absolute inset-0 block rounded-full"
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
    </div>
  );
}

export default memo(DesignViewerPixelPerfect);
