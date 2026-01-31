
export interface LyricLine {
  time: number;
  text: string;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  lyrics: string | null;
  parsedLyrics: LyricLine[];
}

export interface Track {
  file?: File;
  objectUrl: string;
  metadata: TrackMetadata;
}

export interface PlaylistItem {
  name: string;
  artist: string;
  themeColor?: string;
  url: string;
  link?: string;
  file?: File;
}

export interface PlaylistFolder {
  link?: string;
  tracks?: PlaylistItem[];
  children?: Record<string, PlaylistItem[] | PlaylistFolder>;
}

export type PlaylistFolders = Record<string, PlaylistItem[] | PlaylistFolder>;

export type PlaybackMode = 'single' | 'list';

// Global declaration for jsmediatags which is loaded via CDN
declare global {
  interface Window {
    jsmediatags: any;
  }
}
