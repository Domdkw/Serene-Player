/**
 * 空降时间解析结果
 */
export interface SeekTimeResult {
  /** 是否解析成功 */
  success: boolean;
  /** 解析后的时间（秒） */
  timeInSeconds?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 将时间字符串解析为秒数
 * 支持以下格式：
 * - 纯数字秒数：60, 90.5
 * - 分:秒格式：1:30, 2:45
 * - 时:分:秒格式：1:30:45
 * 
 * @param timeStr - 时间字符串
 * @returns 解析结果
 */
export function parseSeekTime(timeStr: string): SeekTimeResult {
  if (!timeStr || typeof timeStr !== 'string') {
    return {
      success: false,
      error: '时间字符串不能为空'
    };
  }

  const trimmed = timeStr.trim();

  if (trimmed.includes(':')) {
    return parseTimeFormat(trimmed);
  }

  return parseSecondsFormat(trimmed);
}

/**
 * 解析纯秒数格式
 * @param str - 秒数字符串
 * @returns 解析结果
 */
function parseSecondsFormat(str: string): SeekTimeResult {
  const seconds = parseFloat(str);

  if (isNaN(seconds)) {
    return {
      success: false,
      error: '无效的秒数格式'
    };
  }

  if (seconds < 0) {
    return {
      success: false,
      error: '时间不能为负数'
    };
  }

  return {
    success: true,
    timeInSeconds: seconds
  };
}

/**
 * 解析时间格式（mm:ss 或 hh:mm:ss）
 * @param str - 时间字符串
 * @returns 解析结果
 */
function parseTimeFormat(str: string): SeekTimeResult {
  const parts = str.split(':');

  if (parts.length < 2 || parts.length > 3) {
    return {
      success: false,
      error: '时间格式无效，支持 mm:ss 或 hh:mm:ss'
    };
  }

  const numbers: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    const num = parseFloat(parts[i]);
    if (isNaN(num)) {
      return {
        success: false,
        error: `时间部分 "${parts[i]}" 不是有效数字`
      };
    }
    if (num < 0) {
      return {
        success: false,
        error: '时间不能为负数'
      };
    }
    if (i > 0 && num >= 60) {
      return {
        success: false,
        error: '分钟和秒数必须小于 60'
      };
    }
    numbers.push(num);
  }

  let totalSeconds: number;

  if (numbers.length === 2) {
    totalSeconds = numbers[0] * 60 + numbers[1];
  } else {
    totalSeconds = numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
  }

  return {
    success: true,
    timeInSeconds: totalSeconds
  };
}

/**
 * 将秒数格式化为时间字符串
 * @param seconds - 秒数
 * @param format - 输出格式：'auto' | 'mm:ss' | 'hh:mm:ss'
 * @returns 格式化后的时间字符串
 */
export function formatSeekTime(seconds: number, format: 'auto' | 'mm:ss' | 'hh:mm:ss' = 'auto'): string {
  if (seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const padZero = (n: number): string => n.toString().padStart(2, '0');

  if (format === 'hh:mm:ss' || (format === 'auto' && hours > 0)) {
    return `${hours}:${padZero(minutes)}:${padZero(secs)}`;
  }

  return `${minutes}:${padZero(secs)}`;
}

/**
 * 验证时间字符串是否有效
 * @param timeStr - 时间字符串
 * @returns 是否有效
 */
export function isValidSeekTime(timeStr: string): boolean {
  return parseSeekTime(timeStr).success;
}
