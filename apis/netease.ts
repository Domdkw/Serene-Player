export interface NeteaseSong {
  id: number;
  name: string;
  artists: { name: string; id: number }[];
  album: { name: string; picUrl: string; id: number };
  duration: number;
}

export interface NeteaseSongDetail {
  id: number;
  name: string;
  artists: { name: string; id: number }[];
  album: { name: string; picUrl: string; id: number; picUrl_str?: string };
  duration: number;
}

export interface NeteaseSearchResult {
  songs: NeteaseSong[];
  songCount: number;
}

const BASE_URL = 'https://apis.netstart.cn/music';

export async function searchNeteaseMusic(keywords: string, limit: number = 30, offset: number = 0): Promise<NeteaseSearchResult> {
  const url = `${BASE_URL}/search?keywords=${encodeURIComponent(keywords)}&limit=${limit}&offset=${offset}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`搜索失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`API错误: ${data.message || '未知错误'}`);
  }

  return {
    songs: data.result.songs || [],
    songCount: data.result.songCount || 0,
  };
}

export function getNeteaseSongUrl(id: number): string {
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
}

export async function getSongUrl(id: number): Promise<string | null> {
  const url = getNeteaseSongUrl(id);
  return url;
}

export function formatDuration(duration: number): string {
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function getSongDetail(ids: number | number[]): Promise<NeteaseSongDetail[]> {
  const idsArray = Array.isArray(ids) ? ids : [ids];
  const url = `${BASE_URL}/song/detail?ids=${idsArray.join(',')}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取歌曲详情失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200 || !data.songs) {
    return [];
  }

  return data.songs.map((song: any) => ({
    id: song.id,
    name: song.name,
    artists: song.ar.map((artist: any) => ({ name: artist.name, id: artist.id })),
    album: {
      name: song.al.name,
      picUrl: song.al.picUrl,
      id: song.al.id,
      picUrl_str: song.al.picUrl_str,
    },
    duration: song.dt,
  }));
}

export function getAlbumCoverUrl(picUrl: string, size: number = 300, original: boolean = false): string {
  if (!picUrl) return '';
  
  if (original) {
    return picUrl.replace(/\?param=\d+/, '');
  }
  
  const sizeParam = size >= 800 ? 800 : size >= 400 ? 400 : 300;
  return picUrl.replace(/\?param=\d+/, '') + `?param=${sizeParam}y${sizeParam}`;
}

export interface NeteaseLyric {
  lyric: string;
  tlyric: string;
}

export interface NeteaseHotSearch {
  searchWord: string;
  score: number;
  content: string;
  source: number;
  iconType: number;
  iconUrl: string | null;
  url: string;
  alg: string;
}

export interface NeteaseSearchSuggestion {
  allMatch: { keyword: string; type: number; alg: string; lastKeyword: string; feature: string }[];
}

/**
 * 获取歌曲歌词
 * @param id 歌曲ID
 * @returns 歌词对象，包含原文歌词和翻译歌词
 */
export async function getSongLyric(id: number): Promise<NeteaseLyric | null> {
  const url = `${BASE_URL}/lyric?id=${id}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取歌词失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    return null;
  }

  return {
    lyric: data.lrc?.lyric || '',
    tlyric: data.tlyric?.lyric || '',
  };
}

/**
 * 获取热搜列表(简略)
 * @returns 热搜列表
 */
export async function getHotSearchList(): Promise<NeteaseHotSearch[]> {
  const url = `${BASE_URL}/search/hot`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取热搜列表失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`API错误: ${data.message || '未知错误'}`);
  }

  return data.result || [];
}

/**
 * 获取热搜列表(详细)
 * @returns 详细热搜列表
 */
export async function getHotSearchDetail(): Promise<NeteaseHotSearch[]> {
  const url = `${BASE_URL}/search/hot/detail`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取热搜详情失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`API错误: ${data.message || '未知错误'}`);
  }

  return data.data || [];
}

/**
 * 获取搜索建议
 * @param keywords 关键词
 * @returns 搜索建议
 */
export async function getSearchSuggestion(keywords: string): Promise<NeteaseSearchSuggestion> {
  const url = `${BASE_URL}/search/suggest?keywords=${encodeURIComponent(keywords)}&type=mobile`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取搜索建议失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`API错误: ${data.message || '未知错误'}`);
  }

  return {
    allMatch: data.result.allMatch || [],
  };
}

export interface NeteaseArtistDetail {
  id: number;
  name: string;
  picUrl: string;
  albumSize: number;
  musicSize: number;
  briefDesc: string;
  alias: string[];
  followeds: number;
}

/**
 * 获取歌手详情
 * @param id 歌手ID
 * @returns 歌手详情信息，包含头像等
 */
export async function getArtistDetail(id: number): Promise<NeteaseArtistDetail | null> {
  const url = `${BASE_URL}/artist/detail?id=${id}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取歌手详情失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200 || !data.data?.artist) {
    return null;
  }

  const artist = data.data.artist;
  return {
    id: artist.id,
    name: artist.name,
    picUrl: artist.avatar || artist.cover || '',
    albumSize: artist.albumSize || 0,
    musicSize: artist.musicSize || 0,
    briefDesc: artist.briefDesc || '',
    alias: artist.alias || [],
    followeds: artist.followeds || 0,
  };
}
