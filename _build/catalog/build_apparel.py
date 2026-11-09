# -*- coding: utf-8 -*-
# 의류_입력양식.xlsx(상품목록 시트) + 사진 폴더 -> 상품 설명집 STYLES/TREE/STORIES 항목.
# 한 줄 = 컬러 하나. 같은 품번 줄은 한 상품으로 합친다(상품 단위 항목은 첫 줄 값 사용).
# 사진은 DATA\의류_사진\ 에 두고 엑셀에는 파일명만 적는다. 카드용 작은 사진 + 상세용 원본을 catalog-img/ 에 내보낸다.
# 유효한 행(컬러 사진이 실제로 있는 것)이 없으면 빈 결과를 돌려주고, 그러면 사이트에 의류 탭이 생기지 않는다.
import os, re, hashlib, datetime
from io import BytesIO

XLSX = "의류_입력양식.xlsx"
PHOTO_DIR = "의류_사진"
REQUIRED = ["품번", "시즌", "스토리", "품명(영문)", "품명(한글)", "판매가", "출고일", "컬러코드", "컬러명", "컬러 사진 파일명"]
THUMB_W = 800  # 카드용 가로 px (상세 갤러리는 원본 그대로)


def _name(raw, ext):
    return hashlib.sha1(raw).hexdigest()[:12] + ext


def _put(img_dir, raw, ext):
    n = _name(raw, ext)
    p = os.path.join(img_dir, n)
    if not os.path.exists(p):
        open(p, "wb").write(raw)
    return "catalog-img/" + n


def _thumb(raw):
    from PIL import Image
    im = Image.open(BytesIO(raw))
    im = im.convert("RGB")
    if im.width > THUMB_W:
        im = im.resize((THUMB_W, round(im.height * THUMB_W / im.width)), Image.LANCZOS)
    b = BytesIO()
    im.save(b, "JPEG", quality=88, optimize=True)
    return b.getvalue()


def _lines(v):
    return [x.strip() for x in str(v or "").replace("\r", "").split("\n") if x.strip()]


def _list(v, sep):
    return [x.strip() for x in str(v or "").split(sep) if x.strip()]


def build(data_dir, img_dir):
    path = os.path.join(data_dir, XLSX)
    if not os.path.exists(path):
        return {}, {}, {}
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True)["상품목록"]
    rows = list(ws.iter_rows(values_only=True))
    head = [str(h or "").strip() for h in rows[0]]
    ix = {h: i for i, h in enumerate(head)}
    miss_cols = [c for c in REQUIRED if c not in ix]
    if miss_cols:
        print("[의류] 필수 열 없음:", miss_cols)
        return {}, {}, {}
    get = lambda r, k: (r[ix[k]] if k in ix and ix[k] < len(r) else None)

    photos = os.path.join(data_dir, PHOTO_DIR)
    warn, styles, first = [], {}, {}
    for n, r in enumerate(rows[1:], start=2):
        if not any(c not in (None, "") for c in r):
            continue
        code = str(get(r, "품번") or "").strip()
        if not code:
            warn.append(f"{n}행: 품번 없음 -> 건너뜀")
            continue
        base = first.setdefault(code, r)                       # 상품 단위 항목은 첫 줄 값, 비어 있으면 현재 줄 값
        pick = lambda k: get(base, k) if get(base, k) not in (None, "") else get(r, k)
        per_color = ("컬러코드", "컬러명", "컬러 사진 파일명")
        miss = [k for k in REQUIRED if (get(r, k) if k in per_color else pick(k)) in (None, "")]
        if miss:
            warn.append(f"{n}행 {code}: 필수 항목 비어 있음 {miss}")
        cf = str(get(r, "컬러 사진 파일명") or "").strip()
        cp = os.path.join(photos, cf) if cf else ""
        if not (cf and os.path.isfile(cp)):
            warn.append(f"{n}행 {code} {get(r, '컬러코드')}: 컬러 사진 없음 ({cf or '파일명 비어 있음'}) -> 이 컬러 제외")
            continue
        raw = open(cp, "rb").read()
        gallery = []
        for g in _list(get(r, "상세 사진 파일명(여러 장은 콤마)"), ","):
            gp = os.path.join(photos, g)
            if os.path.isfile(gp):
                gb = open(gp, "rb").read()
                gallery.append(_put(img_dir, gb, os.path.splitext(g)[1].lower() or ".jpg"))
            else:
                warn.append(f"{n}행 {code}: 상세 사진 없음 ({g})")
        color = {"color_code": str(get(r, "컬러코드")).strip(), "color_kr": str(get(r, "컬러명") or "").strip(),
                 "image": _put(img_dir, _thumb(raw), ".jpg"), "swatch": None, "cgroup": None, "gallery": gallery or None, "order": 0}
        if code not in styles:
            season = str(pick("시즌") or "").strip()
            ship = pick("출고일")
            ship = ship.strftime("%Y-%m-%d") if isinstance(ship, (datetime.date, datetime.datetime)) else str(ship or "")
            styles[code] = {
                "item_code": code, "display_code": code, "material": "APPAREL", "season_tab": season, "seasons": [], "story": str(pick("스토리") or ""),
                "plan": "의류", "body": str(pick("복종") or ""), "attr": str(pick("소재 구분") or ""),
                "name_sjg": str(pick("품명(영문)") or ""), "name_kr": str(pick("품명(한글)") or ""),
                "rrp": int(pick("판매가") or 0), "price_increase": None, "brim": None, "dustbag": None,
                "origin": str(pick("원산지") or ""), "desc": _lines(pick("상품 설명(줄바꿈으로 구분)")),
                "material_main": str(pick("소재 주성분") or ""), "material_full": str(pick("소재 전체(혼용률)") or ""),
                "care": _lines(pick("관리 방법(줄바꿈으로 구분)")), "tags": _list(pick("태그(콤마)"), ","),
                "ship_date": ship, "sizes": _list(pick("사이즈"), "/"), "has_hq_gallery": False, "image": None,
                "length_cm": pick("기장(cm)") or "", "fit": str(pick("핏") or ""), "lining": str(pick("안감") or ""),
                "total": {"order": 0}, "colors": []}
        styles[code]["colors"].append(color)
        if gallery:
            styles[code]["has_hq_gallery"] = True
    for s in styles.values():
        s["image"] = s["colors"][0]["image"]

    tree, stories = {}, {}
    for code, s in styles.items():
        m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s["ship_date"])
        mo, day = (str(int(m.group(2))), int(m.group(3))) if m else ("0", 1)
        wk = tree.setdefault(mo, {}).setdefault(str((day - 1) // 7 + 1), {"thursday": s["ship_date"], "stories": []})
        g = next((x for x in wk["stories"] if x["story"] == s["story"]), None)
        if not g:
            g = {"story": s["story"], "total_order": 0, "styles": []}
            wk["stories"].append(g)
        g["styles"].append(code)
    for w in warn:
        print("[의류 검증]", w)
    print(f"[의류] 상품 {len(styles)}개 / 컬러 {sum(len(s['colors']) for s in styles.values())}개 / 경고 {len(warn)}건")
    return styles, tree, stories
