/**
 * 自定义 HTML 元素类型定义
 * 用于扩展非标准 HTML 属性
 */

import 'react';

declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

export {};
