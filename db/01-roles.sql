\set ON_ERROR_STOP on

\getenv app_user APP_DB_USER
\getenv app_pw APP_DB_PASSWORD

\if :{?app_user}
\else
\set app_user cloudcast_app
\endif

\if :{?app_pw}
\else
DO $guard$ BEGIN
  RAISE EXCEPTION 'APP_DB_PASSWORD is not set - refusing to create the app role. Set it in .env (openssl rand -hex 32).';
END $guard$;
\endif

SELECT format('DO $guard$ BEGIN RAISE EXCEPTION %L; END $guard$',
              'APP_DB_PASSWORD is empty - refusing to create the app role. Set it in .env (openssl rand -hex 32).')
WHERE :'app_pw' = ''
\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_pw')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO :"app_user";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO :"app_user";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO :"app_user";

\echo '[db-init] access established: app role has row CRUD only.'
