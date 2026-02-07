import React, { useRef, useEffect, useCallback, memo } from 'react';
import { 
  ChevronLeft, 
  Languages, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Repeat, 
  Repeat1, 
  Shuffle,
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
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCyclePlaybackMode: () => void;
  playbackMode: 'single' | 'list' | 'shuffle';
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
  <div className="fixed top-0 left-0 right-0 h-[2px] bg-white/5 z-[100] overflow-hidden">
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
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {/* 渐变背景 */}
    <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0a0c] to-black" />
    
    {/* 动态旋转封面背景 */}
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
    
    {/* 动态光晕 */}
    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse-slow" />
    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-[150px] animate-pulse-slow delay-2000" />
    
    {/* 网格效果 */}
    <div 
      className="absolute inset-0 opacity-[0.02]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }}
    />
  </div>
));

// 播放模式图标
const PlaybackModeIcon = memo(({ mode }: { mode: 'single' | 'list' | 'shuffle' }) => {
  if (mode === 'single') return <Repeat1 size={18} />;
  if (mode === 'list') return <Repeat size={18} />;
  return <Shuffle size={18} />;
});

const MusicPlayer: React.FC<MusicPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  showTranslation,
  setShowTranslation,
  onBack,
  onTogglePlay,
  onPrev,
  onNext,
  onCyclePlaybackMode,
  playbackMode,
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
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* 背景动画 */}
      <AnimatedBackground />
      
      {/* 加载条 */}
      {loadingProgress !== null && <ShimmerLoadingBar progress={loadingProgress} />}

      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-white/60">返回列表</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex relative z-10">
        {/* Left: Cover Art - 缩小尺寸 */}
        <section className="w-1/2 h-screen flex items-center justify-center p-8 lg:p-12">
          <div
            ref={coverRef}
            onMouseMove={handleCoverMouseMove}
            onMouseEnter={() => setIsCoverHovered(true)}
            onMouseLeave={handleCoverMouseLeave}
            className="relative w-full max-w-sm lg:max-w-md aspect-square"
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
                className="w-full h-full object-cover rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center">
                <Music size={48} className="text-white/20" />
              </div>
            )}
          </div>
        </section>

        {/* Right: Lyrics */}
        <section className="w-1/2 h-screen relative">
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

          {/* Gradient Masks */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-10" />
        </section>
      </main>

      {/* Bottom Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur-2xl border-t border-white/10 px-6 py-4 z-50">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          {/* Track Info */}
          <div className="flex items-center gap-4 w-1/4">
            {track.metadata.coverUrl ? (
              <img
                src={track.metadata.coverUrl}
                alt="Cover"
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <Music size={20} className="text-white/40" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">
                {track.metadata.title || track.file?.name.replace(/\.[^/.]+$/, '')}
              </p>
              <p className="text-white/50 text-xs truncate">{track.metadata.artist}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-2 flex-1 max-w-xl">
            <div className="flex items-center gap-6">
              <button
                onClick={onCyclePlaybackMode}
                className="text-white/60 hover:text-white transition-colors"
                title={playbackMode === 'single' ? '单曲循环' : playbackMode === 'list' ? '列表循环' : '随机播放'}
              >
                <PlaybackModeIcon mode={playbackMode} />
              </button>
              <button
                onClick={onPrev}
                className="text-white hover:text-white/80 transition-colors"
              >
                <SkipBack size={22} fill="currentColor" />
              </button>
              <button
                onClick={onTogglePlay}
                className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                onClick={onNext}
                className="text-white hover:text-white/80 transition-colors"
              >
                <SkipForward size={22} fill="currentColor" />
              </button>
              
              {/* 翻译按钮 - 仅在播放界面显示 */}
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`transition-all ${
                  showTranslation ? 'text-white' : 'text-white/40 hover:text-white/60'
                }`}
                title={showTranslation ? '隐藏翻译' : '显示翻译'}
              >
                <Languages size={18} />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full flex items-center gap-3 text-xs text-white/50">
              <span className="w-10 text-right">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  onSeek(percent * duration);
                }}
              >
                <div
                  className="h-full bg-white rounded-full transition-all group-hover:bg-white/90"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="w-10">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right spacer */}
          <div className="w-1/4" />
        </div>
      </footer>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite linear;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
        .delay-2000 {
          animation-delay: 2s;
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
