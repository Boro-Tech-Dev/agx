This directory is **deprecated**.

It previously contained multiple init scripts mounted into `/docker-entrypoint-initdb.d`.
The repo now uses a single canonical bootstrap:

- `infra/postgres/schema.sql`

The old files remain only for reference.

