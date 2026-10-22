# Rent-Sync

Rent-Sync is a mobile-first rent and rental-agreement management app with Owner and Tenant sign-in and a protected platform administrator dashboard.

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

By default, local development uses a separate demo-data file. To use the configured database locally, set `RENT_SYNC_DATABASE_MODE=live` in `.env.local` and restart the dev server. Local changes then affect that database; OTP sign-in and test agreement creation are disabled. Unset the variable to return to isolated demo data.

## Environment configuration

- `DATABASE_URL`: PostgreSQL connection string (pooled is suitable for app traffic).
- `AUTH_SECRET`: random, private value of at least 32 characters. Keep it identical across app instances.
- `SUPER_ADMIN_MOBILE_NUMBER`: super-admin number, in international format without a plus sign. Defaults to `919567048809`.
- `SUPER_ADMIN_PASSWORD`: super-admin password. Set this as a private environment secret in every deployment; never commit it.
- `CRON_SECRET`: long random secret used to authorize the scheduled annual-agreement draft job.
- Super-admin sign-in uses the configured mobile number and `SUPER_ADMIN_PASSWORD` in every environment. Owner registration uses a mobile number and password; passwords are stored as scrypt hashes. Use a strong password for production accounts.

## Vercel

Connect the GitHub repository to Vercel and add `DATABASE_URL`, a strong `AUTH_SECRET`, `SUPER_ADMIN_MOBILE_NUMBER`, `SUPER_ADMIN_PASSWORD`, and a random `CRON_SECRET` to the Production environment. Use a separate PostgreSQL database for Preview and Production. Each push to the connected deployment branch triggers a Vercel deployment. Before deploying, run `npm run db:migrate:deploy` against each target database. Owner OTP sign-in is disabled in production until a real OTP provider is implemented; owners sign in using their mobile number and password.

Owner registration, owner profiles, and tenant sign-in are available. Tenants can sign in with a password set by the super administrator; the development-only OTP remains available for local testing. Owners can add a tenant and generate an unsigned draft agreement; tenant signing remains disabled in production until a complete signing workflow is implemented.

After owner registration, open `/owner/profile` to update the profile name and email, configure or change a password, and view the mobile number and account creation date. `/owner/profle` redirects to the profile page for compatibility. The super-admin dashboard at `/admin` contains only Owners and Tenants modules; either module lets the super administrator reset that account's password. Owner and tenant passwords are stored as scrypt hashes. Owner sign-in is available at `/owner/login`.

When an owner adds a tenant, they choose the agreement start date. Rent-Sync creates an unsigned 11-month draft for that start year. An owner reviews it through KYC, Rent, Advance, Terms and Important Terms, can update agreement values during review, then approves it; the tenant reviews and approves the owner-approved draft from their portal. Any changes during the second review clear the earlier approval and return the draft to the owner for review. The agreement becomes active only after both parties approve the same version, and records both approval timestamps. The owner portfolio and a daily 03:00 UTC Vercel cron create a draft for the following anniversary year once the latest agreement is expired or within two months of expiry. Each tenant, asset, and year combination is unique, and duplicate agreements are rejected. Agreement rows include a protected PDF download generated from the supplied rental-agreement template; unavailable personal details are left blank or marked as not provided rather than copied from the template's sample data. The generated PDF uses the Noto Sans Malayalam font under the SIL Open Font License; the license is in `assets/fonts/OFL.txt`.

The public home page links to Owner and Tenant sign-in. Super-admin sign-in is available at `/platform`, and the protected Owners and Tenants dashboard is at `/admin`.
