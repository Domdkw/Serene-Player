import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { PlaylistItem, PlaylistFolders, PlaylistFolder } from '../types';
import { ErrorService } from '../utils/errorService';

interface PlaylistState {
  playlist: PlaylistItem[];
  playlistFolders: PlaylistFolders;
  loadedLinks: Set<string>;
  currentFolder: string | null;
  currentIndex: number;
  neteasePlaylist: PlaylistItem[];
  neteaseCurrentIndex: number;
  neteaseLikedCurrentIndex: number; // 内存中维护的"我喜欢"列表当前播放索引
  folderLoading: { name: string; progress: number } | null;
  loadingFolders: Set<string>;
  likedSongs: Set<number>; // 内存中维护的"我喜欢"标记
}

interface PlaylistContextType extends PlaylistState {
  setPlaylist: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setPlaylistFolders: React.Dispatch<React.SetStateAction<PlaylistFolders>>;
  setCurrentFolder: (folder: string | null) => void;
  setCurrentIndex: (index: number) => void;
  setNeteasePlaylist: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setNeteaseCurrentIndex: (index: number) => void;
  setNeteaseLikedCurrentIndex: (index: number) => void;
  updateNeteaseLikedIndexById: (neteaseId: number) => void; // 根据歌曲ID更新"我喜欢"列表索引
  loadPlaylistFromUrl: (url: string) => Promise<boolean>;
  loadLinkedFolder: (folderName: string, linkUrl: string) => Promise<void>;
  addToPlaylist: (item: PlaylistItem) => void;
  addMultipleToPlaylist: (items: PlaylistItem[]) => void;
  // 我喜欢标记相关方法（仅内存，不写入localStorage）
  isLiked: (neteaseId: number) => boolean;
  toggleLike: (neteaseId: number) => void;
  setLikedSongs: React.Dispatch<React.SetStateAction<Set<number>>>;
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

/**
 * 从localStorage读取网易云"我喜欢"播放列表
 * 仅读取，不进行任何写入操作
 */
const readNeteaseFavoritesFromStorage = (): Array<{id: number; name: string; artist: string}> => {
  try {
    const saved = localStorage.getItem('netease_favorites');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    ErrorService.handleError(error as Error, 'Read Netease Favorites');
  }
  return [];
};

/**
 * 将存储的喜欢列表转换为PlaylistItem格式
 */
const convertToPlaylistItems = (favorites: Array<{id: number; name: string; artist: string}>): PlaylistItem[] => {
  return favorites.map(item => ({
    id: item.id.toString(),
    name: item.name,
    artist: item.artist,
    url: '', // URL通过API动态获取
    neteaseId: item.id,
    themeColor: '#C20C0C'
  }));
};

export const PlaylistProvider: React.FC<PlaylistProviderProps> = ({ children }) => {
  // 本地歌曲播放列表
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playlistFolders, setPlaylistFolders] = useState<PlaylistFolders>({});
  const [loadedLinks, setLoadedLinks] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  
  // 网易云播放列表 - 仅从localStorage读取，不写入
  const [neteasePlaylist, setNeteasePlaylist] = useState<PlaylistItem[]>(() => {
    const favorites = readNeteaseFavoritesFromStorage();
    return convertToPlaylistItems(favorites);
  });
  const [neteaseCurrentIndex, setNeteaseCurrentIndex] = useState<number>(-1);
  const [neteaseLikedCurrentIndex, setNeteaseLikedCurrentIndex] = useState<number>(-1); // 内存中维护的"我喜欢"列表当前播放索引
  
  // 文件夹加载状态
  const [folderLoading, setFolderLoading] = useState<{ name: string; progress: number } | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  
  // 内存中维护的"我喜欢"标记（不写入localStorage）
  const [likedSongs, setLikedSongs] = useState<Set<number>>(() => {
    // 初始时，所有从localStorage读取的歌曲都标记为喜欢
    const favorites = readNeteaseFavoritesFromStorage();
    return new Set(favorites.map(item => item.id));
  });

  const loadedLinksRef = useRef(loadedLinks);

  /**
   * 检查歌曲是否被标记为喜欢
   */
  const isLiked = useCallback((neteaseId: number): boolean => {
    return likedSongs.has(neteaseId);
  }, [likedSongs]);

  /**
   * 切换歌曲的喜欢状态（仅内存，不写入localStorage）
   */
  const toggleLike = useCallback((neteaseId: number) => {
    setLikedSongs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(neteaseId)) {
        newSet.delete(neteaseId);
      } else {
        newSet.add(neteaseId);
      }
      return newSet;
    });
  }, []);

  /**
   * 根据歌曲ID更新"我喜欢"列表的当前播放索引
   * 仅在内存中维护，不写入localStorage
   */
  const updateNeteaseLikedIndexById = useCallback((neteaseId: number) => {
    const index = neteasePlaylist.findIndex(item => item.neteaseId === neteaseId);
    setNeteaseLikedCurrentIndex(index);
  }, [neteasePlaylist]);

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
        
        if (!newFolders[folderName]) {
          newFolders[folderName] = {};
        }
        
        const folderData = newFolders[folderName] as PlaylistFolder;
        
        if (Array.isArray(data)) {
          folderData.tracks = data;
        } else if (typeof data === 'object' && data !== null) {
          if (!folderData.children) {
            folderData.children = {};
          }
          
          if ('link' in data && Object.keys(data).length === 1) {
            folderData.link = data.link;
          } else {
            folderData.children = {};
            for (const [key, value] of Object.entries(data)) {
              if (Array.isArray(value)) {
                folderData.children[key] = value;
              } else if (value && typeof value === 'object' && 'link' in value) {
                folderData.children[key] = value as { link?: string };
              }
            }
          }
        }

        newFolders[folderName] = folderData;
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
    neteaseLikedCurrentIndex,
    folderLoading,
    loadingFolders,
    likedSongs,
    setPlaylist,
    setPlaylistFolders,
    setCurrentFolder,
    setCurrentIndex,
    setNeteasePlaylist,
    setNeteaseCurrentIndex,
    setNeteaseLikedCurrentIndex,
    updateNeteaseLikedIndexById,
    loadPlaylistFromUrl,
    loadLinkedFolder,
    addToPlaylist,
    addMultipleToPlaylist,
    isLiked,
    toggleLike,
    setLikedSongs,
  }), [
    playlist,
    playlistFolders,
    loadedLinks,
    currentFolder,
    currentIndex,
    neteasePlaylist,
    neteaseCurrentIndex,
    neteaseLikedCurrentIndex,
    folderLoading,
    loadingFolders,
    likedSongs,
    isLiked,
    toggleLike,
    updateNeteaseLikedIndexById,
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
