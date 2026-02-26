import { PlaylistItem } from '../types';
import { parseSeekTime } from './seekTime';

/**
 * URL 查询参数接口
 * 定义所有支持的 URL 参数类型
 */
export interface QueryParams {
  /** 网易云音乐歌曲 ID */
  netease_music_id?: string;
  /** 是否打开播放器界面 */
  open_player?: boolean;
  /** 本地音乐 URL，用于匹配播放列表中的歌曲 */
  local_music?: string;
  /** 是否自动播放 */
  auto_play?: boolean;
  /** 播放列表来源 URL */
  playlist_origin?: string;
  /** 处理完成后是否保留 URL 参数（默认自动清除） */
  keep_params?: boolean;
  /** 处理完成后是否清除 URL 参数（已废弃，现在默认自动清除） */
  clear_params?: boolean;
  /** 歌曲空降时间点，支持秒数(60)或时间格式(1:30, 1:30:45) */
  seek_to?: number;
  /** 歌曲在播放列表中的索引位置（从0开始） */
  track_index?: number;
}

/**
 * URL 参数解析结果
 * 包含解析后的参数和验证状态
 */
export interface QueryParamsResult {
  /** 解析后的参数 */
  params: QueryParams;
  /** 是否存在有效参数 */
  hasParams: boolean;
  /** 解析错误信息 */
  errors: string[];
}

/**
 * 本地音乐匹配结果
 */
export interface LocalMusicMatchResult {
  /** 是否匹配成功 */
  matched: boolean;
  /** 匹配到的播放列表项 */
  item?: PlaylistItem;
  /** 匹配到的索引 */
  index?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 通过索引获取播放列表中的歌曲
 * @param index - 歌曲索引（从0开始）
 * @param playlist - 播放列表
 * @returns 匹配结果
 */
export function getMusicByIndex(index: number, playlist: PlaylistItem[]): LocalMusicMatchResult {
  if (!playlist || playlist.length === 0) {
    return {
      matched: false,
      error: '播放列表为空'
    };
  }

  if (index < 0 || index >= playlist.length) {
    return {
      matched: false,
      error: `索引 ${index} 超出范围，播放列表共有 ${playlist.length} 首歌曲`
    };
  }

  return {
    matched: true,
    item: playlist[index],
    index: index
  };
}

/**
 * 从当前 URL 解析查询参数
 * @returns 解析后的参数结果
 */
export function parseQueryParams(): QueryParamsResult {
  const params: QueryParams = {};
  const errors: string[] = [];
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('netease_music_id')) {
      const id = urlParams.get('netease_music_id');
      if (id) {
        params.netease_music_id = id;
      }
    }
    
    if (urlParams.has('open_player')) {
      const value = urlParams.get('open_player');
      params.open_player = value === 'true' || value === '1';
    }
    
    if (urlParams.has('local_music')) {
      const url = urlParams.get('local_music');
      if (url) {
        try {
          decodeURIComponent(url);
          params.local_music = url;
        } catch {
          errors.push('local_music 参数解码失败');
        }
      }
    }
    
    if (urlParams.has('auto_play')) {
      const value = urlParams.get('auto_play');
      params.auto_play = value === 'true' || value === '1';
    }
    
    if (urlParams.has('playlist_origin')) {
      const origin = urlParams.get('playlist_origin');
      if (origin) {
        try {
          new URL(origin);
          params.playlist_origin = origin;
        } catch {
          if (origin.startsWith('/') || origin.startsWith('./')) {
            params.playlist_origin = origin;
          } else {
            errors.push('playlist_origin 参数不是有效的 URL');
          }
        }
      }
    }
    
    if (urlParams.has('keep_params')) {
      const value = urlParams.get('keep_params');
      params.keep_params = value === 'true' || value === '1';
    }
    
    if (urlParams.has('clear_params')) {
      const value = urlParams.get('clear_params');
      params.clear_params = value === 'true' || value === '1';
    }
    
    if (urlParams.has('seek_to')) {
      const value = urlParams.get('seek_to');
      if (value) {
        const result = parseSeekTime(value);
        if (result.success && result.timeInSeconds !== undefined) {
          params.seek_to = result.timeInSeconds;
        } else {
          errors.push(`seek_to 参数无效: ${result.error || '未知错误'}`);
        }
      }
    }

    if (urlParams.has('track_index')) {
      const value = urlParams.get('track_index');
      if (value) {
        const index = parseInt(value, 10);
        if (!isNaN(index) && index >= 0) {
          params.track_index = index;
        } else {
          errors.push('track_index 参数必须是有效的非负整数');
        }
      }
    }
  } catch (error) {
    errors.push(`URL 解析错误: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  
  const hasParams = Object.keys(params).length > 0;
  
  return {
    params,
    hasParams,
    errors
  };
}

/**
 * 在播放列表中匹配本地音乐 URL
 * @param musicUrl - 要匹配的音乐 URL
 * @param playlist - 播放列表
 * @returns 匹配结果
 */
export function matchLocalMusic(musicUrl: string, playlist: PlaylistItem[]): LocalMusicMatchResult {
  try {
    const decodedUrl = decodeURIComponent(musicUrl);
    
    for (let i = 0; i < playlist.length; i++) {
      const item = playlist[i];
      
      if (item.url === musicUrl || item.url === decodedUrl) {
        return {
          matched: true,
          item,
          index: i
        };
      }
      
      try {
        const itemUrl = new URL(item.url);
        const targetUrl = new URL(decodedUrl);
        
        if (itemUrl.pathname === targetUrl.pathname && itemUrl.hostname === targetUrl.hostname) {
          return {
            matched: true,
            item,
            index: i
          };
        }
      } catch {
        if (item.url.endsWith(decodedUrl) || decodedUrl.endsWith(item.url)) {
          return {
            matched: true,
            item,
            index: i
          };
        }
      }
    }
    
    return {
      matched: false,
      error: '未在播放列表中找到匹配的歌曲'
    };
  } catch (error) {
    return {
      matched: false,
      error: `匹配过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`
    };
  }
}

/**
 * 清除 URL 中的查询参数
 * 不刷新页面，使用 History API 替换当前 URL
 */
export function clearQueryParams(): void {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, document.title, url.toString());
}

/**
 * 构建带查询参数的 URL
 * @param baseUrl - 基础 URL
 * @param params - 查询参数
 * @returns 完整的 URL 字符串
 * @deprecated clear_params 参数已废弃，URL参数现在会自动清除
 */
export function buildUrlWithParams(baseUrl: string, params: QueryParams): string {
  const url = new URL(baseUrl, window.location.origin);
  
  if (params.netease_music_id) {
    url.searchParams.set('netease_music_id', params.netease_music_id);
  }
  if (params.open_player !== undefined) {
    url.searchParams.set('open_player', params.open_player.toString());
  }
  if (params.local_music) {
    url.searchParams.set('local_music', params.local_music);
  }
  if (params.auto_play !== undefined) {
    url.searchParams.set('auto_play', params.auto_play.toString());
  }
  if (params.playlist_origin) {
    url.searchParams.set('playlist_origin', params.playlist_origin);
  }
  if (params.keep_params !== undefined) {
    url.searchParams.set('keep_params', params.keep_params.toString());
  }
  if (params.clear_params !== undefined) {
    url.searchParams.set('clear_params', params.clear_params.toString());
  }
  if (params.seek_to !== undefined) {
    url.searchParams.set('seek_to', params.seek_to.toString());
  }
  if (params.track_index !== undefined) {
    url.searchParams.set('track_index', params.track_index.toString());
  }
  
  return url.toString();
}

/**
 * 检查是否需要处理 URL 参数
 * 用于判断应用启动时是否需要执行特殊逻辑
 * @returns 是否存在需要处理的参数
 */
export function hasProcessableParams(): boolean {
  const result = parseQueryParams();
  return result.hasParams && result.errors.length === 0;
}
