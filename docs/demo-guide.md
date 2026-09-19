# AccessMap — Thesis Demo Guide (Phase 11)

Everything needed to present AccessMap live: the demo story, device/network prep, both run modes (Expo Go and the installed APK), and the backup plan.

---

## 1. The demo story (5 beats)

The seed data is arranged so the presentation follows one clean narrative:

> **Beat 1 — Search (Map tab).** Type **"Brookside"** in the map search → tap the suggestion → the pin flies to **Brookside Health Center (BHS)** and the facility card updates. Shows the app knows where facilities are.

> **Beat 2 — Browse + Filter (Home tab).** Type **"hospital"** in the Home search → open **Cainta Municipal Hospital**. Its checklist: ramp ✅, entrance ✅, restroom ✅, parking ✅, elevator ❌ — an honest mix, not everything is accessible. Then open the **Filter sheet** and select **Ramp + Restroom** → results narrow (a place must have *all* selected provisions).

> **Beat 3 — Details.** On **Cainta Municipal Hospital**: the feature checklist, the hero photo (after seed update), operating hours, and **"Open in map"**.

> **Beat 4 — Directions.** Tap **Get Directions** → allow location once → a numbered walking route renders (fetched once; no live tracking — per scope).

> **Beat 5 — Admin adds a place, live.** Sign out → sign in as the admin account → Admin → **Add place** (e.g. *San Isidro Dialysis Center*) with a photo → save → switch back to the user account → the new place is **already on Home** (screens refetch on focus; added in Phase 11).

Each beat uses places that exist in `supabase/seed.sql`.

## 2. One-time preparation (do the day before)

1. **Run the seed photo update.** In the Supabase SQL editor, run the tail of `supabase/seed.sql` (the two `update public.places set photo_url = ...` statements) so the demo hospitals have hero photos.
2. **Device**: charge to 100%; enable **Developer options → Stay awake while charging**.
3. **Disable battery optimization** for Expo Go (Settings → Apps → Expo Go → Battery → Unrestricted) so the dev connection isn't killed mid-demo.
4. **Install the APK** (below) *or* install **Expo Go** from the Play Store.
5. **Sign in once with both Google accounts** (user + admin) so the OAuth consent screen is already approved and cached.
6. **Rehearse beats 1–5 once end-to-end** on the exact device and network you'll present on.
7. **Make the backup screen recording** (see §6) — do this while everything is working.

## 3. Run mode A — installed APK (primary)

The preview APK was built with EAS (`eas.json` → `preview` profile). Get it:

- Build page: https://expo.dev/accounts/henry26/projects/accessMap/builds
- On the device, open the build page in Chrome → download the `.apk` → if prompted, allow **"Install unknown apps"** for Chrome → install.

Notes:
- The APK is a full standalone build — no dev server, no laptop needed on stage.
- It is not Play-Store-signed; that's fine for sideloading on any Android device.
- If the audience device should also have it, just repeat the download/install there.

## 4. Run mode B — Expo Go (fallback / live-code demo)

Use this if you want to show the source code on the laptop and the app updating live.

1. Laptop: `npx expo start` (Metro must stay running).
2. Phone: same **Wi-Fi** as the laptop (phone on hotspot? use `npx expo start --tunnel` instead).
3. Scan the QR code with the **camera app** (Android) — it opens in Expo Go.
4. If the connection drops mid-demo: shake the phone → **"Reload"**, or restart Metro.

## 5. Network / device checklist (both modes)

- ✅ Phone charged + Stay-awake-while-charging enabled
- ✅ Mobile data or Wi-Fi confirmed working **on the device** (the app needs internet for Supabase, map tiles, and directions)
- ✅ Location permission granted at least once (for directions)
- ✅ Both Google accounts signed in once beforehand
- ✅ Battery optimization disabled for Expo Go (mode B only)
- ✅ Backup: screen recording on the phone/laptop (§6) + the APK as fallback for mode B

## 6. Backup plan

Record a screen capture of the full 5-beat demo on the presentation device (Settings → search "Screen record") while everything works, the day before. If the live demo fails (Wi-Fi dies, OAuth hiccup), play the recording and narrate.

## 7. Presenting with the audience's phones (optional)

Share the APK link from §3. Anyone with an Android phone can install it the same way (allow "install unknown apps" → install). There is no per-user setup beyond signing in with their own Google account — the seed data is public-read via Supabase RLS.
