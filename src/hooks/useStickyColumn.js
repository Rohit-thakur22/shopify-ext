import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Walk up from `el` to the document scroll root and force every ancestor
 * to `overflow: visible` so that `position: sticky` works inside Shopify
 * storefronts where themes set overflow:hidden on wrapper elements.
 * Returns a cleanup function that restores original values.
 */
function unlockStickyAncestors(el) {
  const originals = [];
  let node = el?.parentElement;
  while (node && node !== document.documentElement) {
    const computed = window.getComputedStyle(node);
    const ov = computed.overflow;
    const ovX = computed.overflowX;
    const ovY = computed.overflowY;
    if (ov !== "visible" || ovX !== "visible" || ovY !== "visible") {
      originals.push({
        node,
        overflow: node.style.overflow,
        overflowX: node.style.overflowX,
        overflowY: node.style.overflowY,
      });
      node.style.overflow = "visible";
      node.style.overflowX = "visible";
      node.style.overflowY = "visible";
    }
    node = node.parentElement;
  }
  return () => {
    for (const { node: n, overflow, overflowX, overflowY } of originals) {
      n.style.overflow = overflow;
      n.style.overflowX = overflowX;
      n.style.overflowY = overflowY;
    }
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const FALLBACK_TOP_GAP = 20;
const BOTTOM_GAP = 20;

const PIN_TOP = 0;
const PIN_BOTTOM = 1;
const NATURAL = 2;

// ─── Shopify header detection ──────────────────────────────────────────────────
// Many Shopify themes render a fixed/sticky header bar (sometimes with an
// announcement bar on top). If we pin at top:20px the column hides behind it.
// Detect these bars and return the correct gap so the column sits below them.
const HEADER_SELECTORS = [
  "header",
  "[role='banner']",
  ".header",
  ".site-header",
  ".header-wrapper",
  ".header__wrapper",
  ".announcement-bar",
  ".section-header",
  "#shopify-section-header",
  "#shopify-section-announcement-bar",
  "#header",
];

function detectTopGap() {
  if (typeof document === "undefined") return FALLBACK_TOP_GAP;
  let maxBottom = 0;
  for (const sel of HEADER_SELECTORS) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const cs = window.getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") continue;
        const r = el.getBoundingClientRect();
        if (r.top > 10 || r.height <= 0 || r.height > 200) continue;
        maxBottom = Math.max(maxBottom, r.bottom);
      }
    } catch (_) {
      /* invalid selector — skip */
    }
  }
  return maxBottom > 0 ? Math.ceil(maxBottom) + 10 : FALLBACK_TOP_GAP;
}

/**
 * Bidirectional sticky column for two-column flex layouts.
 *
 * The shorter column scrolls through its full content, then sticks:
 *
 *   ↓ Scroll down — column scrolls naturally until its bottom edge meets
 *     the viewport bottom, then pins there. The longer column continues
 *     scrolling freely ("waits" for the shorter one to finish).
 *
 *   ↑ Scroll up — column scrolls naturally until its top edge meets the
 *     viewport top, then pins there.
 *
 * Transitions are seamless — each mode switch preserves the element's
 * exact visual position so there are zero visual jumps.
 *
 * Works inside Shopify storefronts:
 *  • forces overflow:visible on ancestors for sticky to work
 *  • auto-detects fixed/sticky header bars and offsets below them
 *  • handles flex-wrap, resize, dynamic content via ResizeObserver
 *  • -webkit-sticky prefix for older Safari
 */
export default function useStickyColumn({
  parentRef,
  leftRef,
  rightRef,
  mobileBreakpoint = 768,
}) {
  const [stickySide, setStickySide] = useState(null);

  const sideRef = useRef(null);
  const modeRef = useRef(PIN_TOP);
  const lastParentTopRef = useRef(0);
  const topGapRef = useRef(FALLBACK_TOP_GAP);
  const unlockRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const measuringRef = useRef(false);

  // ─── Style helpers ───────────────────────────────────────────────────────────
  const setPos = useCallback((el, pos, top) => {
    if (!el) return;
    if (pos === "sticky") {
      // Set -webkit-sticky first; browsers that only support the prefix keep
      // it, browsers that support unprefixed overwrite it on the next call.
      el.style.setProperty("position", "-webkit-sticky", "important");
      el.style.setProperty("position", "sticky", "important");
    } else {
      el.style.setProperty("position", pos, "important");
    }
    el.style.setProperty("top", top + "px", "important");
  }, []);

  const clearPos = useCallback((el) => {
    if (!el) return;
    el.style.removeProperty("position");
    el.style.removeProperty("top");
  }, []);

  // ─── Full measurement: pick shorter column, reset state machine ──────────────
  const measure = useCallback(() => {
    if (typeof window === "undefined") return;
    measuringRef.current = true;

    const leftEl = leftRef?.current;
    const rightEl = rightRef?.current;

    if (!leftEl || !rightEl) {
      measuringRef.current = false;
      return;
    }

    // Mobile — disable entirely
    if (window.innerWidth < mobileBreakpoint) {
      clearPos(leftEl);
      clearPos(rightEl);
      leftEl.classList.remove("sticky");
      rightEl.classList.remove("sticky");
      sideRef.current = null;
      setStickySide(null);
      if (unlockRef.current) {
        unlockRef.current();
        unlockRef.current = null;
      }
      measuringRef.current = false;
      return;
    }

    // Temporarily clear positioning to read true flow heights.
    // All three steps (clear → read → re-apply) run synchronously so
    // the browser never paints the intermediate state.
    clearPos(leftEl);
    clearPos(rightEl);
    leftEl.classList.remove("sticky");
    rightEl.classList.remove("sticky");

    const leftR = leftEl.getBoundingClientRect();
    const rightR = rightEl.getBoundingClientRect();

    // Columns are stacked (flex-wrap kicked in) — disable
    if (Math.abs(leftR.top - rightR.top) > 50) {
      sideRef.current = null;
      setStickySide(null);
      if (unlockRef.current) {
        unlockRef.current();
        unlockRef.current = null;
      }
      measuringRef.current = false;
      return;
    }

    const leftH = leftR.height;
    const rightH = rightR.height;

    // Nearly equal height — no sticky needed
    if (Math.abs(leftH - rightH) < 5) {
      sideRef.current = null;
      setStickySide(null);
      if (unlockRef.current) {
        unlockRef.current();
        unlockRef.current = null;
      }
      measuringRef.current = false;
      return;
    }

    const side = leftH <= rightH ? "left" : "right";
    const stickyEl = side === "left" ? leftEl : rightEl;
    const otherEl = side === "left" ? rightEl : leftEl;

    sideRef.current = side;
    setStickySide(side);

    clearPos(otherEl);
    otherEl.classList.remove("sticky");

    // Detect Shopify fixed/sticky headers for correct top offset
    topGapRef.current = detectTopGap();

    // Initial state: pin at viewport top
    stickyEl.classList.add("sticky");
    setPos(stickyEl, "sticky", topGapRef.current);
    modeRef.current = PIN_TOP;

    if (parentRef?.current) {
      lastParentTopRef.current =
        parentRef.current.getBoundingClientRect().top;
    }

    // Unlock ancestors so sticky works inside Shopify theme wrappers
    if (unlockRef.current) unlockRef.current();
    unlockRef.current = unlockStickyAncestors(stickyEl);

    measuringRef.current = false;
  }, [leftRef, rightRef, parentRef, mobileBreakpoint, setPos, clearPos]);

  // ─── Lightweight check for ResizeObserver (avoids visual flash) ──────────────
  // Only triggers a full measure() when the shorter side actually changes.
  // Content-height changes within the same side are handled dynamically by the
  // scroll handler (it reads offsetHeight each frame).
  const lightCheck = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < mobileBreakpoint) {
      measure();
      return;
    }

    const leftEl = leftRef?.current;
    const rightEl = rightRef?.current;
    if (!leftEl || !rightEl) return;

    // scrollHeight gives content height without being affected by position
    const leftH = leftEl.scrollHeight;
    const rightH = rightEl.scrollHeight;

    // Check if columns are stacked (approximate via offset comparison)
    if (
      Math.abs(leftEl.getBoundingClientRect().left - rightEl.getBoundingClientRect().left) < 10 &&
      Math.abs(leftEl.getBoundingClientRect().top - rightEl.getBoundingClientRect().top) > 50
    ) {
      if (sideRef.current !== null) measure();
      return;
    }

    // If heights are nearly equal, disable sticky
    if (Math.abs(leftH - rightH) < 5) {
      if (sideRef.current !== null) measure();
      return;
    }

    const newSide = leftH <= rightH ? "left" : "right";

    if (newSide !== sideRef.current) {
      // Side changed — need full reset
      measure();
    }
    // If same side, do nothing — scroll handler adapts to height changes
  }, [leftRef, rightRef, mobileBreakpoint, measure]);

  // ─── Scroll handler: 3-state machine ─────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (measuringRef.current) return;
      if (typeof window === "undefined") return;
      if (window.innerWidth < mobileBreakpoint) return;

      const side = sideRef.current;
      if (!side) return;

      const stickyEl =
        side === "left" ? leftRef?.current : rightRef?.current;
      const parentEl = parentRef?.current;
      if (!stickyEl || !parentEl) return;

      // Detect scroll direction via parent's viewport position.
      // Using getBoundingClientRect instead of window.scrollY so this works
      // with any scroll container (Shopify inner wrappers, etc.).
      const parentTop = parentEl.getBoundingClientRect().top;
      const delta = lastParentTopRef.current - parentTop;
      lastParentTopRef.current = parentTop;

      if (Math.abs(delta) < 0.5) return;

      const viewH = window.innerHeight;
      const rect = stickyEl.getBoundingClientRect();
      const sideH = rect.height;
      const down = delta > 0;
      const mode = modeRef.current;
      const topGap = topGapRef.current;

      // If the column fits within the viewport, simple top-pin suffices
      if (sideH + topGap + BOTTOM_GAP <= viewH) {
        if (mode !== PIN_TOP) {
          setPos(stickyEl, "sticky", topGap);
          modeRef.current = PIN_TOP;
        }
        return;
      }

      // Clamp helper: keep relTop within valid bounds so the element
      // never extends past the parent container's edges.
      const parentH = parentEl.getBoundingClientRect().height;
      const clamp = (v) => Math.max(0, Math.min(v, parentH - sideH));

      if (mode === PIN_TOP && down) {
        // ─── Pinned at top, user scrolls down → release into natural scroll
        setPos(stickyEl, "relative", clamp(rect.top - parentTop));
        modeRef.current = NATURAL;
      } else if (mode === PIN_BOTTOM && !down) {
        // ─── Pinned at bottom, user scrolls up → release into natural scroll
        setPos(stickyEl, "relative", clamp(rect.top - parentTop));
        modeRef.current = NATURAL;
      } else if (mode === NATURAL) {
        if (down && rect.bottom <= viewH - BOTTOM_GAP) {
          // Column bottom reached viewport bottom → pin at bottom
          setPos(stickyEl, "sticky", viewH - sideH - BOTTOM_GAP);
          modeRef.current = PIN_BOTTOM;
        } else if (!down && rect.top >= topGap) {
          // Column top reached viewport top → pin at top
          // Re-detect header in case it appeared/changed (e.g. Shopify sticky header)
          topGapRef.current = detectTopGap();
          setPos(stickyEl, "sticky", topGapRef.current);
          modeRef.current = PIN_TOP;
        }
      }
    };

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [leftRef, rightRef, parentRef, mobileBreakpoint, setPos]);

  // ─── Observers: initial measurement + resize + content changes ───────────────
  useEffect(() => {
    measure();

    const onResize = () => {
      clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(measure, 100);
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });

    // ResizeObserver uses lightCheck to avoid full resets when only content
    // height changed but the shorter side is the same.
    const ro = new ResizeObserver(() => {
      clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(lightCheck, 60);
    });
    if (leftRef?.current) ro.observe(leftRef.current);
    if (rightRef?.current) ro.observe(rightRef.current);
    if (parentRef?.current) ro.observe(parentRef.current);

    return () => {
      clearTimeout(timerRef.current);
      if (unlockRef.current) {
        unlockRef.current();
        unlockRef.current = null;
      }
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      ro.disconnect();
    };
  }, [leftRef, rightRef, parentRef, measure, lightCheck]);

  // ─── Public API (backwards compatible) ───────────────────────────────────────
  const recalculate = useCallback(() => {
    measure();
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(measure, 200);
  }, [measure]);

  return {
    stickySide,
    isLeftSticky: stickySide === "left",
    isRightSticky: stickySide === "right",
    recalculate,
  };
}
