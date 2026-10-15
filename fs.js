/* 글자 크기 배율: 스타일시트의 px 글자 크기를 calc(Npx * var(--fs))로 바꿔 두고, --fs 값만 조절한다(카드 최소 너비도 같이 배율 적용). 각 문서(본문/iframe)가 직접 읽는다. */
(function () {
  var K = 'dg_fs_v1', LV = [0.9, 1, 1.15, 1.3, 1.5];
  function conv(rules) {
    Array.prototype.forEach.call(rules, function (r) {
      if (r.cssRules && !r.style) { conv(r.cssRules); return; }
      if (r.style && r.style.fontSize) {
        var m = /^([\d.]+)px$/.exec(r.style.fontSize);
        if (m) r.style.fontSize = 'calc(' + m[1] + 'px * var(--fs, 1))';
      }
      var gc = r.style && r.style.gridTemplateColumns;
      if (gc && /minmax\(\s*[\d.]+px/.test(gc)) r.style.gridTemplateColumns = gc.replace(/minmax\(\s*([\d.]+)px/g, 'minmax(calc($1px * var(--fs, 1))');   // 카드 최소 너비도 같이 키움
    });
  }
  Array.prototype.forEach.call(document.styleSheets, function (s) {
    try { conv(s.cssRules); } catch (e) {}   // 다른 도메인(구글 폰트) 시트는 건너뜀
  });
  window.dgFs = function (v) { document.documentElement.style.setProperty('--fs', v); };
  window.dgFsLevels = LV;
  window.dgFsKey = K;
  var i = 1;
  try { var n = parseInt(localStorage.getItem(K), 10); if (n >= 0 && n < LV.length) i = n; } catch (e) {}
  window.dgFs(LV[i]);
})();
