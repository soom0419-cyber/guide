(function () {
  var KEY = 'dg_auth_v1';
  var DAYS = 30;

  var gate = document.getElementById('gate');
  var app = document.getElementById('app');
  var form = document.getElementById('gate-form');
  var codeInput = document.getElementById('gate-code');
  var pwInput = document.getElementById('gate-pw');
  var errBox = document.getElementById('gate-error');
  var btn = document.getElementById('gate-btn');
  var who = document.getElementById('who');
  var adminBtn = document.getElementById('admin-btn');
  var logoutBtn = document.getElementById('logout-btn');
  var modal = document.getElementById('admin-modal');
  var list = document.getElementById('admin-list');
  var closeBtn = document.getElementById('admin-close');

  function users() { return window.USERS || []; }
  function find(code) {
    var all = users();
    for (var i = 0; i < all.length; i++) if (all[i].code === code) return all[i];
    return null;
  }

  function hexToBytes(h) {
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToHex(buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
    return s;
  }

  function derive(code, pw, saltHex, iter) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(code + '\u0000' + pw), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: iter }, key, 256);
      })
      .then(bytesToHex);
  }

  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }

  function enter(user) {
    gate.hidden = true;
    app.hidden = false;
    who.textContent = user.code + (user.role === 'admin' ? ' (관리자)' : '');
    adminBtn.hidden = user.role !== 'admin';
    var s = document.getElementById('scroller');
    if (s) s.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function leave() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    app.hidden = true;
    gate.hidden = false;
    pwInput.value = '';
    errBox.hidden = true;
    codeInput.focus();
  }

  function restore() {
    try {
      var t = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (t && t.exp > Date.now()) {
        var u = find(t.code);
        if (u && u.hash === t.h) { enter(u); return true; }
      }
    } catch (e) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
    return false;
  }

  if (!window.crypto || !crypto.subtle) {
    showError('이 주소에서는 로그인을 사용할 수 없습니다. https 주소로 접속해주세요.');
    btn.disabled = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.hidden = true;
    var code = codeInput.value.trim().toUpperCase();
    var pw = pwInput.value;
    var user = find(code);
    btn.disabled = true;
    var done = function (ok) {
      btn.disabled = false;
      if (!ok) { showError('매장코드 또는 비밀번호가 맞지 않습니다.'); pwInput.value = ''; }
    };
    if (!user) { setTimeout(function () { done(false); }, 600); return; }
    derive(code, pw, user.salt, user.iter).then(function (h) {
      if (h === user.hash) {
        try {
          localStorage.setItem(KEY, JSON.stringify({ code: user.code, h: user.hash, exp: Date.now() + DAYS * 86400000 }));
        } catch (err) {}
        btn.disabled = false;
        enter(user);
      } else {
        setTimeout(function () { done(false); }, 600);
      }
    }).catch(function () { btn.disabled = false; showError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.'); });
  });

  logoutBtn.addEventListener('click', leave);

  adminBtn.addEventListener('click', function () {
    list.innerHTML = '';
    users().forEach(function (u) {
      var li = document.createElement('li');
      li.textContent = u.code + (u.role === 'admin' ? '  · 관리자' : '');
      list.appendChild(li);
    });
    modal.hidden = false;
  });
  closeBtn.addEventListener('click', function () { modal.hidden = true; });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });

  if (!restore()) codeInput.focus();

  // 글자 크기 조절(가-/가+): fs.js가 각 문서의 --fs 배율을 바꾼다. 기기별로 기억.
  (function () {
    var LV = window.dgFsLevels || [1], K = window.dgFsKey || 'dg_fs_v1', i = 1;
    try { var v = parseInt(localStorage.getItem(K), 10); if (v >= 0 && v < LV.length) i = v; } catch (e) {}
    function sendTo(f) { try { if (f.contentWindow.dgFs) f.contentWindow.dgFs(LV[i]); } catch (e) {} }
    function apply() {
      if (window.dgFs) window.dgFs(LV[i]);
      Array.prototype.forEach.call(document.querySelectorAll('.ipane iframe'), sendTo);
      var d = document.getElementById('fs-down'), u = document.getElementById('fs-up');
      if (d) d.disabled = i === 0;
      if (u) u.disabled = i === LV.length - 1;
    }
    function step(n) { i = Math.max(0, Math.min(LV.length - 1, i + n)); try { localStorage.setItem(K, String(i)); } catch (e) {} apply(); }
    var d = document.getElementById('fs-down'), u = document.getElementById('fs-up');
    if (d) d.addEventListener('click', function () { step(-1); });
    if (u) u.addEventListener('click', function () { step(1); });
    Array.prototype.forEach.call(document.querySelectorAll('.ipane iframe'), function (f) { f.addEventListener('load', function () { sendTo(f); }); });
    apply();
  })();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
