# useQueryParams Hook

URL 查询参数处理 Hook，用于在应用启动时解析和处理 URL 参数。

## 支持的参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `netease_music_id` | `string` | 网易云音乐歌曲 ID，自动获取歌曲信息并播放 |
| `open_player` | `boolean` | 打开音乐播放界面 (`true`/`1`) |
| `local_music` | `string` | 本地音乐 URL，匹配播放列表中的歌曲 |
| `auto_play` | `boolean` | 自动播放 (`true`/`1`) |
| `playlist_origin` | `string` | 播放列表来源 URL |
| `clear_params` | `boolean` | 处理完成后是否清除 URL 参数 (`true`/`1`) |

## 使用示例

### URL 示例

```bash
# 播放网易云音乐歌曲
https://your-site.com/?netease_music_id=123456

# 播放网易云音乐歌曲并自动打开播放器
https://your-site.com/?netease_music_id=123456&open_player=true

# 播放本地音乐
https://your-site.com/?local_music=./music/song.mp3

# 加载自定义播放列表
https://your-site.com/?playlist_origin=./customList.json

# 处理完成后清除 URL 参数
https://your-site.com/?netease_music_id=123456&clear_params=true

# 组合使用
https://your-site.com/?netease_music_id=123456&auto_play=true&open_player=true&clear_params=1
```

### 代码示例

```tsx
import { useQueryParams } from '../hooks/useQueryParams';

function App() {
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playlistReady, setPlaylistReady] = useState(false);

  const { processPendingParams, hasPendingParams } = useQueryParams({
    // 播放网易云音乐歌曲
    onPlayNeteaseMusic: (item, index) => {
      setPlaylist(prev => [...prev, item]);
      loadMusicFromUrl(item, index);
    },
    // 播放本地音乐
    onPlayLocalMusic: (item, index) => {
      loadMusicFromUrl(item, index);
    },
    // 打开播放器界面
    onOpenPlayer: () => {
      setShowFullPlayer(true);
    },
    // 加载播放列表
    onLoadPlaylist: async (url) => {
      const success = await loadPlaylistFromUrl(url);
      return success;
    },
    // 获取当前播放列表
    getPlaylist: () => playlist,
    // 设置自动播放标志
    setShouldAutoPlay,
  });

  // 当播放列表准备好后处理待处理的本地音乐参数
  useEffect(() => {
    if (playlistReady && hasPendingParams) {
      processPendingParams();
    }
  }, [playlistReady, hasPendingParams, processPendingParams]);

  return <div>...</div>;
}
```

## 处理流程

```
┌─────────────────────────────────────────────────────────────┐
│                      应用启动                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useQueryParams Hook 初始化                      │
│           解析 URL 参数并存储到 pendingParamsRef              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    参数类型判断                              │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ netease_music_id│ │   local_music   │ │ playlist_origin │
│   立即处理       │ │  需要播放列表    │ │   先加载列表     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          │                   ▼                   │
          │         ┌─────────────────┐           │
          │         │  播放列表为空？  │           │
          │         └─────────────────┘           │
          │              │       │                │
          │         是   │       │ 否             │
          │              ▼       ▼                │
          │    ┌────────────┐ ┌────────────┐      │
          │    │ 等待列表加载│ │  立即匹配   │      │
          │    └────────────┘ └────────────┘      │
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              clear_params=true ?                            │
│           是：清除 URL 参数                                  │
│           否：保留 URL 参数（默认）                           │
└─────────────────────────────────────────────────────────────┘
```

## 相关文件

- `utils/queryParams.ts` - URL 参数解析和处理工具函数
- `types.ts` - 类型定义

## 注意事项

1. **网易云音乐 ID** 会立即处理，不需要等待播放列表加载
2. **本地音乐** 需要播放列表加载完成后才能匹配，如果列表为空会等待
3. **默认不清除 URL 参数**，方便用户刷新页面重新触发或分享链接
4. 如果需要处理完成后清除参数，请添加 `clear_params=true`
