import React, { useMemo } from "react";

// Price formatter: explicit en-US to avoid locale issues (e.g. 9:17 vs 9.17)
const formatPrice = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Pricing constants
const BASE_PRICE = 9.17;
const PRICE_PER_SQIN = 0.0416;
const PRECUT_FEE = 0.24;

// Volume discount tiers
const DISCOUNT_TIERS = [
  { minQty: 1, maxQty: 14, discount: 0, label: "1-14 pcs" },
  { minQty: 15, maxQty: 49, discount: 0.2, label: "15-49 pcs (20% off)" },
  { minQty: 50, maxQty: 99, discount: 0.3, label: "50-99 pcs (30% off)" },
  { minQty: 100, maxQty: 249, discount: 0.4, label: "100-249 pcs (40% off)" },
  { minQty: 250, maxQty: Infinity, discount: 0.5, label: "250+ pcs (50% off)" },
];

const PricePreview = ({ width, height, preCut, quantity = 1 }) => {
  const pricing = useMemo(() => {
    // Calculate area price
    const area = width * height;
    const areaPrice = area * PRICE_PER_SQIN;
    
    // Add pre-cut fee if selected
    const preCutPrice = preCut ? PRECUT_FEE : 0;
    
    // Calculate unit price (before discount)
    const unitPrice = BASE_PRICE + areaPrice + preCutPrice;
    
    // Find applicable discount tier
    const tier = DISCOUNT_TIERS.find(
      (t) => quantity >= t.minQty && quantity <= t.maxQty
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
  }, [width, height, preCut, quantity]);

  return (
    <div className="price-preview bg-white rounded-lg">
      <div className="text-start space-y-2 mb-4">
        <h2 className="font-bold text-black text-base">Price Estimate</h2>
        <p className="text-xs text-gray-600">
          Live pricing based on your selections
        </p>
      </div>

      <div className="space-y-3">
        {/* Price breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Base price:</span>
            <span>${formatPrice(BASE_PRICE)}</span>
          </div>
          
          <div className="flex justify-between text-gray-600">
            <span>
              Area ({formatPrice(pricing.area)} sq in × ${formatPrice(PRICE_PER_SQIN)}):
            </span>
            <span>${formatPrice(pricing.areaPrice)}</span>
          </div>
          
          {preCut && (
            <div className="flex justify-between text-gray-600">
              <span>Pre-cut service:</span>
              <span>${formatPrice(pricing.preCutPrice)}</span>
            </div>
          )}
          
          <div className="border-t border-gray-200 pt-2">
            <div className="flex justify-between font-medium text-gray-800">
              <span>Unit price:</span>
              <span>${formatPrice(pricing.unitPrice)}</span>
            </div>
          </div>

          {pricing.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({(pricing.discount * 100).toFixed(0)}% off):</span>
              <span>-${formatPrice(pricing.unitPrice - pricing.discountedUnitPrice)}</span>
            </div>
          )}
        </div>

        {/* Total price */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Estimated Total</p>
              {quantity > 1 && (
                <p className="text-xs text-gray-500">
                  ${formatPrice(pricing.discountedUnitPrice)} × {quantity}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                ${formatPrice(pricing.totalPrice)}
              </p>
              {pricing.discount > 0 && (
                <p className="text-xs text-green-600 font-medium">
                  You save ${formatPrice((pricing.unitPrice - pricing.discountedUnitPrice) * quantity)}
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
