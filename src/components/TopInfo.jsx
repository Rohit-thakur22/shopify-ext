import React from 'react';

const Star = () => (
  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.036a1 1 0 00-1.176 0l-2.802 2.036c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.88 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/>
  </svg>
);

const TopInfo = () => {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-3xl font-extrabold tracking-tight">DTF Transfers By Size</h2>
        <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">Everyday Low Prices</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1"><Star/><Star/><Star/><Star/><Star/></div>
        <div className="text-gray-700 text-sm">16737 Reviews</div>
      </div>

      <div className="mt-3">
        <span className="text-xl font-bold">As Low As</span>
        <span className="text-xl"> - $0.02 per square inch.</span>
      </div>

      <p className="mt-3 text-gray-800 text-sm">
        Printed Directly by Us. Never Outsourced. Shipped Fast from USA.
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
        <div className="flex items-center gap-2"><CheckIcon/> <span>Works on Any Fabric or Color</span></div>
        <div className="flex items-center gap-2"><CheckIcon/> <span>Vibrant Colors & Ultra-fine Details</span></div>
        <div className="flex items-center gap-2"><CheckIcon/> <span>Certified for 100+ Washes</span></div>
        <div className="flex items-center gap-2"><CheckIcon/> <span>100% Satisfaction Guaranteed</span></div>
      </div>

      <div className="mt-3 pt-3 border-t text-xs text-gray-700 flex flex-wrap items-center gap-4">
        <span className="text-blue-700 font-semibold">Buy More & Save Up To 50%</span>
        <span>Fastest Delivery Sep. 4th if ordered in <span className="font-semibold">05h 06m</span></span>
        <span>No Minimum, Setup or Art Fees</span>
      </div>
    </div>
  );
};

export default TopInfo;


