import { neteaseApi } from './netease';

/**
 * API 路由对象
 * 根据音乐源路由到对应的 API 实现
 */
export const apiRouter = {
  /**
   * 搜索歌曲
   * @param keywords 搜索关键词
   * @param limit 返回数量限制
   * @param offset 偏移量
   * @param source 音乐源（默认网易云）
   * @returns 搜索结果
   */
  async searchMusic(keywords: string, limit: number = 30, offset: number = 0, source: string = '163') {
    switch (source) {
      case '163':
        return neteaseApi.searchMusic(keywords, limit, offset);
      // TODO: 其他音乐源
      default:
        return null;
    }
  },

  /**
   * 获取歌曲播放 URL
   * @param id 歌曲ID（数字或包含多源ID的对象）
   * @param source 音乐源
   * @returns 播放 URL
   */
  async getSongUrl(id: number | object, source?: string): Promise<string | null> {
    if (typeof id === 'number') {
      return neteaseApi.getSongUrl(id);
    }

    switch (source) {
      case '163':
        console.log(id['163']);
        return id['163'] ? neteaseApi.getSongUrl(id['163']) : null;
      case 'migu':
        // TODO: 实现咪咕音乐 URL 获取
        return null;
      default:
        return null;
    }
  },

  /**
   * 获取歌曲详情
   * @param ids 歌曲ID或ID数组
   * @param source 音乐源
   * @returns 歌曲详情数组
   */
  async getSongDetail(ids: number | number[], source: string = '163') {
    switch (source) {
      case '163':
        return neteaseApi.getSongDetail(ids);
      default:
        return null;
    }
  },

  /**
   * 获取专辑封面 URL
   * @param picUrl 原始封面 URL
   * @param size 尺寸
   * @param original 是否获取原图
   * @returns 处理后的封面 URL
   */
  getAlbumCoverUrl(picUrl: string, size: number = 0, original: boolean = false): string {
    return neteaseApi.getAlbumCoverUrl(picUrl, size, original);
  },

  /**
   * 获取歌曲歌词
   * @param id 歌曲ID
   * @param source 音乐源
   * @returns 歌词对象
   */
  async getSongLyric(id: number, source: string = '163') {
    switch (source) {
      case '163':
        return neteaseApi.getSongLyric(id['163']);
      default:
        return neteaseApi.getSongLyric(id);
    }
  },

  /**
   * 获取热搜列表（详细）
   * @param source 音乐源
   * @returns 热搜列表
   */
  async getHotSearchDetail(source: string = '163') {
    switch (source) {
      case '163':
        return neteaseApi.getHotSearchDetail();
      default:
        return neteaseApi.getHotSearchDetail();
    }
  },

  /**
   * 获取搜索建议
   * @param keywords 关键词
   * @param source 音乐源
   * @returns 搜索建议
   */
  async getSearchSuggestion(keywords: string, source: string = '163') {
    switch (source) {
      case '163':
        return neteaseApi.getSearchSuggestion(keywords);
      default:
        return null;
    }
  },

  /**
   * 获取歌手详情
   * @param id 歌手ID
   * @param source 音乐源
   * @returns 歌手详情
   */
  async getArtistDetail(id: number, source: string = '163') {
    switch (source) {
      case '163':
        return neteaseApi.getArtistDetail(id);
      default:
        return null;
    }
  },

  /**
   * 格式化时长
   * @param duration 时长（毫秒）
   * @returns 格式化后的时长字符串
   */
  formatDuration(duration: number): string {
    return neteaseApi.formatDuration(duration);
  },
};
