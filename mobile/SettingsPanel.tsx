import React, { useEffect, useState } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { FONT_CONFIGS, getFontFamily } from '../utils/fontUtils';
import { createStopPropagationProps } from '../utils/swipeUtils';

interface SettingsPanelProps {
  isOpen: boolean;
  chunkCount: number;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  selectedFont: string;
  onChunkCountChange: (value: number) => void;
  onFontWeightChange: (value: string) => void;
  onLetterSpacingChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  onFontChange: (value: string) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  chunkCount,
  fontWeight,
  letterSpacing,
  lineHeight,
  selectedFont,
  onChunkCountChange,
  onFontWeightChange,
  onLetterSpacingChange,
  onLineHeightChange,
  onFontChange,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Settings Panel - Bottom Sheet Style */}
      <div
        data-settings-panel
        className={`fixed left-0 right-0 bottom-0 z-[101] bg-[#1a1a1a] rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          maxHeight: '85vh'
        }}
        {...createStopPropagationProps()}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-white/60" />
            <h3 className="text-sm font-bold tracking-wider text-white/80 uppercase">设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>

        {/* Settings Content */}
        <div className="p-5 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {/* Chunk Count */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              分块拉取片数
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 4, 8, 16].map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    onChunkCountChange(value);
                    localStorage.setItem('chunkCount', value.toString());
                  }}
                  className={`py-3 text-sm font-bold rounded-xl transition-all active:scale-95 ${
                    chunkCount === value
                      ? 'bg-white text-black shadow-lg shadow-white/20'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/30">数值越大加载越快，但可能增加服务器压力</p>
          </div>

          {/* Font Weight */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              歌词字体粗细
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'light', label: '细体', weight: 'font-light' },
                { value: 'medium', label: '常规', weight: 'font-medium' },
                { value: 'bold', label: '粗体', weight: 'font-bold' }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    onFontWeightChange(item.value);
                    localStorage.setItem('fontWeight', item.value);
                  }}
                  className={`py-3 text-sm rounded-xl transition-all active:scale-95 ${
                    fontWeight === item.value
                      ? 'bg-white text-black shadow-lg shadow-white/20'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  <span className={item.weight}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Letter Spacing */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              歌词字间距
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={letterSpacing}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  onLetterSpacingChange(value);
                  localStorage.setItem('letterSpacing', value.toString());
                }}
                className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.6) ${(letterSpacing / 10) * 100}%, rgba(255,255,255,0.1) ${(letterSpacing / 10) * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <span className="text-sm font-mono text-white/60 w-12 text-right">
                {letterSpacing}px
              </span>
            </div>
          </div>

          {/* Line Height */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              歌词行间距
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={lineHeight}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  onLineHeightChange(value);
                  localStorage.setItem('lineHeight', value.toString());
                }}
                className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.6) ${((lineHeight - 1) / 2) * 100}%, rgba(255,255,255,0.1) ${((lineHeight - 1) / 2) * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <span className="text-sm font-mono text-white/60 w-12 text-right">
                {lineHeight}
              </span>
            </div>
          </div>

          {/* Font Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              歌词字体
            </label>
            <select
              value={selectedFont}
              onChange={(e) => {
                onFontChange(e.target.value);
                localStorage.setItem('selectedFont', e.target.value);
              }}
              className="w-full py-3 px-4 text-sm bg-white/10 text-white rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
              style={{ fontFamily: getFontFamily(selectedFont) }}
            >
              {FONT_CONFIGS.map((font) => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.family }}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preview Section */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
              预览效果
            </label>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p
                className="text-center text-white/80 transition-all duration-300"
                style={{
                fontWeight: fontWeight === 'light' ? '300' : fontWeight === 'medium' ? '500' : '700',
                letterSpacing: `${letterSpacing}px`,
                lineHeight: lineHeight,
                fontFamily: getFontFamily(selectedFont)
              }}
              >
                这是一行示例歌词
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
            <button
              onClick={() => {
                localStorage.clear();
                onChunkCountChange(4);
                onFontWeightChange('medium');
                onLetterSpacingChange(0.5);
                onLineHeightChange(1.5);
              }}
              className="py-3 text-xs font-bold rounded-xl transition-all active:scale-95 text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
            >
              恢复默认
            </button>
            <button
              onClick={() => {
                console.log('localStorage contents:', localStorage);
              }}
              className="py-3 text-xs font-bold rounded-xl transition-all active:scale-95 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
            >
              调试信息
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
