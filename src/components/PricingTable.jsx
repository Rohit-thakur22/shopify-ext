import React from 'react';

const PricingTable = () => {
  const pricingTiers = [
    {
      quantity: "1-14 pcs",
      price: "$9.17 ea",
      discount: null,
      isHighlighted: true,
      specialText: "Add 14 "
    },
    {
      quantity: "15-49",
      price: "$7.34 ea",
      discount: "20% off",
      isHighlighted: false
    },
    {
      quantity: "50-99",
      price: "$6.42 ea",
      discount: "30% off",
      isHighlighted: false
    },
    {
      quantity: "100-249",
      price: "$5.50 ea",
      discount: "40% off",
      isHighlighted: false
    },
    {
      quantity: "250+",
      price: "$4.58 ea",
      discount: "50% off",
      isHighlighted: false
    }
  ];

  return (
    <div className="w-72 mx-auto h-max bg-white rounded-xl mt-2 overflow-hidden border border-gray-300">
      {/* Header */}
      <div className="grid grid-cols-3 bg-white">
        <div className="px-3 py-1.5 font-semibold text-sm text-gray-900">Total Qty</div>
        <div className="px-3 py-1.5 font-semibold text-sm text-gray-900 border-l border-gray-300">Price</div>
        <div className="px-3 py-1.5 font-semibold text-sm text-gray-900 border-l border-gray-300">Discount</div>
      </div>

      {/* Pricing Tiers */}
      {pricingTiers.map((tier, index) => (
        <div
          key={index}
          className={`grid grid-cols-3 border-l border-r border-b border-gray-300 ${
            tier.isHighlighted 
              ? 'bg-green-50 border-green-500 border' 
              : 'bg-white'
          }`}
        >
          <div className="px-3 py-1.5">
            <div className="font-semibold text-gray-900 text-sm">{tier.quantity}</div>
            {tier.specialText && (
              <div className="text-gray-700 text-xs mt-1.5 leading-relaxed">
                {tier.specialText}
              </div>
            )}
          </div>
          <div className="px-3 py-1.5 border-l border-gray-300 font-semibold text-sm text-gray-900">
            {tier.price}
          </div>
          <div className="px-3 py-1.5 border-l border-gray-300">
            {tier.discount && (
              <span className="font-semibold text-sm text-gray-900">{tier.discount}</span>
            )}
          </div>
        </div>
      ))}

      {/* Guarantee Banner */}
      <div className="bg-green-600 text-white px-2 py-1 flex items-center space-x-1 rounded-b-lg">
        <div className="flex-shrink-0">
          <svg 
            className="w-3 h-3 text-white" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L9 7V9C9 10.1 9.9 11 11 11V16L15 20L19 16V11C20.1 11 21 10.1 21 9ZM18 9C18 9.6 17.6 10 17 10H15V15L12 18L9 15V10H7C6.4 10 6 9.6 6 9V8L12 2L18 8V9Z"/>
          </svg>
        </div>
        <div>
          <div className="font-semibold text-[10px]">
            <span className="font-bold">We:</span> Perfect Prints.
          </div>
          <div className="text-green-100 text-[10px]">
            Free Art Review. No Extra Fees!
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingTable;