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

  // Simulate progress 0 → 90 while processing; jump to 100 when done. Single progress value keeps bar and percentage in sync.
  useEffect(() => {
    if (!loadingRemoveBg && !loadingEnhance) {
      setProgress((prev) => (prev > 0 ? 100 : 0));
      return;
    }
    setProgress(0);
    const start = Date.now();
    const duration = 4000; // 4s to reach 90%
    const tickMs = 50; // Update every 50ms so bar and percentage stay in sync
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(90, (elapsed / duration) * 90);
      setProgress(p);
      if (p >= 90) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, [loadingRemoveBg, loadingEnhance]);

  const ZOOM_SCALE = 2.5;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create object URL from file and pass the file for API calls
    const url = URL.createObjectURL(file);
    onUpload(url, file);

    // Reset input so same file can be selected again
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
              onMouseEnter={() => !loadingRemoveBg && !loadingEnhance && setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onMouseMove={zoomActive ? handleMouseMove : undefined}
              onClick={() => !loadingRemoveBg && !loadingEnhance && window.open(imageUrl, "_blank")}
              aria-label="Uploaded image preview - click to enlarge"
            >
              {/* Loading overlay - animated loader with progress and Stop */}
              {isAnyLoading && (
                <UploadLoader
                  progress={progress}
                  message={loadingRemoveBg ? "Removing background..." : "Enhancing image..."}
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
            <button
              type="button"
              onClick={onRemoveBg}
              disabled={isAnyLoading}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                loadingRemoveBg
                  ? "bg-gray-100 text-gray-400 cursor-wait"
                  : "bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600 shadow-md hover:shadow-lg"
              }`}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
              <span>{loadingRemoveBg ? "Removing..." : "Remove BG"}</span>
            </button>

            {/* Enhance Image */}
            <button
              type="button"
              onClick={onEnhance}
              disabled={isAnyLoading}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                loadingEnhance
                  ? "bg-gray-100 text-gray-400 cursor-wait"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md hover:shadow-lg"
              }`}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Upload Different Image
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={isAnyLoading}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
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
          <div className="space-y-3">
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
