# Build the standalone APK (Capacitor)

This turns the web app into a real installable Android app — the web files are
**bundled inside the APK**, so it runs entirely offline with no hosted page. The
PWA route still works too; this is just the standalone package you asked for.

I can't compile the APK for you (the Android SDK isn't reachable from where I
build), but the steps below run on your machine end to end. You've shipped an
Electron app before, so none of this will be foreign.

## One-time setup

You need:

- **Node 22+** (Capacitor 8's CLI requires it)
- **JDK 21**
- **Android Studio** (for the Android SDK + build tools). On first launch let it
  install the SDK; that's the part I can't fetch here.

Set `JAVA_HOME` to your JDK 21 and `ANDROID_HOME` to the SDK
(usually `~/Library/Android/sdk` on macOS, `%LOCALAPPDATA%\Android\Sdk` on Windows).

## Build

From this folder:

```bash
# 1. install deps (Capacitor + the test dep)
npm install

# 2. stage the web files into www/ (Capacitor reads from there)
npm run www
#   Windows (no rm/cp): just make a www\ folder and copy these six files in:
#   index.html, manifest.webmanifest, service-worker.js,
#   icon-192.png, icon-512.png, icon-512-maskable.png

# 3. create the native Android project (first time only)
npx cap add android

# 4. copy web assets + sync native deps (re-run after any web change)
npx cap sync android

# 5a. build the APK from the command line...
cd android
./gradlew assembleDebug        # Windows: gradlew assembleDebug
#   -> android/app/build/outputs/apk/debug/app-debug.apk

# 5b. ...or open Android Studio and use Build > Build APK(s)
#   (from the project root:  npx cap open android )
```

## Put it on the tablet

- Copy `app-debug.apk` to the tablet and tap it (enable "install unknown apps"
  for your file manager when prompted), **or**
- With the tablet on USB and developer mode on:
  `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

The app installs as **Ink** with its own icon and runs fullscreen. Storage works
the same as the PWA — Capacitor serves the app over a secure local scheme, so
IndexedDB autosave/restore behaves exactly as it does on the tablet now.

## After you change the web app

Re-stage and re-sync, then rebuild:

```bash
npm run www && npx cap sync android && cd android && ./gradlew assembleDebug
```

## Notes

- App id is `com.tonyviking.ink` and the name is `Ink` — both in
  `capacitor.config.json`, change them if you like (do it before `cap add android`).
- The service worker is harmless inside the APK (assets are already bundled);
  you can leave it in.
- The debug APK is debug-signed, which is fine for sideloading to your own
  tablet. A release build (Play Store, or a "cleaner" install) needs a keystore —
  `keytool -genkey ...` then `./gradlew assembleRelease` — but that's only worth
  it if you ever want to distribute it.
- App icons: Android uses its own launcher icons, not the web ones. To brand the
  launcher icon, drop a square PNG in and run
  `npm i -D @capacitor/assets && npx capacitor-assets generate --android`, or set
  them in Android Studio. Optional — the default works.
