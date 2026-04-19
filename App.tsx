import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { Track, PlaylistItem, PlaybackMode } from './types';
import { PlayerProvider, usePlayer } from './contexts/PlayerContext';
import { PlaylistProvider, usePlaylist } from './contexts/PlaylistContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { useQueryParams } from './hooks/useQueryParams';
import { useArtists } from './hooks/useArtists';
import { useFileUpload } from './hooks/useFileUpload';
import { useNetease } from './hooks/useNetease';
import { getFontFamily } from './utils/fontUtils';
import { ErrorService } from './utils/errorService';
import ErrorBoundary from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { SongsView } from './components/SongsView';
import { ShimmerLoadingBar } from './components/LoadingComponents';
import GlobalBackground from './components/GlobalBackground';
import MiniPlayerBar from './components/MiniPlayerBar';
import { getSongDetail, getSongUrl, getSongLyric, getAlbumCoverUrl } from './apis/netease';

type NavTab = 'songs' | 'artists' | 'netease' | 'together' | 'settings';

const ArtistsView = lazy(() => import('./components/ArtistsView').then(m => ({ default: m.ArtistsView })));
const NeteasePanel = lazy(() => import('./components/NeteasePanel').then(m => ({ default: m.NeteasePanel })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const MusicPlayer = lazy(() => import('./components/MusicPlayer'));
const TogetherListenPanel = lazy(() => import('./components/TogetherListenPanel'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

const defaultSourceUrl = './discList.json';

const AppContent: React.FC = () => {
  const player = usePlayer();
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

  const neteasePanelRef = useRef<any>(null);
  const togetherListenRef = useRef<any>(null);

  const {
    artistsByLetter,
    pinyinLoadError
  } = useArtists({
    playlist: playlist.playlist,
    activeTab
  });

  const loadMusicFromUrl = useCallback(async (item: PlaylistItem, index: number) => {
    setErrorMessage(null);
    playlist.setCurrentIndex(index);
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
        file: item.file
      },
      index,
      {
        streamingMode: settings.streamingMode,
        chunkCount: settings.chunkCount
      }
    );
  }, [player, playlist, settings.streamingMode, settings.chunkCount]);

  const {
    loadNeteaseMusic,
    playNeteaseById,
    addToNeteasePlaylist
  } = useNetease({
    onLoadTrack: loadMusicFromUrl,
    neteasePlaylist: playlist.neteasePlaylist,
    setNeteasePlaylist: playlist.setNeteasePlaylist,
    setNeteaseCurrentIndex: playlist.setNeteaseCurrentIndex
  });

  const addToPlaylistFolders = useCallback((name: string, items: PlaylistItem[]) => {
    playlist.setPlaylistFolders(prev => ({
      ...prev,
      [name]: items
    }));
  }, [playlist]);

  const {
    fileInputRef,
    folderInputRef,
    handleFileUpload,
    handleFolderUpload,
    triggerFileUpload,
    triggerFolderUpload
  } = useFileUpload({
    onTrackLoad: loadMusicFromUrl,
    addToPlaylist: playlist.addMultipleToPlaylist,
    addToPlaylistFolders,
    currentIndex: playlist.currentIndex
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
    if (player.playbackMode === 'shuffle') {
      if (playlist.neteasePlaylist.length > 0 && activeTab === 'netease') {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * playlist.neteasePlaylist.length);
        } while (playlist.neteasePlaylist.length > 1 && randomIndex === playlist.neteaseCurrentIndex);
        loadNeteaseMusic(playlist.neteasePlaylist[randomIndex], randomIndex);
      } else if (playlist.playlist.length === 0) return;
      else {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * playlist.playlist.length);
        } while (playlist.playlist.length > 1 && randomIndex === playlist.currentIndex);
        loadMusicFromUrl(playlist.playlist[randomIndex], randomIndex);
      }
    } else if (playlist.neteasePlaylist.length > 0 && activeTab === 'netease') {
      if (playlist.neteaseCurrentIndex === -1) return;
      const nextIndex = (playlist.neteaseCurrentIndex + 1) % playlist.neteasePlaylist.length;
      loadNeteaseMusic(playlist.neteasePlaylist[nextIndex], nextIndex);
    } else if (playlist.currentFolder && playlist.playlistFolders[playlist.currentFolder]) {
      const folderTracks = playlist.playlistFolders[playlist.currentFolder];
      const currentTrack = playlist.playlist[playlist.currentIndex];
      if (Array.isArray(folderTracks)) {
        const currentFolderIndex = folderTracks.findIndex((t: PlaylistItem) => t.url === currentTrack?.url);

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
  }, [player.playbackMode, playlist, activeTab, loadNeteaseMusic, loadMusicFromUrl]);

  const handlePrev = useCallback(() => {
    if (player.playbackMode === 'shuffle') {
      handleNext();
    } else if (playlist.neteasePlaylist.length > 0 && activeTab === 'netease') {
      if (playlist.neteaseCurrentIndex === -1) return;
      const prevIndex = (playlist.neteaseCurrentIndex - 1 + playlist.neteasePlaylist.length) % playlist.neteasePlaylist.length;
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
  }, [player.playbackMode, playlist, activeTab, handleNext, loadNeteaseMusic, loadMusicFromUrl]);

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
      player.handleSeek(timeInSeconds);
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

  const handleSeek = useCallback((time: number) => {
    if (player.audioRef.current && time >= 0) {
      player.audioRef.current.currentTime = time;
      player.setCurrentTime(time);
    }
  }, [player]);

  const cyclePlaybackMode = useCallback(() => {
    const modes: PlaybackMode[] = ['single', 'list', 'shuffle'];
    const currentIndex = modes.indexOf(player.playbackMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    localStorage.setItem('playbackMode', modes[nextIndex]);
  }, [player.playbackMode]);

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
              isPlaying={player.isPlaying}
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
              isPlaying={player.isPlaying}
              onAddToPlaylist={addToNeteasePlaylist}
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
      case 'songs':
      default:
        return (
          <SongsView
            currentFolder={playlist.currentFolder}
            playlistFolders={playlist.playlistFolders}
            playlist={playlist.playlist}
            currentIndex={playlist.currentIndex}
            isPlaying={player.isPlaying}
            playbackMode={player.playbackMode}
            loadingFolders={playlist.loadingFolders}
            folderLoading={playlist.folderLoading}
            loadingTrackUrl={player.loadingTrackUrl}
            customSourceUrl={settings.customSourceUrl}
            onSetCurrentFolder={playlist.setCurrentFolder}
            onLoadLinkedFolder={playlist.loadLinkedFolder}
            onTrackSelect={loadMusicFromUrl}
            onCyclePlaybackMode={cyclePlaybackMode}
            onFileUpload={triggerFileUpload}
            onFolderUpload={triggerFolderUpload}
            onSetCustomSourceUrl={settings.setCustomSourceUrl}
          />
        );
    }
  }, [activeTab, selectedArtist, playlist, player, settings, artistsByLetter, pinyinLoadError, loadMusicFromUrl, loadNeteaseMusic, addToNeteasePlaylist, cyclePlaybackMode, triggerFileUpload, triggerFolderUpload]);

  return (
    <div className="h-screen w-full overflow-hidden" style={{ fontFamily: getFontFamily(settings.selectedFont) }}>
      <GlobalBackground coverUrl={player.track?.metadata.coverUrl} rotate={settings.backgroundRotate} />

      <audio
        ref={player.audioRef}
        onLoadedMetadata={() => player.setDuration(player.audioRef.current?.duration || 0)}
        onTimeUpdate={() => player.setCurrentTime(player.audioRef.current?.currentTime || 0)}
      />

      <div
        className={`h-[calc(100vh-80px)] bg-transparent text-white flex overflow-hidden transition-opacity duration-300 ${
          showFullPlayer ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
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
                    isPlaying={player.isPlaying}
                    currentTime={player.currentTime}
                    currentTrack={currentTrackItem}
                    onPlayPause={player.togglePlay}
                    onSeek={handleSeek}
                    onTrackChange={(neteaseId) => {
                      const index = playlist.neteasePlaylist.findIndex(p => p.neteaseId === neteaseId);
                      if (index !== -1) {
                        loadNeteaseMusic(playlist.neteasePlaylist[index], index);
                      } else {
                        playNeteaseById(neteaseId);
                      }
                    }}
                    formatTime={player.formatTime}
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
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        playbackMode={player.playbackMode}
        audioRef={player.audioRef}
        onTogglePlay={player.togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onCyclePlaybackMode={cyclePlaybackMode}
        onSeek={handleSeek}
        onOpenPlayer={() => setShowFullPlayer(!showFullPlayer)}
        isFullPlayerOpen={showFullPlayer}
        formatTime={player.formatTime}
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
              isPlaying={player.isPlaying}
              currentTime={player.currentTime}
              duration={player.duration}
              showTranslation={settings.showTranslation}
              setShowTranslation={settings.setShowTranslation}
              onBack={() => setShowFullPlayer(false)}
              loadingProgress={player.loadingProgress}
              fontWeight={settings.fontWeight}
              letterSpacing={settings.letterSpacing}
              lineHeight={settings.lineHeight}
              selectedFont={settings.selectedFont}
              onSeek={handleSeek}
              formatTime={player.formatTime}
              onArtistClick={handleArtistClick}
              isTogetherListenConnected={isTogetherListenConnected}
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
          <PlayerProvider>
            <AppContent />
          </PlayerProvider>
        </PlaylistProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
