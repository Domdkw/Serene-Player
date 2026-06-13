import React, { memo } from 'react';
import { Music, Heart } from 'lucide-react';
import { LazyImage } from '../common';

/**
 * 歌曲卡片数据接口
 */
export interface SongCardData {
  id: number | object;  // 26.6.13: {id:{163:0000}} 多音乐源支持
  name: string;
  artist: string;
  coverUrl?: string;
  duration?: number;
  /** 音乐来源平台 */
  source?: string;
}

/**
 * 格式化时长
 */
const formatDuration = (duration?: number): string => {
  if (!duration) return '';
  const minutes = Math.floor(duration / 1000 / 60);
  const seconds = Math.floor((duration / 1000) % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * SongCard组件的Props接口
 */
interface SongCardProps {
  /** 歌曲数据 */
  song: SongCardData;
  /** 是否正在播放 */
  isPlaying?: boolean;
  /** 是否已喜欢 */
  isLiked?: boolean;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 点击歌曲的回调 */
  onClick?: () => void;
  /** 点击喜欢按钮的回调 */
  onToggleLike?: () => void;
  /** 是否显示时长 */
  showDuration?: boolean;
}

/**
 * 通用歌曲卡片组件
 */
const SongCard: React.FC<SongCardProps> = memo(({
  song,
  isPlaying = false,
  isLiked = false,
  isLoading = false,
  onClick,
  onToggleLike,
  showDuration = true
}) => {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 md:gap-4 p-1 md:p-2 transition-all cursor-pointer ${
        isPlaying
          ? 'bg-white/20 hover:bg-white/10'
          : 'bg-transparent hover:bg-white/10'
      }`}
    >
      {/* 封面 */}
      <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden rounded-lg">
        {song.coverUrl ? (
          <LazyImage
            src={song.coverUrl}
            alt={song.name}
            className="w-full h-full object-cover"
            placeholder={<Music size={16} className="text-white/40" />}
          />
        ) : (
          <Music size={16} className="text-white/40" />
        )}
      </div>

      {/* 歌曲信息 */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className={`font-medium truncate text-sm md:text-base flex-1 min-w-0 ${
          isPlaying ? 'text-white' : 'text-white/90'
        }`}>
          {song.name}
        </p>
        <p className="text-xs md:text-sm text-white/50 truncate flex-1 min-w-0">
          {song.artist}
        </p>
      </div>

      {/* 时长 */}
      {showDuration && song.duration && (
        <div className="hidden md:block text-sm text-white/40 flex-shrink-0">
          {formatDuration(song.duration)}
        </div>
      )}

      {/* 喜欢按钮 */}
      {onToggleLike && (
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike();
            }}
            disabled={isLoading}
            className={`w-4 h-4 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all ${
              isLiked
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
            }`}
            title={isLiked ? '从喜欢中移除' : '添加到喜欢'}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>
      )}
    </div>
  );
});

export default SongCard;
