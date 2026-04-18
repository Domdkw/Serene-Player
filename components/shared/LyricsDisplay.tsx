import React, { memo, useRef, useEffect, useCallback } from 'react';
import { LyricLine as LyricLineType } from '../../types';
import LyricLine from '../LyricLine';
import { getFontFamily } from '../../utils/fontUtils';

interface LyricsDisplayProps {
  lyrics: LyricLineType[];
  currentTime: number;
  showTranslation: boolean;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  selectedFont: string;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  formatTime: (time: number) => string;
  className?: string;
}

/**
 * 歌词显示组件
 * 自动滚动到当前播放行
 * 支持手动滚动，5秒后恢复自动滚动
 */
const LyricsDisplay: React.FC<LyricsDisplayProps> = memo(({
  lyrics,
  currentTime,
  showTranslation,
  fontWeight,
  letterSpacing,
  lineHeight,
  selectedFont,
  isPlaying,
  onSeek,
  formatTime,
  className = '',
}) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);
  const manualScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isManualScrolling, setIsManualScrolling] = React.useState(false);

  /**
   * 计算当前激活的歌词索引
   */
  const activeIndex = React.useMemo(() => {
    if (!lyrics.length) return -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) return i;
    }
    return -1;
  }, [currentTime, lyrics]);

  /**
   * 判断歌词类型
   */
  const lyricsType = React.useMemo(() => {
    if (!lyrics.length) return 'none';
    return 'line';
  }, [lyrics]);

  /**
   * 处理用户交互
   * 进入手动滚动模式，5秒后恢复自动滚动
   */
  const handleUserInteraction = useCallback(() => {
    setIsManualScrolling(true);

    if (manualScrollTimerRef.current) {
      clearTimeout(manualScrollTimerRef.current);
    }

    manualScrollTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsManualScrolling(false);
      }
    }, 5000);
  }, [isPlaying]);

  /**
   * 自动滚动到当前激活的歌词
   */
  useEffect(() => {
    if (isManualScrolling) return;

    if (activeLyricRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeElement = activeLyricRef.current;
      const containerHeight = container.clientHeight;
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.clientHeight;

      const targetScroll = elementTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    }
  }, [activeIndex, isManualScrolling]);

  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (manualScrollTimerRef.current) {
        clearTimeout(manualScrollTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={lyricsContainerRef}
      className={`flex-1 overflow-y-auto px-6 md:px-20 py-[20vh] md:py-[45vh] hide-scrollbar ${className}`}
      onWheel={handleUserInteraction}
      onTouchMove={handleUserInteraction}
      onMouseDown={handleUserInteraction}
    >
      {lyrics.length > 0 ? (
        <div className="flex flex-col min-h-full items-center justify-center">
          {lyrics.map((line, idx) => (
            <LyricLine
              key={idx}
              line={line}
              idx={idx}
              isActive={idx === activeIndex}
              lyricsType={lyricsType}
              currentTime={currentTime}
              nextLineTime={lyrics[idx + 1]?.time}
              fontWeight={fontWeight}
              letterSpacing={letterSpacing}
              lineHeight={lineHeight}
              selectedFont={selectedFont}
              activeIndex={activeIndex}
              isSidebarOpen={false}
              showTranslation={showTranslation}
              onSeek={onSeek}
              activeLyricRef={activeLyricRef}
              formatTime={formatTime}
              getFontFamily={getFontFamily}
            />
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
          <p className="text-sm md:text-xl italic font-medium tracking-tight opacity-40">
            No synchronized lyrics available
          </p>
        </div>
      )}
    </div>
  );
});

LyricsDisplay.displayName = 'LyricsDisplay';

export default LyricsDisplay;
