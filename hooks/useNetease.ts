import { useState, useCallback, useRef } from 'react';
import { PlaylistItem } from '../types';
import { getSongUrl, getSongDetail, getSongLyric, getAlbumCoverUrl } from '../apis/netease';
import { ErrorService } from '../utils/errorService';

interface UseNeteaseOptions {
  onLoadTrack: (item: PlaylistItem, index: number) => void;
  neteasePlaylist: PlaylistItem[];
  setNeteasePlaylist: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setNeteaseCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

interface UseNeteaseReturn {
  loadNeteaseMusic: (item: PlaylistItem, index: number) => void;
  playNeteaseById: (neteaseId: number) => Promise<void>;
  addToNeteasePlaylist: (item: PlaylistItem) => void;
  loadingProgress: number | null;
  setLoadingProgress: (progress: number | null) => void;
}

export const useNetease = (options: UseNeteaseOptions): UseNeteaseReturn => {
  const {
    onLoadTrack,
    neteasePlaylist,
    setNeteasePlaylist,
    setNeteaseCurrentIndex
  } = options;

  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const loadingRef = useRef(false);

  const loadNeteaseMusic = useCallback((item: PlaylistItem, index: number) => {
    setNeteaseCurrentIndex(index);
    onLoadTrack(item, index);
  }, [onLoadTrack, setNeteaseCurrentIndex]);

  const addToNeteasePlaylist = useCallback((item: PlaylistItem) => {
    setNeteasePlaylist(prev => {
      if (prev.some(p => p.url === item.url)) {
        return prev;
      }
      return [...prev, item];
    });
  }, [setNeteasePlaylist]);

  const playNeteaseById = useCallback(async (neteaseId: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    setLoadingProgress(0);

    try {
      const songDetails = await getSongDetail(neteaseId);
      if (!songDetails || songDetails.length === 0) {
        ErrorService.handleError(new Error('无法获取歌曲详情'), 'Netease Play');
        setLoadingProgress(null);
        loadingRef.current = false;
        return;
      }

      const songDetail = songDetails[0];
      setLoadingProgress(30);

      const songUrl = await getSongUrl(neteaseId);
      if (!songUrl) {
        ErrorService.handleError(new Error('无法获取歌曲播放链接'), 'Netease Play');
        setLoadingProgress(null);
        loadingRef.current = false;
        return;
      }

      setLoadingProgress(60);

      let lyrics: string | undefined;
      try {
        const lyricData = await getSongLyric(neteaseId);
        if (lyricData && lyricData.lyric) {
          lyrics = lyricData.lyric;
        }
      } catch (e) {
        ErrorService.handleError(e as Error, 'Get Lyrics');
      }

      setLoadingProgress(80);

      const coverUrl = songDetail.album.picUrl
        ? getAlbumCoverUrl(songDetail.album.picUrl, 800, true)
        : undefined;

      const playlistItem: PlaylistItem = {
        name: songDetail.name,
        artist: songDetail.artists.map(a => a.name).join(', '),
        url: songUrl,
        themeColor: '#C20C0C',
        neteaseId: neteaseId,
        artistIds: songDetail.artists.map(a => a.id),
        coverUrl: coverUrl,
        lyrics: lyrics,
        album: songDetail.album.name,
      };

      const existingIndex = neteasePlaylist.findIndex(p => p.neteaseId === neteaseId);
      let index: number;

      if (existingIndex === -1) {
        const newPlaylist = [...neteasePlaylist, playlistItem];
        setNeteasePlaylist(newPlaylist);
        index = newPlaylist.length - 1;
      } else {
        index = existingIndex;
      }

      setNeteaseCurrentIndex(index);
      setLoadingProgress(100);

      onLoadTrack(playlistItem, index);
    } catch (error: any) {
      ErrorService.handleError(error, 'Play Netease By ID');
      setLoadingProgress(null);
    } finally {
      loadingRef.current = false;
    }
  }, [neteasePlaylist, setNeteasePlaylist, setNeteaseCurrentIndex, onLoadTrack]);

  return {
    loadNeteaseMusic,
    playNeteaseById,
    addToNeteasePlaylist,
    loadingProgress,
    setLoadingProgress,
  };
};
