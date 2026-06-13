const BASE_URL = '/api/music';

/** 歌手详情缓存 */
const artistDetailCache = new Map<number, NetArtistDetail | null>();

/**
 * 网易云音乐 API 对象
 */
export const neteaseApi = {
  /**
   * 搜索歌曲
   * @param keywords 搜索关键词
   * @param limit 返回数量限制
   * @param offset 偏移量
   * @returns 搜索结果
   */
  async searchMusic(keywords: string, limit: number = 30, offset: number = 0): Promise<NetSearchResult> {
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
  },

  /**
   * 获取歌曲播放 URL
   * @param id 歌曲ID
   * @returns 播放 URL
   */
  getSongUrl(id: number): string {
    return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
  },

  /**
   * 格式化时长
   * @param duration 时长（毫秒）
   * @returns 格式化后的时长字符串
   */
  formatDuration(duration: number): string {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  /**
   * 获取歌曲详情
   * @param ids 歌曲ID或ID数组
   * @returns 歌曲详情数组
   */
  async getSongDetail(ids: number | number[]): Promise<NetSongDetail[]> {
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
      artists: (song.artists || []).map((artist: any) => ({ name: artist.name, id: artist.id })),
      album: {
        name: song.album?.name || '',
        picUrl: song.album?.picUrl || '',
        id: song.album?.id || 0,
        picUrl_str: song.album?.picUrl_str,
      },
      duration: song.duration || 0,
    }));
  },

  /**
   * 获取专辑封面 URL
   * @param picUrl 原始封面 URL
   * @param size 尺寸
   * @param original 是否获取原图
   * @returns 处理后的封面 URL
   */
  getAlbumCoverUrl(picUrl: string, size: number = 0, original: boolean = false): string {
    if (!picUrl) return '';

    if (original) {
      return picUrl.replace(/\?param=\d+y\d+/, '');
    }

    const sizeParam = size >= 800 ? 800 : size >= 400 ? 400 : size;
    return picUrl.replace(/\?param=\d+y\d+/, '') + (sizeParam === 0 ? '' : `?param=${sizeParam}y${sizeParam}`);
  },

  /**
   * 获取歌曲歌词
   * @param id 歌曲ID
   * @returns 歌词对象
   */
  async getSongLyric(id: number): Promise<NetLyric | null> {
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
  },

  /**
   * 获取热搜列表（简略）
   * @returns 热搜列表
   */
  async getHotSearchList(): Promise<NetHotSearch[]> {
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
  },

  /**
   * 获取热搜列表（详细）
   * @returns 详细热搜列表
   */
  async getHotSearchDetail(): Promise<NetHotSearch[]> {
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
  },

  /**
   * 获取搜索建议
   * @param keywords 关键词
   * @returns 搜索建议
   */
  async getSearchSuggestion(keywords: string): Promise<NetSearchSuggestion> {
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
  },

  /**
   * 获取歌手详情
   * @param id 歌手ID
   * @returns 歌手详情信息
   */
  async getArtistDetail(id: number): Promise<NetArtistDetail | null> {
    if (artistDetailCache.has(id)) {
      return artistDetailCache.get(id)!;
    }

    const url = `${BASE_URL}/artist/detail?id=${id}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`获取歌手详情失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 200 || !data.data?.artist) {
      artistDetailCache.set(id, null);
      return null;
    }

    const artist = data.data.artist;
    const result: NetArtistDetail = {
      id: artist.id,
      name: artist.name,
      picUrl: artist.avatar || artist.cover || '',
      albumSize: artist.albumSize || 0,
      musicSize: artist.musicSize || 0,
      briefDesc: artist.briefDesc || '',
      alias: artist.alias || [],
      followeds: artist.followeds || 0,
    };

    artistDetailCache.set(id, result);
    return result;
  },
};