# Run doc — AccessMap (Expo / React Native)

## Reproduce artifacts (fresh checkout)
1. This workspace IS the main checkout (`C:\Users\henry\Desktop\accessMap`), so no env copy is needed here. In a separate worktree: copy `.env` from the main checkout root (contains `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_ORS_API_KEY`).
2. Install dependencies with npm (lockfile: `package-lock.json`): `npm install`
3. No build artifacts are required for the dev server.
4. If serving a phone over LAN fails (Windows firewall / router isolation): `npm install --no-save @expo/ngrok`, then start with `--tunnel` (see below).

## Run the server
- package.json has **no `dev` script**; use `start` (runs `expo start`).
- Default port 8081 (Expo default). If busy, pick a free port and pass `--port`.
- Web preview URL: `http://localhost:8081` (Expo serves web + manifest on the same port). Onboarding route: `http://localhost:8081/onboarding`.
- LAN mode (fastest for phone on same Wi-Fi): `npx expo start --port 8081`
- Tunnel mode (bypasses firewall; slower): `npx expo start --port 8081 --tunnel`
- Detached start on Windows (PowerShell; note `npm.cmd`, separate stdout/stderr files):
  ```
  powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','start','--','--port','8081' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
  ```
  Then confirm: `powershell -NoProfile -Command "Get-Process -Id <pid>"` and wait for `curl http://localhost:8081` → 200.
- Clerk loads remotely on boot; the web app shows a green spinner overlay until Clerk initializes (~2–5 s), then renders.
