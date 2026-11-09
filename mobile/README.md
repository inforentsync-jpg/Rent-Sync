# Rent-Sync Mobile

The Expo app uses the existing Rent-Sync API for owner, tenant, and platform-admin accounts. It never connects to the database from the device.

## Run locally

```powershell
cd mobile
npm install
npm run api:proxy
```

In another terminal, start the Next.js app from the repository root (`npm run dev`) and Expo for web with `npx expo start --web`. The local browser preview uses the loopback API proxy at `http://localhost:3001` to connect to the configured Vercel API without cross-origin restrictions. Opening a tenant share link from Expo redirects to the Next.js share page at `http://localhost:3000`; both servers must be running. Native builds continue to call the Vercel API directly.

The app is configured in code to use `https://rentsync-theta.vercel.app`. The sign-in screen does not expose a server-address setting.

## Build an installable Android APK

Install EAS CLI and sign in to the Expo account that owns this app:

```powershell
npm install --global eas-cli
eas login
```

```powershell
eas build --platform android --profile production
```

The `production` profile is intentionally configured to output an installable APK. EAS signs the first build after you configure Android credentials. Install the resulting APK from the EAS build page or its download link.
