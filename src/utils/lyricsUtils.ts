import { LyricLine } from '../types';

export function getLyricsType(lyrics: LyricLine[]): 'line' | 'none' {
  if (!lyrics.length) return 'none';
  return 'line';
}
