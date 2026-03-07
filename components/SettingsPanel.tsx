import React, { memo } from 'react';
import { 
  HardDrive, 
  Type, 
  Languages,
  RotateCcw,
  Bug,
  Music,
  Palette,
  Sparkles,
  Github,
  Globe,
  Image
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
  streamingMode: boolean;
  setStreamingMode: (value: boolean) => void;
  backgroundRotate: boolean;
  setBackgroundRotate: (value: boolean) => void;
}

// 设置分组标题
const SectionTitle = memo(({ icon: Icon, title, subtitle }: { 
  icon: React.ElementType; 
  title: string; 
  subtitle?: string;
}) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10">
      <Icon size={18} className="text-white/70" />
    </div>
    <div>
      <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
    </div>
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
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          value === option
            ? 'bg-white text-black shadow-lg shadow-white/10'
            : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.08] hover:text-white/70 border border-white/[0.06]'
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
      <div className="flex-1 relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.6) ${percentage}%, rgba(255,255,255,0.08) ${percentage}%, rgba(255,255,255,0.08) 100%)`
          }}
        />
      </div>
      <span className="text-sm font-mono text-white/50 w-14 text-right tabular-nums">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  );
});

// 开关组件
const ToggleSwitch = memo(({ 
  checked, 
  onChange,
  label
}: { 
  checked: boolean; 
  onChange: (value: boolean) => void;
  label?: string;
}) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
      checked ? 'bg-white/20' : 'bg-white/10'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
        checked ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
));

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
  setShowTranslation,
  streamingMode,
  setStreamingMode,
  backgroundRotate,
  setBackgroundRotate
}) => {
  const handleReset = () => {
    localStorage.clear();
    setChunkCount(4);
    setFontWeight('medium');
    setLetterSpacing(0.5);
    setLineHeight(1.5);
    setSelectedFont('default');
    setShowTranslation(true);
    setStreamingMode(false);
    setBackgroundRotate(false);
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
    <div className="space-y-5 max-w-3xl">
      {/* 背景设置 */}
      <section className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] backdrop-blur-sm">
        <SectionTitle
          icon={Image}
          title="背景设置"
          subtitle="封面背景效果配置"
        />
        <div className="space-y-4 pl-12">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-white/60">背景封面旋转</span>
              <p className="text-[13px] text-white/30 mt-0.5">开启后背景封面会缓慢旋转</p>
            </div>
            <ToggleSwitch
              checked={backgroundRotate}
              onChange={(value) => {
                setBackgroundRotate(value);
                localStorage.setItem('backgroundRotate', value.toString());
              }}
            />
          </div>
        </div>
      </section>

      {/* 歌词显示设置 */}
      <section className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] backdrop-blur-sm">
        <SectionTitle
          icon={Type}
          title="歌词样式"
          subtitle="字体、间距和显示选项"
        />
        <div className="space-y-5 pl-12">
          {/* 字体粗细 */}
          <div>
            <label className="text-xs text-white/40 mb-2 block">字体粗细</label>
            <div className="flex gap-2">
              {fontWeightOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFontWeight(option.value);
                    localStorage.setItem('fontWeight', option.value);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    fontWeight === option.value
                      ? 'bg-white text-black shadow-lg shadow-white/10'
                      : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.08] hover:text-white/70 border border-white/[0.06]'
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
          </div>

          {/* 字间距 */}
          <div>
            <label className="text-xs text-white/40 mb-2 block">字间距</label>
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
          </div>

          {/* 行间距 */}
          <div>
            <label className="text-xs text-white/40 mb-2 block">行间距</label>
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
          </div>

          {/* 字体选择 */}
          <div>
            <label className="text-xs text-white/40 mb-2 block">字体</label>
            <div className="relative">
              <select
                value={selectedFont}
                onChange={(e) => {
                  setSelectedFont(e.target.value);
                  localStorage.setItem('selectedFont', e.target.value);
                }}
                className="w-full py-3 px-4 text-sm bg-white/[0.05] text-white/80 rounded-xl border border-white/[0.10] focus:outline-none focus:border-white/30 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/[0.1] transition-all cursor-pointer appearance-none hover:border-white/[0.15] hover:bg-white/[0.06]"
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
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-white/40">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* 显示翻译 */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-white/60">显示翻译</span>
            <ToggleSwitch
              checked={showTranslation}
              onChange={(value) => {
                setShowTranslation(value);
                localStorage.setItem('showTranslation', value.toString());
              }}
            />
          </div>
        </div>
      </section>

      {/* 播放设置 */}
      <section className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] backdrop-blur-sm">
        <SectionTitle
          icon={HardDrive}
          title="播放设置"
          subtitle="音频加载和播放相关配置"
        />
        <div className="space-y-4 pl-12">
          <div>
            <label className="text-xs text-white/40 mb-2 block">分块拉取片数</label>
            <OptionButtonGroup
              options={[1, 4, 8, 16]}
              value={chunkCount}
              onChange={(value) => {
                setChunkCount(value);
                localStorage.setItem('chunkCount', value.toString());
              }}
            />
            <p className="text-[13px] text-white/30 mt-2">数值越大<u>不一定</u>加载越快，但可能增加服务器压力</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-sm text-white/60">开发者：流媒体播放模式 （不支持封面背景）</span>
              <p className="text-[13px] text-white/30 mt-0.5">开启后直接流式播放，关闭则先下载完整文件</p>
            </div>
            <ToggleSwitch
              checked={streamingMode}
              onChange={(value) => {
                setStreamingMode(value);
                localStorage.setItem('streamingMode', value.toString());
              }}
            />
          </div>
        </div>
      </section>

      {/* 预览 */}
      <section className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] backdrop-blur-sm">
        <SectionTitle
          icon={Sparkles}
          title="预览效果"
        />
        <div className="pl-12">
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
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
        </div>
      </section>

      {/* 关于 */}
      <section className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] backdrop-blur-sm">
        <SectionTitle
          icon={Music}
          title="关于"
          subtitle="项目链接"
        />
        <div className="pl-12 space-y-3">
          <a
            href="https://github.com/Domdkw/Serene-Player"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group"
          >
            <Github size={18} className="text-white/60 group-hover:text-white/90" />
            <span className="text-sm text-white/60 group-hover:text-white/90">GitHub</span>
          </a>
          <a
            href="https://gitee.com/Domdkw/serene-player"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group"
          >
            <Globe size={18} className="text-white/60 group-hover:text-white/90" />
            <span className="text-sm text-white/60 group-hover:text-white/90">Gitee</span>
          </a>
        </div>
      </section>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2 pl-12">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] text-white/50 bg-red-500/10 text-red-400 transition-all duration-200 text-sm font-medium border border-red-500/20"
        >
          <RotateCcw size={14} />
          恢复默认
        </button>
        <button
          onClick={handleDebug}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] text-white/50 bg-blue-500/10 text-blue-400 transition-all duration-200 text-sm font-medium border border-blue-500/20"
        >
          <Bug size={14} />
          调试信息
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
