<div align="center">
<img width="1200" height="475" alt="GHBanner" src="./屏幕截图 2026-01-02 003355.png" />
</div>

# Serene Player

A modern, elegant music player built with React and TypeScript. Developed by Gemini 3 Flash + TRAE + Hand

## Features

- 🎵 Beautiful, minimalistic UI with 3D cover effect
- 🎨 Smooth animations and transitions
- 🎧 Full playback controls (play/pause, skip, volume, progress drag)
- 📋 Playlist management with folder nesting support
- 🔗 External playlist import support
- 🔄 Multiple playback modes (single, list, repeat, shuffle)
- 📊 Real-time progress tracking
- 🎼 Lyric display with auto-scrolling and custom styling
- 📱 Mobile responsive with gesture navigation
- ⚙️ Customizable settings (chunk loading, font weight, letter spacing, line height)
- 🪞 Mirror source support for faster music loading

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the app:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
├── App.tsx                 # Main application component (desktop)
├── mobile/
│   └── App.tsx             # Mobile application component
├── components/
│   └── SettingsPanel.tsx   # Settings panel component
├── utils/
│   ├── metadata.ts         # Audio metadata extraction
│   ├── MusicLibrary.tsx    # Music library component
│   └── FolderDisplay.tsx   # Folder display component
├── cli/
│   ├── mirrorMaker/        # Mirror generation tool
│   └── theme-color-extraction/  # Theme color extraction tool
├── public/
│   ├── music/              # Music files directory
│   ├── discList.json       # Playlist configuration
│   └── mirrors.json        # Mirror source configuration
├── types.ts                # TypeScript type definitions
└── metadata.json           # Track metadata
```

## Usage

### Adding Music

1. Add your music files to the `public/music/` directory
2. Update `public/discList.json` with your playlist items
3. Run the app and enjoy your music

### discList.json Format

```json
{
  "Folder Name": [
    {
      "name": "Song Title",
      "artist": "Artist Name",
      "url": "./music/music-file.mp3",
      "themeColor": "#ff6b6b"
    }
  ],
  "External Folder": {
    "link": "https://example.com/discList.json"
  }
}
```

### Generate Mirror Sources

Use `cli/mirrorMaker/main.py` to generate mirror configuration:

```bash
python cli/mirrorMaker/main.py
```

### Theme Color Extraction

Use `cli/theme-color-extraction/` tool to extract theme colors from album covers:

```bash
cd cli/theme-color-extraction
pip install -r requirements.txt
python main.py
```

## Technologies Used

- React 19
- TypeScript
- Vite
- Lucide React Icons
- HTML5 Audio API
- fetch-in-chunks (chunked loading)

## Mobile Features

- Left/right swipe gestures to switch pages (player/lyrics/list)
- Optimized touch experience
- Responsive layout adaptation

## Customizable Settings

Click the settings button to adjust:

- **Chunk Count**: 1/4/8/16 (higher values load faster)
- **Lyric Font Weight**: Light/Medium/Bold
- **Lyric Letter Spacing**: Adjustable
- **Lyric Line Height**: Adjustable

---

### Chinese Version

For Chinese version, please visit [README.md](README.md)
