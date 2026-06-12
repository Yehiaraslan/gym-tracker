# Building Banana Pro Gym for Android (without Manus)

Two ways to get the app on your phone. **Option A (EAS cloud build)** is the
recommended path — no Android Studio needed.

---

## Option A — EAS Cloud Build (recommended)

EAS builds the APK on Expo's servers for free (free tier has a monthly build
quota, plenty for personal use).

### One-time setup

1. Create a free account at https://expo.dev (if you don't have one).
2. On your PC, in the project folder:

   ```bash
   npm install -g eas-cli
   eas login
   ```

3. Link the project to your Expo account (first time only):

   ```bash
   eas init
   ```

   Accept the prompt to create the project under your account. This writes a
   `projectId` into the config — commit that change.

### Build an APK (every time you want a new version)

```bash
eas build --platform android --profile preview
```

- Takes ~10–20 minutes in Expo's cloud queue.
- When done, the terminal prints a **download link + QR code**.
- Open the link on your phone (or scan the QR), download the APK, and install.
  Android will ask you to allow "install from unknown sources" the first time.

### Production build (Play Store, optional)

```bash
eas build --platform android --profile production
```

Produces an `.aab` app bundle for Google Play. Requires a Google Play
developer account ($25 one-time fee). Not needed for personal use.

---

## Option B — Local build on your PC

Fully offline and unlimited, but needs a one-time heavy setup:

1. Install **JDK 17** and **Android Studio** (which installs the Android SDK).
2. Set `ANDROID_HOME` to the SDK location
   (usually `C:\Users\<you>\AppData\Local\Android\Sdk`).
3. In the project folder:

   ```bash
   npx expo prebuild --platform android
   cd android
   gradlew assembleRelease
   ```

4. APK output: `android/app/build/outputs/apk/release/app-release.apk`
   — copy it to your phone and install.

---

## Notes

- **WHOOP integration:** OAuth credentials come from `.env`
  (`WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REDIRECT_URI`). For EAS
  cloud builds, set them as EAS environment variables if you want WHOOP in the
  built app: `eas env:create`. Without them, the app still works (WHOOP runs
  in demo mode).
- **Server features:** workout tracking, history, and measurements are stored
  on-device (AsyncStorage) and work fully offline. Features that talk to the
  tRPC server (`server/`) — DB sync, pin-sync — need the server hosted
  somewhere and the app pointed at it.
- **Updating the app:** install a new APK over the old one (same package name
  `space.manus.gym.tracker.t20260101030858`) — your data is preserved.
