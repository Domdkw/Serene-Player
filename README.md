<div align="center">
<img width="1200" height="475" alt="GHBanner" src="./屏幕截图 2026-01-02 003355.png" />
</div>

# Serene Player - 宁静播放器

基于 React 和 TypeScript 构建的现代化优雅音乐播放器。由 Gemini 3 Flash + TRAE + Hand 开发

## 功能特性

- 🎵 美观简约的用户界面，支持 3D 封面效果
- 🎨 流畅的动画过渡效果
- 🎧 完整播放控制（播放/暂停、切歌、音量调节、进度拖拽）
- 📋 播放列表管理，支持文件夹嵌套
- � 支持外链歌单导入
- �🔄 多种播放模式（单曲、列表、重复、随机）
- 📊 实时进度追踪
- 🎼 歌词自动滚动显示，支持自定义样式
- 📱 移动端适配，支持手势切换页面
- ⚙️ 可自定义设置（分块加载、字体粗细、字间距、行高）
- 🪞 镜像源支持，加速音乐文件加载

## 本地运行

**前置要求：** Node.js

1. 安装依赖：
   ```bash
   npm install
   ```
2. 启动应用：
   ```bash
   npm run dev
   ```
3. 在浏览器中访问 `http://localhost:5173`

## 项目结构

```
├── App.tsx                 # 主应用组件（桌面端）
├── mobile/
│   └── App.tsx             # 移动端应用组件
├── components/
│   └── SettingsPanel.tsx   # 设置面板组件
├── utils/
│   ├── metadata.ts         # 音频元数据提取
│   ├── MusicLibrary.tsx    # 音乐库组件
│   └── FolderDisplay.tsx   # 文件夹显示组件
├── cli/
│   ├── mirrorMaker/        # 镜像生成工具
│   └── theme-color-extraction/  # 主题色提取工具
├── public/
│   ├── music/              # 音乐文件目录
│   ├── discList.json       # 播放列表配置
│   └── mirrors.json        # 镜像源配置
├── types.ts                # TypeScript 类型定义
└── metadata.json           # 曲目元数据
```

## 使用说明

### 添加音乐

1. 将音乐文件添加到 `public/music/` 目录
2. 更新 `public/discList.json` 配置播放列表
3. 启动应用并享受音乐

### discList.json 格式

```json
{
  "文件夹名称": [
    {
      "name": "歌曲名称",
      "artist": "艺术家",
      "url": "./music/音乐文件.mp3",
      "themeColor": "#ff6b6b"
    }
  ],
  "外链文件夹": {
    "link": "https://example.com/discList.json"
  }
}
```

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
- TypeScript
- Vite
- Lucide React Icons
- HTML5 Audio API
- fetch-in-chunks（分块加载）

## 移动端特性

- 左右滑动手势切换页面（播放器/歌词/列表）
- 优化的触控体验
- 响应式布局适配

## 自定义设置

点击设置按钮可调整：

- **分块拉取片数**：1/4/8/16（数值越大加载越快）
- **歌词字体粗细**：细体/常规/粗体
- **歌词字间距**：可调节
- **歌词行高**：可调节

---

### 英文版本

如需查看英文版本，请访问 [README_EN.md](README_EN.md)
