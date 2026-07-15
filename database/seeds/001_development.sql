BEGIN;

INSERT INTO indicators (slug, name, description, unit, category, source_name, source_url) VALUES
('population', '総人口', '日本に居住する人口の規模を示す指標です。人口推計の考え方を理解するため、出典の定義も確認してください。', '万人', '人口', '総務省統計局', 'https://www.stat.go.jp/data/jinsui/'),
('births', '出生数', '一定期間に出生した子どもの数を示します。人口動態統計の確定値・概数などの区分に注意が必要です。', '万人', '少子化', '厚生労働省', 'https://www.mhlw.go.jp/toukei/list/81-1.html'),
('nominal-gdp', '名目GDP', '国内で生み出された付加価値をその時点の市場価格で測る指標です。物価変動の影響を含みます。', '兆円', '経済', '内閣府', 'https://www.esri.cao.go.jp/jp/sna/menu.html'),
('cpi', '消費者物価指数', '家計が購入する財・サービスの価格変動を測る指数です。ここでは総合指数を想定しています。', '指数', '物価', '総務省統計局', 'https://www.stat.go.jp/data/cpi/'),
('unemployment-rate', '完全失業率', '労働力人口に占める完全失業者の割合です。季節調整の有無など定義を確認してください。', '%', '雇用', '総務省統計局', 'https://www.stat.go.jp/data/roudou/')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, unit = EXCLUDED.unit,
  category = EXCLUDED.category, source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url, updated_at = NOW();

INSERT INTO indicator_values (indicator_id, value, period, published_at, fetched_at, data_origin, source_url, estimate_kind)
SELECT i.id, v.value, v.period, v.published_at::date, v.fetched_at::timestamptz, 'development', i.source_url, 'development'
FROM (VALUES
('population', 12550, '2020年', '2021-04-01', '2025-01-31T09:00:00+09:00'),
('population', 12502, '2021年', '2022-04-01', '2025-01-31T09:00:00+09:00'),
('population', 12457, '2022年', '2023-04-01', '2025-01-31T09:00:00+09:00'),
('population', 12410, '2023年', '2024-04-01', '2025-01-31T09:00:00+09:00'),
('population', 12360, '2024年（開発用）', '2025-01-31', '2025-01-31T09:00:00+09:00'),
('births', 84.1, '2020年', '2021-06-01', '2025-02-28T09:00:00+09:00'),
('births', 81.2, '2021年', '2022-06-01', '2025-02-28T09:00:00+09:00'),
('births', 77.1, '2022年', '2023-06-01', '2025-02-28T09:00:00+09:00'),
('births', 72.7, '2023年', '2024-06-01', '2025-02-28T09:00:00+09:00'),
('births', 68.6, '2024年（開発用）', '2025-02-28', '2025-02-28T09:00:00+09:00'),
('nominal-gdp', 539.0, '2020年度', '2021-12-01', '2025-03-10T09:00:00+09:00'),
('nominal-gdp', 553.0, '2021年度', '2022-12-01', '2025-03-10T09:00:00+09:00'),
('nominal-gdp', 566.5, '2022年度', '2023-12-01', '2025-03-10T09:00:00+09:00'),
('nominal-gdp', 595.0, '2023年度', '2024-12-01', '2025-03-10T09:00:00+09:00'),
('nominal-gdp', 610.0, '2024年度（開発用）', '2025-03-10', '2025-03-10T09:00:00+09:00'),
('cpi', 100.0, '2020年', '2021-01-22', '2025-02-21T09:00:00+09:00'),
('cpi', 99.8, '2021年', '2022-01-21', '2025-02-21T09:00:00+09:00'),
('cpi', 102.3, '2022年', '2023-01-20', '2025-02-21T09:00:00+09:00'),
('cpi', 105.5, '2023年', '2024-01-19', '2025-02-21T09:00:00+09:00'),
('cpi', 108.2, '2024年（開発用）', '2025-02-21', '2025-02-21T09:00:00+09:00'),
('unemployment-rate', 2.8, '2020年', '2021-01-29', '2025-01-31T09:00:00+09:00'),
('unemployment-rate', 2.8, '2021年', '2022-02-01', '2025-01-31T09:00:00+09:00'),
('unemployment-rate', 2.6, '2022年', '2023-01-31', '2025-01-31T09:00:00+09:00'),
('unemployment-rate', 2.6, '2023年', '2024-01-30', '2025-01-31T09:00:00+09:00'),
('unemployment-rate', 2.5, '2024年（開発用）', '2025-01-31', '2025-01-31T09:00:00+09:00')
) AS v(slug, value, period, published_at, fetched_at)
JOIN indicators i ON i.slug = v.slug
ON CONFLICT (indicator_id, period) DO UPDATE SET
  value = EXCLUDED.value, published_at = EXCLUDED.published_at, fetched_at = EXCLUDED.fetched_at;

INSERT INTO update_histories (indicator_id, previous_value, current_value, period, detected_at, data_origin, source_url)
SELECT i.id, h.previous_value, h.current_value, h.period, h.detected_at::timestamptz, 'development', i.source_url
FROM (VALUES
('population', 12410, 12360, '2024年（開発用）', '2025-01-31T09:00:00+09:00'),
('births', 72.7, 68.6, '2024年（開発用）', '2025-02-28T09:00:00+09:00'),
('nominal-gdp', 595.0, 610.0, '2024年度（開発用）', '2025-03-10T09:00:00+09:00'),
('cpi', 105.5, 108.2, '2024年（開発用）', '2025-02-21T09:00:00+09:00'),
('unemployment-rate', 2.6, 2.5, '2024年（開発用）', '2025-01-31T09:00:00+09:00')
) AS h(slug, previous_value, current_value, period, detected_at)
JOIN indicators i ON i.slug = h.slug
WHERE NOT EXISTS (
  SELECT 1 FROM update_histories u WHERE u.indicator_id = i.id AND u.period = h.period
);

COMMIT;
