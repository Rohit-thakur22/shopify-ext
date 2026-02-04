import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ProductCustomizer from "./components/ProductCustomizer";

// Get the container element (rendered by Shopify Liquid block)
const container = document.getElementById("cloth-editor-app");

if (container) {
  // Get variant ID and asset URLs from data attributes
  const variantId = container.dataset.variantId || null;
  const settingsUrl = container.dataset.settingsUrl || null;

  // Get all asset URLs from data attributes (set by Liquid)
  const assetUrls = {
    hoodie: container.dataset.hoodie,
    cap: container.dataset.cap,
    tshirt: container.dataset.tshirt,
    shorts: container.dataset.shorts,
    polo: container.dataset.polo,
    apron: container.dataset.apron,
    front: container.dataset.front,
    back: container.dataset.back,
    side: container.dataset.side,
  };

  ReactDOM.createRoot(container).render(
    <ProductCustomizer variantId={variantId} assetUrls={assetUrls} settingsUrl={settingsUrl} />
  );
}
