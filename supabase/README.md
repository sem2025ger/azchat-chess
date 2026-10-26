# Migration history

The three `20261015` migrations are exact, read-only captures of the SQL already
applied to production, not instructions to run it again. Never re-apply the old
bootstrap migrations to the live database. The live schema is the source of truth
until a verified restore test exists; this directory is not yet a validated
fresh-database restore path.
