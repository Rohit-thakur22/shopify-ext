/**
 * DesignStep2 — Image-first, multi-placement design configuration
 *
 * Placement selector thumbnails use the same Fabric.js canvas rendering
 * as DesignPlacementSlider (same garment images, same design positions).
 *
 * Architecture:
 *  DesignStep2 (orchestrator)
 *  ├── usePricingEngine      (pure pricing hook)
 *  ├── PlacementSelector     (Fabric.js canvas thumbnails, multi-select)
 *  ├── PlacementSection      (per selected placement)
 *  │   ├── SizeCard × N      (predefined sizes + QuantityStepper)
 *  │   └── CustomSizeSection → CustomSizeRow × N
 *  └── PricingSummary        (grand total + volume discount)
 */
import React, {
  useReducer, useCallback, useMemo, memo,
  useEffect, useRef, useState,
} from "react";
import { Canvas, Image, filters } from "fabric";
import {
  PRICE_PER_SQIN,
  PRECUT_FEE,
  BASE_FEE_PER_UNIT,
  MIN_UNIT_PRICE,
  DISCOUNT_TABLE_ROWS,
  PLACEMENT_CATALOGUE,
  getDiscountTierBySubtotal,
} from "../lib/pricingConfig";
import useDisableInteractions from "../hooks/useDisableInteractions";

// ─── Utilities ────────────────────────────────────────────────────────────────
let _seq = 0;
const uid   = () => `csr_${Date.now()}_${++_seq}`;
const fmt   = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toNum = (v, fb = 0) => { const n = parseFloat(v); return isFinite(n) ? n : fb; };
const toInt = (v, fb = 0) => { const n = parseInt(v);   return isFinite(n) ? n : fb; };

// ─── Garment image sources (mirrors DesignPlacementSlider) ────────────────────
const CDN = "https://shopify-ext.vercel.app";

const getGarmentSrc = (view, assetUrls = {}) => ({
  front: CDN + "/assets/6-cloths/full-front.webp",
  back : assetUrls.back  || "/assets/preview-cloths/full-back.webp",
  side : assetUrls.side  || "/assets/preview-cloths/sleeve-1.webp",
}[view] || assetUrls.tshirt || CDN + "/assets/6-cloths/full-front.webp");

// ─── State management ─────────────────────────────────────────────────────────
const ACTIONS = {
  TOGGLE_PLACEMENT       : "TOGGLE_PLACEMENT",
  SET_PREDEFINED_QTY     : "SET_PREDEFINED_QTY",
  ADD_CUSTOM_SIZE        : "ADD_CUSTOM_SIZE",
  UPDATE_CUSTOM_SIZE     : "UPDATE_CUSTOM_SIZE",
  UPDATE_CUSTOM_SIZE_DIMS: "UPDATE_CUSTOM_SIZE_DIMS", // atomic width+height update (aspect-ratio link)
  REMOVE_CUSTOM_SIZE     : "REMOVE_CUSTOM_SIZE",
  FILL_CUSTOM_DIMS       : "FILL_CUSTOM_DIMS",        // auto-fill w/h from uploaded image
};

const mkConfig      = () => ({ predefined: {}, customSizes: [] });
const mkCustomConfig = () => ({ predefined: {}, customSizes: [{ id: uid(), width: "", height: "", quantity: 1 }] });

// Lazy initializer — called once per mount so uid() is always fresh
const makeInitialState = () => ({
  selectedPlacements: ["custom"],
  config: { custom: mkCustomConfig() },
});

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.TOGGLE_PLACEMENT: {
      const { id } = action;
      const on = state.selectedPlacements.includes(id);
      if (on) {
        const { [id]: _r, ...rest } = state.config;
        return { ...state, selectedPlacements: state.selectedPlacements.filter((p) => p !== id), config: rest };
      }
      // "custom" placement always starts with one empty row so fields show immediately
      const newCfg = id === "custom" ? mkCustomConfig() : mkConfig();
      return { ...state, selectedPlacements: [...state.selectedPlacements, id], config: { ...state.config, [id]: newCfg } };
    }
    case ACTIONS.SET_PREDEFINED_QTY: {
      const { placement, sizeId, qty } = action;
      const pc = state.config[placement] ?? mkConfig();
      return { ...state, config: { ...state.config, [placement]: { ...pc, predefined: { ...pc.predefined, [sizeId]: qty } } } };
    }
    case ACTIONS.ADD_CUSTOM_SIZE: {
      const { placement } = action;
      const pc = state.config[placement] ?? mkConfig();
      return { ...state, config: { ...state.config, [placement]: { ...pc, customSizes: [...pc.customSizes, { id: uid(), width: "", height: "", quantity: 1 }] } } };
    }
    case ACTIONS.UPDATE_CUSTOM_SIZE: {
      const { placement, id, field, value } = action;
      const pc = state.config[placement] ?? mkConfig();
      return { ...state, config: { ...state.config, [placement]: { ...pc, customSizes: pc.customSizes.map((r) => r.id === id ? { ...r, [field]: value } : r) } } };
    }
    case ACTIONS.UPDATE_CUSTOM_SIZE_DIMS: {
      // Atomic width+height update so aspect-ratio linking can't desync the two fields
      const { placement, id, width, height } = action;
      const pc = state.config[placement] ?? mkConfig();
      return { ...state, config: { ...state.config, [placement]: { ...pc, customSizes: pc.customSizes.map((r) => r.id === id ? { ...r, width, height } : r) } } };
    }
    case ACTIONS.REMOVE_CUSTOM_SIZE: {
      const { placement, id } = action;
      const pc = state.config[placement] ?? mkConfig();
      return { ...state, config: { ...state.config, [placement]: { ...pc, customSizes: pc.customSizes.filter((r) => r.id !== id) } } };
    }
    case ACTIONS.FILL_CUSTOM_DIMS: {
      // Fill the first custom size row of the given placement with calculated dimensions
      const { placement, width, height } = action;
      const pc = state.config[placement];
      if (!pc || pc.customSizes.length === 0) return state;
      const updated = [{ ...pc.customSizes[0], width, height }, ...pc.customSizes.slice(1)];
      return { ...state, config: { ...state.config, [placement]: { ...pc, customSizes: updated } } };
    }
    default: return state;
  }
}

// ─── Pricing hook ─────────────────────────────────────────────────────────────
function usePricingEngine(config, selectedPlacements, preCut) {
  return useMemo(() => {
    let totalQty = 0, rawTotal = 0;
    const perPlacement = {};

    selectedPlacements.forEach((pid) => {
      const pData = PLACEMENT_CATALOGUE.find((p) => p.id === pid);
      const pc    = config[pid];
      if (!pData || !pc) return;

      let pQty = 0, pRaw = 0;
      // Round per-unit to cents first (matches Shopify's line-item math: unit × qty).
      const toCents = (u) => Math.round(u * 100) / 100;
      const priceUnit = (area) => toCents(Math.max(MIN_UNIT_PRICE, BASE_FEE_PER_UNIT + area * PRICE_PER_SQIN + (preCut ? PRECUT_FEE : 0)));
      pData.sizes.forEach((sz) => {
        const qty = toInt(pc.predefined[sz.id]);
        if (qty > 0) { const u = priceUnit(sz.w * sz.h); pQty += qty; pRaw += u * qty; }
      });
      pc.customSizes.forEach((row) => {
        const w = toNum(row.width), h = toNum(row.height), qty = toInt(row.quantity);
        if (w >= 0.5 && h >= 0.5 && qty > 0) { const u = priceUnit(w * h); pQty += qty; pRaw += u * qty; }
      });

      perPlacement[pid] = { qty: pQty, raw: pRaw };
      totalQty += pQty; rawTotal += pRaw;
    });

    const tier = getDiscountTierBySubtotal(rawTotal);
    const nextTier = DISCOUNT_TABLE_ROWS.find((t) => rawTotal < t.minSubtotal) ?? null;
    return {
      totalQty,
      rawTotal,
      discountedTotal: rawTotal * (1 - tier.discount),
      tier,
      nextTier,
      perPlacement,
    };
  }, [config, selectedPlacements, preCut]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PlacementCard — one card with a Fabric.js canvas thumbnail.
//
// FIX: We never render <canvas> as a React child. Instead we render
// <div ref={containerRef} /> (React sees it as an empty leaf), then
// imperatively create a <canvas> and append it inside via the DOM.
// Fabric.js wraps that canvas in its own divs — but only INSIDE the
// container ref, so React's reconciler never tries to insertBefore a
// node it doesn't own → no more NotFoundError.
// ─────────────────────────────────────────────────────────────────────────────
const CANVAS_W = 130;
const CANVAS_H = 150;

const PlacementCard = memo(function PlacementCard({
  placement, isSelected, onToggle, imageUrl, tintColor, assetUrls,
}) {
  const containerRef = useRef(null); // React never renders children here
  const fcRef        = useRef(null);
  const baseImgRef   = useRef(null);
  const interactionBlockProps = useDisableInteractions({ enabled: true });

  const buildFilters = useCallback((color) => [
    new filters.BlendColor({ color, mode: "multiply", alpha: 0.85 }),
    new filters.Brightness({ brightness: 0.03 }),
    new filters.Blur({ blur: 0.016 }),
    new filters.Contrast({ contrast: 0.02 }),
  ], []);

  // ── Mount: create canvas via DOM API, let Fabric own it entirely ────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // Create canvas element imperatively — React never sees it
    const el = document.createElement("canvas");
    containerRef.current.appendChild(el);

    const fc = new Canvas(el, {
      width: CANVAS_W, height: CANVAS_H,
      backgroundColor: "transparent",
      selection: false, preserveObjectStacking: true,
      enableRetinaScaling: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      skipTargetFind: true,
    });
    fcRef.current = fc;

    // Fabric wraps the canvas in a .canvas-container div and adds an upper-canvas
    // on top. Both intercept pointer/touch events on mobile even with skipTargetFind.
    // Force them fully passive so touch events pass through to React handlers.
    const wrapper = containerRef.current?.querySelector(".canvas-container");
    if (wrapper) {
      wrapper.style.pointerEvents = "none";
      wrapper.style.touchAction   = "none";
    }
    const upperCanvas = containerRef.current?.querySelector(".upper-canvas");
    if (upperCanvas) {
      upperCanvas.style.pointerEvents = "none";
      upperCanvas.style.touchAction   = "none";
    }

    const src = getGarmentSrc(placement.view, assetUrls);
    Image.fromURL(src, { crossOrigin: "anonymous", enableRetinaScaling: true })
      .then((img) => {
        const scale = Math.min(CANVAS_W * 0.99 / img.width, CANVAS_H * 0.99 / img.height) * 1.04;
        img.set({
          left: CANVAS_W / 2, top: CANVAS_H / 2,
          originX: "center", originY: "center",
          selectable: false, evented: false,
          scaleX: scale, scaleY: scale,
        });
        img.filters = buildFilters(tintColor);
        img.applyFilters();
        baseImgRef.current = img;
        fc.add(img);
        fc.renderAll();
      })
      .catch(() => {});

    return () => {
      fc.dispose();
      fcRef.current    = null;
      baseImgRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── Tint update ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = baseImgRef.current;
    const fc  = fcRef.current;
    if (!img || !fc) return;
    img.filters = buildFilters(tintColor);
    img.applyFilters();
    fc.renderAll();
  }, [tintColor, buildFilters]);

  // ── Design logo placement ───────────────────────────────────────────────────
  useEffect(() => {
    const clearLogo = () => {
      const fc = fcRef.current, bi = baseImgRef.current;
      if (!fc || !bi) return;
      fc.getObjects().forEach((o) => { if (o !== bi) fc.remove(o); });
      fc.requestRenderAll();
    };

    if (!imageUrl) { clearLogo(); return; }

    let attempts = 0;
    const tryPlace = () => {
      const fc = fcRef.current, bi = baseImgRef.current;
      if (!fc || !bi) {
        if (++attempts < 30) setTimeout(tryPlace, 80);
        return;
      }
      // Clear old logo first
      fc.getObjects().forEach((o) => { if (o !== bi) fc.remove(o); });

      Image.fromURL(imageUrl, { crossOrigin: "anonymous", enableRetinaScaling: true })
        .then((logo) => {
          const gw = Math.abs(bi.getScaledWidth());
          const gh = Math.abs(bi.getScaledHeight());
          const s  = (gw * placement.fabricScale) / logo.width;
          logo.set({
            originX: "center", originY: "center",
            left: bi.left + placement.fabricPos.x * gw,
            top : bi.top  + placement.fabricPos.y * gh,
            selectable: false, evented: false,
            scaleX: s, scaleY: s,
          });
          fc.add(logo);
          fc.bringToFront(logo);
          fc.requestRenderAll();
        })
        .catch(() => {});
    };
    setTimeout(tryPlace, 80);
  }, [imageUrl, placement, tintColor]);

  return (
    <div
      onClick={onToggle}
      onContextMenu={interactionBlockProps.onContextMenu}
      onDragStart={interactionBlockProps.onDragStart}
      onCopy={interactionBlockProps.onCopy}
      onCut={interactionBlockProps.onCut}
      onSelectStart={interactionBlockProps.onSelectStart}
      style={{
        position: "relative", cursor: "pointer",
        borderRadius: "0.5rem",
        border: isSelected ? "2px solid #7b2cbf" : "2px solid #e5e7eb",
        backgroundColor: isSelected ? "rgba(239,246,255,0.5)" : "#ffffff",
        boxShadow: isSelected ? "0 0 0 3px rgba(37,99,235,0.15)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        padding: "0.375rem",
        display: "flex", flexDirection: "column", alignItems: "center",
        ...interactionBlockProps.style,
      }}
    >
      {/* Checkmark — absolutely positioned, never adjacent to canvas in React tree */}
      {isSelected && (
        <div style={{
          position: "absolute", top: "0.25rem", right: "0.25rem", zIndex: 2,
          width: "1.125rem", height: "1.125rem",
          backgroundColor: "#7b2cbf", borderRadius: "9999px",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      )}

      {/* Fabric-owned canvas mount point — React renders this as an empty leaf */}
      <div
        ref={containerRef}
        style={{ width: CANVAS_W, height: CANVAS_H, flexShrink: 0, cursor: "pointer", pointerEvents: "none" }}
      />

      {/* Label */}
      <p style={{
        margin: "0.25rem 0 0",
        fontSize: "0.6875rem", fontWeight: isSelected ? 700 : 500,
        color: isSelected ? "#7b2cbf" : "#374151",
        textAlign: "center",
      }}>
        {placement.label}
      </p>
    </div>
  );
});

// ── PlacementSelector: thin layout wrapper ────────────────────────────────────
const PlacementSelector = memo(function PlacementSelector({
  selectedPlacements, onToggle, imageUrl, tintColor = "#6b7280", assetUrls = {},
}) {
  const scrollRef           = useRef(null);
  const [arrows, setArrows] = useState({ left: false, right: false });

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setArrows({
      left : el.scrollLeft > 2,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // slight delay so cards have rendered and widths are known
    const t = setTimeout(updateArrows, 80);
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      clearTimeout(t);
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  const scroll = (dir) =>
    scrollRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });

  const arrowBtn = (dir) => {
    const visible = dir === -1 ? arrows.left : arrows.right;
    return (
      <button
        type="button"
        onClick={() => scroll(dir)}
        style={{
          position: "absolute",
          top: "50%", transform: "translateY(-50%)",
          ...(dir === -1 ? { left: "-0.5rem" } : { right: "-0.5rem" }),
          zIndex: 4,
          width: "1.75rem", height: "1.75rem",
          borderRadius: "9999px",
          border: "1px solid #d1d5db",
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.14)",
          cursor: "pointer",
          display: visible ? "flex" : "none",
          alignItems: "center", justifyContent: "center",
          color: "#374151", flexShrink: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {dir === -1 ? <path d="M15 19l-7-7 7-7"/> : <path d="M9 5l7 7-7 7"/>}
        </svg>
      </button>
    );
  };

  return (
    <div style={{ position: "relative", marginBottom: "0.875rem", padding: "0 0.75rem" }}>
      {arrowBtn(-1)}
      <div
        ref={scrollRef}
        style={{
          display: "flex", gap: "0.5rem",
          overflowX: "auto", scrollbarWidth: "none",
          paddingBottom: "0.25rem",
          touchAction: "pan-x",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {PLACEMENT_CATALOGUE.map((placement) => (
          <PlacementCard
            key={placement.id}
            placement={placement}
            isSelected={selectedPlacements.includes(placement.id)}
            onToggle={() => onToggle(placement.id)}
            imageUrl={imageUrl}
            tintColor={tintColor}
            assetUrls={assetUrls}
          />
        ))}
      </div>
      {arrowBtn(1)}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// QuantityStepper
// Sizing is handled via CSS classes (.hq-qty-*) so media queries can make
// the buttons larger on mobile without inline-style overrides.
// ─────────────────────────────────────────────────────────────────────────────
const QuantityStepper = memo(function QuantityStepper({ value, onChange, min = 0, max = 9999, compact = false }) {
  const wrapCls = compact ? "hq-qty-stepper hq-qty-stepper--compact" : "hq-qty-stepper";

  const btn = (act, label) => (
    <button
      type="button"
      onClick={act}
      className="hq-qty-btn"
      style={{ border: "none", backgroundColor: "#f3f4f6", color: "#374151", cursor: "pointer",
               display: "flex", alignItems: "center", justifyContent: "center",
               touchAction: "manipulation", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}
    >{label}</button>
  );

  return (
    <div className={wrapCls} style={{ display: "inline-flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: "0.375rem", overflow: "hidden" }}>
      {btn(() => onChange(Math.max(min, value - 1)), "−")}
      <div className="hq-qty-div" style={{ width: "1px", backgroundColor: "#d1d5db", flexShrink: 0, alignSelf: "stretch" }} />
      <input
        type="number" min={min} max={max}
        value={value === 0 ? "" : value} placeholder="0"
        onChange={(e) => { const v = parseInt(e.target.value); onChange(isFinite(v) ? Math.max(min, Math.min(max, v)) : 0); }}
        className="hq-qty-input"
        style={{ border: "none", textAlign: "center", fontWeight: 600,
                 color: "#111827", backgroundColor: "#ffffff", outline: "none",
                 boxSizing: "border-box", padding: 0, MozAppearance: "textfield",
                 touchAction: "manipulation" }}
      />
      <div className="hq-qty-div" style={{ width: "1px", backgroundColor: "#d1d5db", flexShrink: 0, alignSelf: "stretch" }} />
      {btn(() => onChange(Math.min(max, value + 1)), "+")}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SizeCard
// ─────────────────────────────────────────────────────────────────────────────
const SizeCard = memo(function SizeCard({ size, qty, onQtyChange, preCut }) {
  const active    = qty > 0;
  const unitPrice = Math.round(Math.max(MIN_UNIT_PRICE, BASE_FEE_PER_UNIT + size.w * size.h * PRICE_PER_SQIN + (preCut ? PRECUT_FEE : 0)) * 100) / 100;
  return (
    <div className="hq-size-card" style={{
      flexShrink: 0,
      border: active ? "1.5px solid #7b2cbf" : "1px solid #e5e7eb",
      borderRadius: "0.5rem", padding: "0.75rem 0.5rem 0.625rem",
      backgroundColor: active ? "rgba(238,242,255,0.7)" : "#fafafa",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
      transition: "border-color 0.15s, background-color 0.15s",
      boxSizing: "border-box",
    }}>
      <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#111827", textAlign: "center", lineHeight: 1.3 }}>
        {size.label}
      </p>
      <p style={{ margin: 0, fontSize: "0.6875rem", color: "#6b7280", textAlign: "center" }}>
        {size.w.toFixed(2)}" × {size.h.toFixed(2)}"
      </p>
      <QuantityStepper value={qty} onChange={onQtyChange} compact />
      {active && (
        <p style={{ margin: 0, fontSize: "0.6875rem", fontWeight: 700, color: "#7b2cbf" }}>
          ${fmt(unitPrice * qty)}
        </p>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SizeSlider — horizontally scrollable size cards with prev/next arrows
// ─────────────────────────────────────────────────────────────────────────────
const SizeSlider = memo(function SizeSlider({ sizes, predefined, onSetPredefined, preCut }) {
  const scrollRef       = useRef(null);
  const [arrows, setArrows] = useState({ left: false, right: false });

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setArrows({
      left : el.scrollLeft > 2,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 150, behavior: "smooth" });
  };

  const arrowBtn = (dir, visible) => (
    <button
      type="button"
      onClick={() => scroll(dir)}
      style={{
        position: "absolute",
        top: "50%", transform: "translateY(-50%)",
        ...(dir === -1 ? { left: 0 } : { right: 0 }),
        zIndex: 3,
        width: "1.625rem", height: "1.625rem",
        borderRadius: "9999px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        cursor: "pointer",
        display: visible ? "flex" : "none",
        alignItems: "center", justifyContent: "center",
        color: "#374151",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === -1
          ? <path d="M15 19l-7-7 7-7"/>
          : <path d="M9 5l7 7-7 7"/>
        }
      </svg>
    </button>
  );

  return (
    <div style={{ position: "relative" }}>
      {arrowBtn(-1, arrows.left)}
      <div
        ref={scrollRef}
        style={{
          display: "flex", gap: "0.5rem",
          overflowX: "auto", paddingBottom: "0.25rem",
          scrollbarWidth: "none",
          paddingLeft:  arrows.left  ? "1.75rem" : "0",
          paddingRight: arrows.right ? "1.75rem" : "0",
          transition: "padding 0.15s",
          // Tell the browser this container only scrolls horizontally so it
          // fires tap/click events immediately without the 300ms disambiguation wait
          touchAction: "pan-x",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {sizes.map((size) => (
          <SizeCard
            key={size.id}
            size={size}
            qty={toInt(predefined[size.id])}
            onQtyChange={(qty) => onSetPredefined(size.id, qty)}
            preCut={preCut}
          />
        ))}
      </div>
      {arrowBtn(1, arrows.right)}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CustomSizeRow
// ─────────────────────────────────────────────────────────────────────────────
const CustomSizeRow = memo(function CustomSizeRow({ row, onUpdate, onUpdateDims, onRemove, preCut, imgPixels }) {
  const w   = toNum(row.width);
  const h   = toNum(row.height);
  const qty = toInt(row.quantity);
  const unit  = w >= 0.5 && h >= 0.5 ? Math.round(Math.max(MIN_UNIT_PRICE, BASE_FEE_PER_UNIT + w * h * PRICE_PER_SQIN + (preCut ? PRECUT_FEE : 0)) * 100) / 100 : 0;
  const total = unit * qty;

  const MAX_IN = 22.5;
  const MIN_IN = 0.5;
  const STEP_IN = 0.5;

  const clamp = (n) => Math.min(MAX_IN, Math.max(MIN_IN, n));
  // Round to 2 decimals to avoid floating-point dust like 1.4000000000000001
  const roundDim = (n) => Math.round(n * 100) / 100;

  // Aspect ratio of the uploaded design (width / height in pixels). When
  // available, editing one dimension auto-adjusts the other so the user's
  // chosen size always matches the original image proportions.
  const aspectRatio = (imgPixels && imgPixels.w > 0 && imgPixels.h > 0)
    ? imgPixels.w / imgPixels.h
    : null;

  /**
   * Apply a new value to one dimension and (when locked to the image's
   * aspect ratio) recompute the linked dimension. Both fields update in
   * a single dispatch so width/height never desync.
   */
  const applyDim = (field, value) => {
    const clamped = clamp(value);
    if (aspectRatio && onUpdateDims) {
      let newW;
      let newH;
      if (field === "width") {
        newW = clamped;
        newH = clamp(clamped / aspectRatio);
      } else {
        newH = clamped;
        newW = clamp(clamped * aspectRatio);
      }
      onUpdateDims(String(roundDim(newW)), String(roundDim(newH)));
    } else {
      onUpdate(field, String(roundDim(clamped)));
    }
  };

  const stepDim = (field, dir) => {
    const current = parseFloat(row[field]);
    const base = isFinite(current) ? current : MIN_IN;
    applyDim(field, base + dir * STEP_IN);
  };

  const stepBtn = (field, dir, label) => (
    <button
      type="button"
      onClick={() => stepDim(field, dir)}
      aria-label={`${dir > 0 ? "Increase" : "Decrease"} ${field}`}
      className="hq-dim-step-btn"
      style={{
        border: "1px solid #d1d5db", backgroundColor: "#f3f4f6", color: "#374151",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 600, flexShrink: 0, touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
    </button>
  );

  const numField = (label, field, placeholder) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: "0 0 0.25rem", fontSize: "0.6875rem", fontWeight: 600, color: "#6b7280" }}>{label}</p>
      <div className="hq-dim-stepper" style={{ display: "flex", alignItems: "stretch", borderRadius: "0.375rem", overflow: "hidden", border: "1px solid #d1d5db", backgroundColor: "#fff" }}>
        {stepBtn(field, -1, "−")}
        <input
          type="number" min={MIN_IN} max={MAX_IN} step={0.01}
          placeholder={placeholder} value={row[field]}
          onChange={(e) => {
            const raw = e.target.value;
            // Allow free typing; clamp only on valid numbers
            const n = parseFloat(raw);
            if (raw === "" || raw === "-") { onUpdate(field, raw); return; }
            if (isFinite(n)) applyDim(field, n);
          }}
          className="hq-dim-input"
          style={{
            flex: 1, minWidth: 0, border: "none",
            textAlign: "center", fontSize: "0.875rem",
            color: "#111827", backgroundColor: "transparent",
            outline: "none", padding: 0, MozAppearance: "textfield",
            boxSizing: "border-box", touchAction: "manipulation",
          }}
        />
        {stepBtn(field, 1, "+")}
      </div>
    </div>
  );

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0.5rem",
      padding: "0.75rem", backgroundColor: "#f9fafb",
      borderRadius: "0.5rem", border: "1px solid #e5e7eb",
    }}>
      {numField("Width (in)", "width", "e.g. 10")}
      {numField("Height (in)", "height", "e.g. 8")}
      <div>
        <p style={{ margin: "0 0 0.25rem", fontSize: "0.6875rem", fontWeight: 600, color: "#6b7280" }}>Qty</p>
        <QuantityStepper value={qty} onChange={(v) => onUpdate("quantity", v)} min={1} compact />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", marginLeft: "auto" }}>
        <button type="button" onClick={onRemove} title="Remove" style={{
          width: "1.75rem", height: "1.75rem", borderRadius: "0.375rem",
          border: "1px solid #fca5a5", backgroundColor: "#fff5f5",
          color: "#ef4444", cursor: "pointer", fontSize: "0.875rem", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>×</button>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: total > 0 ? "#7b2cbf" : "#9ca3af", whiteSpace: "nowrap" }}>
          {total > 0 ? `$${fmt(total)}` : "—"}
        </span>
      </div>
      {/* Dynamic DPI warning: show when selected size exceeds image resolution at 300 DPI */}
      {(() => {
        if (!imgPixels || imgPixels.w === 0 || w < 0.5 || h < 0.5) return null;
        const dpiW = imgPixels.w / w;
        const dpiH = imgPixels.h / h;
        const effectiveDpi = Math.min(dpiW, dpiH);
        if (effectiveDpi >= 300) return null;
        const severity = effectiveDpi < 150 ? "high" : "medium";
        return (
          <div style={{
            width: "100%", display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.375rem 0.5rem", borderRadius: "0.375rem",
            backgroundColor: severity === "high" ? "#fef2f2" : "#fffbeb",
            border: `1px solid ${severity === "high" ? "#fecaca" : "#fde68a"}`,
            marginTop: "0.125rem",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={severity === "high" ? "#dc2626" : "#d97706"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{
              fontSize: "0.6875rem", color: severity === "high" ? "#991b1b" : "#92400e",
              lineHeight: 1.3,
            }}>
              {severity === "high"
                ? `Image may appear blurry at this size (~${Math.round(effectiveDpi)} DPI). Use Enhance or reduce dimensions.`
                : `Print quality may be reduced at this size (~${Math.round(effectiveDpi)} DPI). Consider using Enhance.`
              }
            </span>
          </div>
        );
      })()}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PlacementSection
// Rules:
//   • Placements with predefined sizes (Full Front, Full Back, etc.) show
//     only the SizeSlider — no custom-size option.
//   • The "Custom" placement (sizes: []) shows only custom-size rows.
// ─────────────────────────────────────────────────────────────────────────────
const PlacementSection = memo(function PlacementSection({
  placement, pConfig, onSetPredefined, onAddCustom,
  onUpdateCustom, onUpdateCustomDims, onRemoveCustom, onClose, preCut, pricingData, imgPixels,
}) {
  const isCustomPlacement = placement.id === "custom";
  const hasPredefined     = placement.sizes.length > 0;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.75rem", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.5rem 0.875rem", backgroundColor: "#ffffff", borderBottom: "1px solid #f3f4f6",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center",
          backgroundColor: "#0a1172", color: "#ffffff",
          fontSize: "0.8125rem", fontWeight: 700,
          padding: "0.1875rem 0.75rem", borderRadius: "9999px",
        }}>
          {placement.label}
        </span>
        <button type="button" onClick={onClose} title={`Remove ${placement.label}`} style={{
          width: "1.75rem", height: "1.75rem", borderRadius: "9999px",
          border: "none", backgroundColor: "transparent",
          cursor: "pointer", color: "#9ca3af", fontSize: "1.125rem",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>
      </div>

      {/* ── Predefined size slider (non-custom placements only) ── */}
      {hasPredefined && !isCustomPlacement && (
        <div style={{ padding: "0.875rem 0.875rem 0.75rem", backgroundColor: "#ffffff" }}>
          <SizeSlider
            sizes={placement.sizes}
            predefined={pConfig.predefined}
            onSetPredefined={onSetPredefined}
            preCut={preCut}
          />
        </div>
      )}

      {/* ── Custom size section (Custom placement only) ── */}
      {isCustomPlacement && (
        <div style={{ padding: "0.75rem 0.875rem", backgroundColor: "#ffffff" }}>

          {/* Auto-fill hint */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.625rem" }}>
            <svg style={{ width: "0.8rem", height: "0.8rem", flexShrink: 0, color: "#7b2cbf" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            <p style={{ margin: 0, fontSize: "0.6875rem", color: "#7b2cbf" }}>
              Size auto-calculated from your image at 300 DPI — edit if needed
            </p>
          </div>

          {pConfig.customSizes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {pConfig.customSizes.map((row) => (
                <CustomSizeRow
                  key={row.id} row={row}
                  onUpdate={(field, value) => onUpdateCustom(row.id, field, value)}
                  onUpdateDims={(width, height) => onUpdateCustomDims(row.id, width, height)}
                  onRemove={() => onRemoveCustom(row.id)}
                  preCut={preCut}
                  imgPixels={imgPixels}
                />
              ))}
            </div>
          )}

          {/* Fallback: shown only if user manually removed the row */}
          {pConfig.customSizes.length === 0 && (
            <button type="button" onClick={onAddCustom} style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem",
              fontSize: "0.8125rem", fontWeight: 600, color: "#7b2cbf",
              backgroundColor: "transparent", border: "none", cursor: "pointer", padding: 0,
              touchAction: "manipulation",
            }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "1.25rem", height: "1.25rem", borderRadius: "9999px",
                border: "1.5px solid #7b2cbf", fontSize: "0.875rem", fontWeight: 700, lineHeight: 1,
              }}>+</span>
              Add a size
            </button>
          )}
        </div>
      )}

      {/* ── Footer: transfers + sizing guide ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.5rem 0.875rem", backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb",
      }}>
        <span style={{ fontSize: "0.875rem", color: "#374151" }}>
          <strong style={{ fontWeight: 700 }}>{pricingData?.qty ?? 0} Transfers: </strong>
          <span style={{ fontWeight: 700, color: (pricingData?.qty ?? 0) > 0 ? "#7b2cbf" : "#d1d5db" }}>
            ${fmt(pricingData?.raw ?? 0)}
          </span>
        </span>
        {!isCustomPlacement && (
          <button type="button" style={{
            background: "none", border: "none", padding: 0,
            fontSize: "0.75rem", color: "#7b2cbf", textDecoration: "underline", cursor: "pointer",
          }}>
            Our Sizing Guide
          </button>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PricingSummary
// ─────────────────────────────────────────────────────────────────────────────
const PricingSummary = memo(function PricingSummary({
  totalQty,
  rawTotal,
  discountedTotal,
  tier,
  nextTier,
}) {
  if (totalQty === 0) return null;
  return (
    <div style={{ marginTop: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      {nextTier && (
        <div style={{ padding: "0.5rem 0.875rem", backgroundColor: "#fdf4ff", borderBottom: "1px solid #e9d5ff", fontSize: "0.75rem", color: "#7b2cbf", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <svg style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.73V17a1 1 0 001 1h6a1 1 0 001-1v-2.27A7 7 0 0012 2z"/>
          </svg>
          Add ${fmt(nextTier.minSubtotal - rawTotal)} more to unlock {nextTier.getLabel}
        </div>
      )}
      {tier.discount > 0 && (
        <div style={{
          padding: "0.5rem 0.875rem", backgroundColor: "#f0fdf4", borderBottom: "1px solid #bbf7d0",
          fontSize: "0.75rem", color: "#166534", fontWeight: 600,
          display: "flex", alignItems: "center", gap: "0.375rem",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {(tier.discount * 100).toFixed(0)}% volume discount — you save ${fmt(rawTotal - discountedTotal)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0.875rem", backgroundColor: "#f8fafc" }}>
        <div>
          <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#1e293b" }}>
            {totalQty} Transfer{totalQty !== 1 ? "s" : ""}
          </span>
          {tier.discount > 0 && (
            <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#94a3b8", textDecoration: "line-through" }}>
              ${fmt(rawTotal)}
            </span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#7b2cbf", letterSpacing: "-0.025em" }}>
            ${fmt(discountedTotal)}
          </span>
          {tier.discount > 0 && (
            <p style={{ margin: "0.0625rem 0 0", fontSize: "0.6875rem", color: "#059669", fontWeight: 700 }}>
              {(tier.discount * 100).toFixed(0)}% off applied
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Props:
 *   preCut    – boolean          pre-cut fee per transfer
 *   imageUrl  – string | null    uploaded design (passed to Fabric canvases)
 *   tintColor – string           garment tint colour (hex)
 *   assetUrls – object           { back, side, tshirt } from Shopify CDN
 *   onChange  – fn               ({ width, height, quantity, sizeBreakdown, totalPrice }) => void
 */
const DesignStep2 = ({
  preCut    = false,
  imageUrl  = null,
  tintColor = "#6b7280",
  assetUrls = {},
  onChange,
  hidePlacementSelector = false,
}) => {
  const [state, dispatch] = useReducer(reducer, null, makeInitialState);
  const pricing = usePricingEngine(state.config, state.selectedPlacements, preCut);

  // Track uploaded image's pixel dimensions for dynamic DPI checks
  const [imgPixels, setImgPixels] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!imageUrl) { setImgPixels({ w: 0, h: 0 }); return; }
    const img = new window.Image();
    img.onload = () => setImgPixels({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setImgPixels({ w: 0, h: 0 });
    img.src = imageUrl;
  }, [imageUrl]);

  // ── Auto-fill custom size dimensions from the uploaded image ────────────────
  const autoFillDims = useCallback(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    img.onload = () => {
      const DPI = 300; // DTF standard print resolution
      dispatch({
        type     : ACTIONS.FILL_CUSTOM_DIMS,
        placement: "custom",
        width    : (img.naturalWidth  / DPI).toFixed(2),
        height   : (img.naturalHeight / DPI).toFixed(2),
      });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Re-run whenever the uploaded image changes
  useEffect(() => { autoFillDims(); }, [autoFillDims]);

  // Re-run when "custom" placement is re-selected (toggled back on)
  const prevPlacementsRef = useRef(state.selectedPlacements);
  useEffect(() => {
    const prev = prevPlacementsRef.current;
    prevPlacementsRef.current = state.selectedPlacements;
    if (!prev.includes("custom") && state.selectedPlacements.includes("custom")) {
      autoFillDims();
    }
  }, [state.selectedPlacements, autoFillDims]);

  // Notify parent on every pricing change
  useEffect(() => {
    if (!onChange) return;
    let maxArea = -1, pWidth = 0, pHeight = 0;
    state.selectedPlacements.forEach((pid) => {
      const p  = PLACEMENT_CATALOGUE.find((x) => x.id === pid);
      const pc = state.config[pid];
      if (!p || !pc) return;
      p.sizes.forEach((sz) => {
        const qty = toInt(pc.predefined[sz.id]);
        if (qty > 0 && sz.w * sz.h > maxArea) { maxArea = sz.w * sz.h; pWidth = sz.w; pHeight = sz.h; }
      });
      pc.customSizes.forEach((row) => {
        const w = toNum(row.width), h = toNum(row.height), qty = toInt(row.quantity);
        if (qty > 0 && w * h > maxArea) { maxArea = w * h; pWidth = w; pHeight = h; }
      });
    });
    onChange({ width: pWidth, height: pHeight, quantity: pricing.totalQty, sizeBreakdown: state.config, totalPrice: pricing.discountedTotal });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing]);

  // Action dispatchers
  const togglePlacement  = useCallback((id) => dispatch({ type: ACTIONS.TOGGLE_PLACEMENT, id }), []);
  const setPredefinedQty = useCallback((placement, sizeId, qty) => dispatch({ type: ACTIONS.SET_PREDEFINED_QTY, placement, sizeId, qty }), []);
  const addCustomSize    = useCallback((placement) => dispatch({ type: ACTIONS.ADD_CUSTOM_SIZE, placement }), []);
  const updateCustomSize = useCallback((placement, id, field, value) => dispatch({ type: ACTIONS.UPDATE_CUSTOM_SIZE, placement, id, field, value }), []);
  const updateCustomSizeDims = useCallback((placement, id, width, height) => dispatch({ type: ACTIONS.UPDATE_CUSTOM_SIZE_DIMS, placement, id, width, height }), []);
  const removeCustomSize = useCallback((placement, id) => dispatch({ type: ACTIONS.REMOVE_CUSTOM_SIZE, placement, id }), []);

  return (
    <div style={{ fontFamily: "inherit" }}>

      <p style={{ margin: "0 0 0.625rem", fontSize: "0.75rem", color: "#ef4444" }}>
        *Some sizes are unavailable. Minimum size is 1 inch.
      </p>

      {/* Placement selector — Fabric.js canvas thumbnails */}
      {!hidePlacementSelector && (
        <PlacementSelector
          selectedPlacements={state.selectedPlacements}
          onToggle={togglePlacement}
          imageUrl={imageUrl}
          tintColor={tintColor}
          assetUrls={assetUrls}
        />
      )}

      {/* Empty state */}
      {state.selectedPlacements.length === 0 && (
        <div style={{
          padding: "2rem 1rem", textAlign: "center",
          backgroundColor: "#f9fafb", borderRadius: "0.75rem",
          border: "1.5px dashed #d1d5db", marginTop: "0.75rem",
        }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#9ca3af" }}>
            Select one or more placements above to configure sizes &amp; quantities
          </p>
        </div>
      )}

      {/* Placement section cards */}
      {state.selectedPlacements.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginTop: "0.875rem" }}>
          {state.selectedPlacements.map((pid) => {
            const placement = PLACEMENT_CATALOGUE.find((p) => p.id === pid);
            const pConfig   = state.config[pid];
            if (!placement || !pConfig) return null;
            return (
              <PlacementSection
                key={pid}
                placement={placement}
                pConfig={pConfig}
                onSetPredefined={(sizeId, qty) => setPredefinedQty(pid, sizeId, qty)}
                onAddCustom={() => addCustomSize(pid)}
                onUpdateCustom={(id, field, value) => updateCustomSize(pid, id, field, value)}
                onUpdateCustomDims={(id, width, height) => updateCustomSizeDims(pid, id, width, height)}
                onRemoveCustom={(id) => removeCustomSize(pid, id)}
                onClose={() => togglePlacement(pid)}
                preCut={preCut}
                pricingData={pricing.perPlacement[pid]}
                imgPixels={imgPixels}
              />
            );
          })}
        </div>
      )}

      {/* Grand total */}
      <PricingSummary
        totalQty={pricing.totalQty}
        rawTotal={pricing.rawTotal}
        discountedTotal={pricing.discountedTotal}
        tier={pricing.tier}
        nextTier={pricing.nextTier}
      />

      <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "#9ca3af", textAlign: "center" }}>
        Padding for easy cutting is added for free
      </p>

      <style>{`
        /* ── Hide number-input spinners ── */
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

        /* ── QuantityStepper — desktop defaults ── */
        .hq-qty-btn  { min-width: 1.875rem; height: 1.875rem; font-size: 1rem; font-weight: 500; }
        .hq-qty-input{ width: 2.375rem;     height: 1.875rem; font-size: 0.875rem; }

        /* ── SizeCard — desktop: fixed narrow width ── */
        .hq-size-card { width: 118px; }

        /* ── Dimension inputs (CustomSizeRow) ── */
        .hq-dim-input { height: 2rem; }
        .hq-dim-stepper { height: 2rem; }
        .hq-dim-step-btn { width: 1.875rem; height: 100%; font-size: 1rem; }
        .hq-dim-step-btn:first-child { border-right: 1px solid #d1d5db; }
        .hq-dim-step-btn:last-child  { border-left: 1px solid #d1d5db; }

        /* ── Mobile (≤ 640 px) ── */
        @media (max-width: 640px) {
          /* Stepper: 44 px touch targets */
          .hq-qty-btn   { min-width: 2.75rem; height: 2.75rem; font-size: 1.125rem; }
          .hq-qty-input { width: 2.75rem;     height: 2.75rem; font-size: 0.9375rem; }

          /* SizeCard: grow to fit the bigger stepper */
          .hq-size-card { width: auto; min-width: 140px; }

          /* Dimension inputs: taller for touch */
          .hq-dim-input { height: 2.75rem; font-size: 1rem; }
          .hq-dim-stepper { height: 2.75rem; }
          .hq-dim-step-btn { width: 2.75rem; font-size: 1.125rem; }
        }
      `}</style>
    </div>
  );
};

export default DesignStep2;
