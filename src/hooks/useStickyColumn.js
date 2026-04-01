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

/**
 * Picks which column in a two-column flex layout should be sticky.
 * The shorter column gets `position: sticky` so it stays visible
 * while the taller column scrolls.
 *
 * Robust against: sticky offsetTop drift, image uploads, async content,
 * and Shopify themes that set overflow:hidden on ancestor wrappers.
 */
export default function useStickyColumn({
  parentRef,
  leftRef,
  rightRef,
  mobileBreakpoint = 768,
}) {
  const [stickySide, setStickySide] = useState(null);
  const sideRef = useRef(null);
  const timerRef = useRef(0);
  const unlockCleanupRef = useRef(null);

  const apply = useCallback((side) => {
    if (sideRef.current === side) return;
    if (!side && unlockCleanupRef.current) {
      unlockCleanupRef.current();
      unlockCleanupRef.current = null;
    }
    sideRef.current = side;
    setStickySide(side);
  }, []);

  const measure = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < mobileBreakpoint) {
      apply(null);
      return;
    }

    const leftEl = leftRef?.current;
    const rightEl = rightRef?.current;
    if (!leftEl || !rightEl) return;

    // Temporarily remove sticky so we read true flow heights.
    const leftHadSticky = leftEl.classList.contains("sticky");
    const rightHadSticky = rightEl.classList.contains("sticky");
    if (leftHadSticky) leftEl.classList.remove("sticky");
    if (rightHadSticky) rightEl.classList.remove("sticky");

    // Force layout reflow so heights are recalculated without sticky.
    const leftH = leftEl.getBoundingClientRect().height;
    const rightH = rightEl.getBoundingClientRect().height;

    const next = leftH <= rightH ? "left" : "right";
    apply(next);

    // Re-add the class to the correct side synchronously (same frame).
    if (next === "left") {
      leftEl.classList.add("sticky");
      rightEl.classList.remove("sticky");
    } else {
      rightEl.classList.add("sticky");
      leftEl.classList.remove("sticky");
    }

    // Unlock overflow on all ancestors so sticky works inside Shopify themes.
    if (unlockCleanupRef.current) unlockCleanupRef.current();
    const stickyEl = next === "left" ? leftEl : rightEl;
    unlockCleanupRef.current = unlockStickyAncestors(stickyEl);
  }, [apply, leftRef, mobileBreakpoint, rightRef]);

  const schedule = useCallback(
    (ms = 60) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = 0;
        measure();
      }, ms);
    },
    [measure],
  );

  // Core observers: resize + element size changes.
  useEffect(() => {
    const leftEl = leftRef?.current;
    const rightEl = rightRef?.current;
    const parentEl = parentRef?.current;

    measure();

    const onResize = () => schedule(100);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });

    const ro = new ResizeObserver(() => schedule(60));
    if (leftEl) ro.observe(leftEl);
    if (rightEl) ro.observe(rightEl);
    if (parentEl) ro.observe(parentEl);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (unlockCleanupRef.current) {
        unlockCleanupRef.current();
        unlockCleanupRef.current = null;
      }
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      ro.disconnect();
    };
  }, [leftRef, rightRef, parentRef, measure, schedule]);

  const recalculate = useCallback(() => {
    measure();
    schedule(150);
    schedule(500);
  }, [measure, schedule]);

  return {
    stickySide,
    isLeftSticky: stickySide === "left",
    isRightSticky: stickySide === "right",
    recalculate,
  };
}
