// 拼音库 CDN 加载器
// 只有当用户点击歌曲后才会加载 CDN

let pinyinLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

const PINYIN_CDN_URL = 'https://jsd.onmicrosoft.cn/npm/pinyin-pro@3.27.0/dist/index.min.js';

// 声明全局类型
declare global {
  interface Window {
    pinyinPro: any;
  }
}

/**
 * 动态加载拼音库 CDN
 * 只在第一次调用时加载，后续调用返回缓存的库
 */
export async function loadPinyinLib(): Promise<any> {
  // 如果已经加载过，直接返回
  if (pinyinLib) {
    return pinyinLib;
  }

  // 如果正在加载中，返回现有的 Promise
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = new Promise((resolve, reject) => {
    // 检查是否已经存在 script 标签
    const existingScript = document.querySelector(`script[src="${PINYIN_CDN_URL}"]`);
    if (existingScript) {
      // 等待脚本加载完成
      const checkLoaded = setInterval(() => {
        if (window.pinyinPro) {
          clearInterval(checkLoaded);
          pinyinLib = window.pinyinPro;
          resolve(pinyinLib);
        }
      }, 50);
      return;
    }

    // 创建新的 script 标签
    const script = document.createElement('script');
    script.src = PINYIN_CDN_URL;
    script.async = true;

    script.onload = () => {
      if (window.pinyinPro) {
        pinyinLib = window.pinyinPro;
        resolve(pinyinLib);
      } else {
        reject(new Error('pinyin-pro library failed to load'));
      }
    };

    script.onerror = () => {
      isLoading = false;
      loadPromise = null;
      reject(new Error('Failed to load pinyin-pro from CDN'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * 获取字符串的首字母（支持中文转拼音）
 * @param str 输入字符串
 * @returns 首字母（大写）
 */
export async function getFirstLetter(str: string): Promise<string> {
  if (!str || str.length === 0) return '#';

  const firstChar = str.charAt(0);

  // 如果是英文字母，直接返回大写
  if (/^[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase();
  }

  // 如果是数字，归为 # 类
  if (/^[0-9]/.test(firstChar)) {
    return '#';
  }

  try {
    const pinyin = await loadPinyinLib();
    if (pinyin && pinyin.pinyin) {
      // 获取拼音首字母
      const py = pinyin.pinyin(firstChar, { toneType: 'none', type: 'first' });
      if (py && py.length > 0) {
        const letter = py.charAt(0).toUpperCase();
        // 确保返回的是 A-Z 的字母
        if (/^[A-Z]$/.test(letter)) {
          return letter;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to convert pinyin:', error);
  }

  // 如果转换失败，尝试使用原字符的 Unicode 范围判断
  // 对于中文字符，如果无法获取拼音，返回 #
  return '#';
}

/**
 * 批量获取首字母（优化性能）
 * @param artists 歌手名称数组
 * @returns 歌手到首字母的映射
 */
export async function getArtistsFirstLetters(artists: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // 先处理所有英文字母开头的（不需要加载拼音库）
  const needPinyin: string[] = [];

  for (const artist of artists) {
    if (!artist || artist.length === 0) {
      result[artist] = '#';
      continue;
    }

    const firstChar = artist.charAt(0);

    if (/^[a-zA-Z]/.test(firstChar)) {
      result[artist] = firstChar.toUpperCase();
    } else if (/^[0-9]/.test(firstChar)) {
      result[artist] = '#';
    } else {
      needPinyin.push(artist);
    }
  }

  // 如果有需要拼音转换的，加载拼音库并处理
  if (needPinyin.length > 0) {
    try {
      const pinyin = await loadPinyinLib();
      if (pinyin && pinyin.pinyin) {
        for (const artist of needPinyin) {
          try {
            const py = pinyin.pinyin(artist.charAt(0), { toneType: 'none', type: 'first' });
            if (py && py.length > 0) {
              const letter = py.charAt(0).toUpperCase();
              result[artist] = /^[A-Z]$/.test(letter) ? letter : '#';
            } else {
              result[artist] = '#';
            }
          } catch {
            result[artist] = '#';
          }
        }
      } else {
        // 拼音库加载失败，全部归为 #
        for (const artist of needPinyin) {
          result[artist] = '#';
        }
      }
    } catch (error) {
      console.warn('Failed to load pinyin library:', error);
      for (const artist of needPinyin) {
        result[artist] = '#';
      }
    }
  }

  return result;
}

/**
 * 同步获取首字母（不加载拼音库，仅处理英文）
 * 用于初始渲染，中文会暂时归为 #
 * @param str 输入字符串
 * @returns 首字母
 */
export function getFirstLetterSync(str: string): string {
  if (!str || str.length === 0) return '#';

  const firstChar = str.charAt(0);

  if (/^[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase();
  }

  return '#';
}

/**
 * 检查字符串是否包含中文字符
 * @param str 输入字符串
 * @returns 是否包含中文
 */
export function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}
