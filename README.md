# CORE: Nuclear

CORE: Nuclear is a cross-platform power-plant operations simulator targeting the browser, Windows desktop (Tauri 2), and Android (Capacitor 6, minimum SDK 26). This repository is being delivered in eight implementation milestones; the current M1 foundation establishes the strict TypeScript/Vite toolchain, app shell, native packaging configuration, PWA support, and build automation.

## Requirements

- Node.js 20 or newer and npm
- For Windows desktop builds: Rust stable and the Tauri 2 prerequisites for Windows (MSVC C++ Build Tools and WebView2)
- For Android builds: JDK 17, Android SDK / command-line tools, and Gradle (the wrapper is provided by Capacitor's generated Android project)

## Browser development

```sh
npm ci
npm run dev
```

Vite listens on `0.0.0.0:1420` so it is usable in local browser previews and by the Tauri development shell. `npm run build` runs the strict TypeScript check and creates the production PWA in `dist/`.

## Windows desktop

```sh
npm ci
npm run tauri:dev
npm run tauri:build
```

The Tauri bundle configuration requests both NSIS `.exe` and WiX `.msi` installers. Installer size depends on the Windows WebView2 bootstrapper and final assets; the ≤10 MB target is not yet measured or guaranteed.

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

The CI workflow generates this project on the runner, applies minimum SDK 26 and an arm64-only ABI filter, and archives the unsigned release APK. For a distributable signed APK, configure Android signing in the CI environment; never commit signing credentials.

## Project structure

```text
index.html                         Browser and native-webview entry
src/main.ts                        PWA registration and app boot entry
src/style.css                      Responsive foundation theme
vite.config.ts                     Vite 5 and Workbox PWA configuration
capacitor.config.ts                Capacitor 6 app identity and native plugins
src-tauri/                         Tauri 2 desktop shell and bundle configuration
.github/workflows/build.yml        Web, Windows, and Android CI jobs
FILE_MANIFEST.md                   M1 delivered-file inventory
```

## Delivery status

- M1 — foundation and cross-platform build configuration.
- M2–M8 — engine, simulation, world, controls, interface, game modes, and final platform QA are scheduled for subsequent milestones.

No production simulation, safety training, or real plant operation is represented by the M1 shell. This is an educational game project, not an operational control system.
