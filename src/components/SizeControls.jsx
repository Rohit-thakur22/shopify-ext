import React from "react";

const STEP_INCHES = 1; // step for +/- buttons
const MIN_SIZE = 0.5;
const MAX_SIZE = 22.5;

/** Clamp a value to [MIN_SIZE, MAX_SIZE] and round to 2 decimals */
function clamp(v) {
  return +Math.min(MAX_SIZE, Math.max(MIN_SIZE, v)).toFixed(2);
}

const SizeControls = ({ width, height, setWidth, setHeight, predefinedSizes = [], disabled = false }) => {
  const aspectRatio = width > 0 ? height / width : 1;
  const hasPredefined = Array.isArray(predefinedSizes) && predefinedSizes.length > 0;
  const widthHeightReadOnly = hasPredefined; // When predefined sizes exist, width/height are chosen via buttons only

  const selectPredefined = (w, h) => {
    if (disabled) return;
    setWidth(clamp(w));
    setHeight(clamp(h));
  };

  const updateWidthAndHeight = (newWidth, newHeight) => {
    const w = clamp(newWidth);
    const h = clamp(newHeight);
    setWidth(w);
    setHeight(h);
  };

  const incrementWidth = () => {
    let newWidth = Math.min(MAX_SIZE, +(width + STEP_INCHES).toFixed(2));
    let newHeight = newWidth * aspectRatio;
    if (newHeight > MAX_SIZE) {
      newHeight = MAX_SIZE;
      newWidth = newHeight / aspectRatio;
    } else if (newHeight < MIN_SIZE) {
      newHeight = MIN_SIZE;
      newWidth = newHeight / aspectRatio;
    }
    updateWidthAndHeight(newWidth, newHeight);
  };

  const decrementWidth = () => {
    let newWidth = Math.max(MIN_SIZE, +(width - STEP_INCHES).toFixed(2));
    let newHeight = newWidth * aspectRatio;
    if (newHeight > MAX_SIZE) {
      newHeight = MAX_SIZE;
      newWidth = newHeight / aspectRatio;
    } else if (newHeight < MIN_SIZE) {
      newHeight = MIN_SIZE;
      newWidth = newHeight / aspectRatio;
    }
    updateWidthAndHeight(newWidth, newHeight);
  };

  const incrementHeight = () => {
    let newHeight = Math.min(MAX_SIZE, +(height + STEP_INCHES).toFixed(2));
    let newWidth = newHeight / aspectRatio;
    if (newWidth > MAX_SIZE) {
      newWidth = MAX_SIZE;
      newHeight = newWidth * aspectRatio;
    } else if (newWidth < MIN_SIZE) {
      newWidth = MIN_SIZE;
      newHeight = newWidth * aspectRatio;
    }
    updateWidthAndHeight(newWidth, newHeight);
  };

  const decrementHeight = () => {
    let newHeight = Math.max(MIN_SIZE, +(height - STEP_INCHES).toFixed(2));
    let newWidth = newHeight / aspectRatio;
    if (newWidth > MAX_SIZE) {
      newWidth = MAX_SIZE;
      newHeight = newWidth * aspectRatio;
    } else if (newWidth < MIN_SIZE) {
      newWidth = MIN_SIZE;
      newHeight = newWidth * aspectRatio;
    }
    updateWidthAndHeight(newWidth, newHeight);
  };

  const handleWidthChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= MIN_SIZE && value <= MAX_SIZE) {
      const newHeight = clamp(value * aspectRatio);
      setWidth(+value.toFixed(2));
      setHeight(newHeight);
    } else if (e.target.value === "") {
      setWidth(MIN_SIZE);
    }
  };

  const handleHeightChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= MIN_SIZE && value <= MAX_SIZE) {
      const newWidth = clamp(value / aspectRatio);
      setWidth(newWidth);
      setHeight(+value.toFixed(2));
    } else if (e.target.value === "") {
      setHeight(MIN_SIZE);
    }
  };

  return (
    <div className={`size-controls bg-white rounded-lg ${disabled ? "pointer-events-none opacity-60 cursor-not-allowed" : ""}`} aria-disabled={disabled}>
      <div className="text-start space-y-2 mb-4">
        <h2 className="font-bold text-black text-base">
          Step 3: Set Design Size
        </h2>
        <p className="text-xs text-gray-600">
          Specify the dimensions for your custom design
        </p>
      </div>

      {hasPredefined && (
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium text-gray-700 block">Choose Size:</label>
          <div className="flex flex-wrap gap-2">
            {predefinedSizes.map((s, i) => {
              const w = Number(s.width);
              const h = Number(s.height);
              if (isNaN(w) || isNaN(h)) return null;
              const label = `${w}X${h}`;
              const isSelected = Math.abs(width - w) < 0.01 && Math.abs(height - h) < 0.01;
              return (
                <button
                  key={`${w}-${h}-${i}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectPredefined(w, h)}
                  className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Width Control */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Width (inches)
          </label>
          <div className="size-controls-stepper flex items-center gap-2">
            <button type="button" disabled={disabled || widthHeightReadOnly} onClick={decrementWidth} className="size-controls-btn" aria-label="Decrease width">−</button>
            <input
              type="number"
              value={width}
              onChange={handleWidthChange}
              step={0.25}
              min={MIN_SIZE}
              max={MAX_SIZE}
              disabled={disabled}
              readOnly={widthHeightReadOnly}
              className="size-controls-input"
            />
            <button type="button" disabled={disabled || widthHeightReadOnly} onClick={incrementWidth} className="size-controls-btn" aria-label="Increase width">+</button>
          </div>
        </div>

        {/* Height Control */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Height (inches)
          </label>
          <div className="size-controls-stepper flex items-center gap-2">
            <button type="button" disabled={disabled || widthHeightReadOnly} onClick={decrementHeight} className="size-controls-btn" aria-label="Decrease height">−</button>
            <input
              type="number"
              value={height}
              onChange={handleHeightChange}
              step={0.25}
              min={MIN_SIZE}
              max={MAX_SIZE}
              disabled={disabled}
              readOnly={widthHeightReadOnly}
              className="size-controls-input"
            />
            <button type="button" disabled={disabled || widthHeightReadOnly} onClick={incrementHeight} className="size-controls-btn" aria-label="Increase height">+</button>
          </div>
        </div>
      </div>

      {/* Size info */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          <span className="font-medium">Area:</span>{" "}
          {(width * height).toFixed(2)} sq. inches
        </p>
      </div>
    </div>
  );
};

export default SizeControls;
