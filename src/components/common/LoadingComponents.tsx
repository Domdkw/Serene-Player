import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface ShimmerLoadingBarProps {
  progress: number;
}

export const ShimmerLoadingBar: React.FC<ShimmerLoadingBarProps> = memo(({ progress }) => (
  <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
    <div className="relative h-1.5 md:h-2 bg-white/5 overflow-hidden shimmer-effect">
      <div className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${progress}%` }} />
    </div>
  </div>
));

interface FolderLoadingIndicatorProps {
  name: string;
  progress: number;
}

export const FolderLoadingIndicator: React.FC<FolderLoadingIndicatorProps> = memo(({ name, progress }) => (
  <div className="mb-6 p-4 bg-transparent rounded-2xl border border-white/[0.05] backdrop-blur-sm">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <Loader2 size={16} className="text-white/60 animate-spin" />
        </div>
        <div>
          <span className="text-sm text-white font-medium">Loading {name}</span>
          <span className="text-xs text-white/40 ml-2">{progress}%</span>
        </div>
      </div>
    </div>
    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full relative overflow-hidden rounded-full transition-all duration-300"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
      </div>
    </div>
  </div>
));

interface AnimatedContentProps {
  children: React.ReactNode;
  activeTab: string;
  className?: string;
}

export const AnimatedContent: React.FC<AnimatedContentProps> = memo(({
  children,
  activeTab,
  className = ''
}) => {
  const [displayTab, setDisplayTab] = React.useState(activeTab);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (displayTab !== activeTab) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayTab(activeTab);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, displayTab]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      } ${className}`}
    >
      {children}
    </div>
  );
});
