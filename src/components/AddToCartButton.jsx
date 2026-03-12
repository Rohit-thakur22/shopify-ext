import React, { useState } from "react";

const AddToCartButton = ({
  cartUrl = "/apps/customscale-app/cart-add",
  productId = "",
  productTitle = "",
  imageUrl,
  width,
  height,
  preCut,
  quantity = 1,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Only send server URLs to cart — never blob: URLs
  const isServerUrl =
    imageUrl && typeof imageUrl === "string" && !imageUrl.startsWith("blob:");
  const isValid    = width > 0 && height > 0;
  const urlForCart = isServerUrl ? imageUrl : null;

  const addToCart = async () => {
    if (!isValid || isLoading || disabled) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // ── Step 1: ask the server to calculate price + get dynamic variant ID ──
      const pricingRes = await fetch(cartUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          width,
          height,
          preCut,
          quantity,
          customImage: urlForCart || "",
          productId: productId || "",
          productTitle: productTitle || "",
        }),
      });

      if (!pricingRes.ok) {
        const errData = await pricingRes.json().catch(() => ({}));
        throw new Error(errData.error || "Pricing service unavailable");
      }

      const { variantId, properties } = await pricingRes.json();
      console.log("[AddToCart] Dynamic variant:", variantId, "price:", properties?.UnitPrice);

      // ── Step 2: add the dynamic variant to Shopify cart via AJAX Cart API ──
      const cartRes = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          items: [{ id: variantId, quantity, properties }],
        }),
      });

      if (!cartRes.ok) {
        const errData = await cartRes.json().catch(() => ({}));
        throw new Error(errData.description || "Failed to add to cart");
      }

      const cartData = await cartRes.json();
      console.log("[AddToCart] Added to cart:", cartData);

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/cart";
      }, 500);
    } catch (err) {
      console.error("[AddToCart] Failed:", err);
      setError(err.message || "Failed to add to cart. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) return "Adding...";
    if (success) return "Added! Redirecting...";
    return "Add to Cart";
  };

  const getButtonStyle = () => {
    if (success) return "btn-success";
    return "btn-normal";
  };

  return (
    <div className="add-to-cart-section">
      <button
        type="button"
        onClick={addToCart}
        // disabled={!isValid || isLoading || disabled}
        className={`add-to-cart-btn w-full py-4 px-8 rounded-2xl font-extrabold text-xl tracking-wide transition-all duration-200 flex items-center justify-center gap-3 relative overflow-hidden group ${getButtonStyle()}`}
      >
        {/* Animated shine effect on hover */}
        <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[400%] transition-transform duration-[1200ms] ease-in-out skew-x-12 z-0"></div>
        
        {/* Button content layer to sit above the shine */}
        <div className="relative z-10 flex items-center justify-center gap-3">
        {isLoading ? (
          <svg
            className="animate-spin h-5 w-5 text-white"
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : success ? (
          <svg
            className="h-5 w-5 text-white"
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
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        )}
        <span>{getButtonText()}</span>
        </div>
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 flex items-center gap-2">
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Order summary */}
      {width > 0 && height > 0 && (
        <div className="mt-5 p-4 bg-gray-50/80 border border-gray-100 rounded-xl shadow-inner">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            Order Summary
          </h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Dimensions:</span>
              <span>
                {width}" × {height}"
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pre-cut:</span>
              <span>{preCut ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span>Quantity:</span>
              <span>{quantity}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddToCartButton;
