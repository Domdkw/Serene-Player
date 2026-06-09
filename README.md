# Serene Player - 宁静播放器

<div align="center">

一个基于 React 和 TypeScript 构建的现代化、优雅的音乐播放器

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://choosealicense.com/licenses/mit/)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

<img src="https://visitor-badge.laobi.icu/badge?page_id=domdkw.Serene-Player" alt="visitor badge" />

</div>

---

## 应用截图

<details>
<summary>点击查看截图</summary>

<div align="center">

| 移动端竖屏 | 桌面端横屏 1 | 桌面端横屏 2 |
|:----------:|:------------:|:------------:|
| <img height="285" alt="移动端竖屏" src="https://raw.githubusercontent.com/Domdkw/warehouse/2e8b8d64d27e0fc242c5500b2e3f63789aa84407/Serene-Player/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE_2-5-2026_103338_localhost.jpeg" /> | <img height="285" alt="桌面端横屏1" src="https://raw.githubusercontent.com/Domdkw/warehouse/2e8b8d64d27e0fc242c5500b2e3f63789aa84407/Serene-Player/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE_2-5-2026_10380_localhost.jpeg"> | <img height="285" alt="桌面端横屏2" src="https://raw.githubusercontent.com/Domdkw/warehouse/2e8b8d64d27e0fc242c5500b2e3f63789aa84407/Serene-Player/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE_2-5-2026_103450_localhost.jpeg" /> |

</div>

</details>

</div>

基于 React 和 TypeScript 构建的现代化优雅音乐播放器。由 Gemini 3 Flash + TRAE + Hand 开发
#### 体验预览版：[DEV](https://github.com/Domdkw/Serene-Player/tree/dev)


## 功能特性

- 当前播放曲目下载功能
- 歌词翻译显示（可开关）
- 歌词自动滚动和高亮显示
- 网易云歌曲自动获取歌词和翻译
- 移动端适配，支持手势切换页面
- 本地音乐搜索功能，支持按歌曲名和艺术家搜索
- 艺术家分类视图
- 收藏功能
- 歌单分享功能
- P2P 一起听功能（基于 PeerJS）

## 开始

### 本地运行

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

## 说明

### 添加音乐

支持三种方式添加音乐：

| 方式 | 说明 | 持久性 |
|:----:|:----:|:------:|
| 手动上传 | 直接上传本地音乐文件 | 临时 |
| 自定义源 | 配置音乐源 URL | 持久 |
| Fork 仓库 | 添加到 `public/music/` 目录 | 持久 |

<details>
<summary>详细步骤</summary>

**方式一：手动上传**
- 在应用中直接上传音乐文件

**方式二：自定义音乐源**
- 参考 [queryParams 文档](./src/hooks/QueryParams.md) 配置

**方式三：Fork 仓库**
1. [Fork 本仓库](https://github.com/Domdkw/Serene-Player/fork)
2. 将音乐文件添加到 `public/music/` 目录
3. 更新 `public/discList.json` 配置播放列表

</details>

### 网易云音乐功能
从2.12.3开始使用Netlify部署，[Hono](https://hono.dev/) 作为 API 服务端。
<details>
<summary>使用第三方API</summary>
使用第三方API[apis.netstart.cn](https://apis.netstart.cn/music/)和网易官方外链播放音乐</details>


#### 歌词显示

- 网易云歌曲会自动获取歌词，翻译
- 歌词支持自动滚动和高亮显示
- 可在设置中开启或关闭歌词翻译

### 本地音乐搜索

1. 点击搜索按钮打开搜索面板
2. 输入歌曲名称或艺术家名称
3. 系统实时显示匹配结果
4. 点击结果直接跳转播放

### CLI 工具

<details>
<summary>镜像源生成工具</summary>

```bash
python cli/mirrorMaker/main.py
```

</details>

<details>
<summary>主题色提取工具</summary>

```bash
cd cli/theme-color-extraction
pip install -r requirements.txt
python main.py
```

</details>

## 项目结构

```
Serene-Player/
├── public/                    # 静态资源
│   ├── music/                   # 音乐文件目录
│   └── discList.json            # 播放列表配置
├── src/
│   ├── apis/                 # API 接口
│   │   └── netease.ts          # 网易云音乐 API
│   ├── app/                  # 应用入口
│   │   ├── App.tsx             # 桌面端应用
│   │   └── MobileApp.tsx       # 移动端应用
│   ├── components/           # 组件
│   │   ├── common/             # 通用组件
│   │   ├── layout/             # 布局组件
│   │   ├── library/            # 音乐库组件
│   │   ├── panels/             # 面板组件
│   │   └── player/             # 播放器组件
│   ├── contexts/             # React Context
│   ├── hooks/                # 自定义 Hooks
│   ├── types/                # TypeScript 类型定义
│   └── utils/                # 工具函数
├── cli/                       # 命令行工具
│   ├── mirrorMaker/             # 镜像生成工具
│   └── theme-color-extraction/  # 主题色提取工具
├── index.tsx                     # 应用入口
├── vite.config.ts                # Vite 配置
└── tsconfig.json                 # TypeScript 配置
```

## 技术栈

[React 19](https://react.dev/) - UI 框架
[TypeScript](https://www.typescriptlang.org/) - 类型安全
[Vite](https://vitejs.dev/) - 构建工具
[TailwindCSS v4](https://tailwindcss.com/) - 样式框架
[Framer Motion](https://www.framer.com/motion/) - 动画库
[Lucide React](https://lucide.dev/) - 图标库

## 开发计划

- [ ] 移动端显示作曲家信息
- [x] 支持网易云音乐播放
- [x] 歌单分享功能
- [ ] 深色/浅色主题切换
- [ ] 支持更多音乐平台 (Working)
- [x] 历史记录
- [ ] 添加更多发现插件
- [x] 播放列表导出/导入

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. [Fork 本仓库](https://github.com/Domdkw/Serene-Player/fork)
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情

### 灵感来源

- [Vue-mmPlayer](https://github.com/maomao1996/Vue-mmPlayer) - 网易云音乐播放器

---

<div align="center">
**如果这个项目对你有帮助，请给一个 ⭐️ Star 支持一下！**
Powered by: Domdkw
</div>
