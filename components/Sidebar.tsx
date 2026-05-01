import React, { memo } from 'react';
import {
  Music, Settings, User, ListMusic, Cable, Share2
} from 'lucide-react';

type NavTab = 'songs' | 'artists' | 'netease' | 'together' | 'settings' | 'share';

interface SidebarItemProps {
  icon: React.ElementType | (() => React.ReactNode);
  label: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

const SidebarItem = memo(({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge
}: SidebarItemProps) => {
  const isCustomIconComponent = typeof Icon === 'function' && (!('length' in Icon) || Icon.length === 0);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out group relative overflow-hidden ${
        isActive
          ? 'bg-white text-black shadow-lg shadow-white/10'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
        isActive ? 'bg-black/10' : 'bg-white/5'
      }`}>
        {isCustomIconComponent ? (
          <Icon />
        ) : (
          <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        )}
      </div>
      <span className="font-medium text-sm">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
          isActive ? 'bg-black/10 text-black' : 'bg-white/10 text-white/60'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
});

const NeteaseIcon = memo(() => (
  <img src="https://s1.music.126.net/style/favicon.ico" alt="网易云" className="w-4.5 h-4.5" />
));

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  playlistCount: number;
  artistsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = memo(({
  activeTab,
  onTabChange,
  playlistCount,
  artistsCount
}) => {
  return (
    <aside className="w-64 bg-transparent flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <Music size={20} className="text-white drop-shadow-md" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white drop-shadow-md">Serene</h1>
          <p className="text-xs text-white/40 drop-shadow-sm">Music Player</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <SidebarItem
          icon={NeteaseIcon}
          label="网易云"
          isActive={activeTab === 'netease'}
          onClick={() => onTabChange('netease')}
        />
        <SidebarItem
          icon={Cable}
          label={<>一起听<span className="bg-white/10 text-white px-2 rounded-full text-xs">Beta</span></>}
          isActive={activeTab === 'together'}
          onClick={() => onTabChange('together')}
        />
        <SidebarItem
          icon={ListMusic}
          label="本地歌曲"
          isActive={activeTab === 'songs'}
          onClick={() => onTabChange('songs')}
          badge={playlistCount}
        />
        <SidebarItem
          icon={User}
          label="艺术家"
          isActive={activeTab === 'artists'}
          onClick={() => onTabChange('artists')}
          badge={artistsCount}
        />
        <SidebarItem
          icon={Settings}
          label="设置"
          isActive={activeTab === 'settings'}
          onClick={() => onTabChange('settings')}
        />
        <SidebarItem
          icon={Share2}
          label="分享"
          isActive={activeTab === 'share'}
          onClick={() => onTabChange('share')}
        />
        <img
          src="https://visitor-badge.laobi.icu/badge?page_id=domdkw.Serene-Player"
          alt="visitor badge"
          className="backdrop-blur-sm p-2"
        />
      </nav>
    </aside>
  );
});

export default Sidebar;
