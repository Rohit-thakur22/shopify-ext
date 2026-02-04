import React, { useRef, useState } from "react";

// Simple hover-to-zoom image preview. Zooms the background image towards cursor
// without introducing external dependencies.
const ImagePreview = ({
  imageUrl,
  onRemove,
  onRemoveBg,
  onEnhance,
  loadingRemoveBg = false,
  loadingEnhance = false,
}) => {
  const containerRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [bgPos, setBgPos] = useState("center");

  const ZOOM_SCALE = 1.2; // how much to zoom on hover

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setBgPos(`${x}% ${y}%`);
  };

  if (!imageUrl) return null;

  const isAnyLoading = loadingRemoveBg || loadingEnhance;
  const container =
    typeof document !== "undefined"
      ? document.getElementById("cloth-editor-app")
      : null;
  return (
    <div className="ImagePreview w-[90%]  lg:w-lg absolute top-[0px] lg:-top-[58px] right-[20px] xl:right-[95px] z-[99999]">
      <div className="hidden lg:flex items-center justify-center gap-2 mb-2 select-none ">
        <span className="text-sm text-gray-700">Hover to Zoom</span>
        <span className="text-sm text-blue-600 cursor-zoom-in">
          Click to enlarge
        </span>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Main area with left-side zoom preview on hover */}
        <div className="relative flex items-start justify-center gap-4">
          {/* Left zoom pane */}
          {isHovering && (
            <div
              className="hidden absolute left-[-350px] md:block w-96 h-96 border border-gray-300 rounded-md bg-white shadow-sm"
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${ZOOM_SCALE * 120}% auto`,
                backgroundPosition: bgPos,
                zIndex: 9999,
              }}
              aria-hidden
            />
          )}

          {/* Main preview image (hover target) */}
          <div
            ref={containerRef}
            className="w-full max-w-md mx-auto aspect-[16/9] bg-white border border-dashed border-gray-400 rounded-md overflow-hidden cursor-zoom-in !h-[200px] md:!h-[210px] "
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: isHovering
                ? `${ZOOM_SCALE * 120}% auto`
                : "contain",
              backgroundPosition: isHovering ? bgPos : "center",
              transition:
                "background-size 0.3s ease, background-position 0.3s ease",
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onMouseMove={handleMouseMove}
            onClick={() => window.open(imageUrl, "_blank")}
            aria-label="Uploaded image preview"
          />

          {isAnyLoading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm grid place-items-center">
              <div className="flex items-center gap-3 text-gray-700">
                <svg
                  className="animate-spin h-5 w-5 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
                {/* <span className="text-sm font-medium">
                {loadingRemoveBg ? "Removing background…" : "Enhancing image…"}
              </span> */}
              </div>
            </div>
          )}

          <button
            type="button"
            className="absolute top-0 right-0 cursor-pointer h-6 w-6 grid place-items-center rounded-md bg-white border border-gray-300 shadow-2xl hover:bg-white"
            onClick={onRemove}
            aria-label="Remove uploaded image"
            title="Remove"
            style={{
              borderRadius: 4,
            }}
          >
            ❌
          </button>
        </div>

        {/* Action buttons */}
        <div
          className="flex flex-wrap items-start h-max gap-2 justify-center "
          style={{
            marginLeft: 10,
          }}
        >
          {/* <button
            type="button"
            className={`w-[120px] cursor-pointer flex justify-center text-center group items-center gap-2 px-2 py-2 rounded-lg text-sm font-semibold shadow-sm border transition-all duration-150 ${
              loadingRemoveBg
                ? "bg-gray-100 text-gray-500 cursor-wait border-gray-200"
                : "bg-white text-gray-900 hover:bg-gray-50 border-gray-300"
            }`}
            onClick={onRemoveBg}
            disabled={loadingRemoveBg || !imageUrl}
            style={{
              borderRadius: 10,
              background: "linear-gradient(90deg, #6a2fc1, #2e89d0)",
              color: "white",
            }}
          > */}
          {/* {loadingRemoveBg ? (
              <svg
                className="animate-spin h-4 w-4 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 text-gray-700 group-hover:text-gray-900"
              >
                <path d="M5 12a7 7 0 1114 0 7 7 0 01-14 0zm9.5-2.5a1.5 1.5 0 10-3 0v5a1.5 1.5 0 003 0v-5zM12 7a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
            )} */}
          {/* <span>{loadingRemoveBg ? "Removing…" : "Remove Bg"}</span>
          </button> */}

          <button
            type="button"
            className={`w-[120px] cursor-pointer flex justify-center text-center group items-center gap-2 px-2 py-2 rounded-lg text-sm font-semibold shadow-sm border transition-all duration-150 ${
              loadingEnhance
                ? "bg-gray-100 text-gray-500 cursor-wait border-gray-200"
                : "bg-white text-gray-900 hover:bg-gray-50 border-gray-300"
            }`}
            onClick={onEnhance}
            disabled={loadingEnhance || !imageUrl}
            style={{
              borderRadius: 10,
              background: "linear-gradient(90deg, #6a2fc1, #2e89d0)",
              color: "white",
            }}
          >
            {/* {loadingEnhance ? (
              <svg
                className="animate-spin h-4 w-4 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 text-gray-700 group-hover:text-gray-900"
              >
                <path d="M12 2l2.39 4.84L20 8l-4 3.9.94 5.48L12 15.77 7.06 17.38 8 11.9 4 8l5.61-1.16L12 2z" />
              </svg>
            )} */}
            <span>{loadingEnhance ? "Enhancing…" : "Enhance"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImagePreview;
