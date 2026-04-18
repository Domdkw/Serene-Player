import React, { memo, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle } from 'lucide-react';
import { PlaybackMode } from '../../types';

interface PlaybackControlsProps {
  isPlaying: boolean;
  hasTrack: boolean;
  hasPlaylist: boolean;
  playbackMode: PlaybackMode;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * 播放模式图标组件
 * 根据当前播放模式显示对应的图标
 */
const PlaybackModeIcon = memo(({ mode }: { mode: PlaybackMode }) => {
  if (mode === 'single') return <Repeat1 size={18} />;
  if (mode === 'list') return <Repeat size={18} />;
  return <Shuffle size={18} />;
});

/**
 * 播放控制组件
 * 提供播放/暂停、上一首、下一首、播放模式切换功能
 * 支持不同尺寸和自定义样式
 */
const PlaybackControls: React.FC<PlaybackControlsProps> = memo(({
  isPlaying,
  hasTrack,
  hasPlaylist,
  playbackMode,
  onTogglePlay,
  onPrev,
  onNext,
  size = 'md',
  className = '',
}) => {
  const sizeConfig = {
    sm: {
      button: 'w-10 h-10',
      icon: 22,
      sideIcon: 20,
    },
    md: {
      button: 'w-12 h-12 md:w-14 md:h-14',
      icon: 28,
      sideIcon: 28,
    },
    lg: {
      button: 'w-16 h-16',
      icon: 32,
      sideIcon: 32,
    },
  };

  const config = sizeConfig[size];

  const handleTogglePlay = useCallback(() => {
    if (hasTrack) {
      onTogglePlay();
    }
  }, [hasTrack, onTogglePlay]);

  const handlePrev = useCallback(() => {
    if (hasPlaylist) {
      onPrev();
    }
  }, [hasPlaylist, onPrev]);

  const handleNext = useCallback(() => {
    if (hasPlaylist) {
      onNext();
    }
  }, [hasPlaylist, onNext]);

  return (
    <div className={`flex items-center justify-center gap-6 ${className}`}>
      <button
        onClick={handlePrev}
        disabled={!hasPlaylist}
        className="text-white/30 hover:text-white transition-all disabled:opacity-5 active:scale-75"
      >
        <SkipBack size={config.sideIcon} />
      </button>

      <button
        onClick={handleTogglePlay}
        disabled={!hasTrack}
        className={`${config.button} rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-30`}
      >
        {isPlaying ? (
          <Pause size={config.icon} fill="currentColor" />
        ) : (
          <Play size={config.icon} fill="currentColor" className="ml-1" />
        )}
      </button>

      <button
        onClick={handleNext}
        disabled={!hasPlaylist}
        className="text-white/30 hover:text-white transition-all disabled:opacity-5 active:scale-75"
      >
        <SkipForward size={config.sideIcon} />
      </button>
    </div>
  );
});

PlaybackControls.displayName = 'PlaybackControls';

export default PlaybackControls;
