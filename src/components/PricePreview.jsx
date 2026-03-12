import React, { useMemo } from "react";

// Price formatter: explicit en-US to avoid locale issues (e.g. 9:17 vs 9.17)
const formatPrice = (n) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Pricing constants — keep in sync with hq-migration/extensions/cart-pricing (cart transform) for cart/checkout price

const PRICE_PER_SQIN = 0.0416; // size-based price: (width * height) * 0.0416
const PRECUT_FEE = 0.24;

// Volume discount tiers
const DISCOUNT_TIERS = [
  { minQty: 1, maxQty: 14, discount: 0, label: "1-14 pcs" },
  { minQty: 15, maxQty: 49, discount: 0.2, label: "15-49 pcs (20% off)" },
  { minQty: 50, maxQty: 99, discount: 0.3, label: "50-99 pcs (30% off)" },
  { minQty: 100, maxQty: 249, discount: 0.4, label: "100-249 pcs (40% off)" },
  { minQty: 250, maxQty: Infinity, discount: 0.5, label: "250+ pcs (50% off)" },
];

const PricePreview = ({
  width,
  height,
  preCut,
  quantity = 1,
  variantPrice: variantPriceProp,
}) => {
  // Use product/variant price when provided (dynamic per product); otherwise fallback to static default
  // const basePrice = variantPriceProp != null && !Number.isNaN(Number(variantPriceProp))
  //   ? Number(variantPriceProp)
  //   : BASE_PRICE;
  const basePrice = 0;
  const pricing = useMemo(() => {
    // Calculate area price
    const area = width * height;
    const areaPrice = area * PRICE_PER_SQIN;

    // Add pre-cut fee if selected
    const preCutPrice = preCut ? PRECUT_FEE : 0;

    // Calculate unit price (before discount) — base comes from variant when in theme
    const unitPrice = basePrice + areaPrice + preCutPrice;

    // Find applicable discount tier
    const tier =
      DISCOUNT_TIERS.find(
        (t) => quantity >= t.minQty && quantity <= t.maxQty,
      ) || DISCOUNT_TIERS[0];

    // Apply discount
    const discountedUnitPrice = unitPrice * (1 - tier.discount);

    // Calculate total
    const totalPrice = discountedUnitPrice * quantity;

    return {
      area,
      areaPrice,
      preCutPrice,
      unitPrice,
      discountedUnitPrice,
      totalPrice,
      discount: tier.discount,
      tierLabel: tier.label,
    };
  }, [width, height, preCut, quantity, basePrice]);

  return (
    <div className="price-preview bg-white rounded-lg">
      <div className="text-start space-y-1 mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Price Estimate</h2>
        <p className="text-sm text-gray-500">
          Live pricing based on your selections
        </p>
      </div>

      <div className="space-y-3">
        {/* Price breakdown */}
        <div className="space-y-3 text-sm px-1">
          {/* <div className="flex justify-between text-gray-600">
            <span>Base price:</span>
            <span>${formatPrice(basePrice)}</span>
          </div> */}

          <div className="flex justify-between text-gray-600 items-center">
            <span>
              Area ({formatPrice(pricing.area)} sq in × $
              {formatPrice(PRICE_PER_SQIN)}):
            </span>
            <span className="font-medium text-gray-800">${formatPrice(pricing.areaPrice)}</span>
          </div>

          {preCut && (
            <div className="flex justify-between text-gray-600 items-center">
              <span>Pre-cut service:</span>
              <span className="font-medium text-gray-800">${formatPrice(pricing.preCutPrice)}</span>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3 mt-4">
            <div className="flex justify-between font-semibold text-gray-800 items-center">
              <span>Unit price:</span>
              <span>${formatPrice(pricing.unitPrice)}</span>
            </div>
          </div>

          {pricing.discount > 0 && (
            <div className="flex justify-between text-emerald-600 items-center bg-emerald-50/50 p-2 rounded-lg -mx-2 mt-2">
              <span className="font-medium">
                Volume Discount ({(pricing.discount * 100).toFixed(0)}% off):
              </span>
              <span className="font-bold">
                -${formatPrice(pricing.unitPrice - pricing.discountedUnitPrice)}
              </span>
            </div>
          )}
        </div>

        {/* Total price */}
        <div
          style={{
            background: "linear-gradient(135deg, #eef2ff 0%, #eff6ff 100%)",
            borderRadius: "1rem",
            padding: "1.5rem",
            marginTop: "1.5rem",
            border: "1px solid #c7d2fe",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: "#312e81",
                  margin: 0,
                }}
              >
                Estimated Total
              </p>
              {quantity > 1 && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#4f46e5",
                    marginTop: "0.25rem",
                    fontWeight: "500",
                    backgroundColor: "rgba(255,255,255,0.6)",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "0.375rem",
                    display: "inline-block",
                  }}
                >
                  ${formatPrice(pricing.discountedUnitPrice)} × {quantity}
                </p>
              )}
            </div>
            <div>
              <p
                style={{
                  fontSize: "2rem",
                  fontWeight: "800",
                  color: "#4f46e5",
                  letterSpacing: "-0.025em",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                ${formatPrice(pricing.totalPrice)}
              </p>
              {pricing.discount > 0 && (
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#059669",
                    fontWeight: "700",
                    marginTop: "0.375rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  You save ${formatPrice(
                    (pricing.unitPrice - pricing.discountedUnitPrice) * quantity,
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Volume discount info */}
        <div className="text-xs text-gray-500 text-center mt-2">
          <p>💡 Order 15+ pieces for volume discounts up to 50% off</p>
        </div>
      </div>
    </div>
  );
};

export default PricePreview;
