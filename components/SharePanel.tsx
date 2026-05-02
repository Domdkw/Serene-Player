import React, { memo, useState, useCallback } from 'react';
import { X, Copy, Check, RefreshCw, Clock, Link, AlertCircle, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShareConfig } from '../hooks/useSharePanel';
import { createStopPropagationProps } from '../utils/swipeUtils';

/**
 * SharePanel组件的Props接口
 */
interface SharePanelProps {
  /** 是否显示面板 */
  isOpen: boolean;
  /** 关闭面板的回调 */
  onClose: () => void;
  /** 分享配置 */
  config: ShareConfig;
  /** 更新配置的回调 */
  updateConfig: <K extends keyof ShareConfig>(key: K, value: ShareConfig[K]) => void;
  /** 生成的分享URL */
  shareUrl: string;
  /** 重置配置的回调 */
  resetConfig: () => void;
  /** 读取当前时间的回调 */
  onReadCurrentTime: () => void;
  /** 读取当前地址的回调 */
  onReadCurrentUrl: () => void;
  /** 读取当前歌曲信息的回调 */
  onReadCurrentTrack?: () => void;
  /** 复制到剪贴板的回调 */
  onCopy: () => Promise<boolean>;
  /** 验证配置的回调 */
  onValidate: () => { isValid: boolean; errors: string[] };
  /** 当前播放时间（秒） */
  currentTime?: number;
  /** 是否为移动端模式 */
  isMobile?: boolean;
}

/**
 * 复选框组件Props
 */
interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

/**
 * 复选框组件
 */
const CheckboxField = memo<CheckboxFieldProps>(({
  label,
  checked,
  onChange,
  disabled = false,
  hint
}) => (
  <div className="flex items-start gap-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-white
        focus:ring-2 focus:ring-white/20 focus:ring-offset-0 cursor-pointer"
    />
    <div className="flex-1">
      <label className={`text-sm ${disabled ? 'text-white/30' : 'text-white/80'} cursor-pointer`}>
        {label}
      </label>
      {hint && (
        <p className="text-xs text-white/40 mt-0.5">{hint}</p>
      )}
    </div>
  </div>
));

/**
 * SharePanel组件
 * 用于生成和分享带有查询参数的URL
 */
const SharePanel: React.FC<SharePanelProps> = memo(({
  isOpen,
  onClose,
  config,
  updateConfig,
  shareUrl,
  resetConfig,
  onReadCurrentTime,
  onReadCurrentUrl,
  onReadCurrentTrack,
  onCopy,
  onValidate,
  isMobile = false
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  /**
   * 处理复制操作
   */
  const handleCopy = useCallback(async () => {
    const validation = onValidate();
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }
    
    setValidationErrors([]);
    const success = await onCopy();
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [onCopy, onValidate]);

  /**
   * 处理重置操作
   */
  const handleReset = useCallback(() => {
    resetConfig();
    setValidationErrors([]);
  }, [resetConfig]);

  const panelContent = (
    <div className="space-y-5">
      {/* 读取当前歌曲按钮 */}
      {onReadCurrentTrack && (
        <button
          onClick={onReadCurrentTrack}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg 
            bg-white/10 hover:bg-white/20 text-white border border-white/10 
            font-medium text-sm transition-all"
        >
          <Music size={16} />
          读取当前歌曲
        </button>
      )}

      {/* 播放选项区域 */}
      <div className="space-y-3">
        <div className="space-y-2">
          <CheckboxField
            label="播放网易云音乐歌曲"
            checked={config.enableNeteaseMusicId}
            onChange={(checked) => updateConfig('enableNeteaseMusicId', checked)}
          />
          {config.enableNeteaseMusicId && (
            <div className="flex items-center gap-2 pl-6">
              <input
                type="text"
                value={config.neteaseMusicId}
                onChange={(e) => updateConfig('neteaseMusicId', e.target.value)}
                placeholder="输入歌曲ID"
                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
                  text-white text-sm placeholder:text-white/30 focus:outline-none 
                  focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <CheckboxField
            label="指定本地音乐列表中的歌曲"
            checked={config.enableTrackIndex}
            onChange={(checked) => updateConfig('enableTrackIndex', checked)}
          />
          {config.enableTrackIndex && (
            <div className="flex items-center gap-2 pl-6">
              <input
                type="number"
                value={config.trackIndex}
                onChange={(e) => updateConfig('trackIndex', e.target.value)}
                placeholder="输入索引"
                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
                  text-white text-sm placeholder:text-white/30 focus:outline-none 
                  focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
          )}
        </div>

        <div className="pt-1 space-y-2">
          <CheckboxField
            label="打开播放器界面"
            checked={config.openPlayer}
            onChange={(checked) => updateConfig('openPlayer', checked)}
          />
          <CheckboxField
            label="自动播放"
            checked={config.autoPlay}
            onChange={(checked) => updateConfig('autoPlay', checked)}
          />
          <CheckboxField
            label="保留URL参数"
            checked={config.keepParams}
            onChange={(checked) => updateConfig('keepParams', checked)}
            hint="默认情况下，URL参数会在处理完成后自动清除"
          />
        </div>
      </div>

      {/* 高级选项区域 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-white/80 whitespace-nowrap">空降时间点</label>
          <button
            onClick={onReadCurrentTime}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-white/60 
              hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <Clock size={14} />读取时间
          </button>
          <input
            type="text"
            value={config.seekTo}
            onChange={(e) => updateConfig('seekTo', e.target.value)}
            placeholder="支持秒数(120)或时间格式(1:30)"
            className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
              text-white text-sm placeholder:text-white/30 focus:outline-none 
              focus:ring-2 focus:ring-white/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-white/80 whitespace-nowrap">播放列表来源</label>
          <button
            onClick={onReadCurrentUrl}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-white/60 
              hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <Link size={14} />读取设置
          </button>
          <input
            type="text"
            value={config.playlistOrigin}
            onChange={(e) => updateConfig('playlistOrigin', e.target.value)}
            placeholder="输入播放列表URL"
            className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg 
              text-white text-sm placeholder:text-white/30 focus:outline-none 
              focus:ring-2 focus:ring-white/20 transition-all"
          />
        </div>
      </div>

      {/* 错误提示 */}
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              {validationErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-300">{error}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 分享链接区域 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <textarea
            value={shareUrl}
            readOnly
            className="flex-1 h-16 px-3 py-2 bg-white/5 border border-white/10 rounded-lg 
              text-white text-xs font-mono placeholder:text-white/30 focus:outline-none 
              focus:ring-2 focus:ring-white/20 transition-all resize-none"
            placeholder="生成的分享链接将显示在这里..."
          />
          <button
            onClick={handleReset}
            className="flex items-center justify-center w-8 h-8 rounded-lg 
              text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="重置"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg 
            font-medium text-sm transition-all ${
              copySuccess 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
            }`}
        >
          {copySuccess ? (
            <>
              <Check size={16} />
              复制成功
            </>
          ) : (
            <>
              <Copy size={16} />
              复制链接
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
              onClick={onClose}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-[101] bg-[#1a1a1a] rounded-t-3xl shadow-2xl"
              style={{
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                maxHeight: '85vh'
              }}
              {...createStopPropagationProps()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              <div className="flex items-center justify-end px-5 py-3 border-b border-white/10">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
                >
                  <X size={18} className="text-white/60" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                {panelContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 
      rounded-xl overflow-hidden">
      <div className="h-full overflow-y-auto p-4">
        {panelContent}
      </div>
    </div>
  );
});

export default SharePanel;
