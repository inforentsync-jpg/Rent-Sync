# Rent-Sync

Rent-Sync is a mobile-first rent and rental-agreement management app. This first milestone includes public entry points, development-only admin sign-in, a protected admin dashboard, and building records with owner contact details.

## Local setup

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env.local` and set the required values.
3. Configure PostgreSQL.
4. Run:

```bash
npm install
npm run db:migrate:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment configuration

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: random, private value of at least 32 characters. Keep it identical across app instances.
- `SUPER_ADMIN_MOBILE_NUMBER`: initial super-admin number, in international format without a plus sign. Defaults to `919567048809`.
- Local development super-admin testing uses mobile `9567048809` and password `1234`. Owner account registration also uses development OTP `1234`; it does not send SMS. These fixed test credentials are accepted only when `NODE_ENV` is not `production`. Do not use these test credentials to protect a public deployment.

## Vercel

Import `Jassimtkd/Rent-Sync` into Vercel and add `DATABASE_URL` and a strong `AUTH_SECRET` to the Preview and Production environments. Use a separate PostgreSQL database for Preview and Production. Before deploying, run `npm run db:migrate:deploy` against each target database. Admin sign-in is intentionally disabled in production until a real OTP provider is implemented.

Owner registration and tenant sign-in are shown as public entry points, but their account and lease workflows are intentionally not enabled in this first milestone.

After owner registration, open `/owner/profile` to update the profile name and email and view the mobile number and account creation date. `/owner/profle` redirects to the profile page for compatibility. The development profile shows the test OTP (`1234`); owner password sign-in is not enabled.
