import React, { useRef, useEffect, useCallback, memo } from 'react';
import { 
  ChevronLeft, 
  Languages, 
  Music,
  Loader2
} from 'lucide-react';
import { Track, LyricLine as ParsedLyric } from '../types';
import { getFontFamily } from '../utils/fontUtils';
import LyricLine from './LyricLine';

interface MusicPlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  showTranslation: boolean;
  setShowTranslation: (value: boolean) => void;
  onBack: () => void;
  loadingProgress: number | null;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  selectedFont: string;
  onSeek: (time: number) => void;
  formatTime: (time: number) => string;
}

// 流光加载条组件
const ShimmerLoadingBar = memo(({ progress }: { progress: number }) => (
  <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
    <div className="relative h-1.5 bg-white/5 overflow-hidden shimmer-effect">
      <div 
        className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
));

const MusicPlayer: React.FC<MusicPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  showTranslation,
  setShowTranslation,
  onBack,
  loadingProgress,
  fontWeight,
  letterSpacing,
  lineHeight,
  selectedFont,
  onSeek,
  formatTime
}) => {
  const coverRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);
  const manualScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [coverMousePos, setCoverMousePos] = React.useState({ x: 0, y: 0 });
  const [isCoverHovered, setIsCoverHovered] = React.useState(false);
  const [isManualScrolling, setIsManualScrolling] = React.useState(false);

  // 3D封面效果
  const handleCoverMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCoverMousePos({ x, y });
  }, []);

  const handleCoverMouseLeave = useCallback(() => {
    setIsCoverHovered(false);
    setCoverMousePos({ x: 0, y: 0 });
  }, []);

  // 歌词数据
  const lyricsList = track.metadata.parsedLyrics || [];
  const hasLyrics = lyricsList.length > 0;

  const lyricsType = React.useMemo(() => {
    if (!lyricsList.length) return 'none';
    const firstLine = lyricsList[0];
    if (firstLine.chars && firstLine.chars.length > 0) return 'word';
    return 'line';
  }, [lyricsList]);

  const activeIndex = React.useMemo(() => {
    if (!lyricsList.length) return -1;
    for (let i = lyricsList.length - 1; i >= 0; i--) {
      if (currentTime >= lyricsList[i].time) return i;
    }
    return -1;
  }, [currentTime, lyricsList]);

  // 处理用户交互的函数
  const handleUserInteraction = useCallback(() => {
    // 1. 设为手动模式，停止自动滚动
    setIsManualScrolling(true);

    // 2. 清除之前的计时器
    if (manualScrollTimerRef.current) {
      clearTimeout(manualScrollTimerRef.current);
    }

    // 3. 设置 5 秒后恢复自动滚动（仅在音乐播放时）
    manualScrollTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsManualScrolling(false);
      }
    }, 5000);
  }, [isPlaying]);

  // 自动滚动歌词
  useEffect(() => {
    // 如果处于手动操作期间，直接跳过自动滚动逻辑
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
        behavior: 'smooth'
      });
    }
  }, [activeIndex, isManualScrolling]);

  return (
    <div className="w-full h-full bg-transparent text-white flex flex-col pb-[80px]">
      {/* 加载条 */}
      {loadingProgress !== null && <ShimmerLoadingBar progress={loadingProgress} />}

      {/* Top Bar */}
      <header className="absolute top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-white/60">关闭播放页</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex relative z-10 overflow-hidden">
        {/* Left: Cover Art - 根据是否有歌词动态调整宽度 */}
        <section className={`h-full flex flex-col items-center justify-center p-8 lg:p-12 bg-transparent transition-all duration-500 ${hasLyrics ? 'w-[40%]' : 'w-full'}`}>
          <div
            ref={coverRef}
            onMouseMove={handleCoverMouseMove}
            onMouseEnter={() => setIsCoverHovered(true)}
            onMouseLeave={handleCoverMouseLeave}
            className="relative group w-full aspect-square max-w-[280px] lg:max-w-[320px] shrink-0"
          >
            <div className={`absolute -inset-4 md:-inset-8 opacity-20 blur-3xl rounded-full transition-all duration-1000 ${isPlaying ? 'scale-110' : 'scale-90'}`} style={{ backgroundColor: 'white' }} />
            <div
              className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl border border-white/20 bg-black/40 transition-transform duration-125 ease-out"
              style={{
                transform: isCoverHovered
                  ? `perspective(1000px) rotateX(${-coverMousePos.y * 25}deg) rotateY(${coverMousePos.x * 25}deg) scale3d(1.05, 1.05, 1.05)`
                  : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
                willChange: 'transform'
              }}
            >
              {track.metadata.coverUrl ? (
                <img
                  src={track.metadata.coverUrl}
                  alt="Cover"
                  className={`w-full h-full object-cover transition-transform duration-[5s] ease-linear ${isPlaying ? 'scale-125' : 'scale-100'}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music size={64} className="text-white/10" />
                </div>
              )}
            </div>
          </div>
          {/* Track Info - 移到封面下方 */}
          <div className="mt-8 text-center z-20 px-8">
            <h1 className="text-xl lg:text-2xl font-black text-white mb-2 tracking-tight">
              {track.metadata.title || track.file?.name.replace(/\.[^/.]+$/, '')}
            </h1>
            <p className="text-sm text-white/60 font-medium">
              {track.metadata.artist}
            </p>
            {/* Lyric Tags - AR & AL */}
            {(track.metadata.lyricArtist || track.metadata.lyricAlbum) && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {track.metadata.lyricArtist && (
                  <span className="text-xs text-white/60 font-medium tracking-wide bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                    AR: {track.metadata.lyricArtist}
                  </span>
                )}
                {track.metadata.lyricAlbum && (
                  <span className="text-xs text-white/60 font-medium tracking-wide bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                    AL: {track.metadata.lyricAlbum}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right: Lyrics - 60% 宽度，仅在有时显示 */}
        {hasLyrics && (
          <section className="w-[60%] h-full relative bg-transparent">

            {/* Lyrics Container */}
            <div
              ref={lyricsContainerRef}
              className="h-full overflow-y-auto px-8 py-32 hide-scrollbar"
              onWheel={handleUserInteraction}
              onTouchMove={handleUserInteraction}
              onMouseDown={handleUserInteraction}
            >
              <div className="flex flex-col items-center min-h-full">
                {lyricsList.map((line, idx) => (
                  <LyricLine
                    key={idx}
                    line={line}
                    idx={idx}
                    isActive={idx === activeIndex}
                    lyricsType={lyricsType}
                    currentTime={currentTime}
                    nextLineTime={lyricsList[idx + 1]?.time}
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
            </div>


          </section>
        )}
      </main>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite linear;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default memo(MusicPlayer);
