import React, { useState } from "react";

/**
 * Base URL for app assets. In Shopify the page is the store, so relative paths
 * like /assets/... resolve to the store and 404. Use the script's origin so
 * the GIF loads from the app host (e.g. Vercel).
 */
function getAssetBase() {
  if (typeof document === "undefined") return "";
  try {
    const script = document.currentScript;
    if (script?.src) {
      const origin = new URL(script.src).origin;
      return origin;
    }
  } catch (_) {}
  return "";
}

const ASSET_BASE = getAssetBase();

/**
 * UploadLoader - Processing overlay with animated mascot, progress bar, and Stop.
 * Shown while image is being processed (remove BG / enhance).
 */
const UploadLoader = ({ progress = 0, message, onStop }) => {
  // Single clamped value so bar and percentage stay in sync
  const value = Math.min(100, Math.max(0, Number(progress)));
  const displayPercent = Math.round(value);
  const [gifError, setGifError] = useState(false);

  // Use absolute URL when embedded (e.g. Shopify) so GIF loads from app host; relative for local/Vercel same-origin
  const gifPath = ASSET_BASE
    ? `${ASSET_BASE}/assets/gifs/comic-characters.gif`
    : "/assets/gifs/comic-characters.gif";

  return (
    <div
      className="upload-loader-overlay absolute inset-0 z-10 flex items-center justify-center rounded-lg"
      style={{ backgroundColor: "rgba(240, 249, 255, 0.95)" }}
    >
      <div className="flex w-full max-w-sm flex-col items-center px-6 py-8 text-center">
        {/* Animated GIF from public assets with fallback spinner */}
        <div className="mb-4 flex justify-center">
          {!gifError ? (
            <img
              src={gifPath}
              alt=""
              className="h-24 w-auto object-contain"
              onError={() => setGifError(true)}
            />
          ) : (
            <div className="h-24 w-24 flex items-center justify-center">
              <svg
                className="animate-spin h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                style={{ color: "#3b82f6" }}
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
          )}
        </div>

        {/* Progress percentage - synced with bar */}
        <p
          className="text-xl font-bold tabular-nums"
          style={{ color: "#1f2937" }}
        >
          {displayPercent}%
        </p>

        {/* Progress bar - gradient, shimmer, glow */}
        <div
          className="upload-progress-track mt-2 w-full overflow-hidden rounded-full shadow-inner"
          style={{ backgroundColor: "#e5e7eb" }}
        >
          <div
            className="upload-progress-fill h-2.5 rounded-full transition-[width] duration-150 ease-linear"
            style={{ width: `${value}%` }}
          />
        </div>

        {/* Status messages */}
        <p className="mt-4 text-sm font-medium" style={{ color: "#374151" }}>
          We're making sure your upload is perfect for printing.
        </p>
        <p className="mt-1 text-xs" style={{ color: "#6b7280" }}>
          This may take a few seconds.
        </p>

        {/* Stop - use dedicated class so button is always visible in Shopify/themes */}
        <button
          type="button"
          onClick={onStop}
          style={{ marginTop: "1rem" }}
          className="upload-loader-stop-btn px-5 py-2 text-sm font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          Stop
        </button>
      </div>
    </div>
  );
};

export default UploadLoader;
