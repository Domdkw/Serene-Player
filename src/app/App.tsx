import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { Track, PlaylistItem, PlaybackMode } from '../types';
import { PlayerProvider, usePlayer, PlayerTimeProvider, usePlayerTime, PlaylistProvider, usePlaylist, SettingsProvider, useSettings } from '../contexts';
import { useQueryParams, useArtists, useNetease, usePageTitle, useSharePanel } from '../hooks';
import { getFontFamily } from '../utils/fontUtils';
import { ErrorService } from '../utils/errorService';
import { ErrorBoundary, ShimmerLoadingBar } from '../components/common';
import { Sidebar, GlobalBackground } from '../components/layout';
import { SongsView } from '../components/library';
import { MiniPlayerBar } from '../components/player';
import { SharedSong } from '../utils/songEncodingUtils';

type NavTab = 'songs' | 'artists' | 'netease' | 'together' | 'settings' | 'share';

const ArtistsView = lazy(() => import('../components/library/ArtistsView').then(m => ({ default: m.ArtistsView })));
const NeteasePanel = lazy(() => import('../components/panels/NeteasePanel').then(m => ({ default: m.NeteasePanel })));
const SettingsPanel = lazy(() => import('../components/panels/SettingsPanel'));
const MusicPlayer = lazy(() => import('../components/player/MusicPlayer'));
const TogetherListenPanel = lazy(() => import('../components/panels/TogetherListenPanel'));
const SharePanel = lazy(() => import('../components/panels/SharePanel'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

const defaultSourceUrl = './discList.json';

const AppContent: React.FC = () => {
  const player = usePlayer();
  const playerTime = usePlayerTime();
  const playlist = usePlaylist();
  const settings = useSettings();

  const [activeTab, setActiveTab] = useState<NavTab>('netease');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [localSongsLoaded, setLocalSongsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playlistReady, setPlaylistReady] = useState(false);
  const [isTogetherListenConnected, setIsTogetherListenConnected] = useState(false);
  const [sharedSongs, setSharedSongs] = useState<SharedSong[]>([]);

  const neteasePanelRef = useRef<any>(null);
  const togetherListenRef = useRef<any>(null);

  const {
    artistsByLetter,
    pinyinLoadError
  } = useArtists({
    playlist: playlist.playlist,
    activeTab
  });

  const sharePanel = useSharePanel();

  const loadMusicFromUrl = useCallback(async (item: PlaylistItem, index: number) => {
    setErrorMessage(null);
    playlist.setCurrentIndex(index);
    await player.loadTrackFromItem(
      playerTime.audioRef,
      {
        url: item.url,
        name: item.name,
        artist: item.artist,
        album: item.album,
        coverUrl: item.coverUrl,
        lyrics: item.lyrics,
        translatedLyrics: item.translatedLyrics,
        neteaseId: item.neteaseId,
        artistIds: item.artistIds,
        file: item.file
      },
      index,
      {
        streamingMode: settings.streamingMode,
        chunkCount: settings.chunkCount
      },
      {
        setIsPlaying: playerTime.setIsPlaying,
        setCurrentTime: playerTime.setCurrentTime,
        setDuration: playerTime.setDuration,
      }
    );
  }, [player, playerTime, playlist, settings.streamingMode, settings.chunkCount]);

  const {
    loadNeteaseMusic,
    playNeteaseById
  } = useNetease({
    onLoadTrack: loadMusicFromUrl,
    neteasePlaylist: playlist.neteasePlaylist,
    setNeteaseCurrentIndex: playlist.setNeteaseCurrentIndex,
    updateNeteaseLikedIndexById: playlist.updateNeteaseLikedIndexById
  });

  const loadPlaylistFromUrl = useCallback(async (url: string) => {
    const success = await playlist.loadPlaylistFromUrl(url);
    if (success) {
      setPlaylistReady(true);
    }
    return success;
  }, [playlist]);

  const handleTabChange = useCallback((tab: NavTab) => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setSelectedArtist(null);
      setIsTransitioning(false);
    }, 200);

    if (tab === 'songs' && !localSongsLoaded) {
      const url = settings.customSourceUrl || defaultSourceUrl;
      loadPlaylistFromUrl(url);
      setLocalSongsLoaded(true);
    }
  }, [activeTab, localSongsLoaded, settings.customSourceUrl, loadPlaylistFromUrl]);

  const handleNext = useCallback(() => {
    const isPlayingNetease = !!player.track?.neteaseId;
    
    if (player.playbackMode === 'shuffle') {
      if (isPlayingNetease && playlist.neteasePlaylist.length > 0) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * playlist.neteasePlaylist.length);
        } while (playlist.neteasePlaylist.length > 1 && randomIndex === playlist.neteaseLikedCurrentIndex);
        loadNeteaseMusic(playlist.neteasePlaylist[randomIndex], randomIndex);
      } else if (playlist.playlist.length > 0) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * playlist.playlist.length);
        } while (playlist.playlist.length > 1 && randomIndex === playlist.currentIndex);
        loadMusicFromUrl(playlist.playlist[randomIndex], randomIndex);
      }
    } else if (isPlayingNetease && playlist.neteasePlaylist.length > 0) {
      let nextIndex;
      if (playlist.neteaseLikedCurrentIndex === -1) {
        nextIndex = 0;
      } else {
        nextIndex = (playlist.neteaseLikedCurrentIndex + 1) % playlist.neteasePlaylist.length;
      }
      loadNeteaseMusic(playlist.neteasePlaylist[nextIndex], nextIndex);
    } else if (playlist.currentFolder && playlist.playlistFolders[playlist.currentFolder]) {
      const folderTracks = playlist.playlistFolders[playlist.currentFolder];
      const currentTrack = playlist.playlist[playlist.currentIndex];
      if (Array.isArray(folderTracks)) {
        let currentFolderIndex;
        if (currentTrack) {
          currentFolderIndex = folderTracks.findIndex((t: PlaylistItem) => t.url === currentTrack.url);
        } else {
          currentFolderIndex = -1;
        }

        if (currentFolderIndex !== -1) {
          const nextFolderIndex = (currentFolderIndex + 1) % folderTracks.length;
          const nextTrack = folderTracks[nextFolderIndex];
          const nextGlobalIndex = playlist.playlist.findIndex(p => p.url === nextTrack.url);
          loadMusicFromUrl(nextTrack, nextGlobalIndex);
        } else if (folderTracks.length > 0) {
          loadMusicFromUrl(folderTracks[0], 0);
        }
      }
    } else {
      if (playlist.playlist.length === 0) return;
      let nextIndex: number;
      if (playlist.currentIndex === -1) {
        nextIndex = 0;
      } else {
        nextIndex = (playlist.currentIndex + 1) % playlist.playlist.length;
      }
      loadMusicFromUrl(playlist.playlist[nextIndex], nextIndex);
    }
  }, [player.playbackMode, player.track, playlist, loadNeteaseMusic, loadMusicFromUrl]);

  const handlePrev = useCallback(() => {
    const isPlayingNetease = !!player.track?.neteaseId;
    
    if (player.playbackMode === 'shuffle') {
      handleNext();
    } else if (isPlayingNetease && playlist.neteasePlaylist.length > 0) {
      if (playlist.neteaseLikedCurrentIndex === -1) return;
      const prevIndex = (playlist.neteaseLikedCurrentIndex - 1 + playlist.neteasePlaylist.length) % playlist.neteasePlaylist.length;
      loadNeteaseMusic(playlist.neteasePlaylist[prevIndex], prevIndex);
    } else if (playlist.currentFolder && playlist.playlistFolders[playlist.currentFolder]) {
      const folderTracks = playlist.playlistFolders[playlist.currentFolder];
      const currentTrack = playlist.playlist[playlist.currentIndex];
      if (Array.isArray(folderTracks)) {
        const currentFolderIndex = folderTracks.findIndex((t: PlaylistItem) => t.url === currentTrack?.url);

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
  }, [player.playbackMode, player.track, playlist, handleNext, loadNeteaseMusic, loadMusicFromUrl]);

  const togglePlay = useCallback(() => {
    if (!playerTime.audioRef.current || !player.track) return;
    if (playerTime.isPlaying) {
      playerTime.audioRef.current.pause();
      playerTime.setIsPlaying(false);
    } else {
      const playPromise = playerTime.audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playerTime.setIsPlaying(true);
          })
          .catch((error) => {
            console.error('播放失败:', error);
            ErrorService.handleError(error, 'Playback');
            if (error.name === 'NotAllowedError') {
              console.warn('浏览器阻止了自动播放，需要用户交互');
            }
          });
      }
    }
  }, [playerTime, player.track]);

  const handleSeek = useCallback((time: number) => {
    if (playerTime.audioRef.current && time >= 0) {
      playerTime.audioRef.current.currentTime = time;
      playerTime.setCurrentTime(time);
    }
  }, [playerTime]);

  useQueryParams({
    onPlayNeteaseMusic: (item, index) => {
      playlist.addToPlaylist(item);
      loadMusicFromUrl(item, index);
    },
    onPlayLocalMusic: (item, index) => {
      loadMusicFromUrl(item, index);
    },
    onOpenPlayer: () => {
      setShowFullPlayer(true);
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
      handleSeek(timeInSeconds);
    },
    onSharedSongs: (songs: SharedSong[]) => {
      setSharedSongs(songs);
      setActiveTab('share');
    },
  });

  useEffect(() => {
    if (playlistReady) {
      setLocalSongsLoaded(true);
    }
  }, [playlistReady]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const connected = togetherListenRef.current?.isConnected() ?? false;
      setIsTogetherListenConnected(connected);
    }, 1000);
    return () => clearInterval(checkInterval);
  }, []);

  useEffect(() => {
    if ((window as any).hideAppLoader) {
      (window as any).hideAppLoader();
    }
  }, []);

  usePageTitle(player.track);

  useEffect(() => {
    const audio = playerTime.audioRef.current;
    if (!audio) return;

    const handleEnded = () => {      
      if (player.playbackMode === 'single') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        handleNext();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [player, playerTime, handleNext]);

  const handleArtistClick = useCallback(async (artistName: string) => {
    setShowFullPlayer(false);
    setActiveTab('netease');
    setTimeout(() => {
      if (neteasePanelRef.current) {
        neteasePanelRef.current.openSearch();
        neteasePanelRef.current.triggerSearch(artistName, false);
      }
    }, 300);
  }, []);

  const handleShareClick = useCallback(() => {
    if (!player.track) return;

    if (player.track.neteaseId) {
      sharePanel.updateConfig('enableNeteaseMusicId', true);
      sharePanel.updateConfig('neteaseMusicId', player.track.neteaseId.toString());
      sharePanel.updateConfig('enableTrackIndex', false);
      sharePanel.updateConfig('playlistOrigin', '');
    } else {
      sharePanel.updateConfig('enableTrackIndex', true);
      sharePanel.updateConfig('trackIndex', playlist.currentIndex.toString());
      sharePanel.updateConfig('enableNeteaseMusicId', false);
      sharePanel.updateConfig('playlistOrigin', settings.customSourceUrl || defaultSourceUrl);
    }

    sharePanel.updateConfig('seekTo', '');
    setShowFullPlayer(false);
    setActiveTab('share');
  }, [player.track, playlist.currentIndex, sharePanel, settings.customSourceUrl]);

  const cyclePlaybackMode = useCallback(() => {
    player.cyclePlaybackMode();
  }, [player.cyclePlaybackMode]);

  const currentTrackItem: PlaylistItem | null = player.track ? {
    name: player.track.metadata.title,
    artist: player.track.metadata.artist,
    neteaseId: player.track.neteaseId,
    coverUrl: player.track.metadata.coverUrl || undefined,
    url: player.track.objectUrl,
    artistIds: player.track.artistIds,
  } : null;

  const artistsCount = useMemo(() => Object.values(artistsByLetter).flat().length, [artistsByLetter]);

  const renderMainContent = useCallback(() => {
    switch (activeTab) {
      case 'artists':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ArtistsView
              selectedArtist={selectedArtist}
              setSelectedArtist={setSelectedArtist}
              playlist={playlist.playlist}
              currentIndex={playlist.currentIndex}
              isPlaying={playerTime.isPlaying}
              loadMusicFromUrl={loadMusicFromUrl}
              loadingTrackUrl={player.loadingTrackUrl}
              artistsByLetter={artistsByLetter}
              pinyinLoadError={pinyinLoadError}
            />
          </Suspense>
        );
      case 'netease':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <NeteasePanel
              ref={neteasePanelRef}
              onTrackSelect={loadNeteaseMusic}
              currentTrackUrl={player.track?.objectUrl || null}
              isPlaying={playerTime.isPlaying}
              onAddToPlaylist={() => {}}
              neteasePlaylist={playlist.neteasePlaylist}
              neteaseCurrentIndex={playlist.neteaseCurrentIndex}
              setNeteasePlaylist={playlist.setNeteasePlaylist}
              setNeteaseCurrentIndex={playlist.setNeteaseCurrentIndex}
            />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-white/[0.05]">
                <h2 className="text-2xl font-bold text-white drop-shadow-md">设置</h2>
                <p className="text-sm text-white/40 mt-1 drop-shadow-sm">自定义您的播放器</p>
              </div>
              <div className="flex-1 overflow-y-auto playlist-scrollbar p-4">
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
                />
              </div>
            </div>
          </Suspense>
        );
      case 'share':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-white/[0.05]">
                <h2 className="text-2xl font-bold text-white drop-shadow-md">分享</h2>
                <p className="text-sm text-white/40 mt-1 drop-shadow-sm">生成分享链接</p>
              </div>
              <div className="flex-1 overflow-y-auto playlist-scrollbar p-4">
                <SharePanel
                  isOpen={true}
                  onClose={() => {}}
                  config={sharePanel.config}
                  updateConfig={sharePanel.updateConfig}
                  shareUrl={sharePanel.shareUrl}
                  resetConfig={sharePanel.resetConfig}
                  onReadCurrentTime={() => sharePanel.readCurrentTime(playerTime.currentTime)}
                  onReadCurrentUrl={() => sharePanel.readCurrentUrl(settings.customSourceUrl || defaultSourceUrl)}
                  onReadCurrentTrack={handleShareClick}
                  onCopy={sharePanel.copyToClipboard}
                  onValidate={sharePanel.validateConfig}
                  currentTime={playerTime.currentTime}
                  isMobile={false}
                  sharedSongs={sharedSongs}
                  onReadLikedSongs={sharePanel.readLikedSongs}
                />
              </div>
            </div>
          </Suspense>
        );
      case 'songs':
      default:
        return (
          <SongsView
            currentFolder={playlist.currentFolder}
            playlistFolders={playlist.playlistFolders}
            playlist={playlist.playlist}
            currentIndex={playlist.currentIndex}
            isPlaying={playerTime.isPlaying}
            loadingFolders={playlist.loadingFolders}
            folderLoading={playlist.folderLoading}
            loadingTrackUrl={player.loadingTrackUrl}
            customSourceUrl={settings.customSourceUrl}
            onSetCurrentFolder={playlist.setCurrentFolder}
            onLoadLinkedFolder={playlist.loadLinkedFolder}
            onTrackSelect={loadMusicFromUrl}
            onSetCustomSourceUrl={settings.setCustomSourceUrl}
          />
        );
    }
  }, [activeTab, selectedArtist, playlist, player, playerTime.isPlaying, player.loadingTrackUrl, settings, artistsByLetter, pinyinLoadError, loadMusicFromUrl, loadNeteaseMusic, sharePanel]);

  return (
    <div className="h-screen w-full overflow-hidden" style={{ fontFamily: getFontFamily(settings.selectedFont) }}>
      <GlobalBackground coverUrl={player.track?.metadata.coverUrl} rotate={settings.backgroundRotate} />

      <audio
        ref={playerTime.audioRef}
        onLoadedMetadata={() => playerTime.setDuration(playerTime.audioRef.current?.duration || 0)}
        onTimeUpdate={() => playerTime.setCurrentTime(playerTime.audioRef.current?.currentTime || 0)}
      />

      <div
        className={`h-[calc(100vh-80px)] bg-transparent text-white flex overflow-hidden transition-opacity duration-300 ${
          showFullPlayer ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {player.loadingProgress !== null && <ShimmerLoadingBar progress={player.loadingProgress} />}

        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          playlistCount={playlist.playlist.length}
          artistsCount={artistsCount}
        />

        <div className="flex-1 relative overflow-hidden">
          <div className={`absolute inset-0 transition-all duration-300 ease-out ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          } ${activeTab === 'together' ? 'pointer-events-none' : 'pointer-events-auto'}`}>
            {activeTab !== 'together' && renderMainContent()}
          </div>

          <div
            className={`absolute inset-0 z-10 transition-all duration-300 ease-out ${
              activeTab === 'together' && !showFullPlayer && !isTransitioning
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-white/[0.05]">
                <h2 className="text-2xl font-bold text-white drop-shadow-md">一起听</h2>
                <p className="text-sm text-white/40 mt-1 drop-shadow-sm">邀请好友一起听歌</p>
              </div>
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<LoadingFallback />}>
                  <TogetherListenPanel
                    ref={togetherListenRef}
                    isPlaying={playerTime.isPlaying}
                    currentTime={playerTime.currentTime}
                    currentTrack={currentTrackItem}
                    onPlayPause={togglePlay}
                    onSeek={handleSeek}
                    onTrackChange={(neteaseId) => {
                      const index = playlist.neteasePlaylist.findIndex(p => p.neteaseId === neteaseId);
                      if (index !== -1) {
                        loadNeteaseMusic(playlist.neteasePlaylist[index], index);
                      } else {
                        playNeteaseById(neteaseId);
                      }
                    }}
                    formatTime={playerTime.formatTime}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <AlertCircle size={18} />
            {errorMessage}
          </div>
        )}
      </div>

      <MiniPlayerBar
        track={player.track}
        isPlaying={playerTime.isPlaying}
        currentTime={playerTime.currentTime}
        duration={playerTime.duration}
        playbackMode={player.playbackMode}
        audioRef={playerTime.audioRef}
        onTogglePlay={togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onCyclePlaybackMode={player.cyclePlaybackMode}
        onSeek={handleSeek}
        onOpenPlayer={() => setShowFullPlayer(!showFullPlayer)}
        isFullPlayerOpen={showFullPlayer}
        formatTime={playerTime.formatTime}
        isTogetherListenConnected={isTogetherListenConnected}
      />

      {player.track && (
        <div
          className={`fixed inset-0 z-[60] transition-all duration-500 ease-in-out ${
            showFullPlayer
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-[100%] pointer-events-none'
          }`}
        >
          <Suspense fallback={<LoadingFallback />}>
            <MusicPlayer
              track={player.track}
              isPlaying={playerTime.isPlaying}
              currentTime={playerTime.currentTime}
              duration={playerTime.duration}
              showTranslation={settings.showTranslation}
              setShowTranslation={settings.setShowTranslation}
              onBack={() => setShowFullPlayer(false)}
              loadingProgress={player.loadingProgress}
              fontWeight={settings.fontWeight}
              letterSpacing={settings.letterSpacing}
              lineHeight={settings.lineHeight}
              selectedFont={settings.selectedFont}
              onSeek={handleSeek}
              formatTime={playerTime.formatTime}
              onArtistClick={handleArtistClick}
              isTogetherListenConnected={isTogetherListenConnected}
              onShareClick={handleShareClick}
              isOpen={showFullPlayer}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <PlaylistProvider>
          <PlayerTimeProvider>
            <PlayerProvider>
              <AppContent />
            </PlayerProvider>
          </PlayerTimeProvider>
        </PlaylistProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
