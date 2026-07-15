# Architecture

KOKUSEI is a small three-container monolith: a Next.js web UI, a Go REST API, and PostgreSQL.

The backend keeps transport, use-case, and persistence concerns separate. `IndicatorRepository`
and `UpdateHistoryRepository` hide PostgreSQL. `IndicatorDataProvider` is the extension point for
future e-Stat or ministry importers; the MVP includes a no-op provider because data is seeded.
Numeric database values cross the API boundary as decimal strings to avoid binary floating-point
rounding. The frontend only converts values to numbers at the chart rendering boundary.

