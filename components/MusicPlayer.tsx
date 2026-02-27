import React, { useRef, useEffect, useCallback, memo, useState } from 'react';
import {
  ChevronLeft,
  Languages,
  Music,
  Loader2,
  Cloud,
  ChevronDown,
  Download,
  FileText
} from 'lucide-react';
import { Track, LyricLine as ParsedLyric } from '../types';
import { getFontFamily } from '../utils/fontUtils';
import { getArtistDetail, NeteaseArtistDetail } from '../apis/netease';
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
  const [artistPictures, setArtistPictures] = React.useState<NeteaseArtistDetail[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = React.useState(false);
  // 歌词显示/隐藏状态，默认显示歌词（如果存在）
  const [showLyrics, setShowLyrics] = React.useState(true);

  // 解析歌手ID - 使用 artistIds 字段
  const artistIds = React.useMemo(() => {
    const ids = track.artistIds;
    if (!ids || !Array.isArray(ids)) return [];
    return ids.filter(id => !isNaN(id));
  }, [track.artistIds]);

  // 加载歌手图片
  useEffect(() => {
    if (artistIds.length === 0) {
      setArtistPictures([]);
      return;
    }
    
    const fetchArtistPictures = async () => {
      setIsLoadingArtists(true);
      try {
        const promises = artistIds.map(id => getArtistDetail(id));
        const results = await Promise.all(promises);
        const validResults = results.filter((r): r is NeteaseArtistDetail => r !== null && r.picUrl !== '');
        setArtistPictures(validResults);
      } catch (error) {
        console.error('获取歌手图片失败:', error);
      } finally {
        setIsLoadingArtists(false);
      }
    };
    
    fetchArtistPictures();
  }, [artistIds]);

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
            <ChevronDown size={20} />
          </button>
          <span className="text-sm text-white/60">关闭播放页</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex relative z-10 overflow-hidden">
        {/* Left: Cover Art - 根据是否显示歌词动态调整宽度 */}
        <section className={`h-full flex flex-col items-center justify-center p-8 lg:p-12 bg-transparent transition-all duration-500 ${hasLyrics && showLyrics ? 'w-1/2' : 'w-full'}`}>
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
            {/* 歌手列表 - 头像与名称对应 */}
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              {artistPictures.length > 0 ? (
                artistPictures.map((artist, index) => (
                  <div key={`${artist.id}-${index}`} className="group relative flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default">
                    <img
                      src={artist.picUrl}
                      alt={artist.name}
                      className="w-6 h-6 rounded-full object-cover border border-white/20"
                    />
                    <span className="text-sm text-white/70 font-medium">{artist.name}</span>
                    {/* 悬停显示的歌手信息卡片 */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="bg-black/90 backdrop-blur-md rounded p-3 border border-white/10 shadow-xl">
                        {/* 歌手头像 */}
                        <div className="flex justify-center mb-2">
                          <img
                            src={artist.picUrl}
                            alt={artist.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                          />
                        </div>
                        {/* 歌手名称 */}
                        <h3 className="text-center text-white font-bold text-sm mb-1 truncate">{artist.name}</h3>
                        {/* 别名 */}
                        {artist.alias && artist.alias.length > 0 && (
                          <p className="text-center text-white/50 text-xs mb-2 truncate">
                            {artist.alias.join(' / ')}
                          </p>
                        )}
                        {/* 统计信息 */}
                        <div className="flex justify-center gap-4 text-xs text-white/60">
                          <div className="text-center">
                            <div className="font-semibold text-white">{artist.musicSize}</div>
                            <div>单曲</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-white">{artist.albumSize}</div>
                            <div>专辑</div>
                          </div>
                          {artist.followeds > 0 && (
                            <div className="text-center">
                              <div className="font-semibold text-white">
                                {artist.followeds >= 10000 
                                  ? `${(artist.followeds / 10000).toFixed(1)}万` 
                                  : artist.followeds}
                              </div>
                              <div>粉丝</div>
                            </div>
                          )}
                        </div>
                        {/* 简介 */}
                        {artist.briefDesc && (
                          <p className="mt-2 text-xs text-white/50 text-center">
                            {artist.briefDesc}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-sm text-white/60 font-medium">{track.metadata.artist}</span>
              )}
            </div>
            {/* 下载、歌词和翻译按钮 */}
            <div className="flex items-center justify-center gap-3 mt-4">
              {/* 下载按钮 */}
              <div className="relative group">
                <a
                  href={track.objectUrl}
                  download={`${track.metadata.title} - ${track.metadata.artist}.mp3`}
                  className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-all"
                >
                  <Download size={16} />
                </a>
              </div>
              {/* 歌词显示/隐藏按钮 - 仅在歌曲有歌词时显示 */}
              {hasLyrics && (
                <div className="relative group">
                  <button
                    onClick={() => setShowLyrics(!showLyrics)}
                    className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
                      showLyrics
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'text-white/70 hover:bg-white/20 hover:text-white'
                    }`}
                    title={showLyrics ? '隐藏歌词' : '显示歌词'}
                  >
                    <FileText size={16} />
                  </button>
                </div>
              )}
              {/* 翻译按钮 */}
              <div className="relative group">
                <button
                  onClick={() => setShowTranslation(!showTranslation)}
                  className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
                    showTranslation
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <Languages size={16} />
                </button>
              </div>
            </div>
            {/* Lyric Tags - AR & AL */}
            {(track.metadata.lyricArtist || track.metadata.lyricAlbum || track.sourceType === 'streaming') && (
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

        {/* Right: Lyrics - 50% 宽度，仅在显示歌词时显示 */}
        {hasLyrics && showLyrics && (
          <section className="w-1/2 h-full relative bg-transparent">

            {/* Lyrics Container */}
            <div
              ref={lyricsContainerRef}
              className="h-full overflow-y-auto px-12 hide-scrollbar"
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
