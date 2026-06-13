declare interface NetSong {
  id: number;
  name: string;
  artists: { name: string; id: number }[];
  album: { name: string; picUrl: string; id: number };
  duration: number;
}

/** 歌曲详情接口 */
declare interface NetSongDetail {
  id: number;
  name: string;
  artists: { name: string; id: number }[];
  album: { name: string; picUrl: string; id: number; picUrl_str?: string };
  duration: number;
}

/** 搜索结果接口 */
declare interface NetSearchResult {
  songs: NetSong[];
  songCount: number;
}

/** 歌词接口 */
declare interface NetLyric {
  lyric: string;
  tlyric: string;
}

/** 热搜项接口 */
declare interface NetHotSearch {
  searchWord: string;
  score: number;
  content: string;
  source: number;
  iconType: number;
  iconUrl: string | null;
  url: string;
  alg: string;
}

/** 搜索建议接口 */
declare interface NetSearchSuggestion {
  allMatch: { keyword: string; type: number; alg: string; lastKeyword: string; feature: string }[];
}

/** 歌手详情接口 */
declare interface NetArtistDetail {
  id: number;
  name: string;
  picUrl: string;
  albumSize: number;
  musicSize: number;
  briefDesc: string;
  alias: string[];
  followeds: number;
}
