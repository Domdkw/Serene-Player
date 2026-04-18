import { useState, useCallback, useEffect, useRef } from 'react';
import { PlaylistItem } from '../types';
import { extractMetadata } from '../utils/metadata';
import { ErrorService } from '../utils/errorService';

interface UseFileUploadOptions {
  onTrackLoad: (item: PlaylistItem, index: number) => void;
  addToPlaylist: (items: PlaylistItem[]) => void;
  addToPlaylistFolders: (name: string, items: PlaylistItem[]) => void;
  currentIndex: number;
}

interface UseFileUploadReturn {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

const supportedAudioFormats = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.ape', '.opus'];

const isAudioFile = (filename: string): boolean => {
  const lowerName = filename.toLowerCase();
  return supportedAudioFormats.some(ext => lowerName.endsWith(ext));
};

export const useFileUpload = (options: UseFileUploadOptions): UseFileUploadReturn => {
  const {
    onTrackLoad,
    addToPlaylist,
    addToPlaylistFolders,
    currentIndex
  } = options;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const metadata = await extractMetadata(file);
      const objectUrl = URL.createObjectURL(file);

      const playlistItem: PlaylistItem = {
        name: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
        url: objectUrl,
        artist: metadata.artist || 'Unknown Artist',
        file: file,
        coverUrl: metadata.coverUrl || undefined,
        album: metadata.album || undefined,
      };

      addToPlaylist([playlistItem]);
      onTrackLoad(playlistItem, currentIndex + 1);
    } catch (err) {
      ErrorService.handleError(err as Error, 'File Upload');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onTrackLoad, addToPlaylist, currentIndex]);

  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const audioFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isAudioFile(file.name)) {
        audioFiles.push(file);
      }
    }

    if (audioFiles.length === 0) {
      ErrorService.handleError(new Error('No supported audio files found'), 'Folder Upload');
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
      return;
    }

    audioFiles.sort((a, b) => a.name.localeCompare(b.name));

    const newTracks: PlaylistItem[] = [];

    for (const file of audioFiles) {
      try {
        const metadata = await extractMetadata(file);
        newTracks.push({
          name: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
          url: URL.createObjectURL(file),
          artist: metadata.artist || 'Unknown Artist',
          file: file,
          coverUrl: metadata.coverUrl || undefined,
          album: metadata.album || undefined,
        });
      } catch (err) {
        ErrorService.handleError(err as Error, 'Extract Metadata');
        newTracks.push({
          name: file.name.replace(/\.[^/.]+$/, ''),
          url: URL.createObjectURL(file),
          artist: 'Unknown Artist',
          file: file
        });
      }
    }

    addToPlaylist(newTracks);

    const folderName = `Local Folder ${new Date().toLocaleTimeString()}`;
    addToPlaylistFolders(folderName, newTracks);

    if (newTracks.length > 0) {
      onTrackLoad(newTracks[0], currentIndex + 1);
    }

    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  }, [onTrackLoad, addToPlaylist, addToPlaylistFolders, currentIndex]);

  return {
    fileInputRef,
    folderInputRef,
    handleFileUpload,
    handleFolderUpload,
  };
};
