import React, { useState } from "react";
import { PLACEMENT_CATALOGUE } from "../lib/pricingConfig";

const toNum = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

function buildLineRequests(sizeBreakdown, preCut) {
  if (!sizeBreakdown || typeof sizeBreakdown !== "object") return [];

  const requests = [];
  for (const [placementId, placementConfig] of Object.entries(sizeBreakdown)) {
    const placement = PLACEMENT_CATALOGUE.find((p) => p.id === placementId);
    if (!placement || !placementConfig) continue;

    const predefined = placementConfig.predefined || {};
    for (const [sizeId, rawQty] of Object.entries(predefined)) {
      const quantity = toInt(rawQty);
      if (quantity <= 0) continue;

      const size = placement.sizes.find((s) => s.id === sizeId);
      const width = toNum(size?.w);
      const height = toNum(size?.h);
      if (width <= 0 || height <= 0) continue;

      requests.push({
        placementId,
        placementLabel: placement.label,
        placementView: placement.view,
        sizeId,
        sizeLabel: size?.label || sizeId,
        width,
        height,
        quantity,
        preCut: Boolean(preCut),
      });
    }

    const customRows = Array.isArray(placementConfig.customSizes)
      ? placementConfig.customSizes
      : [];
    customRows.forEach((row, index) => {
      const width = toNum(row?.width);
      const height = toNum(row?.height);
      const quantity = toInt(row?.quantity);
      if (width < 0.5 || height < 0.5 || quantity <= 0) return;

      requests.push({
        placementId,
        placementLabel: placement.label,
        placementView: placement.view,
        sizeId: row?.id || `${placementId}-custom-${index + 1}`,
        sizeLabel: `Custom ${index + 1}`,
        width,
        height,
        quantity,
        preCut: Boolean(preCut),
      });
    });
  }

  return requests;
}

const AddToCartButton = ({
  cartUrl      = "/apps/customscale-app/cart-add",
  productId    = "",
  productTitle = "",
  imageUrl,
  width,
  height,
  preCut,
  quantity = 1,
  sizeBreakdown = {},
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState(null);
  const [success,   setSuccess]   = useState(false);
  const [hovered,   setHovered]   = useState(false);

  const isServerUrl = imageUrl && typeof imageUrl === "string" && !imageUrl.startsWith("blob:");
  const lineRequests = buildLineRequests(sizeBreakdown, preCut);
  const computedTotalQty = lineRequests.reduce((sum, line) => sum + line.quantity, 0);
  const hasMultiLineSelection = lineRequests.length > 0 && computedTotalQty > 0;
  const isValid     = hasMultiLineSelection || (width > 0 && height > 0);
  const urlForCart  = isServerUrl ? imageUrl : null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const postCartItems = async (items) => {
    const res = await fetch("/cart/add.js", {
      method : "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body   : JSON.stringify({ items }),
    });
    if (res.ok) {
      return { ok: true, status: res.status, description: "" };
    }
    const errData = await res.json().catch(() => ({}));
    const description = errData?.description || errData?.message || "Failed to add to cart";
    return { ok: false, status: res.status, description };
  };

  const isTemporarySoldOut = ({ status, description }) =>
    status === 422 &&
    typeof description === "string" &&
    description.toLowerCase().includes("already sold out");

  const addItemsToCart = async (items) => {
    const backoffMs = [700, 1400, 2400];
    let lastResult = null;

    // First, try batched add with retries.
    for (let i = 0; i <= backoffMs.length; i += 1) {
      const result = await postCartItems(items);
      if (result.ok) return;
      lastResult = result;
      if (!isTemporarySoldOut(result)) {
        throw new Error(result.description || "Failed to add to cart");
      }
      if (i < backoffMs.length) {
        await sleep(backoffMs[i]);
      }
    }

    // If batch still fails due temporary sold-out, recover line-by-line.
    if (items.length > 1 && lastResult && isTemporarySoldOut(lastResult)) {
      for (const item of items) {
        let singleLast = null;
        for (let i = 0; i <= backoffMs.length; i += 1) {
          const result = await postCartItems([item]);
          if (result.ok) {
            singleLast = null;
            break;
          }
          singleLast = result;
          if (!isTemporarySoldOut(result)) {
            throw new Error(result.description || "Failed to add to cart");
          }
          if (i < backoffMs.length) {
            await sleep(backoffMs[i]);
          }
        }
        if (singleLast) {
          throw new Error(singleLast.description || "Failed to add to cart");
        }
      }
      return;
    }

    throw new Error(lastResult?.description || "Failed to add to cart");
  };

  const addToCart = async () => {
    if (!isValid || !isServerUrl || isLoading || disabled) return;
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const fetchPricingItems = async () => {
        const pricingRes = await fetch(cartUrl, {
          method : "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body   : JSON.stringify({
            width,
            height,
            preCut,
            quantity,
            totalQty: hasMultiLineSelection ? computedTotalQty : quantity,
            lines: hasMultiLineSelection ? lineRequests : undefined,
            customImage: urlForCart || "",
            productId: productId || "",
            productTitle: productTitle || "",
          }),
        });
        if (!pricingRes.ok) {
          const errData = await pricingRes.json().catch(() => ({}));
          throw new Error(errData.error || "Pricing service unavailable");
        }
        const pricingData = await pricingRes.json();
        const fallbackQuantity = Math.max(1, toInt(quantity, 1));
        const cartItems = Array.isArray(pricingData?.items)
          ? pricingData.items
          : pricingData?.variantId
          ? [{
              id: pricingData.variantId,
              quantity: fallbackQuantity,
              properties: pricingData.properties || {},
            }]
          : [];
        if (cartItems.length === 0) {
          throw new Error("Pricing service returned no cart items");
        }
        return cartItems;
      };

      const cartItems = await fetchPricingItems();
      try {
        await addItemsToCart(cartItems);
      } catch (firstErr) {
        const msg = String(firstErr?.message || "");
        const stillSoldOut = msg.toLowerCase().includes("already sold out");
        if (!stillSoldOut) throw firstErr;

        // Last recovery step: rerun pricing once (same as user clicking again)
        // and retry add with refreshed variant resolution.
        await sleep(1200);
        const refreshedItems = await fetchPricingItems();
        await addItemsToCart(refreshedItems);
      }

      setSuccess(true);
      setTimeout(() => { window.location.href = "/cart"; }, 500);
    } catch (err) {
      setError(err.message || "Failed to add to cart. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Button appearance ──────────────────────────────────────────────────────
  const isDisabled = !isValid || !isServerUrl || isLoading || disabled;

  const btnBg = success
    ? "#059669"
    : isDisabled
    ? "#d1d5db"
    : hovered
    ? "#4338ca"
    : "#4f46e5";

  const btnColor  = isDisabled && !success ? "#9ca3af" : "#ffffff";
  const btnCursor = isDisabled ? "not-allowed" : "pointer";

  const btnStyle = {
    display       : "inline-flex",
    alignItems    : "center",
    justifyContent: "center",
    gap           : "0.5rem",
    width         : "fit-content",
    padding       : "0.75rem 2rem",
    borderRadius  : "0.625rem",
    border        : "none",
    background    : btnBg,
    color         : btnColor,
    fontSize      : "1rem",
    fontWeight    : 700,
    letterSpacing : "0.01em",
    cursor        : btnCursor,
    boxShadow     : isDisabled ? "none" : hovered
      ? "0 6px 18px -4px rgba(79,70,229,0.5)"
      : "0 3px 10px -3px rgba(79,70,229,0.4)",
    transition    : "background 0.2s, box-shadow 0.2s, transform 0.1s",
    transform     : hovered && !isDisabled ? "translateY(-1px)" : "none",
    touchAction   : "manipulation",
    WebkitTapHighlightColor: "transparent",
    whiteSpace    : "nowrap",
  };

  const getLabel = () => {
    if (isLoading) return "Adding…";
    if (success)   return "Added! Redirecting…";
    return "Add to Cart";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>

      {/* ── Button ── */}
      <button
        type="button"
        onClick={addToCart}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={btnStyle}
      >
        {/* Icon */}
        {isLoading ? (
          <svg style={{ width: "1.125rem", height: "1.125rem", animation: "hq-spin 0.75s linear infinite", flexShrink: 0 }}
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path  style={{ opacity: 0.85 }}  fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
        ) : success ? (
          <svg style={{ width: "1.125rem", height: "1.125rem", flexShrink: 0 }}
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        ) : (
          <svg style={{ width: "1.125rem", height: "1.125rem", flexShrink: 0 }}
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
          </svg>
        )}
        <span>{getLabel()}</span>
      </button>

      {/* ── Error message ── */}
      {error && (
        <div style={{
          width: "100%", maxWidth: "28rem",
          padding: "0.625rem 0.875rem", borderRadius: "0.5rem",
          backgroundColor: "#fff5f5", border: "1px solid #fca5a5",
          display: "flex", alignItems: "flex-start", gap: "0.5rem",
        }}>
          <svg style={{ width: "1rem", height: "1rem", flexShrink: 0, color: "#ef4444", marginTop: "0.0625rem" }}
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#dc2626", lineHeight: 1.4 }}>{error}</p>
        </div>
      )}

      {/* Spinner keyframes */}
      <style>{`@keyframes hq-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AddToCartButton;
