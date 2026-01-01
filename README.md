<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Serene Player - 宁静播放器

基于 React 和 TypeScript 构建的现代化优雅音乐播放器。

## 功能特性

- 🎵 美观简约的用户界面
- 🎨 流畅的动画过渡效果
- 🎧 完整播放控制（播放/暂停、切歌、音量调节）
- 📋 播放列表管理
- 🔄 多种播放模式（列表、重复、随机）
- 📊 实时进度追踪
- 🎼 歌词自动滚动显示

## 本地运行

**前置要求：** Node.js

1. 安装依赖：
   `npm install`
2. 启动应用：
   `npm run dev`
3. 在浏览器中访问 `http://localhost:5173`

## 项目结构

```
├── App.tsx          # 主应用组件
├── index.tsx        # 应用入口文件
├── types.ts         # TypeScript 类型定义
├── utils/           # 工具函数
│   └── metadata.ts  # 音频元数据提取
├── music/           # 音乐文件目录
├── discList.json    # 播放列表配置
└── metadata.json    # 曲目元数据
```

## 使用说明

1. 将音乐文件添加到 `music/` 目录
2. 更新 `discList.json` 配置播放列表
3. 启动应用并享受音乐

## 技术栈

- React 19
- TypeScript
- Vite
- Lucide React Icons
- HTML5 Audio API

---

### 英文版本

如需查看英文版本，请访问 [README_EN.md](README_EN.md)
