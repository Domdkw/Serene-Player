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

export function getAlbumCoverUrl(picUrl: string, size: number = 300): string {
  if (!picUrl) return '';
  const sizeParam = size >= 800 ? 800 : size >= 400 ? 400 : 300;
  return picUrl.replace(/\?param=\d+/, '') + `?param=${sizeParam}y${sizeParam}`;
}
