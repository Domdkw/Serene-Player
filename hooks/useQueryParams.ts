import { useEffect, useRef, useCallback, useState } from 'react';
import { PlaylistItem } from '../types';
import { QueryParams } from '../utils/queryParams';
import { parseQueryParams, getMusicByIndex, clearQueryParams } from '../utils/queryParams';
import { getSongUrl, getSongDetail, getSongLyric, getAlbumCoverUrl } from '../apis/netease';

/**
 * URL 参数处理的回调函数接口
 */
export interface QueryParamsHandlers {
  /** 播放网易云音乐歌曲 */
  onPlayNeteaseMusic: (item: PlaylistItem, index: number) => void;
  /** 播放本地音乐 */
  onPlayLocalMusic: (item: PlaylistItem, index: number) => void;
  /** 打开播放器界面 */
  onOpenPlayer: () => void;
  /** 加载播放列表 */
  onLoadPlaylist: (url: string) => Promise<boolean>;
  /** 获取当前播放列表 */
  getPlaylist: () => PlaylistItem[];
  /** 设置自动播放标志 */
  setShouldAutoPlay: (value: boolean) => void;
  /** 跳转到指定播放位置（秒） */
  onSeekTo?: (timeInSeconds: number) => void;
  /** 根据索引播放歌曲 */
  onPlayByIndex?: (index: number) => void;
}

/**
 * useQueryParams Hook
 * 处理 URL 查询参数，支持以下功能：
 * - netease_music_id: 播放网易云音乐歌曲
 * - open_player: 打开播放器界面
 * - local_music: 匹配并播放本地音乐
 * - auto_play: 自动播放
 * - playlist_origin: 加载指定来源的播放列表
 * - seek_to: 歌曲空降时间点，支持秒数(60)或时间格式(1:30, 1:30:45)
 * - track_index: 歌曲在播放列表中的索引位置
 * - keep_params: 是否保留URL参数（默认自动清除）
 * 
 * 注意：URL参数在处理完成后会自动清除，除非设置了keep_params=true
 * 
 * @param handlers - 处理各种参数的回调函数
 */
export function useQueryParams(handlers: QueryParamsHandlers) {
  const hasProcessedRef = useRef(false);
  const pendingLocalMusicRef = useRef<string | null>(null);
  const shouldKeepParamsRef = useRef(false);
  const [hasPendingParams, setHasPendingParams] = useState(false);

  /**
   * 处理网易云音乐歌曲 ID
   * @param songId - 网易云音乐歌曲 ID
   */
  const handleNeteaseMusicId = useCallback(async (songId: string) => {
    console.log('[QueryParams] 开始处理网易云音乐 ID:', songId);
    try {
      const id = parseInt(songId, 10);
      if (isNaN(id)) {
        console.error('[QueryParams] 无效的网易云音乐 ID:', songId);
        return;
      }

      console.log('[QueryParams] 获取歌曲 URL...');
      const songUrl = await getSongUrl(id);
      if (!songUrl) {
        console.error('[QueryParams] 无法获取歌曲 URL');
        return;
      }
      console.log('[QueryParams] 歌曲 URL:', songUrl);

      console.log('[QueryParams] 获取歌曲详情...');
      const details = await getSongDetail(id);
      if (!details || details.length === 0) {
        console.error('[QueryParams] 无法获取歌曲详情');
        return;
      }

      const detail = details[0];
      const coverUrl = detail.album.picUrl ? getAlbumCoverUrl(detail.album.picUrl, 800, true) : null;

      let lyrics: string | undefined;
      try {
        const lyricData = await getSongLyric(id);
        if (lyricData && lyricData.lyric) {
          lyrics = lyricData.lyric;
        }
      } catch (e) {
        console.warn('[QueryParams] 获取歌词失败:', e);
      }

      const playlistItem: PlaylistItem = {
        name: detail.name,
        artist: detail.artists.map(a => a.name).join(', '),
        url: songUrl,
        themeColor: '#C20C0C',
        neteaseId: id,
        coverUrl: coverUrl || undefined,
        lyrics: lyrics,
        album: detail.album.name,
      };

      console.log('[QueryParams] 播放歌曲:', playlistItem.name);
      handlers.onPlayNeteaseMusic(playlistItem, 0);
    } catch (error) {
      console.error('[QueryParams] 处理网易云音乐 ID 失败:', error);
    }
  }, [handlers]);

  /**
   * 处理本地音乐索引
   * @param index - 歌曲索引
   */
  const handleLocalMusicByIndex = useCallback((index: number) => {
    console.log('[QueryParams] 尝试获取索引为', index, '的歌曲');
    const playlist = handlers.getPlaylist();
    
    if (!playlist || playlist.length === 0) {
      console.log('[QueryParams] 播放列表为空，等待加载...');
      return false;
    }

    const result = getMusicByIndex(index, playlist);

    if (result.matched && result.item && result.index !== undefined) {
      console.log('[QueryParams] 获取成功，播放:', result.item.name);
      handlers.onPlayLocalMusic(result.item, result.index);
      return true;
    } else {
      console.warn('[QueryParams] 获取失败:', result.error);
      return false;
    }
  }, [handlers]);

    /**
     * 处理所有待处理的参数
     * 默认会在处理完成后自动清除URL参数，避免重复处理
     */
  const processParams = useCallback(async (params: QueryParams) => {
    console.log('[QueryParams] 开始处理参数:', params);
    
    if (params.playlist_origin) {
      console.log('[QueryParams] 加载播放列表:', params.playlist_origin);
      const success = await handlers.onLoadPlaylist(params.playlist_origin);
      if (!success) {
        console.error('[QueryParams] 加载播放列表失败:', params.playlist_origin);
        return;
      }
      console.log('[QueryParams] 播放列表加载成功');
    }

    if (params.open_player) {
      console.log('[QueryParams] 打开播放器界面');
      handlers.onOpenPlayer();
    }

    if (params.auto_play) {
      console.log('[QueryParams] 设置自动播放');
      handlers.setShouldAutoPlay(true);
    }

    if (params.track_index !== undefined && handlers.onPlayByIndex) {
      console.log('[QueryParams] 根据索引播放歌曲:', params.track_index);
      handlers.onPlayByIndex(params.track_index);
    }

    if (params.seek_to !== undefined && handlers.onSeekTo) {
      console.log('[QueryParams] 设置空降时间点:', params.seek_to, '秒');
      handlers.onSeekTo(params.seek_to);
    }

    if (params.netease_music_id) {
      await handleNeteaseMusicId(params.netease_music_id);
    } else if (params.track_index !== undefined) {
      const success = handleLocalMusicByIndex(params.track_index);
      if (!success) {
        pendingLocalMusicRef.current = params.track_index.toString();
        shouldKeepParamsRef.current = params.keep_params || false;
        setHasPendingParams(true);
        return;
      }
    }

    // 处理完成后根据keep_params参数决定是否清除URL参数
    if (params.keep_params) {
      console.log('[QueryParams] keep_params为true，保留URL参数');
    } else {
      console.log('[QueryParams] 处理完成，清除URL参数');
      clearQueryParams();
    }
  }, [handlers, handleNeteaseMusicId, handleLocalMusicByIndex]);

  /**
   * 初始化时解析并存储参数
   */
  useEffect(() => {
    if (hasProcessedRef.current) return;

    const result = parseQueryParams();
    console.log('[QueryParams] 解析结果:', result);
    
    if (result.hasParams) {
      if (result.errors.length > 0) {
        console.warn('[QueryParams] URL 参数解析错误:', result.errors);
      }
      setHasPendingParams(true);
      processParams(result.params);
    }
    hasProcessedRef.current = true;
  }, [processParams]);

  /**
   * 当播放列表准备好后，处理待处理的本地音乐索引
   * 根据keep_params参数决定是否清除URL参数
   */
  const processPendingParams = useCallback(() => {
    if (pendingLocalMusicRef.current) {
      const index = parseInt(pendingLocalMusicRef.current, 10);
      const shouldKeep = shouldKeepParamsRef.current;
      pendingLocalMusicRef.current = null;
      shouldKeepParamsRef.current = false;
      setHasPendingParams(false);
      
      if (!isNaN(index)) {
        const success = handleLocalMusicByIndex(index);
        if (success) {
          if (shouldKeep) {
            console.log('[QueryParams] keep_params为true，保留URL参数');
          } else {
            console.log('[QueryParams] 处理待处理参数完成，清除URL参数');
            clearQueryParams();
          }
        }
      }
    }
  }, [handleLocalMusicByIndex]);

  return {
    /** 处理待处理的 URL 参数 */
    processPendingParams,
    /** 是否有待处理的参数 */
    hasPendingParams,
  };
}
