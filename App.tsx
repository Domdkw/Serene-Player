import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Upload, Music, Loader2, AlertCircle, Settings, FileAudio, FolderOpen, User, ChevronLeft, Folder, ListMusic, Repeat, Repeat1, Shuffle, Search, Plus, X, Link2, RotateCcw, Cloud
} from 'lucide-react';
import { Track, PlaylistItem, PlaybackMode } from './types';
import { extractMetadata } from './utils/metadata';
import { MusicLibrary } from './components/MusicLibrary';
import { ArtistsView } from './components/ArtistsView';
import { SearchPanel } from './components/SearchPanel';
import { NeteasePanel } from './components/NeteasePanel';
import SettingsPanel from './components/SettingsPanel';
import MusicPlayer from './components/MusicPlayer';
import MiniPlayerBar from './components/MiniPlayerBar';
import GlobalBackground from './components/GlobalBackground';
import fetchInChunks from 'fetch-in-chunks';
import { getFontUrl, getFontFamily } from './utils/fontUtils';
import { getArtistsFirstLetters, getFirstLetterSync, containsChinese } from './utils/pinyinLoader';
import { parseComposers, groupComposersByInitial } from './utils/composerUtils';

type NavTab = 'songs' | 'artists' | 'netease' | 'settings';

//region 使用memo优化子组件，避免不必要的重渲染
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
        ? 'bg-white text-black shadow-lg shadow-white/10' 
        : 'text-white/60 hover:text-white hover:bg-white/5'
    }`}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
      isActive ? 'bg-black/10' : 'bg-white/5'
    }`}>
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
    </div>
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

//region 流光加载条组件
const ShimmerLoadingBar = memo(({ progress }: { progress: number }) => (
  <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
    <div className="relative h-1.5 md:h-2 bg-white/5 overflow-hidden shimmer-effect">
      <div className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${progress}%` }} />
    </div>
  </div>
));

//region 文件夹加载指示器
const FolderLoadingIndicator = memo(({ name, progress }: { name: string; progress: number }) => (
  <div className="mb-6 p-4 bg-transparent rounded-2xl border border-white/[0.05] backdrop-blur-sm">
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

//region 内容切换动画包装器
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
  
  //region Playlist states
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playlistFolders, setPlaylistFolders] = useState<Record<string, PlaylistItem[]>>({});
  const [loadedLinks, setLoadedLinks] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('single');
  
  //region Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('songs');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  //region UI states
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [folderLoading, setFolderLoading] = useState<{name: string, progress: number} | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [loadingTrackUrl, setLoadingTrackUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  //region Custom Source states
  const [isCustomSourceOpen, setIsCustomSourceOpen] = useState(false);
  const [customSourceUrl, setCustomSourceUrl] = useState<string>(() => {
    return localStorage.getItem('customMusicSource') || '';
  });
  const [sourceInputValue, setSourceInputValue] = useState('');
  
  //region Settings states
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
  const [showSpectrum, setShowSpectrum] = useState<boolean>(() => {
    const saved = localStorage.getItem('showSpectrum');
    return saved ? saved === 'true' : true;
  });
  const [spectrumFps, setSpectrumFps] = useState<number>(() => {
    const saved = localStorage.getItem('spectrumFps');
    return saved ? parseInt(saved, 10) : 60;
  });

  //region Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);

  //region 加载字体
  useEffect(() => {
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

  //region 逐字歌词时间更新 - 100ms 高精度刷新
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  //region 保存翻译显示设置到 LocalStorage
  useEffect(() => {
    localStorage.setItem('showTranslation', showTranslation.toString());
  }, [showTranslation]);

  //region 性能优化：使用useCallback缓存函数
  const handleTabChange = useCallback((tab: NavTab) => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setSelectedArtist(null);
      setIsTransitioning(false);
    }, 200);
  }, [activeTab]);

  //region Load playlist on mount
  const defaultSourceUrl = './discList.json';
  
  const loadPlaylistFromUrl = useCallback(async (url: string) => {
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
  }, []);
  
  useEffect(() => {
    const url = customSourceUrl || defaultSourceUrl;
    loadPlaylistFromUrl(url);
  }, [customSourceUrl, loadPlaylistFromUrl]);

  //region 艺术家按首字母分组（支持中文转拼音）
  const [artistsByLetter, setArtistsByLetter] = useState<Record<string, string[]>>({});
  const [artistLetterMap, setArtistLetterMap] = useState<Record<string, string>>({});
  const [hasChineseArtists, setHasChineseArtists] = useState(false);

  // 初始分组（仅处理英文，中文暂时归为 #）
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

    // 对每个分组内的艺术家排序
    Object.keys(grouped).forEach(letter => {
      grouped[letter].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    });

    setArtistsByLetter(grouped);
    setArtistLetterMap(letterMap);
    setHasChineseArtists(hasChinese);
  }, [playlist]);

  // 当用户点击艺术家标签时，加载拼音库并重新分组中文艺术家
  const [pinyinLoaded, setPinyinLoaded] = useState(false);
  const [pinyinLoadError, setPinyinLoadError] = useState(false);

  useEffect(() => {
    if (activeTab === 'artists' && hasChineseArtists && !pinyinLoaded && !pinyinLoadError) {
      getArtistsFirstLetters(Object.keys(artistLetterMap).filter(a => containsChinese(a))).then(newLetters => {
        setArtistLetterMap(prev => ({ ...prev, ...newLetters }));

        // 重新分组
        const regrouped: Record<string, string[]> = {};
        Object.entries({ ...artistLetterMap, ...newLetters }).forEach(([artist, letter]) => {
          const letterKey = letter as string;
          if (!regrouped[letterKey]) {
            regrouped[letterKey] = [];
          }
          regrouped[letterKey].push(artist);
        });

        // 对每个分组内的艺术家排序
        Object.keys(regrouped).forEach(letter => {
          regrouped[letter].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        });

        setArtistsByLetter(regrouped);
        setPinyinLoaded(true);
      }).catch(err => {
        console.warn('Failed to load pinyin library:', err);
        setPinyinLoadError(true);
        // 失败时保持现有分组（中文在 # 组）
      });
    }
  }, [activeTab, hasChineseArtists, pinyinLoaded, pinyinLoadError, artistLetterMap]);

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

  //region Custom Source handlers
  const handleOpenCustomSource = useCallback(() => {
    setSourceInputValue(customSourceUrl);
    setIsCustomSourceOpen(true);
  }, [customSourceUrl]);

  const handleCloseCustomSource = useCallback(() => {
    setIsCustomSourceOpen(false);
  }, []);

  const handleSaveCustomSource = useCallback(() => {
    const url = sourceInputValue.trim();
    if (url) {
      localStorage.setItem('customMusicSource', url);
      setCustomSourceUrl(url);
    } else {
      localStorage.removeItem('customMusicSource');
      setCustomSourceUrl('');
    }
    setIsCustomSourceOpen(false);
  }, [sourceInputValue]);

  const handleResetToDefault = useCallback(() => {
    localStorage.removeItem('customMusicSource');
    setCustomSourceUrl('');
    setSourceInputValue('');
    setIsCustomSourceOpen(false);
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

  //region 渲染侧边栏
  const renderSidebar = useCallback(() => (
    <aside className="w-64 bg-transparent flex flex-col">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <Music size={20} className="text-white drop-shadow-md" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white drop-shadow-md">Serene</h1>
          <p className="text-xs text-white/40 drop-shadow-sm">Music Player</p>
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
          icon={Cloud}
          label="网易云"
          isActive={activeTab === 'netease'}
          onClick={() => handleTabChange('netease')}
        />
        <SidebarItem
          icon={Settings}
          label="设置"
          isActive={activeTab === 'settings'}
          onClick={() => handleTabChange('settings')}
        />
        <img
          src="https://visitor-badge.laobi.icu/badge?page_id=domdkw.Serene-Player"
          alt="visitor badge"
          className="backdrop-blur-sm p-2"
        />
      </nav>

    </aside>
  ), [activeTab, handleTabChange, playlist.length, artistsByLetter, isUploadMenuOpen]);

  const renderArtistsView = useCallback(() => {
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
  }, [selectedArtist, setSelectedArtist, playlist, currentIndex, isPlaying, loadMusicFromUrl, loadingTrackUrl, artistsByLetter, pinyinLoadError]);

  // 渲染歌曲视图（使用MusicLibrary组件）
  const renderSongsView = useCallback(() => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white drop-shadow-md">歌曲</h2>
          <p className="text-sm text-white/40 mt-1 drop-shadow-sm">
            {currentFolder ? currentFolder : `${Object.keys(playlistFolders).length} 个文件夹, ${playlist.length} 首歌曲`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={cyclePlaybackMode}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white transition-all duration-200 text-sm"
          >
            {getPlaybackModeIcon()}
            <span>
              {playbackMode === 'single' ? '单曲循环' : playbackMode === 'list' ? '列表循环' : '随机播放'}
            </span>
          </button>
          
          <button
            onClick={handleOpenCustomSource}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${customSourceUrl ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white'}`}
            title="设置自定义音乐源"
          >
            <Plus size={18} />
          </button>
          
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${isSearchOpen ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white'}`}
            title="搜索"
          >
            <Search size={18} />
          </button>
          
          <div className="relative" ref={uploadMenuRef}>
            <button
              onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white transition-all duration-200"
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
      
      <SearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        playlist={playlist}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        onTrackSelect={loadMusicFromUrl}
      />
      
      {/* Custom Source Modal */}
      {isCustomSourceOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md mx-4 bg-[#1a1a1f] rounded-2xl border border-white/[0.08] shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Link2 size={20} className="text-white/80" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">自定义音乐源</h3>
                  <p className="text-xs text-white/40">设置自定义播放列表 JSON 文件地址</p>
                </div>
              </div>
              <button
                onClick={handleCloseCustomSource}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-white/60" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">音乐源 URL</label>
                <input
                  type="text"
                  value={sourceInputValue}
                  onChange={(e) => setSourceInputValue(e.target.value)}
                  placeholder="https://example.com/playlist.json"
                  className="w-full px-4 py-3 bg-white/5 border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.08]"
                />
                <p className="text-xs text-white/40 mt-2">
                  留空则使用默认源 (./discList.json)
                </p>
              </div>
              
              {customSourceUrl && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-white/60 truncate flex-1">
                    当前: {customSourceUrl}
                  </span>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.05]">
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
              >
                <RotateCcw size={16} />
                还原默认
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseCustomSource}
                  className="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveCustomSource}
                  className="px-5 py-2 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-all text-sm"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  ), [currentFolder, playlistFolders, playlist, playbackMode, cyclePlaybackMode, getPlaybackModeIcon, folderLoading, currentIndex, isPlaying, loadingFolders, loadLinkedFolder, loadingTrackUrl, loadMusicFromUrl, isUploadMenuOpen, uploadMenuRef, fileInputRef, folderInputRef, isSearchOpen, customSourceUrl, handleOpenCustomSource, isCustomSourceOpen, sourceInputValue, handleCloseCustomSource, handleSaveCustomSource, handleResetToDefault]);

  //region 渲染网易云视图
  const renderNeteaseView = useCallback(() => (
    <div className="h-full flex flex-col">
      <NeteasePanel
        onTrackSelect={(item, index) => {
          loadMusicFromUrl(item.url, item);
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
    </div>
  ), [track?.objectUrl, isPlaying, loadMusicFromUrl, setPlaylist]);

  //region 渲染设置视图
  const renderSettingsView = useCallback(() => (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-white/[0.05]">
        <h2 className="text-2xl font-bold text-white drop-shadow-md">设置</h2>
        <p className="text-sm text-white/40 mt-1 drop-shadow-sm">自定义您的播放器</p>
      </div>
      
      <div className="flex-1 overflow-y-auto playlist-scrollbar p-4">
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
          showSpectrum={showSpectrum}
          setShowSpectrum={setShowSpectrum}
          spectrumFps={spectrumFps}
          setSpectrumFps={setSpectrumFps}
        />
      </div>
    </div>
  ), [chunkCount, fontWeight, letterSpacing, lineHeight, selectedFont, showTranslation, showSpectrum, spectrumFps]);

  //region 渲染主内容
  const renderMainContent = useCallback(() => {
    let content;
    switch (activeTab) {
      case 'artists':
        content = renderArtistsView();
        break;
      case 'netease':
        content = renderNeteaseView();
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
  }, [activeTab, isTransitioning, renderArtistsView, renderNeteaseView, renderSettingsView, renderSongsView]);

  return (
    <div className="h-screen w-full overflow-hidden" style={{ fontFamily: getFontFamily(selectedFont) }}>
      {/* Global Background - always visible */}
      <GlobalBackground coverUrl={track?.metadata.coverUrl} />

      {/* Audio element - always present */}
      <audio 
        ref={audioRef}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={onEnded}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
      />

      {/* Main library view - conditional visibility based on player state */}
      <div 
        className={`h-[calc(100vh-80px)] bg-transparent text-white flex overflow-hidden transition-opacity duration-300 ${
          showFullPlayer ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
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
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <AlertCircle size={18} />
            {errorMessage}
          </div>
        )}
      </div>

      {/* Mini Player Bar - always visible */}
      <MiniPlayerBar
        track={track}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackMode={playbackMode}
        showTranslation={showTranslation}
        showSpectrum={showSpectrum}
        spectrumFps={spectrumFps}
        audioRef={audioRef}
        onTogglePlay={togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onCyclePlaybackMode={cyclePlaybackMode}
        onToggleTranslation={() => setShowTranslation(!showTranslation)}
        onSeek={handleSeek}
        onOpenPlayer={() => setShowFullPlayer(!showFullPlayer)}
        isFullPlayerOpen={showFullPlayer}
        formatTime={formatTime}
      />

      {/* Full Player - overlay when showFullPlayer is true */}
      {track && (
        <div 
          className={`fixed inset-0 z-[60] transition-all duration-500 ease-in-out ${
            showFullPlayer 
              ? 'opacity-100 translate-y-0 pointer-events-auto' 
              : 'opacity-0 translate-y-[100%] pointer-events-none'
          }`}
        >
          <MusicPlayer
            track={track}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            showTranslation={showTranslation}
            setShowTranslation={setShowTranslation}
            onBack={() => setShowFullPlayer(false)}
            loadingProgress={loadingProgress}
            fontWeight={fontWeight}
            letterSpacing={letterSpacing}
            lineHeight={lineHeight}
            selectedFont={selectedFont}
            onSeek={handleSeek}
            formatTime={formatTime}
          />
        </div>
      )}
    </div>
  );
};

export default App;
