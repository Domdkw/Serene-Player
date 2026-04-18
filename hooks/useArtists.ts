import { useState, useCallback, useEffect, useMemo } from 'react';
import { PlaylistItem } from '../types';
import { parseComposers } from '../utils/composerUtils';
import { getFirstLetterSync, containsChinese, getArtistsFirstLetters } from '../utils/pinyinLoader';

interface UseArtistsOptions {
  playlist: PlaylistItem[];
  activeTab: string;
}

interface UseArtistsReturn {
  artistsByLetter: Record<string, string[]>;
  artistLetterMap: Record<string, string>;
  hasChineseArtists: boolean;
  pinyinLoaded: boolean;
  pinyinLoadError: boolean;
}

export const useArtists = (options: UseArtistsOptions): UseArtistsReturn => {
  const { playlist, activeTab } = options;

  const [artistsByLetter, setArtistsByLetter] = useState<Record<string, string[]>>({});
  const [artistLetterMap, setArtistLetterMap] = useState<Record<string, string>>({});
  const [hasChineseArtists, setHasChineseArtists] = useState(false);
  const [pinyinLoaded, setPinyinLoaded] = useState(false);
  const [pinyinLoadError, setPinyinLoadError] = useState(false);

  useEffect(() => {
    const artistSet = new Set<string>();
    let hasChinese = false;

    playlist.forEach(item => {
      if (item.artist) {
        const composers = parseComposers(item.artist);
        composers.forEach(composer => {
          artistSet.add(composer.name);
          if (containsChinese(composer.name)) {
            hasChinese = true;
          }
        });
      }
    });

    const grouped: Record<string, string[]> = {};
    const letterMap: Record<string, string> = {};

    Array.from(artistSet).forEach(artist => {
      const firstLetter = getFirstLetterSync(artist);
      letterMap[artist] = firstLetter;
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(artist);
    });

    Object.keys(grouped).forEach(letter => {
      grouped[letter].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    });

    setArtistsByLetter(grouped);
    setArtistLetterMap(letterMap);
    setHasChineseArtists(hasChinese);
    setPinyinLoaded(false);
    setPinyinLoadError(false);
  }, [playlist]);

  useEffect(() => {
    if (activeTab === 'artists' && hasChineseArtists && !pinyinLoaded && !pinyinLoadError) {
      const chineseArtists = Object.keys(artistLetterMap).filter(a => containsChinese(a));
      if (chineseArtists.length === 0) return;

      getArtistsFirstLetters(chineseArtists).then(newLetters => {
        setArtistLetterMap(prev => ({ ...prev, ...newLetters }));

        const regrouped: Record<string, string[]> = {};
        Object.entries({ ...artistLetterMap, ...newLetters }).forEach(([artist, letter]) => {
          const letterKey = letter as string;
          if (!regrouped[letterKey]) {
            regrouped[letterKey] = [];
          }
          regrouped[letterKey].push(artist);
        });

        Object.keys(regrouped).forEach(letter => {
          regrouped[letter].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        });

        setArtistsByLetter(regrouped);
        setPinyinLoaded(true);
      }).catch(err => {
        ErrorService.handleError(err, 'Load Pinyin');
        setPinyinLoadError(true);
      });
    }
  }, [activeTab, hasChineseArtists, pinyinLoaded, pinyinLoadError, artistLetterMap]);

  return {
    artistsByLetter,
    artistLetterMap,
    hasChineseArtists,
    pinyinLoaded,
    pinyinLoadError,
  };
};

import { ErrorService } from '../utils/errorService';
