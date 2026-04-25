import React, { useState, useCallback, useMemo, lazy, Suspense, useEffect, useRef } from 'react';
import {
  Upload, Music, Settings, ChevronLeft, ChevronRight, Download, FileAudio, FolderOpen, Plus, Link2, RotateCcw, Cloud, X, AlertCircle, Disc, User, Search, Repeat, Repeat1, Shuffle, Cable, Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerProvider, usePlayer } from '../contexts/PlayerContext';
import { PlaylistProvider, usePlaylist } from '../contexts/PlaylistContext';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import { useQueryParams, useArtists, useFileUpload, useNetease, useSwipeGesture, useMobileMenu, usePageTitle } from '../hooks';
import { getFontFamily } from '../utils/fontUtils';
import { MusicLibrary } from '../components/MusicLibrary';
import { ArtistsView } from '../components/ArtistsView';
import { SearchPanel } from '../components/SearchPanel';
import { PlaybackControls, ProgressBar, CoverArt, LyricsDisplay } from '../components/shared';
import SettingsPanel from '../components/SettingsPanel';
import LyricLine from '../components/LyricLine';
import TogetherListenPanel from '../components/TogetherListenPanel';

const NeteasePanel = lazy(() => import('../components/NeteasePanel').then(m => ({ default: m.NeteasePanel })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

const defaultSourceUrl = './discList.json';

/**
 * 网易云音乐图标组件
 */
const NeteaseIcon = () => (
  <img src="https://s1.music.126.net/style/favicon.ico" alt="网易云" className="w-3.5 h-3.5" />
);

type LibraryView = 'songs' | 'artists' | 'netease' | 'together';

/**
 * 移动端应用内容组件
 * 使用 Context 管理状态，使用可复用组件构建 UI
 */
const MobileAppContent: React.FC = () => {
  const player = usePlayer();
  const playlist = usePlaylist();
  const settings = useSettings();

  const [libraryView, setLibraryView] = useState<LibraryView>('netease');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [localSongsLoaded, setLocalSongsLoaded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCustomSourceOpen, setIsCustomSourceOpen] = useState(false);
  const [sourceInputValue, setSourceInputValue] = useState('');
  const [page0Visited, setPage0Visited] = useState(false);
  const [playlistReady, setPlaylistReady] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const neteasePanelRef = useRef<any>(null);

  const {
    artistsByLetter,
    pinyinLoadError
  } = useArtists({
    playlist: playlist.playlist,
    activeTab: libraryView === 'artists' ? 'artists' : 'netease',
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const togetherListenRef = useRef<any>(null);
  const page0VisitedRef = useRef(page0Visited);
  const handlePageChange = useCallback((page: number) => {
    if (page === 0 && !page0VisitedRef.current) {
      page0VisitedRef.current = true;
      setPage0Visited(true);
    }
  }, []);

  const {
    currentPage,
    setCurrentPage,
    dragOffset,
  } = useSwipeGesture({
    maxPage: 2,
    minPage: 0,
    onPageChange: handlePageChange,
  });

  // 后台一起听连接管理器（保持连接不随页面切换而断开）
  const [togetherListenConnected, setTogetherListenConnected] = useState(false);
  const togetherListenManagerRef = useRef<any>(null);

  useEffect(() => {
    // 当用户切换到其他页面时，检查是否有一起听连接
    if (currentPage !== 0 && togetherListenRef.current) {
      const isConnected = togetherListenRef.current.isConnected();
      setTogetherListenConnected(isConnected);
    } else {
      setTogetherListenConnected(false);
    }
  }, [currentPage]);

  const uploadMenu = useMobileMenu();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isSwipingRef = useRef(false);

  const handleTouchStartWrapped = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartRef.current = { x: clientX, y: clientY };
    isSwipingRef.current = false;
  }, []);

  const handleTouchMoveWrapped = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - touchStartRef.current.x;
    const deltaY = clientY - touchStartRef.current.y;

    if (!isSwipingRef.current) {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
      
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        touchStartRef.current = null;
        return;
      }
      isSwipingRef.current = true;
    }
  }, []);

  const handleTouchEndWrapped = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartRef.current) return;

    const clientX = 'changedTouches' in e ? (e as unknown as TouchEvent).changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const deltaX = clientX - touchStartRef.current.x;
    const threshold = window.innerWidth * 0.15;

    if (Math.abs(deltaX) > threshold && isSwipingRef.current) {
      if (deltaX < 0 && currentPage < 2) {
        setCurrentPage(currentPage + 1);
      } else if (deltaX > 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    }

    touchStartRef.current = null;
    isSwipingRef.current = false;
  }, [currentPage, setCurrentPage]);

  const loadMusicFromUrl = useCallback(async (item: any, index: number) => {
    await player.loadTrackFromItem(
      {
        url: item.url,
        name: item.name,
        artist: item.artist,
        album: item.album,
        coverUrl: item.coverUrl,
        lyrics: item.lyrics,
        neteaseId: item.neteaseId,
        artistIds: item.artistIds,
        file: item.file,
      },
      index,
      {
        streamingMode: settings.streamingMode,
        chunkCount: settings.chunkCount,
      }
    );
  }, [player, settings.streamingMode, settings.chunkCount]);

  const {
    loadNeteaseMusic,
  } = useNetease({
    onLoadTrack: loadMusicFromUrl,
    neteasePlaylist: playlist.neteasePlaylist,
    setNeteaseCurrentIndex: playlist.setNeteaseCurrentIndex,
    updateNeteaseLikedIndexById: playlist.updateNeteaseLikedIndexById,
  });

  const addToPlaylistFolders = useCallback((name: string, items: any[]) => {
    playlist.setPlaylistFolders(prev => ({
      ...prev,
      [name]: items,
    }));
  }, [playlist]);

  const {
    handleFileUpload,
    handleFolderUpload,
    triggerFileUpload,
    triggerFolderUpload,
  } = useFileUpload({
    onTrackLoad: loadMusicFromUrl,
    addToPlaylist: playlist.addMultipleToPlaylist,
    addToPlaylistFolders,
    currentIndex: playlist.currentIndex,
  });

  const loadPlaylistFromUrl = useCallback(async (url: string) => {
    const success = await playlist.loadPlaylistFromUrl(url);
    if (success) {
      setPlaylistReady(true);
    }
    return success;
  }, [playlist]);

  useQueryParams({
    onPlayNeteaseMusic: (item, index) => {
      playlist.addToPlaylist(item);
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
    getPlaylist: () => playlist.playlist,
    setShouldAutoPlay,
    onSeekTo: (timeInSeconds: number) => {
      player.handleSeek(timeInSeconds);
    },
  });

  useEffect(() => {
    if (playlistReady) {
      setLocalSongsLoaded(true);
    }
  }, [playlistReady]);

  useEffect(() => {
    if (libraryView === 'songs' && !localSongsLoaded) {
      const url = settings.customSourceUrl || defaultSourceUrl;
      loadPlaylistFromUrl(url);
      setLocalSongsLoaded(true);
    }
  }, [libraryView, localSongsLoaded, settings.customSourceUrl, loadPlaylistFromUrl]);

  useEffect(() => {
    if ((window as any).hideAppLoader) {
      (window as any).hideAppLoader();
    }
  }, []);

  usePageTitle(player.track);

  const currentTrackItem: any | null = player.track ? {
    name: player.track.metadata.title,
    artist: player.track.metadata.artist,
    neteaseId: player.track.neteaseId,
    coverUrl: player.track.metadata.coverUrl || undefined,
    url: player.track.objectUrl,
    artistIds: player.track.artistIds,
    album: player.track.metadata.album,
    lyrics: player.track.metadata.lyrics,
  } : null;

  const handleNext = useCallback(() => {
    if (player.playbackMode === 'shuffle') {
      let randomIndex: number;
      if (playlist.neteasePlaylist.length > 0 && libraryView === 'netease') {
        do {
          randomIndex = Math.floor(Math.random() * playlist.neteasePlaylist.length);
        } while (playlist.neteasePlaylist.length > 1 && randomIndex === playlist.neteaseLikedCurrentIndex);
        loadNeteaseMusic(playlist.neteasePlaylist[randomIndex], randomIndex);
      } else if (playlist.playlist.length === 0) return;
      else {
        do {
          randomIndex = Math.floor(Math.random() * playlist.playlist.length);
        } while (playlist.playlist.length > 1 && randomIndex === playlist.currentIndex);
        loadMusicFromUrl(playlist.playlist[randomIndex], randomIndex);
      }
    } else if (playlist.neteasePlaylist.length > 0 && libraryView === 'netease') {
      // 网易云音乐模式 - 只使用内存中的"我喜欢"列表索引
      let nextIndex;
      if (playlist.neteaseLikedCurrentIndex === -1) {
        // 如果当前索引为 -1，从第一个开始
        nextIndex = 0;
      } else {
        // 列表循环：到达末尾时回到开头
        nextIndex = (playlist.neteaseLikedCurrentIndex + 1) % playlist.neteasePlaylist.length;
      }
      loadNeteaseMusic(playlist.neteasePlaylist[nextIndex], nextIndex);
    } else if (playlist.currentFolder && playlist.playlistFolders[playlist.currentFolder]) {
      const folderTracks = playlist.playlistFolders[playlist.currentFolder];
      const currentTrack = playlist.playlist[playlist.currentIndex];
      if (Array.isArray(folderTracks)) {
        const currentFolderIndex = folderTracks.findIndex((t: any) => t.url === currentTrack?.url);
        if (currentFolderIndex !== -1) {
          const nextFolderIndex = (currentFolderIndex + 1) % folderTracks.length;
          const nextTrack = folderTracks[nextFolderIndex];
          const nextGlobalIndex = playlist.playlist.findIndex(p => p.url === nextTrack.url);
          loadMusicFromUrl(nextTrack, nextGlobalIndex);
        }
      }
    } else {
      if (playlist.playlist.length === 0) return;
      const nextIndex = (playlist.currentIndex + 1) % playlist.playlist.length;
      loadMusicFromUrl(playlist.playlist[nextIndex], nextIndex);
    }
  }, [player.playbackMode, playlist, libraryView, loadNeteaseMusic, loadMusicFromUrl]);

  const handlePrev = useCallback(() => {
    if (player.playbackMode === 'shuffle') {
      handleNext();
    } else if (playlist.neteasePlaylist.length > 0 && libraryView === 'netease') {
      // 网易云音乐模式 - 只使用内存中的"我喜欢"列表索引
      if (playlist.neteaseLikedCurrentIndex === -1) {
        // 如果当前索引为 -1，从第一个开始
        loadNeteaseMusic(playlist.neteasePlaylist[0], 0);
      } else {
        const prevIndex = (playlist.neteaseLikedCurrentIndex - 1 + playlist.neteasePlaylist.length) % playlist.neteasePlaylist.length;
        loadNeteaseMusic(playlist.neteasePlaylist[prevIndex], prevIndex);
      }
    } else if (playlist.currentFolder && playlist.playlistFolders[playlist.currentFolder]) {
      const folderTracks = playlist.playlistFolders[playlist.currentFolder];
      const currentTrack = playlist.playlist[playlist.currentIndex];
      if (Array.isArray(folderTracks)) {
        const currentFolderIndex = folderTracks.findIndex((t: any) => t.url === currentTrack?.url);
        if (currentFolderIndex !== -1) {
          const prevFolderIndex = (currentFolderIndex - 1 + folderTracks.length) % folderTracks.length;
          const prevTrack = folderTracks[prevFolderIndex];
          const prevGlobalIndex = playlist.playlist.findIndex(p => p.url === prevTrack.url);
          loadMusicFromUrl(prevTrack, prevGlobalIndex);
        }
      }
    } else {
      if (playlist.playlist.length === 0) return;
      const prevIndex = (playlist.currentIndex - 1 + playlist.playlist.length) % playlist.playlist.length;
      loadMusicFromUrl(playlist.playlist[prevIndex], prevIndex);
    }
  }, [player.playbackMode, playlist, libraryView, handleNext, loadNeteaseMusic, loadMusicFromUrl]);

  const cyclePlaybackMode = useCallback(() => {
    player.cyclePlaybackMode();
  }, [player.cyclePlaybackMode]);

  const handleSeek = useCallback((time: number) => {
    player.handleSeek(time);
  }, [player]);

  const activeIndex = useMemo(() => {
    if (!player.track?.metadata.parsedLyrics.length) return -1;
    let index = -1;
    for (let i = 0; i < player.track.metadata.parsedLyrics.length; i++) {
      if (player.track.metadata.parsedLyrics[i].time <= player.currentTime) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [player.track, player.currentTime]);

  const lyricsType = useMemo(() => {
    if (!player.track?.metadata.parsedLyrics.length) return 'none';
    return 'line';
  }, [player.track]);

  const renderNeteaseView = useCallback(() => {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <NeteasePanel
          ref={neteasePanelRef}
          onTrackSelect={loadNeteaseMusic}
          currentTrackUrl={player.track?.objectUrl || null}
          isPlaying={player.isPlaying}
          onAddToPlaylist={() => {}}
          neteasePlaylist={playlist.neteasePlaylist}
          neteaseCurrentIndex={playlist.neteaseCurrentIndex}
          setNeteasePlaylist={playlist.setNeteasePlaylist}
          setNeteaseCurrentIndex={playlist.setNeteaseCurrentIndex}
        />
      </Suspense>
    );
  }, [loadNeteaseMusic, player.track, player.isPlaying, playlist]);

  return (
    <div className="h-dvh w-full flex flex-col bg-black text-slate-200 relative overflow-hidden font-sans" style={{ fontFamily: getFontFamily(settings.selectedFont) }}>

      {player.loadingProgress !== null && (
        <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
          <div className="relative h-1.5 md:h-2 bg-white/5 overflow-hidden shimmer-effect">
            <div className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${player.loadingProgress}%` }} />
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-neutral-800">
        {player.track?.metadata.coverUrl && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 left-[-200vw] w-[400vw] h-[400vh]"
            style={{
              backgroundImage: `url(${player.track.metadata.coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(50px) brightness(0.7)',
            }}
            animate={settings.backgroundRotate ? { rotate: 360 } : { rotate: 0 }}
            transition={{
              duration: 120,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        )}
      </div>

      <main 
        className="flex-1 overflow-hidden z-10 relative"
        onTouchStart={handleTouchStartWrapped}
        onTouchMove={handleTouchMoveWrapped}
        onTouchEnd={handleTouchEndWrapped}
        onMouseDown={handleTouchStartWrapped}
        onMouseMove={handleTouchMoveWrapped}
        onMouseUp={handleTouchEndWrapped}
        onMouseLeave={handleTouchEndWrapped}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(-${currentPage * 100}% + ${dragOffset}px))`,
          }}
        >
          <section className="w-full h-full flex-shrink-0 flex flex-col p-4 md:p-8 bg-black/20 backdrop-blur-xl overflow-hidden !pb-0">
            <div className="flex items-center justify-center gap-4 mb-4 md:mb-6 shrink-0">
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setLibraryView('netease')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    libraryView === 'netease' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                  title="网易云音乐"
                >
                  <NeteaseIcon />
                </button>
                <button
                  onClick={() => setLibraryView('songs')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    libraryView === 'songs' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                  title="本地歌曲"
                >
                  <Disc size={14} />
                </button>
                <button
                  onClick={() => setLibraryView('artists')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    libraryView === 'artists' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                  title="艺术家"
                >
                  <User size={14} />
                </button>
                <button
                  onClick={() => setLibraryView('together')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    libraryView === 'together' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                  title="一起听"
                >
                  <Cable size={14} />
                </button>
              </div>

              {libraryView === 'songs' && (// 本地歌曲模式下的操作按钮
                <>
                  <button
                    onClick={() => {
                      setSourceInputValue(settings.customSourceUrl);
                      setIsCustomSourceOpen(true);
                    }}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                      settings.customSourceUrl ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
                    }`}
                    title="设置自定义音乐源"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                      isSearchOpen ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    <Search size={14} />
                  </button>
                </>
              )}

              <div className="relative" ref={uploadMenu.menuRef}>
                <button
                  ref={uploadMenu.buttonRef}
                  onClick={uploadMenu.toggle}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-white/10 active:scale-95"
                >
                  <Upload size={12} className="text-white" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Local</span>
                </button>

                {uploadMenu.isOpen && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        triggerFileUpload();
                        uploadMenu.close();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <FileAudio size={16} className="text-white/80" />
                      <span className="text-xs font-medium text-white/90">上传文件</span>
                    </button>
                    <div className="h-px bg-white/10 mx-2" />
                    <button
                      onClick={() => {
                        triggerFolderUpload();
                        uploadMenu.close();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <FolderOpen size={16} className="text-white/80" />
                      <span className="text-xs font-medium text-white/90">上传文件夹</span>
                    </button>
                  </div>
                )}

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

            <div className="flex-1 overflow-y-auto hide-scrollbar pb-0">
              {(() => {
                switch (libraryView) {
                  case 'netease':
                    return renderNeteaseView();
                  case 'songs':
                    return (
                      <Suspense fallback={<LoadingFallback />}>
                        <MusicLibrary
                        playlistFolders={playlist.playlistFolders}
                        currentFolder={playlist.currentFolder}
                        setCurrentFolder={playlist.setCurrentFolder}
                        playlist={playlist.playlist}
                        currentIndex={playlist.currentIndex}
                        isPlaying={player.isPlaying}
                        onTrackSelect={loadMusicFromUrl}
                        isSidebar={false}
                        isLoading={player.lyricsLoading}
                        onLoadLinkedFolder={playlist.loadLinkedFolder}
                        loadingTrackUrl={player.loadingTrackUrl}
                        loadingFolders={playlist.loadingFolders}
                        />
                      </Suspense>
                    );
                  case 'artists':
                    return (
                      <Suspense fallback={<LoadingFallback />}>
                        <ArtistsView
                          selectedArtist={selectedArtist}
                          setSelectedArtist={setSelectedArtist}
                          playlist={playlist.playlist}
                          currentIndex={playlist.currentIndex}
                          isPlaying={player.isPlaying}
                          loadMusicFromUrl={loadMusicFromUrl}
                          loadingTrackUrl={player.loadingTrackUrl}
                          artistsByLetter={artistsByLetter}
                          pinyinLoadError={pinyinLoadError}
                          isMobile={true}
                        />
                      </Suspense>
                    );
                  case 'together':
                    return (
                      <Suspense fallback={<LoadingFallback />}>
                        <TogetherListenPanel
                          ref={togetherListenRef}
                          isPlaying={player.isPlaying}
                          currentTime={player.currentTime}
                          currentTrack={currentTrackItem}
                          onPlayPause={player.togglePlay}
                          onSeek={(time) => player.handleSeek(time)}
                          onTrackChange={(neteaseId) => {
                            const index = playlist.neteasePlaylist.findIndex(p => p.neteaseId === neteaseId);
                            if (index !== -1) {
                              loadNeteaseMusic(playlist.neteasePlaylist[index], index);
                            }
                          }}
                          formatTime={player.formatTime}
                        />
                        {togetherListenConnected && currentPage !== 0 && (
                          <div className="absolute top-4 right-4 z-10">
                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-3 py-2 rounded-lg border border-white/20">
                              <Wifi size={14} className="text-green-400" />
                              <span className="text-xs text-white/80">一起听连接中</span>
                              <button
                                onClick={() => {
                                  if (togetherListenRef.current?.disconnect) {
                                    togetherListenRef.current.disconnect();
                                    setTogetherListenConnected(false);
                                  }
                                }}
                                className="ml-1 text-white/60 hover:text-white transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </Suspense>
                    );
                  default:
                    return null;
                }
              })()}
              <SearchPanel
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                playlist={playlist.playlist}
                currentIndex={playlist.currentIndex}
                isPlaying={player.isPlaying}
                onTrackSelect={loadMusicFromUrl}
                isMobile={true}
              />
            </div>
          </section>

          <section className="w-full h-full flex-shrink-0 flex flex-col p-4 md:p-8 bg-transparent overflow-hidden relative">
            <div className="flex items-center justify-between mb-6 md:mb-10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shadow-inner">
                  <Music size={16} className="text-white" />
                </div>
                <span className="font-extrabold tracking-tighter text-white uppercase text-sm drop-shadow-lg">Serene</span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-full transition-all active:scale-95 bg-white/5 hover:bg-white/10 border border-white/10"
              >
                <Settings size={16} className="text-white" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-4 md:space-y-10 min-h-0 overflow-hidden">
              {player.track ? (
                <>
                  <CoverArt
                    coverUrl={player.track.metadata.coverUrl}
                    title={player.track.metadata.title}
                    isPlaying={player.isPlaying}
                    enable3DEffect={true}
                    size="md"
                  />

                  <div className="text-center space-y-1 md:space-y-2 w-full px-2 shrink-0">
                    <h1 className="text-lg md:text-2xl font-black text-white truncate drop-shadow-xl tracking-tight leading-tight">
                      {player.track.metadata.title}
                    </h1>
                    <p className="text-xs md:text-sm text-white/50 truncate font-bold tracking-[0.2em] uppercase">
                      {player.track.metadata.artist}
                    </p>
                  </div>

                  <div className="h-6 md:h-44 w-full text-center px-6 shrink-0">
                    <p className="mt-2 text-[20px] md:text-[25px] font-bold text-white/70 italic drop-shadow-md tracking-wide">
                      {activeIndex !== -1 ? player.track.metadata.parsedLyrics[activeIndex].text : ''}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 text-white/20 text-center opacity-50">
                  <div className="p-12 rounded-[2.5rem] border-2 border-dashed border-white/5 bg-white/[0.02]">
                    <Music size={48} strokeWidth={1} />
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.4em] font-black">Select Audio</p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 md:pt-6 space-y-4 md:space-y-6 shrink-0 pb-4">
              <ProgressBar
                currentTime={player.currentTime}
                duration={player.duration}
                disabled={!player.track}
                onSeek={handleSeek}
                formatTime={player.formatTime}
                showTime={true}
              />

              <div className="space-y-4">
                <PlaybackControls
                  isPlaying={player.isPlaying}
                  hasTrack={!!player.track}
                  hasPlaylist={playlist.neteasePlaylist.length > 0 || playlist.playlist.length > 0}
                  playbackMode={player.playbackMode}
                  onTogglePlay={player.togglePlay}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  size="sm"
                />

                <div className="flex items-center gap-4 px-2">
                  {player.track && (
                    <a
                      href={player.track.objectUrl}
                      download={`${player.track.metadata.title} - ${player.track.metadata.artist}.mp3`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all text-white/80 hover:text-white text-sm"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  <button
                    onClick={cyclePlaybackMode}
                    disabled={!player.track}
                    className={`p-2 rounded-xl transition-all ${
                      player.playbackMode === 'single'
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-white/40 hover:text-white'
                    }`}
                    title={player.playbackMode === 'single' ? '单曲循环' : player.playbackMode === 'list' ? '列表循环' : '随机播放'}
                  >
                    {player.playbackMode === 'single' ? (
                      <Repeat1 size={18} />
                    ) : player.playbackMode === 'list' ? (
                      <Repeat size={18} />
                    ) : (
                      <Shuffle size={18} />
                    )}
                  </button>
                </div>
              </div>

              {player.loadingTrackUrl && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-xs text-white/80 font-medium">加载中...</span>
                </div>
              )}
            </div>
          </section>

          <section className="w-full h-full flex-shrink-0 relative overflow-hidden flex flex-col bg-transparent">
            {currentPage === 2 && player.track && (
              <>
                <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-center gap-4 px-6 md:px-20">
                  {(player.track.metadata.lyricArtist || player.track.metadata.lyricAlbum) && (
                    <>
                      {player.track.metadata.lyricArtist && (
                        <span className="text-xs md:text-sm text-white/60 font-medium tracking-wide bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                          AR: {player.track.metadata.lyricArtist}
                        </span>
                      )}
                      {player.track.metadata.lyricAlbum && (
                        <span className="text-xs md:text-sm text-white/60 font-medium tracking-wide bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                          AL: {player.track.metadata.lyricAlbum}
                        </span>
                      )}
                    </>
                  )}
                  {player.track.metadata.parsedLyrics.some(line => line.translation) && (
                    <button
                      onClick={() => settings.setShowTranslation(!settings.showTranslation)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm border transition-all ${
                        settings.showTranslation
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xs font-medium">{settings.showTranslation ? '译' : '原'}</span>
                    </button>
                  )}
                </div>

                <LyricsDisplay
                  lyrics={player.track.metadata.parsedLyrics}
                  currentTime={player.currentTime}
                  showTranslation={settings.showTranslation}
                  fontWeight={settings.fontWeight}
                  letterSpacing={settings.letterSpacing}
                  lineHeight={settings.lineHeight}
                  selectedFont={settings.selectedFont}
                  isPlaying={player.isPlaying}
                  onSeek={handleSeek}
                  formatTime={player.formatTime}
                />

                <div className="absolute top-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
                <div className="absolute bottom-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-t from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
              </>
            )}
          </section>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          {[0, 1, 2].map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-2 h-2 rounded-full transition-all ${currentPage === page ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>

        {currentPage === 1 && (
          <>
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/20 hover:text-white/50 transition-colors cursor-pointer z-20"
              onClick={() => setCurrentPage(0)}
            >
              <ChevronLeft size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden md:block">Library</span>
            </div>
            <div
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/20 hover:text-white/50 transition-colors cursor-pointer z-20"
              onClick={() => setCurrentPage(2)}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest hidden md:block">Lyrics</span>
              <ChevronRight size={24} />
            </div>
          </>
        )}

        <AnimatePresence>
          {isCustomSourceOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm mx-4 bg-[#1a1a1f] rounded-2xl border border-white/[0.08] shadow-2xl"
              >
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
                  <p className="text-[11px] text-white/40 mt-2">留空则使用默认源 (./discList.json)</p>
                </div>

                {settings.customSourceUrl && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[11px] text-white/60 truncate flex-1">当前: {settings.customSourceUrl}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.05]">
                <button
                  onClick={() => {
                    settings.setCustomSourceUrl('');
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
                      settings.setCustomSourceUrl(url);
                      setIsCustomSourceOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-all text-xs"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>

        {isSettingsOpen && (
          <SettingsPanel
            chunkCount={settings.chunkCount}
            setChunkCount={settings.setChunkCount}
            fontWeight={settings.fontWeight}
            setFontWeight={settings.setFontWeight}
            letterSpacing={settings.letterSpacing}
            setLetterSpacing={settings.setLetterSpacing}
            lineHeight={settings.lineHeight}
            setLineHeight={settings.setLineHeight}
            selectedFont={settings.selectedFont}
            setSelectedFont={settings.setSelectedFont}
            showTranslation={settings.showTranslation}
            setShowTranslation={settings.setShowTranslation}
            streamingMode={settings.streamingMode}
            setStreamingMode={settings.setStreamingMode}
            backgroundRotate={settings.backgroundRotate}
            setBackgroundRotate={settings.setBackgroundRotate}
            isMobile={true}
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </main>

      <audio
        ref={player.audioRef}
        onLoadedMetadata={() => player.setDuration(player.audioRef.current?.duration || 0)}
        onTimeUpdate={() => player.setCurrentTime(player.audioRef.current?.currentTime || 0)}
        onEnded={() => {
          if (player.playbackMode === 'single') {
            if (player.audioRef.current) {
              player.audioRef.current.currentTime = 0;
              player.audioRef.current.play().catch(() => {});
            }
          } else {
            handleNext();
          }
        }}
      />
    </div>
  );
};

/**
 * 移动端应用入口组件
 * 包装 Context Providers
 */
const MobileApp: React.FC = () => {
  return (
    <SettingsProvider>
      <PlaylistProvider>
        <PlayerProvider>
          <MobileAppContent />
        </PlayerProvider>
      </PlaylistProvider>
    </SettingsProvider>
  );
};

export default MobileApp;
