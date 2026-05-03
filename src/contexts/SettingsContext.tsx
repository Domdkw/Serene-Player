import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { getFontUrl } from '../utils/fontUtils';

interface SettingsState {
  chunkCount: number;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  selectedFont: string;
  showTranslation: boolean;
  showSpectrum: boolean;
  streamingMode: boolean;
  spectrumFps: number;
  backgroundRotate: boolean;
  customSourceUrl: string;
}

interface SettingsContextType extends SettingsState {
  setChunkCount: (count: number) => void;
  setFontWeight: (weight: string) => void;
  setLetterSpacing: (spacing: number) => void;
  setLineHeight: (height: number) => void;
  setSelectedFont: (font: string) => void;
  setShowTranslation: (show: boolean) => void;
  setShowSpectrum: (show: boolean) => void;
  setStreamingMode: (mode: boolean) => void;
  setSpectrumFps: (fps: number) => void;
  setBackgroundRotate: (rotate: boolean) => void;
  setCustomSourceUrl: (url: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

const loadFromStorage = <T,>(key: string, defaultValue: T, parser?: (val: string) => T): T => {
  const saved = localStorage.getItem(key);
  if (saved === null) return defaultValue;
  if (parser) return parser(saved);
  return saved as unknown as T;
};

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [chunkCount, setChunkCountState] = useState<number>(() =>
    loadFromStorage('chunkCount', 4, parseInt)
  );
  const [fontWeight, setFontWeightState] = useState<string>(() =>
    loadFromStorage('fontWeight', 'medium')
  );
  const [letterSpacing, setLetterSpacingState] = useState<number>(() =>
    loadFromStorage('letterSpacing', 0.5, parseFloat)
  );
  const [lineHeight, setLineHeightState] = useState<number>(() =>
    loadFromStorage('lineHeight', 1.5, parseFloat)
  );
  const [selectedFont, setSelectedFontState] = useState<string>(() =>
    loadFromStorage('selectedFont', 'default')
  );
  const [showTranslation, setShowTranslationState] = useState<boolean>(() =>
    loadFromStorage('showTranslation', true, v => v === 'true')
  );
  const [showSpectrum, setShowSpectrumState] = useState<boolean>(() =>
    loadFromStorage('showSpectrum', true, v => v === 'true')
  );
  const [streamingMode, setStreamingModeState] = useState<boolean>(() =>
    loadFromStorage('streamingMode', false, v => v === 'true')
  );
  const [spectrumFps, setSpectrumFpsState] = useState<number>(() =>
    loadFromStorage('spectrumFps', 60, parseInt)
  );
  const [backgroundRotate, setBackgroundRotateState] = useState<boolean>(() =>
    loadFromStorage('backgroundRotate', false, v => v === 'true')
  );
  const [customSourceUrl, setCustomSourceUrlState] = useState<string>(() =>
    loadFromStorage('customMusicSource', '')
  );

  const setChunkCount = useCallback((count: number) => {
    localStorage.setItem('chunkCount', count.toString());
    setChunkCountState(count);
  }, []);

  const setFontWeight = useCallback((weight: string) => {
    localStorage.setItem('fontWeight', weight);
    setFontWeightState(weight);
  }, []);

  const setLetterSpacing = useCallback((spacing: number) => {
    localStorage.setItem('letterSpacing', spacing.toString());
    setLetterSpacingState(spacing);
  }, []);

  const setLineHeight = useCallback((height: number) => {
    localStorage.setItem('lineHeight', height.toString());
    setLineHeightState(height);
  }, []);

  const setSelectedFont = useCallback((font: string) => {
    localStorage.setItem('selectedFont', font);
    setSelectedFontState(font);
  }, []);

  const setShowTranslation = useCallback((show: boolean) => {
    localStorage.setItem('showTranslation', show.toString());
    setShowTranslationState(show);
  }, []);

  const setShowSpectrum = useCallback((show: boolean) => {
    localStorage.setItem('showSpectrum', show.toString());
    setShowSpectrumState(show);
  }, []);

  const setStreamingMode = useCallback((mode: boolean) => {
    localStorage.setItem('streamingMode', mode.toString());
    setStreamingModeState(mode);
  }, []);

  const setSpectrumFps = useCallback((fps: number) => {
    localStorage.setItem('spectrumFps', fps.toString());
    setSpectrumFpsState(fps);
  }, []);

  const setBackgroundRotate = useCallback((rotate: boolean) => {
    localStorage.setItem('backgroundRotate', rotate.toString());
    setBackgroundRotateState(rotate);
  }, []);

  const setCustomSourceUrl = useCallback((url: string) => {
    if (url) {
      localStorage.setItem('customMusicSource', url);
    } else {
      localStorage.removeItem('customMusicSource');
    }
    setCustomSourceUrlState(url);
  }, []);

  useEffect(() => {
    const existingFontLinks = document.querySelectorAll('link[data-font-link="true"]');
    existingFontLinks.forEach(link => link.remove());

    if (selectedFont !== 'default') {
      const fontUrl = getFontUrl(selectedFont);
      if (fontUrl) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = fontUrl;
        fontLink.setAttribute('data-font-link', 'true');
        document.head.appendChild(fontLink);
        return () => {
          document.head.removeChild(fontLink);
        };
      }
    }
  }, [selectedFont]);

  const value = useMemo(() => ({
    chunkCount,
    fontWeight,
    letterSpacing,
    lineHeight,
    selectedFont,
    showTranslation,
    showSpectrum,
    streamingMode,
    spectrumFps,
    backgroundRotate,
    customSourceUrl,
    setChunkCount,
    setFontWeight,
    setLetterSpacing,
    setLineHeight,
    setSelectedFont,
    setShowTranslation,
    setShowSpectrum,
    setStreamingMode,
    setSpectrumFps,
    setBackgroundRotate,
    setCustomSourceUrl,
  }), [
    chunkCount,
    fontWeight,
    letterSpacing,
    lineHeight,
    selectedFont,
    showTranslation,
    showSpectrum,
    streamingMode,
    spectrumFps,
    backgroundRotate,
    customSourceUrl,
    setChunkCount,
    setFontWeight,
    setLetterSpacing,
    setLineHeight,
    setSelectedFont,
    setShowTranslation,
    setShowSpectrum,
    setStreamingMode,
    setSpectrumFps,
    setBackgroundRotate,
    setCustomSourceUrl,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
