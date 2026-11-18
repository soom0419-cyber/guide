# -*- coding: utf-8 -*-
# SS27 의류: 'SS27 의류 상품설명.xlsx'(상품목록 시트, 한 줄 = 컬러 하나) + 'SS27 의류 이미지' 폴더 -> 상품 설명집 SS27 탭에 들어갈 STYLES/TREE/STORIES.
# 형식 결정 목록은 메모리 project_apparel_catalog_ss27.md 참고(그룹 박스, 품명, 컬러, 혼용률, 소재, 설명, 사진, 채널).
import os, re, hashlib, datetime, collections
from io import BytesIO

ROOT = r"Z:\★브랜드 기획실\기획\2. ORDER_BY SEASON\23. SS 2027\3. 상품 설명집"
XLSX = os.environ.get("APPAREL_SS27_XLSX") or os.path.join(ROOT, "SS27 의류 상품설명.xlsx")
PHOTOS = os.environ.get("APPAREL_SS27_PHOTOS") or os.path.join(ROOT, "SS27 의류 이미지")
CARD_PX = 800     # 카드용: 긴 변
FULL_PX = 1600    # 상세·확대용: 긴 변

# ---- 정렬: 아우터 > 원피스 > 상의 > 하의 > 악세사리 (복종 -> 분류) ----
CAT_OF_BODY = {"아우터자켓": 0, "재킷": 0, "가디건": 0, "판초": 0, "베스트": 0,
               "우븐드레스": 1, "니트드레스": 1,
               "우븐탑": 2, "니트탑": 2, "져지탑": 2, "셔츠": 2,
               "우븐팬츠": 3, "우븐스커트": 3, "니트팬츠": 3}

# ---- 컬러: 컬러코드표 기준 이름 + 이름 기준 근사색(점) ----
COLOR_NAME = {"BK": "블랙", "WH": "화이트", "IV": "아이보리", "CR": "크림", "BE": "베이지", "LE": "라이트 베이지", "CA": "카멜", "OM": "오트밀",
              "BR": "브라운", "CH": "챠콜", "LG": "라이트 그레이", "NV": "네이비", "BL": "블루", "LB": "라이트 블루", "PK": "핑크", "LP": "라이트 핑크",
              "BN": "버건디", "SG": "세이지", "MU": "멀티", "MT": "민트", "KH": "카키", "GN": "그린"}
COLOR_HEX = {"BK": "#1c1c1c", "WH": "#fafafa", "IV": "#f5efe0", "CR": "#f1e8d2", "BE": "#d8c3a5", "LE": "#e8dcc6", "CA": "#c19a6b", "OM": "#d9ccb4",
             "BR": "#6b4a34", "CH": "#3a3a3c", "LG": "#c9c9c9", "NV": "#1f2a4a", "BL": "#4f6fa8", "LB": "#a9c4e0", "PK": "#e8a6b4", "LP": "#f3cfd6",
             "BN": "#6d1f2f", "SG": "#a3b18a", "MT": "#a8d5c2", "KH": "#8a8a5c", "GN": "#4f7a52",
             "MU": "conic-gradient(#c8553d,#e0b040,#5b9a6b,#4f6fa8,#8a5aa0,#c8553d)"}

# ---- 혼용률: 사용자가 의미를 알려준 3건은 직접 지정 ----
MIX_OVERRIDE = {
    "LYSRWD00060": "겉감: 86% 면 14% 폴리에스터, 안감: 81% 면 19% 나일론",
    "LYSRWT00050": "겉감: 71% 면 29% 나일론, 배색: 100% 면",
    "LYSRWD00090": "겉감: 52% 면 48% 폴리에스터, 안감(슬립): 100% 폴리에스터",
}
LINING_TBD = "업데이트 예정"


def _mat(m):
    m = re.sub(r"\s+", " ", m.strip())
    m = m.replace("코튼", "면")
    m = re.sub(r"폴리(?!에스터|우레탄)", "폴리에스터", m)
    m = re.sub(r"\bPU\b", "폴리우레탄", m)
    return m


def _comps(text):
    """'면 90% 견 10%' / '코튼52 폴리48' / '코튼/폴리=86/14' / '나일론 13%(RE-NY 9%)' -> [(pct, 소재, 괄호메모)]"""
    t = text.strip().rstrip(",")
    m = re.match(r"^([^=\d]+)=([\d/]+)$", t)
    if m:
        mats, nums = m.group(1).split("/"), m.group(2).split("/")
        return [(n, _mat(x), "") for n, x in zip(nums, mats)]
    out = []
    for mt in re.finditer(r"([^\d%()]+?)\s*(\d+(?:\.\d+)?)\s*%?\s*(\([^)]*\))?", t):
        name = _mat(mt.group(1))
        if name:
            out.append((mt.group(2), name, mt.group(3) or ""))
    # 앞쪽 괄호 메모만 있는 경우('면 100% (오가닉)'): 마지막 소재에 붙인다
    tail = re.search(r"\(([^)]*)\)\s*$", t)
    if tail and out and not out[-1][2]:
        out[-1] = (out[-1][0], out[-1][1], "(" + tail.group(1) + ")")
    return out


def _fmt(comps):
    return " ".join(f"{n}% {m}{memo}" for n, m, memo in comps)


def convert_mix(code, raw):
    """엑셀 혼용률 -> 컬렉션 형식('겉감: 90% 면 10% 견, 안감: 100% 큐프로'). 반환: (표시 문자열, 겉감 성분 리스트, 경고)"""
    raw = (raw or "").strip()
    if code in MIX_OVERRIDE:
        txt = MIX_OVERRIDE[code]
        main = txt.split(",")[0].replace("겉감:", "")
        return txt, _comps(main), []
    if not raw or raw == "None":
        return "", [], []
    warn = []
    lines = [l.strip() for l in raw.replace("\r", "").split("\n") if l.strip()]
    # 세트 상품: 줄마다 끝에 (상의)/(하의) 같은 부위가 붙은 경우 -> "상의: 100% 면, 하의: 71% 면 29% 나일론"
    suf = [re.match(r"^(.*?)\s*\((상의|하의|겉감|안감|배색|슬립)\)\s*$", l) for l in lines]
    if lines and all(suf):
        parts, main = [], []
        for m in suf:
            cs = _comps(m.group(1))
            main = main or cs
            parts.append(f"{m.group(2)}: {_fmt(cs)}")
            tot = sum(float(n) for n, _, _ in cs)
            if cs and abs(tot - 100) > 0.5:
                warn.append(f"{m.group(2)} 합계 {tot:g}%")
        return ", ".join(parts), main, warn
    labeled = [l for l in lines if re.match(r"^(겉감?|안감|배색)\s*:", l)]
    if labeled and len(labeled) == len(lines):
        parts, main = [], []
        for l in lines:
            lab, body = re.split(r"\s*:\s*", l, 1)
            lab = {"겉": "겉감"}.get(lab, lab)
            cs = _comps(body)
            if lab == "겉감":
                main = cs
            parts.append(f"{lab}: {_fmt(cs)}")
        txt = ", ".join(parts)
    else:
        lin = None
        rest = []
        for l in lines:
            mm = re.match(r"^\(?\s*안감\s*/?\s*(.*?)\s*\)?$", l)
            if mm and not re.match(r"^안감\s*:", l):
                lin = mm.group(1).strip()
                continue
            rest.append(l)
        text = " ".join(rest)
        m = re.search(r"\s*[/(]\s*안감\s*/?\s*(.*?)\s*\)?\s*$", text)
        if m:
            lin = m.group(1).strip()
            text = text[:m.start()]
        main = _comps(text)
        txt = f"겉감: {_fmt(main)}"
        if lin is not None:
            txt += f", 안감: {_fmt(_comps(lin)) if lin else LINING_TBD}"
    tot = sum(float(n) for n, _, _ in main)
    if main and abs(tot - 100) > 0.5:
        warn.append(f"겉감 합계 {tot:g}%")
    return txt, main, warn


def derive_material(main):
    """소재 구분 빈칸 추정(엑셀에 값이 있으면 쓰지 않는다)."""
    d = {m: float(n) for n, m, _ in main}
    has = lambda k: any(k in m for m in d)
    if has("가죽"):
        return "LEATHER"
    if has("리싸이클") and has("나일론"):
        return "RECYCLED NYLON"
    if has("리싸이클") and "폴리" in "".join(d):
        return "RECYCLED POLYESTER"
    wool = sum(v for m, v in d.items() if m in ("모", "울"))
    if wool > 0:
        return "WOOL" if wool >= 99.5 else "WOOL BLEND"
    if has("견"):
        return "SILK" if d.get("견", 0) >= 99.5 else "SILK BLEND"
    if has("마"):
        return "LINEN" if d.get("마", 0) >= 99.5 else "LINEN BLEND"
    if has("면"):
        return "COTTON"
    if has("레이온") or has("비스코스"):
        return "VISCOSE"
    return ""


def clean_desc(v):
    out, seen = [], set()
    for l in str(v or "").replace("\r", "").split("\n"):
        l = re.sub(r"\s+", " ", l).strip()
        if not l or re.fullmatch(r"[✓✔·\-\u2022\s]+", l):
            continue
        k = re.sub(r"\s", "", l)
        if k in seen:
            continue
        seen.add(k)
        out.append(l)
    return out


def _tags(v):
    out = []
    for t in re.split(r"[,/]", str(v or "")):
        t = t.strip()
        t = {"HOLYDAY": "HOLIDAY"}.get(t.upper(), t)
        if t and t != "스튜디오" and t not in out:
            out.append(t)
    return out


def _lining(v):
    v = str(v or "").strip()
    if not v or v == "None":
        return ""
    if re.match(r"^[oO]\s*\(슬립\)", v):
        return "있음(슬립)"
    return {"o": "있음", "x": "없음"}.get(v.lower(), v)


def _put(img_dir, raw, ext=".jpg"):
    n = hashlib.sha1(raw).hexdigest()[:12] + ext
    p = os.path.join(img_dir, n)
    if not os.path.exists(p):
        open(p, "wb").write(raw)
    return "catalog-img/" + n


def _jpg(path, long_px, q):
    from PIL import Image, ImageOps
    im = Image.open(path)
    im.draft("RGB", (long_px * 2, long_px * 2))
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((long_px, long_px), Image.LANCZOS)
    b = BytesIO()
    im.save(b, "JPEG", quality=q, optimize=True, progressive=True)
    return b.getvalue()


def build(img_dir):
    """반환: (styles, tree_add, stories). tree_add = [(월키, 주키, 그룹명, 품번, 출고일)] — 호출 쪽이 COLLECTION_SS27 트리에 합친다."""
    if not os.path.exists(XLSX):
        print("[의류 SS27] 엑셀 없음 ->", XLSX)
        return {}, [], {}, {}
    import openpyxl
    ws = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)["상품목록"]
    rows = list(ws.iter_rows(values_only=True))
    head = [str(h or "").strip() for h in rows[0]]
    ix = {h: i for i, h in enumerate(head)}
    col = lambda name: next((i for h, i in ix.items() if h.startswith(name)), None)
    C = dict(code=col("품번"), season=col("시즌"), plan=col("기획명"), body=col("복종"), story=col("스토리"), en=col("품명(영문)"), kr=col("품명(한글)"),
             attr=col("소재 구분"), price=col("판매가"), ship=col("출고일"), cc=col("컬러코드"), cn=col("컬러명"), size=col("사이즈"),
             desc=col("상품 설명"), mix=col("소재 전체"), care=col("관리 방법"), origin=col("원산지"), tags=col("태그"), fit=col("핏"), lining=col("안감"))
    get = lambda r, k: (r[C[k]] if C[k] is not None and C[k] < len(r) else None)

    # 사진: [품번] 품명.jpg(대표) / [품번] 품명_컬러코드.jpg(컬러별)
    photo_files = collections.defaultdict(list)
    if os.path.isdir(PHOTOS):
        for f in sorted(os.listdir(PHOTOS)):
            m = re.match(r"^\[(\w+)\]\s*(.*?)(?:_([A-Z]{2}))?\.(jpe?g|png)$", f, re.I)
            if m:
                photo_files[m.group(1)].append((m.group(3) or "", os.path.join(PHOTOS, f)))

    warn, styles, order = [], collections.OrderedDict(), []
    facts = {"products": {}, "extra_photos": [], "mix_nonstandard": []}   # 리마크(build_remarks.py)용 점검 자료
    for n, r in enumerate(rows[1:], start=2):
        if not any(c not in (None, "") for c in r):
            continue
        code = str(get(r, "code") or "").strip()
        if not code or str(get(r, "season") or "").strip() != "SS27":
            continue                                  # AW26 샘플 행 등은 제외
        if code not in styles:
            en, kr = str(get(r, "en") or "").strip(), str(get(r, "kr") or "").strip()
            channel = ""
            if re.search(r"\(U\)\s*$", en):
                channel = "아울렛 전용"
            elif re.search(r"\(M\)\s*$", en):
                channel = "온라인 단독"
            clean = lambda s: re.sub(r"\s*\([UM]\)\s*$", "", re.sub(r"^\[(STUDIO|스튜디오)\]\s*", "", s, flags=re.I)).strip()
            studio = bool(re.match(r"^\[(STUDIO|스튜디오)\]", en, re.I))
            en_c, kr_c = clean(en), clean(kr)
            group = en_c.split()[0]
            mix_txt, main, w = convert_mix(code, get(r, "mix"))
            for x in w:
                warn.append(f"{code} 혼용률 {x}")
            attr = str(get(r, "attr") or "").strip()
            attr = "" if attr == "None" else attr
            if not attr:
                attr = derive_material(main)
            ship = get(r, "ship")
            ship = ship.strftime("%Y-%m-%d") if isinstance(ship, (datetime.date, datetime.datetime)) else (str(ship or "").strip()[:10] if str(ship or "") not in ("None",) else "")
            if channel:
                ship = ""                              # 아울렛/온라인 단독은 출고일 없음('-')
            care = str(get(r, "care") or "").strip()
            care_lines = [l.strip() for l in care.split("\n") if l.strip() and l.strip() not in ("None", "기획실 업데이트 예정")]
            story_cell = str(get(r, "story") or "").strip()
            story_cell = "" if story_cell == "None" else story_cell
            tag = "STUDIO" if studio else story_cell
            styles[code] = {
                "item_code": code, "display_code": code, "material": "COLLECTION", "season_tab": "SS27", "seasons": [], "story": group,
                "plan": "의류", "body": str(get(r, "body") or "").strip(), "attr": attr, "name_sjg": en_c, "name_kr": kr_c,
                "rrp": str(int(float(get(r, "price") or 0))), "price_increase": None, "brim": None, "dustbag": None,
                "origin": str(get(r, "origin") or "").strip(), "desc": clean_desc(get(r, "desc")),
                "material_main": (re.sub(r"^겉감:\s*", "", mix_txt.split(", ")[0]) if mix_txt else ""), "material_full": mix_txt,
                "care": care_lines or ["업데이트 예정"], "tags": _tags(get(r, "tags")), "ship_date": ship,
                "sizes": [x.strip() for x in str(get(r, "size") or "").split("/") if x.strip()], "has_hq_gallery": False, "image": None,
                "length_cm": "", "fit": (lambda v: "" if v in ("", "None") else v)(str(get(r, "fit") or "").strip()), "lining": _lining(get(r, "lining")),
                "total": {"order": 0}, "colors": [], "channel": channel, "group_tag": tag}
            order.append(code)
            facts["products"][code] = {"rows": [], "override": code in MIX_OVERRIDE, "attr_derived": (not str(get(r, "attr") or "").strip() or str(get(r, "attr")).strip() == "None") and bool(attr),
                                       "tag_fixed": "HOLYDAY" in str(get(r, "tags") or "").upper(), "wool_mo": False, "wool_ul": False}
        cc = str(get(r, "cc") or "").strip()
        _mt, _mm, _mw = convert_mix(code, get(r, "mix"))
        for x in _mw:
            _wm = f"{code} {get(r, 'cc')} 혼용률 {x}"
            if _wm not in warn and f"{code} 혼용률 {x}" not in warn:
                warn.append(_wm)
        styles[code].setdefault("_mix_by_color", []).append((cc, _mt))
        _a = str(get(r, "attr") or "").strip()
        facts["products"][code]["rows"].append({"cc": cc, "mix_raw": str(get(r, "mix") or ""), "mix_txt": _mt, "warn": _mw,
                                                 "attr_raw": "" if _a == "None" else _a, "desc_raw": str(get(r, "desc") or "")})
        if re.search(r"\d% 모(?!\w)", _mt):
            facts["products"][code]["wool_mo"] = True
        if re.search(r"\d% 울", _mt):
            facts["products"][code]["wool_ul"] = True
        nm = COLOR_NAME.get(cc) or str(get(r, "cn") or "").strip()
        if cc in COLOR_NAME and COLOR_NAME[cc] != str(get(r, "cn") or "").strip():
            pass
        styles[code]["colors"].append({"color_code": cc, "color_kr": nm, "image": None, "swatch": COLOR_HEX.get(cc), "cgroup": None,
                                       "gallery": None, "order": 0})
        if cc not in COLOR_HEX:
            warn.append(f"{code} 컬러 {cc}({nm}): 근사색 없음")

    # 혼용률: 컬러별로 다르면 "컬러코드 : 혼용"으로 따로 적는다(같은 혼용률인 컬러는 코드를 묶는다)
    n_mix_diff = 0
    for code, s in styles.items():
        per = s.pop("_mix_by_color", [])
        texts = [t for _, t in per if t]
        if len(set(texts)) > 1:
            n_mix_diff += 1
            groups = collections.OrderedDict()
            for cc_, t in per:
                groups.setdefault(t or "-", []).append(cc_)
            s["material_full"] = "\n".join(f"{', '.join(v)} : {k}" for k, v in groups.items())
            s["mix_by_color"] = True
    print(f"[의류 SS27] 컬러별 혼용률이 다른 상품 {n_mix_diff}개")

    # 사진 처리
    n_photo = 0
    for code, s in styles.items():
        files = photo_files.get(code, [])
        photos = []
        for tag, path in sorted(files, key=lambda x: (x[0] != "", x[0])):
            thumb = _put(img_dir, _jpg(path, CARD_PX, 80))
            full = _put(img_dir, _jpg(path, FULL_PX, 82))
            photos.append({"tag": tag, "thumb": thumb, "full": full})
            n_photo += 1
        s["photos"] = photos
        s["image"] = photos[0]["thumb"] if photos else None
        s["has_hq_gallery"] = bool(photos)
        if not photos:
            warn.append(f"{code} 사진 없음")
        # 컬러가 2개 이상인데 사진이 한 컬러(또는 대표 1컷)뿐이면 안내 문구
        tagged = [p for p in photos if p["tag"]]
        s["photo_note"] = bool(len(s["colors"]) > 1 and len(tagged) < len(s["colors"]))
    facts["extra_photos"] = [c for c in photo_files if c not in styles]
    for code, fx in facts["products"].items():
        if any(("=" in r["mix_raw"]) or re.search(r"[가-힣]\d", r["mix_raw"]) or ("%" not in r["mix_raw"]) for r in fx["rows"]):
            facts["mix_nonstandard"].append(code)
    # 그룹 순서: 가장 이른 출고일 -> 엑셀 등장 순, 출고일 없는 그룹은 맨 뒤
    first_ship = {}
    first_idx = {}
    for i, code in enumerate(order):
        g = styles[code]["story"]
        first_idx.setdefault(g, i)
        d = styles[code]["ship_date"]
        if d and (g not in first_ship or d < first_ship[g]):
            first_ship[g] = d
    group_order = sorted(first_idx, key=lambda g: (first_ship.get(g, "9999"), first_idx[g]))
    tree_add, stories = [], {}
    for g in group_order:
        tags = [styles[c]["group_tag"] for c in order if styles[c]["story"] == g and styles[c]["group_tag"]]
        tag = tags[0] if tags else ""
        stories[g] = {"eyebrow": "SS27 APPAREL" + (f" · {tag}" if tag else ""), "bullets": []}
        for code in [c for c in order if styles[c]["story"] == g]:
            d = styles[code]["ship_date"]
            m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", d)
            mo, wk = (str(int(m.group(2))), str((int(m.group(3)) - 1) // 7 + 1)) if m else ("99", "1")
            tree_add.append((mo, wk, g, code, d))
    for w in warn:
        print("[의류 SS27 검증]", w)
    print(f"[의류 SS27] 상품 {len(styles)}개 / 컬러 {sum(len(s['colors']) for s in styles.values())}개 / 그룹 {len(group_order)}개 / 사진 {n_photo}장 / 경고 {len(warn)}건")
    return styles, tree_add, stories, facts
