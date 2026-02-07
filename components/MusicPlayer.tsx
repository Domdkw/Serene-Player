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
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5 z-[100] overflow-hidden">
    <div 
      className="h-full relative overflow-hidden transition-all duration-300 ease-out"
      style={{ width: `${progress}%` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-80" />
    </div>
  </div>
));

// 背景动画组件
const AnimatedBackground = memo(({ coverUrl }: { coverUrl?: string | null }) => (
  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-neutral-900">
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
  
  const [coverMousePos, setCoverMousePos] = React.useState({ x: 0, y: 0 });
  const [isCoverHovered, setIsCoverHovered] = React.useState(false);

  // 3D封面效果
  const handleCoverMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCoverMousePos({ x: x * 15, y: -y * 15 });
  }, []);

  const handleCoverMouseLeave = useCallback(() => {
    setIsCoverHovered(false);
    setCoverMousePos({ x: 0, y: 0 });
  }, []);

  // 歌词数据
  const lyricsList = track.metadata.parsedLyrics || [];
  
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

  // 自动滚动歌词
  useEffect(() => {
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
  }, [activeIndex]);

  return (
    <div className="w-full h-full bg-black text-white flex flex-col pb-[80px]">
      {/* 背景动画 */}
      <AnimatedBackground coverUrl={track.metadata.coverUrl} />
      
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
        {/* Left: Cover Art - 40% 宽度，缩小尺寸 */}
        <section className="w-[40%] h-full flex items-center justify-center p-8 lg:p-12 bg-transparent">
          <div
            ref={coverRef}
            onMouseMove={handleCoverMouseMove}
            onMouseEnter={() => setIsCoverHovered(true)}
            onMouseLeave={handleCoverMouseLeave}
            className="relative w-full max-w-[280px] lg:max-w-[320px] aspect-square"
            style={{
              perspective: '1000px',
              transform: `rotateY(${coverMousePos.x}deg) rotateX(${coverMousePos.y}deg)`,
              transition: isCoverHovered ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out'
            }}
          >
            {track.metadata.coverUrl ? (
              <img
                src={track.metadata.coverUrl}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music size={48} className="text-white/20" />
              </div>
            )}
          </div>
        </section>

        {/* Right: Lyrics - 60% 宽度 */}
        <section className="w-[60%] h-full relative bg-transparent">
          {/* Track Info */}
          <div className="absolute top-20 left-0 right-0 text-center z-20 px-8">
            <h1 className="text-xl lg:text-2xl font-black text-white mb-2 tracking-tight">
              {track.metadata.title || track.file?.name.replace(/\.[^/.]+$/, '')}
            </h1>
            <p className="text-sm text-white/60 font-medium">
              {track.metadata.artist}
            </p>
          </div>

          {/* Lyrics Container */}
          <div
            ref={lyricsContainerRef}
            className="h-full overflow-y-auto px-8 py-32 hide-scrollbar"
          >
            {lyricsList.length > 0 ? (
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
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                <Loader2 size={32} className="animate-spin opacity-20" />
                <p className="text-sm italic font-medium tracking-tight opacity-40">No synchronized lyrics available</p>
              </div>
            )}
          </div>


        </section>
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
        @keyframes rotate-cover {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
        .animate-rotate-cover {
          animation: rotate-cover 60s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default memo(MusicPlayer);
