import React, { useState } from "react";

const AddToCartButton = ({
  variantId,
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

  const isValid = imageUrl && width > 0 && height > 0 && variantId;

  const addToCart = async () => {
    if (!isValid || isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id: variantId,
          quantity: quantity,
          properties: {
            _Area_x: width.toFixed(2),
            _Area_y: height.toFixed(2),
            _PreCut: preCut ? "Yes" : "No",
            CustomImage: imageUrl,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || "Failed to add to cart");
      }

      const data = await response.json();
      console.log("Added to cart:", data);

      setSuccess(true);
      
      // Redirect to cart after short delay to show success state
      setTimeout(() => {
        window.location.href = "/cart";
      }, 500);
    } catch (err) {
      console.error("Add to cart failed:", err);
      setError(err.message || "Failed to add to cart. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) return "Adding...";
    if (success) return "Added! Redirecting...";
    if (!imageUrl) return "Upload an image first";
    if (width <= 0 || height <= 0) return "Set dimensions";
    return "Add to Cart";
  };

  const getButtonStyle = () => {
    if (success) {
      return "bg-green-600 hover:bg-green-600";
    }
    if (!isValid || disabled) {
      return "bg-gray-400 cursor-not-allowed";
    }
    return "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700";
  };

  return (
    <div className="add-to-cart-section">
      <button
        type="button"
        onClick={addToCart}
        disabled={!isValid || isLoading || disabled}
        className={`w-full py-3 px-6 rounded-lg text-white font-semibold text-base shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${getButtonStyle()}`}
      >
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
      {isValid && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-xs font-medium text-gray-700 mb-2">
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
