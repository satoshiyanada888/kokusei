INSERT INTO indicators (slug, name, description, unit, category, source_name, source_url) VALUES
('population', '総人口', '日本に居住する人口の規模を示す指標です。', '万人', '人口', '総務省統計局', 'https://www.stat.go.jp/data/jinsui/'),
('births', '出生数', '一定期間に出生した子どもの数を示します。', '万人', '少子化', '厚生労働省', 'https://www.mhlw.go.jp/toukei/list/81-1.html'),
('nominal-gdp', '名目GDP', '国内で生み出された付加価値を市場価格で測る指標です。', '兆円', '経済', '内閣府', 'https://www.esri.cao.go.jp/jp/sna/menu.html'),
('cpi', '消費者物価指数', '家計が購入する財・サービスの価格変動を測る指数です。', '指数', '物価', '総務省統計局', 'https://www.stat.go.jp/data/cpi/'),
('unemployment-rate', '完全失業率', '労働力人口に占める完全失業者の割合です。', '%', '雇用', '総務省統計局', 'https://www.stat.go.jp/data/roudou/')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  updated_at = NOW();
