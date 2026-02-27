import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, Repeat, Repeat1, Shuffle, AlertCircle, AlertTriangle, Disc, Cloud, HardDrive } from 'lucide-react';
import { Track } from '../types';

interface MiniPlayerBarProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackMode: 'single' | 'list' | 'shuffle';
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCyclePlaybackMode: () => void;
  onSeek: (time: number) => void;
  onOpenPlayer: () => void;
  isFullPlayerOpen: boolean;
  formatTime: (time: number) => string;
}

const PlaybackModeIcon = memo(({ mode }: { mode: 'single' | 'list' | 'shuffle' }) => {
  if (mode === 'single') return <Repeat1 size={18} />;
  if (mode === 'list') return <Repeat size={18} />;
  return <Shuffle size={18} />;
});

const MiniPlayerBar: React.FC<MiniPlayerBarProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  playbackMode,
  audioRef,
  onTogglePlay,
  onPrev,
  onNext,
  onCyclePlaybackMode,
  onSeek,
  onOpenPlayer,
  isFullPlayerOpen,
  formatTime
}) => {
  const hasTrack = track !== null;
  const hasLyrics = hasTrack && track.metadata.parsedLyrics && track.metadata.parsedLyrics.length > 0;
  const isStreaming = hasTrack && track.sourceType === 'streaming';
  const [isDiscHovered, setIsDiscHovered] = useState(false);
  const discRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  /**
   * 处理进度条鼠标移动事件
   * @param e - 鼠标事件
   */
  const handleProgressMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasTrack || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
    setHoverPosition(e.clientX - rect.left);
  }, [hasTrack, duration]);

  /**
   * 处理进度条鼠标离开事件
   */
  const handleProgressMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  // 处理圆盘滚动事件
  const handleDiscWheel = useCallback((e: WheelEvent) => {
    if (!hasTrack || duration <= 0) return;
    e.preventDefault();
    
    // 每次滚动调整5秒
    const seekStep = 5;
    const delta = e.deltaY > 0 ? seekStep : -seekStep;
    let newTime = currentTime + delta;
    
    // 限制在有效范围内
    newTime = Math.max(0, Math.min(duration, newTime));
    
    onSeek(newTime);
  }, [hasTrack, duration, currentTime, onSeek]);

  // 添加非被动事件监听器以允许 preventDefault
  useEffect(() => {
    const discElement = discRef.current;
    if (discElement) {
      discElement.addEventListener('wheel', handleDiscWheel, { passive: false });
      return () => {
        discElement.removeEventListener('wheel', handleDiscWheel);
      };
    }
  }, [handleDiscWheel]);

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-black/10 backdrop-blur-xl border-t border-white/10 z-[70] overflow-visible">
      {/* 播放进度条 - 移到顶部，宽度占满整个播放栏 */}
      <div
        ref={progressRef}
        className={`relative w-full h-1.5 bg-white/10 ${hasTrack ? 'cursor-pointer' : ''}`}
        onClick={(e) => {
          if (!hasTrack) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          onSeek(percent * duration);
        }}
        onMouseMove={handleProgressMouseMove}
        onMouseLeave={handleProgressMouseLeave}
      >
        <div
          className="h-full bg-white rounded-full transition-all"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
        {/* 悬停时间提示框 */}
        {hoverTime !== null && hasTrack && (
          <div
            className="absolute -top-10 px-4 py-2 bg-black/60 backdrop-blur-sm text-ml text-white rounded-lg pointer-events-none transform -translate-x-1/2 z-[80]"
            style={{ left: hoverPosition }}
          >
            {formatTime(hoverTime)}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/80" />
          </div>
        )}
      </div>
      <div className="relative px-6 py-3">
        <div className="relative z-10 flex items-center justify-between max-w-screen-2xl mx-auto">
          <button
            onClick={hasTrack ? onOpenPlayer : undefined}
            className={`flex items-center gap-4 w-1/4 rounded-xl p-2 -ml-2 transition-colors ${
              hasTrack ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'
            }`}
            title={isFullPlayerOpen ? '关闭播放页' : '打开播放页'}
          >
            {hasTrack && track.metadata.coverUrl ? (
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
              <p className={`font-medium text-sm truncate ${hasTrack ? 'text-white' : 'text-white/40'}`}>
                {hasTrack
                  ? (track.metadata.title || track.file?.name.replace(/\.[^/.]+$/, ''))
                  : ''}
              </p>
              <p className="text-white/50 text-xs truncate">
                {hasTrack ? track.metadata.artist : ''}
              </p>
            </div>
          </button>

          <div className="flex flex-col items-center gap-2 flex-1 max-w-xl">
            <div className="flex items-center gap-6">
              <button
                onClick={onCyclePlaybackMode}
                disabled={!hasTrack}
                className={`transition-colors ${hasTrack ? 'text-white/60 hover:text-white' : 'text-white/30 cursor-not-allowed'}`}
                title={playbackMode === 'single' ? '单曲循环' : playbackMode === 'list' ? '列表循环' : '随机播放'}
              >
                <PlaybackModeIcon mode={playbackMode} />
              </button>
              <button
                onClick={onPrev}
                disabled={!hasTrack}
                className={`transition-colors ${hasTrack ? 'text-white hover:text-white/80' : 'text-white/30 cursor-not-allowed'}`}
              >
                <SkipBack size={22} fill="currentColor" />
              </button>
              <button
                onClick={onTogglePlay}
                disabled={!hasTrack}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform ${
                  hasTrack 
                    ? 'bg-white text-black hover:scale-105' 
                    : 'bg-white/20 text-white/40 cursor-not-allowed'
                }`}
              >
                {isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                onClick={onNext}
                disabled={!hasTrack}
                className={`transition-colors ${hasTrack ? 'text-white hover:text-white/80' : 'text-white/30 cursor-not-allowed'}`}
              >
                <SkipForward size={22} fill="currentColor" />
              </button>
              {hasTrack && !hasLyrics && (
                <div className="relative group">
                  <AlertTriangle
                    size={16}
                    className="text-yellow-400 cursor-help"
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                    此歌曲没有内嵌歌词
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/80"></div>
                  </div>
                </div>
              )}
              {isStreaming && (
                <div className="relative group">
                  <Cloud size={16} className="text-blue-400" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                    流媒体播放
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/80"></div>
                  </div>
                </div>
              )}
            </div>
            
          </div>

          <div className="w-1/4 flex justify-end items-center gap-4">
            {/* 圆盘图标 - 滚动控制播放进度 */}
            <div
              ref={discRef}
              onMouseEnter={() => setIsDiscHovered(true)}
              onMouseLeave={() => setIsDiscHovered(false)}
              className={`relative flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                hasTrack 
                  ? 'cursor-pointer hover:bg-white/10' 
                  : 'cursor-not-allowed opacity-30'
              }`}
              title={hasTrack ? '滚动鼠标快速调整播放进度' : ''}
            >
              <Disc 
                size={18} 
                className={`transition-all duration-200 ${
                  isDiscHovered && hasTrack ? 'text-white rotate-180' : 'text-white/50'
                }`}
                style={{
                  transform: isDiscHovered && hasTrack ? 'rotate(180deg)' : `rotate(${duration ? (currentTime / duration) * 360 : 0}deg)`,
                  transition: 'transform 0.3s ease-out'
                }}
              />
              {/* 悬停提示 */}
              {isDiscHovered && hasTrack && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 backdrop-blur-sm text-[10px] text-white rounded whitespace-nowrap pointer-events-none border border-white/10">
                  滚动调整进度
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/80"></div>
                </div>
              )}
            </div>
            
            {/* 时间显示 */}
            <span className="text-xs text-white/50 whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(MiniPlayerBar);
