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
      className="fixed bottom-20 right-4 z-[66] w-72 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="space-y-5">
        <h3 className="text-xs font-black tracking-[0.3em] text-white/60 uppercase mb-4">Settings</h3>
        
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">分块拉取片数</label>
          <div className="flex gap-2">
            {[1, 4, 8, 16].map((value) => (
              <button
                key={value}
                onClick={() => {
                  onChunkCountChange(value);
                  localStorage.setItem('chunkCount', value.toString());
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  chunkCount === value 
                    ? 'bg-white text-black' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">歌词字体粗细</label>
          <div className="flex gap-2">
            {[
              { value: 'light', label: '细' },
              { value: 'medium', label: '中' },
              { value: 'bold', label: '粗' }
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  onFontWeightChange(item.value);
                  localStorage.setItem('fontWeight', item.value);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  fontWeight === item.value 
                    ? 'bg-white text-black' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">歌词文本间距</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={letterSpacing}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              onLetterSpacingChange(value);
              localStorage.setItem('letterSpacing', value.toString());
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">歌词行间距</label>
          <input
            type="number"
            min="1"
            max="3"
            step="0.1"
            value={lineHeight}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              onLineHeightChange(value);
              localStorage.setItem('lineHeight', value.toString());
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              localStorage.clear();
              console.log('localStorage cleared');
            }}
            className="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-red-400 hover:bg-red-500/20 border border-red-500/20"
          >
            还原设置
          </button>
          <button
            onClick={() => {
              console.log('localStorage contents:', localStorage);
            }}
            className="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
          >
            打印LS
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;