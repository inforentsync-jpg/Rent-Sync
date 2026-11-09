<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Approved Rental Agreement PDF Layout

- Treat the current rental-agreement PDF format, especially page one, as approved and locked. Do not change its layout, spacing, alignment, fonts, wrapping, or visual styling unless the user explicitly asks for that specific change.
- For any other PDF or agreement change, preserve the approved format and visually verify the generated PDF.

## Release and delivery workflow

- Follow [docs/DELIVERY-SOP.md](./docs/DELIVERY-SOP.md) for source control, production deployment, and Android APK delivery.
- The Git repository is the source of truth. Validate and push the requested code changes promptly; do not leave completed work only on a feature branch when production delivery was requested.
- For mobile runtime or app-configuration changes, build and verify an APK from the exact current mobile source, then place it at `D:\Jasim\Share\projects\RENT SYNC\rent sync mobile app\Rent-Sync.apk`.
- The standalone APK-builder folder is outside this Git repository and its source may diverge. Compare/synchronize it with this repository's `mobile/` before using its build script; never package or label a stale mirror as current.
- Do not claim deployment or APK completion until the live behavior or generated artifact has been verified. A failed build leaves the previous APK intact and must be reported as a blocker.
