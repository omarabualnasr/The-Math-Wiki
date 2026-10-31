# Mathematics Wiki 2.0 — Release Candidate Notes

## Scope

This consolidated release candidate includes the first-stage Mathematics Wiki foundation and all seven second-stage implementation milestones, plus Pass 8 release hardening. Features explicitly marked **Soon** remain reserved and are not implemented in this release.

## Pass 8 improvements

- Added a cross-feature release integration test that validates all article block types, routes, PWA registration, storage recovery, and CI suite coverage.
- Added timestamps to personal workspace and learning snapshots so a newer local fallback is not overwritten by stale IndexedDB data after a failed write.
- Preserved malformed stored workspace/learning records and surfaced recovery errors instead of silently treating them as empty data.
- Added clear data-recovery states to Personal Workspace and Learning Center.
- Prevented ordinary navigations from replacing the cached offline entry page before the app bundle has been validated.
- Added `npm run test:integration` to the GitHub Actions deployment workflow.

## Verification in this workspace

The nine existing project contract suites and the new release integration suite are run independently. Full `npm run typecheck` and `npm run build` still require the declared React/Vite dependencies, which were not installable in the offline build workspace. A successful GitHub Actions build and browser smoke test are required before declaring the deployment fully verified.

## Deployment

Extract the ZIP and upload the contents of its `math-wiki/` directory to the root of the GitHub repository. Keep `.github/workflows/deploy.yml` at the repository root beside `package.json` and `src/`. In GitHub repository settings, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
