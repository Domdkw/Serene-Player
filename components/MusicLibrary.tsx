import React from 'react';
import { Music, ChevronLeft } from 'lucide-react';
import { PlaylistItem } from '../types';
import { FolderDisplay } from './FolderDisplay';

interface MusicLibraryProps {
  playlistFolders: Record<string, PlaylistItem[] | { link?: string }>;
  currentFolder: string | null;
  setCurrentFolder: (folder: string | null) => void;
  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaying: boolean;
  onTrackSelect: (item: PlaylistItem, index: number) => void;
  isSidebar?: boolean;
  isLoading?: boolean;
  onLoadLinkedFolder?: (folderName: string, linkUrl: string) => void;
  loadingTrackUrl?: string | null;
  loadingFolders?: Set<string>;
}

export const MusicLibrary: React.FC<MusicLibraryProps> = ({
  playlistFolders,
  currentFolder,
  setCurrentFolder,
  playlist,
  currentIndex,
  isPlaying,
  onTrackSelect,
  isSidebar = false,
  isLoading = false,
  onLoadLinkedFolder,
  loadingTrackUrl = null,
  loadingFolders = new Set<string>()
}) => {
  const getTrackIndex = (item: PlaylistItem) => playlist.findIndex(p => p.url === item.url);

  const folderDisplay = FolderDisplay({
    playlistFolders,
    currentFolder,
    setCurrentFolder,
    loadingFolders,
    isSidebar,
    isLoading,
    onLoadLinkedFolder
  });

  const renderRootTracks = () => {
    const rootTracks = playlistFolders[""] as PlaylistItem[];
    
    if (!rootTracks || rootTracks.length === 0) return null;
    
    return rootTracks.map((item, idx) => {
      const trackIndex = getTrackIndex(item);
      const isActive = currentIndex === trackIndex;
      const isTrackLoading = loadingTrackUrl === item.url;

      if (isSidebar) {
        return (
          <button
            key={`root-${idx}`}
            onClick={() => onTrackSelect(item, trackIndex)}
            className={`w-full px-5 py-4 rounded-2xl flex items-center justify-between transition-all group border ${
              isActive 
                ? 'bg-white text-black border-transparent shadow-2xl scale-[1.01]' 
                : 'bg-transparent text-white/40 hover:bg-white/[0.08] hover:text-white border-white/[0.05]'
            }`}
          >
            <div className="flex items-center flex-1 min-w-0 max-w-[calc(100%-40px)]">
              {isTrackLoading ? (
                <div className="mr-3 flex-shrink-0 relative w-3 h-3">
                  <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                  <div className="absolute inset-0 border-2 border-transparent border-t-white/60 rounded-full animate-spin" />
                </div>
              ) : (
                <div 
                  className="w-3 h-3 rounded-full mr-3 flex-shrink-0 transition-all"
                  style={{ backgroundColor: item.themeColor }}
                />
              )}
              <div className="text-left overflow-hidden flex-1 min-w-0">
                <p className={`text-sm font-black truncate leading-tight ${isActive ? 'text-black' : 'text-white'}`}>
                  {item.name}
                </p>
                <p className="text-[10px] uppercase tracking-widest truncate font-bold opacity-60 mt-1">
                  {isTrackLoading ? 'Loading...' : item.artist}
                </p>
              </div>
            </div>
            {isActive && isPlaying && (
               <div className="flex gap-1 items-end h-4 shrink-0">
                  <div className="w-1 bg-current rounded-full animate-[music-bar_0.8s_ease-in-out_infinite]" />
                  <div className="w-1 bg-current rounded-full animate-[music-bar_0.6s_ease-in-out_infinite_0.1s]" />
                  <div className="w-1 bg-current rounded-full animate-[music-bar_0.9s_ease-in-out_infinite_0.2s]" />
               </div>
            )}
          </button>
        );
      }

      return (
        <button
          key={`root-${idx}`}
          onClick={() => onTrackSelect(item, trackIndex)}
          className={`w-full px-4 py-4 flex items-center transition-all group border-b border-white/5 ${
            isActive 
              ? 'bg-white/10 text-white' 
              : 'text-white/80 hover:bg-white/[0.05] hover:text-white'
          }`}
        >
          {isTrackLoading ? (
            <div className="mr-3 flex-shrink-0 relative w-3 h-3">
              <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-transparent border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : (
            <div 
              className="w-3 h-3 rounded-full mr-3 flex-shrink-0 transition-all"
              style={{ backgroundColor: item.themeColor }}
            />
          )}
          <span className={`w-1/2 truncate text-left ${isActive ? 'font-black' : 'font-medium'}`}>
            {item.name}
          </span>
          <span className="w-1/2 truncate pl-4 text-sm opacity-60">
            {isTrackLoading ? 'Loading...' : item.artist}
          </span>
        </button>
      );
    });
  };

  const renderTrackView = () => {
    if (!currentFolder) return null;
    
    const { tracks, children } = folderDisplay.getFolderData(currentFolder);
    
    if (tracks.length === 0 && Object.keys(children).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-white/10 text-center p-8 gap-6">
          <Music size={64} strokeWidth={0.5} />
          <p className="text-[10px] uppercase tracking-[0.3em] font-black">Empty Folder</p>
        </div>
      );
    }

    return (
      <>
        {/* 显示当前文件夹的 tracks */}
        {tracks.map((item, idx) => {
          const trackIndex = getTrackIndex(item);
          const isActive = currentIndex === trackIndex;
          const isTrackLoading = loadingTrackUrl === item.url;

          if (isSidebar) {
            return (
              <button
                key={idx}
                onClick={() => onTrackSelect(item, trackIndex)}
                className={`w-full px-5 py-4 rounded-2xl flex items-center justify-between transition-all group border ${
                  isActive 
                    ? 'bg-white text-black border-transparent shadow-2xl scale-[1.01]' 
                    : 'bg-transparent text-white/40 hover:bg-white/[0.08] hover:text-white border-white/[0.05]'
                }`}
              >
                <div className="flex items-center flex-1 min-w-0 max-w-[calc(100%-40px)]">
                  {isTrackLoading ? (
                    <div className="mr-3 flex-shrink-0 relative w-3 h-3">
                      <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                      <div className="absolute inset-0 border-2 border-transparent border-t-white/60 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div 
                      className="w-3 h-3 rounded-full mr-3 flex-shrink-0 transition-all"
                      style={{ backgroundColor: item.themeColor }}
                    />
                  )}
                  <div className="text-left overflow-hidden flex-1 min-w-0">
                    <p className={`text-sm font-black truncate leading-tight ${isActive ? 'text-black' : 'text-white'}`}>
                      {item.name}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest truncate font-bold opacity-60 mt-1">
                      {isTrackLoading ? 'Loading...' : item.artist}
                    </p>
                  </div>
                </div>
                {isActive && isPlaying && (
                   <div className="flex gap-1 items-end h-4 shrink-0">
                      <div className="w-1 bg-current rounded-full animate-[music-bar_0.8s_ease-in-out_infinite]" />
                      <div className="w-1 bg-current rounded-full animate-[music-bar_0.6s_ease-in-out_infinite_0.1s]" />
                      <div className="w-1 bg-current rounded-full animate-[music-bar_0.9s_ease-in-out_infinite_0.2s]" />
                   </div>
                )}
              </button>
            );
          }

          return (
            <button
              key={idx}
              onClick={() => onTrackSelect(item, trackIndex)}
              className={`w-full px-4 py-4 flex items-center transition-all group border-b border-white/5 ${
                isActive 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/80 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {isTrackLoading ? (
                <div className="mr-3 flex-shrink-0 relative w-3 h-3">
                  <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                  <div className="absolute inset-0 border-2 border-transparent border-t-white/60 rounded-full animate-spin" />
                </div>
              ) : (
                <div 
                  className="w-3 h-3 rounded-full mr-3 flex-shrink-0 transition-all"
                  style={{ backgroundColor: item.themeColor }}
                />
              )}
              <span className={`w-1/2 truncate text-left ${isActive ? 'font-black' : 'font-medium'}`}>
                {item.name}
              </span>
              <span className="w-1/2 truncate pl-4 text-sm opacity-60">
                {isTrackLoading ? 'Loading...' : item.artist}
              </span>
            </button>
          );
        })}
        
        {/* 显示子文件夹 */}
        {folderDisplay.renderChildFolders(children)}
      </>
    );
  };

  if (isSidebar) {
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden playlist-scrollbar space-y-2">
        {currentFolder ? (
          <>
            <button 
              onClick={() => setCurrentFolder(null)}
              className="w-full px-5 py-3 rounded-2xl flex items-center gap-2 text-white/60 hover:text-white bg-transparent hover:bg-white/[0.08] transition-all"
            >
              <ChevronLeft size={14} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Back</span>
            </button>
            {renderTrackView()}
          </>
        ) : (
          <>
            {renderRootTracks()}
            {folderDisplay.renderFolderView()}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {currentFolder && (
        <button 
          onClick={() => setCurrentFolder(null)}
          className="w-full px-4 py-3 border-b border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/60 hover:text-white flex items-center gap-2 transition-all"
        >
          <ChevronLeft size={14} />
          Back to Folders
        </button>
      )}
      <div className="flex items-center px-4 py-3 border-b border-white/10 text-[10px] uppercase tracking-widest font-bold text-white">
        <div className="w-3 h-3 mr-3 flex-shrink-0" />
        <span className="w-1/2 truncate">标题</span>
        <span className="w-1/2 truncate pl-4 text-center">作曲家</span>
      </div>
      <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden playlist-scrollbar">
        {currentFolder ? renderTrackView() : (
          <>
            {renderRootTracks()}
            {folderDisplay.renderFolderView()}
          </>
        )}
      </div>
    </div>
  );
};
