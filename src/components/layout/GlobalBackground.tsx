import { memo } from 'react';

interface GlobalBackgroundProps {
  coverUrl?: string | null;
  rotate?: boolean;
}

/**
 * 全局背景组件
 * 显示模糊的封面图片作为背景，支持旋转动画控制
 * @param coverUrl - 封面图片URL
 * @param rotate - 是否启用旋转动画，默认为 false
 */
const GlobalBackground = memo(({ coverUrl, rotate = false }: GlobalBackgroundProps) => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-neutral-900">
    {coverUrl && (
      <div 
        className={`absolute top-1/2 -translate-y-1/2 left-[-200vw] w-[400vw] h-[400vh] transition-all duration-1000 ${rotate ? 'animate-rotate-cover' : ''}`}
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
        animation: rotate-cover 360s linear infinite;
      }
    `}</style>
  </div>
));

export default GlobalBackground;
