import React, { useRef, useState, useEffect } from "react";
import UploadLoader from "./UploadLoader";
import DpiWarningModal from "./DpiWarningModal";
import { Camera, Trash } from "lucide-react";
import useDisableInteractions from "../hooks/useDisableInteractions";

const PRINT_DPI_THRESHOLD = 300;

function getPngDpi(view) {
  // PNG signature is 8 bytes, chunks start at byte 8
  let offset = 8;
  while (offset + 12 <= view.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    );

    // pHYs: 4 bytes x ppm, 4 bytes y ppm, 1 byte unit specifier
    if (type === "pHYs" && length === 9) {
      const xPpm = view.getUint32(offset + 8);
      const yPpm = view.getUint32(offset + 12);
      const unit = view.getUint8(offset + 16);
      if (unit === 1) {
        return {
          x: xPpm * 0.0254,
          y: yPpm * 0.0254,
        };
      }
      return null;
    }

    offset += 12 + length;
  }
  return null;
}

function getJpegDpi(view) {
  let offset = 2; // Skip SOI marker (FFD8)
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = view.getUint8(offset + 1);
    if (marker === 0xd9 || marker === 0xda) break; // EOI/SOS

    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2) break;

    // APP0/JFIF segment can include pixel density information
    if (marker === 0xe0 && offset + 2 + segmentLength <= view.byteLength) {
      const ident = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7),
        view.getUint8(offset + 8),
      );

      if (ident === "JFIF\0") {
        const units = view.getUint8(offset + 11);
        const xDensity = view.getUint16(offset + 12);
        const yDensity = view.getUint16(offset + 14);

        if (units === 1) return { x: xDensity, y: yDensity }; // dots per inch
        if (units === 2)
          return { x: xDensity * 2.54, y: yDensity * 2.54 }; // dots per cm
        return null;
      }
    }

    offset += 2 + segmentLength;
  }
  return null;
}

async function readImageDpi(file) {
  if (!file) return null;
  const type = (file.type || "").toLowerCase();
  if (!type.includes("png") && !type.includes("jpeg") && !type.includes("jpg")) {
    return null;
  }

  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    if (type.includes("png")) return getPngDpi(view);
    if (type.includes("jpeg") || type.includes("jpg")) return getJpegDpi(view);
    return null;
  } catch (err) {
    console.warn("Could not read image DPI metadata:", err);
    return null;
  }
}

const UploadPanel = ({
  onUpload,
  imageUrl,
  onEnhance,
  loadingRemoveBg = false,
  loadingEnhance = false,
  loadingDesignFromUrl = false,
  onClear,
  onCancelProcessing,
  removeBgEnabled = true,
  onToggleRemoveBg,
}) => {
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [bgPos, setBgPos] = useState("center");
  const [progress, setProgress] = useState(0);
  const [dpiWarning, setDpiWarning] = useState(null);
  const interactionBlockProps = useDisableInteractions({ enabled: true });

  // Disable zoom while loading so hover doesn't trigger zoom
  const zoomActive = isHovering && !loadingRemoveBg && !loadingEnhance;

  useEffect(() => {
    if (loadingRemoveBg || loadingEnhance || loadingDesignFromUrl)
      setIsHovering(false);
  }, [loadingRemoveBg, loadingEnhance, loadingDesignFromUrl]);

  // Realistic progress 0 → 95% with ease-out (fast start, slow near end); jump to 100% when done. Never sticks at one value.
  useEffect(() => {
    if (!loadingRemoveBg && !loadingEnhance) {
      setProgress((prev) => (prev > 0 ? 100 : 0));
      return;
    }
    setProgress(0);
    const start = Date.now();
    const duration = 12000; // 12s to reach 95% — always moving, feels natural
    const maxProgress = 95;
    const tickMs = 80;
    // Ease-out cubic: fast at start, slows as it approaches end (1 - (1-t)^3)
    const easeOutCubic = (t) => (t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const p = maxProgress * easeOutCubic(t);
      setProgress(p);
      if (p >= maxProgress) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, [loadingRemoveBg, loadingEnhance]);

  const ZOOM_SCALE = 2.5;

  const handleSelectedFile = async (file) => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    onUpload(url, file);

    const dpi = await readImageDpi(file);
    if (
      dpi &&
      (dpi.x < PRINT_DPI_THRESHOLD || dpi.y < PRINT_DPI_THRESHOLD)
    ) {
      setDpiWarning(dpi);
    } else {
      setDpiWarning(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    void handleSelectedFile(file);

    e.target.value = "";
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) {
      void handleSelectedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setBgPos(`${x}% ${y}%`);
  };

  const isAnyLoading =
    loadingRemoveBg || loadingEnhance || loadingDesignFromUrl;

  return (
    <div className="upload-panel">
      <div className="text-start space-y-1 mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">
          Step 1: Upload Your Design
        </h2>
        <p className="text-sm text-gray-500">
          Upload an image to customize your product
        </p>
      </div>
      <DpiWarningModal
        dpi={dpiWarning}
        onClose={() => setDpiWarning(null)}
        onUploadNew={() => {
          setDpiWarning(null);
          handleClick();
        }}
      />

      {/* Remove BG Toggle */}
      {imageUrl && (
        <div
          className="flex items-center justify-between p-4 sm:p-2 rounded-2xl mb-6 border shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-r from-gray-50 to-white gap-2"
          style={{ borderColor: "#f3f4f6", marginBottom: 5 }}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shadow-inner shrink-0">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "#9333ea" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Remove Background
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Automatically remove background from uploaded images
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleRemoveBg(!removeBgEnabled)}
            disabled={loadingRemoveBg || loadingEnhance}
            className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: removeBgEnabled ? "#9333ea" : "#d1d5db",
              outlineColor: "#9333ea",
            }}
            role="switch"
            aria-checked={removeBgEnabled}
            aria-label="Toggle automatic background removal"
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out"
              style={{
                transform: removeBgEnabled
                  ? "translateX(0.5rem)"
                  : "translateX(-0.8rem)",
              }}
            />
          </button>
        </div>
      )}

      {imageUrl ? (
        <div className="space-y-4">
          {/* Image preview with zoom */}
          <div className="relative">
            {/* Zoom preview pane (shows on hover; disabled while loading) */}
            {zoomActive && (
              <div
                className="absolute -left-[230px] top-0 hidden lg:block w-52 h-52 border border-gray-300 rounded-lg bg-white shadow-lg z-50"
                style={{
                  backgroundImage: `url(${imageUrl}), url('https://shopify-ext.vercel.app/assets/transparent-bg.webp')`,
                  backgroundRepeat: "no-repeat, repeat",
                  backgroundSize: `${ZOOM_SCALE * 100}%, auto`,
                  backgroundPosition: `${bgPos}, 0 0`,
                }}
                aria-hidden
              />
            )}

            {/* Main preview */}
            <div
              ref={containerRef}
              className={`relative w-full aspect-square md:aspect-video border border-gray-200 rounded-lg overflow-hidden ${zoomActive ? "cursor-zoom-in" : "cursor-default"}`}
              style={{
                backgroundImage: `url(${imageUrl}), url('https://shopify-ext.vercel.app/assets/transparent-bg.webp')`,
                backgroundRepeat: "no-repeat, repeat",
                backgroundSize: zoomActive
                  ? `${ZOOM_SCALE * 100}%, auto`
                  : "contain, auto",
                backgroundPosition: zoomActive
                  ? `${bgPos}, 0 0`
                  : "center, 0 0",
                transition:
                  "background-size 0.2s ease, background-position 0.2s ease",
                minHeight: "320px",
              }}
              onMouseEnter={() =>
                !loadingRemoveBg && !loadingEnhance && setIsHovering(true)
              }
              onMouseLeave={() => setIsHovering(false)}
              onMouseMove={zoomActive ? handleMouseMove : undefined}
              aria-label="Uploaded image preview"
            >
              {/* Loading overlay - animated loader with progress and Stop */}
              {isAnyLoading && (
                <UploadLoader
                  progress={progress}
                  message={
                    loadingRemoveBg
                      ? "Removing background..."
                      : "Enhancing image..."
                  }
                  onStop={onCancelProcessing}
                />
              )}

              {/* Transparent protection layer: blocks direct media interaction */}
              <div
                {...interactionBlockProps}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 5,
                  background: "transparent",
                  ...interactionBlockProps.style,
                }}
                aria-hidden
              />
            </div>

            {/* Note: keep media interactions blocked intentionally for protection */}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {/* Enhance Image */}
            <button
              type="button"
              onClick={onEnhance}
              disabled={isAnyLoading}
              className="enhance-button"
              style={{
                flex: "1 1 140px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.875rem 1.25rem",
                borderRadius: "0.75rem",
                fontSize: "1rem",
                fontWeight: "700",
                letterSpacing: "0.025em",
                transition: "all 0.3s ease",
                border: "none",
                outline: "none",
                cursor: isAnyLoading ? "not-allowed" : "pointer",
                backgroundColor: loadingEnhance ? "#f3f4f6" : "#f59e0b",
                backgroundImage: loadingEnhance
                  ? "none"
                  : "linear-gradient(to right, #f59e0b, #f97316)",
                color: loadingEnhance ? "#9ca3af" : "#ffffff",
                boxShadow: loadingEnhance
                  ? "none"
                  : "0 4px 12px rgba(245,158,11,0.3)",
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                if (!isAnyLoading) {
                  e.currentTarget.style.backgroundImage =
                    "linear-gradient(to right, #d97706, #ea580c)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 20px rgba(245,158,11,0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnyLoading) {
                  e.currentTarget.style.backgroundImage =
                    "linear-gradient(to right, #f59e0b, #f97316)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(245,158,11,0.3)";
                }
              }}
            >
              {loadingEnhance ? (
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              )}
              <span>{loadingEnhance ? "Enhancing..." : "✨ Enhance"}</span>
            </button>
          </div>

          {/* Secondary actions */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <button
              type="button"
              onClick={handleClick}
              disabled={isAnyLoading}
              style={{
                flex: 1,
                padding: "0.75rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: "600",
                borderRadius: "0.75rem",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                color: "#374151",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                cursor: isAnyLoading ? "not-allowed" : "pointer",
                opacity: isAnyLoading ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isAnyLoading) {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                  e.currentTarget.style.boxShadow =
                    "0 4px 8px rgba(0,0,0,0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnyLoading) {
                  e.currentTarget.style.backgroundColor = "#ffffff";
                  e.currentTarget.style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.05)";
                }
              }}
            >
             <Camera className="w-4 h-4 mr-2" /> Upload Different Image
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={isAnyLoading}
                style={{
                  padding: "0.75rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  borderRadius: "0.75rem",
                  backgroundColor: "#ffffff",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  cursor: isAnyLoading ? "not-allowed" : "pointer",
                  opacity: isAnyLoading ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isAnyLoading) {
                    e.currentTarget.style.backgroundColor = "#fef2f2";
                    e.currentTarget.style.boxShadow =
                      "0 4px 8px rgba(0,0,0,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAnyLoading) {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.boxShadow =
                      "0 1px 3px rgba(0,0,0,0.05)";
                  }
                }}
              >
                <Trash className="w-4 h-4 mr-2" /> Remove
              </button>
            )}
          </div>
        </div>
      ) : loadingDesignFromUrl ? (
        <div
          className="border-2 border-dashed border-blue-200 rounded-2xl p-10 text-center min-h-[240px] flex items-center justify-center transition-all duration-300"
          style={{ backgroundColor: "rgba(239, 246, 255, 0.5)" }}
        >
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <div className="relative">
              <svg
                className="animate-spin h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                style={{ color: "#3b82f6" }}
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800">
                Loading your design </p>
              <p className="text-sm text-gray-500 mt-1">
                Fetching image from product…
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="group border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-300"
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div
            className=""
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "20px 0px",
            }}
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-50 to-blue-50 shadow-inner flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <svg
                className="w-10 h-10 text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="mt-2">
              <p className="text-lg font-semibold text-gray-800">
                Click to upload or drag & drop
              </p>
              <p className="text-sm text-gray-500 mt-1">
                PNG, JPG, GIF up to 10MB
              </p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default UploadPanel;
