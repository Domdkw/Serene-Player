export interface FontConfig {
  value: string;
  label: string;
  family: string;
  url: string;
}

export const FONT_CONFIGS: FontConfig[] = [
  { value: 'default', label: '系统字体', family: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"', url: '' },
  { value: 'Smiley Sans Oblique', label: '得意黑', family: '"Smiley Sans Oblique", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', url: 'https://chinese-fonts-cdn.deno.dev/packages/dyh/dist/SmileySans-Oblique/result.css' },
  { value: 'source-han-sans', label: '思源黑体', family: '"Noto Sans SC", "Source Han Sans CN", "思源黑体", sans-serif', url: 'https://fonts.font.im/css?family=Noto+Sans+SC' },
  { value: 'Huiwen-mincho', label: '汇文明朝体', family: '"Huiwen-mincho", serif', url: 'https://chinese-fonts-cdn.deno.dev/packages/hwmct/dist/汇文明朝体/result.css' },
  { value: 'Ubuntu', label: 'Ubuntu', family: 'Ubuntu, sans-serif', url: 'https://fonts.font.im/css?family=Ubuntu' },
  { value: 'Dancing Script', label: 'Dancing Script', family: 'Dancing Script, cursive', url: 'https://fonts.font.im/css?family=Dancing+Script' },
  { value: 'Caveat', label: 'Caveat', family: 'Caveat, cursive', url: 'https://fonts.font.im/css?family=Caveat' },
  { value: 'Kalam', label: 'Kalam', family: 'Kalam, cursive', url: 'https://fonts.font.im/css?family=Kalam' }
];

export const getFontFamily = (fontValue: string): string => {
  const font = FONT_CONFIGS.find(f => f.value === fontValue);
  return font ? font.family : 'sans-serif';
};

export const getFontUrl = (fontValue: string): string => {
  const font = FONT_CONFIGS.find(f => f.value === fontValue);
  return font ? font.url : '';
};

export const getFontLabel = (fontValue: string): string => {
  const font = FONT_CONFIGS.find(f => f.value === fontValue);
  return font ? font.label : '默认字体';
};