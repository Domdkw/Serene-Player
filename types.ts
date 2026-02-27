
export interface LyricChar {
  time: number;
  text: string;
}

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
  chars?: LyricChar[];
}

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  lyrics: string | null;
  parsedLyrics: LyricLine[];
  lyricArtist?: string | null;
  lyricAlbum?: string | null;
}

export interface Track {
  file?: File;
  objectUrl: string;
  metadata: TrackMetadata;
  neteaseId?: number;
  artistIds?: number[];
  sourceType?: 'local' | 'streaming';
}

export interface PlaylistItem {
  name: string;
  artist: string;
  themeColor?: string;
  url: string;
  link?: string;
  file?: File;
  neteaseId?: number;
  artistIds?: number[];
  coverUrl?: string;
  lyrics?: string;
  album?: string;
}

export interface PlaylistFolder {
  link?: string;
  tracks?: PlaylistItem[];
  children?: Record<string, PlaylistItem[] | PlaylistFolder>;
}

export type PlaylistFolders = Record<string, PlaylistItem[] | PlaylistFolder>;

export type PlaybackMode = 'single' | 'list' | 'shuffle';

// Global declaration for jsmediatags which is loaded via CDN
declare global {
  interface Window {
    jsmediatags: any;
  }
}
