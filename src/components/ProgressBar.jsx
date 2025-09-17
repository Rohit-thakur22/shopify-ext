import React, { useEffect, useState } from 'react';

const NinjaProgressBar = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId;
    let current = 0;
    const step = () => {
      current = Math.min(100, current + 0.6 + Math.random() * 1.2);
      setProgress(current);
      if (current < 100) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto p-6">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0));
          background-size: 200% 100%;
          animation: shimmer 1.4s linear infinite;
        }
        @keyframes flamePulse {
          0%, 100% { transform: rotate(-90deg) scale(1); }
          50% { transform: rotate(-90deg) scale(1.07); }
        }
        .flamePulse { animation: flamePulse 1.2s ease-in-out infinite; }
      `}</style>
      <div className="flex items-center mb-5 bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3">
          i
        </div>
        <p className="text-blue-800 flex-1">
          We're making sure your upload is perfect for printing. This may take a few seconds.
        </p>
        <button className="text-blue-600 hover:underline">Cancel</button>
      </div>

      <div className="flex items-center">
        <div className="flex-1 relative h-3 md:h-3.5">
          <div className="absolute inset-0 bg-blue-100 rounded-full" />
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ease-out overflow-visible"
            style={{ width: `${progress}%` }}
          >
            <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600" />
            <div className="absolute inset-0 shimmer opacity-35 rounded-full" />
            {/* <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-8 h-2 bg-gradient-to-r from-blue-400/60 to-transparent rounded-full" /> */}
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 select-none" aria-hidden>
              <span
                className="block text-2xl md:text-3xl flamePulse"
                style={{ filter: 'hue-rotate(180deg) saturate(250%) brightness(1.1)' }}
              >
                🔥
              </span>
            </div>
          </div>
        </div>
        <div className="ml-4 w-14 text-right text-lg font-semibold text-gray-700 tabular-nums">
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
};

export default NinjaProgressBar;