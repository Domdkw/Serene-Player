import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Search, Loader2, Play, Pause, Music, Heart, Trash2, Flame, TrendingUp, ChevronLeft } from 'lucide-react';
import { searchNeteaseMusic, getSongUrl, getSongDetail, getAlbumCoverUrl, getSongLyric, getHotSearchDetail, getSearchSuggestion, NeteaseSong, NeteaseSongDetail, NeteaseHotSearch, formatDuration } from '../apis/netease';
import { PlaylistItem } from '../types';
import LazyImage from './LazyImage';

interface FavoriteSong {
  id: number;
  name: string;
  artist: string;
  artistIds: number[];
  album: string;
  coverUrl: string;
  duration: number;
  addedAt: number;
}

export interface NeteasePanelRef {
  triggerSearch: (keyword: string, addToHistory?: boolean) => Promise<void>;
  openSearch: () => void;
}

interface NeteasePanelProps {
  onTrackSelect: (item: PlaylistItem, index: number) => void;
  currentTrackUrl: string | null;
  isPlaying: boolean;
  onAddToPlaylist: (item: PlaylistItem) => void;
  neteasePlaylist: PlaylistItem[];
  neteaseCurrentIndex: number;
  setNeteasePlaylist: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setNeteaseCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  onSearchComplete?: (results: NeteaseSong[]) => void;
}

interface LoadingStatus {
  loading: boolean;
  error: boolean;
  songId: number | null;
}

const FAVORITES_STORAGE_KEY = 'netease_favorites';
const SEARCH_HISTORY_KEY = 'netease_search_history';
const HOT_SEARCH_KEY = 'netease_hot_search';
const HOT_SEARCH_CACHE_DURATION = 5 * 60 * 1000; // 5 分钟
const SEARCH_HISTORY_LIMIT = 5;

const loadFavorites = (): FavoriteSong[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return parsed.map((fav: any) => ({
      ...fav,
      artistIds: fav.artistIds || [],
    }));
  } catch {
    return [];
  }
};

const saveFavorites = (favorites: FavoriteSong[]) => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
};

const loadSearchHistory = (): string[] => {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveSearchHistory = (history: string[]) => {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
};

const addSearchHistory = (keyword: string) => {
  const history = loadSearchHistory();
  const filtered = history.filter(h => h !== keyword);
  const newHistory = [keyword, ...filtered].slice(0, SEARCH_HISTORY_LIMIT);
  saveSearchHistory(newHistory);
  return newHistory;
};

interface HotSearchCache {
  data: NeteaseHotSearch[];
  timestamp: number;
}

const loadHotSearchCache = (): HotSearchCache | null => {
  try {
    const stored = localStorage.getItem(HOT_SEARCH_KEY);
    if (!stored) return null;
    
    const cache: HotSearchCache = JSON.parse(stored);
    const isExpired = Date.now() - cache.timestamp > HOT_SEARCH_CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(HOT_SEARCH_KEY);
      return null;
    }
    
    return cache;
  } catch {
    return null;
  }
};

const saveHotSearchCache = (data: NeteaseHotSearch[]) => {
  const cache: HotSearchCache = {
    data,
    timestamp: Date.now(),
  };
  localStorage.setItem(HOT_SEARCH_KEY, JSON.stringify(cache));
};

const NeteasePanelComponent: React.FC<NeteasePanelProps & { ref?: React.Ref<NeteasePanelRef> }> = ({
  onTrackSelect,
  currentTrackUrl,
  isPlaying,
  onAddToPlaylist,
  neteasePlaylist,
  neteaseCurrentIndex,
  setNeteasePlaylist,
  setNeteaseCurrentIndex,
  onSearchComplete,
  ref,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NeteaseSong[]>([]);
  const [songDetails, setSongDetails] = useState<Record<number, NeteaseSongDetail>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingSongId, setLoadingSongId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<FavoriteSong[]>(() => loadFavorites());
  const [activeTab, setActiveTab] = useState<'search' | 'favorites'>('favorites');
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());
  const [hotSearchList, setHotSearchList] = useState<NeteaseHotSearch[]>([]);
  const [suggestions, setSuggestions] = useState<{ keyword: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({ loading: false, error: false, songId: null });
  const skipSuggestionRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchQueryRef = useRef(searchQuery);

  /**
   * 喜欢列表为空时，保持显示"我喜欢"界面
   */

  // 更新 searchQueryRef
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);



  /**
   * 加载热搜列表（仅在打开搜索界面时）
   */
  useEffect(() => {
    if (activeTab !== 'search') {
      return;
    }

    const loadHotSearch = async () => {
      // 优先从缓存加载
      const cache = loadHotSearchCache();
      if (cache) {
        setHotSearchList(cache.data);
        return;
      }

      // 缓存不存在或已过期，从网络加载
      try {
        const result = await getHotSearchDetail();
        setHotSearchList(result);
        saveHotSearchCache(result);
      } catch (error) {
        console.error('加载热搜失败:', error);
      }
    };
    loadHotSearch();
  }, [activeTab]);

  /**
   * 搜索建议防抖
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // 如果是通过外部触发搜索（如点击歌手或搜索建议），跳过搜索建议
    if (skipSuggestionRef.current) {
      skipSuggestionRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const result = await getSearchSuggestion(searchQuery.trim());
        setSuggestions(result.allMatch);
        setShowSuggestions(true);
      } catch (error) {
        console.error('获取搜索建议失败:', error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        artistIds: song.artists.map(a => a.id),
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

  const handleSearch = useCallback(async (keyword?: string, addToHistory: boolean = true, writeToQuery: boolean = false) => {
    const searchWord = keyword || searchQueryRef.current;
    if (!searchWord.trim()) return;

    if (writeToQuery) {
      setSearchQuery(searchWord.trim());
    }

    setIsLoading(true);
    setHasSearched(true);
    setShowSuggestions(false);

    try {
      const result = await searchNeteaseMusic(searchWord.trim());
      setSearchResults(result.songs);
      
      if (addToHistory) {
        const newHistory = addSearchHistory(searchWord.trim());
        setSearchHistory(newHistory);
      }

      if (result.songs.length > 0) {
        const songIds = result.songs.map(song => song.id);
        const details = await getSongDetail(songIds);
        const detailsMap: Record<number, NeteaseSongDetail> = {};
        details.forEach(detail => {
          detailsMap[detail.id] = detail;
        });
        setSongDetails(detailsMap);
      }
      
      // 触发搜索完成回调
      if (onSearchComplete) {
        onSearchComplete(result.songs);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [onSearchComplete]);

  /**
   * 外部触发搜索（不计入历史记录，不显示搜索建议）
   */
  const triggerSearch = useCallback(async (keyword: string, addToHistory: boolean = false) => {
    // 设置跳过搜索建议标志
    skipSuggestionRef.current = true;
    
    // 直接设置搜索关键词，清空搜索建议并隐藏建议栏
    setSearchQuery(keyword);
    setSuggestions([]);
    setShowSuggestions(false);
    
    // 执行搜索，writeToQuery 设为 false 因为已经手动设置了 searchQuery
    return handleSearch(keyword, addToHistory, false);
  }, [handleSearch]);

  /**
   * 打开搜索界面
   */
  const openSearch = useCallback(() => {
    setActiveTab('search');
  }, []);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    triggerSearch,
    openSearch,
  }), [triggerSearch, openSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      handleSearch();
    }
  }, [handleSearch]);

  const handleHotSearchClick = useCallback((keyword: string) => {
    skipSuggestionRef.current = true;
    setSearchQuery(keyword);
    setShowSuggestions(false);
    handleSearch(keyword);
  }, [handleSearch]);

  const handleSuggestionClick = useCallback((keyword: string) => {
    skipSuggestionRef.current = true;
    setSearchQuery(keyword);
    setShowSuggestions(false);
    handleSearch(keyword);
    
    // 重新聚焦到输入框
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [handleSearch]);

  const handlePlaySong = useCallback(async (song: NeteaseSong) => {
    setLoadingSongId(song.id);
    setLoadingStatus({ loading: true, error: false, songId: song.id });

    try {
      const songUrl = await getSongUrl(song.id);

      if (!songUrl) {
        console.error('无法获取歌曲 URL');
        setLoadingStatus({ loading: false, error: true, songId: song.id });
        setLoadingSongId(null);
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
        artistIds: song.artists.map(a => a.id),
        coverUrl: coverUrl || undefined,
        lyrics: lyrics,
        album: detail?.album.name || song.album.name,
      };

      const currentPlaylist = neteasePlaylist || [];
      const existingIndex = currentPlaylist.findIndex(p => p.url === songUrl);
      let index: number;

      if (existingIndex === -1) {
        setNeteasePlaylist(prev => [...(prev || []), playlistItem]);
        index = currentPlaylist.length;
      } else {
        index = existingIndex;
      }

      onTrackSelect(playlistItem, index);
      setLoadingStatus({ loading: false, error: false, songId: null });
    } catch (error) {
      console.error('播放歌曲失败:', error);
      setLoadingStatus({ loading: false, error: true, songId: song.id });
    } finally {
      setLoadingSongId(null);
    }
  }, [neteasePlaylist, onTrackSelect, songDetails]);

  const handlePlayFavorite = useCallback(async (favorite: FavoriteSong) => {
    setLoadingSongId(favorite.id);
    setLoadingStatus({ loading: true, error: false, songId: favorite.id });

    try {
      const songUrl = await getSongUrl(favorite.id);

      if (!songUrl) {
        console.error('无法获取歌曲 URL');
        setLoadingStatus({ loading: false, error: true, songId: favorite.id });
        setLoadingSongId(null);
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
        artistIds: favorite.artistIds || [],
        coverUrl: favorite.coverUrl,
        lyrics: lyrics,
        album: favorite.album,
      };

      const currentPlaylist = neteasePlaylist || [];
      const existingIndex = currentPlaylist.findIndex(p => p.url === songUrl);
      let index: number;

      if (existingIndex === -1) {
        setNeteasePlaylist(prev => [...(prev || []), playlistItem]);
        index = currentPlaylist.length;
      } else {
        index = existingIndex;
      }

      onTrackSelect(playlistItem, index);
      setLoadingStatus({ loading: false, error: false, songId: null });
    } catch (error) {
      console.error('播放歌曲失败:', error);
      setLoadingStatus({ loading: false, error: true, songId: favorite.id });
    } finally {
      setLoadingSongId(null);
    }
  }, [neteasePlaylist, onTrackSelect]);

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
    if (activeTab === 'search' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [activeTab]);

  const renderLoadingBadge = () => {
    if (!loadingStatus.songId) return null;

    if (loadingStatus.loading) {
      return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-xl z-50 animate-pulse">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm font-medium">正在加载音乐...</span>
        </div>
      );
    }

    if (loadingStatus.error) {
      return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-xl z-50">
          <span className="text-sm font-medium">无法加载音乐</span>
        </div>
      );
    }

    return null;
  };

  const renderSearchResults = () => (
    <div className="space-y-1.5 md:space-y-2">
      {searchResults.map((song) => {
        const isCurrentTrack = currentTrackUrl && neteasePlaylist.some(
          p => p.url === currentTrackUrl && p.name === song.name
        );
        const isLoading = loadingSongId === song.id;
        const detail = songDetails[song.id];
        const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 200) : null;
        const isLiked = isFavorite(song.id);

        return (
          <div
            key={song.id}
            onClick={() => handlePlaySong(song)}
            className={`group flex items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl transition-all cursor-pointer relative ${
              isCurrentTrack
                ? 'bg-white/10 border border-white/20'
                : 'bg-white/5 border border-white/[0.05] hover:bg-white/[0.08]'
            }`}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {coverUrl ? (
                <LazyImage
                  src={coverUrl}
                  alt={song.name}
                  className="w-full h-full object-cover"
                  placeholder={<Music size={16} className="text-white/40" />}
                />
              ) : (
                <Music size={16} className="text-white/40" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate text-sm md:text-base ${isCurrentTrack ? 'text-white' : 'text-white/90'}`}>
                {song.name}
              </p>
              <p className="text-xs md:text-sm text-white/50 truncate">
                {song.artists.map(a => a.name).join(', ')} · {song.album.name}
              </p>
            </div>

            <div className="hidden md:block text-sm text-white/40 flex-shrink-0">
              {formatDuration(song.duration)}
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(song);
                }}
                disabled={isLoading}
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${
                  isLiked 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                    : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                }`}
                title={isLiked ? '从喜欢中移除' : '添加到喜欢'}
              >
                <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
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
      <div className="space-y-1.5 md:space-y-2">
        {favorites.map((favorite) => {
          const isCurrentTrack = currentTrackUrl && neteasePlaylist.some(
            p => p.url === currentTrackUrl && p.name === favorite.name
          );
          const isLoading = loadingSongId === favorite.id;

          return (
            <div
              key={favorite.id}
              onClick={() => handlePlayFavorite(favorite)}
              className={`group flex items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl transition-all cursor-pointer ${
                isCurrentTrack
                  ? 'bg-white/10 border border-white/20'
                  : 'bg-white/5 border border-white/[0.05] hover:bg-white/[0.08]'
              }`}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {favorite.coverUrl ? (
                  <LazyImage
                    src={favorite.coverUrl}
                    alt={favorite.name}
                    className="w-full h-full object-cover"
                    placeholder={<Music size={16} className="text-white/40" />}
                  />
                ) : (
                  <Music size={16} className="text-white/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate text-sm md:text-base ${isCurrentTrack ? 'text-white' : 'text-white/90'}`}>
                  {favorite.name}
                </p>
                <p className="text-xs md:text-sm text-white/50 truncate">
                  {favorite.artist} · {favorite.album}
                </p>
              </div>

              <div className="hidden md:block text-sm text-white/40 flex-shrink-0">
                {formatDuration(favorite.duration)}
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite({ id: favorite.id } as NeteaseSong);
                  }}
                  disabled={isLoading}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  title="从喜欢中移除"
                >
                  <Heart size={18} fill="currentColor" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-1 md:p-3 relative">
      {renderLoadingBadge()}
      
      {/* 顶部标签切换栏 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/80 hover:bg-white/10'
            }`}
          >
            <Search size={14} />
            搜索
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'favorites'
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/80 hover:bg-white/10'
            }`}
          >
            <Heart size={14} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
            我喜欢
          </button>
        </div>

        {/* 清空按钮 */}
        {activeTab === 'favorites' && favorites.length > 0 && (
          <button
            onClick={clearFavorites}
            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
            title="清空喜欢列表"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* 标题区域 */}
      <div className="mb-3">
        <h2 className="text-lg font-bold text-white">
          {activeTab === 'search' ? '搜索歌曲' : '我喜欢'}
        </h2>
        <p className="text-white/40 text-xs mt-0.5">
          {activeTab === 'search' ? '搜索并添加喜欢的歌曲' : `${favorites.length} 首歌曲`}
        </p>
      </div>

      {/* 搜索栏 - 仅在搜索标签页显示 */}
      {activeTab === 'search' && (
        <div className="mb-1">
          <div className="flex items-center gap-2 md:gap-3">
            {hasSearched && (
              <button
                onClick={() => {
                  setHasSearched(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-2 md:p-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl transition-colors flex items-center justify-center"
                title="返回搜索"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} //延迟两百毫秒等待结果传入,防止搜索建议DOM移除无法搜索
                placeholder="搜索歌曲、艺术家..."
                className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2 md:py-3 bg-white/5 border border-white/[0.05] rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all text-sm md:text-base"
              />
            </div>
            <button
              onClick={() => { setShowSuggestions(false); handleSearch(); }}
              disabled={isLoading || !searchQuery.trim()}
              className="px-4 md:px-6 py-2 md:py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all flex items-center gap-1 md:gap-2 text-sm md:text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="hidden md:inline">搜索中</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                </>
              )}
            </button>
          </div>

          {showSuggestions && searchQuery.trim() && (
            <div className="mt-2 bg-white/10 rounded-xl border border-white/10 overflow-hidden max-h-64 overflow-y-auto">
              {isLoadingSuggestions ? (
                <div className="p-4 text-white/50 text-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  加载中...
                </div>
              ) : suggestions.length > 0 ? (
                <div className="p-1">
                  {suggestions.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(item.keyword)}
                      className="px-3 py-2.5 rounded-lg hover:bg-white/10 cursor-pointer flex items-center gap-2"
                    >
                      <Search size={14} className="text-white/40 flex-shrink-0" />
                      <span className="text-white/90 text-sm truncate">{item.keyword}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-white/50 text-sm text-center">暂无搜索建议</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto playlist-scrollbar">
        {activeTab === 'search' ? (
          !hasSearched ? (
            <div className="py-4">
              {searchHistory.length > 0 ? (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3 px-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12,6 12,12 16,14" />
                      </svg>
                      <h3 className="text-white/80 font-medium text-sm">最近搜索</h3>
                    </div>
                    <button
                      onClick={() => {
                        setSearchHistory([]);
                        localStorage.removeItem(SEARCH_HISTORY_KEY);
                      }}
                      className="text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      清空
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 px-2">
                    {searchHistory.map((keyword, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearch(keyword)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 text-sm rounded-lg transition-colors border border-white/5"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4 px-2">
                  <TrendingUp size={18} className="text-white/60" />
                  <h3 className="text-white/80 font-medium">热搜榜</h3>
                </div>
              )}
              <div className="space-y-1">
                {hotSearchList.slice(0, 10).map((item, index) => (
                  <div
                    key={item.searchWord}
                    onClick={() => handleHotSearchClick(item.searchWord)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <span className={`text-sm font-medium w-6 ${
                      index < 3 ? 'text-red-400' : 'text-white/40'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-sm font-medium truncate">{item.searchWord}</p>
                      {item.content && (
                        <p className="text-white/40 text-xs truncate mt-0.5">{item.content}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.iconUrl && (
                        <Flame size={14} className="text-orange-400 flex-shrink-0" />
                      )}
                      <span className="text-xs text-white/50 font-medium">
                        {item.score >= 1000000 
                          ? `${(item.score / 10000).toFixed(1)}万` 
                          : item.score >= 10000 
                            ? `${(item.score / 10000).toFixed(1)}万`
                            : item.score}
                      </span>
                    </div>
                  </div>
                ))}
                {hotSearchList.length === 0 && (
                  <div className="text-center text-white/40 py-8">
                    <p>暂无热搜数据</p>
                  </div>
                )}
              </div>
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

export const NeteasePanel = forwardRef<NeteasePanelRef, NeteasePanelProps>((props, ref) => {
  return <NeteasePanelComponent {...props} ref={ref} />;
});
