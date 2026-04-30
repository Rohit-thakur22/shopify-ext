import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import UploadLoader from "./UploadLoader";
import DpiWarningModal from "./DpiWarningModal";
import UploadChoiceModal from "./UploadChoiceModal";
import PremadeDesignsModal from "./PremadeDesignsModal";
import { Camera, Trash, AlertTriangle } from "lucide-react";
import useDisableInteractions from "../hooks/useDisableInteractions";

// Print-quality threshold: smaller side must be at least this many pixels.
// At 300 DPI that's ~3.3" — below this, printing on cloth is visibly soft.
// Metadata (PNG pHYs / JPEG JFIF density) is intentionally ignored: it's a
// declarative tag, not a measure of actual image resolution. A 3000px PNG
// exported from Photoshop with default 72-DPI metadata still prints fine.
const MIN_PRINT_PIXELS = 1000;

/**
 * Read the natural pixel dimensions of an image file.
 * Skips PDFs (rasterized server-side, dimensions are server-controlled).
 * Returns null if the file isn't an image we can decode in-browser.
 */
async function readImagePixelSize(file) {
  if (!file) return null;
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/")) return null;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const result = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

const UploadPanel = ({
  onUpload,
  imageUrl,
  onEnhance,
  onRemoveBgAgain,
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
  const [dpiModalOpen, setDpiModalOpen] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showPremadeModal, setShowPremadeModal] = useState(false);
  const interactionBlockProps = useDisableInteractions({ enabled: true });

  // Disable zoom while loading so hover doesn't trigger zoom
  const zoomActive = isHovering && !loadingRemoveBg && !loadingEnhance;

  useEffect(() => {
    if (loadingRemoveBg || loadingEnhance || loadingDesignFromUrl)
      setIsHovering(false);
  }, [loadingRemoveBg, loadingEnhance, loadingDesignFromUrl]);

  // Clear DPI warning after enhance completes (image quality improved)
  const prevLoadingEnhanceRef = useRef(loadingEnhance);
  useEffect(() => {
    if (prevLoadingEnhanceRef.current && !loadingEnhance) {
      setDpiWarning(null);
      setDpiModalOpen(false);
    }
    prevLoadingEnhanceRef.current = loadingEnhance;
  }, [loadingEnhance]);

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

    // PDFs skip pixel-size check; server rasterizes them.
    if (file.type === "application/pdf") {
      onUpload(url, file);
      setDpiWarning(null);
      setDpiModalOpen(false);
      return;
    }

    // Decode once, share the result with ProductCustomizer via meta so it
    // doesn't re-decode the same file to compute inches.
    const size = await readImagePixelSize(file);
    onUpload(url, file, { pixelSize: size });

    if (size && Math.min(size.width, size.height) < MIN_PRINT_PIXELS) {
      setDpiWarning(size);
      setDpiModalOpen(true);
    } else {
      setDpiWarning(null);
      setDpiModalOpen(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    void handleSelectedFile(file);

    e.target.value = "";
  };

  const handleClick = () => {
    setShowChoiceModal(true);
  };

  const handleDeviceUpload = () => {
    fileInputRef.current?.click();
  };

  const handlePremadeSelect = async (blobUrl, file) => {
    if (!file || file.type === "application/pdf") {
      onUpload(blobUrl, file, { source: "premade" });
      setDpiWarning(null);
      setDpiModalOpen(false);
      return;
    }
    // Decode once, share dims with ProductCustomizer via meta.
    const size = await readImagePixelSize(file);
    onUpload(blobUrl, file, { source: "premade", pixelSize: size });

    if (size && Math.min(size.width, size.height) < MIN_PRINT_PIXELS) {
      setDpiWarning(size);
      setDpiModalOpen(true);
    } else {
      setDpiWarning(null);
      setDpiModalOpen(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer?.files[0];
    if (
      file &&
      (file.type.startsWith("image/") || file.type === "application/pdf")
    ) {
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
        dpi={dpiModalOpen ? dpiWarning : null}
        onClose={() => setDpiModalOpen(false)}
        onEnhance={onEnhance}
        onUploadNew={() => {
          setDpiModalOpen(false);
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
            {/* Zoom preview pane — portalled to body so it renders above all Shopify layers */}
            {zoomActive && typeof document !== "undefined" && containerRef.current && createPortal(
              (() => {
                const rect = containerRef.current.getBoundingClientRect();
                return (
                  <div
                    className="hidden lg:block"
                    style={{
                      position: "fixed",
                      top: rect.top,
                      left: rect.left - 220,
                      width: "13rem",
                      height: "13rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.5rem",
                      backgroundColor: "#fff",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                      zIndex: 99999,
                      pointerEvents: "none",
                      backgroundImage: `url(${imageUrl}), url('https://shopify-ext.vercel.app/assets/transparent-bg.webp')`,
                      backgroundRepeat: "no-repeat, repeat",
                      backgroundSize: `${ZOOM_SCALE * 100}%, auto`,
                      backgroundPosition: `${bgPos}, 0 0`,
                    }}
                    aria-hidden
                  />
                );
              })(),
              document.body,
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

          {/* Persistent DPI quality badge */}
          {dpiWarning && !loadingRemoveBg && !loadingEnhance && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
              backgroundColor: "#fffbeb", border: "1px solid #fde68a",
            }}>
              <AlertTriangle size={14} style={{ color: "#d97706", flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", color: "#92400e", flex: 1 }}>
                Low resolution ({dpiWarning.width} x {dpiWarning.height} px) — may not print clearly.
              </span>
              {/* {onEnhance && (
                <button
                  type="button"
                  onClick={onEnhance}
                  style={{
                    fontSize: "0.75rem", fontWeight: 700, color: "#ffffff",
                    backgroundColor: "#f59e0b", border: "none",
                    padding: "0.25rem 0.625rem", borderRadius: "0.375rem",
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  Enhance
                </button>
              )} */}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {/* Enhance Image — only when uploaded image is low resolution */}
            {dpiWarning && onEnhance && (
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
              <span>{loadingEnhance ? "Enhancing..." : "Enhance"}</span>
            </button>
            )}

            {/* Remove BG Again */}
            {onRemoveBgAgain && (
              <button
                type="button"
                onClick={onRemoveBgAgain}
                disabled={isAnyLoading}
                style={{
                  flex: "1 1 200px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  letterSpacing: "0.01em",
                  transition: "all 0.3s ease",
                  border: "none",
                  outline: "none",
                  cursor: isAnyLoading ? "not-allowed" : "pointer",
                  backgroundColor: loadingRemoveBg ? "#f3f4f6" : "#9333ea",
                  backgroundImage: loadingRemoveBg
                    ? "none"
                    : "linear-gradient(to right, #9333ea, #7c3aed)",
                  color: loadingRemoveBg ? "#9ca3af" : "#ffffff",
                  boxShadow: loadingRemoveBg
                    ? "none"
                    : "0 4px 12px rgba(147,51,234,0.3)",
                  minWidth: 0,
                  textAlign: "center",
                }}
                onMouseEnter={(e) => {
                  if (!isAnyLoading) {
                    e.currentTarget.style.backgroundImage =
                      "linear-gradient(to right, #7e22ce, #6d28d9)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(147,51,234,0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAnyLoading) {
                    e.currentTarget.style.backgroundImage =
                      "linear-gradient(to right, #9333ea, #7c3aed)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(147,51,234,0.3)";
                  }
                }}
              >
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    lineHeight: 1.15,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                    }}
                  >
                    {loadingRemoveBg ? (
                      <svg
                        className="animate-spin"
                        width="18"
                        height="18"
                        fill="none"
                        viewBox="0 0 24 24"
                        style={{ flexShrink: 0 }}
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
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        style={{ flexShrink: 0 }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 006.3 5.7L4 10m16 4l-2.3 4.3A8 8 0 014 15"
                        />
                      </svg>
                    )}
                    {loadingRemoveBg ? "Removing…" : "AI BG Remover"}
                  </span>
                  {!loadingRemoveBg && (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 500,
                        opacity: 0.85,
                        marginTop: "0.125rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                    >
                      High-quality, precise background removal
                    </span>
                  )}
                </span>
              </button>
            )}
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
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Choice Modal */}
      <UploadChoiceModal
        open={showChoiceModal}
        onClose={() => setShowChoiceModal(false)}
        onChooseDevice={handleDeviceUpload}
        onChoosePremade={() => setShowPremadeModal(true)}
      />

      {/* Pre-made Designs Modal */}
      <PremadeDesignsModal
        open={showPremadeModal}
        onClose={() => setShowPremadeModal(false)}
        onSelectImage={handlePremadeSelect}
      />
    </div>
  );
};

export default UploadPanel;
