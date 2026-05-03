import React, { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { Copy, Check, RefreshCw, Clock, Link, AlertCircle, Music, Heart } from 'lucide-react';
import { ShareConfig } from '../../hooks/useSharePanel';
import { SharedSong } from '../../utils/songEncodingUtils';
import { MobileBottomSheet } from '../layout';
import { getSongDetail, getAlbumCoverUrl } from '../../apis/netease';
import { SongCard, SongCardData } from '../common';
import { FavoriteSong, loadFavorites, saveFavorites, isSongFavorite, addFavorite, removeFavorite, dispatchFavoritesUpdate } from '../../utils/NEfavorites';

/**
 * 歌曲详情缓存接口
 */
interface SongDetailCache {
  coverUrl?: string;
  duration?: number;
}

/**
 * SharePanel组件的Props接口
 */
interface SharePanelProps {
  /** 是否显示面板 */
  isOpen: boolean;
  /** 关闭面板的回调 */
  onClose: () => void;
  /** 分享配置 */
  config: ShareConfig;
  /** 更新配置的回调 */
  updateConfig: <K extends keyof ShareConfig>(key: K, value: ShareConfig[K]) => void;
  /** 生成的分享URL */
  shareUrl: string;
  /** 重置配置的回调 */
  resetConfig: () => void;
  /** 读取当前时间的回调 */
  onReadCurrentTime: () => void;
  /** 读取当前地址的回调 */
  onReadCurrentUrl: () => void;
  /** 读取当前歌曲信息的回调 */
  onReadCurrentTrack?: () => void;
  /** 复制到剪贴板的回调 */
  onCopy: () => Promise<boolean>;
  /** 验证配置的回调 */
  onValidate: () => { isValid: boolean; errors: string[] };
  /** 当前播放时间（秒） */
  currentTime?: number;
  /** 是否为移动端模式 */
  isMobile?: boolean;
  /** 分享过来的歌曲列表 */
  sharedSongs?: SharedSong[];
  /** 读取"我喜欢"歌单的回调 */
  onReadLikedSongs?: (songs: SharedSong[]) => void;
}

/**
 * 复选框组件Props
 */
interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

/**
 * 复选框组件
 */
const CheckboxField = memo<CheckboxFieldProps>(({
  label,
  checked,
  onChange,
  disabled = false,
  hint
}) => (
  <div className="flex items-start gap-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-white
        focus:ring-2 focus:ring-white/20 focus:ring-offset-0 cursor-pointer"
    />
    <div className="flex-1">
      <label className={`text-sm ${disabled ? 'text-white/30' : 'text-white/80'} cursor-pointer`}>
        {label}
      </label>
      {hint && (
        <p className="text-xs text-white/40 mt-0.5">{hint}</p>
      )}
    </div>
  </div>
));

/**
 * SharePanel组件
 * 用于生成和分享带有查询参数的URL
 */
const SharePanel: React.FC<SharePanelProps> = memo(({
  isOpen,
  onClose,
  config,
  updateConfig,
  shareUrl,
  resetConfig,
  onReadCurrentTime,
  onReadCurrentUrl,
  onReadCurrentTrack,
  onCopy,
  onValidate,
  isMobile = false,
  sharedSongs = [],
  onReadLikedSongs
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [songDetailsCache, setSongDetailsCache] = useState<Map<number, SongDetailCache>>(new Map());
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteSong[]>(() => loadFavorites());

  /**
   * 检查歌曲是否已喜欢
   */
  const isFavorite = useCallback((songId: number) => {
    return isSongFavorite(favorites, songId);
  }, [favorites]);

  /**
   * 切换喜欢状态
   */
  const toggleFavorite = useCallback(async (songId: number) => {
    const isAlreadyFavorite = isFavorite(songId);

    if (isAlreadyFavorite) {
      setFavorites(prev => {
        const newFavorites = removeFavorite(prev, songId);
        saveFavorites(newFavorites);
        return newFavorites;
      });
    } else {
      const cachedDetail = songDetailsCache.get(songId);
      const sharedSong = sharedSongs.find(s => s.id === songId);
      
      const newFavorite: FavoriteSong = {
        id: songId,
        name: sharedSong?.name || '',
        artist: sharedSong?.artist || '',
        artistIds: [],
        album: '',
        coverUrl: cachedDetail?.coverUrl || '',
        duration: cachedDetail?.duration || 0,
        addedAt: Date.now(),
      };

      setFavorites(prev => {
        const newFavorites = addFavorite(prev, newFavorite);
        saveFavorites(newFavorites);
        return newFavorites;
      });
    }
    
    dispatchFavoritesUpdate();
  }, [isFavorite, songDetailsCache, sharedSongs]);

  /**
   * 获取分享歌曲的详情（封面等）
   */
  useEffect(() => {
    if (sharedSongs.length === 0) return;

    const fetchDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const ids = sharedSongs.map(s => s.id);
        const details = await getSongDetail(ids);
        const newCache = new Map<number, SongDetailCache>();
        details.forEach(detail => {
          newCache.set(detail.id, {
            coverUrl: detail.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 200) : undefined,
            duration: detail.duration
          });
        });
        setSongDetailsCache(newCache);
      } catch (error) {
        console.error('获取歌曲详情失败:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [sharedSongs]);

  /**
   * 处理复制操作
   */
  const handleCopy = useCallback(async () => {
    const validation = onValidate();
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }
    
    setValidationErrors([]);
    const success = await onCopy();
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [onCopy, onValidate]);

  /**
   * 处理重置操作
   */
  const handleReset = useCallback(() => {
    resetConfig();
    setValidationErrors([]);
  }, [resetConfig]);

  /**
   * 读取"我喜欢"歌单
   */
  const handleReadLikedSongs = useCallback(() => {
    if (onReadLikedSongs) {
      const favorites = JSON.parse(localStorage.getItem('netease_favorites') || '[]');
      const songs: SharedSong[] = favorites.map((fav: any) => ({
        id: fav.id,
        name: fav.name,
        artist: fav.artist
      }));
      onReadLikedSongs(songs);
    }
  }, [onReadLikedSongs]);

  const panelContent = (
    <div className="px-5">
      {/* 分享过来的歌曲列表 */}
      {sharedSongs.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={18} className="text-red-400" fill="currentColor" />
            <span className="text-lg font-medium text-white">分享的歌单</span>
            <span className="text-sm text-white/50">({sharedSongs.length}首)</span>
            {isLoadingDetails && (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            )}
          </div>
          
          <div className="ml-3 max-h-80 overflow-y-auto space-y-1.5 bg-white/5 p-3">
            {sharedSongs.map((song) => {
              const cachedDetail = songDetailsCache.get(song.id);

              const songCardData: SongCardData = {
                id: song.id,
                name: song.name,
                artist: song.artist,
                coverUrl: cachedDetail?.coverUrl,
                duration: cachedDetail?.duration
              };

              return (
                <SongCard
                  key={song.id}
                  song={songCardData}
                  isLiked={isFavorite(song.id)}
                  onToggleLike={() => toggleFavorite(song.id)}
                  showDuration={true}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="text-lg font-medium text-white mb-4">分享设置</div>
      <div className="px-2">

        {/* 读取当前歌曲按钮 */}
        {onReadCurrentTrack && (
          <button
            onClick={onReadCurrentTrack}
            className="w-full flex mb-4 items-center justify-center gap-2 px-4 py-2 rounded-lg 
              bg-white/10 hover:bg-white/20 text-white border border-white/10 
              font-medium text-sm transition-all"
          >
            <Music size={16} />
            读取当前歌曲
          </button>
        )}

        {/* 播放选项区域 */}
        <div className="space-y-3">
          <div className="space-y-2">
            <CheckboxField
              label="播放网易云音乐歌曲"
              checked={config.enableNeteaseMusicId}
              onChange={(checked) => updateConfig('enableNeteaseMusicId', checked)}
            />
            {config.enableNeteaseMusicId && (
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="text"
                  value={config.neteaseMusicId}
                  onChange={(e) => updateConfig('neteaseMusicId', e.target.value)}
                  placeholder="输入歌曲ID"
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
                    text-white text-sm placeholder:text-white/30 focus:outline-none 
                    focus:ring-2 focus:ring-white/20 transition-all"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <CheckboxField
              label="指定本地音乐列表中的歌曲"
              checked={config.enableTrackIndex}
              onChange={(checked) => updateConfig('enableTrackIndex', checked)}
            />
            {config.enableTrackIndex && (
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="number"
                  value={config.trackIndex}
                  onChange={(e) => updateConfig('trackIndex', e.target.value)}
                  placeholder="输入索引"
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
                    text-white text-sm placeholder:text-white/30 focus:outline-none 
                    focus:ring-2 focus:ring-white/20 transition-all"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckboxField
                label="分享我喜欢歌单"
                checked={config.enableLikedSongs}
                onChange={(checked) => updateConfig('enableLikedSongs', checked)}
                disabled={favorites.length === 0}
              />
              {config.enableLikedSongs && onReadLikedSongs && (
                <button
                  onClick={handleReadLikedSongs}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-white/60 
                    hover:text-white hover:bg-white/10 rounded transition-colors"
                >
                  <Heart size={14} />读取({favorites.length}首)
                </button>
              )}
            </div>
            {favorites.length === 0 && (
              <p className="text-xs text-white/40 pl-6">还没有喜欢的歌曲</p>
            )}
          </div>

          <div className="pt-1 space-y-2">
            <CheckboxField
              label="打开播放器界面"
              checked={config.openPlayer}
              onChange={(checked) => updateConfig('openPlayer', checked)}
            />
            <CheckboxField
              label="自动播放"
              checked={config.autoPlay}
              onChange={(checked) => updateConfig('autoPlay', checked)}
            />
            <CheckboxField
              label="保留URL参数"
              checked={config.keepParams}
              onChange={(checked) => updateConfig('keepParams', checked)}
              hint="默认情况下，URL参数会在处理完成后自动清除"
            />
          </div>
        </div>

        {/* 高级选项区域 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/80 whitespace-nowrap">空降时间点</label>
            <button
              onClick={onReadCurrentTime}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-white/60 
                hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <Clock size={14} />读取时间
            </button>
            <input
              type="text"
              value={config.seekTo}
              onChange={(e) => updateConfig('seekTo', e.target.value)}
              placeholder="支持秒数(120)或时间格式(1:30)"
              className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
                text-white text-sm placeholder:text-white/30 focus:outline-none 
                focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-white/80 whitespace-nowrap">播放列表来源</label>
            <button
              onClick={onReadCurrentUrl}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-white/60 
                hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <Link size={14} />读取设置
            </button>
            <input
              type="text"
              value={config.playlistOrigin}
              onChange={(e) => updateConfig('playlistOrigin', e.target.value)}
              placeholder="输入播放列表URL"
              className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
                text-white text-sm placeholder:text-white/30 focus:outline-none 
                focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>
        </div>

        {/* 错误提示 */}
        {validationErrors.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {validationErrors.map((error, index) => (
                  <p key={index} className="text-sm text-red-300">{error}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 分享链接区域 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <textarea
              value={shareUrl}
              readOnly
              className="flex-1 h-16 px-3 py-2 bg-white/5 border border-white/10 rounded-lg 
                text-white text-xs font-mono placeholder:text-white/30 focus:outline-none 
                focus:ring-2 focus:ring-white/20 transition-all resize-none"
              placeholder="生成的分享链接将显示在这里..."
            />
            <button
              onClick={handleReset}
              className="flex items-center justify-center w-8 h-8 rounded-lg 
                text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="重置"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg 
              font-medium text-sm transition-all ${
                copySuccess 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
          >
            {copySuccess ? (
              <>
                <Check size={16} />
                复制成功
              </>
            ) : (
              <>
                <Copy size={16} />
                复制链接
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <MobileBottomSheet
        isOpen={isOpen}
        onClose={onClose}
        showCloseButton={true}
      >
        {panelContent}
      </MobileBottomSheet>
    );
  }

  return (
    <div className="w-full h-full backdrop-blur-xl rounded-xl overflow-hidden">
      <div className="h-full overflow-y-auto p-4">
        {panelContent}
      </div>
    </div>
  );
});

export default SharePanel;
