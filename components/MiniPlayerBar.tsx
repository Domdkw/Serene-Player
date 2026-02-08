import React, { memo, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, Repeat, Repeat1, Shuffle, Languages, AlertCircle } from 'lucide-react';
import { Track } from '../types';
import AudioSpectrum from './AudioSpectrum';

interface MiniPlayerBarProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackMode: 'single' | 'list' | 'shuffle';
  showTranslation: boolean;
  showSpectrum: boolean;
  spectrumFps: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCyclePlaybackMode: () => void;
  onToggleTranslation: () => void;
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
  showTranslation,
  showSpectrum,
  spectrumFps,
  audioRef,
  onTogglePlay,
  onPrev,
  onNext,
  onCyclePlaybackMode,
  onToggleTranslation,
  onSeek,
  onOpenPlayer,
  isFullPlayerOpen,
  formatTime
}) => {
  const hasTrack = track !== null;
  const hasLyrics = hasTrack && track.metadata.parsedLyrics && track.metadata.parsedLyrics.length > 0;

  // 使用useMemo缓存初始值，确保设置只在应用启动时读取一次
  const spectrumEnabled = useMemo(() => showSpectrum, []);
  const spectrumFrameRate = useMemo(() => spectrumFps, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-xl border-t border-white/10 z-[70] overflow-hidden">
      <div className="relative px-6 py-4">
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
              <div className="flex items-center gap-2">
                <p className={`font-medium text-sm truncate ${hasTrack ? 'text-white' : 'text-white/40'}`}>
                  {hasTrack
                    ? (track.metadata.title || track.file?.name.replace(/\.[^/.]+$/, ''))
                    : ''}
                </p>
                {hasTrack && !hasLyrics && (
                  <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20" title="此歌曲没有内嵌歌词">
                    <AlertCircle size={12} />
                    <span className="hidden sm:inline">无歌词</span>
                  </span>
                )}
              </div>
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
              <button
                onClick={onToggleTranslation}
                disabled={!hasTrack}
                className={`transition-all ${
                  hasTrack 
                    ? showTranslation ? 'text-white' : 'text-white/40 hover:text-white/60'
                    : 'text-white/20 cursor-not-allowed'
                }`}
                title={showTranslation ? '隐藏翻译' : '显示翻译'}
              >
                <Languages size={18} />
              </button>
            </div>
            
            <div className="w-full flex items-center gap-3 text-xs text-white/50">
              <span className="w-10 text-right">{formatTime(currentTime)}</span>
              <div 
                className={`flex-1 h-1 bg-white/10 rounded-full overflow-hidden ${hasTrack ? 'cursor-pointer' : ''}`}
                onClick={(e) => {
                  if (!hasTrack) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  onSeek(percent * duration);
                }}
              >
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="w-10">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="w-1/4 flex justify-end">
            {spectrumEnabled && (
              <div className="w-full max-w-[200px] h-16 relative">
                <AudioSpectrum 
                  audioRef={audioRef} 
                  isPlaying={isPlaying} 
                  enabled={spectrumEnabled}
                  fps={spectrumFrameRate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(MiniPlayerBar);
