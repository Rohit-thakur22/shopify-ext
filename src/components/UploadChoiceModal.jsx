import React from "react";
import { createPortal } from "react-dom";
import { Upload, Palette, X } from "lucide-react";

const UploadChoiceModal = ({ open, onClose, onChooseDevice, onChoosePremade }) => {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "1.25rem",
          width: "min(90vw, 480px)",
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
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Upload Your Design
            </h2>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.8125rem",
                color: "#6b7280",
              }}
            >
              Choose how you want to upload
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f3f4f6",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem",
              cursor: "pointer",
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div
          style={{
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {/* Option 1: Upload from Device */}
          <button
            onClick={() => {
              onClose();
              onChooseDevice();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1.25rem",
              borderRadius: "0.875rem",
              border: "2px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "left",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#7b2cbf";
              e.currentTarget.style.backgroundColor = "rgba(123,44,191,0.03)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(123,44,191,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.backgroundColor = "#fff";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: "3rem",
                height: "3rem",
                borderRadius: "0.75rem",
                background: "linear-gradient(135deg, #7b2cbf, #9d4edd)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Upload size={22} color="#fff" />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Upload from Device
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.8125rem",
                  color: "#6b7280",
                }}
              >
                Upload PNG, JPG, or GIF from your device
              </p>
            </div>
          </button>

          {/* Option 2: Pre-made Designs */}
          <button
            onClick={() => {
              onClose();
              onChoosePremade();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1.25rem",
              borderRadius: "0.875rem",
              border: "2px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "left",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#f59e0b";
              e.currentTarget.style.backgroundColor = "rgba(245,158,11,0.03)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(245,158,11,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.backgroundColor = "#fff";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: "3rem",
                height: "3rem",
                borderRadius: "0.75rem",
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Palette size={22} color="#fff" />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Upload from Pre-made Designs
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.8125rem",
                  color: "#6b7280",
                }}
              >
                Browse and choose from our ready-to-use design collection
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default UploadChoiceModal;
