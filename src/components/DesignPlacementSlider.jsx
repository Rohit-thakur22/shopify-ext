import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, Image, filters } from "fabric";

/**
 * DesignPlacementSlider - Shows design placement options on different garment views
 * 
 * Props:
 * - imageUrl: The uploaded/processed image URL to display
 * - tintColor: The color to tint the garments
 * - onPlacementChange: Callback when user selects a placement (optional)
 * - assetUrls: Object containing Shopify CDN URLs for product images
 */
const DesignPlacementSlider = ({
  imageUrl,
  tintColor = "#6b7280",
  onPlacementChange,
  assetUrls = {},
}) => {
  const [selectedPlacement, setSelectedPlacement] = useState("custom");
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Refs for canvas and images
  const canvasRefs = useRef([]);
  const fabricCanvasesRef = useRef([]);
  const baseImagesRef = useRef([]);
  const logoImagesRef = useRef([]);
  const scrollContainerRef = useRef(null);
  const prevImageUrlRef = useRef(null);

  const CANVAS_W = 130;
  const CANVAS_H = 150;

  // Get t-shirt image source based on view type
  // Uses Shopify CDN URLs if available, fallback to local assets
  const getTshirtSource = useCallback((view) => {
    const viewMap = {
      front: assetUrls.front || "/assets/front-shirt.png",
      back: assetUrls.back || "/assets/back-shirt.png",
      side: assetUrls.side || "/assets/left-side-shirt.png",
    };
    return viewMap[view] || assetUrls.tshirt || "/assets/tshirt.png";
  }, [assetUrls]);

  // Placement configurations
  const placements = useMemo(
    () => [
      {
        id: "custom",
        label: "Custom",
        view: "front",
        position: { x: 0, y: -0.05 },
        scale: 0.25,
      },
      {
        id: "full-front",
        label: "Full Front",
        view: "front",
        position: { x: 0, y: -0.15 },
        scale: 0.35,
      },
      {
        id: "full-back",
        label: "Full Back",
        view: "back",
        position: { x: 0, y: -0.15 },
        scale: 0.35,
      },
      {
        id: "left-chest",
        label: "Left Chest",
        view: "front",
        position: { x: 0.12, y: -0.22 },
        scale: 0.18,
      },
      {
        id: "sleeve",
        label: "Sleeve",
        view: "side",
        position: { x: 0.09, y: -0.19 },
        scale: 0.22,
      },
      {
        id: "back-collar",
        label: "Back Collar",
        view: "back",
        position: { x: 0, y: -0.28 },
        scale: 0.2,
      },
    ],
    []
  );

  // Update arrow visibility based on scroll position
  const updateArrowVisibility = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;

    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
  }, []);

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateArrowVisibility();
    container.addEventListener("scroll", updateArrowVisibility);
    window.addEventListener("resize", updateArrowVisibility);

    return () => {
      container.removeEventListener("scroll", updateArrowVisibility);
      window.removeEventListener("resize", updateArrowVisibility);
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

          // Apply tint color
          img.filters = [
            new filters.BlendColor({
              color: tintColor,
              mode: "tint",
              alpha: 0.65,
            }),
          ];
          img.dirty = true;
          img.applyFilters();

          baseImagesRef.current[idx] = img;
          canvas.add(img);
          canvas.renderAll();

          // Place logo if already uploaded
          if (imageUrl) {
            setTimeout(() => {
              placeLogoOnCanvas(idx, imageUrl, placement);
            }, 50);
          }
        });
      });

      setTimeout(updateArrowVisibility, 300);
    });

    return () => {
      cancelAnimationFrame(id);
      fabricCanvasesRef.current.forEach((c) => c && c.dispose());
      fabricCanvasesRef.current = [];
      baseImagesRef.current = [];
      logoImagesRef.current = [];
    };
  }, [placements, getTshirtSource, tintColor, updateArrowVisibility]);

  // Update tint color when it changes
  useEffect(() => {
    if (!tintColor) return;

    baseImagesRef.current.forEach((img, idx) => {
      if (!img) return;
      img.filters = [
        new filters.BlendColor({
          color: tintColor,
          mode: "tint",
          alpha: 0.65,
        }),
      ];
      img.dirty = true;
      img.applyFilters();
      const canvas = fabricCanvasesRef.current[idx];
      if (canvas) canvas.renderAll();
    });
  }, [tintColor]);

  // Place logo on canvas
  const placeLogoOnCanvas = useCallback((idx, url, placement) => {
    const canvas = fabricCanvasesRef.current[idx];
    const baseImg = baseImagesRef.current[idx];
    if (!canvas || !baseImg || !url) return;

    // Remove existing logo
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj !== baseImg) {
        canvas.remove(obj);
      }
    });
    logoImagesRef.current[idx] = null;
    canvas.requestRenderAll();

    Image.fromURL(url, {
      crossOrigin: "anonymous",
      enableRetinaScaling: true,
      imageSmoothing: true,
      imageSmoothingQuality: "high",
    })
      .then((logo) => {
        const garmentWidth = Math.abs(baseImg.getScaledWidth());
        const garmentHeight = Math.abs(baseImg.getScaledHeight());
        const targetWidth = garmentWidth * placement.scale;
        const scale = targetWidth / logo.width;

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
        canvas.bringToFront(logo);
        logoImagesRef.current[idx] = logo;
        canvas.requestRenderAll();
      })
      .catch((error) => {
        console.error(`Error loading logo for canvas ${idx}:`, error);
      });
  }, []);

  // Update logos when imageUrl changes
  useEffect(() => {
    if (prevImageUrlRef.current === imageUrl) return;
    prevImageUrlRef.current = imageUrl;

    if (imageUrl) {
      // Wait for canvases to be ready
      const placeLogos = () => {
        let allReady = true;
        placements.forEach((placement, idx) => {
          const canvas = fabricCanvasesRef.current[idx];
          const baseImg = baseImagesRef.current[idx];
          if (canvas && baseImg) {
            placeLogoOnCanvas(idx, imageUrl, placement);
          } else {
            allReady = false;
          }
        });

        if (!allReady) {
          setTimeout(placeLogos, 100);
        }
      };

      setTimeout(placeLogos, 100);
    } else {
      // Clear all logos
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
  }, [imageUrl, placements, placeLogoOnCanvas]);

  // Handle placement selection
  const handleSelectPlacement = (placementId) => {
    setSelectedPlacement(placementId);
    if (onPlacementChange) {
      const placement = placements.find((p) => p.id === placementId);
      onPlacementChange(placement);
    }
  };

  // Scroll handlers
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  return (
    <div className="design-placement-slider bg-white">
      <div className="text-start space-y-2 mb-4">
        <h2 className="font-bold text-black text-base">
          Design Placement Preview
        </h2>
        <p className="text-xs text-gray-600">
          See how your design looks in different positions
        </p>
      </div>

      <div className="relative">
        {/* Left scroll arrow */}
        {showLeftArrow && (
          <button
            type="button"
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ marginLeft: -4 }}
          >
            <svg
              className="w-4 h-4 text-gray-600"
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
          </button>
        )}

        {/* Horizontal scrollable container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {placements.map((placement, index) => (
            <div
              key={placement.id}
              className="flex-shrink-0 cursor-pointer transition-all duration-200"
              onClick={() => handleSelectPlacement(placement.id)}
            >
              <div
                className={`relative bg-white rounded-lg p-2 border-2 transition-all duration-200 ${
                  selectedPlacement === placement.id
                    ? "border-blue-600 shadow-lg"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* Checkmark for selected */}
                {selectedPlacement === placement.id && (
                  <div className="absolute top-1 right-1 z-10">
                    <div className="bg-blue-600 rounded-full p-0.5">
                      <svg
                        className="w-3 h-3 text-white"
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

                {/* Canvas */}
                <div className="flex items-center justify-center">
                  <canvas
                    ref={(el) => (canvasRefs.current[index] = el)}
                    style={{
                      display: "block",
                      imageRendering: "crisp-edges",
                    }}
                  />
                </div>

                {/* Label */}
                <div className="text-center mt-1">
                  <p className="text-xs font-medium text-gray-700">
                    {placement.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right scroll arrow */}
        {showRightArrow && (
          <button
            type="button"
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
            style={{ marginRight: -4 }}
          >
            <svg
              className="w-4 h-4 text-gray-600"
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
          </button>
        )}
      </div>

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default DesignPlacementSlider;
