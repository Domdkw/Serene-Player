import React, { memo } from 'react';

interface GlobalBackgroundProps {
  coverUrl?: string | null;
}

const GlobalBackground = memo(({ coverUrl }: GlobalBackgroundProps) => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-neutral-900">
    {coverUrl && (
      <div 
        className="absolute top-1/2 -translate-y-1/2 left-[-200vw] w-[400vw] h-[400vh] animate-rotate-cover transition-all duration-1000"
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(50px) brightness(0.7)',
        }}
      />
    )}
    <style>{`
      @keyframes rotate-cover {
        0% { transform: translateY(-50%) rotate(0deg); }
        100% { transform: translateY(-50%) rotate(360deg); }
      }
      .animate-rotate-cover {
        animation: rotate-cover 60s linear infinite;
      }
    `}</style>
  </div>
));

export default GlobalBackground;
