# Architecture

KOKUSEI is a small three-container monolith: a Next.js web UI, a Go REST API, and PostgreSQL.

The backend keeps transport, use-case, and persistence concerns separate. `IndicatorRepository`
and `UpdateHistoryRepository` hide PostgreSQL. `IndicatorDataProvider` is the extension point for
future e-Stat or ministry importers; the MVP includes a no-op provider because data is seeded.
Numeric database values cross the API boundary as decimal strings to avoid binary floating-point
rounding. The frontend only converts values to numbers at the chart rendering boundary.

The persistence boundary also supports an immutable JSON snapshot repository. Phase 1 keeps
PostgreSQL as the Production default while allowing `DATA_STORE=blob` for a private Azure Blob
container and `DATA_STORE=file` for local verification. A small `current.json` manifest points to
`snapshots/<commit-sha>/dataset.json`; the dataset is uploaded and read back before the pointer is
updated. Both repositories produce the same domain models and API response shape.
