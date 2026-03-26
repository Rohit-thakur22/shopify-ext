import React, { useState } from "react";

/**
 * PreCutCheckbox — pre-cut service toggle.
 * 100% inline styles (Shopify-safe). Uses brand palette: #7b2cbf / #ff69b4 / #0a1172.
 */
const PreCutCheckbox = ({ preCut, setPreCut }) => {
  const [hovered, setHovered] = useState(false);

  const ScissorsIcon = () => (
    <svg
      style={{ width: "1.125rem", height: "1.125rem", color: "#ffffff" }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="6" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg
      style={{ width: "0.75rem", height: "0.75rem", display: "block" }}
      fill="none"
      stroke="#ffffff"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );

  const InfoIcon = () => (
    <svg
      style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0 }}
      fill="none"
      stroke="#7b2cbf"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  );

  return (
    <div>
      {/* Section heading */}
      <div style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#0a1172", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "1.75rem", height: "1.75rem",
            background: "linear-gradient(135deg, #7b2cbf, #ff69b4)",
            borderRadius: "0.5rem",
            boxShadow: "0 2px 6px rgba(123,44,191,0.3)",
            flexShrink: 0,
          }}>
            <ScissorsIcon />
          </span>
          Pre-cut Service
        </h3>
        <p style={{ margin: "0.25rem 0 0 2.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
          Add professional cutting around your design
        </p>
      </div>

      {/* Toggle card */}
      <label
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "flex-start", gap: "0.875rem",
          padding: "0.875rem 1rem",
          borderRadius: "0.75rem",
          border: preCut
            ? "1.5px solid #d8b4fe"
            : hovered
            ? "1.5px solid #e9d5ff"
            : "1.5px solid #e5e7eb",
          background: preCut
            ? "linear-gradient(135deg, rgba(123,44,191,0.06) 0%, rgba(255,105,180,0.06) 100%)"
            : hovered
            ? "rgba(123,44,191,0.02)"
            : "#fafafa",
          boxShadow: preCut ? "0 2px 8px rgba(123,44,191,0.12)" : "none",
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
          userSelect: "none",
        }}
      >
        {/* Hidden real checkbox */}
        <input
          type="checkbox"
          checked={preCut}
          onChange={(e) => setPreCut(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
        />

        {/* Custom checkbox box */}
        <div style={{
          flexShrink: 0, marginTop: "0.125rem",
          width: "1.125rem", height: "1.125rem",
          borderRadius: "0.3rem",
          border: preCut ? "none" : "2px solid #d1d5db",
          background: preCut
            ? "linear-gradient(135deg, #7b2cbf, #ff69b4)"
            : "#ffffff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: preCut ? "0 1px 4px rgba(123,44,191,0.35)" : "none",
          transition: "background 0.15s, border 0.15s",
        }}>
          {preCut && <CheckIcon />}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827" }}>
              Pre-cut transfers
            </span>
            <span style={{
              fontSize: "0.8125rem", fontWeight: 700,
              color: "#7b2cbf",
              background: "rgba(123,44,191,0.08)",
              border: "1px solid #d8b4fe",
              padding: "0.125rem 0.5rem", borderRadius: "9999px",
            }}>
              +$0.30/ea
            </span>
          </div>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "#6b7280", lineHeight: 1.5 }}>
            We'll cut precisely around your design contours — ready to apply.
          </p>

          {/* Info note */}
          {preCut && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "0.375rem",
              marginTop: "0.625rem",
              padding: "0.5rem 0.625rem",
              backgroundColor: "rgba(123,44,191,0.06)",
              borderRadius: "0.5rem",
              border: "1px solid #e9d5ff",
            }}>
              <InfoIcon />
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#7b2cbf", lineHeight: 1.4 }}>
                This applies to all DTF Transfers by Size orders
              </p>
            </div>
          )}
        </div>
      </label>
    </div>
  );
};

export default PreCutCheckbox;
