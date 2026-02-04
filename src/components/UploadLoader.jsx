import React from "react";

/**
 * UploadLoader - Processing overlay with animated mascot, progress bar, and Stop.
 * Shown while image is being processed (remove BG / enhance).
 */
const UploadLoader = ({ progress = 0, message, onStop }) => {
  // Single clamped value so bar and percentage stay in sync
  const value = Math.min(100, Math.max(0, Number(progress)));
  const displayPercent = Math.round(value);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-sky-50/95 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center px-6 py-8 text-center">
        {/* Animated GIF from public assets */}
        <div className="mb-4 flex justify-center">
          <img
            src="/assets/gifs/comic-characters.gif"
            alt=""
            className="h-24 w-auto object-contain"
          />
        </div>

        {/* Progress percentage - synced with bar */}
        <p className="text-xl font-bold text-gray-800 tabular-nums">
          {displayPercent}%
        </p>

        {/* Progress bar - gradient, shimmer, glow */}
        <div className="upload-progress-track mt-2 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner">
          <div
            className="upload-progress-fill h-2.5 rounded-full transition-[width] duration-150 ease-linear"
            style={{ width: `${value}%` }}
          />
        </div>

        {/* Status messages */}
        <p className="mt-4 text-sm font-medium text-gray-700">
          We're making sure your upload is perfect for printing.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          This may take a few seconds.
        </p>

        {/* Stop */}
        <button
          type="button"
          onClick={onStop}
          className="mt-5 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          Stop
        </button>
      </div>
    </div>
  );
};

export default UploadLoader;
