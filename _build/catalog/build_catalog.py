# -*- coding: utf-8 -*-
# 상품 설명집 원본 엔진(= 이 사이트가 원본). 대시보드는 이 사이트로 링크만 건다.
#  - 엔진 코드: _build/catalog/engine/ (catalog_view.js, catalog_detail.js, *.css, base.css)
#  - 데이터: 작업 폴더(DATA)의 flat_styles.json / tree.json / stories.json (build_data~build_nested 체인이 만든다) + 의류_입력양식.xlsx(build_apparel.py)
#  - 출력: catalog.html + catalog-img/ (매출·입고·재고 등 내부 데이터는 빼고 카탈로그 필드만, 이미지는 파일로 분리)
import json, os, re, hashlib, base64, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("CATALOG_DATA") or r"C:\Users\-\Desktop\코워크\Artifacts\헬렌 AW26"   # 데이터(작업 폴더)
OUT = os.environ.get("CATALOG_OUT") or os.path.abspath(os.path.join(HERE, "..", ".."))           # 사이트 repo 루트
rd = lambda n: open(os.path.join(HERE, "engine", n), encoding="utf-8").read()

flat = json.load(open(os.path.join(BASE, "flat_styles.json"), encoding="utf-8"))
tree = json.load(open(os.path.join(BASE, "tree.json"), encoding="utf-8"))
stories = json.load(open(os.path.join(BASE, "stories.json"), encoding="utf-8"))
guide = json.load(open(os.path.join(HERE, "season_guide.json"), encoding="utf-8"))   # 시즌 테마·룩북(시즌별)

IMG_DIR = os.path.join(OUT, "catalog-img")
shutil.rmtree(IMG_DIR, ignore_errors=True)
os.makedirs(IMG_DIR)
_seen = {}

def ext_img(v):
    if not isinstance(v, str) or not v.startswith("data:image"):
        return v
    if v in _seen:
        return _seen[v]
    m = re.match(r"data:image/(\w+);base64,(.+)$", v, re.S)
    raw = base64.b64decode(m.group(2))
    ext = "jpg" if m.group(1) in ("jpeg", "jpg") else m.group(1)
    name = hashlib.sha1(raw).hexdigest()[:12] + "." + ext
    p = os.path.join(IMG_DIR, name)
    if not os.path.exists(p):
        open(p, "wb").write(raw)
    _seen[v] = "catalog-img/" + name
    return _seen[v]

# 상세 갤러리는 고화질본(thumbs_hq_big, build_hq_images.py가 생성)으로 — 같은 파일명의 작은 썸네일 바이트로 찾아 대체. 없으면 썸네일 그대로.
_thumb_names = {}
_td = os.path.join(BASE, "thumbs_hq")
for _fn in os.listdir(_td):
    _thumb_names[hashlib.sha1(open(os.path.join(_td, _fn), "rb").read()).hexdigest()] = _fn
n_big = 0

def ext_gallery(v):
    global n_big
    if not isinstance(v, str) or not v.startswith("data:image"):
        return v
    raw = base64.b64decode(v.split(",", 1)[1])
    fn = _thumb_names.get(hashlib.sha1(raw).hexdigest())
    bp = os.path.join(BASE, "thumbs_hq_big", fn) if fn else None
    if not bp or not os.path.exists(bp):
        return ext_img(v)
    bigraw = open(bp, "rb").read()
    name = hashlib.sha1(bigraw).hexdigest()[:12] + ".jpg"
    if not os.path.exists(os.path.join(IMG_DIR, name)):
        open(os.path.join(IMG_DIR, name), "wb").write(bigraw)
        n_big += 1
    return "catalog-img/" + name

KEEP = ["item_code", "display_code", "material", "season_tab", "seasons", "story", "plan", "body", "attr", "name_sjg", "name_kr",
        "rrp", "price_increase", "brim", "dustbag", "origin", "desc", "material_main", "material_full", "care", "tags",
        "ship_date", "sizes", "has_hq_gallery", "transition_note", "image", "length_cm", "fit", "lining"]
styles = {}
cache = {}
for code, s in flat.items():
    k = id(s)
    if k not in cache:
        o = {f: s[f] for f in KEEP if f in s}
        o["image"] = ext_img(o.get("image"))
        o["total"] = {"order": (s.get("total") or {}).get("order", 0)}
        o["colors"] = [{"color_code": c["color_code"], "color_kr": c.get("color_kr") or "", "image": ext_img(c.get("image")),
                        "swatch": c.get("swatch"), "cgroup": c.get("cgroup"), "gallery": [ext_gallery(g) for g in (c.get("gallery") or [])] or None,
                        "order": c.get("order", 0)} for c in s["colors"]]
        cache[k] = o
    styles[code] = cache[k]

# ---- 의류: 의류_입력양식.xlsx + 사진 폴더 -> 같은 STYLES/TREE/STORIES 모양으로 합친다(데이터가 있을 때만 의류 탭이 생김) ----
import sys; sys.path.insert(0, HERE)
import build_apparel
ap_styles, ap_tree, ap_stories = build_apparel.build(os.environ.get("APPAREL_DATA") or BASE, IMG_DIR)
if ap_styles:
    styles.update(ap_styles); tree["APPAREL"] = ap_tree; stories.update(ap_stories)

n_img = len(os.listdir(IMG_DIR))
size = sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR))

# ---- CSS: 대시보드 기본 CSS + 카탈로그 CSS ----
css = rd("base.css").replace("__CATALOG_CSS__", rd("catalog_detail.css") + "\n" + rd("catalog_view.css"))
css += """
/* 매장 배포 사이트: 블랙&화이트 */
:root { --bg: #fff; --surface: #fff; --surface-2: #f4f4f4; --ink: #111; --ink-soft: #666; --line: #e2e2e2; --line-strong: #8a8a8a;
  --accent: #111; --accent-soft: #f0f0f0; --good: #111; --good-bg: #f0f0f0; --warn: #111; --warn-bg: #f0f0f0; --crit: #111; --crit-bg: #eee; }
"""
css += """
button.fchip.group { background: #f0f0f0; border-color: #8a8a8a; color: #111; }
button.fchip.group .n { color: #111; }
button.fchip.group.active { background: #111; border-color: #111; color: #fff; }
button.fchip.group.active .n { color: #fff; }
header.cat-head { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; }
header.cat-head h1 { margin: 0; }
header.cat-head .map-search { flex: 0 1 380px; min-width: 220px; }
header.cat-head .map-search input { width: 100%; }
/* 태블릿 이상: 스토리명(좌) + 스토리 설명(우) 한 줄, 아이템 카드는 그 아래 전체 폭 */
@media (min-width: 700px) {
  .story-box { grid-template-columns: minmax(0, 1fr); }
  .sb-head { display: grid; grid-template-columns: minmax(220px, 360px) minmax(0, 1fr); column-gap: 32px; align-items: start; }
  .sb-head > .sb-eyebrow, .sb-head > .sb-title, .sb-head > .sb-count { grid-column: 1; }
  .sb-head > .sb-desc { grid-column: 2; grid-row: 1 / span 3; margin-top: 0; }
}
"""
css += """
/* Airbnb 스타일 레이어(DESIGN.md 참고): 사진 중심 카드, 알약 필터, 흑백 한 톤. 사진은 contain 유지(잘리지 않음) */
.story-box { background: #f5f5f5; border: 0; border-radius: 32px; padding: 26px 26px 30px; margin-bottom: 22px; }
.simple-thumb { background: #fff; }
@media (max-width: 700px) { .story-box { border-radius: 24px; padding: 20px 16px 24px; } }
.sb-cards { gap: 28px 16px; }
.simple-card { background: transparent; border: 0; border-radius: 14px; overflow: visible; }
.simple-card:hover { border-color: transparent; }
.simple-card:hover .simple-thumb { filter: brightness(.96); }
.simple-thumb { border-radius: 14px; }
.simple-body { padding: 10px 2px 0; }
.simple-name { font-weight: 500; font-size: 14px; color: #222; }
.simple-name-kr { color: #6a6a6a; }
.simple-price { font-size: 15px; font-weight: 600; margin: 4px 0 8px; }
.swatch-chip { background: #fff; border: 1px solid #e5e5e5; border-radius: 9999px; padding: 3px 9px 3px 6px; }
button.fchip { border-radius: 9999px; padding: 6px 14px; border-color: #ddd; background: #fff; }
button.fchip:hover { border-color: #222; }
button.fchip.active, button.fchip.group.active { background: #222; border-color: #222; color: #fff; }
button.fchip.active .n, button.fchip.group.active .n { color: #ddd; }
button.fchip.group { background: #f7f7f7; border-color: #ddd; color: #222; }
.cg-tag { font-size: 10.5px; padding: 1px 7px; border-radius: 9999px; line-height: 1.5; }
.cg-tag.cg-old { font-size: 10px; padding: 1px 6px; }
"""
css += """
/* 폰트: Noto Sans KR 통일 */
:root { --font-body: 'Noto Sans KR', sans-serif; --font-display: 'Noto Sans KR', sans-serif; --font-mono: 'Noto Sans KR', sans-serif; }
*, *::before, *::after { font-family: 'Noto Sans KR', sans-serif !important; }
"""
css += """
html, body { -webkit-text-size-adjust: 100%; }
body { overscroll-behavior-y: none; -webkit-tap-highlight-color: transparent; }
.wrap { padding: 18px 20px 40px; }
.cat-top { margin: 0 -20px 10px; padding: 10px 20px; }
nav.materials { margin: 12px 0 8px; overflow-x: auto; white-space: nowrap; }
.detail-close { padding: 14px 20px; }
.detail-inner { padding: 20px 20px 80px; }
@media (min-width: 700px) { .wrap { padding: 24px 28px 48px; } .cat-top { margin: 0 -28px 10px; padding: 10px 28px; } }
"""

js_helpers = """
function fmtNum(n) { return (n || 0).toLocaleString('ko-KR'); }
function rrpDisplay(s) {
  if (s.price_increase && s.price_increase.from && s.price_increase.to) {
    return `₩${fmtNum(parseInt(s.price_increase.from))} <span class="price-up-arrow">→ ₩${fmtNum(parseInt(s.price_increase.to))}</span> <span class="price-up-badge">인상예정</span>`;
  }
  return `₩${fmtNum(parseInt(s.rrp || 0))}`;
}
function mmdd(iso) { const t = String(iso || '').match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); return t ? `${t[2].padStart(2, '0')}/${t[3].padStart(2, '0')}` : ''; }
function seasonMonthRank(mo) { const n = parseInt(mo, 10); return n === 12 ? -1 : n; }
const seasonBadge = s => (s.seasons && s.seasons.includes('R27')) ? `<span class="season-badge">R27</span>` : '';
let detailState = { story: null, product: null };
const STYLE_PLAN_RANK = { '모자': 0, '가방': 1, '액세서리': 2 };
const styleBodyRank = b => /^클로슈/.test(b) ? 0 : /^버킷/.test(b) ? 1 : /^보터/.test(b) ? 2 : 3;
function styleOrderKey(s, qty) {
  const sr = (s.seasons && s.seasons.length && !s.seasons.includes('R27')) ? 1 : 0;
  const pr = STYLE_PLAN_RANK[s.plan] !== undefined ? STYLE_PLAN_RANK[s.plan] : 3;
  return [sr, pr, pr === 0 ? styleBodyRank(s.body || '') : 0, -qty];
}
const cmpOrderKey = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3];
function sortStyleCodes(codes) {
  if (codes.some(c => STYLES[c] && STYLES[c].material === 'ICONIC')) return codes;
  const key = c => styleOrderKey(STYLES[c] || {}, (STYLES[c] && STYLES[c].total && STYLES[c].total.order) || 0);
  return codes.slice().sort((x, y) => cmpOrderKey(key(x), key(y)));
}
"""

html = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>상품 설명집</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap">
<style>:root{color-scheme:light}[hidden]:not([hidden=until-found i]){display:none!important}img{max-width:100%}</style>
<style>__CSS__</style>
</head>
<body>
<div class="wrap">
  <header class="page cat-head"><h1>상품 설명집</h1><div class="map-search"><input type="search" id="catSearch" placeholder="전체 검색: 품명(영문·한글)/품번" autocomplete="off"><span class="map-search-count" id="catSearchCount"></span></div></header>
  <div class="page-view active" id="catalogView">
    <nav class="materials" id="catMaterialTabs"></nav>
    <nav class="materials subtabs" id="catSubTabs" hidden></nav>
    <div class="filters">
      <div class="cat-top"><div class="fchips" id="catPlanRow"></div></div>
      <div class="filters-rest" id="catFilters"></div>
    </div>
    <div id="catStories"></div>
    <div id="catTheme" hidden></div>
    <div id="catLook" hidden></div>
  </div>
</div>
<div class="detail-overlay" id="detail-overlay">
  <button class="detail-close" onclick="closeDetail()">← 상품 설명집으로 돌아가기</button>
  <div class="detail-inner">
    <div class="crumb" id="crumb"></div>
    <section class="dview" id="dview-product"></section>
  </div>
</div>
<script>
window.CATALOG_GLOBAL_SEARCH = true;
window.SEASON_GUIDE = __GUIDE__;
const TREE = __TREE__;
const STYLES = __STYLES__;
const STORIES = __STORIES__;
__HELPERS__
__DETAIL_JS__
__VIEW_JS__
window.catalogShow();
// 대시보드 등에서 #product=품번 / #story=스토리명 으로 들어오면 해당 상품·스토리로 바로 이동
(function () { const m = decodeURIComponent(location.hash.slice(1)).match(/^(product|story)=(.+)$/); if (m) window.catalogLand(m[1], m[2]); })();
</script>
<script src="fs.js"></script>
</body>
</html>
"""
dumps = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
html = (html.replace("__CSS__", css).replace("__TREE__", dumps(tree)).replace("__STYLES__", dumps(styles))
        .replace("__STORIES__", dumps(stories)).replace("__GUIDE__", dumps(guide)).replace("__HELPERS__", js_helpers)
        .replace("__DETAIL_JS__", rd("catalog_detail.js")).replace("__VIEW_JS__", rd("catalog_view.js")))
assert "data:image" not in html
open(os.path.join(OUT, "catalog.html"), "w", encoding="utf-8").write(html)
print("catalog.html", len(html) // 1024, "KB / 이미지", n_img, "장(고화질", n_big, "장)", size // 1024, "KB")
