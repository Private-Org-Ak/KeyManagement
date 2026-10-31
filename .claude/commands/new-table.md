Add a new household-scoped table: $ARGUMENTS

Checklist (all required):

1. New migration file in supabase/migrations/ (timestamped name). Never edit applied migrations.
2. Columns include `household_id uuid not null references public.households(id) on delete cascade`, plus length checks on text columns.
3. Any FK to another household table uses a composite (id, household_id) FK.
4. `enable row level security`; select/insert/update policies use `public.is_member(household_id)`, deletes use `public.has_role(...)` per the role matrix in docs/SECURITY.md. All policies `to authenticated`.
5. pgTAP tests: non-member sees 0 rows and cannot insert/update/delete; anon denied; role rules hold.
6. `npm run db:reset && npm run db:test && npm run db:types`.
7. Add the table to the Dexie cache/sync if it's needed offline, and wipe it on sign-out.
8. Update docs/SECURITY.md (role matrix) and docs/ARCHITECTURE.md if relevant.
