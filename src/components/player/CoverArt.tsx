import React, { memo, useCallback, useRef, useState } from 'react';
import { Music } from 'lucide-react';

interface CoverArtProps {
  coverUrl: string | null;
  title: string;
  isPlaying: boolean;
  enable3DEffect?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * 封面图片组件
 * 支持3D悬停效果、播放状态动画
 * 可配置尺寸和是否启用3D效果
 */
const CoverArt: React.FC<CoverArtProps> = memo(({
  coverUrl,
  title,
  isPlaying,
  enable3DEffect = true,
  size = 'md',
  className = '',
}) => {
  const coverRef = useRef<HTMLDivElement>(null);
  const [coverMousePos, setCoverMousePos] = useState({ x: 0, y: 0 });
  const [isCoverHovered, setIsCoverHovered] = useState(false);

  const sizeConfig = {
    sm: {
      container: 'max-w-[150px]',
      rounded: 'rounded-xl',
    },
    md: {
      container: 'max-w-[200px] md:max-w-[280px]',
      rounded: 'rounded-2xl md:rounded-[2rem]',
    },
    lg: {
      container: 'max-w-[280px] lg:max-w-[320px]',
      rounded: 'rounded-sm md:rounded-[1rem]',
    },
  };

  const config = sizeConfig[size];

  /**
   * 处理封面鼠标移动事件
   * 计算3D效果的旋转角度
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!enable3DEffect || !coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCoverMousePos({ x, y });
  }, [enable3DEffect]);

  const handleMouseEnter = useCallback(() => {
    if (enable3DEffect) {
      setIsCoverHovered(true);
    }
  }, [enable3DEffect]);

  const handleMouseLeave = useCallback(() => {
    if (enable3DEffect) {
      setIsCoverHovered(false);
      setCoverMousePos({ x: 0, y: 0 });
    }
  }, [enable3DEffect]);

  const transform3D = enable3DEffect && isCoverHovered
    ? `perspective(1000px) rotateX(${-coverMousePos.y * 25}deg) rotateY(${coverMousePos.x * 25}deg) scale3d(1.05, 1.05, 1.05)`
    : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

  return (
    <div
      ref={coverRef}
      className={`relative group w-full aspect-square ${config.container} shrink-0 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`absolute -inset-4 md:-inset-8 opacity-20 blur-3xl rounded-full transition-all duration-1000 ${isPlaying ? 'scale-110' : 'scale-90'}`}
        style={{ backgroundColor: 'white' }}
      />

      <div
        className={`relative w-full h-full ${config.rounded} overflow-hidden shadow-2xl border border-white/20 bg-black/40 transition-transform duration-125 ease-out`}
        style={{
          transform: transform3D,
          willChange: 'transform',
        }}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className={`w-full h-full object-cover transition-transform duration-[5s] ease-linear ${isPlaying ? 'scale-125' : 'scale-100'}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={64} className="text-white/10" />
          </div>
        )}
      </div>
    </div>
  );
});

CoverArt.displayName = 'CoverArt';

export default CoverArt;
