import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, Image } from "fabric";

const DesignPlacementSlider = ({ tintColor = "#6b7280", imageUrl: propImageUrl = null, onImageUrlChange }) => {
  const container =
    typeof document !== "undefined"
      ? document.getElementById("cloth-editor-app")
      : null;

  // Get t-shirt image source based on view type
  const getTshirtSource = useCallback(
    (view) => {
      if (container?.dataset?.tshirt) {
        const viewMap = {
          front: container.dataset.front,
          back: container.dataset.back,
          side: container.dataset.side,
        };
        return viewMap[view];
      } else {
        // Local dev - use appropriate view images
        const viewMap = {
          front: "/assets/front-shirt.png",
          back: "/assets/back-shirt.png",
          side: "/assets/left-side-shirt.png",
        };
        return viewMap[view] || "/assets/tshirt.png";
      }
    },
    [container]
  );

  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [selectedPlacement, setSelectedPlacement] = useState("custom");
  const uploadedImageUrlRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Use prop imageUrl if provided (from App.jsx via DesignViewer)
  // This syncs the prop to local state whenever it changes
  useEffect(() => {
    setUploadedImageUrl(propImageUrl);
  }, [propImageUrl]);

  // Refs for canvas and images
  const canvasRefs = useRef([]);
  const fabricCanvasesRef = useRef([]);
  const baseImagesRef = useRef([]);
  const logoImagesRef = useRef([]);
  const scrollContainerRef = useRef(null);

  const CANVAS_W = 130;
  const CANVAS_H = 150;

  // Placement configurations
  const placements = useMemo(
    () => [
      {
        id: "custom",
        label: "Custom",
        view: "front", // front, back, or side
        position: { x: 0, y: -0.05 }, // slightly above center
        scale: 0, // relative to garment width
      },
      {
        id: "full-front",
        label: "Full Front",
        view: "front",
        position: { x: 0, y: -0.2 }, // center
        scale: 0.3,
      },
      {
        id: "full-back",
        label: "Full Back",
        view: "back",
        position: { x: 0, y: -0.2 }, // center
        scale: 0.3,
      },
      {
        id: "left-chest",
        label: "Left Chest",
        view: "front",
        position: { x: 0.12, y: -0.22 }, // left and upper chest area
        scale: 0.2,
      },
      {
        id: "sleeve",
        label: "Sleeve",
        view: "side", // using side view for sleeve
        position: { x: 0.09, y: -0.19 }, // right side for sleeve (on side view)
        scale: 0.3,
      },
      {
        id: "back-collar",
        label: "Back Collar",
        view: "back", // using side view for sleeve
        position: { x: 0, y: -0.25 }, // right side for sleeve (on side view)
        scale: 0.3,
      },
    ],
    []
  );

  // Listen for server-side processed images (after removebg/enhance)
  // This handles CustomImageReady events for processed images
  useEffect(() => {
    const handleImageReady = (event) => {
      if (event.detail?.imageUrl) {
        console.log(
          "DesignPlacementSlider: Received CustomImageReady event",
          event.detail.imageUrl
        );
        const serverUrl = event.detail.imageUrl;
        setUploadedImageUrl(serverUrl);
        // Notify parent if callback provided (for App state sync)
        if (onImageUrlChange) {
          onImageUrlChange(serverUrl);
        }
      }
    };

    window.addEventListener("CustomImageReady", handleImageReady);

    return () => {
      window.removeEventListener("CustomImageReady", handleImageReady);
    };
  }, [onImageUrlChange]);

  // Update arrow visibility based on scroll position
  const updateArrowVisibility = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;

    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10); // 10px threshold
  }, []);

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Initial check
    updateArrowVisibility();

    // Listen to scroll events
    container.addEventListener("scroll", updateArrowVisibility);

    // Also check on resize
    const handleResize = () => {
      setTimeout(updateArrowVisibility, 100);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", updateArrowVisibility);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateArrowVisibility]);

  // Initialize canvases
  useEffect(() => {
    fabricCanvasesRef.current = [];
    baseImagesRef.current = [];
    logoImagesRef.current = [];

    const id = requestAnimationFrame(() => {
      placements.forEach((placement, idx) => {
        const el = canvasRefs.current[idx];
        if (!el) return;

        const canvas = new Canvas(el, {
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: "transparent",
          selection: false,
          preserveObjectStacking: true,
          enableRetinaScaling: true,
          devicePixelRatio: window.devicePixelRatio || 1,
          imageSmoothing: true,
          imageSmoothingQuality: "high",
          renderOnAddRemove: true,
          skipTargetFind: true,
        });

        fabricCanvasesRef.current[idx] = canvas;

        const tshirtSrc = getTshirtSource(placement.view);
        Image.fromURL(tshirtSrc, {
          crossOrigin: "anonymous",
          enableRetinaScaling: true,
          imageSmoothing: true,
          imageSmoothingQuality: "high",
        }).then((img) => {
          // Scale image to fit canvas
          const scale = Math.min(
            (CANVAS_W * 0.99) / img.width,
            (CANVAS_H * 0.99) / img.height
          );

          img.set({
            left: CANVAS_W / 2,
            top: CANVAS_H / 2,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
            scaleX: scale,
            scaleY: scale,
            imageSmoothing: true,
            imageSmoothingQuality: "high",
            dirty: true,
          });

          img.applyFilters();

          baseImagesRef.current[idx] = img;
          canvas.add(img);
          canvas.renderAll();

          // Add logo if already uploaded (wait a bit to ensure canvas is fully rendered)
          if (uploadedImageUrl) {
            setTimeout(() => {
              placeLogoOnCanvas(idx, uploadedImageUrl, placement);
            }, 50);
          }
        });
      });

      // Update arrow visibility after canvases are initialized
      setTimeout(() => {
        updateArrowVisibility();
      }, 300);
    });

    return () => {
      cancelAnimationFrame(id);
      fabricCanvasesRef.current.forEach((c) => c && c.dispose());
      fabricCanvasesRef.current = [];
      baseImagesRef.current = [];
      logoImagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, getTshirtSource, tintColor, updateArrowVisibility]);

  // Update logo when image URL changes
  useEffect(() => {
    // Cleanup previous blob URL if it exists
    if (
      uploadedImageUrlRef.current &&
      uploadedImageUrlRef.current.startsWith("blob:")
    ) {
      try {
        URL.revokeObjectURL(uploadedImageUrlRef.current);
      } catch (err) {
        console.error(err);
      }
    }
    uploadedImageUrlRef.current = uploadedImageUrl;

    if (uploadedImageUrl) {
      // Ensure canvases are ready before placing logos
      const placeLogos = () => {
        placements.forEach((placement, idx) => {
          const canvas = fabricCanvasesRef.current[idx];
          const baseImg = baseImagesRef.current[idx];
          if (canvas && baseImg) {
            placeLogoOnCanvas(idx, uploadedImageUrl, placement);
          }
        });
      };

      // Small delay to ensure canvases are fully initialized
      setTimeout(placeLogos, 100);
    } else {
      // Remove logos if image is cleared
      placements.forEach((_, idx) => {
        const canvas = fabricCanvasesRef.current[idx];
        const baseImg = baseImagesRef.current[idx];
        if (!canvas || !baseImg) return;

        canvas.getObjects().forEach((obj) => {
          if (obj !== baseImg) {
            canvas.remove(obj);
          }
        });
        logoImagesRef.current[idx] = null;
        canvas.requestRenderAll();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImageUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (
        uploadedImageUrlRef.current &&
        uploadedImageUrlRef.current.startsWith("blob:")
      ) {
        try {
          URL.revokeObjectURL(uploadedImageUrlRef.current);
        } catch (err) {
          console.error(err);
        }
      }
    };
  }, []);

  const placeLogoOnCanvas = useCallback((idx, imageUrl, placement) => {
    const canvas = fabricCanvasesRef.current[idx];
    const baseImg = baseImagesRef.current[idx];
    if (!canvas || !baseImg || !imageUrl) {
      console.warn(
        `DesignPlacementSlider: Cannot place logo - canvas: ${!!canvas}, baseImg: ${!!baseImg}, imageUrl: ${!!imageUrl}, placement: ${
          placement?.id
        }`
      );
      return;
    }

    // Remove existing logo
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj !== baseImg) {
        canvas.remove(obj);
      }
    });
    logoImagesRef.current[idx] = null;
    canvas.requestRenderAll();

    Image.fromURL(imageUrl, {
      crossOrigin: "anonymous",
      enableRetinaScaling: true,
      imageSmoothing: true,
      imageSmoothingQuality: "high",
    }).then((logo) => {
      // Calculate position and scale
      const garmentWidth = Math.abs(baseImg.getScaledWidth());
      const garmentHeight = Math.abs(baseImg.getScaledHeight());
      const targetWidth = garmentWidth * placement.scale;
      const scale = targetWidth / logo.width;

      // Calculate position based on placement config (relative to garment size)
      const offsetX = baseImg.left + placement.position.x * garmentWidth;
      const offsetY = baseImg.top + placement.position.y * garmentHeight;

      logo.set({
        originX: "center",
        originY: "center",
        left: offsetX,
        top: offsetY,
        selectable: false,
        evented: false,
        imageSmoothing: true,
        imageSmoothingQuality: "high",
        scaleX: scale,
        scaleY: scale,
        dirty: true,
      });

      canvas.add(logo);
      logo.bringToFront();
      logoImagesRef.current[idx] = logo;
      canvas.requestRenderAll();
    });
  }, []);

  return (
    <div className="w-[500px] bg-white p-4">
      <div className="text-start space-y-2 mb-4">
        <h2 className="text-md font-bold text-black">
          Step 2: Set Design Size
        </h2>
      </div>

      <div className="relative">
        {/* Horizontal scrollable container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {placements.map((placement, index) => (
            <div
              key={placement.id}
              className={`flex-shrink-0 cursor-pointer transition-all duration-200 ${
                selectedPlacement === placement.id ? "" : ""
              }`}
              onClick={() => setSelectedPlacement(placement.id)}
            >
              <div
                className={`relative bg-white rounded-lg p-3 border-2 ${
                  selectedPlacement === placement.id
                    ? "border-blue-600 shadow-lg"
                    : "border-gray-300"
                } transition-all duration-200`}
              >
                {/* Checkmark icon for selected */}
                {selectedPlacement === placement.id && (
                  <div className="absolute top-2 right-2 z-10">
                    <div className="bg-blue-600 rounded-full p-1">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Canvas container */}
                <div className="flex items-center justify-center mb-2">
                  <canvas
                    ref={(el) => (canvasRefs.current[index] = el)}
                    style={{
                      display: "block",
                      imageRendering: "crisp-edges",
                      WebkitImageRendering: "crisp-edges",
                    }}
                  />
                </div>

                {/* Label */}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    {placement.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll indicator arrows */}
        {placements.length > 4 && (
          <>
            {/* Left scroll arrow */}
            {showLeftArrow && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 cursor-pointer z-10"
                style={{
                  background:
                    "linear-gradient(to left, transparent, rgba(255,255,255,0.9))",
                  width: "60px",
                  height: "100%",
                }}
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollBy({
                      left: -200,
                      behavior: "smooth",
                    });
                  }
                }}
              >
                <div className="absolute left-2 top-1/2 -translate-y-1/2">
                  <svg
                    className="w-6 h-6 text-gray-600 hover:text-gray-900 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Right scroll arrow */}
            {showRightArrow && (
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer z-10"
                style={{
                  background:
                    "linear-gradient(to right, transparent, rgba(255,255,255,0.9))",
                  width: "60px",
                  height: "100%",
                }}
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollBy({
                      left: 200,
                      behavior: "smooth",
                    });
                  }
                }}
              >
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <svg
                    className="w-6 h-6 text-gray-600 hover:text-gray-900 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hide scrollbar for webkit browsers */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default DesignPlacementSlider;
