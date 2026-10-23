# CORE: Nuclear

CORE: Nuclear is a cross-platform power-plant operations simulator targeting the browser, Windows desktop (Tauri 2), and Android (Capacitor 6, minimum SDK 26). Delivery is being built in eight milestones. M1 established the strict TypeScript/Vite toolchain and native packaging; M2 now provides a live 3D navigation sandbox, camera modes, unified controls, procedural audio, local settings, and three IndexedDB save slots.

## Requirements

- Node.js 20 or newer and npm
- For Windows desktop builds: Rust stable and the Tauri 2 prerequisites for Windows (MSVC C++ Build Tools and WebView2)
- For Android builds: JDK 17, Android SDK / command-line tools, and Gradle (the wrapper is provided by Capacitor's generated Android project)

## Browser development

```sh
npm ci
npm run dev
```

Vite listens on `0.0.0.0:1420` for browser previews and the Tauri development shell. `npm run build` performs a strict TypeScript check and creates the production PWA in `dist/`.

## Controls

- **WASD / arrow keys:** move or pan; **Shift:** sprint; **mouse drag:** look; **wheel:** orbit zoom.
- **E / Enter:** interaction cue; **Escape / P:** pause and resume.
- Touch devices receive a virtual movement stick, drag-look region, interact action, and pause button. A connected gamepad's left stick moves, right stick looks, A interacts, Start pauses, and shoulder buttons sprint.
- The camera dock switches between walk, orbit, and cinematic modes. Settings include auto-detected or manual graphics tiers, four audio-bus levels, touch controls, and reduced motion.
- Save/load opens three local IndexedDB slots. Audio is synthesized with Web Audio and starts after the first user gesture.

## Windows desktop

```sh
npm ci
npm run tauri:dev
npm run tauri:build
```

The Tauri bundle requests both NSIS `.exe` and WiX `.msi` installers. Installer size depends on the Windows WebView2 bootstrapper and final assets; the ≤10 MB target is not yet measured or guaranteed.

## Android

On a fresh checkout, add the native Android project once, set its Gradle `minSdkVersion` to `26`, then sync/build:

```sh
npm ci
npm run build
npx cap add android
# Set minSdkVersion = 26 in android/variables.gradle
npx cap sync android
cd android && ./gradlew assembleRelease
```

The CI workflow generates this project on the runner, applies minimum SDK 26 and an arm64-only ABI filter, and archives the unsigned release APK. For a distributable signed APK, configure Android signing in CI; never commit signing credentials.

## Project structure

```text
src/engine/                        Engine core, controls, audio, persistence, scene
src/main.ts                        PWA registration and app bootstrap
src/style.css                      Responsive HUD and touch-control layout
vite.config.ts                     Vite 5, build splitting, and Workbox PWA
capacitor.config.ts                Capacitor 6 app identity and native plugins
src-tauri/                         Tauri 2 desktop shell and bundle configuration
.github/workflows/build.yml        Web, Windows, and Android CI jobs
FILE_MANIFEST.md                   Full delivered-file inventory
```

## Delivery status

- M1 — foundation and cross-platform build configuration.
- M2 — engine loop, renderer fallback, camera rig, input, audio, settings, and save slots.
- M3–M8 — plant world, reactor and thermal simulation, turbine/grid, full UX/localization, modes/progression, and final platform QA remain scheduled.

The M2 systems-bay view is an engine navigation sandbox, not a plant operations model. No game physics, control-room operations, or safety training are represented yet. This educational game is not an operational control system.
