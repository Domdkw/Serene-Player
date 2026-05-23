import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { LyricLine } from '../types';

interface UseLyricsScrollingParams {
  lyrics: LyricLine[];
  currentTime: number;
  isPlaying: boolean;
}

interface UseLyricsScrollingReturn {
  activeIndex: number;
  lyricsContainerRef: React.RefObject<HTMLDivElement>;
  activeLyricRef: React.RefObject<HTMLDivElement>;
  handleUserInteraction: () => void;
}

export function useLyricsScrolling({
  lyrics,
  currentTime,
  isPlaying,
}: UseLyricsScrollingParams): UseLyricsScrollingReturn {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);
  const manualScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isManualScrolling, setIsManualScrolling] = useState(false);

  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) return i;
    }
    return -1;
  }, [currentTime, lyrics]);

  const handleUserInteraction = useCallback(() => {
    setIsManualScrolling(true);
    if (manualScrollTimerRef.current) {
      clearTimeout(manualScrollTimerRef.current);
    }
    manualScrollTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsManualScrolling(false);
      }
    }, 5000);
  }, [isPlaying]);

  useEffect(() => {
    if (isManualScrolling) return;
    if (activeLyricRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeElement = activeLyricRef.current;
      
      requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeElement.getBoundingClientRect();
        
        const currentScrollTop = container.scrollTop;
        const elementTop = activeRect.top - containerRect.top + currentScrollTop;
        const targetScroll = elementTop - containerRect.height / 2 + activeRect.height / 2;
        
        container.scrollTo({
          top: targetScroll,
          behavior: 'smooth',
        });
      });
    }
  }, [activeIndex, isManualScrolling]);

  useEffect(() => {
    return () => {
      if (manualScrollTimerRef.current) {
        clearTimeout(manualScrollTimerRef.current);
      }
    };
  }, []);

  return {
    activeIndex,
    lyricsContainerRef,
    activeLyricRef,
    handleUserInteraction,
  };
}
