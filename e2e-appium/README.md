Quick Appium E2E for Expo (Android dev client)

Overview
- Minimal Appium test that connects to an Android device and saves a screenshot to `artifacts/`.

Prerequisites (Windows)
1. Node.js installed.
2. Expo EAS configured and build a dev-client for Android, or have an APK of your dev-client installed on the device.
   - Build (optional): `eas build --profile development --platform android`
   - Install APK: `adb install -r path\to\your-dev-client.apk`
3. Enable USB debugging on your Android device and connect via USB.
4. Install Appium (global recommended): `npm i -g appium`
5. Start the Appium server: `appium`

Setup
1. From this folder, install deps:

```powershell
cd "shelvy-mobile-app-frontend\e2e-appium"
npm install
```

2. Set environment variables if needed (device name, app package/activity). Example PowerShell:

```powershell
$env:ANDROID_DEVICE = "emulator-5554"
$env:APP_PACKAGE = "host.exp.exponent"    # or your dev-client package
$env:APP_ACTIVITY = ".MainActivity"
```

Run test
```powershell
# Start Appium in a separate shell: appium
npm run test
```

Artifacts
- Screenshots and captures are saved in `artifacts/` with timestamps.
- Collect `adb logcat -d > C:\Temp\log.txt` for logs.

Notes
- Update the selectors in `test.js` to match your app's error UI (accessibility ids or text).
- For automated network-loss tests, use `adb shell svc wifi disable` / `adb shell svc data disable` or toggle airplane mode before running assertions.
