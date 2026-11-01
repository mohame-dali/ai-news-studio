# Videofy AI News Studio

![Videofy Studio](./videofy_cms.png)

Videofy AI News Studio is a React application for turning news articles into animated, short-form broadcast news videos for social media (Stories, Reels, TikTok) and digital signage.

It fetches article content from news sources (Web URLs, Reuters, AP, or direct copy), generates voiceover manuscripts, matches media assets (images, video clips, and maps), produces narration timings, and provides real-time player preview with human-in-the-loop editing before exporting.

## Key Features

- **Start Studio**:
  - News fetchers: Web URL, Reuters Wire, Associated Press (AP), or Direct Article Text.
  - Brand style selection: Global News default, Nordic News (VG style), TechWire, etc.
  - Custom prompt editor auto-synchronized with selected brand guidelines.
  - Quick-launch preconfigured demo stories (Arctic Climate Station, Mars Water Expedition).
- **Interactive Studio Editor**:
  - Real-time video player with Ken-Burns camera movement animations (`zoom-in`, `zoom-out`, `pan-left`, `pan-right`, rotations).
  - Multi-article tab management with drag-and-drop reordering.
  - Segment editor with `@dnd-kit` drag-and-drop reordering, duplication, and deletion.
  - Media asset editor:
    - **Image**: crop and focal hotspot positioning via `react-image-crop`
    - **Video**: trim duration start / end timecodes and preview
    - **Map**: latitude/longitude coordinates with interactive tile preview
  - Voiceover manuscript line editor with pronunciation bracket hints.
  - Custom audio voice recorder per segment.
  - Brand theme & JSON configuration editor with asset library viewer.
- **Export & Download**:
  - Vertical video format (1080x1920) for 9:16 mobile feeds.
  - Horizontal video format (1920x1080) for 16:9 displays.
  - Narration sound-only audio track (.wav / .mp3).
  - Videofy Project JSON archive for full workflow preservation.

## Development & Lancement Windows

### Commandes Standard (Multiplateforme)
```bash
# Installation des dépendances
npm install

# Diagnostic d'environnement (FFmpeg, Ollama, Piper, Node)
npm run check:env

# Démarrer le serveur de développement sur http://localhost:3000
npm run dev
# ou
npm run start:studio

# Compilation de production
npm run build

# Vérification des types TypeScript et linter
npm run lint
```

### Lancement Rapide sous Windows (D:\AI-News-Studio)
- **Via PowerShell :**
  ```powershell
  .\scripts\start-studio.ps1
  ```
- **Via l'explorateur de fichiers :**
  Double-cliquez sur `scripts\start-studio.cmd`.

