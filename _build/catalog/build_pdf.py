# -*- coding: utf-8 -*-
# 상품 설명집 PDF(시즌별): catalog.html?print=AW26|SS27|ICONIC 인쇄 화면을 Edge/Chrome 헤드리스로 PDF로 저장 -> 사이트 루트 pdf/
# 사용: python build_pdf.py   (catalog.html을 먼저 빌드한 뒤). 매번 PDF가 새로 만들어지므로 데이터가 바뀐 때만 실행한다.
import os, subprocess, sys, pathlib
SITE = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = SITE / "pdf"
CANDS = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
         r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]


def run(keys=("AW26", "SS27", "ICONIC")):
    exe = next((c for c in CANDS if os.path.exists(c)), None)
    if not exe:
        print("Edge/Chrome을 찾지 못해 PDF를 만들지 못했습니다.")
        return False
    OUT.mkdir(exist_ok=True)
    for k in keys:
        dst = OUT / f"{k}.pdf"
        if dst.exists():
            dst.unlink()
        url = (SITE / "catalog.html").as_uri() + f"?print={k}"
        subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
                        "--virtual-time-budget=90000", f"--print-to-pdf={dst}", url], check=False, capture_output=True, timeout=600)
        print(k, "->", dst, (dst.stat().st_size // 1024) if dst.exists() else "실패", "KB")
    return True


if __name__ == "__main__":
    run(tuple(sys.argv[1:]) or ("AW26", "SS27", "ICONIC"))
