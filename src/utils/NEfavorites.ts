/**
 * 喜欢的歌曲相关工具函数和接口
 * 用于管理网易云音乐的"我喜欢"歌单
 */

import { getAlbumCoverUrl } from '../apis/netease';

/**
 * 喜欢的歌曲接口
 */
export interface FavoriteSong {
  id: number;
  name: string;
  artist: string;
  artistIds: number[];
  album: string;
  coverUrl: string;
  duration: number;
  addedAt: number;
}

/**
 * 用于创建 FavoriteSong 的歌曲数据接口
 * 兼容 NeteaseSong 和 NeteaseSongDetail
 */
export interface SongDataForFavorite {
  id: number;
  name: string;
  artists: { name: string; id: number }[];
  album: { name: string; picUrl: string };
  duration: number;
}

/**
 * 创建 FavoriteSong 对象
 * @param song 歌曲数据（兼容 NeteaseSong 和 NeteaseSongDetail）
 * @returns FavoriteSong 对象
 */
export const createFavoriteSong = (song: SongDataForFavorite): FavoriteSong => {
  return {
    id: song.id,
    name: song.name,
    artist: song.artists.map(a => a.name).join(', '),
    artistIds: song.artists.map(a => a.id).filter(id => id > 0),
    album: song.album.name,
    coverUrl: song.album.picUrl ? getAlbumCoverUrl(song.album.picUrl, 50) : '',
    duration: song.duration,
    addedAt: Date.now(),
  };
};

/**
 * LocalStorage 存储键名
 */
export const FAVORITES_STORAGE_KEY = 'netease_favorites';

/**
 * 加载喜欢的歌曲列表
 * @returns 喜欢的歌曲数组
 */
export const loadFavorites = (): FavoriteSong[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return parsed.map((fav: any) => ({
      ...fav,
      artistIds: fav.artistIds || [],
    }));
  } catch {
    return [];
  }
};

/**
 * 保存喜欢的歌曲列表
 * @param favorites 喜欢的歌曲数组
 */
export const saveFavorites = (favorites: FavoriteSong[]): void => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
};

/**
 * 检查歌曲是否已喜欢
 * @param favorites 喜欢的歌曲列表
 * @param songId 歌曲ID
 * @returns 是否已喜欢
 */
export const isSongFavorite = (favorites: FavoriteSong[], songId: number): boolean => {
  return favorites.some(f => f.id === songId);
};

/**
 * 添加歌曲到喜欢列表
 * @param favorites 当前喜欢列表
 * @param newFavorite 新的歌曲
 * @returns 更新后的喜欢列表
 */
export const addFavorite = (favorites: FavoriteSong[], newFavorite: FavoriteSong): FavoriteSong[] => {
  return [newFavorite, ...favorites];
};

/**
 * 从喜欢列表移除歌曲
 * @param favorites 当前喜欢列表
 * @param songId 要移除的歌曲ID
 * @returns 更新后的喜欢列表
 */
export const removeFavorite = (favorites: FavoriteSong[], songId: number): FavoriteSong[] => {
  return favorites.filter(f => f.id !== songId);
};

/**
 * 触发喜欢列表更新事件
 */
export const dispatchFavoritesUpdate = (): void => {
  window.dispatchEvent(new CustomEvent('favorites-updated'));
};
