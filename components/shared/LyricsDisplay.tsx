import React, { memo } from 'react';
import { ChevronsLeftRightEllipsis } from 'lucide-react';
import { LyricLine as LyricLineType } from '../../types';
import LyricLine from '../LyricLine';
import { getFontFamily } from '../../utils/fontUtils';
import { getLyricsType } from '../../utils/lyricsUtils';
import { useLyricsScrolling } from '../../hooks';

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
  const {
    activeIndex,
    lyricsContainerRef,
    activeLyricRef,
    handleUserInteraction,
  } = useLyricsScrolling({
    lyrics,
    currentTime,
    isPlaying,
  });

  const lyricsType = React.useMemo(() => {
    return getLyricsType(lyrics);
  }, [lyrics]);

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
        <div className="h-full flex flex-col items-center justify-center text-center text-white/80 gap-4">
          <p className="text-sm md:text-xl italic font-medium tracking-tight flex flex-col items-center gap-2">
            <ChevronsLeftRightEllipsis size={24} />
            <span>No synchronized lyrics available</span>
          </p>
        </div>
      )}
    </div>
  );
});

LyricsDisplay.displayName = 'LyricsDisplay';

export default LyricsDisplay;
