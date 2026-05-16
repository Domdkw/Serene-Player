import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';

interface PlayerTimeState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

interface PlayerTimeContextType extends PlayerTimeState {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  formatTime: (time: number) => string;
}

const PlayerTimeContext = createContext<PlayerTimeContextType | null>(null);

export const usePlayerTime = () => {
  const context = useContext(PlayerTimeContext);
  if (!context) {
    throw new Error('usePlayerTime must be used within a PlayerTimeProvider');
  }
  return context;
};

interface PlayerTimeProviderProps {
  children: React.ReactNode;
}

export const PlayerTimeProvider: React.FC<PlayerTimeProviderProps> = ({ children }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const formatTime = useCallback((time: number) => {
    if (time < 0) return "--:--";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const value = useMemo(() => ({
    currentTime,
    duration,
    isPlaying,
    audioRef,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    formatTime,
  }), [currentTime, duration, isPlaying, formatTime]);

  return (
    <PlayerTimeContext.Provider value={value}>
      {children}
    </PlayerTimeContext.Provider>
  );
};
