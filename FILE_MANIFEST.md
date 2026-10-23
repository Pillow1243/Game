# CORE: Nuclear delivered-file manifest

## M1 — foundation and platform configuration
- `.env.example` — safe public build-channel example; contains no credentials.
- `.gitignore` — ignores Node, Vite, Tauri, Android, installer, and key artifacts.
- `index.html` — browser/native-webview entry and accessible simulator root.
- `package.json` / `package-lock.json` — cross-platform scripts and Three.js, Rapier, Tauri, and Capacitor dependencies.
- `tsconfig.json` — strict TypeScript 5.4 compiler configuration.
- `vite.config.ts` — Vite 5 host/build configuration and Workbox-powered offline PWA.
- `capacitor.config.ts` — Capacitor 6 identity, Android scheme, status bar, and haptics.
- `public/favicon.svg`, `public/pwa-192.png`, `public/pwa-512.png` — app and PWA identity assets.
- `.github/workflows/build.yml` — web, Windows installer, and Android APK jobs.
- `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/main.rs` — Tauri 2 Rust shell.
- `src-tauri/tauri.conf.json` — desktop window, security policy, and NSIS/MSI bundling.
- `src-tauri/capabilities/default.json` — least-privilege core window permissions.
- `src-tauri/icons/*` — PNG and ICO application icon assets.

## M2 — engine core
- `src/main.ts` — PWA registration, engine startup, and a recoverable graphics-failure screen.
- `src/engine/app.ts` — engine lifecycle, input-to-simulation orchestration, settings, audio, and save UI actions.
- `src/engine/types.ts` — strict engine, input, settings, camera, and save data contracts.
- `src/engine/store.ts` — small observable state store.
- `src/engine/settings.ts` — graphics-tier detection, persisted settings, and quality budgets.
- `src/engine/loop.ts` — requestAnimationFrame loop, clamped delta time, pause behavior, and FPS sampling.
- `src/engine/scene.ts` — WebGPU-first renderer with WebGL2 fallback and procedural systems-bay scene.
- `src/engine/camera.ts` — first-person, orbit, and cinematic camera modes.
- `src/engine/input.ts` — keyboard/mouse, touch joystick/look, and gamepad input abstraction.
- `src/engine/audio.ts` — procedural Web Audio master/music/SFX/voice buses and voice ducking.
- `src/engine/saves.ts` — validated three-slot IndexedDB persistence.
- `src/engine/interface.ts` — responsive engine HUD, settings, save/load, and camera controls.
- `src/style.css` — app shell and responsive HUD/touch layouts.

## Documentation
- `README.md` — requirements, development, native build instructions, and delivery status.
- `FILE_MANIFEST.md` — this inventory.
