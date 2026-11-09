# Rent-Sync Change and Release SOP

## Source of truth

- The Git repository `RENT SYNC WEB` is the canonical source for web, API, and mobile app code. The canonical mobile app is `mobile/`.
- The separate folder `D:\Jasim\Share\projects\RENT SYNC\rent sync mobile app` is outside Git and contains an Android build cache, APK builder, and delivery artifact. It is not automatically synchronized with `mobile/`.
- Before using the separate folder's `build-apk.ps1`, compare its app source, Expo entry point, app configuration, and dependencies with the canonical `mobile/`. The two source trees were found to differ on 2026-11-09. Do not run that builder against a stale source mirror or call its output current.
- Resolve source synchronization as part of the task when an APK is required. If it cannot be done safely, stop before replacing the APK and report the exact blocker. Preserve the last verified APK.

## For every requested code change

1. Inspect the current branch, worktree, and related instructions. Preserve unrelated user edits.
2. Identify all affected surfaces: web, API, mobile, database, and public links.
3. Implement the change end to end, then run targeted tests, lint, and type checks.
4. Review the final diff and ensure no secrets or generated build output are staged.
5. Commit and push validated requested source changes promptly. For an explicitly production-ready request, push to `main` when the repository permits it; never force-push. If branch protection or authentication blocks delivery, push the available branch and clearly name the remaining step.
6. Do not run database writes or production migrations until the target environment is positively identified and the migration is safe. Report migrations that are already applied or unnecessary.

Documentation-only changes do not require a mobile build. For backend-only changes, deploy and test the backend; an APK cannot package web server code. Rebuild the APK whenever mobile runtime/configuration changes, or whenever the user explicitly requests a new APK.

## Web and backend delivery

- Confirm the intended Vercel project and deployment branch before deploying. A pushed commit is not proof of deployment.
- After deployment, test the actual public URL and affected endpoint. For owner-authenticated endpoints, verify an unauthenticated request is rejected by the new route (for example, expected `401`) rather than returning a missing-route `404`; do not test destructive actions against real tenant records.
- Open the requested public share links and verify the updated page, not merely an HTTP `200`.
- If deployment credentials or production access are unavailable, state that explicitly; do not claim the live behavior is fixed.

## Android APK delivery

1. Confirm the canonical mobile changes and app configuration are the source being built. Check for source drift in the external builder before using it.
2. Use the existing, verified Android build workflow and preserve its Gradle/native caches. Do not delete caches, run `gradlew clean`, or fall back to an old artifact after a failed build.
3. Build the release APK. Replace the deliverable only after the build succeeds.
4. Verify package ID, version name/code, signature, APK readability, and expected feature markers in `assets/index.android.bundle`.
5. Copy the verified APK to exactly:

   `D:\Jasim\Share\projects\RENT SYNC\rent sync mobile app\Rent-Sync.apk`

6. Compare source and destination size and SHA-256. Report the exact path, version, signature type, and verification result.
7. If any build or verification step fails, keep the previous APK unchanged and say plainly that no fresh APK was generated. Do not describe a previous artifact as a newly built APK.

The current internal APK signing setup is debug signing. Do not imply it is a store-ready production signature.

## Delivery response checklist

- State which requested changes were made and the commit/branch pushed.
- State whether the live deployment was verified and what endpoint/page was checked.
- State the exact APK file location and whether it was freshly generated.
- Distinguish “source pushed,” “deployed,” and “APK built”; they are separate delivery states.
- List any blocker, failed check, unrun migration, or user action still required.

## Most recent delivery audit (2026-11-09)

- Implemented tenant-detail reset, owner reset controls, public tenant profile updates, approval re-entry, mobile reset controls, and the tenant share route. Reset preserves the tenant name and existing asset/agreement information.
- Commit `926826c` was pushed to `main`. The reset API returned `401` without owner authentication, confirming the route exists. Public share URLs returned `200`, but HTTP success alone did not establish that the intended new page design was rendered; verify expected page content with an incomplete-profile share token before claiming visual deployment success.
- The APK at the requested destination is version `1.0.1` (version code `2`), debug-signed. Its bundle was inspected for reset/share markers and the production API URL. It was copied from an existing artifact; it was not freshly rebuilt in this delivery.
- A fresh direct Gradle build failed on a Windows CMake/Ninja path-length error. A retry through a short path failed during Expo settings/autolinking. Preserve the APK and do not call it a fresh build until the canonical-source build succeeds.
- The APK builder folder's source tree differs from the canonical repository's mobile source. Resolve that source mismatch before the next release build; do not blindly run its builder.
- No new tenant-reset schema migration was needed. No production database writes were run because the configured database environment was marked live.

## 2026-11-09 delivery lessons

- Reset/public-page source was initially pushed to a feature branch rather than production `main`, delaying the live update.
- A fresh build was reported too confidently after the rebuild failed; presence of reset strings in an existing APK did not prove that the APK had just been rebuilt from current source.
- The APK was copied to the requested folder only after the user had to repeat the destination.
- A direct Gradle build hit a Windows CMake path-length failure. The known standalone build script was not the canonical source build, and its source files differ from this repository's mobile source.
- Corrective rule: prove source identity before building, prove build success before replacing the artifact, and give the final folder/path without making the user ask again.
