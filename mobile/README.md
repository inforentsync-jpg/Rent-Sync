# Rent-Sync Mobile

The Expo app uses the existing Rent-Sync API for owner, tenant, and platform-admin accounts. It never connects to the database from the device.

## Run locally

```powershell
cd mobile
npm install
npx expo start
```

For the Android emulator, the development default is `http://10.0.2.2:3000`. iOS simulators and web use `http://localhost:3000`. On a physical phone, open **Server settings** on the sign-in screen and enter the reachable HTTPS address of the Rent-Sync deployment or the computer's LAN address.

## Build an installable Android APK

Install EAS CLI and sign in to the Expo account that owns this app:

```powershell
npm install --global eas-cli
eas login
```

Set `EXPO_PUBLIC_API_URL` to the deployed Rent-Sync HTTPS origin in the EAS build environment before creating a release. The app also allows the server address to be configured on the sign-in screen.

```powershell
eas build --platform android --profile production
```

The `production` profile is intentionally configured to output an installable APK. EAS signs the first build after you configure Android credentials. Install the resulting APK from the EAS build page or its download link.
