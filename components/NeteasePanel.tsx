import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Play, Pause, Music, Heart, Trash2, ArrowLeft } from 'lucide-react';
import { searchNeteaseMusic, getSongUrl, getSongDetail, getAlbumCoverUrl, getSongLyric, NeteaseSong, NeteaseSongDetail, formatDuration } from '../apis/netease';
import { PlaylistItem } from '../types';
import LazyImage from './LazyImage';

interface FavoriteSong {
  id: number;
  name: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  addedAt: number;
}

interface NeteasePanelProps {
  onTrackSelect: (item: PlaylistItem, index: number) => void;
  currentTrackUrl: string | null;
  isPlaying: boolean;
  onAddToPlaylist: (item: PlaylistItem) => void;
}

const FAVORITES_STORAGE_KEY = 'netease_favorites';

const loadFavorites = (): FavoriteSong[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveFavorites = (favorites: FavoriteSong[]) => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
};

export const NeteasePanel: React.FC<NeteasePanelProps> = ({
  onTrackSelect,
  currentTrackUrl,
  isPlaying,
  onAddToPlaylist,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NeteaseSong[]>([]);
  const [songDetails, setSongDetails] = useState<Record<number, NeteaseSongDetail>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingSongId, setLoadingSongId] = useState<number | null>(null);
  const [localPlaylist, setLocalPlaylist] = useState<PlaylistItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteSong[]>(() => loadFavorites());
  const [showSearch, setShowSearch] = useState(() => loadFavorites().length === 0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * 当喜欢列表为空时，自动显示搜索界面
   */
  useEffect(() => {
    if (favorites.length === 0 && !showSearch) {
      setShowSearch(true);
    }
  }, [favorites.length, showSearch]);

  const isFavorite = useCallback((songId: number) => {
    return favorites.some(f => f.id === songId);
  }, [favorites]);

  const toggleFavorite = useCallback(async (song: NeteaseSong) => {
    const songId = song.id;
    const isAlreadyFavorite = isFavorite(songId);

    if (isAlreadyFavorite) {
      setFavorites(prev => {
        const newFavorites = prev.filter(f => f.id !== songId);
        saveFavorites(newFavorites);
        return newFavorites;
      });
    } else {
      const detail = songDetails[songId];
      const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 200) : '';
      
      const newFavorite: FavoriteSong = {
        id: songId,
        name: song.name,
        artist: song.artists.map(a => a.name).join(', '),
        album: song.album.name,
        coverUrl,
        duration: song.duration,
        addedAt: Date.now(),
      };

      setFavorites(prev => {
        const newFavorites = [newFavorite, ...prev];
        saveFavorites(newFavorites);
        return newFavorites;
      });
    }
  }, [favorites, isFavorite, songDetails]);

  const clearFavorites = useCallback(() => {
    if (confirm('确定要清空所有喜欢的歌曲吗？')) {
      setFavorites([]);
      saveFavorites([]);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const result = await searchNeteaseMusic(searchQuery.trim());
      setSearchResults(result.songs);

      if (result.songs.length > 0) {
        const songIds = result.songs.map(song => song.id);
        const details = await getSongDetail(songIds);
        const detailsMap: Record<number, NeteaseSongDetail> = {};
        details.forEach(detail => {
          detailsMap[detail.id] = detail;
        });
        setSongDetails(detailsMap);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handlePlaySong = useCallback(async (song: NeteaseSong) => {
    setLoadingSongId(song.id);

    try {
      const songUrl = await getSongUrl(song.id);

      if (!songUrl) {
        console.error('无法获取歌曲URL');
        return;
      }

      const detail = songDetails[song.id];
      const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 800, true) : null;

      let lyrics: string | undefined;
      try {
        const lyricData = await getSongLyric(song.id);
        if (lyricData && lyricData.lyric) {
          lyrics = lyricData.lyric;
        }
      } catch (e) {
        console.warn('获取歌词失败:', e);
      }

      const playlistItem: PlaylistItem = {
        name: song.name,
        artist: song.artists.map(a => a.name).join(', '),
        url: songUrl,
        themeColor: '#C20C0C',
        neteaseId: song.id,
        coverUrl: coverUrl || undefined,
        lyrics: lyrics,
        album: detail?.album.name || song.album.name,
      };

      const existingIndex = localPlaylist.findIndex(p => p.url === songUrl);
      let index: number;

      if (existingIndex === -1) {
        setLocalPlaylist(prev => [...prev, playlistItem]);
        index = localPlaylist.length;
      } else {
        index = existingIndex;
      }

      onTrackSelect(playlistItem, index);
    } catch (error) {
      console.error('播放歌曲失败:', error);
    } finally {
      setLoadingSongId(null);
    }
  }, [localPlaylist, onTrackSelect, songDetails]);

  const handlePlayFavorite = useCallback(async (favorite: FavoriteSong) => {
    setLoadingSongId(favorite.id);

    try {
      const songUrl = await getSongUrl(favorite.id);

      if (!songUrl) {
        console.error('无法获取歌曲URL');
        return;
      }

      let lyrics: string | undefined;
      try {
        const lyricData = await getSongLyric(favorite.id);
        if (lyricData && lyricData.lyric) {
          lyrics = lyricData.lyric;
        }
      } catch (e) {
        console.warn('获取歌词失败:', e);
      }

      const playlistItem: PlaylistItem = {
        name: favorite.name,
        artist: favorite.artist,
        url: songUrl,
        themeColor: '#C20C0C',
        neteaseId: favorite.id,
        coverUrl: favorite.coverUrl,
        lyrics: lyrics,
        album: favorite.album,
      };

      const existingIndex = localPlaylist.findIndex(p => p.url === songUrl);
      let index: number;

      if (existingIndex === -1) {
        setLocalPlaylist(prev => [...prev, playlistItem]);
        index = localPlaylist.length;
      } else {
        index = existingIndex;
      }

      onTrackSelect(playlistItem, index);
    } catch (error) {
      console.error('播放歌曲失败:', error);
    } finally {
      setLoadingSongId(null);
    }
  }, [localPlaylist, onTrackSelect]);

  const handleAddToPlaylist = useCallback(async (song: NeteaseSong) => {
    setLoadingSongId(song.id);

    try {
      const songUrl = await getSongUrl(song.id);

      if (!songUrl) {
        console.error('无法获取歌曲URL');
        return;
      }

      const detail = songDetails[song.id];
      const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 800, true) : null;

      let lyrics: string | undefined;
      try {
        const lyricData = await getSongLyric(song.id);
        if (lyricData && lyricData.lyric) {
          lyrics = lyricData.lyric;
        }
      } catch (e) {
        console.warn('获取歌词失败:', e);
      }

      const playlistItem: PlaylistItem = {
        name: song.name,
        artist: song.artists.map(a => a.name).join(', '),
        url: songUrl,
        themeColor: '#C20C0C',
        coverUrl: coverUrl || undefined,
        lyrics: lyrics,
        album: detail?.album.name || song.album.name,
      };

      onAddToPlaylist(playlistItem);
    } catch (error) {
      console.error('添加歌曲失败:', error);
    } finally {
      setLoadingSongId(null);
    }
  }, [onAddToPlaylist, songDetails]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const renderSearchResults = () => (
    <div className="space-y-2">
      {searchResults.map((song) => {
        const isCurrentTrack = currentTrackUrl && localPlaylist.some(
          p => p.url === currentTrackUrl && p.name === song.name
        );
        const isLoading = loadingSongId === song.id;
        const detail = songDetails[song.id];
        const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 200) : null;
        const isLiked = isFavorite(song.id);

        return (
          <div
            key={song.id}
            className={`group flex items-center gap-4 p-4 rounded-xl transition-all ${
              isCurrentTrack
                ? 'bg-white/10 border border-white/20'
                : 'bg-white/5 border border-white/[0.05] hover:bg-white/[0.08]'
            }`}
          >
            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {coverUrl ? (
                <LazyImage
                  src={coverUrl}
                  alt={song.name}
                  className="w-full h-full object-cover"
                  placeholder={<Music size={20} className="text-white/40" />}
                />
              ) : (
                <Music size={20} className="text-white/40" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${isCurrentTrack ? 'text-white' : 'text-white/90'}`}>
                {song.name}
              </p>
              <p className="text-sm text-white/50 truncate">
                {song.artists.map(a => a.name).join(', ')} · {song.album.name}
              </p>
            </div>

            <div className="text-sm text-white/40 flex-shrink-0">
              {formatDuration(song.duration)}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(song)}
                disabled={isLoading}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isLiked 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                    : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                }`}
                title={isLiked ? '从喜欢中移除' : '添加到喜欢'}
              >
                <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
              </button>

              <button
                onClick={() => handlePlaySong(song)}
                disabled={isLoading}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 flex items-center justify-center text-white transition-all"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isCurrentTrack && isPlaying ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderFavorites = () => {
    if (favorites.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white/40">
          <Heart size={48} className="mb-4 opacity-50" />
          <p>还没有喜欢的歌曲</p>
          <p className="text-sm mt-2">点击搜索按钮搜索并添加喜欢的歌曲</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {favorites.map((favorite) => {
          const isCurrentTrack = currentTrackUrl && localPlaylist.some(
            p => p.url === currentTrackUrl && p.name === favorite.name
          );
          const isLoading = loadingSongId === favorite.id;

          return (
            <div
              key={favorite.id}
              className={`group flex items-center gap-4 p-4 rounded-xl transition-all ${
                isCurrentTrack
                  ? 'bg-white/10 border border-white/20'
                  : 'bg-white/5 border border-white/[0.05] hover:bg-white/[0.08]'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {favorite.coverUrl ? (
                  <LazyImage
                    src={favorite.coverUrl}
                    alt={favorite.name}
                    className="w-full h-full object-cover"
                    placeholder={<Music size={20} className="text-white/40" />}
                  />
                ) : (
                  <Music size={20} className="text-white/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isCurrentTrack ? 'text-white' : 'text-white/90'}`}>
                  {favorite.name}
                </p>
                <p className="text-sm text-white/50 truncate">
                  {favorite.artist} · {favorite.album}
                </p>
              </div>

              <div className="text-sm text-white/40 flex-shrink-0">
                {formatDuration(favorite.duration)}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite({ id: favorite.id } as NeteaseSong)}
                  disabled={isLoading}
                  className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-all"
                  title="从喜欢中移除"
                >
                  <Heart size={18} fill="currentColor" />
                </button>

                <button
                  onClick={() => handlePlayFavorite(favorite)}
                  disabled={isLoading}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 flex items-center justify-center text-white transition-all"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isCurrentTrack && isPlaying ? (
                    <Pause size={18} />
                  ) : (
                    <Play size={18} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {showSearch ? '搜索歌曲' : '我喜欢'}
            </h2>
            <p className="text-white/40 text-sm">
              {showSearch ? '搜索并添加喜欢的歌曲' : `${favorites.length} 首歌曲`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {!showSearch && favorites.length > 0 && (
              <button
                onClick={clearFavorites}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-all flex items-center gap-2"
                title="清空喜欢列表"
              >
                <Trash2 size={16} />
              </button>
            )}
            
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all flex items-center gap-2"
            >
              {showSearch ? (
                <>
                  <ArrowLeft size={16} />
                  返回
                </>
              ) : (
                <>
                  <Search size={16} />
                  搜索
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索歌曲、艺术家..."
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/[0.05] rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                搜索中
              </>
            ) : (
              <>
                <Search size={18} />
                搜索
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto playlist-scrollbar">
        {showSearch ? (
          !hasSearched ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <Search size={48} className="mb-4 opacity-50" />
              <p>输入关键词开始搜索网易云音乐</p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <Loader2 size={48} className="mb-4 animate-spin" />
              <p>搜索中...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <Music size={48} className="mb-4 opacity-50" />
              <p>未找到匹配的歌曲</p>
            </div>
          ) : (
            renderSearchResults()
          )
        ) : (
          renderFavorites()
        )}
      </div>
    </div>
  );
};
