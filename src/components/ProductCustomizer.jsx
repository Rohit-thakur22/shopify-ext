import React, { useState, useCallback, useRef, useEffect } from "react";
import UploadPanel from "./UploadPanel";
import DesignViewer from "./DesignViewer";
import DesignPlacementSlider from "./DesignPlacementSlider";
import SizeControls from "./SizeControls";
import PreCutCheckbox from "./PreCutCheckbox";
import PricePreview from "./PricePreview";
import AddToCartButton from "./AddToCartButton";

// API endpoints
const API_BASE = "https://highquality.allgovjobs.com";
const REMOVE_BG_ENDPOINT = `${API_BASE}/api/images/remove-bg`;
const ENHANCE_ENDPOINT = `${API_BASE}/api/images/enhance`;

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
};

const ProductCustomizer = ({ variantId, assetUrls = {}, settingsUrl = null }) => {
  // Core customization state
  const [imageUrl, setImageUrl] = useState(null);
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(10);
  const [preCut, setPreCut] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  // Image processing state
  const [currentImageBlob, setCurrentImageBlob] = useState(null);
  const [finalImageUrl, setFinalImageUrl] = useState(null); // Server URL for cart
  const [loadingRemoveBg, setLoadingRemoveBg] = useState(false);
  const [loadingEnhance, setLoadingEnhance] = useState(false);
  
  // UI state
  const [tintColor, setTintColor] = useState("#6b7280");

  // Feature flags from Admin (default all true if API fails)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Refs
  const currentBlobUrlRef = useRef(null);
  const abortControllerRef = useRef(null);

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
        });
      })
      .catch(() => {
        setSettings(DEFAULT_SETTINGS);
      });
  }, [settingsUrl]);

  // Handle image upload
  const handleImageUpload = useCallback(async (url, file) => {
    // Revoke previous blob URL
    if (currentBlobUrlRef.current && currentBlobUrlRef.current.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      } catch (err) {
        console.error("Error revoking blob URL:", err);
      }
    }

    currentBlobUrlRef.current = url;
    setImageUrl(url);
    setFinalImageUrl(null); // Reset final URL on new upload

    // If file is provided, store the blob for API calls
    if (file) {
      setCurrentImageBlob(file);
      
      // Auto-remove background on upload
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

        // Get the server URL from response header
        const serverLink = res.headers.get("X-Image-Link");
        if (serverLink) {
          const fullServerUrl = `${API_BASE}/${serverLink}`;
          setFinalImageUrl(fullServerUrl);
          console.log("Server image URL:", fullServerUrl);
        }

        // Get processed image blob
        const processedBlob = await res.blob();
        setCurrentImageBlob(processedBlob);

        // Create new display URL
        const newDisplayUrl = URL.createObjectURL(processedBlob);
        
        // Revoke old URL and update
        if (currentBlobUrlRef.current && currentBlobUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }
        currentBlobUrlRef.current = newDisplayUrl;
        setImageUrl(newDisplayUrl);

      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Auto remove-bg failed:", err);
        // Keep original image if processing fails
      } finally {
        setLoadingRemoveBg(false);
      }
    }
  }, []);

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

      // Get the server URL from response header
      const serverLink = res.headers.get("X-Image-Link");
      if (serverLink) {
        const fullServerUrl = `${API_BASE}/${serverLink}`;
        setFinalImageUrl(fullServerUrl);
        console.log("Remove BG - Server image URL:", fullServerUrl);
      }

      // Get processed image blob
      const processedBlob = await res.blob();
      setCurrentImageBlob(processedBlob);

      // Create new display URL
      const newDisplayUrl = URL.createObjectURL(processedBlob);
      
      // Revoke old URL and update
      if (currentBlobUrlRef.current && currentBlobUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      currentBlobUrlRef.current = newDisplayUrl;
      setImageUrl(newDisplayUrl);

    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Remove background failed:", err);
    } finally {
      setLoadingRemoveBg(false);
    }
  }, [currentImageBlob, loadingRemoveBg]);

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

      // Get the server URL from response header
      const serverLink = res.headers.get("X-AutoEnhance-Link");
      if (serverLink) {
        const fullServerUrl = `${API_BASE}/${serverLink}`;
        setFinalImageUrl(fullServerUrl);
        console.log("Enhance - Server image URL:", fullServerUrl);
      }

      // Get processed image blob
      const processedBlob = await res.blob();
      setCurrentImageBlob(processedBlob);

      // Create new display URL
      const newDisplayUrl = URL.createObjectURL(processedBlob);
      
      // Revoke old URL and update
      if (currentBlobUrlRef.current && currentBlobUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      currentBlobUrlRef.current = newDisplayUrl;
      setImageUrl(newDisplayUrl);

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
    // Revoke the blob URL before clearing
    if (currentBlobUrlRef.current && currentBlobUrlRef.current.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      } catch (err) {
        console.error("Error revoking blob URL:", err);
      }
    }
    currentBlobUrlRef.current = null;
    setImageUrl(null);
    setCurrentImageBlob(null);
    setFinalImageUrl(null);
  }, []);

  // Get the image URL to use for cart (prefer server URL, fallback to display URL)
  const cartImageUrl = finalImageUrl || imageUrl;

  return (
    <div className="product-customizer w-full bg-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Customize Your Product
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Upload your design, set dimensions, and add to cart
          </p>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Upload and Preview */}
          <div className="lg:col-span-7 space-y-6">
            {/* Upload Panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <UploadPanel 
                onUpload={handleImageUpload} 
                imageUrl={imageUrl}
                onRemoveBg={handleRemoveBg}
                onEnhance={handleEnhance}
                loadingRemoveBg={loadingRemoveBg}
                loadingEnhance={loadingEnhance}
                onClear={handleClearDesign}
                onCancelProcessing={handleCancelProcessing}
              />
            </div>

            {/* Design Viewer */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <DesignViewer
                imageUrl={imageUrl}
                tintColor={tintColor}
                onColorChange={handleColorChange}
                assetUrls={assetUrls}
              />
            </div>

            {/* Design Placement Slider */}
            {settings.enablePlacement && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <DesignPlacementSlider
                  imageUrl={imageUrl}
                  tintColor={tintColor}
                  assetUrls={assetUrls}
                />
              </div>
            )}
          </div>

          {/* Right column - Controls and Cart */}
          <div className="lg:col-span-5 space-y-6">
            {/* Size Controls */}
            {settings.enableSize && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <SizeControls
                  width={width}
                  height={height}
                  setWidth={setWidth}
                  setHeight={setHeight}
                />
              </div>
            )}

            {/* Pre-cut Service */}
            {settings.enablePrecut && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <PreCutCheckbox preCut={preCut} setPreCut={setPreCut} />
              </div>
            )}

            {/* Quantity Control */}
            {settings.enableQuantity && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-start space-y-2 mb-4">
                  <h2 className="font-bold text-black text-base">Quantity</h2>
                  <p className="text-xs text-gray-600">
                    Order more for volume discounts
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-10 w-10 rounded-md border border-gray-300 text-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-20 h-10 rounded-md border border-gray-300 text-center text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="h-10 w-10 rounded-md border border-gray-300 text-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Price Preview */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <PricePreview
                width={width}
                height={height}
                preCut={preCut}
                quantity={quantity}
              />
            </div>

            {/* Add to Cart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <AddToCartButton
                variantId={variantId}
                imageUrl={cartImageUrl}
                width={width}
                height={height}
                preCut={preCut}
                quantity={quantity}
                disabled={loadingRemoveBg || loadingEnhance}
              />
            </div>

            {/* Processing status indicator */}
            {finalImageUrl && (
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Image processed and ready for order</span>
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
