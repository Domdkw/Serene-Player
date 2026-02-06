
import { TrackMetadata, LyricLine, LyricChar } from '../types';

export const parseLyrics = (rawLyrics: string | null): LyricLine[] => {
  if (!rawLyrics) return [];
  
  const lines: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  
  const splitLines = rawLyrics.split(/\r?\n/);
  
  splitLines.forEach(line => {
    const times = line.match(timeRegex);
    const text = line.replace(timeRegex, '').trim();
    
    if (times && text) {
      if (times.length > 1) {
        const lyricLine: LyricLine = { time: -1, text };
        const chars: LyricChar[] = [];
        
        timeRegex.lastIndex = 0;
        let match;
        let charIndex = 0;
        
        while ((match = timeRegex.exec(line)) !== null) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          const ms = parseInt(match[3]);
          const time = minutes * 60 + seconds + ms / (match[3].length === 3 ? 1000 : 100);
          
          if (charIndex < text.length) {
            chars.push({
              time: time,
              text: text[charIndex]
            });
            charIndex++;
          }
        }
        
        if (chars.length > 0) {
          lyricLine.time = chars[0].time;
          lyricLine.chars = chars;
        }
        
        lines.push(lyricLine);
      } else {
        const matches = timeRegex.exec(times[0]);
        if (matches) {
          const minutes = parseInt(matches[1]);
          const seconds = parseInt(matches[2]);
          const ms = parseInt(matches[3]);
          const time = minutes * 60 + seconds + ms / (matches[3].length === 3 ? 1000 : 100);
          
          lines.push({ time, text });
        }
      }
    } else if (text) {
      lines.push({ time: -1, text });
    }
  });
  
  return lines.sort((a, b) => a.time - b.time);
};

export const extractMetadata = (file: File): Promise<TrackMetadata> => {
  return new Promise((resolve) => {
    window.jsmediatags.read(file, {
      onSuccess: (tag: any) => {
        const { title, artist, album, lyrics, picture } = tag.tags;
        
        let coverUrl = null;
        if (picture) {
          const { data, format } = picture;
          let base64String = "";
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          coverUrl = `data:${format};base64,${window.btoa(base64String)}`;
        }

        const rawLyrics = lyrics?.lyrics || lyrics || null;

        resolve({
          title: title || file.name.replace(/\.[^/.]+$/, ""),
          artist: artist || "Unknown Artist",
          album: album || "Unknown Album",
          coverUrl,
          lyrics: rawLyrics,
          parsedLyrics: parseLyrics(rawLyrics),
        });
      },
      onError: (error: any) => {
        console.error("Error reading tags:", error);
        resolve({
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Unknown Artist",
          album: "Unknown Album",
          coverUrl: null,
          lyrics: null,
          parsedLyrics: [],
        });
      }
    });
  });
};
