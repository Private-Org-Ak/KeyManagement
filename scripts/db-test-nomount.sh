#!/usr/bin/env sh
# Fallback for `supabase test db` when Docker can't bind-mount the project folder
# (e.g. Colima without macOS "Documents" access). Same pg_prove image, but the tests are
# copied in with `docker cp` instead of mounted. Local stack only.
set -eu

PROJECT_ID=keyfinder
IMAGE=public.ecr.aws/supabase/pg_prove:3.36
NAME="kf_pg_prove_$$"
TESTS_DIR="$(cd "$(dirname "$0")/../supabase/tests" && pwd)"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker create --name "$NAME" --network "supabase_network_${PROJECT_ID}" \
  -e PGPASSWORD=postgres "$IMAGE" \
  sh -c 'cd /tests && pg_prove --ext .sql -h supabase_db_'"$PROJECT_ID"' -U postgres -d postgres *.test.sql' \
  >/dev/null
docker cp "$TESTS_DIR/." "$NAME:/tests"
docker start -a "$NAME"
