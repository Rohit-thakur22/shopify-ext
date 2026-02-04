import React from "react";

/**
 * PreCutCheckbox - Pre-cut service option toggle.
 * Wrapped by feature flag (enablePrecut) in ProductCustomizer.
 */
const PreCutCheckbox = ({ preCut, setPreCut }) => {
  return (
    <div className="precut-checkbox bg-white rounded-lg">
      <div className="text-start space-y-2 mb-4">
        <h2 className="font-bold text-black text-base">
          Pre-cut Service
        </h2>
        <p className="text-xs text-gray-600">
          Add professional cutting around your design
        </p>
      </div>
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={preCut}
            onChange={(e) => setPreCut(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-all">
            {preCut && (
              <svg
                className="w-full h-full text-white p-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
            Pre-cut Service (+$0.24)
          </span>
          <p className="text-xs text-gray-500">
            We'll cut around your design for you
          </p>
        </div>
      </label>
    </div>
  );
};

export default PreCutCheckbox;
