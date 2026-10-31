Read CLAUDE.md and docs/ROADMAP.md, plus any doc the task depends on (ARCHITECTURE.md, SECURITY.md, PRD.md).

Task: the first unchecked item in docs/ROADMAP.md, or the item described here: $ARGUMENTS

1. Restate the task and its acceptance criteria in 2–4 lines.
2. Propose a short plan: files to create or change, approach, and tests.
   - If the plan touches the database schema, RLS, auth, or adds a runtime dependency, STOP and wait for my approval.
3. Implement in small, reviewable steps.
4. Run `npm run typecheck`, `npm run lint`, `npm test` (and `npm run db:test` if the DB changed). Fix failures.
5. Tick the completed checkbox(es) in docs/ROADMAP.md.
6. Summarize what changed, anything deferred, and any doc/DECISIONS.md updates.
