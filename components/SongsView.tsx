import React, { memo, useState, useCallback } from 'react';
import { Plus, Search, Upload, FileAudio, FolderOpen, Link2, X, RotateCcw } from 'lucide-react';
import { PlaylistItem, PlaylistFolders } from '../types';
import { MusicLibrary } from './MusicLibrary';
import { SearchPanel } from './SearchPanel';
import { FolderLoadingIndicator } from './LoadingComponents';

interface SongsViewHeaderProps {
  currentFolder: string | null;
  playlistFolders: PlaylistFolders;
  playlistCount: number;
  onOpenCustomSource: () => void;
  hasCustomSource: boolean;
  onToggleSearch: () => void;
  isSearchOpen: boolean;
  onToggleUploadMenu: () => void;
  isUploadMenuOpen: boolean;
  uploadMenuRef: React.RefObject<HTMLDivElement | null>;
  onFileUpload: () => void;
  onFolderUpload: () => void;
}

const SongsViewHeader: React.FC<SongsViewHeaderProps> = memo(({
  currentFolder,
  playlistFolders,
  playlistCount,
  onOpenCustomSource,
  hasCustomSource,
  onToggleSearch,
  isSearchOpen,
  onToggleUploadMenu,
  isUploadMenuOpen,
  uploadMenuRef,
  onFileUpload,
  onFolderUpload
}) => {
  return (
    <div className="flex items-center justify-between p-6 border-b border-white/[0.05]">
      <div>
        <h2 className="text-2xl font-bold text-white drop-shadow-md">歌曲</h2>
        <p className="text-sm text-white/40 mt-1 drop-shadow-sm">
          {currentFolder ? currentFolder : `${Object.keys(playlistFolders).length} 个文件夹, ${playlistCount} 首歌曲`}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCustomSource}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${hasCustomSource ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white'}`}
          title="设置自定义音乐源"
        >
          <Plus size={18} />
        </button>

        <button
          onClick={onToggleSearch}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${isSearchOpen ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white'}`}
          title="搜索"
        >
          <Search size={18} />
        </button>

        <div className="relative" ref={uploadMenuRef}>
          <button
            onClick={onToggleUploadMenu}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/[0.15] text-white/70 hover:text-white transition-all duration-200"
            title="导入音乐"
          >
            <Upload size={18} />
          </button>

          {isUploadMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-40 bg-[#1a1a1f] rounded-xl border border-white/[0.05] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <button
                onClick={onFileUpload}
                className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors text-left text-sm"
              >
                <FileAudio size={16} />
                导入文件
              </button>
              <button
                onClick={onFolderUpload}
                className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors text-left text-sm"
              >
                <FolderOpen size={16} />
                导入文件夹
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

interface CustomSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
  onReset: () => void;
  currentUrl: string;
  inputValue: string;
  onInputChange: (value: string) => void;
}

const CustomSourceModal: React.FC<CustomSourceModalProps> = memo(({
  isOpen,
  onClose,
  onSave,
  onReset,
  currentUrl,
  inputValue,
  onInputChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md mx-4 bg-[#1a1a1f] rounded-2xl border border-white/[0.08] shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Link2 size={20} className="text-white/80" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">自定义音乐源</h3>
              <p className="text-xs text-white/40">设置自定义播放列表 JSON 文件地址</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">音乐源 URL</label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="https://example.com/playlist.json"
              className="w-full px-4 py-3 bg-white/5 border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.08]"
            />
            <p className="text-xs text-white/40 mt-2">
              留空则使用默认源 (./discList.json)
            </p>
          </div>

          {currentUrl && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-white/60 truncate flex-1">
                当前: {currentUrl}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.05]">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            <RotateCcw size={16} />
            还原默认
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
            >
              取消
            </button>
            <button
              onClick={() => onSave(inputValue)}
              className="px-5 py-2 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-all text-sm"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

interface SongsViewProps {
  currentFolder: string | null;
  playlistFolders: PlaylistFolders;
  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaying: boolean;
  loadingFolders: Set<string>;
  folderLoading: { name: string; progress: number } | null;
  loadingTrackUrl: string | null;
  customSourceUrl: string;
  onSetCurrentFolder: (folder: string | null) => void;
  onLoadLinkedFolder: (folderName: string, linkUrl: string) => Promise<void>;
  onTrackSelect: (item: PlaylistItem, index: number) => void;
  onFileUpload: () => void;
  onFolderUpload: () => void;
  onSetCustomSourceUrl: (url: string) => void;
}

export const SongsView: React.FC<SongsViewProps> = memo(({
  currentFolder,
  playlistFolders,
  playlist,
  currentIndex,
  isPlaying,
  loadingFolders,
  folderLoading,
  loadingTrackUrl,
  customSourceUrl,
  onSetCurrentFolder,
  onLoadLinkedFolder,
  onTrackSelect,
  onFileUpload,
  onFolderUpload,
  onSetCustomSourceUrl
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [isCustomSourceOpen, setIsCustomSourceOpen] = useState(false);
  const [sourceInputValue, setSourceInputValue] = useState('');

  const uploadMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
        setIsUploadMenuOpen(false);
      }
    };

    if (isUploadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUploadMenuOpen]);

  const handleOpenCustomSource = useCallback(() => {
    setSourceInputValue(customSourceUrl);
    setIsCustomSourceOpen(true);
  }, [customSourceUrl]);

  const handleSaveCustomSource = useCallback((url: string) => {
    onSetCustomSourceUrl(url.trim());
    setIsCustomSourceOpen(false);
  }, [onSetCustomSourceUrl]);

  const handleResetCustomSource = useCallback(() => {
    onSetCustomSourceUrl('');
    setSourceInputValue('');
    setIsCustomSourceOpen(false);
  }, [onSetCustomSourceUrl]);

  return (
    <div className="h-full flex flex-col">
      <SongsViewHeader
        currentFolder={currentFolder}
        playlistFolders={playlistFolders}
        playlistCount={playlist.length}
        onOpenCustomSource={handleOpenCustomSource}
        hasCustomSource={!!customSourceUrl}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        isSearchOpen={isSearchOpen}
        onToggleUploadMenu={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
        isUploadMenuOpen={isUploadMenuOpen}
        uploadMenuRef={uploadMenuRef}
        onFileUpload={onFileUpload}
        onFolderUpload={onFolderUpload}
      />

      {folderLoading && (
        <div className="px-6 pt-4">
          <FolderLoadingIndicator name={folderLoading.name} progress={folderLoading.progress} />
        </div>
      )}

      <div className="flex-1 overflow-hidden p-6 pt-4">
        <MusicLibrary
          playlistFolders={playlistFolders}
          currentFolder={currentFolder}
          setCurrentFolder={onSetCurrentFolder}
          playlist={playlist}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onTrackSelect={onTrackSelect}
          loadingFolders={loadingFolders}
          onLoadLinkedFolder={onLoadLinkedFolder}
          loadingTrackUrl={loadingTrackUrl}
        />
      </div>

      <SearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        playlist={playlist}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        onTrackSelect={onTrackSelect}
      />

      <CustomSourceModal
        isOpen={isCustomSourceOpen}
        onClose={() => setIsCustomSourceOpen(false)}
        onSave={handleSaveCustomSource}
        onReset={handleResetCustomSource}
        currentUrl={customSourceUrl}
        inputValue={sourceInputValue}
        onInputChange={setSourceInputValue}
      />
    </div>
  );
});

export default SongsView;
