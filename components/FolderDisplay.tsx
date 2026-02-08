import React from 'react';
import { Folder, ExternalLink, Link } from 'lucide-react';
import { PlaylistItem } from '../types';

interface FolderDisplayProps {
  playlistFolders: Record<string, PlaylistItem[] | { link?: string }>;
  currentFolder: string | null;
  setCurrentFolder: (folder: string | null) => void;
  loadingFolders: Set<string>;
  isSidebar?: boolean;
  isLoading?: boolean;
  onLoadLinkedFolder?: (folderName: string, linkUrl: string) => void;
}

export const FolderDisplay = ({
  playlistFolders,
  currentFolder,
  setCurrentFolder,
  loadingFolders,
  isSidebar = false,
  isLoading = false,
  onLoadLinkedFolder
}: FolderDisplayProps) => {
  const handleFolderClick = async (folderName: string) => {
    const folderData = playlistFolders[folderName];
    const isLinkedFolder = folderData && typeof folderData === 'object' && 'link' in folderData;
    const linkUrl = isLinkedFolder ? (folderData as any).link : null;
    
    if (isLinkedFolder && linkUrl && onLoadLinkedFolder) {
      try {
        await onLoadLinkedFolder(folderName, linkUrl);
        setTimeout(() => setCurrentFolder(folderName), 100);
      } catch (error) {
        console.error("Failed to load linked folder:", error);
      }
    } else {
      setCurrentFolder(folderName);
    }
  };

  const renderFolderView = () => {
    if (Object.keys(playlistFolders).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-white/10 text-center p-8 gap-6">
          <Folder size={64} strokeWidth={0.5} />
          <p className="text-[10px] uppercase tracking-[0.3em] font-black">Empty Library</p>
        </div>
      );
    }

    return Object.keys(playlistFolders).map((folderName, idx) => {
      const folderData = playlistFolders[folderName];
      const isLinkedFolder = folderData && typeof folderData === 'object' && 'link' in folderData;
      const tracks = isLinkedFolder ? [] : (folderData as PlaylistItem[]);
      const trackCount = isLinkedFolder ? 0 : tracks.length;
      const isLoadingFolder = loadingFolders.has(folderName);
      
      return (
        <button
          key={idx}
          onClick={() => handleFolderClick(folderName)}
          disabled={isLoadingFolder}
          className={`${isSidebar 
            ? "w-full px-5 py-4 rounded-2xl flex items-center justify-between transition-all group bg-transparent text-white/70 hover:bg-white/[0.08] hover:text-white border border-white/[0.05]"
            : "w-full px-4 py-4 flex items-center transition-all group border-b border-white/5 text-white/80 hover:bg-white/[0.05] hover:text-white"
          } ${isLoadingFolder ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center flex-1 min-w-0">
            {isLoadingFolder ? (
              <div className="mr-3 flex-shrink-0 relative w-4 h-4">
                <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-transparent border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : isLinkedFolder ? (
              <Link size={16} className="mr-3 flex-shrink-0 text-blue-400" />
            ) : (
              <Folder size={16} className="mr-3 flex-shrink-0" />
            )}
            <div className="text-left overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-black truncate leading-tight">
                {folderName}
              </p>
              <p className="text-[10px] uppercase tracking-widest truncate font-bold opacity-60 mt-1">
                {isLoadingFolder ? 'Loading...' : isLinkedFolder ? 'Linked folder' : `${trackCount} tracks`}
              </p>
            </div>
          </div>
          {isLinkedFolder && !isLoadingFolder && <ExternalLink size={14} className="text-white/30" />}
        </button>
      );
    });
  };

  const renderChildFolders = (children: Record<string, PlaylistItem[] | { link?: string }>) => {
    return Object.keys(children).map((childName, idx) => {
      const childData = children[childName];
      const isLinkedFolder = childData && typeof childData === 'object' && 'link' in childData;
      const childTracks = isLinkedFolder ? [] : (childData as PlaylistItem[]);
      const trackCount = isLinkedFolder ? 0 : childTracks.length;
      
      return (
        <button
          key={`child-${idx}`}
          onClick={() => setCurrentFolder(`${currentFolder}/${childName}`)}
          className={`w-full px-5 py-4 rounded-2xl flex items-center justify-between transition-all group bg-transparent text-white/70 hover:bg-white/[0.08] hover:text-white border border-white/[0.05]`}
        >
          <div className="flex items-center flex-1 min-w-0">
            <Folder size={16} className="mr-3 flex-shrink-0" />
            <div className="text-left overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-black truncate leading-tight">
                {childName}
              </p>
              <p className="text-[10px] uppercase tracking-widest truncate font-bold opacity-60 mt-1">
                {isLinkedFolder ? 'Linked folder' : `${trackCount} tracks`}
              </p>
            </div>
          </div>
          {isLinkedFolder && <ExternalLink size={14} className="text-white/30" />}
        </button>
      );
    });
  };

  const getFolderData = (folderName: string) => {
    const folderData = playlistFolders[folderName];
    let tracks: PlaylistItem[] = [];
    let children: Record<string, PlaylistItem[] | { link?: string }> = {};
    
    if (Array.isArray(folderData)) {
      tracks = folderData;
    } else if (folderData && typeof folderData === 'object') {
      if ('tracks' in folderData && Array.isArray(folderData.tracks)) {
        tracks = folderData.tracks;
      }
      if ('children' in folderData && folderData.children && typeof folderData.children === 'object') {
        children = folderData.children as Record<string, PlaylistItem[] | { link?: string }>;
      }
    }
    
    return { tracks, children };
  };

  return {
    renderFolderView,
    renderChildFolders,
    getFolderData
  };
};