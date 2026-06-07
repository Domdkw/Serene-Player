import React, { useState, memo, Suspense } from 'react';
import { ChevronRight } from 'lucide-react';
import { MobileBottomSheet } from '../layout';
import { pluginList, PluginConfig } from '../plugins';
import { PlaylistItem } from '@/types';

interface PluginsPanelProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  loadMusicFromUrl?: (item: PlaylistItem, index: number) => void;
}

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

/**
 * 插件卡片组件
 */
const PluginCard = memo(({ 
  plugin,
  onClick,
  isMobile = false,
}: { 
  plugin: PluginConfig;
  onClick: () => void;
  isMobile?: boolean;
}) => {
  const IconComponent = plugin.icon;
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left relative overflow-hidden
        ${isMobile 
          ? 'bg-white/[0.02] p-4' 
          : 'bg-white/[0.03] p-6 hover:border-white/[0.15] hover:bg-white/[0.05]'
        }
      `}
    >
      <div className={`flex items-center gap-4 ${isMobile ? 'gap-3' : ''}`}>
        <div className={`
          flex-shrink-0 flex items-center justify-center
          ${isMobile ? 'w-12 h-12' : 'w-14 h-14'}
        `}>
          <IconComponent size={isMobile ? 22 : 24} className="text-white/80" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold text-white/90 ${isMobile ? 'text-base' : 'text-lg'}`}>
              {plugin.title}
            </h3>
          </div>
          <p className={`text-white/50 leading-relaxed ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {plugin.description}
          </p>
        </div>

        <ChevronRight size={20} className="text-white/30 flex-shrink-0" />
      </div>
    </button>
  );
});

/**
 * 插件面板组件
 */
const PluginsPanel: React.FC<PluginsPanelProps> = ({ 
  isMobile = false, 
  isOpen = false, 
  onClose,
  loadMusicFromUrl,
}) => {
  const [activePlugin, setActivePlugin] = useState<string | null>(null);

  const handlePluginClick = (pluginId: string) => {
    setActivePlugin(pluginId);
  };

  const handleBack = () => {
    setActivePlugin(null);
  };

  const renderPluginContent = () => {
    if (activePlugin) {
      const plugin = pluginList.find(p => p.id === activePlugin);
      if (plugin) {
        const PluginComponent = plugin.component;
        return (
          <Suspense fallback={<LoadingFallback />}>
            <PluginComponent 
            loadMusicFromUrl={loadMusicFromUrl}
            isMobile={isMobile} onBack={handleBack}
            />
          </Suspense>
        );
      }
    }

    return (
      <div className={`${isMobile ? 'px-4 py-2' : 'p-6'}`}>
        <div className={`
          grid gap-4
          ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}
        `}>
          {pluginList.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onClick={() => handlePluginClick(plugin.id)}
              isMobile={isMobile}
            />
          ))}
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <MobileBottomSheet isOpen={isOpen} onClose={onClose}>
        {renderPluginContent()}
      </MobileBottomSheet>
    );
  }

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      {renderPluginContent()}
    </div>
  );
};

export default PluginsPanel;
