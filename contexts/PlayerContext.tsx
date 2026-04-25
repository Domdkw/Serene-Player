import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Track, PlaybackMode } from '../types';
import { extractMetadata, parseLyrics } from '../utils/metadata';
import fetchInChunks from 'fetch-in-chunks';
import { ErrorService } from '../utils/errorService';

interface PlayerState {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackMode: PlaybackMode;
  loadingProgress: number | null;
  lyricsLoading: boolean;
  loadingTrackUrl: string | null;
}

interface PlayerContextType extends PlayerState {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  togglePlay: () => void;
  handleSeek: (time: number) => void;
  cyclePlaybackMode: () => void;
  loadTrackFromItem: (item: {
    url: string;
    name: string;
    artist?: string;
    album?: string;
    coverUrl?: string;
    lyrics?: string;
    neteaseId?: number;
    artistIds?: number[];
    file?: File;
  }, index: number, options?: {
    streamingMode?: boolean;
    chunkCount?: number;
  }) => Promise<void>;
  abortLoad: () => void;
  formatTime: (time: number) => string;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

interface PlayerProviderProps {
  children: React.ReactNode;
  onTrackEnd?: () => void;
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children, onTrackEnd }) => {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const getSavedPlaybackMode = (): PlaybackMode => {
    const saved = localStorage.getItem('playbackMode');
    if (saved === 'single' || saved === 'list' || saved === 'shuffle') {
      return saved;
    }
    return 'list';
  };
  
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(getSavedPlaybackMode);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [loadingTrackUrl, setLoadingTrackUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const lyricsType = useMemo(() => {
    const parsedLyrics = track?.metadata?.parsedLyrics;
    if (!parsedLyrics || parsedLyrics.length === 0) return 'none';
    return 'line';
  }, [track?.metadata?.parsedLyrics]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !track) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => {
        ErrorService.handleError(e, 'Playback');
      });
    }
  }, [isPlaying, track]);

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current && time >= 0) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const cyclePlaybackMode = useCallback(() => {
    setPlaybackMode(prev => {
      let next: PlaybackMode;
      if (prev === 'single') next = 'list';
      else if (prev === 'list') next = 'shuffle';
      else next = 'single';
      localStorage.setItem('playbackMode', next);
      return next;
    });
  }, []);

  const abortLoad = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const loadTrackFromItem = useCallback(async (
    item: {
      url: string;
      name: string;
      artist?: string;
      album?: string;
      coverUrl?: string;
      lyrics?: string;
      neteaseId?: number;
      artistIds?: number[];
      file?: File;
    },
    _index: number,
    options?: {
      streamingMode?: boolean;
      chunkCount?: number;
    }
  ) => {
    setLyricsLoading(true);
    setLoadingTrackUrl(item.url);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoadingProgress(0);
    setIsPlaying(false);

    if (!item.url) {
      ErrorService.handleError(new Error('Invalid track URL'), 'Load Track');
      setLoadingTrackUrl(null);
      setLyricsLoading(false);
      return;
    }

    const shouldUseStreaming = options?.streamingMode || !!item.neteaseId;

    try {
      let file: File | undefined;
      let objectUrl: string;

      if (shouldUseStreaming) {
        objectUrl = item.url;
        setLoadingProgress(100);
        file = undefined;
      } else if (item.file) {
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
          maxParallelRequests: options?.chunkCount || 4,
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

      const metadata = file ? await extractMetadata(file) : {
        title: item.name,
        artist: item.artist || '',
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
        artistIds: item.artistIds,
        sourceType: shouldUseStreaming ? 'streaming' : 'local'
      });
      setLoadingProgress(null);
      setLoadingTrackUrl(null);
      setLyricsLoading(false);

      setTimeout(async () => {
        if (audioRef.current) {
          audioRef.current.src = objectUrl;
          audioRef.current.load();
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (e) {
            ErrorService.handleError(e, 'Autoplay');
          }
        }
      }, 100);

      if (oldUrl && !oldUrl.startsWith('blob:') && !shouldUseStreaming) {
        setTimeout(() => {
          URL.revokeObjectURL(oldUrl);
        }, 1000);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      ErrorService.handleError(error, 'Load Track');
      setLoadingProgress(null);
      setLoadingTrackUrl(null);
      setLyricsLoading(false);
      setIsPlaying(false);
    }
  }, [track?.objectUrl]);

  const formatTime = useCallback((time: number) => {
    if (time < 0) return "--:--";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);



  const value = useMemo(() => ({
    track,
    isPlaying,
    currentTime,
    duration,
    playbackMode,
    loadingProgress,
    lyricsLoading,
    loadingTrackUrl,
    audioRef,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    togglePlay,
    handleSeek,
    cyclePlaybackMode,
    loadTrackFromItem,
    abortLoad,
    formatTime,
  }), [
    track,
    isPlaying,
    currentTime,
    duration,
    playbackMode,
    loadingProgress,
    lyricsLoading,
    loadingTrackUrl,
    togglePlay,
    handleSeek,
    cyclePlaybackMode,
    loadTrackFromItem,
    abortLoad,
    formatTime,
  ]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};
