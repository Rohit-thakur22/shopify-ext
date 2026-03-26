export const PRICE_PER_SQIN = 0.0416;
export const PRECUT_FEE = 0.24;
export const DISCOUNT_TIERS = [
  { minQty: 1, maxQty: 14, discount: 0 },
  { minQty: 15, maxQty: 49, discount: 0.2 },
  { minQty: 50, maxQty: 99, discount: 0.3 },
  { minQty: 100, maxQty: 249, discount: 0.4 },
  { minQty: 250, maxQty: Infinity, discount: 0.5 },
];

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
      { id: "adult-xs-s", label: "Adult (XS - S)", w: 10.0, h: 6.63 },
      { id: "adult-m-l", label: "Adult (M - L)", w: 11.0, h: 7.29 },
      { id: "adult-xl", label: "Adult (XL)", w: 12.0, h: 7.95 },
      { id: "adult-xxl", label: "Adult (XXL+)", w: 13.0, h: 8.62 },
      { id: "youth-xs", label: "Youth (XS - M)", w: 7.0, h: 4.64 },
      { id: "toddler", label: "Toddler", w: 5.0, h: 3.31 },
      { id: "infant", label: "Infant", w: 4.0, h: 2.65 },
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
      { id: "adult-m-l", label: "Adult (M - L)", w: 11.0, h: 14.0 },
      { id: "adult-xl", label: "Adult (XL)", w: 12.0, h: 15.0 },
      { id: "adult-xxl", label: "Adult (XXL+)", w: 13.0, h: 16.0 },
      { id: "youth-xs", label: "Youth (XS - M)", w: 7.5, h: 9.5 },
      { id: "toddler", label: "Toddler", w: 6.0, h: 7.5 },
      { id: "infant", label: "Infant", w: 4.0, h: 5.0 },
    ],
  },
  {
    id: "left-chest",
    label: "Left Chest",
    view: "front",
    fabricPos: { x: 0.1, y: -0.18 },
    fabricScale: 0.14,
    sizes: [
      { id: "adult", label: "Adult", w: 4.0, h: 4.0 },
      { id: "youth", label: "Youth", w: 3.5, h: 3.5 },
      { id: "toddler", label: "Toddler", w: 2.75, h: 2.75 },
      { id: "infant", label: "Infant", w: 2.0, h: 2.0 },
    ],
  },
  {
    id: "sleeve",
    label: "Sleeve",
    view: "side",
    fabricPos: { x: 0.02, y: -0.2 },
    fabricScale: 0.08,
    sizes: [
      { id: "adult", label: "Adult", w: 4.5, h: 4.5 },
      { id: "youth", label: "Youth", w: 3.5, h: 3.5 },
      { id: "toddler", label: "Toddler", w: 2.75, h: 2.75 },
    ],
  },
  {
    id: "back-collar",
    label: "Back Collar",
    view: "back",
    fabricPos: { x: 0, y: -0.3 },
    fabricScale: 0.1,
    sizes: [
      { id: "adult-xs-l", label: "Adult (XS - L)", w: 3.0, h: 1.99 },
      { id: "adult-lplus", label: "Adult (L+)", w: 3.5, h: 2.32 },
      { id: "youth", label: "Youth", w: 2.5, h: 1.66 },
      { id: "toddler", label: "Toddler", w: 2.0, h: 1.33 },
      { id: "infant", label: "Infant", w: 1.75, h: 1.16 },
    ],
  },
];
