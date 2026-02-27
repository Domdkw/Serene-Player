import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Play, Pause, Music, Heart, Trash2, ArrowLeft, Flame, TrendingUp } from 'lucide-react';
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

interface NeteasePanelProps {
  onTrackSelect: (item: PlaylistItem, index: number) => void;
  currentTrackUrl: string | null;
  isPlaying: boolean;
  onAddToPlaylist: (item: PlaylistItem) => void;
}

const FAVORITES_STORAGE_KEY = 'netease_favorites';
const SEARCH_HISTORY_KEY = 'netease_search_history';
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
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());
  const [hotSearchList, setHotSearchList] = useState<NeteaseHotSearch[]>([]);
  const [suggestions, setSuggestions] = useState<{ keyword: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const isSuggestionClickRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * 当喜欢列表为空时，自动显示搜索界面
   */
  useEffect(() => {
    if (favorites.length === 0 && !showSearch) {
      setShowSearch(true);
    }
  }, [favorites.length, showSearch]);



  /**
   * 加载热搜列表
   */
  useEffect(() => {
    const loadHotSearch = async () => {
      try {
        const result = await getHotSearchDetail();
        setHotSearchList(result);
      } catch (error) {
        console.error('加载热搜失败:', error);
      }
    };
    loadHotSearch();
  }, []);

  /**
   * 搜索建议防抖
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (isSuggestionClickRef.current) {
      isSuggestionClickRef.current = false;
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

  const handleSearch = useCallback(async (keyword?: string) => {
    const searchWord = keyword || searchQuery;
    if (!searchWord.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    setShowSuggestions(false);

    try {
      const result = await searchNeteaseMusic(searchWord.trim());
      setSearchResults(result.songs);
      const newHistory = addSearchHistory(searchWord.trim());
      setSearchHistory(newHistory);

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
      setShowSuggestions(false);
      handleSearch();
    }
  }, [handleSearch]);

  const handleHotSearchClick = useCallback((keyword: string) => {
    setSearchQuery(keyword);
    setShowSuggestions(false);
    handleSearch();
  }, [handleSearch]);

  const handleSuggestionClick = useCallback((keyword: string) => {
    isSuggestionClickRef.current = true;
    setSearchQuery(keyword);
    setShowSuggestions(false);
    handleSearch(keyword);
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
        artistIds: song.artists.map(a => a.id),
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
        artistIds: favorite.artistIds || [],
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
    <div className="space-y-1.5 md:space-y-2">
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
            onClick={() => handlePlaySong(song)}
            className={`group flex items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl transition-all cursor-pointer ${
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
                <Heart size={14} md:size={18} fill={isLiked ? 'currentColor' : 'none'} />
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
          const isCurrentTrack = currentTrackUrl && localPlaylist.some(
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
                  <Heart size={14} md:size={18} fill="currentColor" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-1 md:p-3">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">
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
            
            {!(showSearch && favorites.length === 0) && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all flex items-center justify-center md:justify-start gap-2"
              >
                {showSearch ? (
                  <>
                    <ArrowLeft size={16} />
                    <span className="hidden md:inline">返回</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span className="hidden md:inline">搜索</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex-1 relative">
              <Search size={14} md:size={18} className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
                  <Loader2 size={14} md:size={18} className="animate-spin" />
                  <span className="hidden md:inline">搜索中</span>
                </>
              ) : (
                <>
                  <Search size={14} md:size={18} />
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
        {showSearch ? (
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
                    {item.iconUrl && (
                      <Flame size={14} className="text-white/30 flex-shrink-0" />
                    )}
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
