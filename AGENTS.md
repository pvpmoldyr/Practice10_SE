## Project
Smart Campus room availability checker; fictional data only.
## Constraints
Preserve AC1–AC6; no backend, login, database (including Supabase), or booking creation.
No secrets, API keys, or credentials anywhere in the project.
No external deployments or calls to external services.

AC1: reject start >= end, times outside 00:00–24:00, and past requests.
AC2: reject durations longer than 120 minutes.
AC3: reject a blocked room.
AC4: reject overlaps; allow bookings touching only at endpoints.
AC5–AC6: do not mutate booking data; retain clear desktop/mobile feedback.

## Engineering rules
Prefer pure functions and minimal changes; use at most 2 justified patterns.
Do not mutate booking fixtures; keep responsive UI feedback.
## Verification
Run these commands and add focused regression tests as needed:
  npx vitest run
  npm run lint
  npm run typecheck
  npm run build
Do not propose acceptance until all checks pass.
Wait for human approval.
Report changed files, rationale and test evidence.
