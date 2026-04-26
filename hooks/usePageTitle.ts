import { useEffect } from 'react';
import { Track } from '../types';

/**
 * 页面标题管理 Hook
 * 根据当前播放的音乐自动更新浏览器标签页标题
 * 支持 PC 版和移动端
 * 支持网易云音乐和本地音乐
 * 
 * @param track - 当前播放的音轨信息
 * @param appName - 应用名称，默认为 'Serene Player'
 */
export const usePageTitle = (track: Track | null, appName: string = 'Serene Player') => {
  useEffect(() => {
    if (track) {
      // 格式：歌曲名称 | 应用名称
      const title = `${track.metadata.title} | ${appName}`;
      document.title = title;
    } else {
      // 没有播放音乐时，显示应用名称
      document.title = appName;
    }

    // 清理函数：组件卸载时恢复默认标题
    return () => {
      document.title = appName;
    };
  }, [track, appName]);
};
