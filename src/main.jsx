import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ProductCustomizer from "./components/ProductCustomizer";

// Get the container element (rendered by Shopify Liquid block)
const container = document.getElementById("cloth-editor-app");

if (container) {
  // Parse query params: ?design-handle={product-handle}&color={hex-code}
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const designHandle = params.get("design-handle") || null;
  const colorParam = params.get("color") || null;

  // Get variant ID, variant price, and asset URLs from data attributes (set by Liquid per product)
  const variantId    = container.dataset.variantId    || null;
  const productId    = container.dataset.productId   || "";
  const productTitle = container.dataset.productTitle || "";
  const settingsUrl  = container.dataset.settingsUrl  || null;
  const cartUrl      = container.dataset.cartUrl      || "/apps/customscale-app/cart-add";
  const variantPriceRaw = container.dataset.variantPrice;
  const variantPrice = variantPriceRaw != null && variantPriceRaw !== ""
    ? Number(String(variantPriceRaw).replace(/,/g, ""))
    : null;

  // Get all asset URLs from data attributes (set by Liquid)
  const assetUrls = {
    hoodie: container.dataset.hoodie,
    cap:    container.dataset.cap,
    tshirt: container.dataset.tshirt,
    shorts: container.dataset.shorts,
    polo:   container.dataset.polo,
    apron:  container.dataset.apron,
    front:  container.dataset.front,
    back:   container.dataset.back,
    side:   container.dataset.side,
  };

  ReactDOM.createRoot(container).render(
    <ProductCustomizer
      variantId={variantId}
      productId={productId}
      productTitle={productTitle}
      assetUrls={assetUrls}
      settingsUrl={settingsUrl}
      variantPrice={variantPrice}
      cartUrl={cartUrl}
      designHandle={designHandle}
      initialColor={colorParam}
    />
  );
}
