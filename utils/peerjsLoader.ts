/**
 * PeerJS CDN 动态加载器
 * 采用动态加载方式，只在需要时才加载 PeerJS 库
 */

let peerjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

// PeerJS 最新稳定版 CDN 地址
const PEERJS_CDN_URL = 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';

// 声明全局类型
declare global {
  interface Window {
    Peer: any;
  }
}

/**
 * 动态加载 PeerJS 库 CDN
 * 只在第一次调用时加载，后续调用返回缓存的库
 * @returns PeerJS 库对象
 */
export async function loadPeerJSLib(): Promise<any> {
  // 如果已经加载过，直接返回
  if (peerjsLib) {
    return peerjsLib;
  }

  // 如果正在加载中，返回现有的 Promise
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = new Promise((resolve, reject) => {
    // 检查是否已经存在 script 标签
    const existingScript = document.querySelector(`script[src="${PEERJS_CDN_URL}"]`);
    if (existingScript) {
      // 等待脚本加载完成
      const checkLoaded = setInterval(() => {
        if (window.Peer) {
          clearInterval(checkLoaded);
          peerjsLib = window.Peer;
          resolve(peerjsLib);
        }
      }, 50);
      return;
    }

    // 创建新的 script 标签
    const script = document.createElement('script');
    script.src = PEERJS_CDN_URL;
    script.async = true;

    script.onload = () => {
      if (window.Peer) {
        peerjsLib = window.Peer;
        resolve(peerjsLib);
      } else {
        reject(new Error('PeerJS library failed to load'));
      }
    };

    script.onerror = () => {
      isLoading = false;
      loadPromise = null;
      reject(new Error('Failed to load PeerJS from CDN'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * 检查 PeerJS 是否已加载
 * @returns 是否已加载
 */
export function isPeerJSLoaded(): boolean {
  return !!peerjsLib;
}
