import React, { useRef, useState, useEffect } from "react";
import UploadLoader from "./UploadLoader";

const UploadPanel = ({
  onUpload,
  imageUrl,
  onRemoveBg,
  onEnhance,
  loadingRemoveBg = false,
  loadingEnhance = false,
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

  // Disable zoom while loading so hover doesn't trigger zoom
  const zoomActive = isHovering && !loadingRemoveBg && !loadingEnhance;

  useEffect(() => {
    if (loadingRemoveBg || loadingEnhance) setIsHovering(false);
  }, [loadingRemoveBg, loadingEnhance]);

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    onUpload(url, file);

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
      const url = URL.createObjectURL(file);
      onUpload(url, file);
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

  const isAnyLoading = loadingRemoveBg || loadingEnhance;

  return (
    <div className="upload-panel">
      <div className="text-start space-y-2 mb-4">
        <h2 className="font-bold text-black text-base">
          Step 1: Upload Your Design
        </h2>
        <p className="text-xs text-gray-600">
          Upload an image to customize your product
        </p>
      </div>

      {/* Remove BG Toggle */}
      {imageUrl && (
        <div
          className="flex items-center justify-between p-3 rounded-lg mb-4 border"
          style={{ backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }}
        >
          <div className="flex items-center gap-2">
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
            <div>
              <p className="text-sm font-semibold" style={{ color: "#111827" }}>
                Remove Background
              </p>
              <p className="text-xs" style={{ color: "#4b5563" }}>
                Automatically remove background from uploaded images
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleRemoveBg(!removeBgEnabled)}
            disabled={loadingRemoveBg || loadingEnhance}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: removeBgEnabled ? "#9333ea" : "#d1d5db",
              outlineColor: "#9333ea",
            }}
            role="switch"
            aria-checked={removeBgEnabled}
            aria-label="Toggle automatic background removal"
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full transition-transform"
              style={{
                backgroundColor: "#ffffff",
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
                className="absolute -right-[220px] top-0 hidden lg:block w-52 h-52 border border-gray-300 rounded-lg bg-white shadow-lg z-50"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${ZOOM_SCALE * 100}%`,
                  backgroundPosition: bgPos,
                }}
                aria-hidden
              />
            )}

            {/* Main preview */}
            <div
              ref={containerRef}
              className={`relative w-full aspect-video bg-gray-50 border border-gray-200 rounded-lg overflow-hidden ${zoomActive ? "cursor-zoom-in" : "cursor-default"}`}
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: zoomActive ? `${ZOOM_SCALE * 100}%` : "contain",
                backgroundPosition: zoomActive ? bgPos : "center",
                transition: "background-size 0.2s ease",
                minHeight: "200px",
              }}
              onMouseEnter={() =>
                !loadingRemoveBg && !loadingEnhance && setIsHovering(true)
              }
              onMouseLeave={() => setIsHovering(false)}
              onMouseMove={zoomActive ? handleMouseMove : undefined}
              onClick={() =>
                !loadingRemoveBg &&
                !loadingEnhance &&
                window.open(imageUrl, "_blank")
              }
              aria-label="Uploaded image preview - click to enlarge"
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
            </div>

            {/* Hover hint */}
            <div className="hidden lg:flex items-center justify-center gap-2 mt-2 text-xs text-gray-500">
              <span>Hover to zoom</span>
              <span>•</span>
              <span>Click to open full size</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Remove Background */}
            {/* <button
              type="button"
              onClick={onRemoveBg}
              disabled={isAnyLoading}
              className="remove-bg-button flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                minWidth: '140px',
                backgroundColor: loadingRemoveBg ? '#f3f4f6' : '#9333ea',
                backgroundImage: loadingRemoveBg ? 'none' : 'linear-gradient(to right, #9333ea, #3b82f6)',
                color: loadingRemoveBg ? '#9ca3af' : '#ffffff',
                cursor: loadingRemoveBg ? 'wait' : 'pointer',
                boxShadow: loadingRemoveBg ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: 'none',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!loadingRemoveBg && !isAnyLoading) {
                  e.currentTarget.style.backgroundColor = '#7c3aed';
                  e.currentTarget.style.backgroundImage = 'linear-gradient(to right, #7c3aed, #2563eb)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingRemoveBg && !isAnyLoading) {
                  e.currentTarget.style.backgroundColor = '#9333ea';
                  e.currentTarget.style.backgroundImage = 'linear-gradient(to right, #9333ea, #3b82f6)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              {loadingRemoveBg ? (
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
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
              <span>{loadingRemoveBg ? "Removing..." : "Remove BG"}</span>
            </button> */}

            {/* Enhance Image */}
            <button
              type="button"
              onClick={onEnhance}
              disabled={isAnyLoading}
              className="enhance-button flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                minWidth: "140px",
                backgroundColor: loadingEnhance ? "#f3f4f6" : "#f59e0b",
                backgroundImage: loadingEnhance
                  ? "none"
                  : "linear-gradient(to right, #f59e0b, #f97316)",
                color: loadingEnhance ? "#9ca3af" : "#ffffff",
                cursor: loadingEnhance ? "wait" : "pointer",
                boxShadow: loadingEnhance
                  ? "none"
                  : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                border: "none",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (!loadingEnhance && !isAnyLoading) {
                  e.currentTarget.style.backgroundColor = "#d97706";
                  e.currentTarget.style.backgroundImage =
                    "linear-gradient(to right, #d97706, #ea580c)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingEnhance && !isAnyLoading) {
                  e.currentTarget.style.backgroundColor = "#f59e0b";
                  e.currentTarget.style.backgroundImage =
                    "linear-gradient(to right, #f59e0b, #f97316)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
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
          </div>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClick}
              disabled={isAnyLoading}
              className="flex-1 px-4 py-2 text-sm rounded-lg transition-colors"
              style={{
                color: "#374151",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                opacity: isAnyLoading ? 0.5 : 1,
                cursor: isAnyLoading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isAnyLoading) {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnyLoading) {
                  e.currentTarget.style.backgroundColor = "#ffffff";
                }
              }}
            >
              Upload Different Image
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={isAnyLoading}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  backgroundColor: "#ffffff",
                  opacity: isAnyLoading ? 0.5 : 1,
                  cursor: isAnyLoading ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isAnyLoading) {
                    e.currentTarget.style.backgroundColor = "#fef2f2";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAnyLoading) {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
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
              padding: "15px 0px",
            }}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-500"
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
            <div>
              <p className="text-base font-medium text-gray-700">
                Click to upload or drag and drop
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
