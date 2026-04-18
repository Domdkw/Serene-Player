import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { PlaylistItem, PlaylistFolders } from '../types';
import { ErrorService } from '../utils/errorService';

interface PlaylistState {
  playlist: PlaylistItem[];
  playlistFolders: PlaylistFolders;
  loadedLinks: Set<string>;
  currentFolder: string | null;
  currentIndex: number;
  neteasePlaylist: PlaylistItem[];
  neteaseCurrentIndex: number;
  folderLoading: { name: string; progress: number } | null;
  loadingFolders: Set<string>;
}

interface PlaylistContextType extends PlaylistState {
  setPlaylist: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setPlaylistFolders: React.Dispatch<React.SetStateAction<PlaylistFolders>>;
  setCurrentFolder: (folder: string | null) => void;
  setCurrentIndex: (index: number) => void;
  setNeteasePlaylist: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setNeteaseCurrentIndex: (index: number) => void;
  loadPlaylistFromUrl: (url: string) => Promise<boolean>;
  loadLinkedFolder: (folderName: string, linkUrl: string) => Promise<void>;
  addToPlaylist: (item: PlaylistItem) => void;
  addMultipleToPlaylist: (items: PlaylistItem[]) => void;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

export const usePlaylist = () => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylist must be used within a PlaylistProvider');
  }
  return context;
};

interface PlaylistProviderProps {
  children: React.ReactNode;
}

export const PlaylistProvider: React.FC<PlaylistProviderProps> = ({ children }) => {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playlistFolders, setPlaylistFolders] = useState<PlaylistFolders>({});
  const [loadedLinks, setLoadedLinks] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [neteasePlaylist, setNeteasePlaylist] = useState<PlaylistItem[]>([]);
  const [neteaseCurrentIndex, setNeteaseCurrentIndex] = useState<number>(-1);
  const [folderLoading, setFolderLoading] = useState<{ name: string; progress: number } | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const loadedLinksRef = useRef(loadedLinks);

  const loadPlaylistFromUrl = useCallback(async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Playlist file not found: ${url}`);
      const data = await res.json();

      const processedFolders: PlaylistFolders = {};
      const allTracks: PlaylistItem[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          processedFolders[key] = value;
          allTracks.push(...value);
        } else if (value && typeof value === 'object' && 'link' in value) {
          processedFolders[key] = value as { link?: string };
        }
      }

      setPlaylistFolders(processedFolders);
      setPlaylist(allTracks);
      return true;
    } catch (err) {
      ErrorService.handleError(err as Error, 'Load Playlist');
      return false;
    }
  }, []);

  const loadLinkedFolder = useCallback(async (folderName: string, linkUrl: string) => {
    if (loadedLinksRef.current.has(linkUrl)) {
      return;
    }

    try {
      setLoadingFolders(prev => new Set(prev).add(folderName));
      setFolderLoading({ name: folderName, progress: 0 });

      const res = await fetch(linkUrl);
      if (!res.ok) throw new Error(`Failed to load linked folder: ${linkUrl}`);

      setFolderLoading({ name: folderName, progress: 50 });

      const data = await res.json();

      setPlaylistFolders(prev => {
        const newFolders = { ...prev };
        const folderData = prev[folderName];

        if (folderData && typeof folderData === 'object' && 'link' in folderData) {
          const newFolderData: any = { ...folderData };

          if (Array.isArray(data)) {
            newFolderData.tracks = data;
          } else if (typeof data === 'object' && data !== null) {
            const emptyKeyData = data[""];
            if (Array.isArray(emptyKeyData)) {
              newFolderData.tracks = emptyKeyData;
              newFolderData.children = {};
              for (const [key, value] of Object.entries(data)) {
                if (key !== "" && Array.isArray(value)) {
                  newFolderData.children[key] = value;
                } else if (key !== "" && value && typeof value === 'object' && 'link' in value) {
                  newFolderData.children[key] = value;
                }
              }
            } else {
              newFolderData.children = {};
              for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value)) {
                  newFolderData.children[key] = value;
                } else if (value && typeof value === 'object' && 'link' in value) {
                  newFolderData.children[key] = value;
                }
              }
            }
          }

          newFolders[folderName] = newFolderData;
        }

        return newFolders;
      });

      setLoadedLinks(prev => {
        const newSet = new Set(prev).add(linkUrl);
        loadedLinksRef.current = newSet;
        return newSet;
      });

      setPlaylist(prev => {
        const existingUrls = new Set(prev.map(t => t.url));
        const newTracks: PlaylistItem[] = [];

        if (Array.isArray(data)) {
          for (const track of data) {
            if (!existingUrls.has(track.url)) {
              newTracks.push(track);
              existingUrls.add(track.url);
            }
          }
        } else if (typeof data === 'object' && data !== null) {
          for (const value of Object.values(data)) {
            if (Array.isArray(value)) {
              for (const track of value) {
                if (!existingUrls.has(track.url)) {
                  newTracks.push(track);
                  existingUrls.add(track.url);
                }
              }
            }
          }
        }

        return [...prev, ...newTracks];
      });

      setFolderLoading({ name: folderName, progress: 100 });
      setTimeout(() => {
        setFolderLoading(null);
        setLoadingFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(folderName);
          return newSet;
        });
      }, 300);
    } catch (error) {
      ErrorService.handleError(error as Error, 'Load Linked Folder');
      setFolderLoading(null);
      setLoadingFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderName);
        return newSet;
      });
    }
  }, []);

  const addToPlaylist = useCallback((item: PlaylistItem) => {
    setPlaylist(prev => {
      if (prev.some(p => p.url === item.url)) {
        return prev;
      }
      return [...prev, item];
    });
  }, []);

  const addMultipleToPlaylist = useCallback((items: PlaylistItem[]) => {
    setPlaylist(prev => {
      const existingUrls = new Set(prev.map(p => p.url));
      const newItems = items.filter(item => !existingUrls.has(item.url));
      return [...prev, ...newItems];
    });
  }, []);

  const value = useMemo(() => ({
    playlist,
    playlistFolders,
    loadedLinks,
    currentFolder,
    currentIndex,
    neteasePlaylist,
    neteaseCurrentIndex,
    folderLoading,
    loadingFolders,
    setPlaylist,
    setPlaylistFolders,
    setCurrentFolder,
    setCurrentIndex,
    setNeteasePlaylist,
    setNeteaseCurrentIndex,
    loadPlaylistFromUrl,
    loadLinkedFolder,
    addToPlaylist,
    addMultipleToPlaylist,
  }), [
    playlist,
    playlistFolders,
    loadedLinks,
    currentFolder,
    currentIndex,
    neteasePlaylist,
    neteaseCurrentIndex,
    folderLoading,
    loadingFolders,
    loadPlaylistFromUrl,
    loadLinkedFolder,
    addToPlaylist,
    addMultipleToPlaylist,
  ]);

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
};
