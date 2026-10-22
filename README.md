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
- `SUPER_ADMIN_MOBILE_NUMBER`: super-admin number, in international format without a plus sign. Defaults to `919567048809`.
- `SUPER_ADMIN_PASSWORD`: super-admin password. Set this as a private environment secret in every deployment; never commit it.
- `CRON_SECRET`: long random secret used to authorize the scheduled annual-agreement draft job.
- Super-admin sign-in uses the configured mobile number and `SUPER_ADMIN_PASSWORD` in every environment. Owner registration uses a mobile number and password; passwords are stored as scrypt hashes. Use a strong password for production accounts.

## Vercel

Connect the GitHub repository to Vercel and add `DATABASE_URL`, a strong `AUTH_SECRET`, `SUPER_ADMIN_MOBILE_NUMBER`, `SUPER_ADMIN_PASSWORD`, and a random `CRON_SECRET` to the Production environment. Use a separate PostgreSQL database for Preview and Production. Each push to the connected deployment branch triggers a Vercel deployment. Before deploying, run `npm run db:migrate:deploy` against each target database. Owner OTP sign-in is disabled in production until a real OTP provider is implemented; owners sign in using their mobile number and password.

Owner registration, owner profiles, and tenant sign-in are available. Tenants can sign in with a password set by the super administrator; the development-only OTP remains available for local testing. Tenant agreement creation uses the development test flow and is disabled in production until a complete signing workflow is implemented.

After owner registration, open `/owner/profile` to update the profile name and email, configure or change a password, and view the mobile number and account creation date. `/owner/profle` redirects to the profile page for compatibility. The super-admin dashboard at `/admin` contains only Owners and Tenants modules; either module lets the super administrator reset that account's password. Owner and tenant passwords are stored as scrypt hashes. Owner sign-in is available at `/owner/login`.

The owner portfolio and a daily 03:00 UTC Vercel cron create missing unsigned drafts for the upcoming calendar year for each assigned tenant and asset. The default term is January 1 through November 30 (11 months); November 31 is not a valid date. Drafts are not signed or activated. Each tenant, asset, and year combination is unique, and duplicate agreements are rejected. Agreement rows include a protected PDF download generated from the supplied rental-agreement template; unavailable personal details are left blank or marked as not provided rather than copied from the template's sample data. The generated PDF uses the Noto Sans Malayalam font under the SIL Open Font License; the license is in `assets/fonts/OFL.txt`.
