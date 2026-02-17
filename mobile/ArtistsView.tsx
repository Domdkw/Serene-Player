import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { PlaylistItem } from '../types';
import { MusicLibrary } from '../components/MusicLibrary';
import { parseComposers } from '../utils/composerUtils';
import { createStopPropagationProps } from '../utils/swipeUtils';

interface ArtistsViewProps {
  selectedArtist: string | null;
  setSelectedArtist: (artist: string | null) => void;
  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaying: boolean;
  loadMusicFromUrl: (item: PlaylistItem, index: number) => void;
  loadingTrackUrl: string | null;
  artistsByLetter: Record<string, string[]>;
  pinyinLoadError: boolean;
}

export const ArtistsView: React.FC<ArtistsViewProps> = ({
  selectedArtist,
  setSelectedArtist,
  playlist,
  currentIndex,
  isPlaying,
  loadMusicFromUrl,
  loadingTrackUrl,
  artistsByLetter,
  pinyinLoadError
}) => {
  if (selectedArtist) {
    const artistTracks = playlist.filter(item => {
      const composers = parseComposers(item.artist);
      return composers.some(composer => composer.name === selectedArtist);
    });
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 p-4 border-b border-white/[0.05]">
          <button
            onClick={() => setSelectedArtist(null)}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/[0.15] flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={20} className="text-white/60" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white drop-shadow-md">{selectedArtist}</h2>
            <p className="text-sm text-white/40 drop-shadow-sm">{artistTracks.length} 首歌曲</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <MusicLibrary
            playlistFolders={{ [selectedArtist]: artistTracks }}
            currentFolder={selectedArtist}
            setCurrentFolder={() => setSelectedArtist(null)}
            playlist={playlist}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            onTrackSelect={loadMusicFromUrl}
            loadingTrackUrl={loadingTrackUrl}
          />
        </div>
      </div>
    );
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/[0.05] flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white drop-shadow-md">艺术家<span className="text-sm text-white/40 mt-1 ml-1">按字母排序</span></h2>
        </div>
        {pinyinLoadError && (
          <div className="flex items-center gap-2 text-amber-400/80 bg-amber-400/10 px-3 py-1.5 rounded-lg" title="拼音库加载失败，中文歌手暂按 # 分组">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" x2="12" y1="9" y2="13"/>
              <line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
            <span className="text-xs font-medium">拼音加载失败</span>
          </div>
        )}
      </div>

      <div
        className="px-4 py-2 border-b border-white/[0.05] flex flex-row gap-2 overflow-x-auto hide-scrollbar"
        {...createStopPropagationProps()}
      >
        {alphabet.map(letter => {
          const hasArtists = artistsByLetter[letter] && artistsByLetter[letter].length > 0;
          return (
            <button
              key={letter}
              onClick={() => {
                if (hasArtists) {
                  const element = document.getElementById(`letter-group-${letter}`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className={`min-w-[36px] h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center border ${
                hasArtists
                  ? 'text-white/80 border-white/10 bg-white/5 hover:bg-white/15 hover:border-white/20 cursor-pointer'
                  : 'text-white/20 border-white/5 bg-transparent cursor-default'
              }`}
              disabled={!hasArtists}
            >
              {letter}
            </button>
          );
        })}
      </div>

      <div
        className="flex-1 overflow-y-auto hide-scrollbar"
        {...createStopPropagationProps()}
      >
        {alphabet.map(letter => {
          const artists = artistsByLetter[letter];
          if (!artists || artists.length === 0) return null;

          return (
            <div key={letter} id={`letter-group-${letter}`} className="mb-6">
              <div className="sticky top-0 z-10 px-4 py-1 bg-transparent backdrop-blur-sm">
                <span className="text-2xl font-black text-white/20 drop-shadow-md">{letter}</span>
              </div>
              <div className="px-2">
                {artists.map((artist, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedArtist(artist)}
                    className="w-full text-left px-4 py-2 text-white/70 rounded-xl text-sm font-medium"
                  >
                    {artist}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
