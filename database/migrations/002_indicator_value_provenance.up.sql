ALTER TABLE indicator_values
    ADD COLUMN IF NOT EXISTS data_origin TEXT NOT NULL DEFAULT 'development',
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS estimate_kind TEXT;

UPDATE indicator_values v
SET source_url = i.source_url,
    estimate_kind = 'development'
FROM indicators i
WHERE i.id = v.indicator_id AND v.source_url IS NULL;

ALTER TABLE indicator_values ALTER COLUMN source_url SET NOT NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='indicator_values_data_origin_check') THEN
        ALTER TABLE indicator_values ADD CONSTRAINT indicator_values_data_origin_check CHECK (data_origin IN ('development', 'official'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='indicator_values_estimate_kind_check') THEN
        ALTER TABLE indicator_values ADD CONSTRAINT indicator_values_estimate_kind_check CHECK (estimate_kind IN ('development', 'final', 'provisional'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='indicator_values_source_url_check') THEN
        ALTER TABLE indicator_values ADD CONSTRAINT indicator_values_source_url_check CHECK (source_url ~ '^https://');
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_indicator_values_external_id
    ON indicator_values (indicator_id, external_id)
    WHERE external_id IS NOT NULL;

ALTER TABLE update_histories
    ADD COLUMN IF NOT EXISTS data_origin TEXT NOT NULL DEFAULT 'development',
    ADD COLUMN IF NOT EXISTS source_url TEXT;

UPDATE update_histories u
SET source_url = i.source_url
FROM indicators i
WHERE i.id = u.indicator_id AND u.source_url IS NULL;

ALTER TABLE update_histories ALTER COLUMN source_url SET NOT NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='update_histories_data_origin_check') THEN
        ALTER TABLE update_histories ADD CONSTRAINT update_histories_data_origin_check CHECK (data_origin IN ('development', 'official'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='update_histories_source_url_check') THEN
        ALTER TABLE update_histories ADD CONSTRAINT update_histories_source_url_check CHECK (source_url ~ '^https://');
    END IF;
END $$;
