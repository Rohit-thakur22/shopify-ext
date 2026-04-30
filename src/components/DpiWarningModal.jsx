import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

const DpiWarningModal = ({ dpi, onClose, onUploadNew, onEnhance }) => {
  // `dpi` now carries { width, height } in pixels (renamed from x/y DPI). Kept
  // the prop name for backwards-compat with the call site state variable.
  if (!dpi || typeof document === "undefined") return null;
  // Mount to body so viewport-fixed overlay is centered on full storefront viewport.
  const portalTarget = document.body;

  return createPortal(
    <div
      className="dpi-warning-modal-overlay"
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      onClick={onClose}
    >
      <div
        className="dpi-warning-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dpi-warning-modal-header">
          <div className="dpi-warning-modal-content">
            <span className="dpi-warning-modal-icon-wrap">
              <AlertTriangle size={16} />
            </span>
            <div className="dpi-warning-modal-copy">
              <p className="dpi-warning-modal-title">
                Low-resolution image detected
              </p>
              <p className="dpi-warning-modal-text">
                This image is small and may print blurry on cloth.
                {onEnhance && " Try enhancing it to improve resolution."}
              </p>
              <p className="dpi-warning-modal-meta">
                Detected: {dpi.width} x {dpi.height} px
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close warning"
            onClick={onClose}
            className="dpi-warning-modal-close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="dpi-warning-modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="dpi-warning-modal-btn dpi-warning-modal-btn-close"
          >
            Close
          </button>
          {onEnhance && (
            <button
              type="button"
              onClick={() => { onEnhance(); onClose(); }}
              className="dpi-warning-modal-btn dpi-warning-modal-btn-enhance"
              style={{
                backgroundColor: "#f59e0b",
                backgroundImage: "linear-gradient(to right, #f59e0b, #f97316)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
              }}
            >
              Enhance Image
            </button>
          )}
          <button
            type="button"
            onClick={onUploadNew}
            className="dpi-warning-modal-btn dpi-warning-modal-btn-upload"
          >
            Upload New Image
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
};

export default DpiWarningModal;
