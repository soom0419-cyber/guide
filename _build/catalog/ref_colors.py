# -*- coding: utf-8 -*-
# 품번·컬러코드 메뉴(reference.html)의 컬러 칩 표(코드 -> 배경색/그라데이션)를 그대로 꺼낸다(node로 표 정의 부분만 실행). 실패하면 마지막 결과(ref_colors.json) 사용.
import json, os, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))


def build():
    cache = os.path.join(HERE, "ref_colors.json")
    try:
        s = open(os.path.join(SITE, "reference.html"), encoding="utf-8").read()
        end = "COLORS.forEach(function(c){CMAP[c.code]=c});"
        js = s[s.index("var BASE"):s.index(end) + len(end)] + ";var o={};Object.keys(CMAP).forEach(function(k){o[k]=CMAP[k].bg});console.log(JSON.stringify(o));"
        p = os.path.join(tempfile.gettempdir(), "refcol_tmp.js")
        open(p, "w", encoding="utf-8").write(js)
        out = subprocess.run(["node", p], capture_output=True, text=True, encoding="utf-8", check=True).stdout
        d = json.loads(out)
        json.dump(d, open(cache, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    except Exception as e:
        print("컬러 칩 표 읽기 실패 -> 이전 결과 사용:", e)
        d = json.load(open(cache, encoding="utf-8")) if os.path.exists(cache) else {}
    return d
