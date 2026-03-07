# Serene Player - 宁静播放器

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="./屏幕截图 2026-01-02 003355.png" />
</div>

基于 React 和 TypeScript 构建的现代化优雅音乐播放器。由 Gemini 3 Flash + TRAE + Hand 开发
#### 体验预览版：[DEV](https://github.com/Domdkw/Serene-Player/tree/dev)

<div align="center">
<img src="https://visitor-badge.laobi.icu/badge?page_id=domdkw.Serene-Player" alt="visitor badge" />
<img src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
<img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
</div>

## 功能特性

- 🎵 美观简约的用户界面，支持 3D 封面效果
- 🎨 流畅的动画过渡效果
- 🎧 完整播放控制（播放/暂停、切歌、音量调节、进度拖拽）
- 📋 播放列表管理，支持文件夹嵌套
- 🔗 支持外链歌单导入
- 🔄 多种播放模式（单曲、列表、重复、随机）
- 📊 实时进度追踪
- 🎼 歌词自动滚动显示，支持逐字高亮和逐行高亮
- 📝 歌词翻译显示（可开关）
- 🎨 音频可视化频谱效果
- 🎭 全局动态背景效果
- 👤 艺术家视图，按首字母排序
- 🔤 拼音首字母排序支持（中文艺术家）
- 📱 移动端适配，支持手势切换页面
- ⚙️ 可自定义设置（分块加载、字体、字体粗细、字间距、行高）
- 🪞 镜像源支持，加速音乐文件加载
- 💾 本地存储记住用户设置
- 🔍 本地音乐搜索功能，支持按歌曲名和艺术家搜索
- 🎵 网易云音乐集成，支持在线搜索和播放
- ❤️ 收藏功能，保存喜欢的歌曲
- 📄 网易云歌曲详情和封面显示
- 🎤 网易云歌词自动获取和显示

## 本地运行

**前置要求：** Node.js 18+

1. 安装依赖：
   ```bash
   npm install
   ```
2. 启动应用：
   ```bash
   npm run dev
   ```
3. 在浏览器中访问 `http://localhost:3000`

## 构建部署

```bash
npm run build
```

构建后的文件将生成在 `dist/` 目录中。

## 项目结构

```
├── App.tsx                    # 主应用组件（桌面端）
├── mobile/
│   ├── App.tsx               # 移动端应用组件
│   ├── ArtistsView.tsx       # 移动端艺术家视图
│   └── SettingsPanel.tsx     # 移动端设置面板
├── components/
│   ├── MusicPlayer.tsx       # 音乐播放器组件
│   ├── MiniPlayerBar.tsx     # 迷你播放栏
│   ├── MusicLibrary.tsx      # 音乐库组件
│   ├── ArtistsView.tsx       # 艺术家视图组件
│   ├── FolderDisplay.tsx     # 文件夹显示组件
│   ├── SettingsPanel.tsx     # 设置面板组件
│   ├── LyricLine.tsx         # 歌词行组件
│   ├── AudioSpectrum.tsx     # 音频可视化组件
│   ├── GlobalBackground.tsx  # 全局背景组件
│   ├── NeteasePanel.tsx      # 网易云音乐面板组件
│   ├── SearchPanel.tsx       # 搜索面板组件
│   └── LazyImage.tsx         # 懒加载图片组件
├── apis/
│   └── netease.ts            # 网易云音乐 API 接口
├── utils/
│   ├── metadata.ts           # 音频元数据提取
│   ├── fontUtils.ts          # 字体工具
│   ├── pinyinLoader.ts       # 拼音首字母排序
│   └── composerUtils.ts      # 作曲家工具
├── cli/
│   ├── mirrorMaker/          # 镜像生成工具
│   └── theme-color-extraction/  # 主题色提取工具
├── public/
│   ├── music/                # 音乐文件目录
│   ├── discList.json         # 播放列表配置
│   └── mirrors.json          # 镜像源配置
├── types.ts                  # TypeScript 类型定义
├── metadata.json             # 曲目元数据
├── vite.config.ts            # Vite 配置
└── tsconfig.json             # TypeScript 配置
```

## 使用说明

### 添加音乐方法
1. 手动上传，临时
2. 自定义音乐源，参考 [useMusicSource](./hooks/useMusicSource.md)
3. - [Fork](https://github.com/Domdkw/Serene-Player/fork)
  - 将音乐文件添加到 `public/music/` 目录
  - 更新 `public/discList.json` 配置播放列表

### 网易云音乐功能
使用第三方API[apis.netstart.cn](https://apis.netstart.cn/music/)和网易官方外链播放音乐
1. 在线搜索和播放
2. 收藏功能


#### 歌词显示

- 网易云歌曲会自动获取歌词
- 歌词支持自动滚动和高亮显示
- 可在设置中开启或关闭歌词翻译

### 本地音乐搜索

1. 点击搜索按钮打开搜索面板
2. 输入歌曲名称或艺术家名称
3. 系统会实时显示匹配结果
4. 点击结果直接跳转播放

### 生成镜像源

使用 `cli/mirrorMaker/main.py` 生成镜像配置文件：

```bash
python cli/mirrorMaker/main.py
```

### 主题色提取

使用 `cli/theme-color-extraction/` 工具提取音乐封面主题色：

```bash
cd cli/theme-color-extraction
pip install -r requirements.txt
python main.py
```

## 技术栈

- React 19
- TypeScript 5.8
- Vite 6
- Lucide React Icons
- HTML5 Audio API
- fetch-in-chunks（分块加载）
- Tailwind CSS
- jsmediatags（元数据提取）

## 移动端特性

- 左右滑动手势切换页面（播放器/歌词/列表）
- 优化的触控体验
- 响应式布局适配
- 底部迷你播放栏

## 自定义设置

点击设置按钮可调整：

- **分块拉取片数**：1/4/8/16（数值越大加载越快）
- **字体选择**：多种中文字体可选
- **歌词字体粗细**：细体/常规/粗体
- **歌词字间距**：可调节
- **歌词行高**：可调节
- **翻译显示**：开启/关闭歌词翻译

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 开发计划

- [ ] 支持更多音频格式（FLAC、WAV、OGG）
- [x] 支持网易云音乐播放 灵感源于[maomao1996/Vue-mmPlayer](https://github.com/maomao1996/Vue-mmPlayer)和issue [#1]
- [ ] 歌单分享功能
- [ ] 深色/浅色主题切换
- [ ] 音乐均衡器调节
- [ ] 播放历史记录
- [ ] 歌曲评分功能
- [ ] 播放列表导出/导入

## 贡献指南

欢迎提交 Issue 和 Pull Request！
欢迎Fork 本仓库

## 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情

## 致谢

- [jsmediatags](https://github.com/aadsm/jsmediatags) 提供元数据提取功能
- [pinyin-pro](https://github.com/zh-lx/pinyin-pro) 提供拼音支持
- [fetch-in-chunks](https://github.com/AnthumChris/fetch-in-chunks) 提供分块加载支持
