import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { 
  Upload, Music, X, Loader2, AlertCircle, Settings, FileAudio, FolderOpen, User, ChevronLeft, Folder, ListMusic, Repeat, Repeat1, Shuffle
} from 'lucide-react';
import { Track, PlaylistItem, PlaybackMode } from './types';
import { extractMetadata } from './utils/metadata';
import { MusicLibrary } from './utils/MusicLibrary';
import SettingsPanel from './components/SettingsPanel';
import MusicPlayer from './components/MusicPlayer';
import fetchInChunks from 'fetch-in-chunks';
import { getFontUrl } from './utils/fontUtils';

type NavTab = 'songs' | 'artists' | 'settings';

// 使用memo优化子组件，避免不必要的重渲染
const SidebarItem = memo(({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick,
  badge
}: { 
  icon: React.ElementType; 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
  badge?: number;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out group relative overflow-hidden ${
      isActive 
        ? 'bg-white text-black' 
        : 'text-white/60 hover:text-white hover:bg-white/5'
    }`}
  >
    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
    <span className="font-medium text-sm">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
        isActive ? 'bg-black/10 text-black' : 'bg-white/10 text-white/60'
      }`}>
        {badge}
      </span>
    )}
  </button>
));

// 流光加载条组件
const ShimmerLoadingBar = memo(({ progress }: { progress: number }) => (
  <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
    <div className="relative h-1.5 md:h-2 bg-white/5 overflow-hidden shimmer-effect">
      <div className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${progress}%` }} />
    </div>
  </div>
));

// 文件夹加载指示器
const FolderLoadingIndicator = memo(({ name, progress }: { name: string; progress: number }) => (
  <div className="mb-6 p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05] backdrop-blur-sm">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <Loader2 size={16} className="text-white/60 animate-spin" />
        </div>
        <div>
          <span className="text-sm text-white font-medium">Loading {name}</span>
          <span className="text-xs text-white/40 ml-2">{progress}%</span>
        </div>
      </div>
    </div>
    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
      <div 
        className="h-full relative overflow-hidden rounded-full transition-all duration-300"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
      </div>
    </div>
  </div>
));

// 艺术家字母分组
const ArtistLetterGroup = memo(({ 
  letter, 
  artists, 
  onSelect 
}: { 
  letter: string; 
  artists: string[]; 
  onSelect: (artist: string) => void;
}) => (
  <div className="mb-6">
    <div className="sticky top-0 z-10 px-4 py-2 bg-[#121214]/95 backdrop-blur-sm">
      <span className="text-2xl font-black text-white/20">{letter}</span>
    </div>
    <div className="space-y-1 px-2">
      {artists.map((artist, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(artist)}
          className="w-full text-left px-4 py-3 text-white/70 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all duration-200 text-sm font-medium"
        >
          {artist}
        </button>
      ))}
    </div>
  </div>
));

// 内容切换动画包装器
const AnimatedContent = memo(({ 
  children, 
  activeTab,
  className = ''
}: { 
  children: React.ReactNode; 
  activeTab: NavTab;
  className?: string;
}) => {
  const [displayTab, setDisplayTab] = useState(activeTab);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (displayTab !== activeTab) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayTab(activeTab);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, displayTab]);

  return (
    <div 
      className={`transition-all duration-300 ease-out ${
        isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      } ${className}`}
    >
      {children}
    </div>
  );
});

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
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('songs');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // UI states
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [folderLoading, setFolderLoading] = useState<{name: string, progress: number} | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [loadingTrackUrl, setLoadingTrackUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  

  
  // Settings states
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
  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    const saved = localStorage.getItem('showTranslation');
    return saved ? saved === 'true' : true;
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);

  // 加载字体
  useEffect(() => {
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

  // 保存翻译显示设置到 LocalStorage
  useEffect(() => {
    localStorage.setItem('showTranslation', showTranslation.toString());
  }, [showTranslation]);

  // 性能优化：使用useCallback缓存函数
  const handleTabChange = useCallback((tab: NavTab) => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setSelectedArtist(null);
      setIsTransitioning(false);
    }, 200);
  }, [activeTab]);

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
        
        if ((window as any).hideAppLoader) {
          (window as any).hideAppLoader();
        }
      })
      .catch(err => {
        console.error("Failed to load playlist", err);
        setErrorMessage("Could not load playlist. Check if discList.json exists.");
        if ((window as any).hideAppLoader) {
          (window as any).hideAppLoader();
        }
      });
  }, []);

  // 性能优化：使用useMemo缓存计算结果
  const artistsByLetter = useMemo(() => {
    const artistSet = new Set<string>();
    playlist.forEach(item => {
      if (item.artist) artistSet.add(item.artist);
    });
    
    const grouped: Record<string, string[]> = {};
    Array.from(artistSet).sort((a, b) => a.localeCompare(b, 'zh-CN')).forEach(artist => {
      const firstLetter = artist.charAt(0).toUpperCase();
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(artist);
    });
    
    return grouped;
  }, [playlist]);

  const loadLinkedFolder = useCallback(async (folderName: string, linkUrl: string) => {
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
  }, [loadedLinks]);

  const loadMusicFromUrl = useCallback(async (item: PlaylistItem, index: number) => {
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
      
      if (item.file) {
        file = item.file;
        objectUrl = item.url;
        setLoadingProgress(100);
      } else if (item.url.startsWith('blob:')) {
        const response = await fetch(item.url);
        const blob = await response.blob();
        file = new File([blob], item.name, { type: blob.type || 'audio/mpeg' });
        objectUrl = item.url;
        setLoadingProgress(100);
      } else {
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
        objectUrl = URL.createObjectURL(blob);
      }
      
      const metadata = await extractMetadata(file);
      
      const oldUrl = track?.objectUrl;
      
      setTrack({ file, objectUrl, metadata });
      setLoadingProgress(null);
      setLoadingTrackUrl(null);
      setLyricsLoading(false);
      
      // 延迟播放以避免 AbortError
      setTimeout(async () => {
        if (audioRef.current) {
          audioRef.current.src = objectUrl;
          audioRef.current.load();
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (e) {
            console.warn("Autoplay was prevented.", e);
          }
        }
      }, 100);

      // 延迟释放旧 URL
      if (oldUrl && !oldUrl.startsWith('blob:')) {
        setTimeout(() => {
          URL.revokeObjectURL(oldUrl);
        }, 1000);
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
  }, [chunkCount, track?.objectUrl]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [track?.objectUrl]);

  const supportedAudioFormats = useMemo(() => ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.ape', '.opus'], []);

  const isAudioFile = useCallback((filename: string): boolean => {
    const lowerName = filename.toLowerCase();
    return supportedAudioFormats.some(ext => lowerName.endsWith(ext));
  }, [supportedAudioFormats]);

  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const audioFiles: File[] = [];

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

    audioFiles.sort((a, b) => a.name.localeCompare(b.name));

    const newTracks: PlaylistItem[] = audioFiles.map((file, index) => ({
      name: file.name.replace(/\.[^/.]+$/, ''),
      url: URL.createObjectURL(file),
      artist: 'Unknown Artist',
      file: file
    }));

    setPlaylist(prev => [...prev, ...newTracks]);

    const folderName = `Local Folder ${new Date().toLocaleTimeString()}`;
    setPlaylistFolders(prev => ({
      ...prev,
      [folderName]: newTracks
    }));

    if (newTracks.length > 0) {
      const firstTrack = newTracks[0];
      const file = audioFiles[0];
      setLoadingProgress(100);
      try {
        const metadata = await extractMetadata(file);
        const objectUrl = URL.createObjectURL(file);
        const oldUrl = track?.objectUrl;
        setTrack({ file, objectUrl, metadata });
        setCurrentIndex(playlist.length);
        setLoadingProgress(null);
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

    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  }, [isAudioFile, playlist.length, track?.objectUrl]);

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

  const handleNext = useCallback(() => {
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
  }, [playbackMode, playlist, currentIndex, currentFolder, playlistFolders, loadMusicFromUrl]);

  const handlePrev = useCallback(() => {
    if (playbackMode === 'shuffle') {
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
  }, [playbackMode, playlist, currentIndex, currentFolder, playlistFolders, loadMusicFromUrl, handleNext]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !track) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => {
        console.error("Playback error:", e);
      });
    }
  }, [isPlaying, track]);

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current && time >= 0) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const formatTime = useCallback((time: number) => {
    if (time < 0) return "--:--";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);



  const onEnded = useCallback(() => {
    if (playbackMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      handleNext();
    }
  }, [playbackMode, handleNext]);

  const cyclePlaybackMode = useCallback(() => {
    setPlaybackMode(prev => {
      if (prev === 'single') return 'list';
      if (prev === 'list') return 'shuffle';
      return 'single';
    });
  }, []);

  const getPlaybackModeIcon = useCallback(() => {
    if (playbackMode === 'single') return <Repeat1 size={18} />;
    if (playbackMode === 'list') return <Repeat size={18} />;
    return <Shuffle size={18} />;
  }, [playbackMode]);

  // 渲染侧边栏
  const renderSidebar = useCallback(() => (
    <aside className="w-64 bg-[#0a0a0c] border-r border-white/[0.05] flex flex-col">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Music size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Serene</h1>
          <p className="text-xs text-white/40">Music Player</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <SidebarItem
          icon={ListMusic}
          label="歌曲"
          isActive={activeTab === 'songs'}
          onClick={() => handleTabChange('songs')}
          badge={playlist.length}
        />
        <SidebarItem
          icon={User}
          label="艺术家"
          isActive={activeTab === 'artists'}
          onClick={() => handleTabChange('artists')}
          badge={Object.values(artistsByLetter).flat().length}
        />
        <SidebarItem
          icon={Settings}
          label="设置"
          isActive={activeTab === 'settings'}
          onClick={() => handleTabChange('settings')}
        />
      </nav>

    </aside>
  ), [activeTab, handleTabChange, playlist.length, artistsByLetter, isUploadMenuOpen]);

  // 渲染艺术家视图
  const renderArtistsView = useCallback(() => {
    if (selectedArtist) {
      const artistTracks = playlist.filter(item => item.artist === selectedArtist);
      
      return (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-4 p-6 border-b border-white/[0.05]">
            <button
              onClick={() => setSelectedArtist(null)}
              className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={20} className="text-white/60" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white">{selectedArtist}</h2>
              <p className="text-sm text-white/40">{artistTracks.length} 首歌曲</p>
            </div>
          </div>
          
          {/* Track List */}
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

    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-white/[0.05]">
          <h2 className="text-2xl font-bold text-white">艺术家</h2>
          <p className="text-sm text-white/40 mt-1">按字母排序</p>
        </div>
        
        <div className="flex-1 overflow-y-auto playlist-scrollbar p-4">
          {Object.keys(artistsByLetter).sort().map(letter => (
            <ArtistLetterGroup
              key={letter}
              letter={letter}
              artists={artistsByLetter[letter]}
              onSelect={setSelectedArtist}
            />
          ))}
        </div>
      </div>
    );
  }, [selectedArtist, playlist, currentIndex, isPlaying, loadingTrackUrl, loadMusicFromUrl, artistsByLetter]);

  // 渲染歌曲视图（使用MusicLibrary组件）
  const renderSongsView = useCallback(() => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">歌曲</h2>
          <p className="text-sm text-white/40 mt-1">
            {currentFolder ? currentFolder : `${Object.keys(playlistFolders).length} 个文件夹, ${playlist.length} 首歌曲`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={cyclePlaybackMode}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/70 hover:text-white transition-all duration-200 text-sm"
          >
            {getPlaybackModeIcon()}
            <span>
              {playbackMode === 'single' ? '单曲循环' : playbackMode === 'list' ? '列表循环' : '随机播放'}
            </span>
          </button>
          
          <div className="relative" ref={uploadMenuRef}>
            <button
              onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/70 hover:text-white transition-all duration-200"
              title="导入音乐"
            >
              <Upload size={18} />
            </button>
            
            {isUploadMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-[#1a1a1f] rounded-xl border border-white/[0.05] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsUploadMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors text-left text-sm"
                >
                  <FileAudio size={16} />
                  导入文件
                </button>
                <button
                  onClick={() => {
                    folderInputRef.current?.click();
                    setIsUploadMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors text-left text-sm"
                >
                  <FolderOpen size={16} />
                  导入文件夹
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Folder Loading Indicator */}
      {folderLoading && (
        <div className="px-6 pt-4">
          <FolderLoadingIndicator name={folderLoading.name} progress={folderLoading.progress} />
        </div>
      )}
      
      {/* Music Library */}
      <div className="flex-1 overflow-hidden p-6 pt-4">
        <MusicLibrary
          playlistFolders={playlistFolders}
          currentFolder={currentFolder}
          setCurrentFolder={setCurrentFolder}
          playlist={playlist}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onTrackSelect={loadMusicFromUrl}
          loadingFolders={loadingFolders}
          onLoadLinkedFolder={loadLinkedFolder}
          loadingTrackUrl={loadingTrackUrl}
        />
      </div>
    </div>
  ), [currentFolder, playlistFolders, playlist, playbackMode, cyclePlaybackMode, getPlaybackModeIcon, folderLoading, currentIndex, isPlaying, loadingFolders, loadLinkedFolder, loadingTrackUrl, loadMusicFromUrl, isUploadMenuOpen, uploadMenuRef, fileInputRef, folderInputRef]);

  // 渲染设置视图
  const renderSettingsView = useCallback(() => (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-white/[0.05]">
        <h2 className="text-2xl font-bold text-white">设置</h2>
        <p className="text-sm text-white/40 mt-1">自定义您的播放器</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <SettingsPanel
          chunkCount={chunkCount}
          setChunkCount={setChunkCount}
          fontWeight={fontWeight}
          setFontWeight={setFontWeight}
          letterSpacing={letterSpacing}
          setLetterSpacing={setLetterSpacing}
          lineHeight={lineHeight}
          setLineHeight={setLineHeight}
          selectedFont={selectedFont}
          setSelectedFont={setSelectedFont}
          showTranslation={showTranslation}
          setShowTranslation={setShowTranslation}
        />
      </div>
    </div>
  ), [chunkCount, fontWeight, letterSpacing, lineHeight, selectedFont, showTranslation]);

  // 渲染主内容
  const renderMainContent = useCallback(() => {
    let content;
    switch (activeTab) {
      case 'artists':
        content = renderArtistsView();
        break;
      case 'settings':
        content = renderSettingsView();
        break;
      case 'songs':
      default:
        content = renderSongsView();
        break;
    }

    return (
      <div 
        className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${
          isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        {content}
      </div>
    );
  }, [activeTab, isTransitioning, renderArtistsView, renderSettingsView, renderSongsView]);

  return (
    <>
      {/* Audio element - always present */}
      <audio 
        ref={audioRef}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={onEnded}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
      />

      {/* 播放器视图 */}
      {track ? (
        <MusicPlayer
          track={track}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          showTranslation={showTranslation}
          setShowTranslation={setShowTranslation}
          onBack={() => setTrack(null)}
          onTogglePlay={togglePlay}
          onPrev={handlePrev}
          onNext={handleNext}
          onCyclePlaybackMode={cyclePlaybackMode}
          playbackMode={playbackMode}
          loadingProgress={loadingProgress}
          fontWeight={fontWeight}
          letterSpacing={letterSpacing}
          lineHeight={lineHeight}
          selectedFont={selectedFont}
          onSeek={handleSeek}
          formatTime={formatTime}
        />
      ) : (
        // Main library view
        <div className="h-screen bg-[#121214] text-white flex overflow-hidden">
          {/* Hidden inputs */}
          <input
            type="file"
            accept="audio/*"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderUpload}
            className="hidden"
            // @ts-ignore
            webkitdirectory=""
            directory=""
          />

          {/* Top loading bar with shimmer effect */}
          {loadingProgress !== null && <ShimmerLoadingBar progress={loadingProgress} />}

          {/* Sidebar */}
          {renderSidebar()}

          {/* Main Content */}
          {renderMainContent()}

          {/* Error Toast */}
          {errorMessage && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <AlertCircle size={18} />
              {errorMessage}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite linear;
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
        .playlist-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .playlist-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .playlist-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .playlist-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </>
  );
};

export default App;
