CREATE TABLE IF NOT EXISTS indicators (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    category TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (slug ~ '^[a-z0-9-]+$'),
    CHECK (source_url ~ '^https://')
);

CREATE TABLE IF NOT EXISTS indicator_values (
    id BIGSERIAL PRIMARY KEY,
    indicator_id BIGINT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    value NUMERIC(24, 6) NOT NULL,
    period TEXT NOT NULL,
    published_at DATE NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (indicator_id, period)
);

CREATE INDEX IF NOT EXISTS idx_indicator_values_latest
    ON indicator_values (indicator_id, published_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS update_histories (
    id BIGSERIAL PRIMARY KEY,
    indicator_id BIGINT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    previous_value NUMERIC(24, 6),
    current_value NUMERIC(24, 6) NOT NULL,
    period TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_update_histories_detected
    ON update_histories (detected_at DESC);

