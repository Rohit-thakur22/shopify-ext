/** Route-aware per-sq-in rate: UV-DTF = $0.12, sublimation = $0.0259, DTF = $0.0414. */
function resolvePricePerSqIn() {
  if (typeof window === "undefined") return 0.0414;
  const path = (window.location.pathname || "").toLowerCase();
  if (path.includes("uv")) return 0.12;
  if (path.includes("sublimation")) return 0.0259;
  if (path.includes("dtf")) return 0.0414;
  return 0.0414;
}

/** Route-aware per-unit base fee added on top of (area × rate). Only UV-DTF has one. */
function resolveBaseFee() {
  if (typeof window === "undefined") return 0;
  const path = (window.location.pathname || "").toLowerCase();
  if (path.includes("uv")) return 0.122;
  return 0;
}

/** Route-aware per-unit minimum price (acts as a floor on small sizes). */
function resolveMinUnitPrice() {
  if (typeof window === "undefined") return 0;
  const path = (window.location.pathname || "").toLowerCase();
  if (path.includes("uv")) return 0;       // UV uses base fee model
  if (path.includes("dtf")) return 1.52;   // DTF minimum per transfer
  return 0;
}

export const PRICE_PER_SQIN = resolvePricePerSqIn();
export const BASE_FEE_PER_UNIT = resolveBaseFee();
export const MIN_UNIT_PRICE = resolveMinUnitPrice();
export const PRECUT_FEE = 0.24;
export const DISCOUNT_TIERS = [
  { minSubtotal: 0, discount: 0, buyLabel: "$0.00+", getLabel: "No discount" },
  { minSubtotal: 49, discount: 0.1, buyLabel: "$49.00+", getLabel: "10% Off" },
  { minSubtotal: 99, discount: 0.15, buyLabel: "$99.00+", getLabel: "15% Off" },
  { minSubtotal: 150, discount: 0.2, buyLabel: "$150.00+", getLabel: "20% Off" },
  { minSubtotal: 250, discount: 0.3, buyLabel: "$250.00+", getLabel: "30% Off" },
  { minSubtotal: 500, discount: 0.4, buyLabel: "$500.00+", getLabel: "40% Off" },
  { minSubtotal: 1000, discount: 0.5, buyLabel: "$1,000.00+", getLabel: "50% Off" },
  { minSubtotal: 1750, discount: 0.6, buyLabel: "$1,750.00+", getLabel: "60% Off" },
  { minSubtotal: 3800, discount: 0.65, buyLabel: "$3,800.00+", getLabel: "65% Off" },
];

export const DISCOUNT_TABLE_ROWS = DISCOUNT_TIERS.filter((tier) => tier.discount > 0);

export function getDiscountTierBySubtotal(subtotal = 0) {
  return DISCOUNT_TIERS.reduce((applied, tier) => {
    if (subtotal >= tier.minSubtotal) return tier;
    return applied;
  }, DISCOUNT_TIERS[0]);
}

export const PLACEMENT_CATALOGUE = [
  {
    id: "custom",
    label: "Custom",
    view: "front",
    fabricPos: { x: 0, y: 0.02 },
    fabricScale: 0.25,
    sizes: [],
  },
  {
    id: "full-front",
    label: "Full Front",
    view: "front",
    fabricPos: { x: 0, y: -0.03 },
    fabricScale: 0.25,
    sizes: [
      { id: "adult-xs-s", label: "Adult (XS - S)", w: 10.0, h: 12.0 },
      { id: "adult-m-l", label: "Adult (M - L)", w: 11.0, h: 14.0 },
      { id: "adult-xl", label: "Adult (XL)", w: 12.0, h: 14.0 },
      { id: "adult-xxl", label: "Adult (XXL+)", w: 13.0, h: 15.0 },
      { id: "youth-xs", label: "Youth (XS - M)", w: 8.0, h: 8.0 },
      { id: "toddler", label: "Toddler", w: 6.0, h: 6.0 },
      { id: "infant", label: "Infant", w: 4.0, h: 4.0 },
    ],
  },
  {
    id: "full-back",
    label: "Full Back",
    view: "back",
    fabricPos: { x: 0, y: -0.03 },
    fabricScale: 0.25,
    sizes: [
      { id: "adult-xs-s", label: "Adult (XS - S)", w: 10.0, h: 13.0 },
      { id: "adult-m-l", label: "Adult (M - L)", w: 10.0, h: 13.0 },
      { id: "adult-xl", label: "Adult (XL)", w: 12.0, h: 15.0 },
      { id: "adult-xxl", label: "Adult (XXL+)", w: 12.0, h: 15.0 },
      { id: "youth-xs", label: "Youth (XS - M)", w: 10.0, h: 13.0 },
      { id: "toddler", label: "Toddler", w: 8.0, h: 10.0 },
      { id: "infant", label: "Infant", w: 6.0, h: 8.0 },
    ],
  },
  {
    id: "left-chest",
    label: "Left Chest",
    view: "front",
    fabricPos: { x: 0.1, y: -0.18 },
    fabricScale: 0.14,
    sizes: [
      { id: "adult", label: "Adult", w: 3.5, h: 3.5 },
      { id: "youth", label: "Youth", w: 3.0, h: 3.0 },
      { id: "toddler", label: "Toddler", w: 2.0, h: 2.0 },
      { id: "infant", label: "Infant", w: 1.5, h: 1.5 },
    ],
  },
  {
    id: "sleeve",
    label: "Sleeve",
    view: "side",
    fabricPos: { x: 0.02, y: -0.2 },
    fabricScale: 0.08,
    sizes: [
      { id: "adult", label: "Adult", w: 3.0, h: 3.0 },
      { id: "youth", label: "Youth", w: 2.5, h: 2.5 },
      { id: "toddler", label: "Toddler", w: 2.25, h: 2.25 },
    ],
  },
  {
    id: "back-collar",
    label: "Back Collar",
    view: "back",
    fabricPos: { x: 0, y: -0.3 },
    fabricScale: 0.1,
    sizes: [
      { id: "adult-xs-l", label: "Adult (XS - L)", w: 3.0, h: 3.0 },
      { id: "adult-lplus", label: "Adult (L+)", w: 3.5, h: 3.5 },
      { id: "youth", label: "Youth", w: 2.5, h: 2.5 },
      { id: "toddler", label: "Toddler", w: 2.0, h: 2.0 },
      { id: "infant", label: "Infant", w: 1.75, h: 1.75 },
    ],
  },
];
