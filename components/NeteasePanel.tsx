import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Play, Pause, Music } from 'lucide-react';
import { searchNeteaseMusic, getSongUrl, getSongDetail, getAlbumCoverUrl, NeteaseSong, NeteaseSongDetail, formatDuration } from '../apis/netease';
import { PlaylistItem } from '../types';

interface NeteasePanelProps {
  onTrackSelect: (item: PlaylistItem, index: number) => void;
  currentTrackUrl: string | null;
  isPlaying: boolean;
  onAddToPlaylist: (item: PlaylistItem) => void;
}

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
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 800) : null;

      const playlistItem: PlaylistItem = {
        name: song.name,
        artist: song.artists.map(a => a.name).join(', '),
        url: songUrl,
        themeColor: '#C20C0C',
        neteaseId: song.id,
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

  const handleAddToPlaylist = useCallback(async (song: NeteaseSong) => {
    setLoadingSongId(song.id);

    try {
      const songUrl = await getSongUrl(song.id);

      if (!songUrl) {
        console.error('无法获取歌曲URL');
        return;
      }

      const detail = songDetails[song.id];
      const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 800) : null;

      const playlistItem: PlaylistItem = {
        name: song.name,
        artist: song.artists.map(a => a.name).join(', '),
        url: songUrl,
        themeColor: '#C20C0C',
      };

      onAddToPlaylist(playlistItem);
    } catch (error) {
      console.error('添加歌曲失败:', error);
    } finally {
      setLoadingSongId(null);
    }
  }, [onAddToPlaylist, songDetails]);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">网易云音乐</h2>
        <p className="text-white/40 text-sm">搜索并播放网易云音乐的歌曲</p>
      </div>

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

      <div className="flex-1 overflow-y-auto playlist-scrollbar">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40">
            <Music size={48} className="mb-4 opacity-50" />
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
          <div className="space-y-2">
            {searchResults.map((song) => {
              const isCurrentTrack = currentTrackUrl && localPlaylist.some(
                p => p.url === currentTrackUrl && p.name === song.name
              );
              const isLoading = loadingSongId === song.id;
              const detail = songDetails[song.id];
              const coverUrl = detail?.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 200) : null;

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
                      <img
                        src={coverUrl}
                        alt={song.name}
                        className="w-full h-full object-cover"
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

                    <button
                      onClick={() => handleAddToPlaylist(song)}
                      disabled={isLoading}
                      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/70 hover:text-white text-sm transition-all"
                    >
                      添加
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
