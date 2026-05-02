import { useState, useCallback, useMemo } from 'react';
import { QueryParams, buildUrlWithParams } from '../utils/queryParams';

/**
 * 分享参数配置接口
 * 定义用户可配置的分享参数
 */
export interface ShareConfig {
  /** 是否启用网易云音乐歌曲ID */
  enableNeteaseMusicId: boolean;
  /** 网易云音乐歌曲ID */
  neteaseMusicId: string;
  /** 是否启用track_index */
  enableTrackIndex: boolean;
  /** 歌曲索引 */
  trackIndex: string;
  /** 是否打开播放器 */
  openPlayer: boolean;
  /** 是否自动播放 */
  autoPlay: boolean;
  /** 播放列表来源URL */
  playlistOrigin: string;
  /** 空降时间点（秒数或时间格式） */
  seekTo: string;
  /** 是否保留URL参数 */
  keepParams: boolean;
}

/**
 * 分享面板Hook的返回值接口
 */
export interface UseSharePanelReturn {
  /** 分享配置状态 */
  config: ShareConfig;
  /** 更新单个配置项 */
  updateConfig: <K extends keyof ShareConfig>(key: K, value: ShareConfig[K]) => void;
  /** 生成的分享URL */
  shareUrl: string;
  /** 是否显示面板 */
  isOpen: boolean;
  /** 打开面板 */
  openPanel: () => void;
  /** 关闭面板 */
  closePanel: () => void;
  /** 切换面板显示状态 */
  togglePanel: () => void;
  /** 重置配置为默认值 */
  resetConfig: () => void;
  /** 从当前播放状态读取时间 */
  readCurrentTime: (currentTime: number) => void;
  /** 读取播放列表来源地址 */
  readCurrentUrl: (originUrl?: string) => void;
  /** 复制分享URL到剪贴板 */
  copyToClipboard: () => Promise<boolean>;
  /** 验证配置是否有效 */
  validateConfig: () => { isValid: boolean; errors: string[] };
}

/**
 * 默认分享配置
 */
const DEFAULT_CONFIG: ShareConfig = {
  enableNeteaseMusicId: false,
  neteaseMusicId: '',
  enableTrackIndex: false,
  trackIndex: '',
  openPlayer: false,
  autoPlay: false,
  playlistOrigin: '',
  seekTo: '',
  keepParams: false,
};

/**
 * useSharePanel Hook
 * 用于管理分享面板的状态和逻辑
 * 
 * 功能：
 * - 管理分享参数配置
 * - 生成分享URL
 * - 处理netease_music_id和track_index的二选一逻辑
 * - 提供读取当前时间和地址的功能
 * 
 * @returns 分享面板Hook的返回值
 */
export function useSharePanel(): UseSharePanelReturn {
  const [config, setConfig] = useState<ShareConfig>(DEFAULT_CONFIG);
  const [isOpen, setIsOpen] = useState(false);

  /**
   * 更新单个配置项
   * 处理netease_music_id和track_index的二选一逻辑
   */
  const updateConfig = useCallback(<K extends keyof ShareConfig>(key: K, value: ShareConfig[K]) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };

      if (key === 'enableNeteaseMusicId' && value === true) {
        newConfig.enableTrackIndex = false;
      } else if (key === 'enableTrackIndex' && value === true) {
        newConfig.enableNeteaseMusicId = false;
      }

      return newConfig;
    });
  }, []);

  /**
   * 生成分享URL
   */
  const shareUrl = useMemo(() => {
    const params: QueryParams = {};

    if (config.enableNeteaseMusicId && config.neteaseMusicId.trim()) {
      params.netease_music_id = config.neteaseMusicId.trim();
    }

    if (config.enableTrackIndex && config.trackIndex.trim()) {
      const index = parseInt(config.trackIndex.trim(), 10);
      if (!isNaN(index) && index >= 0) {
        params.track_index = index;
      }
    }

    if (config.openPlayer) {
      params.open_player = true;
    }

    if (config.autoPlay) {
      params.auto_play = true;
    }

    if (config.playlistOrigin.trim()) {
      params.playlist_origin = config.playlistOrigin.trim();
    }

    if (config.seekTo.trim()) {
      const seekValue = config.seekTo.trim();
      const timeInSeconds = parseTimeToSeconds(seekValue);
      if (timeInSeconds !== null) {
        params.seek_to = timeInSeconds;
      }
    }

    if (config.keepParams) {
      params.keep_params = true;
    }

    const baseUrl = window.location.origin + window.location.pathname;
    return buildUrlWithParams(baseUrl, params);
  }, [config]);

  /**
   * 打开面板
   */
  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  /**
   * 关闭面板
   */
  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * 切换面板显示状态
   */
  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  /**
   * 重置配置为默认值
   */
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  /**
   * 从当前播放状态读取时间
   */
  const readCurrentTime = useCallback((currentTime: number) => {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    updateConfig('seekTo', timeString);
  }, [updateConfig]);

  /**
   * 读取播放列表来源地址
   * @param originUrl - 可选的播放列表来源URL，如果不传则使用默认值
   */
  const readCurrentUrl = useCallback((originUrl?: string) => {
    const url = originUrl || './discList.json';
    updateConfig('playlistOrigin', url);
  }, [updateConfig]);

  /**
   * 复制分享URL到剪贴板
   */
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch (error) {
      console.error('复制失败:', error);
      return false;
    }
  }, [shareUrl]);

  /**
   * 验证配置是否有效
   */
  const validateConfig = useCallback(() => {
    const errors: string[] = [];

    if (config.enableNeteaseMusicId && !config.neteaseMusicId.trim()) {
      errors.push('请输入网易云音乐歌曲ID');
    }

    if (config.enableTrackIndex) {
      if (!config.trackIndex.trim()) {
        errors.push('请输入歌曲索引');
      } else {
        const index = parseInt(config.trackIndex.trim(), 10);
        if (isNaN(index) || index < 0) {
          errors.push('歌曲索引必须是非负整数');
        }
      }
    }

    if (config.playlistOrigin.trim()) {
      try {
        new URL(config.playlistOrigin.trim());
      } catch {
        if (!config.playlistOrigin.trim().startsWith('/')) {
          errors.push('播放列表来源必须是有效的URL或相对路径');
        }
      }
    }

    if (config.seekTo.trim()) {
      const timeInSeconds = parseTimeToSeconds(config.seekTo.trim());
      if (timeInSeconds === null) {
        errors.push('空降时间格式无效，支持秒数(120)或时间格式(1:30, 1:30:45)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [config]);

  return {
    config,
    updateConfig,
    shareUrl,
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
    resetConfig,
    readCurrentTime,
    readCurrentUrl,
    copyToClipboard,
    validateConfig,
  };
}

/**
 * 将时间字符串解析为秒数
 * 支持格式：秒数(120)、时间格式(1:30, 1:30:45)
 */
function parseTimeToSeconds(timeString: string): number | null {
  if (!timeString.trim()) return null;

  const trimmed = timeString.trim();

  if (/^\d+$/.test(trimmed)) {
    const seconds = parseInt(trimmed, 10);
    return isNaN(seconds) ? null : seconds;
  }

  const parts = trimmed.split(':').map(p => parseInt(p, 10));
  
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (seconds < 0 || seconds >= 60) return null;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}
