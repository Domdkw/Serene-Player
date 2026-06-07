import { useState, useEffect, useCallback } from 'react';
import { Download, Check, AppWindow, ArrowLeft } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWA_INSTALLED_KEY = 'serene-pwa-installed';

/**
 * PWA 安装状态管理 hook
 */
export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches
      || (window.navigator as any).standalone === true
      || document.referrer.includes('android-app://');

    if (isStandalone || localStorage.getItem(PWA_INSTALLED_KEY) === 'true') {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      setIsInstalled(false);
      localStorage.removeItem(PWA_INSTALLED_KEY);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.setItem(PWA_INSTALLED_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.setItem(PWA_INSTALLED_KEY, 'true');
      return true;
    }

    return false;
  }, [deferredPrompt]);

  return {
    isInstallable,
    isInstalled,
    installApp,
  };
}

interface PWAPluginProps {
  isMobile?: boolean;
  onBack?: () => void;
}

/**
 * PWA 插件详细配置组件
 */
const PWAPlugin: React.FC<PWAPluginProps> = ({ isMobile = false, onBack }) => {
  const { isInstallable, isInstalled, installApp } = usePWA();

  return (
    <div className={`${isMobile ? 'px-4 py-2' : 'p-6'}`}>
      {onBack && (
        <button
          onClick={onBack}
          className={`
            flex items-center gap-2 mb-6 transition-all duration-200
            ${isMobile ? 'text-white/60 active:text-white/90' : 'text-white/50 hover:text-white/80'}
          `}
        >
          <ArrowLeft size={20} />
          <span className={isMobile ? 'text-sm' : 'text-base'}>返回插件列表</span>
        </button>
      )}

      <div className={`
        relative overflow-hidden rounded-2xl border transition-all duration-300
        ${isMobile 
          ? 'bg-white/[0.02] border-white/[0.06] p-5' 
          : 'bg-white/[0.03] border-white/[0.08] p-8'
        }
      `}>
        <div className="flex items-start gap-4 mb-6">
          <div className={`
            flex-shrink-0 rounded-xl bg-gradient-to-br from-white/10 to-white/5 
            flex items-center justify-center border border-white/10
            ${isMobile ? 'w-14 h-14' : 'w-16 h-16'}
          `}>
            <AppWindow size={isMobile ? 26 : 28} className="text-white/80" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className={`font-bold text-white/90 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                PWA 应用
              </h2>
              {isInstalled && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                  <Check size={12} className="text-green-400" />
                  <span className="text-xs font-medium text-green-400">已安装</span>
                </div>
              )}
            </div>
            <p className={`text-white/50 leading-relaxed ${isMobile ? 'text-sm' : 'text-base'}`}>
              将 Serene Player 安装到您的设备，享受原生应用般的体验
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {!isInstalled && isInstallable && (
            <button
              onClick={installApp}
              className={`
                w-full rounded-xl font-medium transition-all duration-200
                flex items-center justify-center gap-2
                ${isMobile 
                  ? 'py-4 text-base bg-white text-black active:scale-[0.98]' 
                  : 'py-3.5 text-base bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }
              `}
            >
              <Download size={18} />
              <span>安装应用到设备</span>
            </button>
          )}

          {!isInstalled && !isInstallable && (
            <div className={`
              w-full rounded-xl text-center border border-white/[0.06]
              ${isMobile ? 'py-4 text-sm text-white/30 bg-white/[0.01]' : 'py-3.5 text-sm text-white/40 bg-white/[0.02]'}
            `}>
              <p className="mb-1">当前浏览器不支持安装 PWA</p>
              <p className="text-xs text-white/20">请使用 Chrome、Edge 或 Safari 等现代浏览器</p>
            </div>
          )}

          {isInstalled && (
            <div className={`
              w-full rounded-xl text-center border border-green-500/20
              ${isMobile ? 'py-4 text-sm bg-green-500/10' : 'py-3.5 text-sm bg-green-500/10'}
            `}>
              <div className="flex items-center justify-center gap-2 text-green-400">
                <Check size={18} />
                <span className="font-medium">应用已成功安装</span>
              </div>
              <p className="text-xs text-green-400/60 mt-1">您可以从系统应用列表中打开应用</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PWAPlugin;
