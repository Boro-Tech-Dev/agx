This folder contains the **previous** multi-file Postgres init scripts that used to be mounted
into `/docker-entrypoint-initdb.d` via Docker Compose.

They are kept for historical reference only. The canonical fresh schema bootstrap is now:

- `infra/postgres/schema.sql`

If you need to provision a DB, prefer running the canonical schema, or wiping the volume so
Compose executes it automatically on first init.

