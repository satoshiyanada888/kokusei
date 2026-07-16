#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  psql_target="$DATABASE_URL"
else
  for name in PGHOST PGDATABASE PGUSER PGPASSWORD; do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
      echo "DATABASE_URL or $name is required" >&2
      exit 1
    fi
  done
  psql_target=""
fi

run_psql() {
  if [ -n "$psql_target" ]; then
    psql "$psql_target" "$@"
  else
    psql "$@"
  fi
}

run_psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

for migration in /migrations/*.up.sql; do
  version="$(basename "$migration" .up.sql)"
  case "$version" in
    *[!0-9A-Za-z_-]*)
      echo "Invalid migration filename: $migration" >&2
      exit 1
      ;;
  esac

  applied="$(run_psql -v ON_ERROR_STOP=1 -Atc "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '$version')")"
  if [ "$applied" = "t" ]; then
    echo "Migration $version is already applied"
    continue
  fi

  echo "Applying migration $version"
  {
    printf 'BEGIN;\n'
    cat "$migration"
    printf "\nINSERT INTO schema_migrations (version) VALUES ('%s');\nCOMMIT;\n" "$version"
  } | run_psql -v ON_ERROR_STOP=1
done

if [ "${LOAD_PRODUCTION_CATALOG:-false}" = "true" ]; then
  run_psql -v ON_ERROR_STOP=1 -f /production/indicator_catalog.sql
  echo "Production indicator catalog configured"
fi

if [ -n "${APP_DATABASE_USER:-}" ]; then
  case "${APP_DATABASE_USER:-}" in
    ''|*[!a-z0-9_-]*) echo "APP_DATABASE_USER is invalid" >&2; exit 1 ;;
  esac
  run_psql -v ON_ERROR_STOP=1 \
    --set=app_user="$APP_DATABASE_USER" <<'SQL'
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') THEN 'true' ELSE 'false' END AS app_role_exists \gset
\if :app_role_exists
\else
  \echo 'APP_DATABASE_USER does not exist; create it in Neon before migration'
  \quit 1
\endif
SELECT CASE WHEN EXISTS (
  SELECT 1
  FROM pg_auth_members membership
  JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
  JOIN pg_roles member_role ON member_role.oid = membership.member
  WHERE granted_role.rolname = 'neon_superuser'
    AND member_role.rolname = :'app_user'
) THEN 'true' ELSE 'false' END AS app_has_neon_superuser \gset
\if :app_has_neon_superuser
  \echo 'APP_DATABASE_USER inherits neon_superuser; replace it with a role created via SQL by the database owner'
  \quit 1
\endif
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_roles
  WHERE rolname = :'app_user'
    AND NOT rolsuper
    AND NOT rolcreatedb
    AND NOT rolcreaterole
    AND NOT rolreplication
) THEN 'true' ELSE 'false' END AS app_role_is_restricted \gset
\if :app_role_is_restricted
\else
  \echo 'APP_DATABASE_USER has role-management or database-creation privileges; harden it before migration'
  \quit 1
\endif
REVOKE ALL PRIVILEGES ON DATABASE kokusei FROM :"app_user";
REVOKE TEMPORARY ON DATABASE kokusei FROM PUBLIC;
GRANT CONNECT ON DATABASE kokusei TO :"app_user";
REVOKE ALL PRIVILEGES ON SCHEMA public FROM :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
REVOKE CREATE ON SCHEMA public FROM :"app_user";
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM :"app_user";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"app_user";
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO :"app_user";
SELECT CASE WHEN
  has_database_privilege(:'app_user', 'kokusei', 'CONNECT')
  AND NOT has_database_privilege(:'app_user', 'kokusei', 'TEMPORARY')
  AND has_schema_privilege(:'app_user', 'public', 'USAGE')
  AND NOT has_schema_privilege(:'app_user', 'public', 'CREATE')
  AND NOT has_table_privilege(:'app_user', 'indicators', 'INSERT')
  AND NOT has_table_privilege(:'app_user', 'indicators', 'UPDATE')
  AND NOT has_table_privilege(:'app_user', 'indicators', 'DELETE')
THEN 'true' ELSE 'false' END AS app_privileges_are_restricted \gset
\if :app_privileges_are_restricted
\else
  \echo 'APP_DATABASE_USER privilege hardening failed'
  \quit 1
\endif
SQL
  echo "Application database read privileges configured"
fi

echo "Migrations completed"
