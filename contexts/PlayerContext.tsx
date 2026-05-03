import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { Track, PlaybackMode } from '../types';
import { extractMetadata, parseLyrics, parseLyricsWithTranslation } from '../utils/metadata';
import fetchInChunks from 'fetch-in-chunks';
import { ErrorService } from '../utils/errorService';
import { getLyricsType } from '../utils/lyricsUtils';

interface PlayerState {
  track: Track | null;
  playbackMode: PlaybackMode;
  loadingProgress: number | null;
  lyricsLoading: boolean;
  loadingTrackUrl: string | null;
}

interface PlayerContextType extends PlayerState {
  cyclePlaybackMode: () => void;
  loadTrackFromItem: (
    audioRef: React.RefObject<HTMLAudioElement | null>,
    item: {
      url: string;
      name: string;
      artist?: string;
      album?: string;
      coverUrl?: string;
      lyrics?: string;
      translatedLyrics?: string;
      neteaseId?: number;
      artistIds?: number[];
      file?: File;
    },
    index: number,
    options?: {
      streamingMode?: boolean;
      chunkCount?: number;
      isRemoteControl?: boolean;
    },
    callbacks?: {
      setIsPlaying: (isPlaying: boolean) => void;
      setCurrentTime: (time: number) => void;
      setDuration: (duration: number) => void;
    }
  ) => Promise<void>;
  abortLoad: () => void;
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
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
  const [track, setTrack] = useState<Track | null>(null);
  
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
  
  const abortControllerRef = useRef<AbortController | null>(null);

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
    audioRef: React.RefObject<HTMLAudioElement | null>,
    item: {
      url: string;
      name: string;
      artist?: string;
      album?: string;
      coverUrl?: string;
      lyrics?: string;
      translatedLyrics?: string;
      neteaseId?: number;
      artistIds?: number[];
      file?: File;
    },
    _index: number,
    options?: {
      streamingMode?: boolean;
      chunkCount?: number;
      isRemoteControl?: boolean;
    },
    callbacks?: {
      setIsPlaying: (isPlaying: boolean) => void;
      setCurrentTime: (time: number) => void;
      setDuration: (duration: number) => void;
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
    callbacks?.setIsPlaying(false);

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
        
        if (item.neteaseId) {
          const parsedResult = parseLyricsWithTranslation(item.lyrics, item.translatedLyrics || null);
          metadata.parsedLyrics = parsedResult.lines;
          if (parsedResult.lyricArtist) {
            metadata.lyricArtist = parsedResult.lyricArtist;
          }
          if (parsedResult.lyricAlbum) {
            metadata.lyricAlbum = parsedResult.lyricAlbum;
          }
        } else {
          const parsedResult = parseLyrics(item.lyrics);
          metadata.parsedLyrics = parsedResult.lines;
          if (parsedResult.lyricArtist) {
            metadata.lyricArtist = parsedResult.lyricArtist;
          }
          if (parsedResult.lyricAlbum) {
            metadata.lyricAlbum = parsedResult.lyricAlbum;
          }
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
          
          audioRef.current.oncanplay = async () => {
            try {
              callbacks?.setDuration(audioRef.current?.duration || 0);
              await audioRef.current!.play();
              callbacks?.setIsPlaying(true);
            } catch (e: any) {
              console.error('自动播放失败:', e);
              ErrorService.handleError(e, 'Autoplay');
              if (e.name === 'NotAllowedError') {
                console.warn('浏览器阻止了自动播放，等待用户交互');
                callbacks?.setIsPlaying(false);
              }
            }
          };
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
      callbacks?.setIsPlaying(false);
    }
  }, [track?.objectUrl]);

  const value = useMemo(() => ({
    track,
    playbackMode,
    loadingProgress,
    lyricsLoading,
    loadingTrackUrl,
    cyclePlaybackMode,
    loadTrackFromItem,
    abortLoad,
  }), [
    track,
    playbackMode,
    loadingProgress,
    lyricsLoading,
    loadingTrackUrl,
    cyclePlaybackMode,
    loadTrackFromItem,
    abortLoad,
  ]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};
