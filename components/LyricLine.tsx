import React from 'react';
import { Clock } from 'lucide-react';
import { LyricLine as LyricLineType } from '../types';

export type LyricsType = 'word' | 'line' | 'none';

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
  onSeek,
  activeLyricRef,
  formatTime,
  getFontFamily,
}) => {
  const isAdjacent = activeIndex !== -1 && (idx === activeIndex - 1 || idx === activeIndex + 1);

  // 计算逐字歌词的进度
  const calculateWordProgress = (): number => {
    if (!line.chars || line.chars.length === 0) return 0;

    let progress = 0;
    for (let i = 0; i < line.chars.length; i++) {
      const char = line.chars[i];
      const nextChar = line.chars[i + 1];

      let nextCharTime: number;
      if (nextChar) {
        nextCharTime = nextChar.time;
      } else if (nextLineTime && nextLineTime > char.time) {
        nextCharTime = nextLineTime;
      } else {
        nextCharTime = char.time + 1;
      }

      if (currentTime >= char.time) {
        if (currentTime < nextCharTime) {
          const charProgress = (currentTime - char.time) / (nextCharTime - char.time);
          progress = ((i + charProgress) / line.chars.length) * 100;
          break;
        } else {
          progress = ((i + 1) / line.chars.length) * 100;
        }
      }
    }
    return Math.min(100, Math.max(0, progress));
  };

  // 计算逐行歌词的进度
  const calculateLineProgress = (): number => {
    if (!nextLineTime) return 0;
    return ((currentTime - line.time + 0.1) / (nextLineTime - line.time)) * 100;
  };

  return (
    <div
      key={idx}
      ref={isActive ? activeLyricRef : null}
      onClick={() => onSeek(line.time)}
      className={`group relative py-2 md:py-4 cursor-pointer transition-all duration-700 text-center md:text-left ${
        isActive ? 'text-white' : 'text-white/20'
      }`}
      style={{
        marginBottom: isActive ? '2rem' : '1rem',
        marginTop: isActive ? '2rem' : '1rem',
      }}
    >
      {/* 时间标签 */}
      <div className="absolute left-1/2 md:left-0 -top-6 md:-top-10 -translate-x-1/2 md:translate-x-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[10px] text-white/80 font-mono bg-white/10 px-2 py-1 rounded-lg border border-white/10 backdrop-blur-xl z-20">
        <Clock size={10} />
        {formatTime(line.time)}
      </div>

      {/* 歌词文本容器 */}
      <p
        className={`font-black leading-[1.1] md:leading-tight drop-shadow-2xl transition-all duration-700 select-none relative ${
          isActive
            ? 'text-2xl md:text-[3vw] lg:text-[32px] opacity-100 scale-100 origin-center md:origin-left'
            : isAdjacent
              ? 'text-lg text-white/80 md:text-[2vw] lg:text-[28px] opacity-100 hover:text-white blur-0'
              : 'text-lg md:text-[2vw] lg:text-[28px] opacity-80 blur-[0.5px] text-white/50 hover:opacity-100 hover:blur-0 hover:scale-105 hover:text-white'
        }`}
        style={{
          fontWeight: fontWeight === 'light' ? '300' : fontWeight === 'medium' ? '500' : '700',
          letterSpacing: `${letterSpacing}px`,
          lineHeight: lineHeight,
          fontFamily: getFontFamily(selectedFont),
        }}
      >
        {/* 逐字歌词进度背景 */}
        {isActive && lyricsType === 'word' && line.chars && line.chars.length > 0 && (
          <span
            className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-lg -z-10 transition-all duration-50 ease-linear"
            style={{ width: `${calculateWordProgress()}%` }}
          />
        )}
        {line.text}
      </p>

      {/* 逐行歌词进度条 */}
      {isActive && lyricsType === 'line' && nextLineTime && (
        <div className="mt-2 w-full h-[2px] bg-white/20 relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-white transition-all duration-100"
            style={{ width: `${calculateLineProgress()}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default LyricLine;
