import React, { memo } from 'react';
import { 
  HardDrive, 
  Type, 
  AlignCenter, 
  ArrowUpDown, 
  Languages,
  RotateCcw,
  Bug,
  Music
} from 'lucide-react';
import { FONT_CONFIGS, getFontFamily } from '../utils/fontUtils';

interface SettingsPanelProps {
  chunkCount: number;
  setChunkCount: (value: number) => void;
  fontWeight: string;
  setFontWeight: (value: string) => void;
  letterSpacing: number;
  setLetterSpacing: (value: number) => void;
  lineHeight: number;
  setLineHeight: (value: number) => void;
  selectedFont: string;
  setSelectedFont: (value: string) => void;
  showTranslation: boolean;
  setShowTranslation: (value: boolean) => void;
}

// 设置卡片组件
const SettingCard = memo(({ 
  icon: Icon, 
  title, 
  description, 
  children 
}: { 
  icon: React.ElementType; 
  title: string; 
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white/[0.03] rounded-2xl border border-white/[0.05] p-5 hover:bg-white/[0.04] transition-colors duration-200">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon size={18} className="text-white/60" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
    </div>
    {children}
  </div>
));

// 选项按钮组
const OptionButtonGroup = memo(<T extends string | number>({ 
  options, 
  value, 
  onChange,
  getLabel
}: { 
  options: T[]; 
  value: T; 
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
}) => (
  <div className="flex gap-2 flex-wrap">
    {options.map((option) => (
      <button
        key={option}
        onClick={() => onChange(option)}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          value === option
            ? 'bg-white text-black shadow-lg shadow-white/10'
            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        {getLabel ? getLabel(option) : option}
      </button>
    ))}
  </div>
));

// 滑块组件
const SliderControl = memo(({ 
  value, 
  min, 
  max, 
  step, 
  onChange,
  formatValue
}: { 
  value: number; 
  min: number; 
  max: number; 
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer relative"
        style={{
          background: `linear-gradient(to right, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.5) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`
        }}
      />
      <span className="text-sm font-mono text-white/60 w-16 text-right">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  );
});

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  chunkCount,
  setChunkCount,
  fontWeight,
  setFontWeight,
  letterSpacing,
  setLetterSpacing,
  lineHeight,
  setLineHeight,
  selectedFont,
  setSelectedFont,
  showTranslation,
  setShowTranslation
}) => {
  const handleReset = () => {
    localStorage.clear();
    setChunkCount(4);
    setFontWeight('medium');
    setLetterSpacing(0.5);
    setLineHeight(1.5);
    setSelectedFont('default');
    setShowTranslation(true);
  };

  const handleDebug = () => {
    console.log('localStorage contents:', localStorage);
  };

  const fontWeightOptions = [
    { value: 'light', label: '细体' },
    { value: 'medium', label: '常规' },
    { value: 'bold', label: '粗体' }
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 播放设置 */}
      <SettingCard 
        icon={HardDrive} 
        title="分块拉取设置" 
        description="数值越大加载越快，但可能增加服务器压力"
      >
        <OptionButtonGroup
          options={[1, 4, 8, 16]}
          value={chunkCount}
          onChange={(value) => {
            setChunkCount(value);
            localStorage.setItem('chunkCount', value.toString());
          }}
        />
      </SettingCard>

      {/* 歌词显示设置 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingCard 
          icon={Type} 
          title="字体粗细" 
        >
          <div className="flex gap-2">
            {fontWeightOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setFontWeight(option.value);
                  localStorage.setItem('fontWeight', option.value);
                }}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  fontWeight === option.value
                    ? 'bg-white text-black shadow-lg shadow-white/10'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={
                  option.value === 'light' ? 'font-light' : 
                  option.value === 'medium' ? 'font-medium' : 'font-bold'
                }>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </SettingCard>

        <SettingCard 
          icon={Languages} 
          title="显示翻译" 
        >
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowTranslation(true);
                localStorage.setItem('showTranslation', 'true');
              }}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                showTranslation
                  ? 'bg-white text-black shadow-lg shadow-white/10'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              显示
            </button>
            <button
              onClick={() => {
                setShowTranslation(false);
                localStorage.setItem('showTranslation', 'false');
              }}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                !showTranslation
                  ? 'bg-white text-black shadow-lg shadow-white/10'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              隐藏
            </button>
          </div>
        </SettingCard>
      </div>

      {/* 字间距和行间距 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingCard 
          icon={AlignCenter} 
          title="字间距" 
        >
          <SliderControl
            value={letterSpacing}
            min={0}
            max={10}
            step={0.5}
            onChange={(value) => {
              setLetterSpacing(value);
              localStorage.setItem('letterSpacing', value.toString());
            }}
            formatValue={(v) => `${v}px`}
          />
        </SettingCard>

        <SettingCard 
          icon={ArrowUpDown} 
          title="行间距" 
        >
          <SliderControl
            value={lineHeight}
            min={1}
            max={3}
            step={0.1}
            onChange={(value) => {
              setLineHeight(value);
              localStorage.setItem('lineHeight', value.toString());
            }}
          />
        </SettingCard>
      </div>

      {/* 字体选择 */}
      <SettingCard 
        icon={Music} 
        title="歌词字体" 
      >
        <select
          value={selectedFont}
          onChange={(e) => {
            setSelectedFont(e.target.value);
            localStorage.setItem('selectedFont', e.target.value);
          }}
          className="w-full py-3 px-4 text-sm bg-white/5 text-white rounded-xl border border-white/10 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-colors"
          style={{ fontFamily: getFontFamily(selectedFont) }}
        >
          {FONT_CONFIGS.map((font) => (
            <option 
              key={font.value} 
              value={font.value} 
              style={{ fontFamily: font.family, backgroundColor: '#1a1a1f' }}
            >
              {font.label}
            </option>
          ))}
        </select>
      </SettingCard>

      {/* 预览 */}
      <SettingCard 
        icon={Type} 
        title="预览效果" 
      >
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
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
          {showTranslation && (
            <p className="text-center text-white/40 text-sm mt-2">
              This is a sample lyric line
            </p>
          )}
        </div>
      </SettingCard>

      {/* 操作按钮 */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-200 text-sm font-medium"
        >
          <RotateCcw size={16} />
          恢复默认
        </button>
        <button
          onClick={handleDebug}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all duration-200 text-sm font-medium"
        >
          <Bug size={16} />
          调试信息
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
