# -*- coding: utf-8 -*-
# 내부 리마크(remarks.json): 자동 점검 + 수동(remarks_manual.json). 화면에서는 admin 전체 / 김수용 의류만 보인다(catalog_view.js).
# 항목: {type: 확인 필요|업데이트 필요|오류 수정, scope: apparel|general, text, items: [품번], badge: 카드에 ! 배지를 붙일지}
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
CHK, UPD, ERR = "확인 필요", "업데이트 필요", "오류 수정"

# 설명 오탈자 의심 단어 (확실한 교정이 아닌 것은 후보로만 표시)
TYPOS = [
    (r"훌지는", "'훌지는' — 오타 의심"),
    (r"얖\s*옆", "'얖 옆' — '양 옆' 오타 의심"),
    (r"여유로은", "'여유로은' → '여유로운'"),
    (r"씨어써커", "'씨어써커' — 품명 표기('시어서커')와 다름"),
    (r"네추럴|네츄럴", "'네추럴/네츄럴' → '내추럴'"),
]


def _norm(t):
    return re.sub(r"\s+", "", str(t or ""))


def build(styles, facts, manual_path=None):
    out = []

    def add(typ, scope, text, items=None, badge=True):
        out.append({"type": typ, "scope": scope, "text": text, "items": sorted(set(items or [])), "badge": bool(badge)})

    ap = {c: s for c, s in styles.items() if s.get("plan") == "의류"}
    f = facts.get("products", {})

    # ---------- 의류: 확인 필요 ----------
    for code, fx in f.items():
        s = ap.get(code)
        if not s:
            continue
        rows = fx["rows"]
        for r in rows:
            for w in r["warn"]:
                add(CHK, "apparel", f"혼용률 {w} ({r['cc']} 컬러) — 합계가 100%가 아님, 엑셀 확인", [code])
        # 안감 칸 vs 혼용률
        lin = s.get("lining", "")
        lin_cols = [r["cc"] for r in rows if re.search(r"안감(\([^)]*\))?: (?!업데이트 예정)", r["mix_txt"] or "")]
        if lin.startswith("없음") and lin_cols:
            add(CHK, "apparel", f"안감 칸은 '없음'인데 혼용률에는 안감이 적혀 있음 ({', '.join(lin_cols)} 컬러)", [code])
        if lin.startswith("있음") and not lin_cols and not any("안감" in (r["mix_txt"] or "") for r in rows):
            add(UPD, "apparel", "안감 칸은 '있음'인데 혼용률에 안감 정보가 없음", [code])
        raws = {_norm(r["mix_raw"]) for r in rows}
        if fx.get("override") and len(raws) > 1:
            add(CHK, "apparel", "컬러별 엑셀 혼용률 원본이 달라(예: 한 컬러에만 '(안감)' 추가) 지정한 표기를 모든 컬러에 적용 중", [code])
        attrs = {r["attr_raw"] for r in rows if r["attr_raw"]}
        if len(attrs) > 1:
            add(CHK, "apparel", "컬러별 소재 구분이 다름: " + " / ".join(f"{r['cc']} {r['attr_raw'] or '(빈칸)'}" for r in rows) + " — 화면에는 첫 컬러 기준", [code])
        descs = {_norm(r["desc_raw"]) for r in rows}
        if len(descs) > 1:
            add(CHK, "apparel", f"컬러별 설명이 다름 — 화면에는 첫 컬러({rows[0]['cc']}) 설명만 표시 중, 나머지 컬러 설명 확인 필요", [code])
        en = s["name_sjg"].upper()
        if "COTTON BLEND" in en and s["attr"].startswith("LINEN"):
            add(CHK, "apparel", f"품명은 COTTON BLEND인데 소재 구분은 {s['attr']}", [code])
        if "LINEN BLEND" in en and s["attr"] == "COTTON":
            add(CHK, "apparel", "품명은 LINEN BLEND인데 소재 구분은 COTTON", [code])
        if fx.get("tag_fixed"):
            add(ERR, "apparel", "태그 'HOLYDAY' → 사이트에는 'HOLIDAY'로 보정해 표시 중 (엑셀 수정 필요)", [code])
        # 설명 오탈자 후보 / 띄어쓰기
        hits = []
        for l in s.get("desc", []):
            for pat, msg in TYPOS:
                if re.search(pat, l) and msg not in hits:
                    hits.append(msg)
        if hits:
            add(ERR, "apparel", "설명 오탈자 후보: " + ", ".join(hits), [code])
        tight = [l for l in s.get("desc", []) if len(re.findall(r"[가-힣]", l)) >= 25 and l.count(" ") <= 1]
        if tight:
            add(ERR, "apparel", f"설명에 띄어쓰기가 거의 없는 줄 {len(tight)}개 — 엑셀에서 띄어쓰기 정리 필요", [code])
        if not s.get("ship_date") and not s.get("channel"):
            add(UPD, "apparel", "출고일이 비어 있음", [code])
        # 안감 혼용률 미입력
        tbd = [r["cc"] for r in rows if "안감: 업데이트 예정" in (r["mix_txt"] or "")]
        if tbd:
            add(UPD, "apparel", f"안감 혼용률 미입력 ({', '.join(tbd)} 컬러) — 화면에 '업데이트 예정'으로 표시 중", [code])

    # ---------- 의류: 요약(카드 배지 없음, 상세·목록에만) ----------
    est = [c for c, fx in f.items() if fx.get("attr_derived")]
    if est:
        add(CHK, "apparel", f"소재 구분 빈칸 {len(est)}개 상품은 혼용률로 추정해 표시 중(엑셀에 값이 있으면 그 값 사용)", est, badge=False)
    care = [c for c, s in ap.items() if s.get("care") == ["업데이트 예정"]]
    if care:
        add(UPD, "apparel", f"관리 방법 미입력 {len(care)}개 상품 — 화면에 '업데이트 예정'으로 표시 중", care, badge=False)
    note = [c for c, s in ap.items() if s.get("photo_note")]
    if note:
        add(UPD, "apparel", f"컬러가 2개 이상인데 사진이 대표 1컷뿐인 상품 {len(note)}개 — 컬러별 사진 업데이트 필요", note, badge=False)
    nophoto = [c for c, s in ap.items() if not s.get("photos")]
    if nophoto:
        add(UPD, "apparel", f"사진이 없는 상품 {len(nophoto)}개", nophoto)
    for code in facts.get("extra_photos", []):
        add(CHK, "apparel", f"사진 폴더에 {code} 사진이 있는데 엑셀에는 해당 품번이 없음", [], badge=False)
    mo = [c for c, fx in f.items() if fx.get("wool_mo")]
    ul = [c for c, fx in f.items() if fx.get("wool_ul")]
    if mo and ul:
        add(CHK, "apparel", f"혼용률에 '모'({len(mo)}개 상품)와 '울'({len(ul)}개 상품) 표기가 섞여 있음 — 통일 필요", mo + ul, badge=False)
    mixed = facts.get("mix_nonstandard", [])
    if mixed:
        add(CHK, "apparel", f"혼용률 입력 형식이 제각각인 상품 {len(mixed)}개(예: 코튼52 폴리48, 코튼/폴리=86/14) — 화면에서는 자동으로 통일해 표시 중, 엑셀 표기 통일 권장", mixed, badge=False)

    # ---------- 전체(의류 외 포함): HQ 사진 없는 상품 ----------
    nohq = [c for c, s in styles.items() if s.get("plan") != "의류" and not s.get("has_hq_gallery")]
    if nohq:
        add(UPD, "general", f"HQ 사진이 없어 컬러 썸네일로 표시 중인 상품 {len(nohq)}개(모자·가방·액세서리·아이코닉)", nohq, badge=False)

    # ---------- 수동 ----------
    mp = manual_path or os.path.join(HERE, "remarks_manual.json")
    if os.path.exists(mp):
        for m in json.load(open(mp, encoding="utf-8")):
            add(m["type"], m.get("scope", "general"), m["text"], m.get("items", []), m.get("badge", False))
    order = {CHK: 0, UPD: 1, ERR: 2}
    out.sort(key=lambda x: (order[x["type"]], x["scope"] != "apparel", x["items"][:1]))
    return out


def write(path, remarks):
    json.dump(remarks, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"[리마크] {len(remarks)}건 (확인 필요 {sum(r['type']=='확인 필요' for r in remarks)} / 업데이트 필요 {sum(r['type']=='업데이트 필요' for r in remarks)} / 오류 수정 {sum(r['type']=='오류 수정' for r in remarks)})")
