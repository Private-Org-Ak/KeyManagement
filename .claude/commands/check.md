Run, in order: `npm run typecheck`, `npm run lint`, `npm test`.
If anything under supabase/ changed since the last commit (`git diff --name-only HEAD`), also run `npm run db:test`.
Fix every failure without weakening tests, disabling lint rules, or adding `any`. Re-run until green, then report a one-line status per command.
