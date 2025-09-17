import React, { useMemo, useState } from "react";

const STEP_INCHES = 0.25;
const PRICE_PER_SQIN = 0.02; // $0.02 per square inch
const BASE_PRICE = 9.17;

function SizeRow({ row, onChange, onRemove }) {
  const { id, width, height, qty, priceEach } = row;
  const total = useMemo(() => priceEach * qty, [priceEach, qty]);

  const inc = (dimension) => {
    if (dimension === "width") {
      onChange(id, { width: +(width + STEP_INCHES).toFixed(2) });
    } else {
      onChange(id, { height: +(height + STEP_INCHES).toFixed(2) });
    }
  };

  const dec = (dimension) => {
    if (dimension === "width") {
      const nextWidth = Math.max(
        STEP_INCHES,
        +(width - STEP_INCHES).toFixed(2)
      );
      onChange(id, { width: nextWidth });
    } else {
      const nextHeight = Math.max(
        STEP_INCHES,
        +(height - STEP_INCHES).toFixed(2)
      );
      onChange(id, { height: nextHeight });
    }
  };

  return (
    <div className="grid grid-cols-12 gap-3 items-center py-2 border-b border-gray-200">
      <div className="col-span-4 sm:col-span-3">
        <div className="text-gray-800 font-semibold text-xs">
          Width (inches)
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            className="h-8 w-8 rounded-md border border-gray-300 text-lg"
            onClick={() => dec("width")}
          >
            -
          </button>
          <div className="flex-1 h-8 rounded-md border border-gray-300 flex items-center justify-center text-base font-semibold">
            {width.toFixed(2)}
          </div>
          <button
            className="h-8 w-8 rounded-md border border-gray-300 text-lg"
            onClick={() => inc("width")}
          >
            +
          </button>
        </div>
      </div>

      <div className="col-span-4 sm:col-span-3">
        <div className="text-gray-800 font-semibold text-xs">
          Height (inches)
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            className="h-8 w-8 rounded-md border border-gray-300 text-lg"
            onClick={() => dec("height")}
          >
            -
          </button>
          <div className="flex-1 h-8 rounded-md border border-gray-300 flex items-center justify-center text-base font-semibold">
            {height.toFixed(2)}
          </div>
          <button
            className="h-8 w-8 rounded-md border border-gray-300 text-lg"
            onClick={() => inc("height")}
          >
            +
          </button>
        </div>
      </div>

      <div className="col-span-4 sm:col-span-2">
        <div className="text-gray-800 font-semibold text-xs">Price</div>
        <div className="mt-2 text-xl font-bold">
          ${priceEach.toFixed(2)}{" "}
          <span className="text-gray-500 text-sm">ea.</span>
        </div>
      </div>

      <div className="col-span-6 sm:col-span-2">
        <div className="text-gray-800 font-semibold text-xs">Qty</div>
        <input
          type="number"
          min={1}
          className="mt-2 w-full h-8 rounded-md border border-gray-300 text-center text-sm"
          value={qty}
          onChange={(e) =>
            onChange(id, { qty: Math.max(1, Number(e.target.value || 1)) })
          }
        />
      </div>

      <div className="col-span-6 sm:col-span-2 text-right">
        <div className="text-gray-800 font-semibold text-xs">Total</div>
        <div className="mt-2 text-xl font-bold">${total.toFixed(2)}</div>
      </div>

      {onRemove && (
        <div className="col-span-12 flex justify-end">
          <button
            className="text-sm text-red-600 hover:underline"
            onClick={() => onRemove(id)}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

const CustomSize = () => {
  const computePrice = (width, height) => {
    return +(BASE_PRICE + width * height * PRICE_PER_SQIN).toFixed(2);
  };

  const [rows, setRows] = useState([
    {
      id: 1,
      width: 12.0,
      height: 10.0,
      qty: 1,
      priceEach: +(BASE_PRICE + 12.0 * 10.0 * PRICE_PER_SQIN).toFixed(2),
    },
  ]);

  const handleChange = (id, partial) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...partial };
        next.priceEach = computePrice(next.width, next.height);
        return next;
      })
    );
  };

  const handleRemove = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        width: 12.0,
        height: 10.0,
        qty: 1,
        priceEach: +(BASE_PRICE + 12.0 * 10.0 * PRICE_PER_SQIN).toFixed(2),
      },
    ]);
  };

  const grandTotal = useMemo(
    () => rows.reduce((sum, r) => sum + r.priceEach * r.qty, 0),
    [rows]
  );

  return (
    <div className="mt-4 max-h-96 overflow-y-auto">
      <div className="flex items-center gap-3  border-b-[0.5px] border-gray-400">
        {/* <div className="w-4 h-4 border-2 border-gray-900 rounded-sm" /> */}
        <h3 className="text-xl font-bold text-gray-900 border-b-2">
          Custom Size
        </h3>
      </div>
      <p className="text-gray-600 mt-1 text-sm">
        Not sure what size to make your design? Check out our{" "}
        <span className="text-blue-600 underline">Size Guide</span>
      </p>

      {rows.map((row) => (
        <SizeRow
          key={row.id}
          row={row}
          onChange={handleChange}
          onRemove={rows.length > 1 ? handleRemove : undefined}
        />
      ))}

      <button
        className="mt-3 text-blue-600 text-sm font-semibold"
        onClick={addRow}
      >
        + Add another size of this design
      </button>

      <div className="mt-4 flex justify-end">
        <div className="text-right">
          <div className="text-gray-700 text-sm">Subtotal</div>
          <div className="text-xl font-bold">${grandTotal.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};

export default CustomSize;
