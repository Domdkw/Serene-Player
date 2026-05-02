
import { TrackMetadata, LyricLine, LyricChar } from '../types';

export interface ParsedLyricsResult {
  lines: LyricLine[];
  lyricArtist?: string | null;
  lyricAlbum?: string | null;
}

export const parseLyrics = (rawLyrics: string | null): ParsedLyricsResult => {
  if (!rawLyrics) return { lines: [] };

  const lines: LyricLine[] = [];
  let lyricArtist: string | null = null;
  let lyricAlbum: string | null = null;
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const tagRegex = /\[(ar|al):([^\]]*)\]/i;

  const splitLines = rawLyrics.split(/\r?\n/);
  
  // 用于检测翻译行的临时映射
  const timeToLineMap = new Map<number, number>(); // time -> index in lines

  splitLines.forEach(line => {
    const tagMatch = line.match(tagRegex);
    if (tagMatch) {
      const tagType = tagMatch[1].toLowerCase();
      const tagValue = tagMatch[2].trim();
      if (tagType === 'ar') {
        lyricArtist = tagValue;
      } else if (tagType === 'al') {
        lyricAlbum = tagValue;
      }
      return;
    }

    const times = line.match(timeRegex);
    const text = line.replace(timeRegex, '').trim();

    if (times && text) {
      // 解析时间戳
      const matches = timeRegex.exec(times[0]);
      if (matches) {
        const minutes = parseInt(matches[1]);
        const seconds = parseInt(matches[2]);
        const ms = parseInt(matches[3]);
        const time = minutes * 60 + seconds + ms / (matches[3].length === 3 ? 1000 : 100);

        // 检查这个时间戳是否已经存在（可能是翻译行）
        const existingIndex = timeToLineMap.get(time);
        if (existingIndex !== undefined) {
          // 这是翻译行，添加到已有行的 translation 字段
          lines[existingIndex].translation = text;
        } else if (times.length > 1) {
          // 逐字歌词
          const lyricLine: LyricLine = { time: -1, text };
          const chars: LyricChar[] = [];

          timeRegex.lastIndex = 0;
          let match;
          let charIndex = 0;

          while ((match = timeRegex.exec(line)) !== null) {
            const m = parseInt(match[1]);
            const s = parseInt(match[2]);
            const millis = parseInt(match[3]);
            const charTime = m * 60 + s + millis / (match[3].length === 3 ? 1000 : 100);

            if (charIndex < text.length) {
              chars.push({
                time: charTime,
                text: text[charIndex]
              });
              charIndex++;
            }
          }

          if (chars.length > 0) {
            lyricLine.time = chars[0].time;
            lyricLine.chars = chars;
            timeToLineMap.set(lyricLine.time, lines.length);
          }

          lines.push(lyricLine);
        } else {
          // 普通歌词行
          const newLine: LyricLine = { time, text };
          timeToLineMap.set(time, lines.length);
          lines.push(newLine);
        }
      }
    } else if (text && !line.match(/\[\w+:/)) {
      lines.push({ time: -1, text });
    }
  });

  return {
    lines: lines.sort((a, b) => a.time - b.time),
    lyricArtist,
    lyricAlbum
  };
};

/**
 * 解析网易云音乐的歌词和翻译
 * 分别解析原文歌词和翻译歌词，通过时间戳精确匹配翻译到对应的歌词行
 * @param rawLyrics 原文歌词
 * @param rawTranslatedLyrics 翻译歌词
 * @returns 解析后的歌词结果
 */
export const parseLyricsWithTranslation = (
  rawLyrics: string | null,
  rawTranslatedLyrics: string | null
): ParsedLyricsResult => {
  if (!rawLyrics) return { lines: [] };

  const lines: LyricLine[] = [];
  let lyricArtist: string | null = null;
  let lyricAlbum: string | null = null;
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const tagRegex = /\[(ar|al):([^\]]*)\]/i;

  /**
   * 解析时间戳
   * @param timeStr 时间戳字符串，如 "00:30.500"
   * @returns 时间戳数值（秒）
   */
  const parseTimestamp = (timeStr: string): number => {
    const matches = timeRegex.exec(timeStr);
    if (matches) {
      const minutes = parseInt(matches[1]);
      const seconds = parseInt(matches[2]);
      const ms = parseInt(matches[3]);
      return minutes * 60 + seconds + ms / (matches[3].length === 3 ? 1000 : 100);
    }
    return -1;
  };

  /**
   * 解析单行歌词
   * @param line 歌词行
   * @returns 解析结果，包含时间戳数组和文本内容
   */
  const parseLine = (line: string): { times: string[]; text: string } | null => {
    const tagMatch = line.match(tagRegex);
    if (tagMatch) {
      return null;
    }

    timeRegex.lastIndex = 0;
    const times: string[] = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      times.push(match[0]);
    }

    const text = line.replace(timeRegex, '').trim();
    if (times.length > 0 && text) {
      return { times, text };
    }

    return null;
  };

  const timeToLineMap = new Map<number, number>();

  const splitLines = rawLyrics.split(/\r?\n/);

  splitLines.forEach(line => {
    const tagMatch = line.match(tagRegex);
    if (tagMatch) {
      const tagType = tagMatch[1].toLowerCase();
      const tagValue = tagMatch[2].trim();
      if (tagType === 'ar') {
        lyricArtist = tagValue;
      } else if (tagType === 'al') {
        lyricAlbum = tagValue;
      }
      return;
    }

    const parsed = parseLine(line);
    if (parsed) {
      const firstTime = parseTimestamp(parsed.times[0]);
      if (firstTime >= 0 && !timeToLineMap.has(firstTime)) {
        if (parsed.times.length > 1) {
          const lyricLine: LyricLine = { time: -1, text: parsed.text };
          const chars: LyricChar[] = [];

          for (let i = 0; i < parsed.times.length && i < parsed.text.length; i++) {
            const charTime = parseTimestamp(parsed.times[i]);
            if (charTime >= 0) {
              chars.push({
                time: charTime,
                text: parsed.text[i]
              });
            }
          }

          if (chars.length > 0) {
            lyricLine.time = chars[0].time;
            lyricLine.chars = chars;
            timeToLineMap.set(lyricLine.time, lines.length);
          }

          lines.push(lyricLine);
        } else {
          const newLine: LyricLine = { time: firstTime, text: parsed.text };
          timeToLineMap.set(firstTime, lines.length);
          lines.push(newLine);
        }
      }
    } else {
      const text = line.replace(timeRegex, '').trim();
      if (text && !line.match(/\[\w+:/)) {
        lines.push({ time: -1, text });
      }
    }
  });

  if (rawTranslatedLyrics) {
    const translationLines = rawTranslatedLyrics.split(/\r?\n/);

    translationLines.forEach(line => {
      const parsed = parseLine(line);
      if (parsed && parsed.times.length === 1) {
        const time = parseTimestamp(parsed.times[0]);
        if (time >= 0) {
          const existingIndex = timeToLineMap.get(time);
          if (existingIndex !== undefined) {
            lines[existingIndex].translation = parsed.text;
          } else {
            const newLine: LyricLine = { time, text: parsed.text };
            timeToLineMap.set(time, lines.length);
            lines.push(newLine);
          }
        }
      }
    });
  }

  return {
    lines: lines.sort((a, b) => a.time - b.time),
    lyricArtist,
    lyricAlbum
  };
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
        const parsedLyricsResult = parseLyrics(rawLyrics);

        resolve({
          title: title || file.name.replace(/\.[^/.]+$/, ""),
          artist: artist || "Unknown Artist",
          album: album || "Unknown Album",
          coverUrl,
          lyrics: rawLyrics,
          parsedLyrics: parsedLyricsResult.lines,
          lyricArtist: parsedLyricsResult.lyricArtist,
          lyricAlbum: parsedLyricsResult.lyricAlbum,
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
