import { useState, useRef, useCallback } from 'react';
import { Upload, ArrowLeft, FileAudio, X } from 'lucide-react';
import { PlaylistItem } from '@/types';

interface UploadPluginProps {
  isMobile?: boolean;
  onBack?: () => void;
  onFilesSelected?: (files: File[]) => void;
  loadMusicFromUrl?: (item: PlaylistItem, index: number) => void;
}

interface UploadedFile {
  file: File;
  id: string;
}

/**
 * UPLOAD 插件详细配置组件
 */
const UploadPlugin: React.FC<UploadPluginProps> = ({
  isMobile = false,
  onBack,
  onFilesSelected,
  loadMusicFromUrl,
  }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理文件选择
   */
  const handleFiles = useCallback((fileList: FileList) => {
    const audioFiles = Array.from(fileList).filter(file => 
      file.type.startsWith('audio/') || 
      /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(file.name)
    );

    const newFiles: UploadedFile[] = audioFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    setFiles(prev => {
      const updated = [...prev, ...newFiles];
      // 通过回调传递文件给父组件
      onFilesSelected?.(updated.map(f => f.file));
      return updated;
    });
  }, [onFilesSelected]);

  /**
   * 点击上传区域
   */
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * input 文件变化
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }, [handleFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={`${isMobile ? 'px-4 py-2' : 'p-6'}`}>
      {onBack && (
        <button
          onClick={onBack}
          className={`
            flex items-center gap-2 mb-6 transition-all duration-200
            ${isMobile ? 'text-white/60 active:text-white/90' : 'text-white/50 hover:text-white/80'}
          `}
        >
          <ArrowLeft size={20} />
          <span className={isMobile ? 'text-sm' : 'text-base'}>返回插件列表</span>
        </button>
      )}

      <div className={'relative overflow-hidden bg-white/[0.05] rounded-2xl border border-white/[0.06]'}>
        <div className="p-6">
          <h2 className={`font-semibold mb-4 ${isMobile ? 'text-lg' : 'text-xl'} text-white`}>
            上传音乐文件
          </h2>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
          
          <div
            onClick={handleClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl
              flex flex-col items-center justify-center
              transition-all duration-200 cursor-pointer
              ${isMobile ? 'py-12 px-4' : 'py-16 px-8'}
              ${isDragging 
                ? 'border-white/60 bg-white/[0.08]' 
                : 'border-white/20 hover:border-white/40 hover:bg-white/[0.02]'
              }
              active:scale-[0.99]
            `}
          >
            <div className={`
              rounded-full bg-white/10 flex items-center justify-center mb-4
              ${isMobile ? 'w-16 h-16' : 'w-20 h-20'}
            `}>
              <Upload size={isMobile ? 28 : 32} className="text-white/60" />
            </div>
            
            <p className={`font-medium text-white mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
              拖拽文件到此处上传
            </p>
            
            <p className={`text-white/40 ${isMobile ? 'text-sm' : 'text-base'}`}>
              或点击选择文件
            </p>
            
            <p className={`text-white/30 mt-4 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              支持 MP3、WAV、FLAC 等音频格式
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-6">
              <h3 className={`font-medium text-white/80 mb-3 ${isMobile ? 'text-sm' : 'text-base'}`}>
                {files.length} 个文件
              </h3>
              <div className="space-y-2">
                {files.map(({ file, id }) => (
                  <div
                    key={id}
                    className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]"
                  >
                    <button className="flex-1 min-w-0 text-left"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (loadMusicFromUrl) {
                        const playlistItem: PlaylistItem = {
                          url: '',
                          name: file.name.replace(/\.[^/.]+$/, ''),
                          artist: '本地文件',
                          themeColor: 'black',
                          file: file,
                        };
                        loadMusicFromUrl(playlistItem, 0);
                      }
                    }}
                    >
                      <p className="text-white/80 text-sm font-medium">
                        {file.name}
                      </p>
                      <p className="text-white/40 text-xs">
                        {formatFileSize(file.size)}
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X size={16} className="text-white/50 hover:text-white/80" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPlugin;
