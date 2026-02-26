
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Upload, Play, Pause, SkipBack, SkipForward, 
  Music, ListMusic, X, Repeat, Repeat1, Loader2, AlertCircle, Settings, ChevronLeft, ChevronRight, Download, FileAudio, FolderOpen, Shuffle, Languages, Disc, User, Search, Plus, Link2, RotateCcw, Cloud
} from 'lucide-react';
import { Track, PlaylistItem, PlaybackMode } from '../types';
import { extractMetadata, parseLyrics } from '../utils/metadata';
import { MusicLibrary } from '../components/MusicLibrary';
import { ArtistsView } from './ArtistsView';
import { SearchPanel } from '../components/SearchPanel';
import { NeteasePanel } from '../components/NeteasePanel';
import SettingsPanel from './SettingsPanel';
import LyricLine from '../components/LyricLine';
import fetchInChunks from 'fetch-in-chunks';
import { getFontFamily, getFontUrl } from '../utils/fontUtils';
import { getArtistsFirstLetters, getFirstLetterSync, containsChinese } from '../utils/pinyinLoader';
import { parseComposers, groupComposersByInitial } from '../utils/composerUtils';
import { createSwipeManager, SwipeDirection } from '../utils/swipeUtils';
import { useQueryParams } from '../hooks/useQueryParams';

/**
 * 网易云音乐图标组件
 * 使用稳定的组件引用避免重复渲染导致的图片重复请求
 */
const NeteaseIcon = () => (
  <img src="https://s1.music.126.net/style/favicon.ico" alt="网易云" className="w-3.5 h-3.5" />
);

const App: React.FC = () => {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  
  // Playlist states
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playlistFolders, setPlaylistFolders] = useState<Record<string, PlaylistItem[]>>({});
  const [loadedLinks, setLoadedLinks] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('single');
  
  // UI states
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [folderLoading, setFolderLoading] = useState<{name: string, progress: number} | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [loadingTrackUrl, setLoadingTrackUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  
  // Page navigation states (0: list, 1: player, 2: lyrics)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const swipeManagerRef = useRef<ReturnType<typeof createSwipeManager> | null>(null);
  
  // 3D cover effect states
  const [coverMousePos, setCoverMousePos] = useState({ x: 0, y: 0 });
  const [isCoverHovered, setIsCoverHovered] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  
  // Settings states

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  
  // Custom Source states
  const [isCustomSourceOpen, setIsCustomSourceOpen] = useState(false);
  const [customSourceUrl, setCustomSourceUrl] = useState<string>(() => {
    return localStorage.getItem('customMusicSource') || '';
  });
  const [sourceInputValue, setSourceInputValue] = useState('');
  const [chunkCount, setChunkCount] = useState<number>(() => {
    const saved = localStorage.getItem('chunkCount');
    return saved ? parseInt(saved) : 4;
  });
  const [fontWeight, setFontWeight] = useState<string>(() => {
    const saved = localStorage.getItem('fontWeight');
    return saved || 'medium';
  });
  const [letterSpacing, setLetterSpacing] = useState<number>(() => {
    const saved = localStorage.getItem('letterSpacing');
    return saved ? parseFloat(saved) : 0.5;
  });
  const [lineHeight, setLineHeight] = useState<number>(() => {
    const saved = localStorage.getItem('lineHeight');
    return saved ? parseFloat(saved) : 1.5;
  });
  const [selectedFont, setSelectedFont] = useState<string>(() => {
    const saved = localStorage.getItem('selectedFont');
    return saved || 'default';
  });
  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    const saved = localStorage.getItem('showTranslation');
    return saved ? saved === 'true' : true;
  });

  // 保存翻译显示设置到 LocalStorage
  useEffect(() => {
    localStorage.setItem('showTranslation', showTranslation.toString());
  }, [showTranslation]);

  // 加载字体
  useEffect(() => {
    // 移除所有已存在的字体链接
    const existingFontLinks = document.querySelectorAll('link[data-font-link="true"]');
    existingFontLinks.forEach(link => link.remove());
    
    if (selectedFont !== 'default') {
      const fontUrl = getFontUrl(selectedFont);
      if (fontUrl) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = fontUrl;
        fontLink.setAttribute('data-font-link', 'true');
        
        document.head.appendChild(fontLink);
        
        return () => {
          document.head.removeChild(fontLink);
        };
      }
    }
  }, [selectedFont]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const manualScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);
  const [isManualScrolling, setIsManualScrolling] = useState(false);

  // Library view states
  const [libraryView, setLibraryView] = useState<'songs' | 'artists' | 'netease'>('netease');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [artistsByLetter, setArtistsByLetter] = useState<Record<string, string[]>>({});
  const [artistLetterMap, setArtistLetterMap] = useState<Record<string, string>>({});
  const [hasChineseArtists, setHasChineseArtists] = useState(false);
  const [pinyinLoaded, setPinyinLoaded] = useState(false);
  const [pinyinLoadError, setPinyinLoadError] = useState(false);
  
  // Streaming mode state
  const [streamingMode, setStreamingMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('streamingMode');
    return saved ? saved === 'true' : true;
  });
  
  // Page 0 visited state - 用于延迟加载
  const [page0Visited, setPage0Visited] = useState(false);
  const [songsTabVisited, setSongsTabVisited] = useState(false);
  const [localSongsLoaded, setLocalSongsLoaded] = useState(false);

  // Load playlist on mount
  const defaultSourceUrl = './discList.json';
  
  //region URL 参数处理状态
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playlistReady, setPlaylistReady] = useState(false);

  const loadPlaylistFromUrl = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Playlist file not found: ${url}`);
      const data = await res.json();
      
      const processedFolders: Record<string, PlaylistItem[] | { link?: string }> = {};
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
      setPlaylistReady(true);
      
      if (allTracks.length === 0) {
        setCurrentPage(0);
      }
      
      if ((window as any).hideAppLoader) {
        (window as any).hideAppLoader();
      }
      return true;
    } catch (err) {
      console.error("Failed to load playlist", err);
      setErrorMessage(`Could not load playlist from: ${url}`);
      if ((window as any).hideAppLoader) {
        (window as any).hideAppLoader();
      }
      return false;
    }
  };
  
  useEffect(() => {
    if ((window as any).hideAppLoader) {
      (window as any).hideAppLoader();
    }
  }, []);

  useEffect(() => {
    if (songsTabVisited && !localSongsLoaded) {
      const url = customSourceUrl || defaultSourceUrl;
      loadPlaylistFromUrl(url);
      setLocalSongsLoaded(true);
    }
  }, [songsTabVisited, localSongsLoaded, customSourceUrl, loadPlaylistFromUrl]);

  useEffect(() => {
    if (currentPage === 0 && !page0Visited) {
      setPage0Visited(true);
    }
  }, [currentPage, page0Visited]);

  useEffect(() => {
    if (libraryView === 'songs' && !songsTabVisited) {
      setSongsTabVisited(true);
    }
  }, [libraryView, songsTabVisited]);

  // 艺术家按首字母分组（支持中文转拼音）
  useEffect(() => {
    const artistSet = new Set<string>();
    let hasChinese = false;

    playlist.forEach(item => {
      if (item.artist) {
        const composers = parseComposers(item.artist);
        composers.forEach(composer => {
          artistSet.add(composer.name);
          if (containsChinese(composer.name)) {
            hasChinese = true;
          }
        });
      }
    });

    const grouped: Record<string, string[]> = {};
    const letterMap: Record<string, string> = {};

    Array.from(artistSet).forEach(artist => {
      const firstLetter = getFirstLetterSync(artist);
      letterMap[artist] = firstLetter;
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(artist);
    });

    Object.keys(grouped).forEach(letter => {
      grouped[letter].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    });

    setArtistsByLetter(grouped);
    setArtistLetterMap(letterMap);
    setHasChineseArtists(hasChinese);
  }, [playlist]);

  // 当用户点击艺术家标签时，加载拼音库并重新分组中文艺术家
  useEffect(() => {
    if (libraryView === 'artists' && hasChineseArtists && !pinyinLoaded && !pinyinLoadError) {
      getArtistsFirstLetters(Object.keys(artistLetterMap).filter(a => containsChinese(a))).then(newLetters => {
        setArtistLetterMap(prev => ({ ...prev, ...newLetters }));

        const regrouped: Record<string, string[]> = {};
        Object.entries({ ...artistLetterMap, ...newLetters }).forEach(([artist, letter]) => {
          const letterKey = letter as string;
          if (!regrouped[letterKey]) {
            regrouped[letterKey] = [];
          }
          regrouped[letterKey].push(artist);
        });

        Object.keys(regrouped).forEach(letter => {
          regrouped[letter].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        });

        setArtistsByLetter(regrouped);
        setPinyinLoaded(true);
      }).catch(err => {
        console.warn('Failed to load pinyin library:', err);
        setPinyinLoadError(true);
      });
    }
  }, [libraryView, hasChineseArtists, pinyinLoaded, pinyinLoadError, artistLetterMap]);

  const loadLinkedFolder = async (folderName: string, linkUrl: string) => {
    if (loadedLinks.has(linkUrl)) {
      return;
    }

    try {
      setLoadingFolders(prev => new Set(prev).add(folderName));
      setFolderLoading({name: folderName, progress: 0});
      
      const res = await fetch(linkUrl);
      if (!res.ok) throw new Error(`Failed to load linked folder: ${linkUrl}`);
      
      setFolderLoading({name: folderName, progress: 50});
      
      const data = await res.json();
      
      setPlaylistFolders(prev => {
        const newFolders = { ...prev };
        const folderData = prev[folderName];
        
        if (folderData && typeof folderData === 'object' && 'link' in folderData) {
          // 创建新的文件夹对象，包含链接信息和加载的内容
          const newFolderData: any = { ...folderData };
          
          if (Array.isArray(data)) {
            // 如果是数组，直接作为 tracks
            newFolderData.tracks = data;
          } else if (typeof data === 'object' && data !== null) {
            // 如果是对象，检查是否有空键名的数组
            const emptyKeyData = data[""];
            if (Array.isArray(emptyKeyData)) {
              // 空键名的数组作为当前文件夹的 tracks
              newFolderData.tracks = emptyKeyData;
              
              // 其他键名作为子文件夹
              newFolderData.children = {};
              for (const [key, value] of Object.entries(data)) {
                if (key !== "" && Array.isArray(value)) {
                  newFolderData.children[key] = value;
                } else if (key !== "" && value && typeof value === 'object' && 'link' in value) {
                  newFolderData.children[key] = value;
                }
              }
            } else {
              // 没有空键名，所有内容作为子文件夹
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
      
      setLoadedLinks(prev => new Set(prev).add(linkUrl));
      
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
          // 处理所有数组内容
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
      
      setFolderLoading({name: folderName, progress: 100});
      setTimeout(() => {
        setFolderLoading(null);
        setLoadingFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(folderName);
          return newSet;
        });
      }, 300);
    } catch (error) {
      console.error("Failed to load linked folder:", error);
      setErrorMessage(`Failed to load linked folder: ${folderName}`);
      setFolderLoading(null);
      setLoadingFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderName);
        return newSet;
      });
    }
  };

  const loadMusicFromUrl = async (item: PlaylistItem, index: number) => {
    setErrorMessage(null);
    setLyricsLoading(true);
    setLoadingTrackUrl(item.url);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoadingProgress(0);
    setCurrentIndex(index);
    setIsPlaying(false);
    
    try {
      let file: File | undefined;
      let objectUrl: string;
      const isNeteaseSong = !!item.neteaseId;
      
      if (isNeteaseSong) {
        objectUrl = item.url;
        setLoadingProgress(100);
        file = undefined;
      } else if (item.file) {
        file = item.file;
        objectUrl = item.url; // blob URL
        setLoadingProgress(100);
      } else if (item.url.startsWith('blob:')) {
        // blob URL 但没有 file 对象，尝试直接获取
        const response = await fetch(item.url);
        const blob = await response.blob();
        file = new File([blob], item.name, { type: blob.type || 'audio/mpeg' });
        objectUrl = item.url;
        setLoadingProgress(100);
      } else {
        // 远程 URL，使用 fetchInChunks 下载
        const encodedUrl = item.url.startsWith('http://') || item.url.startsWith('https://') 
          ? item.url 
          : encodeURI(item.url);
        
        const blob = await fetchInChunks(encodedUrl, {
          maxParallelRequests: chunkCount,
          progressCallback: (downloaded, total) => {
            if (total > 0) {
              setLoadingProgress(Math.round((downloaded / total) * 100));
            }
          },
          signal
        });

        if (signal.aborted) return;

        file = new File([blob], item.name, { type: 'audio/mpeg' });
        objectUrl = URL.createObjectURL(file);
      }
      
      const metadata = file ? await extractMetadata(file) : {
        title: item.name,
        artist: item.artist,
        album: item.album || '',
        coverUrl: null,
        lyrics: null,
        parsedLyrics: [],
        lyricArtist: null,
        lyricAlbum: null,
      };

      if (!metadata.coverUrl && item.coverUrl) {
        metadata.coverUrl = item.coverUrl;
      }

      if (!metadata.lyrics && item.lyrics) {
        metadata.lyrics = item.lyrics;
        const parsedResult = parseLyrics(item.lyrics);
        metadata.parsedLyrics = parsedResult.lines;
        if (parsedResult.lyricArtist) {
          metadata.lyricArtist = parsedResult.lyricArtist;
        }
        if (parsedResult.lyricAlbum) {
          metadata.lyricAlbum = parsedResult.lyricAlbum;
        }
      }
      
      const oldUrl = track?.objectUrl;
      
      setTrack({ 
        file, 
        objectUrl, 
        metadata,
        neteaseId: item.neteaseId,
        sourceType: isNeteaseSong ? 'streaming' : 'local'
      });
      setLoadingProgress(null);
      setLoadingTrackUrl(null);
      setLyricsLoading(false);
      setCurrentPage(1);
      // 重置自动滚动
      setIsManualScrolling(false);
      if (manualScrollTimerRef.current) {
        clearTimeout(manualScrollTimerRef.current);
        manualScrollTimerRef.current = null;
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = objectUrl;
        audioRef.current.load();
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn("Autoplay was prevented.", e);
        }
      }

      // 只清理非 blob URL 的旧 URL
      if (oldUrl && !oldUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldUrl);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Error loading music:", error);
      setLoadingProgress(null);
      setLoadingTrackUrl(null);
      setLyricsLoading(false);
      setErrorMessage(error.message || "An error occurred while loading the track.");
      setIsPlaying(false);
    }
  };

  //region URL 参数处理 Hook
  const { processPendingParams, hasPendingParams } = useQueryParams({
    onPlayNeteaseMusic: (item, index) => {
      setPlaylist(prev => {
        const existingIndex = prev.findIndex(p => p.url === item.url);
        if (existingIndex === -1) {
          return [...prev, item];
        }
        return prev;
      });
      loadMusicFromUrl(item, index);
    },
    onPlayLocalMusic: (item, index) => {
      loadMusicFromUrl(item, index);
    },
    onOpenPlayer: () => {
      setCurrentPage(1);
    },
    onLoadPlaylist: async (url: string) => {
      const success = await loadPlaylistFromUrl(url);
      if (success) {
        setLocalSongsLoaded(true);
      }
      return success;
    },
    getPlaylist: () => playlist,
    setShouldAutoPlay,
    onSeekTo: (timeInSeconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = timeInSeconds;
        setCurrentTime(timeInSeconds);
      }
    },
  });

  //region 当播放列表准备好后处理待处理的本地音乐参数
  useEffect(() => {
    if (playlistReady && hasPendingParams) {
      processPendingParams();
    }
  }, [playlistReady, hasPendingParams, processPendingParams]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage(null);
      setLoadingProgress(100);
      try {
        const metadata = await extractMetadata(file);
        const objectUrl = URL.createObjectURL(file);
        const oldUrl = track?.objectUrl;
        setTrack({ file, objectUrl, metadata });
      setLoadingProgress(null);
      // 重置自动滚动
      setIsManualScrolling(false);
      if (manualScrollTimerRef.current) {
        clearTimeout(manualScrollTimerRef.current);
        manualScrollTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = objectUrl;
        audioRef.current.load();
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      } catch (err) {
        setErrorMessage("Failed to process the uploaded file.");
        setLoadingProgress(null);
      }
    }
    // 重置 input 以便可以再次选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 支持的音频格式
  const supportedAudioFormats = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.ape', '.opus'];

  const isAudioFile = (filename: string): boolean => {
    const lowerName = filename.toLowerCase();
    return supportedAudioFormats.some(ext => lowerName.endsWith(ext));
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const audioFiles: File[] = [];

    // 筛选出音频文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isAudioFile(file.name)) {
        audioFiles.push(file);
      }
    }

    if (audioFiles.length === 0) {
      setErrorMessage("No supported audio files found in the selected folder.");
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
      return;
    }

    // 按文件名排序
    audioFiles.sort((a, b) => a.name.localeCompare(b.name));

    // 创建播放列表项
    const newTracks: PlaylistItem[] = [];

    for (const file of audioFiles) {
      try {
        const metadata = await extractMetadata(file);
        newTracks.push({
          name: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
          url: URL.createObjectURL(file),
          artist: metadata.artist || 'Unknown Artist',
          file: file
        });
      } catch (err) {
        console.error('Failed to extract metadata for file:', file.name, err);
        newTracks.push({
          name: file.name.replace(/\.[^/.]+$/, ''),
          url: URL.createObjectURL(file),
          artist: 'Unknown Artist',
          file: file
        });
      }
    }

    // 添加到播放列表
    setPlaylist(prev => [...prev, ...newTracks]);

    // 创建一个新的文件夹分组
    const folderName = `Local Folder ${new Date().toLocaleTimeString()}`;
    setPlaylistFolders(prev => ({
      ...prev,
      [folderName]: newTracks
    }));

    // 播放第一首
    if (newTracks.length > 0) {
      const firstTrack = newTracks[0];
      const file = audioFiles[0];
      setLoadingProgress(100);
      try {
        const metadata = await extractMetadata(file);
        const objectUrl = URL.createObjectURL(file);
        const oldUrl = track?.objectUrl;
        setTrack({ file, objectUrl, metadata });
      setCurrentIndex(playlist.length); // 新添加的第一首的索引
      setLoadingProgress(null);
      // 重置自动滚动
      setIsManualScrolling(false);
      if (manualScrollTimerRef.current) {
        clearTimeout(manualScrollTimerRef.current);
        manualScrollTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = objectUrl;
        audioRef.current.load();
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      } catch (err) {
        setErrorMessage("Failed to process the uploaded file.");
        setLoadingProgress(null);
      }
    }

    // 重置 input
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  // 点击外部关闭上传菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
        setIsUploadMenuOpen(false);
      }
    };

    if (isUploadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUploadMenuOpen]);

  const handleNext = () => {
    if (playbackMode === 'shuffle') {
      if (playlist.length === 0) return;
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * playlist.length);
      } while (playlist.length > 1 && randomIndex === currentIndex);
      loadMusicFromUrl(playlist[randomIndex], randomIndex);
    } else if (currentFolder && playlistFolders[currentFolder]) {
      const folderTracks = playlistFolders[currentFolder];
      const currentTrack = playlist[currentIndex];
      const currentFolderIndex = folderTracks.findIndex(t => t.url === currentTrack?.url);
      
      if (currentFolderIndex !== -1) {
        const nextFolderIndex = (currentFolderIndex + 1) % folderTracks.length;
        const nextTrack = folderTracks[nextFolderIndex];
        const nextGlobalIndex = playlist.findIndex(p => p.url === nextTrack.url);
        loadMusicFromUrl(nextTrack, nextGlobalIndex);
      }
    } else {
      if (playlist.length === 0) return;
      const nextIndex = (currentIndex + 1) % playlist.length;
      loadMusicFromUrl(playlist[nextIndex], nextIndex);
    }
  };

  const handlePrev = () => {
    if (playbackMode === 'shuffle') {
      // In shuffle mode, prev is same as next (random)
      handleNext();
    } else if (currentFolder && playlistFolders[currentFolder]) {
      const folderTracks = playlistFolders[currentFolder];
      const currentTrack = playlist[currentIndex];
      const currentFolderIndex = folderTracks.findIndex(t => t.url === currentTrack?.url);
      
      if (currentFolderIndex !== -1) {
        const prevFolderIndex = (currentFolderIndex - 1 + folderTracks.length) % folderTracks.length;
        const prevTrack = folderTracks[prevFolderIndex];
        const prevGlobalIndex = playlist.findIndex(p => p.url === prevTrack.url);
        loadMusicFromUrl(prevTrack, prevGlobalIndex);
      }
    } else {
      if (playlist.length === 0) return;
      const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
      loadMusicFromUrl(playlist[prevIndex], prevIndex);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !track) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => {
        console.error("Playback error:", e);
      });
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current && time >= 0) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    if (time < 0) return "--:--";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeIndex = useMemo(() => {
    if (!track?.metadata.parsedLyrics.length) return -1;
    let index = -1;
    for (let i = 0; i < track.metadata.parsedLyrics.length; i++) {
      if (track.metadata.parsedLyrics[i].time <= currentTime) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [track, currentTime]);

  /**
   * 判断当前歌词类型
   * @returns 'word' - 逐字歌词, 'line' - 逐行歌词, 'none' - 无歌词
   *
   * 判断逻辑：
   * - 逐字歌词：歌词行包含 chars 数组，且数组长度大于0
   * - 逐行歌词：歌词行不包含 chars 数组，或 chars 数组为空
   */
  const lyricsType = useMemo(() => {
    if (!track?.metadata.parsedLyrics.length) return 'none';

    // 检查是否有任意一行包含逐字信息
    const hasWordLevelLyrics = track.metadata.parsedLyrics.some(
      line => line.chars && line.chars.length > 0
    );

    return hasWordLevelLyrics ? 'word' : 'line';
  }, [track]);

  /**
   * 滚动到当前激活的歌词位置
   *
   * 此函数负责将歌词容器滚动到当前正在播放的歌词行，使该行始终显示在屏幕中央。
   * 只有在启用自动滚动模式时才会执行滚动操作。
   *
   * 滚动逻辑：
   * 1. 计算目标滚动位置 = 当前歌词行距离顶部的高度 - 容器高度的一半 + 歌词行高度的一半
   * 2. 这样可以确保当前歌词行始终显示在容器的垂直中央位置
   * 3. 使用平滑滚动动画效果，提升用户体验
   */
  // 处理用户交互的函数
  const handleUserInteraction = () => {
    // 1. 设为手动模式，停止自动滚动
    setIsManualScrolling(true);

    // 2. 清除之前的计时器
    if (manualScrollTimerRef.current) {
      clearTimeout(manualScrollTimerRef.current);
    }

    // 3. 设置 5 秒后恢复自动滚动（仅在音乐播放时）
    manualScrollTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsManualScrolling(false);
      }
    }, 5000);
  };

  const scrollToActiveLyric = () => {
    // 增加判断：如果处于手动操作期间，直接跳过自动滚动逻辑
    if (isManualScrolling) return;

    // 检查是否启用自动滚动以及必要的DOM元素是否存在
    if (isAutoScrolling && activeLyricRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;      // 歌词容器元素
      const activeElement = activeLyricRef.current;      // 当前激活的歌词行元素
      
      // 计算滚动位置：使当前歌词行居中显示
      // 公式：当前元素顶部位置 - 容器高度的一半 + 当前元素高度的一半
      const scrollPos = activeElement.offsetTop - container.offsetHeight / 2 + activeElement.offsetHeight / 2;
      
      // 执行平滑滚动
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  };

  /**
   * 滑动状态引用，用于在回调中获取最新状态
   */
  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  /**
   * 初始化滑动管理器
   */
  useEffect(() => {
    swipeManagerRef.current = createSwipeManager({
      lockThreshold: 10,
      swipeThreshold: window.innerWidth * 0.15,
      maxPage: 2,
      minPage: 0,
      onHorizontalSwipeStart: () => {
        setSwipeDirection('horizontal');
      },
      onVerticalSwipeStart: () => {
        setSwipeDirection('vertical');
      },
      onHorizontalSwipeMove: (offset) => {
        let adjustedOffset = offset;
        const page = currentPageRef.current;
        if (page === 0 && offset > 0) {
          adjustedOffset = 0;
        }
        if (page === 2 && offset < 0) {
          adjustedOffset = 0;
        }
        setDragOffset(adjustedOffset);
      },
      onHorizontalSwipeEnd: (direction) => {
        const page = currentPageRef.current;
        if (direction === 'right' && page > 0) {
          setCurrentPage(page - 1);
        } else if (direction === 'left' && page < 2) {
          setCurrentPage(page + 1);
        }
        setDragOffset(0);
        setSwipeDirection(null);
      },
      onVerticalSwipeEnd: () => {
        setSwipeDirection(null);
      },
      onSwipeCancel: () => {
        setDragOffset(0);
        setSwipeDirection(null);
      },
    });
  }, []);

  /**
   * 处理触摸开始事件
   */
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    swipeManagerRef.current?.handleTouchStart(clientX, clientY);
  };

  /**
   * 处理触摸移动事件
   */
  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    swipeManagerRef.current?.handleTouchMove(clientX, clientY);
  };

  /**
   * 处理触摸结束事件
   */
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    swipeManagerRef.current?.handleTouchEnd();
  };

  /**
   * 处理鼠标滚轮事件
   */
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const threshold = 50;
    if (e.deltaY > threshold && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (e.deltaY < -threshold && currentPage < 2) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    scrollToActiveLyric();
  }, [activeIndex, isAutoScrolling]);

  const onEnded = () => {
    if (playbackMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      handleNext();
    }
  };

  // 逐字歌词检测时间
  useEffect(() => {
    const setupInterval = () => {
      if (!audioRef.current) {
        setTimeout(setupInterval, 100);
        return;
      }

      const interval = setInterval(() => {
        if (audioRef.current && !audioRef.current.paused) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);

      return () => clearInterval(interval);
    };

    setupInterval();
  }, []);

  useEffect(() => {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.metadata.title,
        artist: track.metadata.artist,
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });

      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [track, handlePrev, handleNext]);

  useEffect(() => {
    if (track) {
      document.title = `${track.metadata.title} | Serene Player`;
    } else {
      document.title = 'Serene Player';
    }
  }, [track]);

  const renderArtistsView = () => {
    return (
      <ArtistsView
        selectedArtist={selectedArtist}
        setSelectedArtist={setSelectedArtist}
        playlist={playlist}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        loadMusicFromUrl={loadMusicFromUrl}
        loadingTrackUrl={loadingTrackUrl}
        artistsByLetter={artistsByLetter}
        pinyinLoadError={pinyinLoadError}
      />
    );
  };

  /**
   * 渲染网易云音乐视图
   * 只有在用户访问过第0页时才会渲染网易云面板
   */
  const renderNeteaseView = useCallback(() => {
    if (!page0Visited) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-4">
          <Cloud size={48} className="opacity-50" />
          <p className="text-sm opacity-50">网易云音乐</p>
        </div>
      );
    }
    
    return (
      <NeteasePanel
        onTrackSelect={(item, index) => {
          loadMusicFromUrl(item, index);
        }}
        currentTrackUrl={track?.objectUrl || null}
        isPlaying={isPlaying}
        onAddToPlaylist={(item) => {
          setPlaylist(prev => {
            if (prev.some(p => p.url === item.url)) {
              return prev;
            }
            return [...prev, item];
          });
        }}
      />
    );
  }, [page0Visited, loadMusicFromUrl, track?.objectUrl, isPlaying, setPlaylist]);

  return (
    <div className="h-dvh w-full flex flex-col bg-black text-slate-200 relative overflow-hidden font-sans" style={{ fontFamily: getFontFamily(selectedFont) }}>
      
      {/* Wave Loading Bar */}
      {loadingProgress !== null && (
        <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
          <div className="relative h-1.5 md:h-2 bg-white/5 overflow-hidden shimmer-effect">
            <div className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${loadingProgress}%` }} />
          </div>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="fixed top-4 md:top-8 right-4 md:right-8 z-[60] bg-red-500/10 border border-red-500/50 backdrop-blur-xl px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-top-4">
          <AlertCircle size={18} className="text-red-500" />
          <p className="text-xs font-bold text-white max-w-[200px] leading-relaxed break-all">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dynamic Animated Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-neutral-800">
        {track?.metadata.coverUrl && (
          <div 
            className="animate-rotate-cover absolute top-1/2 -translate-y-1/2 left-[-200vw] w-[400vw] h-[400vh]"
            style={{
              backgroundImage: `url(${track.metadata.coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(50px) brightness(0.7)',
            }}
          />
        )}
      </div>

      {/* Main Content: Three Page Slider */}
      <main 
        ref={containerRef}
        className="flex-1 overflow-hidden z-10 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {/* Page Container */}
        <div 
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(-${currentPage * 100}% + ${dragOffset}px))`
          }}
        >
          
          {/* Page 0: Music Library (Left) */}
          <section className="w-full h-full flex-shrink-0 flex flex-col p-4 md:p-8 bg-black/20 backdrop-blur-xl overflow-hidden !pb-0">
            {/* 顶部标签页切换和上传按钮 */}
            <div className="flex items-center justify-center gap-4 mb-6 md:mb-10 shrink-0">
              {/* 标签页切换组件 */}
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setLibraryView('netease')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    libraryView === 'netease'
                      ? 'bg-white/20 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  title="网易云音乐"
                >
                  <NeteaseIcon />
                </button>
                <button
                  onClick={() => setLibraryView('songs')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    libraryView === 'songs'
                      ? 'bg-white/20 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  title="本地歌曲"
                >
                  <Disc size={14} />
                </button>
                <button
                  onClick={() => setLibraryView('artists')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    libraryView === 'artists'
                      ? 'bg-white/20 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  title="艺术家"
                >
                  <User size={14} />
                </button>
              </div>

              {/* 搜索按钮 - 仅在歌曲标签页显示 */}
              {libraryView === 'songs' && (
                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                    isSearchOpen ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <Search size={14} />
                </button>
              )}

              {/* 上传按钮 */}
              <div className="relative" ref={uploadMenuRef}>
                <button
                  onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-white/10 active:scale-95"
                >
                  <Upload size={12} className="text-white" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Local</span>
                </button>

                {/* Dropdown Menu */}
                {isUploadMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsUploadMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <FileAudio size={16} className="text-white/80" />
                      <span className="text-xs font-medium text-white/90">上传文件</span>
                    </button>
                    <div className="h-px bg-white/10 mx-2" />
                    <button
                      onClick={() => {
                        folderInputRef.current?.click();
                        setIsUploadMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <FolderOpen size={16} className="text-white/80" />
                      <span className="text-xs font-medium text-white/90">上传文件夹</span>
                    </button>
                  </div>
                )}

                {/* Hidden File Inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.flac,.aac,.ogg,.m4a,.wma,.ape,.opus,audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  accept=".mp3,.wav,.flac,.aac,.ogg,.m4a,.wma,.ape,.opus,audio/*"
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderUpload}
                />
              </div>
            </div>

            {/* Music Library Content */}
            <div className="flex-1 overflow-y-auto hide-scrollbar pb-0">
              {libraryView === 'netease' ? (
                renderNeteaseView()
              ) : libraryView === 'songs' ? (
                <MusicLibrary
                  playlistFolders={playlistFolders}
                  currentFolder={currentFolder}
                  setCurrentFolder={setCurrentFolder}
                  playlist={playlist}
                  currentIndex={currentIndex}
                  isPlaying={isPlaying}
                  onTrackSelect={loadMusicFromUrl}
                  isSidebar={false}
                  isLoading={lyricsLoading}
                  onLoadLinkedFolder={loadLinkedFolder}
                  loadingTrackUrl={loadingTrackUrl}
                  loadingFolders={loadingFolders}
                />
              ) : (
                renderArtistsView()
              )}
              
              <SearchPanel
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                playlist={playlist}
                currentIndex={currentIndex}
                isPlaying={isPlaying}
                onTrackSelect={loadMusicFromUrl}
                isMobile={true}
              />
            </div>
          </section>

          {/* Page 1: Player (Center - Default) */}
          <section className="w-full h-full flex-shrink-0 flex flex-col p-4 md:p-8 bg-transparent overflow-hidden relative">
            {/* Header with Settings Button */}
            <div className="flex items-center justify-between mb-6 md:mb-10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shadow-inner">
                   <Music size={16} className="text-white" />
                </div>
                <span className="font-extrabold tracking-tighter text-white uppercase text-sm drop-shadow-lg">Serene</span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className={`p-2.5 rounded-full transition-all active:scale-95 ${
                  isSettingsOpen
                    ? 'bg-white text-black'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10'
                }`}
              >
                <Settings size={16} className={isSettingsOpen ? 'text-black' : 'text-white'} />
              </button>
            </div>

            {/* Track Display */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 md:space-y-10 min-h-0 overflow-hidden">
              {track ? (
                <>
                  <div 
                    ref={coverRef}
                    className="relative group w-full aspect-square max-w-[200px] md:max-w-[280px] shrink-0"
                    onMouseMove={(e) => {
                      if (!coverRef.current) return;
                      const rect = coverRef.current.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / rect.width - 0.5;
                      const y = (e.clientY - rect.top) / rect.height - 0.5;
                      setCoverMousePos({ x, y });
                    }}
                    onMouseEnter={() => setIsCoverHovered(true)}
                    onMouseLeave={() => {
                      setIsCoverHovered(false);
                      setCoverMousePos({ x: 0, y: 0 });
                    }}
                  >
                    <div className={`absolute -inset-4 md:-inset-8 opacity-20 blur-3xl rounded-full transition-all duration-1000 ${isPlaying ? 'scale-110' : 'scale-90'}`} style={{ backgroundColor: 'white' }} />
                    <div 
                      className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl border border-white/20 bg-black/40 transition-transform duration-125 ease-out"
                      style={{
                        transform: isCoverHovered 
                          ? `perspective(1000px) rotateX(${-coverMousePos.y * 25}deg) rotateY(${coverMousePos.x * 25}deg) scale3d(1.05, 1.05, 1.05)` 
                          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
                        willChange: 'transform'
                      }}
                    >
                      {track.metadata.coverUrl ? (
                        <img 
                          src={track.metadata.coverUrl} 
                          className={`w-full h-full object-cover transition-transform duration-[5s] ease-linear ${isPlaying ? 'scale-125' : 'scale-100'}`} 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Music size={64} className="text-white/10" /></div>
                      )}
                    </div>
                  </div>

                  <div className="text-center space-y-1 md:space-y-2 w-full px-2 shrink-0">
                    <h1 className="text-lg md:text-2xl font-black text-white truncate drop-shadow-xl tracking-tight leading-tight">{track.metadata.title}</h1>
                    <p className="text-xs md:text-sm text-white/50 truncate font-bold tracking-[0.2em] uppercase">{track.metadata.artist}</p>
                  </div>

                  <div className="h-6 md:h-44 w-full text-center px-6 shrink-0">
                    <p className="mt-2 text-[20px] md:text-[25px] font-bold text-white/70 italic drop-shadow-md tracking-wide">
                      {activeIndex !== -1 ? track.metadata.parsedLyrics[activeIndex].text : ""}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 text-white/20 text-center opacity-50">
                  <div className="p-12 rounded-[2.5rem] border-2 border-dashed border-white/5 bg-white/[0.02]"><Music size={48} strokeWidth={1} /></div>
                  <p className="text-[10px] uppercase tracking-[0.4em] font-black">Select Audio</p>
                </div>
              )}
            </div>

            {/* Controls - Fixed at bottom */}
            <div className="mt-4 md:mt-8 pt-4 md:pt-6 space-y-4 md:space-y-6 shrink-0">
              <div className="space-y-3">
                <input 
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  disabled={!track}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-white h-1.5"
                />
                <div className="flex justify-between px-1">
                  <span className="text-[10px] font-mono font-bold text-white/30">{formatTime(currentTime)}</span>
                  <span className="text-[10px] font-mono font-bold text-white/30">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-around">
                <button 
                  onClick={handlePrev}
                  disabled={!playlist.length}
                  className="text-white/30 hover:text-white transition-all disabled:opacity-5 active:scale-75"
                ><SkipBack size={24} md:size={28} /></button>
                
                <button 
                  onClick={togglePlay}
                  disabled={!track}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-30"
                >
                  {isPlaying ? <Pause size={24} md:size={28} fill="currentColor" /> : <Play size={24} md:size={28} fill="currentColor" className="ml-1" />}
                </button>
                
                <button 
                  onClick={handleNext}
                  disabled={!playlist.length}
                  className="text-white/30 hover:text-white transition-all disabled:opacity-5 active:scale-75"
                ><SkipForward size={24} md:size={28} /></button>
              </div>

              <div className="flex items-center justify-start gap-4 p-2 md:p-3">
              {track && (
                <a
                  href={track.objectUrl}
                  download={`${track.metadata.title} - ${track.metadata.artist}.mp3`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all text-white/80 hover:text-white text-sm"
                >
                  <Download size={14} />
                </a>
              )}
              <button 
                onClick={() => setPlaybackMode(prev => prev === 'single' ? 'list' : prev === 'list' ? 'shuffle' : 'single')}
                className={`p-2 rounded-xl transition-all ${playbackMode === 'single' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:text-white'}`}
              >
                {playbackMode === 'shuffle' ? <Shuffle size={16} /> : playbackMode === 'list' ? <Repeat size={16} /> : <Repeat1 size={16} />}
              </button>
              
              <button
                onClick={() => {
                  setSourceInputValue(customSourceUrl);
                  setIsCustomSourceOpen(true);
                }}
                className={`p-2 rounded-xl transition-all ${customSourceUrl ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:text-white'}`}
                title="设置自定义音乐源"
              >
                <Plus size={16} />
              </button>

              <div className="flex items-center gap-2">
                <a
                  href="https://github.com/Domdkw/Serene-Player"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                  title="GitHub"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60 hover:text-white">
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                    <path d="M9 18c-4.51 2-5-2-7-2"/>
                  </svg>
                </a>
                <img src="https://visitor-badge.laobi.icu/badge?page_id=domdkw.Serene-Player" alt="visitor badge" />
              </div>
            </div>
            </div>

          </section>

          {/* Page 2: Lyrics (Right) - Conditionally rendered for performance */}
          <section className="w-full h-full flex-shrink-0 relative overflow-hidden flex flex-col bg-transparent">
            {/* Only render lyrics content when currently on lyrics page */}
            {currentPage === 2 && (
              <>
                {/* Lyric Tags Header - AR & AL & Translation Toggle */}
                <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-center gap-4 px-6 md:px-20">
                  {(track?.metadata.lyricArtist || track?.metadata.lyricAlbum) && (
                    <>
                      {track.metadata.lyricArtist && (
                        <span className="text-xs md:text-sm text-white/60 font-medium tracking-wide bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                          AR: {track.metadata.lyricArtist}
                        </span>
                      )}
                      {track.metadata.lyricAlbum && (
                        <span className="text-xs md:text-sm text-white/60 font-medium tracking-wide bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                          AL: {track.metadata.lyricAlbum}
                        </span>
                      )}
                    </>
                  )}
                  {/* Translation Toggle Button - Only show if lyrics have translation */}
                  {track?.metadata.parsedLyrics.some(line => line.translation) && (
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm border transition-all ${
                        showTranslation
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                      }`}
                      title={showTranslation ? '隐藏翻译' : '显示翻译'}
                    >
                      <Languages size={14} />
                      <span className="text-xs font-medium">{showTranslation ? '译' : '原'}</span>
                    </button>
                  )}
                </div>
                <div
                  ref={lyricsContainerRef}
                  className="flex-1 overflow-y-auto px-6 md:px-20 py-[20vh] md:py-[45vh] hide-scrollbar"
                  onWheel={handleUserInteraction}
                  onTouchMove={handleUserInteraction}
                  onMouseDown={handleUserInteraction}
                >
                  {track && track.metadata.parsedLyrics.length > 0 ? (
                    <div className={`flex flex-col min-h-full transition-all duration-700 items-center justify-center`}>
                      {track.metadata.parsedLyrics.map((line, idx) => (
                        <LyricLine
                          key={idx}
                          line={line}
                          idx={idx}
                          isActive={idx === activeIndex}
                          lyricsType={lyricsType}
                          currentTime={currentTime}
                          nextLineTime={track.metadata.parsedLyrics[idx + 1]?.time}
                          fontWeight={fontWeight}
                          letterSpacing={letterSpacing}
                          lineHeight={lineHeight}
                          selectedFont={selectedFont}
                          activeIndex={activeIndex}
                          isSidebarOpen={false}
                          showTranslation={showTranslation}
                          onSeek={handleSeek}
                          activeLyricRef={activeLyricRef}
                          formatTime={formatTime}
                          getFontFamily={getFontFamily}
                        />
                      ))}
                    </div>
                  ) : track ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                      <Loader2 size={32} className="animate-spin opacity-20" />
                      <p className="text-sm md:text-xl italic font-medium tracking-tight opacity-40">No synchronized lyrics available</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/[0.05] gap-6">
                      <div className="p-12 rounded-[2.5rem] border-2 border-dashed border-white/5 bg-white/[0.02]"><Music size={48} strokeWidth={1} /></div>
                      <p className="text-[10px] uppercase tracking-[0.4em] font-black">Select Audio</p>
                    </div>
                  )}
                </div>

                {/* Top/Bottom Masking Gradients */}
                <div className="absolute top-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
                <div className="absolute bottom-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-t from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
              </>
            )}
          </section>
        </div>

        {/* Page Indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          <button
            onClick={() => setCurrentPage(0)}
            className={`w-2 h-2 rounded-full transition-all ${currentPage === 0 ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
          />
          <button
            onClick={() => setCurrentPage(1)}
            className={`w-2 h-2 rounded-full transition-all ${currentPage === 1 ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
          />
          <button
            onClick={() => setCurrentPage(2)}
            className={`w-2 h-2 rounded-full transition-all ${currentPage === 2 ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
          />
        </div>

        {/* Global Settings Panel */}
        <SettingsPanel
        isOpen={isSettingsOpen}
        chunkCount={chunkCount}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
        lineHeight={lineHeight}
        selectedFont={selectedFont}
        onChunkCountChange={setChunkCount}
        onFontWeightChange={setFontWeight}
        onLetterSpacingChange={setLetterSpacing}
        onLineHeightChange={setLineHeight}
        onFontChange={setSelectedFont}
        onClose={() => setIsSettingsOpen(false)}
      />

        {/* Navigation Hints */}
        {currentPage === 1 && (
          <>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/20 hover:text-white/50 transition-colors cursor-pointer z-20" onClick={() => setCurrentPage(0)}>
              <ChevronLeft size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden md:block">Library</span>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/20 hover:text-white/50 transition-colors cursor-pointer z-20" onClick={() => setCurrentPage(2)}>
              <span className="text-[10px] font-bold uppercase tracking-widest hidden md:block">Lyrics</span>
              <ChevronRight size={24} />
            </div>
          </>
        )}
        
        {/* Custom Source Modal */}
        {isCustomSourceOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-[#1a1a1f] rounded-2xl border border-white/[0.08] shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                    <Link2 size={18} className="text-white/80" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">自定义音乐源</h3>
                    <p className="text-[10px] text-white/40">设置播放列表 JSON 地址</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCustomSourceOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X size={16} className="text-white/60" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">音乐源 URL</label>
                  <input
                    type="text"
                    value={sourceInputValue}
                    onChange={(e) => setSourceInputValue(e.target.value)}
                    placeholder="https://example.com/playlist.json"
                    className="w-full px-4 py-3 bg-white/5 border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] text-sm"
                  />
                  <p className="text-[11px] text-white/40 mt-2">
                    留空则使用默认源 (./discList.json)
                  </p>
                </div>
                
                {customSourceUrl && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[11px] text-white/60 truncate flex-1">
                      当前: {customSourceUrl}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.05]">
                <button
                  onClick={() => {
                    localStorage.removeItem('customMusicSource');
                    setCustomSourceUrl('');
                    setSourceInputValue('');
                    setIsCustomSourceOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-xs"
                >
                  <RotateCcw size={14} />
                  还原默认
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCustomSourceOpen(false)}
                    className="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-xs"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      const url = sourceInputValue.trim();
                      if (url) {
                        localStorage.setItem('customMusicSource', url);
                        setCustomSourceUrl(url);
                      } else {
                        localStorage.removeItem('customMusicSource');
                        setCustomSourceUrl('');
                      }
                      setIsCustomSourceOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-all text-xs"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <audio
        ref={audioRef}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={onEnded}
      />

    </div>
  );
};

export default App;
