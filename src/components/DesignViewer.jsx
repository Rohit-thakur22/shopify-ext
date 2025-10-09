import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, Image, filters } from "fabric";

import ImagePreview from "./ImagePreview";
import NinjaProgressBar from "./ProgressBar";

const DesingViewer = () => {
  const container =
    typeof document !== "undefined"
      ? document.getElementById("cloth-editor-app")
      : null;

  const sourceImages = useMemo(() => {
    if (container?.dataset?.hoodie) {
      // Running inside Shopify (Liquid injected)
      return [
        container.dataset.hoodie,
        container.dataset.cap,
        container.dataset.tshirt,
        container.dataset.shorts,
        container.dataset.polo,
        container.dataset.apron,
      ].filter(Boolean);
    } else {
      // Local dev fallback (Vite public folder)
      return [
        "/assets/hoodie.png",
        "/assets/cap.png",
        "/assets/tshirt.png",
        "/assets/shorts.png",
        "/assets/polo.png",
        "/assets/apron.png",
      ];
    }
  }, [container]);

  const sizes = useMemo(
    () => [
      '11" x 11"',
      '4" x 2.5"',
      '3.5" x 3.5"',
      '7" x 7"',
      '9" x 9"',
      '5" x 5"',
    ],
    []
  );

  const products = useMemo(
    () =>
      sizes.map((size, index) => ({
        size,
        src: sourceImages[index],
      })),
    [sizes, sourceImages]
  );

  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentImageBlob, setCurrentImageBlob] = useState(null);
  const [loadingRemoveBg, setLoadingRemoveBg] = useState(false);
  const [loadingEnhance, setLoadingEnhance] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  // One canvas per product tile
  const canvasRefs = useRef([]);
  const fabricCanvasesRef = useRef([]);
  const baseImagesRef = useRef([]);
  const logoImagesRef = useRef([]);
  const logoRequestIdRef = useRef(0);

  const CANVAS_W = 140; // original canvas width
  const CANVAS_H = 180; // original canvas height

  const COLOR_SWATCHES = [
    "#000000",
    "#ffffff",
    "#e11d48",
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#7c3aed",
    "#6b7280",
    "#ff0000",
    "#0000ff",
    "#ff00ff",
    "#ffffff",
    "#b30000",
    "#0000b3",
    "#00b3b3",
    "#b3b300",
    "#00b300",
  ];
  const [tintColor, setTintColor] = useState("#6b7280");
  const tintColorRef = useRef("#6b7280");
  // const [isDragging, setIsDragging] = useState(false);
  const [finalImageLink, setFinalImageLink] = useState(null);

  useEffect(() => {
    tintColorRef.current = tintColor;
  }, [tintColor]);

  // Show progress bar when a new preview url is set, then hide after 3s
  useEffect(() => {
    if (!previewUrl) return;
    setShowProgress(true);
    const id = setTimeout(() => setShowProgress(false), 3000);
    return () => clearTimeout(id);
  }, [previewUrl]);

  // Listen for Shopify image uploads
  useEffect(() => {
    const handleShopifyImageUpload = async (event) => {
      const imageDataUrl = event.detail;
      if (imageDataUrl) {
        try {
          // Convert data URL to blob
          const response = await fetch(imageDataUrl);
          const blob = await response.blob();
          addLogo(blob);

          // Upload image to server immediately
          const form = new FormData();
          form.append("image", blob);
          const res = await fetch(
            "https://hqcustomapp.agileappdemo.com/api/images/upload-image",
            {
              method: "POST",
              body: form,
            }
          );

          if (res.ok) {
            const data = await res.json();
            console.log("Received link:", data.link);
            if (data.link) setFinalImageLink(data.link);
            window.dispatchEvent(
              new CustomEvent("CustomImageReady", {
                detail: {
                  imageUrl: "https://hqcustomapp.agileappdemo.com/" + data.link,
                },
              })
            );
          } else {
            console.error("Upload failed:", res.status, res.statusText);
          }
        } catch (error) {
          console.error("Error processing Shopify image upload:", error);
        }
      }
    };

    // Add event listener for the custom event from Shopify
    window.addEventListener("shopifyImageUploaded", handleShopifyImageUpload);

    // Cleanup
    return () => {
      window.removeEventListener(
        "shopifyImageUploaded",
        handleShopifyImageUpload
      );
    };
  }, []);

  useEffect(() => {
    fabricCanvasesRef.current = [];
    baseImagesRef.current = [];
    logoImagesRef.current = [];

    // Defer to ensure canvas refs are mounted
    const id = requestAnimationFrame(() => {
      products.forEach((product, idx) => {
        const el = canvasRefs.current[idx];
        if (!el) return;

        const canvas = new Canvas(el, {
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: "transparent",
          selection: false,
          preserveObjectStacking: true,
          enableRetinaScaling: true, // Enable retina scaling for crisp rendering
          devicePixelRatio: window.devicePixelRatio || 1, // Use device pixel ratio
        });

        fabricCanvasesRef.current[idx] = canvas;

        Image.fromURL(product.src, {
          crossOrigin: "anonymous",
          // Ensure high quality image loading
          enableRetinaScaling: true,
        }).then((img) => {
          // fit to canvas with high quality scaling
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
            // High quality image rendering
            imageSmoothing: true,
            imageSmoothingQuality: "high",
          });

          // apply initial tint while preserving shadows/highlights
          img.filters = [
            new filters.BlendColor({
              color: tintColorRef.current,
              mode: "tint",
              alpha: 1,
            }),
          ];
          img.dirty = true;
          img.applyFilters();

          baseImagesRef.current[idx] = img;
          canvas.add(img);
          canvas.renderAll();
        });
      });
    });

    return () => {
      cancelAnimationFrame(id);
      fabricCanvasesRef.current.forEach((c) => c && c.dispose());
      fabricCanvasesRef.current = [];
      baseImagesRef.current = [];
      logoImagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const changeColor = useCallback((color) => {
    setTintColor(color);
    baseImagesRef.current.forEach((img, idx) => {
      if (!img) return;
      img.filters = [new filters.BlendColor({ color, mode: "tint", alpha: 1 })];
      img.dirty = true;
      img.applyFilters();
      const canvas = fabricCanvasesRef.current[idx];
      if (canvas) canvas.renderAll();
    });
  }, []);

  const placeOrReplaceLogoOnCanvas = useCallback((idx, url, requestId) => {
    const canvas = fabricCanvasesRef.current[idx];
    const baseImg = baseImagesRef.current[idx];
    if (!canvas || !baseImg) return;

    // Remove any non-base objects to avoid duplicates (defensive cleanup)
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
      // High quality image loading settings
      enableRetinaScaling: true,
    }).then((logo) => {
      // Ignore if a newer upload has started since this request
      if (requestId !== logoRequestIdRef.current) {
        return;
      }

      // Calculate proper scaling for high quality
      const hoodiePixelWidth = baseImg.getScaledWidth();
      const targetWidth = hoodiePixelWidth * 0.25; // 25% of garment width
      const scale = targetWidth / logo.width;

      // Offset: shift a bit right on the last product only
      const isLast = idx === products.length - 1;
      const offsetX = isLast ? baseImg.getScaledWidth() * 0.06 : 0;
      const offsetY = isLast
        ? baseImg.getScaledHeight() * 0.1
        : -baseImg.getScaledHeight() * 0.12;

      logo.set({
        originX: "center",
        originY: "center",
        left: baseImg.left + offsetX,
        top: baseImg.top + offsetY,
        selectable: false,
        evented: false,
        // High quality rendering settings
        imageSmoothing: true,
        imageSmoothingQuality: "high",
        // Ensure pixel-perfect scaling
        scaleX: scale,
        scaleY: scale,
      });

      canvas.add(logo);
      logo.bringToFront();
      logoImagesRef.current[idx] = logo;

      // Force high quality render
      canvas.requestRenderAll();

      // Additional render call to ensure quality
      setTimeout(() => {
        if (canvas && !canvas.isDestroyed) {
          canvas.renderAll();
        }
      }, 50);
    });
  }, []);

  const addLogo = useCallback(
    (fileOrUrl) => {
      const addWithUrl = (url) => {
        // Bump request id to invalidate any in-flight image loads
        logoRequestIdRef.current += 1;
        const requestId = logoRequestIdRef.current;
        setPreviewUrl((prev) => {
          if (prev && prev.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(prev);
            } catch (err) {
              console.error(err);
              // eslint-disable-next-line no-unused-vars
            }
          }
          return url;
        });
        products.forEach((_, idx) =>
          placeOrReplaceLogoOnCanvas(idx, url, requestId)
        );
      };

      if (typeof fileOrUrl === "string") {
        addWithUrl(fileOrUrl);
        return;
      }
      const file = fileOrUrl;
      setCurrentImageBlob(file);
      const objectUrl = URL.createObjectURL(file);
      addWithUrl(objectUrl);
    },
    [placeOrReplaceLogoOnCanvas, products]
  );

  const clearPreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev);
        } catch (err) {
          console.error(err);
          // eslint-disable-next-line no-unused-vars
        }
      }
      return null;
    });
    setCurrentImageBlob(null);
    logoRequestIdRef.current += 1;
    fabricCanvasesRef.current.forEach((canvas, idx) => {
      if (!canvas) return;
      const baseImg = baseImagesRef.current[idx];
      canvas.getObjects().forEach((obj) => {
        if (obj !== baseImg) {
          canvas.remove(obj);
        }
      });
      logoImagesRef.current[idx] = null;
      canvas.requestRenderAll();
    });
    // ✅ Add window reload at the end (after cleanup)
  window.location.reload(); // full page reload
  }, []);

  return (
    <div className="flex justify-between gap-4">
      {/* Design List */}
      <div className="w-full">
        <div className="max-w-2xl p-3 bg-gray-100 h-max">
          <div className="text-start space-y-2">
            <h1 className="text-md font-bold text-black">Size Guide</h1>
            <p className="text-xs text-gray-600">
              See your design on our most popular styles
            </p>
          </div>

          <div
            className="dv-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "1.5rem",
            }}
          >
            {products.map((product, index) => (
              <div
                key={index}
                className={`group flex bg-gray-100 pt-3 flex-col items-center transform transition-all duration-200 ease-in-out hover:scale-150 z-[${"9".repeat(
                  index + 1
                )}]`}
              >
                <h3 className="text-sm font-bold text-black text-nowrap">
                  {product.size}
                </h3>
                <div className="rounded-lg p-2 w-full max-w-xs aspect-square flex items-center justify-center">
                  <div className="w-36 h-44 mx-auto transform transition-transform duration-300 ease-out group-hover:scale-110">
                    <canvas
                      ref={(el) => (canvasRefs.current[index] = el)}
                      style={{
                        display: "block",
                        // Ensure crisp pixel-perfect rendering
                        imageRendering: "auto",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-black font-bold mt-2">
          Change your preview items to any color below:
        </p>
        <div className="mt-3 space-y-4">
          <div>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  aria-label={`Color ${color}`}
                  className={`h-6 w-6 rounded-md border ${
                    tintColor === color
                      ? "ring-2 ring-offset-2 ring-blue-500"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => changeColor(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="w-[90%] lg:w-max absolute top-[1175px] sm:top-[1110px] lg:top-[390px] right-[20px] sm:right-[0px] z-[99999]">
        {/* {showProgress && (
          <div className="">
            <NinjaProgressBar />
          </div>
        )} */}
        {/* Image preview section */}
        {previewUrl && !showProgress && (
          <div className="flex justify-between">
            <ImagePreview
              imageUrl={previewUrl}
              onRemove={clearPreview}
              onRemoveBg={async () => {
                if (!currentImageBlob || loadingRemoveBg) return;
                try {
                  setLoadingRemoveBg(true);
                  const form = new FormData();
                  form.append("image", currentImageBlob);
                  const res = await fetch(
                    "https://hqcustomapp.agileappdemo.com/api/images/remove-bg",
                    { method: "POST", body: form }
                  );
                  // if (!res.ok) throw new Error("Request failed");

                  // 🔥 Capture header from response
                  const link = await res.headers.get("X-Image-Link");
                  console.log("Received link:", link);
                  if (link) setFinalImageLink(link);
                  window.dispatchEvent(
                    new CustomEvent("CustomImageReady", {
                      detail: {
                        imageUrl: "https://hqcustomapp.agileappdemo.com/" + link,
                      },
                    })
                  );
                  
                  const blob = await res.blob();
                  setCurrentImageBlob(blob);
                  const nextUrl = URL.createObjectURL(blob);
                  addLogo(nextUrl);
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoadingRemoveBg(false);
                }
              }}
              onEnhance={async () => {
                if (!currentImageBlob || loadingEnhance) return;
                try {
                  setLoadingEnhance(true);
                  const form = new FormData();
                  form.append("image", currentImageBlob);
                  const res = await fetch(
                    "https://hqcustomapp.agileappdemo.com/api/images/enhance",
                    { method: "POST", body: form }
                  );
                  // if (!res.ok) throw new Error("Request failed");

                  // 🔥 Capture enhance header
                  const link = await res.headers.get("X-AutoEnhance-Link");
                  console.log("Received enhance link:", link);
                  if (link) setFinalImageLink(link);
                  window.dispatchEvent(
                    new CustomEvent("CustomImageReady", {
                      detail: {
                        imageUrl: "https://hqcustomapp.agileappdemo.com/" + link,
                      },
                    })
                  );                  
                  const blob = await res.blob();
                  setCurrentImageBlob(blob);
                  const nextUrl = URL.createObjectURL(blob);
                  addLogo(nextUrl);
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoadingEnhance(false);
                }
              }}
              loadingRemoveBg={loadingRemoveBg}
              loadingEnhance={loadingEnhance}
            />
          </div>
        )}
        {/* {previewUrl && !showProgress && (
          <div
            className="mt-2"
            style={{
              position: "absolute",
              top: "365px",
              right: "150px",
              width: "400px",
              cursor:'pointer'
            }}
          >
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow w-full"
              onClick={async () => {
                try {
                  const res = await fetch("/cart/add.js", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Accept: "application/json",
                    },
                    body: JSON.stringify({
                      id: 50138322829616,
                      quantity: 1,
                      properties: {
                        CustomImage:
                          "https://hqcustomapp.agileappdemo.com/" +
                          finalImageLink,
                      },
                    }),
                  });
                  const data = await res.json();
                  console.log("Added to cart:", data);
                  alert("Item added to cart!");
                } catch (err) {
                  console.error("Add to cart failed:", err);
                  alert("Error adding to cart");
                }
              }}
            >
              Add to Cart
            </button>
          </div>
        )} */}
      </div>
    </div>
  );
};

export default DesingViewer;
