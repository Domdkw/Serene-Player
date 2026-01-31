import React from 'react';
import { Settings } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  chunkCount: number;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  onChunkCountChange: (value: number) => void;
  onFontWeightChange: (value: string) => void;
  onLetterSpacingChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  chunkCount,
  fontWeight,
  letterSpacing,
  lineHeight,
  onChunkCountChange,
  onFontWeightChange,
  onLetterSpacingChange,
  onLineHeightChange
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-settings-panel
      className="fixed bottom-20 right-4 z-[66] w-80 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="space-y-6">
        <h3 className="text-xs font-black tracking-[0.3em] text-white/60 uppercase mb-4">Settings</h3>

        {/* Chunk Count */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
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
                className={`py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95 ${
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
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
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
                className={`py-2.5 text-xs rounded-xl transition-all active:scale-95 ${
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
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
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
            <span className="text-xs font-mono text-white/60 w-12 text-right">
              {letterSpacing}px
            </span>
          </div>
        </div>

        {/* Line Height */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
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
            <span className="text-xs font-mono text-white/60 w-12 text-right">
              {lineHeight}
            </span>
          </div>
        </div>

        {/* Preview Section */}
        <div className="space-y-3 pt-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            预览效果
          </label>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p
              className="text-center text-white/80 transition-all duration-300"
              style={{
                fontWeight: fontWeight === 'light' ? '300' : fontWeight === 'medium' ? '500' : '700',
                letterSpacing: `${letterSpacing}px`,
                lineHeight: lineHeight
              }}
            >
              这是一行示例歌词
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <button
            onClick={() => {
              localStorage.clear();
              onChunkCountChange(4);
              onFontWeightChange('medium');
              onLetterSpacingChange(0.5);
              onLineHeightChange(1.5);
            }}
            className="py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95 text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
          >
            恢复默认
          </button>
          <button
            onClick={() => {
              console.log('localStorage contents:', localStorage);
            }}
            className="py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
          >
            调试信息
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;