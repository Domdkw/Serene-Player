
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, Play, Pause, SkipBack, SkipForward, 
  Music, Clock, ListMusic, X, Repeat, Repeat1, Loader2, AlertCircle, Settings, Download, MoreVertical, FileAudio, FolderOpen, Shuffle
} from 'lucide-react';
import { Track, PlaylistItem, PlaybackMode } from './types';
import { extractMetadata } from './utils/metadata';
import { MusicLibrary } from './utils/MusicLibrary';
import SettingsPanel from './components/SettingsPanel';
import fetchInChunks from 'fetch-in-chunks';
import { getFontFamily, getFontUrl } from './utils/fontUtils';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('single');
  
  // UI states
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [folderLoading, setFolderLoading] = useState<{name: string, progress: number} | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [loadingTrackUrl, setLoadingTrackUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  
  // 3D cover effect states
  const [coverMousePos, setCoverMousePos] = useState({ x: 0, y: 0 });
  const [isCoverHovered, setIsCoverHovered] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  
  // Settings states

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
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

  // 加载字体
  useEffect(() => {
    // 移除所有已存在的字体链接
    const existingFontLinks = document.querySelectorAll('link[rel="stylesheet"][href*="fonts.font.im"]');
    existingFontLinks.forEach(link => link.remove());
    
    if (selectedFont !== 'default') {
      const fontUrl = getFontUrl(selectedFont);
      if (fontUrl) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = fontUrl;
        
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
  const manualScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);
  const [isManualScrolling, setIsManualScrolling] = useState(false);

  // Load playlist on mount
  useEffect(() => {
    fetch('./discList.json')
      .then(res => {
        if (!res.ok) throw new Error("Playlist file (discList.json) not found.");
        return res.json();
      })
      .then(data => {
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
        
        // 通知 index.html 隐藏加载动画
        console.log('[App] Trying to hide loader, hideAppLoader exists:', !!(window as any).hideAppLoader);
        if ((window as any).hideAppLoader) {
          (window as any).hideAppLoader();
        }
      })
      .catch(err => {
        console.error("Failed to load playlist", err);
        setErrorMessage("Could not load playlist. Check if discList.json exists.");
        // 即使加载失败也要隐藏加载动画
        if ((window as any).hideAppLoader) {
          (window as any).hideAppLoader();
        }
      });
  }, []);



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
      let file: File;
      let objectUrl: string;
      
      // 检查是否是本地文件（通过文件夹上传的）
      if (item.file) {
        // 直接使用已上传的文件
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
      
      const metadata = await extractMetadata(file);
      
      const oldUrl = track?.objectUrl;
      
      setTrack({ file, objectUrl, metadata });
      setLoadingProgress(null);
      setLoadingTrackUrl(null);
      setLyricsLoading(false);
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
    const newTracks: PlaylistItem[] = audioFiles.map((file, index) => ({
      name: file.name.replace(/\.[^/.]+$/, ''), // 移除扩展名
      url: URL.createObjectURL(file),
      artist: 'Unknown Artist',
      file: file
    }));

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

  // 处理用户交互的函数
  const handleUserInteraction = () => {
    // 1. 设为手动模式，停止自动滚动
    setIsManualScrolling(true);

    // 2. 清除之前的计时器
    if (manualScrollTimerRef.current) {
      clearTimeout(manualScrollTimerRef.current);
    }

    // 3. 设置 5 秒后恢复自动滚动
    manualScrollTimerRef.current = setTimeout(() => {
      setIsManualScrolling(false);
    }, 5000);
  };

  useEffect(() => {
    // 增加判断：如果处于手动操作期间，直接跳过自动滚动逻辑
    if (isManualScrolling) return;

    if (isAutoScrolling && activeLyricRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeElement = activeLyricRef.current;
      const scrollPos = activeElement.offsetTop - container.offsetHeight / 2 + activeElement.offsetHeight / 2;
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activeIndex, isAutoScrolling, isManualScrolling]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const settingsPanel = document.querySelector('[data-settings-panel]');
      const settingsButton = document.querySelector('[data-settings-button]');
      
      if (isSettingsOpen && settingsPanel && settingsButton && 
          !settingsPanel.contains(target) && !settingsButton.contains(target)) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

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

  return (
    <div className="h-screen w-full flex flex-col bg-black text-slate-200 relative overflow-hidden font-sans" style={{ fontFamily: getFontFamily(selectedFont) }}>
      
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
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-neutral-900">
        {track?.metadata.coverUrl && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 left-[-200vw] w-[400vw] h-[400vh] animate-rotate-cover transition-all duration-1000"
            style={{
              backgroundImage: `url(${track.metadata.coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(50px) brightness(0.7)',
            }}
          />
        )}
      </div>

      {/* Main Content: Responsive Split */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden z-10">
        
        {/* Left Column: Fixed/Scrollable Sidebar (35% on Desktop) */}
        <section className="w-full md:w-[35%] lg:w-[30%] flex flex-col p-4 md:p-6 md:border-r border-white/10 bg-black/20 backdrop-blur-xl relative overflow-y-auto hide-scrollbar shrink-0 h-[60vh] md:h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 md:mb-10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shadow-inner">
                 <Music size={16} className="text-white" />
              </div>
              <span className="font-extrabold tracking-tighter text-white uppercase text-sm drop-shadow-lg">Serene</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Upload Menu */}
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
              <button 
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className={`p-2 rounded-full transition-all active:scale-95 ${isSidebarOpen ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
              >
                <ListMusic size={14} className={isSidebarOpen ? 'text-black' : 'text-white'} />
              </button>
            </div>
          </div>

          {/* Track Display */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 md:space-y-10 min-h-0">
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

                <div className="text-center space-y-2 w-full px-2">
                  <h1 className="text-xl md:text-2xl font-black text-white truncate drop-shadow-xl tracking-tight leading-tight">{track.metadata.title}</h1>
                  <p className="text-xs md:text-sm text-white/50 truncate font-bold tracking-[0.2em] uppercase">{track.metadata.artist}</p>
                </div>

                <div className="h-4 md:h-6 w-full text-center px-4">
                  <p className="text-[10px] md:text-xs font-bold text-white/70 italic line-clamp-1 drop-shadow-md tracking-wide">
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

          {/* Controls - Fixed at bottom but part of scroll on very small screens */}
          <div className="mt-8 pt-6 space-y-6 shrink-0">
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
              ><SkipBack size={28} /></button>
              
              <button 
                onClick={togglePlay}
                disabled={!track}
                className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-30"
              >
                {isPlaying ? <Pause size={28} md:size={32} fill="currentColor" /> : <Play size={28} md:size={32} fill="currentColor" className="ml-1" />}
              </button>
              
              <button 
                onClick={handleNext}
                disabled={!playlist.length}
                className="text-white/30 hover:text-white transition-all disabled:opacity-5 active:scale-75"
              ><SkipForward size={28} /></button>
            </div>

            <div className="flex items-center justify-start gap-4  p-3">
              <button
                onClick={() => setPlaybackMode(prev => prev === 'single' ? 'list' : prev === 'list' ? 'shuffle' : 'single')}
                className={`p-2 rounded-xl transition-all ${playbackMode === 'single' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:text-white'}`}
              >
                {playbackMode === 'shuffle' ? <Shuffle size={16} /> : playbackMode === 'list' ? <Repeat size={16} /> : <Repeat1 size={16} />}
              </button>
              {track && (
                <a
                  href={track.objectUrl}
                  download={`${track.metadata.title} - ${track.metadata.artist}.mp3`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all text-white/80 hover:text-white text-sm"
                >
                  <Download size={14} />
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Settings Icon - Bottom Right */}
        <div className="fixed bottom-4 right-4 z-[65] flex flex-col items-center gap-2">
          <button
            data-settings-button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${isSettingsOpen ? 'bg-white text-black' : 'hover:bg-white/10'}`}
          >
            <Settings size={18} className={isSettingsOpen ? 'text-black' : 'text-white/70 hover:text-white transition-colors'} />
          </button>
        </div>

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
      />

        {/* Right Column: Lyrics (65% on Desktop) */}
        <section className="flex-1 relative overflow-hidden flex flex-col bg-transparent h-[40vh] md:h-full">
          <div
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto px-6 md:px-20 py-[20vh] md:py-[45vh] hide-scrollbar"
            onWheel={handleUserInteraction}
            onTouchMove={handleUserInteraction}
            onMouseDown={handleUserInteraction}
          >
            {track && track.metadata.parsedLyrics.length > 0 ? (
              <div className={`flex flex-col min-h-full transition-all duration-700 ${isSidebarOpen ? 'items-start' : 'items-center justify-center'}`}>
                {track.metadata.parsedLyrics.map((line, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <div 
                      key={idx}
                      ref={isActive ? activeLyricRef : null}
                      onClick={() => handleSeek(line.time)}
                      className={`group relative py-2 md:py-4 cursor-pointer transition-all duration-700 text-center md:text-left ${
                        isActive ? 'text-white' : 'text-white/20'
                      }`}
                      style={{ 
                        marginBottom: isActive ? '2rem' : '1rem',
                        marginTop: isActive ? '2rem' : '1rem'
                      }}
                    >
                      {/* Precise Time Tag */}
                      <div className="absolute left-1/2 md:left-0 -top-6 md:-top-10 -translate-x-1/2 md:translate-x-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[10px] text-white/80 font-mono bg-white/10 px-2 py-1 rounded-lg border border-white/10 backdrop-blur-xl z-20">
                        <Clock size={10} />
                        {formatTime(line.time)}
                      </div>
                      
                      <p 
                        className={`font-black leading-[1.1] md:leading-tight drop-shadow-2xl transition-all duration-700 select-none relative ${
                          isActive 
                            ? 'text-2xl md:text-[3vw] lg:text-[32px] opacity-100 scale-100 origin-center md:origin-left' 
                            : activeIndex !== -1 && (idx === activeIndex - 1 || idx === activeIndex + 1)
                              ? 'text-lg text-white/80 md:text-[2vw] lg:text-[28px] opacity-100 hover:text-white blur-0'
                              : 'text-lg md:text-[2vw] lg:text-[28px] opacity-80 blur-[0.5px] text-white/50 hover:opacity-100 hover:blur-0 hover:scale-105 hover:text-white'
                        }`}
                        style={{
                          fontWeight: fontWeight === 'light' ? '300' : fontWeight === 'medium' ? '500' : '700',
                          letterSpacing: `${letterSpacing}px`,
                          lineHeight: lineHeight,
                          fontFamily: getFontFamily(selectedFont)
                        }}
                      >
                        {isActive && line.chars && line.chars.length > 0 && (() => {
                          let progress = 0;
                          for (let i = 0; i < line.chars.length; i++) {
                            const char = line.chars[i];
                            const nextCharTime = line.chars[i + 1]?.time || track.metadata.parsedLyrics[idx + 1]?.time || char.time;
                            if (currentTime >= char.time) {
                              if (currentTime < nextCharTime) {
                                progress = ((i + (currentTime - char.time) / (nextCharTime - char.time)) / line.chars.length) * 100;
                                break;
                              } else if (i === line.chars.length - 1) {
                                progress = 100;
                              }
                            }
                          }
                          return (
                            <span 
                              className="absolute left-0 top-0 bottom-0 bg-white/10 rounded-lg -z-10 transition-all duration-50 ease-linear"
                              style={{
                                width: `${Math.min(100, Math.max(0, progress))}%`
                              }}
                            />
                          );
                        })()}
                        {line.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : track ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                <Loader2 size={32} className="animate-spin opacity-20" />
                <p className="text-sm md:text-xl italic font-medium tracking-tight opacity-40">No synchronized lyrics available</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/[0.05] gap-6">
                <div className="w-[80%] max-w-4xl flex flex-col items-center">
                  <h2 className="text-xs font-black tracking-[0.4em] text-white/40 flex items-center gap-3 uppercase mb-6">
                    <ListMusic size={18} />
                    Music Library
                  </h2>
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
                </div>
              </div>
            )}
          </div>
          
          {/* Top/Bottom Masking Gradients */}
          <div className="absolute top-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-t from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
        </section>
      </main>

      {/* Playlist Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-80 lg:w-96 z-[70] bg-black/40 backdrop-blur-[40px] border-l border-white/10 shadow-2xl transition-easeInOut duration-500 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col p-6 md:p-10">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xs font-black tracking-[0.4em] text-white/40 flex items-center gap-3 uppercase">
              <ListMusic size={18} />
              Music Library
            </h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
            >
              <X size={20} />
            </button>
          </div>
          
          <MusicLibrary
            playlistFolders={playlistFolders}
            currentFolder={currentFolder}
            setCurrentFolder={setCurrentFolder}
            playlist={playlist}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            onTrackSelect={loadMusicFromUrl}
            isSidebar={true}
            isLoading={lyricsLoading}
            onLoadLinkedFolder={loadLinkedFolder}
            loadingTrackUrl={loadingTrackUrl}
            loadingFolders={loadingFolders}
          />
          
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
             <p className="text-[9px] uppercase font-black tracking-[0.5em] text-white/10">Version 2.0 Lumina</p>
          </div>
        </div>
      </div>

      <audio 
        ref={audioRef}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={onEnded}
      />

      <style>{`
        @keyframes music-bar {
          0%, 100% { height: 6px; }
          50% { height: 16px; }
        }
        @keyframes rainbow-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes rotate-cover {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
        @keyframes rotate-rainbow {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
        @keyframes shimmer {
          0% { 
            left: -100%; 
          }
          100% { 
            left: 200%; 
          }
        }
        @keyframes wave {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(0%); }
        }
        .inline-block {
          will-change: background-size, transform;
        }
        .animate-rainbow-flow {
          background: linear-gradient(
            90deg,
            #ff5151ff,
            #ff8f33ff,
            #fffb00,
            #7bff46ff,
            #00ffd5,
            #4160ffff,
            #9c3effff,
            #ff43d6ff,
            #ff0707ff
          );
          background-size: 400% 100%;
          animation: rainbow-flow 20s linear infinite;
          filter: blur(100px) brightness(0.8);
        }
        .animate-rotate-cover {
          animation: rotate-cover 60s linear infinite;
        }
        .animate-rotate-rainbow {
          animation: rotate-rainbow 30s linear infinite;
        }
        .shimmer-effect {
          position: relative;
          overflow: hidden;
        }
        .shimmer-effect::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 40%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0.1) 60%,
            transparent 100%
          );
          animation: shimmer 3s ease-in-out infinite;
        }
        /* Removed shimmer-item styles as they are no longer used */
        @media (max-width: 768px) {
           input[type="range"]::-webkit-slider-thumb {
              height: 14px;
              width: 14px;
           }
        }
      `}</style>
    </div>
  );
};

export default App;
