import { lazy } from 'react';
import { AppWindow, Upload, LucideIcon } from 'lucide-react';
import { ComponentType } from 'react';

export interface PluginConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  title: string;
  description: string;
  component: ComponentType<any>;
}

export const pluginList: PluginConfig[] = [
  /**{
    id: 'pwa',
    name: 'PWA',
    icon: AppWindow,
    title: 'PWA 应用',
    description: '作为应用安装',
    component: lazy(() => import('./PWA')),
  },**/
  {
    id: 'upload',
    name: 'UPLOAD',
    icon: Upload,
    title: '上传',
    description: '上传歌曲',
    component: lazy(() => import('./upload')),
  },

];
