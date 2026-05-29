import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { LyricLine as LyricLineType } from '@/types';

export type LyricsType = 'line' | 'none';

interface LyricLineProps {
  line: LyricLineType;
  idx: number;
  isActive: boolean;
  lyricsType: LyricsType;
  currentTime: number;
  nextLineTime?: number;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  selectedFont: string;
  activeIndex: number;
  isSidebarOpen: boolean;
  showTranslation: boolean;
  onSeek: (time: number) => void;
  activeLyricRef?: React.RefObject<HTMLDivElement>;
  formatTime: (time: number) => string;
  getFontFamily: (font: string) => string;
}

export const LyricLine: React.FC<LyricLineProps> = ({
  line,
  idx,
  isActive,
  lyricsType,
  currentTime,
  nextLineTime,
  fontWeight,
  letterSpacing,
  lineHeight,
  selectedFont,
  activeIndex,
  isSidebarOpen,
  showTranslation,
  onSeek,
  activeLyricRef,
  formatTime,
  getFontFamily,
}) => {
  const isAdjacent = activeIndex !== -1 && (idx === activeIndex - 1 || idx === activeIndex + 1);

  // 计算逐行歌词的进度 - 使用 useMemo 缓存计算结果
  const lineProgress = useMemo((): number => {
    if (!isActive || lyricsType !== 'line' || !nextLineTime) return 0;
    return ((currentTime - line.time + 0.1) / (nextLineTime - line.time)) * 100;
  }, [isActive, lyricsType, line.time, currentTime, nextLineTime]);

  // 缓存样式对象，避免每次渲染都创建新对象
  const textStyle = useMemo(() => ({
    fontWeight: fontWeight === 'light' ? '300' : fontWeight === 'medium' ? '500' : '700',
    letterSpacing: `${letterSpacing}px`,
    lineHeight: lineHeight,
    fontFamily: getFontFamily(selectedFont),
  }), [fontWeight, letterSpacing, lineHeight, selectedFont, getFontFamily]);

  const translationStyle = useMemo(() => ({
    fontWeight: fontWeight === 'light' ? '300' : fontWeight === 'medium' ? '400' : '500',
    letterSpacing: `${letterSpacing}px`,
    lineHeight: lineHeight,
    fontFamily: getFontFamily(selectedFont),
  }), [fontWeight, letterSpacing, lineHeight, selectedFont, getFontFamily]);

  return (
    <div
      ref={isActive ? activeLyricRef : null}
      onClick={() => onSeek(line.time)}
      className={`group relative py-2 md:py-4 cursor-pointer transition-all duration-700 text-center md:text-left ${
        isActive ? 'text-white' : 'text-white/20'
      }`}
      style={{ marginBottom: '1rem', marginTop: '1rem' }}
    >
      {/* 时间标签 - 当前歌词激活或悬停时显示,位于歌词左侧水平居中 */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%+18px)] flex items-center gap-1.5 text-[14px] text-white/80 font-mono px-2 py-1 rounded-lg z-20 transition-all duration-300 opacity-0 ${
        isActive ? 'group-hover:opacity-100' : 'group-hover:opacity-100'
      } ${isActive ? '!opacity-100' : ''}`}>
        {formatTime(line.time)}
      </div>

      {/* 歌词文本容器 */}
      <div className="flex flex-col gap-1">
        <p
          className={`text-[26px] leading-[1.1] md:leading-tight drop-shadow-2xl transition-all duration-700 select-none relative ${
            isActive
              ? 'opacity-100 origin-center md:origin-left'
              : isAdjacent
                ? 'text-white/80 opacity-100 blur-0 hover:text-white'
                : 'text-white/50 opacity-80 blur-0 hover:opacity-100 hover:text-white'
          }`}
          style={textStyle}
        >
          {line.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </p>
        {/* 翻译文本 */}
        {showTranslation && line.translation && (
          <p
            className={`text-sm font-medium transition-all duration-700 select-none ${
              isActive
                ? 'text-white/70'
                : isAdjacent
                  ? 'text-white/50'
                  : 'text-white/30'
            }`}
            style={translationStyle}
          >
            {line.translation.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </p>
        )}
      </div>

      {/* 逐行歌词进度条 - 使用绝对定位避免影响高度 */}
      {isActive && nextLineTime && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20 overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-white transition-all duration-100"
            style={{ width: `${lineProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// 使用 React.memo 和自定义比较函数来优化性能
// 只有当相关 props 发生变化时才重新渲染
export default React.memo(LyricLine, (prevProps, nextProps) => {
  // 如果是当前行或相邻行，需要检查 currentTime 变化
  const wasRelevant = prevProps.isActive || 
    (prevProps.activeIndex !== -1 && 
     (prevProps.idx === prevProps.activeIndex - 1 || prevProps.idx === prevProps.activeIndex + 1));
  const isRelevant = nextProps.isActive || 
    (nextProps.activeIndex !== -1 && 
     (nextProps.idx === nextProps.activeIndex - 1 || nextProps.idx === nextProps.activeIndex + 1));

  // 如果相关性发生变化，需要重新渲染
  if (wasRelevant !== isRelevant) return false;

  // 如果是相关行，检查 currentTime 变化
  if (isRelevant && prevProps.currentTime !== nextProps.currentTime) return false;

  // 检查其他关键 props
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.activeIndex !== nextProps.activeIndex) return false;
  if (prevProps.fontWeight !== nextProps.fontWeight) return false;
  if (prevProps.letterSpacing !== nextProps.letterSpacing) return false;
  if (prevProps.lineHeight !== nextProps.lineHeight) return false;
  if (prevProps.selectedFont !== nextProps.selectedFont) return false;
  if (prevProps.isSidebarOpen !== nextProps.isSidebarOpen) return false;
  if (prevProps.showTranslation !== nextProps.showTranslation) return false;
  if (prevProps.nextLineTime !== nextProps.nextLineTime) return false;

  // line 对象的内容比较（只比较关键字段）
  if (prevProps.line.text !== nextProps.line.text) return false;
  if (prevProps.line.translation !== nextProps.line.translation) return false;
  if (prevProps.line.time !== nextProps.line.time) return false;

  return true;
});
