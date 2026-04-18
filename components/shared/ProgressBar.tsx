import React, { memo, useCallback, useState } from 'react';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  disabled?: boolean;
  onSeek: (time: number) => void;
  showTime?: boolean;
  formatTime: (time: number) => string;
  height?: 'sm' | 'md';
  className?: string;
}

/**
 * 进度条组件
 * 支持点击跳转、悬停预览、时间显示
 * 可配置高度和是否显示时间标签
 */
const ProgressBar: React.FC<ProgressBarProps> = memo(({
  currentTime,
  duration,
  disabled = false,
  onSeek,
  showTime = true,
  formatTime,
  height = 'md',
  className = '',
}) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  }, [disabled, duration, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
    setHoverPosition(e.clientX - rect.left);
  }, [disabled, duration]);

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const heightClass = height === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        className={`relative w-full ${heightClass} bg-white/10 rounded-full ${!disabled ? 'cursor-pointer' : ''}`}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="h-full bg-white rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />

        {hoverTime !== null && !disabled && (
          <div
            className="absolute -top-10 px-4 py-2 bg-black/60 backdrop-blur-sm text-ml text-white rounded-lg pointer-events-none transform -translate-x-1/2 z-[80]"
            style={{ left: hoverPosition }}
          >
            {formatTime(hoverTime)}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/80" />
          </div>
        )}
      </div>

      {showTime && (
        <div className="flex justify-between px-1">
          <span className="text-[10px] font-mono font-bold text-white/30">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] font-mono font-bold text-white/30">
            {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
