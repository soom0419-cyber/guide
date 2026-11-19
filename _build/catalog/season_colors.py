# -*- coding: utf-8 -*-
# 시즌 컬러칩: 마스터파일 시트의 Q열(컬러구분 시즌/코어)이 '시즌'인 컬러 → 시즌 테마 탭의 컬러칩.
#  - 컬러코드 단위로 센다. 그 시즌에서 '시즌' 행 수가 '코어' 행 수보다 많은 코드만 채택(코어 컬러가 섞인 코드 제외).
#  - 표시명 = 그 코드의 단색 컬러명(HK) 중 가장 많은 것. 콤보(A/B)만 있는 코드는 건너뜀(단색 코드가 따로 있음).
#  - 색상값 = 대시보드 COLOR_SWATCH(컬러코드별 hex).
#  - 직접 고치려면 season_colors.json을 만들어 {"AW26":[{"name","hex","codes":[..]}], "SS27":[...]} 로 적으면 그 시즌은 이 파일이 우선.
import csv, io, json, os, urllib.request, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET_ID = "1GmDn6Q5cE_vJoV9FzUgIN84f8Jaen-fEd7OfLelUR2A"
TABS = {"AW26": "997037546", "SS27": "1994172937"}
COLOR_SWATCH = {
    "BE": "#b4a8a0", "BK": "#221f1f", "BL": "#85a2ba", "BR": "#80350e", "CC": "#3e211c",
    "CH": "#211e1f", "CR": "#fff8ed", "GY": "#818285", "MU": "#60503c", "NV": "#0e1134",
    "OK": "#a88e73", "PU": "#524055", "RO": "#ac7371", "WH": "#fff8ed", "1K": "#000000",
    "2A": "#86b0a4", "2C": "#fff8ed", "AQ": "#86b0a4", "DE": "#a6bbc5", "DR": "#ab4528",
    "NT": "#efdcc7", "NU": "#d9b795", "RD": "#ab4528", "SG": "#969f72",
}


EXCLUDE = {"multi"}  # 시즌 컬러칩에서 뺄 컬러명(소문자)


def _fetch(gid):
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    return list(csv.reader(io.StringIO(urllib.request.urlopen(url, timeout=60).read().decode("utf-8"))))


def _season(rows):
    hi = next(i for i, r in enumerate(rows) if r and r[0].strip() == "Product Story NAME")
    h = [c.replace(" ", "").replace("\n", "") for c in rows[hi]]
    q = next(i for i, c in enumerate(h) if "컬러구분" in c)
    cc, cn = h.index("컬러코드"), h.index("ColourName(HK)")
    cnt = {"시즌": collections.Counter(), "코어": collections.Counter()}
    names = collections.defaultdict(collections.Counter)
    for r in rows[hi + 1:]:
        if len(r) <= max(q, cc, cn):
            continue
        flag, code, nm = r[q].strip(), r[cc].strip(), r[cn].strip()
        if flag not in cnt or not code or code == "-":
            continue
        cnt[flag][code] += 1
        if nm and "/" not in nm:
            names[code][nm] += (2 if flag == "시즌" else 1)
    out = {}
    for code, n in cnt["시즌"].most_common():
        if n <= cnt["코어"][code] or not names[code] or code not in COLOR_SWATCH:
            continue
        nm = names[code].most_common(1)[0][0]
        e = out.setdefault(nm.lower(), {"name": nm, "hex": COLOR_SWATCH[code], "codes": []})
        e["codes"].append(code)
    return [v for k, v in out.items() if k not in EXCLUDE]


def build():
    auto_p = os.path.join(HERE, "season_colors_auto.json")
    try:
        res = {k: _season(_fetch(g)) for k, g in TABS.items()}
        json.dump(res, open(auto_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    except Exception as e:  # 오프라인이면 마지막 결과 사용
        print("시즌 컬러: 시트 읽기 실패 -> 이전 결과 사용:", e)
        res = json.load(open(auto_p, encoding="utf-8")) if os.path.exists(auto_p) else {}
    man_p = os.path.join(HERE, "season_colors.json")
    if os.path.exists(man_p):
        res.update(json.load(open(man_p, encoding="utf-8")))
    for k, v in res.items():
        print("시즌 컬러", k, [x["name"] for x in v])
    return res
