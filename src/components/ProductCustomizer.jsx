import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import UploadPanel from "./UploadPanel";
import DesignViewerPixelPerfect from "./DesignViewerPixelPerfect";
import DesignPlacementSlider from "./DesignPlacementSlider";
import SizeControls from "./SizeControls";
import PreCutCheckbox from "./PreCutCheckbox";
import PricePreview from "./PricePreview";
import AddToCartButton from "./AddToCartButton";

// API endpoints
const API_BASE = "https://highquality.allgovjobs.com/backend";
const REMOVE_BG_ENDPOINT = `${API_BASE}/api/images/remove-bg`;
const ENHANCE_ENDPOINT = `${API_BASE}/api/images/enhance`;

/** Build a full server URL from a path (avoids double slashes). */
function buildServerUrl(path) {
  if (!path) return null;
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${p}`;
}

// Dimension limits (inches): auto-filled from image, clamped to this range
const DIMENSION_MIN = 0.5;
const DIMENSION_MAX = 22.5;
const DPI = 300; // pixels per inch for converting image dimensions to inches

/** Normalize hex color param to #rrggbb format. Returns null if invalid. */
function normalizeHexColor(value) {
  if (!value || typeof value !== "string") return null;
  let hex = value.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex))
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  return null;
}

/**
 * Load image from URL, get natural dimensions, convert to inches and clamp to [DIMENSION_MIN, DIMENSION_MAX].
 * @param {string} url - Blob or image URL
 * @returns {Promise<{ widthInches: number, heightInches: number }>}
 */
function getImageDimensionsInInches(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const wInches = img.naturalWidth / DPI;
      const hInches = img.naturalHeight / DPI;
      const widthInches = Math.min(
        DIMENSION_MAX,
        Math.max(DIMENSION_MIN, +wInches.toFixed(2)),
      );
      const heightInches = Math.min(
        DIMENSION_MAX,
        Math.max(DIMENSION_MIN, +hInches.toFixed(2)),
      );
      resolve({ widthInches, heightInches });
    };
    img.onerror = () =>
      reject(new Error("Failed to load image for dimensions"));
    img.src = url;
  });
}

/**
 * ProductCustomizer - Root component for the Shopify product customization experience
 *
 * This component manages all state and renders child components:
 * - UploadPanel: File upload interface with Remove BG / Enhance buttons
 * - DesignViewer: Fabric.js canvas preview on products
 * - SizeControls: Width/height/pre-cut inputs
 * - PricePreview: Live price calculation
 * - AddToCartButton: Add to Shopify cart with line item properties
 *
 * Props:
 * - variantId: The Shopify product variant ID for cart operations
 * - assetUrls: Object containing Shopify CDN URLs for product images
 * - settingsUrl: URL to fetch product customizer feature flags (optional)
 */
const DEFAULT_SETTINGS = {
  enableSize: true,
  enablePrecut: true,
  enableQuantity: true,
  enablePlacement: true,
  predefinedSizes: [],
};

const ProductCustomizer = ({
  variantId,
  productId = "",
  productTitle = "",
  assetUrls = {},
  settingsUrl = null,
  variantPrice = null,
  cartUrl = "/apps/customscale-app/cart-add",
  designHandle = null,
  initialColor = null,
}) => {
  // Core customization state
  const [imageUrl, setImageUrl] = useState(null);
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(10);
  const [preCut, setPreCut] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Image processing state
  const [currentImageBlob, setCurrentImageBlob] = useState(null);
  const [originalImageBlob, setOriginalImageBlob] = useState(null); // Store original image blob
  const [processedImageBlob, setProcessedImageBlob] = useState(null); // Store processed (bg removed) image
  const [originalImageUrl, setOriginalImageUrl] = useState(null); // Display URL for original (blob URL for preview)
  const [processedImageUrl, setProcessedImageUrl] = useState(null); // Display URL for processed (blob URL for preview)
  const [originalServerUrl, setOriginalServerUrl] = useState(null); // Server URL for original image
  const [processedServerUrl, setProcessedServerUrl] = useState(null); // Server URL for processed image
  const [finalImageUrl, setFinalImageUrl] = useState(null); // Server URL for cart (switches based on toggle)
  const [loadingRemoveBg, setLoadingRemoveBg] = useState(false);
  const [loadingEnhance, setLoadingEnhance] = useState(false);
  const [loadingDesignFromUrl, setLoadingDesignFromUrl] = useState(false);
  const [removeBgEnabled, setRemoveBgEnabled] = useState(true); // Toggle for auto remove BG

  // UI state — use initialColor from ?color= if valid
  const [tintColor, setTintColor] = useState(
    () => normalizeHexColor(initialColor) || "#d8d8d8",
  );
  const [urlTitle, setUrlTitle] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const titleParam = params.get("title");
      if (titleParam) {
        setUrlTitle(titleParam);
      }
    }
  }, []);

  // Feature flags from Admin (default all true if API fails)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Refs
  const currentBlobUrlRef = useRef(null);
  const abortControllerRef = useRef(null);
  const originalBlobUrlRef = useRef(null);
  const processedBlobUrlRef = useRef(null);
  const cartSectionRef = useRef(null);
  const [cartIsSticky, setCartIsSticky] = useState(false);

  // On mobile: show a portal-rendered fixed cart when the cart panel scrolls off-screen.
  // Using a portal (rendered into document.body) guarantees position:fixed is always
  // relative to the VIEWPORT, not any Shopify ancestor that has CSS transforms.
  useEffect(() => {
    const check = () => {
      if (!cartSectionRef.current) return;
      if (window.innerWidth >= 768) {
        setCartIsSticky(false);
        return;
      }
      const rect = cartSectionRef.current.getBoundingClientRect();
      // Stick when the top of the cart div scrolls above the bottom of the viewport
      setCartIsSticky(rect.bottom < window.innerHeight && rect.top < 0);
    };

    // Check on scroll (capture phase to catch Shopify scroll containers too)
    window.addEventListener("scroll", check, { passive: true, capture: true });
    window.addEventListener("resize", check, { passive: true });
    // Also run on any scroll happening on any element (Shopify inner containers)
    document.addEventListener("scroll", check, {
      passive: true,
      capture: true,
    });
    check(); // initial check
    return () => {
      window.removeEventListener("scroll", check, { capture: true });
      window.removeEventListener("resize", check);
      document.removeEventListener("scroll", check, { capture: true });
    };
  }, []);

  // Update Set Design Size width/height from current preview image dimensions
  const updateDimensionsFromImageUrl = useCallback((url) => {
    if (!url) return;
    getImageDimensionsInInches(url)
      .then(({ widthInches, heightInches }) => {
        setWidth(widthInches);
        setHeight(heightInches);
      })
      .catch((err) => console.warn("Could not read image dimensions:", err));
  }, []);

  // Fetch product customizer settings on load
  useEffect(() => {
    if (!settingsUrl) {
      setSettings(DEFAULT_SETTINGS);
      return;
    }
    fetch(settingsUrl)
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          enableSize: data.enableSize === true,
          enablePrecut: data.enablePrecut === true,
          enableQuantity: data.enableQuantity === true,
          enablePlacement: data.enablePlacement === true,
          predefinedSizes: Array.isArray(data.predefinedSizes)
            ? data.predefinedSizes
            : [],
        });
      })
      .catch(() => {
        setSettings(DEFAULT_SETTINGS);
      });
  }, [settingsUrl]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (
        originalBlobUrlRef.current &&
        originalBlobUrlRef.current.startsWith("blob:")
      ) {
        try {
          URL.revokeObjectURL(originalBlobUrlRef.current);
        } catch (err) {
          console.error("Error revoking original blob URL on unmount:", err);
        }
      }
      if (
        processedBlobUrlRef.current &&
        processedBlobUrlRef.current.startsWith("blob:")
      ) {
        try {
          URL.revokeObjectURL(processedBlobUrlRef.current);
        } catch (err) {
          console.error("Error revoking processed blob URL on unmount:", err);
        }
      }
    };
  }, []);

  // Handle image upload
  const handleImageUpload = useCallback(
    async (url, file) => {
      // Revoke previous blob URLs before creating new ones
      if (
        originalBlobUrlRef.current &&
        originalBlobUrlRef.current.startsWith("blob:") &&
        originalBlobUrlRef.current !== url
      ) {
        try {
          URL.revokeObjectURL(originalBlobUrlRef.current);
        } catch (err) {
          console.error("Error revoking original blob URL:", err);
        }
      }
      if (
        processedBlobUrlRef.current &&
        processedBlobUrlRef.current.startsWith("blob:")
      ) {
        try {
          URL.revokeObjectURL(processedBlobUrlRef.current);
        } catch (err) {
          console.error("Error revoking processed blob URL:", err);
        }
      }

      // Store original image
      setOriginalImageBlob(file);
      setOriginalImageUrl(url);
      originalBlobUrlRef.current = url;

      setProcessedImageBlob(null); // Reset processed image
      setProcessedImageUrl(null);
      setOriginalServerUrl(null); // Reset server URLs
      setProcessedServerUrl(null);
      processedBlobUrlRef.current = null;
      setFinalImageUrl(null); // Reset final URL on new upload

      // Set current image to original initially
      currentBlobUrlRef.current = url;
      setImageUrl(url);
      setCurrentImageBlob(file);

      // Auto-fill width/height from image dimensions (inches), clamped to [0.5, 22.5]
      getImageDimensionsInInches(url)
        .then(({ widthInches, heightInches }) => {
          setWidth(widthInches);
          setHeight(heightInches);
        })
        .catch((err) => console.warn("Could not read image dimensions:", err));

      // Auto-remove background on upload only if removeBgEnabled is true
      if (file && removeBgEnabled) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        try {
          setLoadingRemoveBg(true);
          const form = new FormData();
          form.append("image", file);

          const res = await fetch(REMOVE_BG_ENDPOINT, {
            method: "POST",
            body: form,
            signal,
          });

          // Get the server URLs from response headers
          const processedLink = res.headers.get("X-Image-Link");
          const originalLink = res.headers.get("X-Original-Image-Link");

          let processedUrl = null;
          let originalUrl = null;

          if (processedLink) {
            processedUrl = buildServerUrl(processedLink);
            setProcessedServerUrl(processedUrl);
            setFinalImageUrl(processedUrl); // Use processed URL for cart
            console.log("Processed image URL:", processedUrl);
          }

          if (originalLink) {
            originalUrl = buildServerUrl(originalLink);
            setOriginalServerUrl(originalUrl);
            console.log("Original image URL:", originalUrl);
          }

          // Get processed image blob
          const processedBlob = await res.blob();
          setProcessedImageBlob(processedBlob);

          // Create new display URL for processed image
          const newDisplayUrl = URL.createObjectURL(processedBlob);
          setProcessedImageUrl(newDisplayUrl);
          processedBlobUrlRef.current = newDisplayUrl;

          // Update current display to processed image (no crop step)
          currentBlobUrlRef.current = newDisplayUrl;
          setImageUrl(newDisplayUrl);
          setCurrentImageBlob(processedBlob);
          updateDimensionsFromImageUrl(newDisplayUrl);
        } catch (err) {
          if (err?.name === "AbortError") return;
          console.error("Auto remove-bg failed:", err);
          // Keep original image if processing fails
        } finally {
          setLoadingRemoveBg(false);
        }
      }
    },
    [removeBgEnabled, updateDimensionsFromImageUrl],
  );

  // Fetch design product image when ?design-handle={product-handle} is present
  useEffect(() => {
    if (!designHandle) return;

    const loadDesignProductImage = async () => {
      setLoadingDesignFromUrl(true);
      try {
        const res = await fetch(
          `/products/${encodeURIComponent(designHandle)}.json`,
        );
        if (!res.ok) {
          console.warn("Design product not found:", designHandle);
          return;
        }
        const { product } = await res.json();
        const feat = product?.featured_image;
        const img0 = product?.images?.[0];
        const imageUrl =
          (typeof feat === "string" ? feat : feat?.src) ||
          (typeof img0 === "string" ? img0 : img0?.src);
        if (!imageUrl) {
          console.warn("Design product has no image:", designHandle);
          return;
        }
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          console.warn("Failed to fetch design image:", imageUrl);
          return;
        }
        const blob = await imgRes.blob();
        const ext = (blob.type || "image/png").split("/")[1] || "png";
        const file = new File([blob], `design-${designHandle}.${ext}`, {
          type: blob.type || "image/png",
        });
        const blobUrl = URL.createObjectURL(blob);
        handleImageUpload(blobUrl, file);
      } catch (err) {
        console.warn("Failed to load design product image:", err);
      } finally {
        setLoadingDesignFromUrl(false);
      }
    };

    loadDesignProductImage();
  }, [designHandle, handleImageUpload]);

  // Cancel ongoing processing (Remove BG or Enhance)
  const handleCancelProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoadingRemoveBg(false);
    setLoadingEnhance(false);
  }, []);

  // Handle Remove Background
  const handleRemoveBg = useCallback(async () => {
    if (!currentImageBlob || loadingRemoveBg) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    try {
      setLoadingRemoveBg(true);
      const form = new FormData();
      form.append("image", currentImageBlob);

      const res = await fetch(REMOVE_BG_ENDPOINT, {
        method: "POST",
        body: form,
        signal,
      });

      // Get both processed and original server URLs (cart needs original when user toggles to original)
      const serverLink = res.headers.get("X-Image-Link");
      const originalLink = res.headers.get("X-Original-Image-Link");
      if (serverLink) {
        const fullServerUrl = buildServerUrl(serverLink);
        setProcessedServerUrl(fullServerUrl);
        setFinalImageUrl(fullServerUrl);
        console.log("Remove BG - Server image URL:", fullServerUrl);
      }
      if (originalLink) {
        setOriginalServerUrl(buildServerUrl(originalLink));
      }

      // Get processed image blob
      const processedBlob = await res.blob();
      setProcessedImageBlob(processedBlob);
      setCurrentImageBlob(processedBlob);

      // Create new display URL (blob for preview only)
      const newDisplayUrl = URL.createObjectURL(processedBlob);
      if (
        processedBlobUrlRef.current &&
        processedBlobUrlRef.current.startsWith("blob:")
      ) {
        try {
          URL.revokeObjectURL(processedBlobUrlRef.current);
        } catch (_) {}
      }
      processedBlobUrlRef.current = newDisplayUrl;
      setProcessedImageUrl(newDisplayUrl);

      if (
        currentBlobUrlRef.current &&
        currentBlobUrlRef.current.startsWith("blob:")
      ) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      currentBlobUrlRef.current = newDisplayUrl;
      setImageUrl(newDisplayUrl);
      updateDimensionsFromImageUrl(newDisplayUrl);
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Remove background failed:", err);
    } finally {
      setLoadingRemoveBg(false);
    }
  }, [currentImageBlob, loadingRemoveBg, updateDimensionsFromImageUrl]);

  // Handle Enhance Image
  const handleEnhance = useCallback(async () => {
    if (!currentImageBlob || loadingEnhance) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    try {
      setLoadingEnhance(true);
      const form = new FormData();
      form.append("image", currentImageBlob);

      const res = await fetch(ENHANCE_ENDPOINT, {
        method: "POST",
        body: form,
        signal,
      });

      // Get both enhanced and original server URLs (cart needs original when user toggles to original)
      const serverLink = res.headers.get("X-AutoEnhance-Link");
      const originalLink = res.headers.get("X-Original-Image-Link");
      if (serverLink) {
        const fullServerUrl = buildServerUrl(serverLink);
        setProcessedServerUrl(fullServerUrl);
        setFinalImageUrl(fullServerUrl);
        console.log("Enhance - Server image URL:", fullServerUrl);
      }
      if (originalLink) {
        setOriginalServerUrl(buildServerUrl(originalLink));
      }

      // Get processed image blob
      const processedBlob = await res.blob();
      setProcessedImageBlob(processedBlob);
      setCurrentImageBlob(processedBlob);

      // Create new display URL (blob for preview only)
      const newDisplayUrl = URL.createObjectURL(processedBlob);
      if (
        processedBlobUrlRef.current &&
        processedBlobUrlRef.current.startsWith("blob:")
      ) {
        try {
          URL.revokeObjectURL(processedBlobUrlRef.current);
        } catch (_) {}
      }
      processedBlobUrlRef.current = newDisplayUrl;
      setProcessedImageUrl(newDisplayUrl);

      if (
        currentBlobUrlRef.current &&
        currentBlobUrlRef.current.startsWith("blob:")
      ) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      currentBlobUrlRef.current = newDisplayUrl;
      setImageUrl(newDisplayUrl);
      // Do not update dimensions: Enhance upscales resolution only; physical design size (inches) stays the same.
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Enhance image failed:", err);
    } finally {
      setLoadingEnhance(false);
    }
  }, [currentImageBlob, loadingEnhance]);

  // Handle color change from DesignViewer
  const handleColorChange = useCallback((color) => {
    setTintColor(color);
  }, []);

  // Handle clearing the design
  const handleClearDesign = useCallback(() => {
    // Revoke blob URLs when clearing
    if (
      originalBlobUrlRef.current &&
      originalBlobUrlRef.current.startsWith("blob:")
    ) {
      try {
        URL.revokeObjectURL(originalBlobUrlRef.current);
      } catch (err) {
        console.error("Error revoking original blob URL:", err);
      }
    }
    if (
      processedBlobUrlRef.current &&
      processedBlobUrlRef.current.startsWith("blob:")
    ) {
      try {
        URL.revokeObjectURL(processedBlobUrlRef.current);
      } catch (err) {
        console.error("Error revoking processed blob URL:", err);
      }
    }

    currentBlobUrlRef.current = null;
    originalBlobUrlRef.current = null;
    processedBlobUrlRef.current = null;
    setImageUrl(null);
    setCurrentImageBlob(null);
    setOriginalImageBlob(null);
    setOriginalImageUrl(null);
    setProcessedImageBlob(null);
    setProcessedImageUrl(null);
    setOriginalServerUrl(null);
    setProcessedServerUrl(null);
    setFinalImageUrl(null);
  }, []);

  // Handle toggle remove BG
  const handleToggleRemoveBg = useCallback(
    async (enabled) => {
      setRemoveBgEnabled(enabled);

      // If toggling off, switch to original image and ensure we have a server URL for cart
      if (!enabled && originalImageUrl && originalImageBlob) {
        currentBlobUrlRef.current = originalImageUrl;
        setImageUrl(originalImageUrl);
        setCurrentImageBlob(originalImageBlob);
        updateDimensionsFromImageUrl(originalImageUrl);

        if (originalServerUrl) {
          setFinalImageUrl(originalServerUrl);
        } else {
          // We don't have a server URL for the original (e.g. backend didn't return X-Original-Image-Link).
          // Call remove-bg once to get the server to store the original and return its link; we only use the original link.
          try {
            const form = new FormData();
            form.append("image", originalImageBlob);
            const res = await fetch(REMOVE_BG_ENDPOINT, {
              method: "POST",
              body: form,
            });
            const originalLink = res.headers.get("X-Original-Image-Link");
            if (originalLink) {
              const url = buildServerUrl(originalLink);
              setOriginalServerUrl(url);
              setFinalImageUrl(url);
            } else {
              setFinalImageUrl(null);
            }
          } catch (err) {
            console.warn("Could not get server URL for original image:", err);
            setFinalImageUrl(null);
          }
        }
      }
      // If toggling on, check if we already have processed image
      else if (enabled && processedImageUrl && processedImageBlob) {
        currentBlobUrlRef.current = processedImageUrl;
        setImageUrl(processedImageUrl);
        setCurrentImageBlob(processedImageBlob);
        setFinalImageUrl(processedServerUrl || null);
        updateDimensionsFromImageUrl(processedImageUrl);
      }
      // If toggling on but no processed image yet, process it now
      else if (enabled && originalImageBlob && !processedImageBlob) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        try {
          setLoadingRemoveBg(true);
          const form = new FormData();
          form.append("image", originalImageBlob);

          const res = await fetch(REMOVE_BG_ENDPOINT, {
            method: "POST",
            body: form,
            signal,
          });

          // Get the server URLs from response headers
          const processedLink = res.headers.get("X-Image-Link");
          const originalLink = res.headers.get("X-Original-Image-Link");

          let processedUrl = null;
          let originalUrl = null;

          if (processedLink) {
            processedUrl = buildServerUrl(processedLink);
            setProcessedServerUrl(processedUrl);
            setFinalImageUrl(processedUrl); // Use processed URL for cart
            console.log("Toggle ON - Processed image URL:", processedUrl);
          }

          if (originalLink) {
            originalUrl = buildServerUrl(originalLink);
            setOriginalServerUrl(originalUrl);
            console.log("Toggle ON - Original image URL:", originalUrl);
          }

          // Get processed image blob
          const processedBlob = await res.blob();
          setProcessedImageBlob(processedBlob);

          // Create new display URL for processed image
          const newDisplayUrl = URL.createObjectURL(processedBlob);
          setProcessedImageUrl(newDisplayUrl);
          processedBlobUrlRef.current = newDisplayUrl;

          // Update current display to processed image
          currentBlobUrlRef.current = newDisplayUrl;
          setImageUrl(newDisplayUrl);
          setCurrentImageBlob(processedBlob);
          updateDimensionsFromImageUrl(newDisplayUrl);
        } catch (err) {
          if (err?.name === "AbortError") return;
          console.error("Remove-bg on toggle failed:", err);
          // Keep original image if processing fails
        } finally {
          setLoadingRemoveBg(false);
        }
      }
    },
    [
      originalImageUrl,
      originalImageBlob,
      processedImageUrl,
      processedImageBlob,
      originalServerUrl,
      processedServerUrl,
      updateDimensionsFromImageUrl,
    ],
  );

  // Add to cart uses finalImageUrl (single source of truth), which is set on upload and when toggling Remove BG.
  // This ensures when user toggles OFF Remove Background we still pass the correct server URL for the original.
  const cartImageUrl = finalImageUrl || null;

  return (
    <div className="product-customizer w-full bg-white">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div
          className="mb-8 text-center sm:text-left"
          style={{ marginBottom: 20 }}
        >
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            Customize {urlTitle ? urlTitle : "Your Product"}
          </h1>
          <p className="text-base text-gray-500 mt-2">
            Upload your design, set dimensions, and add to cart
          </p>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Visual Previews (Sticky on desktop) */}
          <div
            className="lg:col-span-7 lg:sticky lg:top-6 h-max"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              marginRight: 24,
            }}
          >
            {/* Design Viewer - Pixel-perfect Konva mockup rendering */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <DesignViewerPixelPerfect
                imageUrl={imageUrl}
                tintColor={tintColor}
                onColorChange={handleColorChange}
                assetUrls={assetUrls}
              />
            </div>

            {/* Design Placement Slider */}
            {settings.enablePlacement && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <DesignPlacementSlider
                  imageUrl={imageUrl}
                  tintColor={tintColor}
                  assetUrls={assetUrls}
                />
              </div>
            )}
          </div>

          {/* Right column - Controls and Cart (extra bottom padding on mobile for sticky Add to Cart) */}
          <div
            className="lg:col-span-5 add-to-cart-mobile-spacer"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {/* Upload Panel */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <UploadPanel
                onUpload={handleImageUpload}
                imageUrl={imageUrl}
                onRemoveBg={handleRemoveBg}
                onEnhance={handleEnhance}
                loadingRemoveBg={loadingRemoveBg}
                loadingEnhance={loadingEnhance}
                loadingDesignFromUrl={loadingDesignFromUrl}
                onClear={handleClearDesign}
                onCancelProcessing={handleCancelProcessing}
                removeBgEnabled={removeBgEnabled}
                onToggleRemoveBg={handleToggleRemoveBg}
              />
            </div>
            {/* Size Controls */}
            {settings.enableSize && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <SizeControls
                  width={width}
                  height={height}
                  setWidth={setWidth}
                  setHeight={setHeight}
                  predefinedSizes={settings.predefinedSizes || []}
                  disabled={
                    loadingRemoveBg || loadingEnhance || loadingDesignFromUrl
                  }
                />
              </div>
            )}

            {/* Pre-cut Service */}
            {settings.enablePrecut && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <PreCutCheckbox preCut={preCut} setPreCut={setPreCut} />
              </div>
            )}

            {/* Quantity Control */}
            {settings.enableQuantity && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-start space-y-1 mb-5">
                  <h2 className="text-lg font-bold tracking-tight text-gray-900">
                    Step 4: Quantity
                  </h2>
                  <p className="text-sm text-gray-500">
                    Order more for volume discounts
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-12 w-12 rounded-xl border border-gray-200 text-2xl font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center shadow-sm"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    min={1}
                    className="w-24 h-12 rounded-xl border border-gray-200 text-center text-lg font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="h-12 w-12 rounded-xl border border-gray-200 text-2xl font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Price Preview */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <PricePreview
                width={width}
                height={height}
                preCut={preCut}
                quantity={quantity}
                variantPrice={variantPrice}
              />
            </div>

            {/* ── In-place anchor (always rendered, hidden via opacity when sticky portal is showing) ── */}
            <div
              ref={cartSectionRef}
              style={{
                opacity: cartIsSticky ? 0 : 1,
                pointerEvents: cartIsSticky ? "none" : "auto",
              }}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
            >
              <AddToCartButton
                cartUrl={cartUrl}
                productId={productId}
                productTitle={productTitle}
                imageUrl={cartImageUrl}
                width={width}
                height={height}
                preCut={preCut}
                quantity={quantity}
                disabled={
                  loadingRemoveBg || loadingEnhance || loadingDesignFromUrl
                }
              />
            </div>

            {/* ── Portal: renders into document.body so position:fixed is ALWAYS viewport-relative ── */}
            {cartIsSticky &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 2147483647,
                    backgroundColor: "#fff",
                    borderTop: "1px solid #e5e7eb",
                    boxShadow: "0 -6px 24px rgba(0,0,0,0.12)",
                    padding: "0.75rem 1rem",
                    paddingBottom:
                      "calc(0.75rem + env(safe-area-inset-bottom))",
                  }}
                >
                  <AddToCartButton
                    cartUrl={cartUrl}
                    productId={productId}
                    productTitle={productTitle}
                    imageUrl={cartImageUrl}
                    width={width}
                    height={height}
                    preCut={preCut}
                    quantity={quantity}
                    disabled={
                      loadingRemoveBg || loadingEnhance || loadingDesignFromUrl
                    }
                  />
                </div>,
                document.body,
              )}

            {/* Processing status indicator */}
            {cartImageUrl && (
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Image ready for order (matches preview)</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-green-800">
                Perfect Prints Guarantee
              </h4>
              <p className="text-xs text-green-700 mt-1">
                Free art review included. No extra fees. We ensure your design
                looks great before printing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCustomizer;
