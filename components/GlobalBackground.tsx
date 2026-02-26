import React, { memo } from 'react';

interface GlobalBackgroundProps {
  coverUrl?: string | null;
  rotate?: boolean;
}

/**
 * 全局背景组件
 * @param coverUrl - 封面图片URL
 * @param rotate - 是否开启旋转动画
 */
const GlobalBackground = memo(({ coverUrl, rotate = false }: GlobalBackgroundProps) => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[rgb(5,7,18)]">
    {coverUrl && (
      <div
        className={`absolute top-1/2 -translate-y-1/2 left-[-200vw] w-[400vw] h-[400vh] transition-all duration-1000 ${
          rotate ? 'animate-rotate-cover' : ''
        }`}
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(50px) brightness(0.7)',
        }}
      />
    )}
  </div>
));

export default GlobalBackground;
