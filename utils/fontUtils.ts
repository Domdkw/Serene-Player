export interface FontConfig {
  value: string;
  label: string;
  family: string;
  url: string;
}

export const FONT_CONFIGS: FontConfig[] = [
  { value: 'default', label: '默认字体', family: '"得意黑", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', url: '' },
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