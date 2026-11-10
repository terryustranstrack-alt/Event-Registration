#!/usr/bin/env bash
# Runs the schema + behaviour tests against a throwaway local Postgres (16+)
# with minimal stubs for Supabase's auth/storage schemas.
#   DB=evtest PSQL="psql" ./supabase/tests/run-database-tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${DB:-event_registration_test}"
PSQL="${PSQL:-psql}"
dropdb --if-exists "$DB" && createdb "$DB"
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" < supabase/tests/local-supabase-stubs.sql
for f in supabase/migrations/*.sql; do $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" < "$f"; done
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" < supabase/tests/database-behavior-test.sql

# Overbooking: 200 concurrent registrations for 50 seats must yield exactly 50.
$PSQL -q -d "$DB" -c "insert into events (org_id, slug, title_en, starts_at, ends_at, capacity, status) select id,'rush','Rush',now()+interval '1d',now()+interval '2d',50,'published' from organizations where slug='org-a'"
EID=$($PSQL -tA -d "$DB" -c "select id from events where slug='rush'")
for i in $(seq 1 200); do
  $PSQL -q -tA -d "$DB" -c "set role service_role; select 1 from register_for_event('$EID','P$i','p$i@x.com','id','{}','rush-$i',true)" >/dev/null &
done
wait
TAKEN=$($PSQL -tA -d "$DB" -c "select count(*) from registrations where event_id='$EID' and status='registered'")
echo "registered=$TAKEN (expected 50)"
[ "$TAKEN" = "50" ] || { echo "FAIL: overbooking"; exit 1; }
echo "All database tests passed."
