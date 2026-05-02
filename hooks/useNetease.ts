import { useState, useCallback, useRef } from 'react';
import { PlaylistItem } from '../types';
import { getSongUrl, getSongDetail, getSongLyric, getAlbumCoverUrl } from '../apis/netease';
import { ErrorService } from '../utils/errorService';

interface UseNeteaseOptions {
  onLoadTrack: (item: PlaylistItem, index: number) => void;
  neteasePlaylist: PlaylistItem[];
  setNeteaseCurrentIndex: (index: number) => void;
  updateNeteaseLikedIndexById: (neteaseId: number) => void;
}

interface UseNeteaseReturn {
  loadNeteaseMusic: (item: PlaylistItem, index: number) => Promise<void>;
  playNeteaseById: (neteaseId: number) => Promise<void>;
  loadingProgress: number | null;
  setLoadingProgress: (progress: number | null) => void;
}

/**
 * 网易云音乐播放Hook
 * 仅读取播放列表，不写入localStorage
 */
export const useNetease = (options: UseNeteaseOptions): UseNeteaseReturn => {
  const {
    onLoadTrack,
    neteasePlaylist,
    setNeteaseCurrentIndex,
    updateNeteaseLikedIndexById
  } = options;

  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const loadingRef = useRef(false);

  /**
   * 只获取歌词信息（用于已有歌曲信息的情况）
   * @param neteaseId 歌曲ID
   * @returns 歌词和翻译歌词
   */
  const fetchLyricsOnly = useCallback(async (neteaseId: number): Promise<{ lyrics?: string; translatedLyrics?: string }> => {
    try {
      const lyricData = await getSongLyric(neteaseId);
      if (lyricData) {
        return {
          lyrics: lyricData.lyric || undefined,
          translatedLyrics: lyricData.tlyric || undefined
        };
      }
    } catch (e) {
      // 歌词获取失败不影响播放
    }
    return {};
  }, []);

  /**
   * 通过歌曲ID获取完整的歌曲信息
   * 包括：播放链接、封面、歌词等
   */
  const fetchSongDetailsById = useCallback(async (neteaseId: number): Promise<PlaylistItem | null> => {
    try {
      // 1. 获取歌曲详情
      const songDetails = await getSongDetail(neteaseId);
      if (!songDetails || songDetails.length === 0) {
        ErrorService.handleError(new Error('无法获取歌曲详情'), 'Netease API');
        return null;
      }
      const songDetail = songDetails[0];

      // 2. 获取播放链接
      const songUrl = await getSongUrl(neteaseId);
      if (!songUrl) {
        ErrorService.handleError(new Error('无法获取歌曲播放链接'), 'Netease API');
        return null;
      }

      // 3. 获取歌词（可选，失败不影响播放）
      const lyricData = await fetchLyricsOnly(neteaseId);

      // 4. 获取封面
      const coverUrl = songDetail.album.picUrl
        ? getAlbumCoverUrl(songDetail.album.picUrl, 800, true)
        : undefined;

      return {
        name: songDetail.name,
        artist: songDetail.artists.map(a => a.name).join(', '),
        url: songUrl,
        themeColor: '#C20C0C',
        neteaseId: neteaseId,
        artistIds: songDetail.artists.map(a => a.id).filter(id => id > 0),
        coverUrl: coverUrl,
        lyrics: lyricData.lyrics,
        translatedLyrics: lyricData.translatedLyrics,
        album: songDetail.album.name,
      };
    } catch (error) {
      ErrorService.handleError(error as Error, 'Fetch Song Details');
      return null;
    }
  }, [fetchLyricsOnly]);

  /**
   * 加载并播放网易云音乐
   * 如果 item 信息不完整（没有 URL），通过 ID 获取完整信息
   */
  const loadNeteaseMusic = useCallback(async (item: PlaylistItem, index: number) => {
    // 防止重复加载
    if (loadingRef.current) return;
    loadingRef.current = true;

    setNeteaseCurrentIndex(index);
    
    // 根据歌曲 ID 更新"我喜欢"列表的当前播放索引
    if (item.neteaseId) {
      updateNeteaseLikedIndexById(item.neteaseId);
    }
    
    setLoadingProgress(0);

    try {
      let trackToPlay: PlaylistItem;

      // 如果歌曲已经有完整的 URL 和歌词信息（translatedLyrics 不为 undefined 表示已获取过歌词）
      if (item.url && item.translatedLyrics !== undefined) {
        trackToPlay = item;
        setLoadingProgress(100);
      } else if (item.neteaseId) {
        // 如果已有 URL 和封面，只获取歌词
        if (item.url && item.coverUrl) {
          const lyricData = await fetchLyricsOnly(item.neteaseId);
          trackToPlay = {
            ...item,
            lyrics: lyricData.lyrics,
            translatedLyrics: lyricData.translatedLyrics
          };
        } else {
          // 通过 ID 获取完整信息
          const fullDetails = await fetchSongDetailsById(item.neteaseId);
          if (fullDetails) {
            trackToPlay = {
              ...fullDetails,
              url: item.url || fullDetails.url
            };
          } else {
            setLoadingProgress(null);
            loadingRef.current = false;
            return;
          }
        }
        setLoadingProgress(100);
      } else {
        ErrorService.handleError(new Error('歌曲信息不完整，无法播放'), 'Load Netease Music');
        setLoadingProgress(null);
        loadingRef.current = false;
        return;
      }

      // 播放歌曲
      onLoadTrack(trackToPlay, index);
      setLoadingProgress(null);
    } catch (error) {
      ErrorService.handleError(error as Error, 'Load Netease Music');
      setLoadingProgress(null);
    } finally {
      loadingRef.current = false;
    }
  }, [fetchLyricsOnly, fetchSongDetailsById, onLoadTrack, setNeteaseCurrentIndex, updateNeteaseLikedIndexById]);

  /**
   * 通过网易云ID播放歌曲
   * 先从播放列表中查找，找不到则通过API获取
   */
  const playNeteaseById = useCallback(async (neteaseId: number) => {
    // 防止重复加载
    if (loadingRef.current) return;
    loadingRef.current = true;

    setLoadingProgress(0);

    try {
      // 先从播放列表中查找
      const existingIndex = neteasePlaylist.findIndex(p => p.neteaseId === neteaseId);
      
      if (existingIndex !== -1) {
        // 在列表中找到，使用现有信息播放
        const existingItem = neteasePlaylist[existingIndex];
        await loadNeteaseMusic(existingItem, existingIndex);
        loadingRef.current = false;
        return;
      }

      // 不在列表中，通过API获取
      const fullDetails = await fetchSongDetailsById(neteaseId);
      if (fullDetails) {
        setNeteaseCurrentIndex(-1); // 不在列表中，索引设为-1
        setLoadingProgress(100);
        onLoadTrack(fullDetails, -1);
        setLoadingProgress(null);
      }
    } catch (error) {
      ErrorService.handleError(error as Error, 'Play Netease By ID');
      setLoadingProgress(null);
    } finally {
      loadingRef.current = false;
    }
  }, [neteasePlaylist, fetchSongDetailsById, loadNeteaseMusic, setNeteaseCurrentIndex, onLoadTrack]);

  return {
    loadNeteaseMusic,
    playNeteaseById,
    loadingProgress,
    setLoadingProgress,
  };
};
