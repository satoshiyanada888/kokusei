DROP INDEX IF EXISTS idx_indicator_values_external_id;
ALTER TABLE update_histories
    DROP CONSTRAINT IF EXISTS update_histories_source_url_check,
    DROP CONSTRAINT IF EXISTS update_histories_data_origin_check,
    DROP COLUMN IF EXISTS source_url,
    DROP COLUMN IF EXISTS data_origin;
ALTER TABLE indicator_values
    DROP CONSTRAINT IF EXISTS indicator_values_source_url_check,
    DROP CONSTRAINT IF EXISTS indicator_values_estimate_kind_check,
    DROP CONSTRAINT IF EXISTS indicator_values_data_origin_check,
    DROP COLUMN IF EXISTS estimate_kind,
    DROP COLUMN IF EXISTS external_id,
    DROP COLUMN IF EXISTS source_url,
    DROP COLUMN IF EXISTS data_origin;
