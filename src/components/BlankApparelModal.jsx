import React, { useState } from "react";
import { createPortal } from "react-dom";

const BlankApparelModal = ({ open, onClose, onGoToCart, products = [], loading = false }) => {
  const [imgErrors, setImgErrors] = useState({});

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onGoToCart();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "1rem",
          width: "min(95vw, 680px)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #e5e7eb",
            background: "linear-gradient(135deg, #7b2cbf 0%, #ff69b4 55%, #0a1172 100%)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#fff" }}>
              Complete Your Order
            </h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "rgba(255,255,255,0.85)" }}>
              Your transfer was added! Need blank apparel to press it on?
            </p>
          </div>
          <button
            onClick={onGoToCart}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem",
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Product scroll area */}
        <div style={{ padding: "1.25rem 1.5rem", flex: 1, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", gap: "0.75rem", color: "#6b7280" }}>
              <svg style={{ width: "1.5rem", height: "1.5rem", animation: "ba-spin 0.75s linear infinite" }} fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.85 }} fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span style={{ fontSize: "0.875rem" }}>Loading products...</span>
            </div>
          ) : products.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: "0.875rem", padding: "2rem 0" }}>
              No products found
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "0.875rem",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: "0.5rem",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {products.map((product) => {
                const price = product.price;
                const comparePrice = product.compareAtPrice;
                const imgSrc = imgErrors[product.id]
                  ? null
                  : product.image;

                return (
                  <a
                    key={product.id}
                    href={`/products/${product.handle}`}
                    style={{
                      flex: "0 0 auto",
                      width: "140px",
                      borderRadius: "0.75rem",
                      border: "1px solid #e5e7eb",
                      overflow: "hidden",
                      scrollSnapAlign: "start",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#7b2cbf";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(123,44,191,0.15)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    {/* Product image */}
                    <div
                      style={{
                        width: "140px",
                        height: "140px",
                        backgroundColor: "#f9fafb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={product.title}
                          loading="lazy"
                          onError={() => setImgErrors((prev) => ({ ...prev, [product.id]: true }))}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <svg width="32" height="32" fill="none" stroke="#d1d5db" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="m21 15-5-5L5 21" />
                        </svg>
                      )}
                    </div>

                    {/* Product info */}
                    <div style={{ padding: "0.5rem 0.625rem", borderTop: "1px solid #f3f4f6", flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#374151",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.title}
                      </p>
                      {price && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#7b2cbf" }}>
                            ${parseFloat(price).toFixed(2)}
                          </span>
                          {comparePrice && parseFloat(comparePrice) > parseFloat(price) && (
                            <span style={{ fontSize: "0.6875rem", color: "#9ca3af", textDecoration: "line-through" }}>
                              ${parseFloat(comparePrice).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            padding: "1rem 1.5rem",
            borderTop: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Continue Shopping
          </button>
          <button
            onClick={onGoToCart}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              border: "none",
              background: "linear-gradient(135deg, #7b2cbf, #9d4edd)",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(123,44,191,0.3)",
            }}
          >
            Go to Cart
          </button>
        </div>
      </div>

      <style>{`@keyframes ba-spin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body,
  );
};

export default BlankApparelModal;
