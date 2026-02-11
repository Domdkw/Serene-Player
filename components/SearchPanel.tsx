import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { PlaylistItem } from '../types';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaying: boolean;
  onTrackSelect: (item: PlaylistItem, index: number) => void;
  isMobile?: boolean;
}

const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query || !text) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return <span key={index} className="text-yellow-400 font-semibold">{part}</span>;
    }
    return part;
  });
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  isPlaying,
  onTrackSelect,
  isMobile = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaylistItem[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = playlist.filter(item => {
      const songNameMatch = item.name.toLowerCase().includes(query);
      const artistMatch = item.artist ? item.artist.toLowerCase().includes(query) : false;
      return songNameMatch || artistMatch;
    });

    setSearchResults(results);
  }, [searchQuery, playlist, isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`absolute inset-0 ${isMobile ? 'top-0 bg-[#0f0f13]/90' : 'top-[120px] bg-[#0f0f13]/25'} bottom-0 left-0 right-0 backdrop-blur-xl z-40 animate-in fade-in slide-in-from-top-4 duration-300`}>
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索作曲家或歌曲名称..."
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/[0.05] rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all"
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto playlist-scrollbar">
          {searchQuery.trim() === '' ? (
            <div className="flex items-center justify-center h-full text-white/40 text-sm">
              输入关键词开始搜索
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/40 text-sm">
              未找到匹配的歌曲
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((item, index) => {
                const playlistIndex = playlist.findIndex(p => p.url === item.url);
                return (
                  <button
                    key={`${item.url}-${index}`}
                    onClick={() => {
                      if (playlistIndex !== -1) {
                        onTrackSelect(item, playlistIndex);
                      }
                      onClose();
                    }}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                      currentIndex !== -1 && playlist[currentIndex]?.url === item.url
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm truncate">
                        {highlightMatch(item.name, searchQuery)}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5 truncate">
                        {item.artist ? highlightMatch(item.artist, searchQuery) : '未知艺术家'}
                      </div>
                    </div>
                    {currentIndex !== -1 && playlist[currentIndex]?.url === item.url && isPlaying && (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-3 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" />
                        <div className="w-1 h-4 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_0.2s_infinite]" />
                        <div className="w-1 h-3 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_0.4s_infinite]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
