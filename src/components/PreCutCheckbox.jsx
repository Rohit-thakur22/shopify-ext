import React from "react";

/**
 * PreCutCheckbox - Pre-cut service option toggle.
 * Wrapped by feature flag (enablePrecut) in ProductCustomizer.
 */
const PreCutCheckbox = ({ preCut, setPreCut }) => {
  return (
    <div className="precut-checkbox bg-white rounded-lg">
      <div className="text-start space-y-1 mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">
          Step 3: Pre-cut Service
        </h2>
        <p className="text-sm text-gray-500">
          Add professional cutting around your design
        </p>
      </div>
      <label className={`flex items-start gap-4 cursor-pointer group p-4 rounded-xl border transition-all duration-300 ${preCut ? 'border-indigo-500 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 hover:shadow-md'}`}>
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={preCut}
            onChange={(e) => setPreCut(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-5 h-5 border-2 border-gray-300 rounded shadow-sm peer-checked:border-indigo-600 peer-checked:bg-indigo-600 transition-all group-hover:border-indigo-400">
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
        <div className="flex-1">
          <div className="flex justify-between items-center sm:block md:flex">
            <span className="text-sm font-bold text-gray-900 transition-colors">
              Pre-cut Service
            </span>
            <span className="text-sm font-bold text-indigo-600 bg-indigo-100/50 px-2 py-0.5 rounded-md">
              +$0.24/ea
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            We'll automatically cut the material precisely around your uploaded design contours.
          </p>
        </div>
      </label>
    </div>
  );
};

export default PreCutCheckbox;
