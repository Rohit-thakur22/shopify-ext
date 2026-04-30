import React, { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import UploadPanel from "./UploadPanel";
import PreCutCheckbox from "./PreCutCheckbox";
import AddToCartButton from "./AddToCartButton";

// Heavy canvas/render libraries (Konva ~1.8MB, Fabric ~30MB unpacked) live in
// these two components. Code-split so the initial parse/compile of
// ProductCustomizer doesn't block first paint on low-end devices.
const importDesignViewer = () => import("./DesignViewerPixelPerfect");
const importDesignStep2 = () => import("./DesignStep2");
const DesignViewerPixelPerfect = lazy(importDesignViewer);
const DesignStep2 = lazy(importDesignStep2);
import useScopedShortcutProtection from "../hooks/useScopedShortcutProtection";
import useStickyColumn from "../hooks/useStickyColumn";

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
  enablePrecut: true,
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
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [preCut, setPreCut] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [step2TotalPrice, setStep2TotalPrice] = useState(0);
  const [sizeBreakdown, setSizeBreakdown] = useState({});
  // Pixel dims of the currently-displayed artwork. Drives aspect-ratio
  // scaling of predefined print sizes (and the cart line items derived
  // from them) so a tall logo doesn't get billed as a full box-max print.
  const [imgPixels, setImgPixels] = useState({ w: 0, h: 0 });

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

  // Hide Step 2 (placement/size slider) on UV-DTF route — users pick size elsewhere.
  const isUvDtfRoute =
    typeof window !== "undefined" &&
    (window.location.pathname || "").toLowerCase().includes("uv");

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
  const customizerRootRef = useRef(null);
  const columnsContainerRef = useRef(null);
  const leftColumnRef = useRef(null);
  const rightColumnRef = useRef(null);
  const step1Ref = useRef(null);

  // On mobile, the upload step renders inside the live-preview column so it
  // sits between the preview grid and the color picker. Initialised lazily
  // from matchMedia to avoid a desktop-then-mobile flicker on first paint.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  // Kick off the heavy chunks once the browser is idle after first paint.
  // Suspense still works if the user scrolls them into view sooner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const idle =
      window.requestIdleCallback ||
      ((cb) => window.setTimeout(cb, 200));
    const cancel =
      window.cancelIdleCallback ||
      ((id) => window.clearTimeout(id));
    const id = idle(() => {
      importDesignViewer();
      importDesignStep2();
    });
    return () => cancel(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler); // Safari < 14 fallback
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  const { recalculate } = useStickyColumn({
    parentRef: columnsContainerRef,
    leftRef: leftColumnRef,
    rightRef: rightColumnRef,
  });

  // On mobile, the live preview occupies a full screen of vertical space, so
  // first-time visitors don't see the upload control without scrolling.
  // Auto-scroll to Step 1 once on mount (mobile only). Skipped when the user
  // arrives with `?design-handle=` since the design is already loading and
  // they should land on the preview, not the empty upload box.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;
    if (designHandle) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => {
      step1Ref.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t1 = setTimeout(recalculate, 80);
    const t2 = setTimeout(recalculate, 300);
    const t3 = setTimeout(recalculate, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [imageUrl, quantity, loadingRemoveBg, loadingEnhance, loadingDesignFromUrl, recalculate]);

  useScopedShortcutProtection(customizerRootRef, { enabled: true });


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
    if (!settingsUrl) { setSettings(DEFAULT_SETTINGS); return; }
    fetch(settingsUrl)
      .then((r) => r.json())
      .then((data) => setSettings({ enablePrecut: data.enablePrecut === true }))
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, [settingsUrl]);

  // Step 2 callback — receives aggregate totals plus full placement/size breakdown
  const handleStep2Change = useCallback(({ width: w, height: h, quantity: q, totalPrice: tp, sizeBreakdown: sb }) => {
    setWidth(w || 0);
    setHeight(h || 0);
    setQuantity(q || 0);
    setStep2TotalPrice(tp || 0);
    setSizeBreakdown(sb && typeof sb === "object" ? sb : {});
  }, []);

  // Decode the currently-visible artwork's pixel dims whenever the URL
  // changes (covers initial upload, BG-removed swaps, and enhance results).
  useEffect(() => {
    if (!imageUrl) { setImgPixels({ w: 0, h: 0 }); return; }
    const img = new Image();
    img.onload = () => setImgPixels({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setImgPixels({ w: 0, h: 0 });
    img.src = imageUrl;
  }, [imageUrl]);

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
    async (url, file, meta = {}) => {
      const isPremade = meta?.source === "premade";
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

      // Auto-fill width/height from image dimensions (inches), clamped to [0.5, 22.5].
      // If UploadPanel already decoded the image (passed via meta.pixelSize),
      // reuse those pixel dims instead of decoding the same file a second time.
      const px = meta?.pixelSize;
      if (px && px.width > 0 && px.height > 0) {
        const clamp = (v) =>
          Math.min(DIMENSION_MAX, Math.max(DIMENSION_MIN, +v.toFixed(2)));
        setWidth(clamp(px.width / DPI));
        setHeight(clamp(px.height / DPI));
      } else {
        getImageDimensionsInInches(url)
          .then(({ widthInches, heightInches }) => {
            setWidth(widthInches);
            setHeight(heightInches);
          })
          .catch((err) => console.warn("Could not read image dimensions:", err));
      }

      // Auto-remove background on upload only if removeBgEnabled is true
      if (file && removeBgEnabled) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        try {
          setLoadingRemoveBg(true);
          const form = new FormData();
          form.append("image", file);
          form.append("type", isPremade ? "3" : "1");

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
  const handleRemoveBg = useCallback(async (type = 1) => {
    // "Remove BG Again" (type=2) should re-run against the original upload,
    // not whatever is currently displayed (which may already be processed/enhanced).
    const sourceBlob = type === 2 ? (originalImageBlob || currentImageBlob) : currentImageBlob;
    if (!sourceBlob || loadingRemoveBg) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    try {
      setLoadingRemoveBg(true);
      const form = new FormData();
      form.append("image", sourceBlob);
      form.append("type", String(type));

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
  }, [currentImageBlob, originalImageBlob, loadingRemoveBg, updateDimensionsFromImageUrl]);

  // Handle Enhance Image
  const handleEnhance = useCallback(async () => {
    if (!currentImageBlob || loadingEnhance) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    try {
      setLoadingEnhance(true);

      console.log(
        "Enhance - Sending image URL:",
        processedServerUrl || originalServerUrl || "(blob)"
      );

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
  }, [currentImageBlob, loadingEnhance, processedServerUrl, originalServerUrl]);

  // Handle Remove Background Again (re-run with type=2 for a second pass)
  const handleRemoveBgAgain = useCallback(() => handleRemoveBg(2), [handleRemoveBg]);

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
            form.append("type", "1");
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

  // ── Step header helper ────────────────────────────────────────────────────────
  const StepHeader = ({ num, title, subtitle, gradient, right }) => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1.25rem" }}>
      {/* Left: circle + text */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flex: 1, minWidth: 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "2rem", height: "2rem", borderRadius: "9999px",
          background: gradient, color: "#ffffff",
          fontSize: "0.875rem", fontWeight: 800, flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        }}>{num}</span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{title}</h3>
          <p style={{ margin: "0.125rem 0 0", fontSize: "0.8125rem", color: "#6b7280" }}>{subtitle}</p>
        </div>
      </div>
      {/* Right slot */}
      {right && <div style={{ flexShrink: 0, marginTop: "0.125rem" }}>{right}</div>}
    </div>
  );

  const R = "1rem";          // card border-radius
  const SH = "0 1px 4px rgba(0,0,0,0.06)"; // card shadow

  // Step 1 card — rendered in exactly ONE location per viewport so its
  // internal state (DPI modal, choice modal, etc.) is preserved:
  //   • Mobile  → injected into DesignViewerPixelPerfect via slotAfterGrid
  //   • Desktop → in the right column, original position
  const step1Card = (
    <div
      ref={step1Ref}
      style={{
        borderRadius: R,
        border: "1px solid #d8b4fe",
        background: "linear-gradient(145deg, rgba(123,44,191,0.04) 0%, #ffffff 100%)",
        padding: "1.375rem",
        boxShadow: SH,
        scrollMarginTop: "1rem",
      }}
    >
      <StepHeader
        num="1"
        title="Upload Your Design"
        subtitle="Supports PNG, JPG, SVG — we auto-remove the background"
        gradient="linear-gradient(135deg, #7b2cbf, #9d4edd)"
      />
      <UploadPanel
        onUpload={handleImageUpload}
        imageUrl={imageUrl}
        onEnhance={handleEnhance}
        onRemoveBgAgain={handleRemoveBgAgain}
        loadingRemoveBg={loadingRemoveBg}
        loadingEnhance={loadingEnhance}
        loadingDesignFromUrl={loadingDesignFromUrl}
        onClear={handleClearDesign}
        onCancelProcessing={handleCancelProcessing}
        removeBgEnabled={removeBgEnabled}
        onToggleRemoveBg={handleToggleRemoveBg}
      />
    </div>
  );

  return (
    <div
      ref={customizerRootRef}
      className="product-customizer"
      style={{ width: "100%", backgroundColor: "#ffffff" }}
    >
      <div style={{ maxWidth: "84rem", margin: "0 auto", padding: "1rem" }}>

        {/* ── Header banner ── */}
        <div style={{
          marginBottom: "1.5rem", position: "relative", overflow: "hidden",
          borderRadius: R, padding: "1.5rem",
          background: "linear-gradient(90deg, #7b2cbf 0%, #ff69b4 55%, #0a1172 100%)",
          boxShadow: "0 10px 28px -5px rgba(123,44,191,0.35)",
        }}>
          {/* decorative orbs */}
          <div style={{ position: "absolute", top: 0, right: 0, width: "13rem", height: "13rem", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", transform: "translate(30%,-35%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, left: "30%", width: "8rem", height: "8rem", borderRadius: "9999px", background: "rgba(255,105,180,0.18)", transform: "translateY(50%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(1.35rem, 2.5vw, 1.875rem)", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.025em", lineHeight: 1.25 }}>
              {urlTitle ? `Customize ${urlTitle}` : "Design Your Product"}
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "rgba(255,220,240,0.92)" }}>
              Upload your design, choose placement &amp; sizes, and add to cart
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem", marginTop: "0.875rem" }}>
              {["Free Art Review", "HD Print Quality", "Volume Discounts Up to 65%"].map((b) => (
                <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.95)", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", padding: "0.25rem 0.625rem", borderRadius: "9999px" }}>
                  <svg style={{ width: "0.7rem", height: "0.7rem", flexShrink: 0 }} fill="none" stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div
          ref={columnsContainerRef}
          style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "flex-start" }}
        >

          {/* ── Left column: live preview (narrower) ── */}
          <div
            ref={leftColumnRef}
            style={{ flex: "1 1 38%", minWidth: "min(100%, 280px)" }}
          >
            <div style={{ backgroundColor: "#ffffff", borderRadius: R, border: "1px solid #e9d5ff", padding: "1.125rem", boxShadow: SH }}>
              <Suspense fallback={<div style={{ minHeight: 480 }} aria-hidden />}>
                <DesignViewerPixelPerfect
                  imageUrl={imageUrl}
                  tintColor={tintColor}
                  onColorChange={handleColorChange}
                  assetUrls={assetUrls}
                  slotAfterGrid={isMobile ? step1Card : null}
                />
              </Suspense>
            </div>
          </div>

          {/* ── Right column: 3 steps (wider) ── */}
          <div
            ref={rightColumnRef}
            className="add-to-cart-mobile-spacer"
            style={{ flex: "1 1 56%", minWidth: "min(100%, 280px)", display: "flex", flexDirection: "column", gap: "1.125rem" }}
          >

            {/* ── STEP 1: Upload your design (desktop only — see slotAfterGrid above) ── */}
            {!isMobile && step1Card}

            {/* ── STEP 2: Set design placement, sizes & quantities ── */}
            <div style={{ borderRadius: R, border: "1px solid #fbcfe8", background: "linear-gradient(145deg, rgba(255,105,180,0.04) 0%, #ffffff 100%)", padding: "1.375rem", boxShadow: SH }}>
              <StepHeader
                num="2"
                title="Set Design Size &amp; Quantity"
                subtitle="Choose placement, select sizes, and enter quantities per size"
                gradient="linear-gradient(135deg, #be185d, #ff69b4)"
              />
              <Suspense fallback={<div style={{ minHeight: 320 }} aria-hidden />}>
                <DesignStep2
                  preCut={preCut}
                  imageUrl={imageUrl}
                  tintColor={tintColor}
                  assetUrls={assetUrls}
                  onChange={handleStep2Change}
                  hidePlacementSelector={isUvDtfRoute}
                />
              </Suspense>

              {/* ── Pre-cut: last section of Step 2 ── */}
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
                <PreCutCheckbox preCut={preCut} setPreCut={setPreCut} />
              </div>
            </div>

            {/* ── STEP 3: Review & Add to Cart ── */}
            <div style={{ borderRadius: R, border: "1px solid #bfdbfe", background: "linear-gradient(145deg, rgba(10,17,114,0.04) 0%, #ffffff 100%)", padding: "1.375rem", boxShadow: SH }}>
              <StepHeader
                num="3"
                title="Review &amp; Add to Cart"
                subtitle="Double-check your order then add it to cart"
                gradient="linear-gradient(135deg, #0a1172, #2563eb)"
                right={quantity === 0 ? (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.3rem",
                    fontSize: "0.75rem", fontWeight: 600, color: "#92400e",
                    backgroundColor: "#fffbeb", border: "1px solid #fde68a",
                    borderRadius: "9999px", padding: "0.25rem 0.625rem",
                    whiteSpace: "nowrap",
                  }}>
                    Complete Steps 1 &amp; 2 first
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </span>
                ) : null}
              />

              {/* Order summary */}
              {quantity > 0 ? (
                <div style={{ marginBottom: "1.25rem", padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                  <p style={{ margin: "0 0 0.625rem", fontSize: "0.8125rem", fontWeight: 700, color: "#374151" }}>Order Summary</p>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Total transfers:</span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#111827" }}>{quantity}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #e5e7eb", marginTop: "0.375rem" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#111827" }}>Estimated Total:</span>
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#7b2cbf", letterSpacing: "-0.02em" }}>
                      ${Number(step2TotalPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {cartImageUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "#059669" }}>
                      <svg style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Design image ready
                    </div>
                  )}
                </div>
              ) : null}

              {/* Add to Cart — in-place (hidden when mobile sticky portal active) */}
              <div
                ref={cartSectionRef}
                style={{ opacity: cartIsSticky ? 0 : 1, pointerEvents: cartIsSticky ? "none" : "auto" }}
              >
                <AddToCartButton
                  cartUrl={cartUrl}
                  productId={productId}
                  productTitle={productTitle}
                  imageUrl={cartImageUrl}
                  width={width}
                  height={height}
                  preCut={preCut}
                  quantity={quantity || 1}
                  sizeBreakdown={sizeBreakdown}
                  imgPixels={imgPixels}
                  disabled={loadingRemoveBg || loadingEnhance || loadingDesignFromUrl || quantity === 0}
                />
              </div>

              {/* Mobile sticky cart portal */}
              {cartIsSticky &&
                typeof document !== "undefined" &&
                createPortal(
                  <div style={{
                    position: "fixed", bottom: 0, left: 0, right: 0,
                    zIndex: 2147483647, backgroundColor: "#fff",
                    borderTop: "1px solid #e5e7eb",
                    boxShadow: "0 -6px 24px rgba(0,0,0,0.12)",
                    padding: "0.75rem 1rem",
                    paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
                  }}>
                    <AddToCartButton
                      cartUrl={cartUrl}
                      productId={productId}
                      productTitle={productTitle}
                      imageUrl={cartImageUrl}
                      width={width}
                      height={height}
                      preCut={preCut}
                      quantity={quantity || 1}
                      sizeBreakdown={sizeBreakdown}
                      imgPixels={imgPixels}
                      disabled={loadingRemoveBg || loadingEnhance || loadingDesignFromUrl || quantity === 0}
                    />
                  </div>,
                  document.body,
                )}
            </div>

          </div>{/* end right column */}
        </div>{/* end two-column */}

        {/* ── Footer guarantee ── */}
        <div style={{ marginTop: "1.5rem", padding: "1.125rem", background: "linear-gradient(135deg, rgba(123,44,191,0.06) 0%, rgba(255,105,180,0.06) 55%, rgba(10,17,114,0.06) 100%)", borderRadius: R, border: "1px solid #e9d5ff", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
            <div style={{ flexShrink: 0, width: "2.25rem", height: "2.25rem", background: "linear-gradient(135deg, #7b2cbf, #ff69b4)", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(123,44,191,0.3)" }}>
              <svg style={{ width: "1.125rem", height: "1.125rem", color: "#ffffff" }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0a1172" }}>Perfect Prints Guarantee</h4>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#7b2cbf", lineHeight: 1.6 }}>
                Free art review included. No extra fees. We ensure your design looks great before printing.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.625rem" }}>
                {["No Setup Fees", "Free Art Review", "Satisfaction Guaranteed"].map((item) => (
                  <span key={item} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", fontWeight: 600, color: "#0a1172", backgroundColor: "rgba(255,255,255,0.85)", padding: "0.125rem 0.625rem", borderRadius: "9999px", border: "1px solid #d8b4fe" }}>
                    <svg style={{ width: "0.6rem", height: "0.6rem", flexShrink: 0 }} fill="none" stroke="#7b2cbf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductCustomizer;
