# M1 delivered-file manifest

## Application and build
- `.env.example` — safe public build-channel example; contains no credentials.
- `.gitignore` — ignores Node, Vite, Tauri, Android, installer, and key artifacts.
- `index.html` — accessible, responsive branded boot shell and module entry.
- `package.json` / `package-lock.json` — cross-platform scripts, Three.js/Rapier/Capacitor/Tauri dependencies, and patched archive extraction dependency.
- `tsconfig.json` — strict TypeScript 5.4 compiler configuration.
- `vite.config.ts` — Vite 5 host/build configuration and Workbox-powered offline PWA.
- `capacitor.config.ts` — Capacitor 6 identity, Android scheme, status bar, and haptics.
- `src/main.ts` — PWA service-worker registration and boot readiness marker.
- `src/style.css` — responsive app-shell visuals, reduced-motion support, and safe-area handling.
- `public/favicon.svg`, `public/pwa-192.png`, `public/pwa-512.png` — PWA and browser identity assets.

## Native, CI, and docs
- `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/main.rs` — Tauri 2 Rust shell.
- `src-tauri/tauri.conf.json` — desktop window, security policy, and NSIS/MSI bundling.
- `src-tauri/capabilities/default.json` — least-privilege core window permissions.
- `src-tauri/icons/*` — PNG and ICO application bundle icon assets for Windows.
- `.github/workflows/build.yml` — web, Windows installer, and Android APK workflows.
- `README.md` — requirements, development, build, and milestone status.
- `FILE_MANIFEST.md` — this inventory.
