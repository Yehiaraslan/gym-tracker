# Push notifications — what exists and what is still needed

## Built (2026-09-18)
- Server: `push_tokens` table, `push.register` / `push.unregister` procedures, `server/push-service.ts` sends
  through Expo's push API (`https://exp.host/--/api/v2/push/send`) on:
  - coach assigns a workout plan → trainee
  - coach assigns a meal plan → trainee
  - any direct message → recipient (both directions, including broadcast)
  Dead tokens (`DeviceNotRegistered`) are pruned automatically.
- Client: `lib/push-registration.ts` obtains the Expo token after login and binds it to the account; on sign-out
  the token is unregistered. Notification taps route to the chat / Coach tab.
- Fallback that works TODAY without any credentials: on every app foreground the trainee app compares
  plan ids + unread count to what it already announced and raises a local notification for anything new.

## Still needed for real background push on Android (Yehia's action, ~10 min)
Expo's push service needs Firebase Cloud Messaging credentials for the app's package name:
1. https://console.firebase.google.com → create project "MY Lifestyle" → Add Android app with the package name
   from `app.config.ts` (`android.package`). Download `google-services.json` into the repo root.
2. `app.config.ts` → `android.googleServicesFile: "./google-services.json"`.
3. Firebase → Project settings → Service accounts → Generate new private key (JSON).
4. `npx eas credentials --platform android` → "Google Service Account Key for FCM V1" → upload that JSON.
5. Rebuild the APK (`eas build --platform android --profile preview`). No server change needed.

Until step 5, `registerCurrentDevice()` logs a warning and returns null on Android; nothing else breaks.
