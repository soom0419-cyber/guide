// 상품 설명집 탭: 시즌 탭 > 기획명/복종 필터 > 스토리 박스(소개 문구 + 아이템 카드, 출고 순).
// generate_html.py가 바잉 마스터파일 스크립트에 끼워 넣는다(TREE/STYLES/STORIES와 fmtNum·rrpDisplay·mmdd·korMmdd 등 공용 함수를 사용).
(function () {
  const state = { sub: 'products', material: null, ch: 'ALL', plan: 'ALL', body: 'ALL', attr: 'ALL', month: 'ALL', grp: 'ALL', search: '' };
  let ready = false;
  const attr = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------------- 기획명 / 복종 / 소재 필터 ----------------
  const BODY_GROUP = { '바이저중간챙': '바이저', '바이저큰챙': '바이저', '클로슈작은챙': '클로슈', '클로슈중간챙': '클로슈', '클로슈큰챙': '클로슈',
    '버킷큰챙': '버킷', '페도라작은챙': '페도라', '페도라중간챙': '페도라' };
  const FILTER_ORDER = { '모자': ['바이저', '클로슈', '버킷', '카스켓', '보터햇', '캡', '페도라', '헌팅캡', '베레', '비니'],
    '가방': ['숄더백', '토트백', '크로스바디', '클러치'], '액세서리': ['스카프', '글로브', '액세서리'],
    '의류': ['아우터자켓', '재킷', '가디건', '판초', '베스트', '우븐드레스', '니트드레스', '니트탑', '우븐탑', '져지탑', '셔츠', '우븐팬츠', '우븐스커트', '니트팬츠'] };
  const PLANS = ['모자', '가방', '액세서리'];
  const hasApparel = m => { let f = false; eachStyle(m, s => { if (s.plan === '의류') f = true; }); return f; };
  const plansOf = () => state.material === 'APPAREL' ? ['의류'] : PLANS.concat(hasApparel(state.material) ? ['의류'] : []);
  // 소재 필터 라벨(입판재 "속성명" 원본 -> 한글 표기) — MAP과 동일한 매핑
  const ATTR_LABEL = {
    'BRAID (CLASSIC)': '브레이드', 'BRAID (LACE)': '브레이드', 'BRAID (LIGHT)': '라이트 브레이드',
    'BRAID (SCALLOP)': '스캘롭 브레이드', 'BRAID (WIDE)': '와이드 브레이드', 'CROCHET': '크로셰', 'ETC': '기타',
    'FABRIC (BOUCLE)': '부클', 'FABRIC (CORDUROY)': '코듀로이', 'FABRIC (COTTON)': '코튼', 'FABRIC (ETC)': '기타',
    'FABRIC (KNIT)': '니트', 'FABRIC (LINEN)': '린넨', 'FABRIC (NYLON)': '나일론', 'FABRIC (WOOL)': '울',
    'FINE WOOL FELT': '울펠트', 'FUR': '퍼', 'LEATHER': '레더', 'PANAMA': '파나마', 'WOOL FELT': '울펠트',
    'CROCHET&FABRIC': '크로셰&패브릭',
    // SS27 의류 소재 구분
    // 혼방은 같은 소재 그룹으로(린넨 혼방→린넨, 실크 혼방→실크, 울 혼방→울), 리싸이클 나일론→나일론, 시퀸·비스코스→기타
    'COTTON': '코튼', 'LINEN': '린넨', 'LINEN BLEND': '린넨', 'SILK': '실크', 'SILK BLEND': '실크', 'WOOL': '울', 'WOOL BLEND': '울',
    'RECYCLED NYLON': '나일론', 'RECYCLED POLYESTER': '기타', 'SEQUIN': '기타', 'VISCOSE': '기타',
  };
  const bodyGroup = s => BODY_GROUP[s.body] || s.body;
  // 의류 복종 그룹(겹침 허용: 가디건은 아우터·니트 양쪽)
  const APPAREL_BODY_GROUPS = { '아우터': ['아우터자켓', '재킷', '가디건', '판초', '베스트'],
    '우븐': ['우븐드레스', '우븐팬츠', '우븐스커트', '우븐탑', '셔츠'], '니트': ['니트탑', '니트드레스', '니트팬츠', '가디건'] };
  const bodyOk = s => state.body === 'ALL' || bodyGroup(s) === state.body || (APPAREL_BODY_GROUPS[state.body] || []).includes(bodyGroup(s));
  const attrLabel = s => ATTR_LABEL[s.attr] || s.attr || '';
  // 기준 = 혼용률(material_main/material_full)에 '라피아', 또는 품명에 RAFFIA/PANAMA(파나마 햇 포함)가 들어가면 라피아, 그 외 전부 CMT (혼용률 비어 있어도 품명으로 판정)
  const SS27_GROUPS = ['라피아', 'CMT'];
  const ssGroupOf = s => s.plan === '의류' ? null : (/라피아/.test((s.material_full || '') + ' ' + (s.material_main || '') + ' ' + (s.name_kr || '')) || /RAFFIA|PANAMA/i.test(s.name_sjg || '') || s.attr === 'PANAMA') ? '라피아' : 'CMT';
  const attrOk = s => state.attr === 'ALL' || (SS27_GROUPS.includes(state.attr) ? (s.season_tab === 'SS27' && ssGroupOf(s) === state.attr) : attrLabel(s) === state.attr);
  // 출고월(컬렉션) / 코어·NEW(아이코닉) 필터
  const MONTH_OF = {};
  Object.entries(TREE).forEach(([mat, months]) => { if (mat !== 'ICONIC') Object.entries(months).forEach(([mo, weeks]) => Object.values(weeks).forEach(w => w.stories.forEach(g => g.styles.forEach(c => { MONTH_OF[c] = mo; })))); });
  const monthOf = s => MONTH_OF[s.item_code];
  const monthOk = s => state.month === 'ALL' || String(monthOf(s)) === state.month;
  const CHANNELS = ['오프라인 단독', '온라인 단독', '아울렛 전용'];
  const chOk = s => state.ch === 'ALL' || s.channel === state.ch;
  const CG_OF = { '코어': '코어', 'NEW': 'NEW 시즌' };
  const grpOk = s => state.grp === 'ALL' || s.material !== 'ICONIC' || (s.colors.some(c => c.cgroup === CG_OF[state.grp]));
  const monthRank = mo => { const n = parseInt(mo, 10); return n === 12 ? -1 : n; };
  const norm = t => String(t || '').toLowerCase().replace(/\s+/g, '');
  const searchOk = s => {
    const q = norm(state.search);
    return !q || norm([s.name_sjg, s.name_kr, s.aw26_item_code, s.ss27_item_code].join(' ')).includes(q);
  };
  // 검색어가 있으면(사이트에서 window.CATALOG_GLOBAL_SEARCH 켠 경우) 탭·필터와 상관없이 전체 시즌/기획을 대상으로 검색
  const globalSearch = () => !!window.CATALOG_GLOBAL_SEARCH && !!state.search.trim();
  const matches = s => globalSearch() ? searchOk(s) : (state.plan === 'ALL' || s.plan === state.plan) && bodyOk(s)
    && attrOk(s) && monthOk(s) && grpOk(s) && chOk(s) && searchOk(s);

  function eachStyle(material, fn) {
    Object.values(TREE[material] || {}).forEach(weeks => Object.values(weeks).forEach(w => w.stories.forEach(g => g.styles.forEach(c => { if (STYLES[c]) fn(STYLES[c]); }))));
  }
  function filterMonth(monthData) {
    const out = {};
    Object.entries(monthData || {}).forEach(([wk, w]) => {
      const list = w.stories.map(g => ({ ...g, styles: g.styles.filter(c => STYLES[c] && matches(STYLES[c])) })).filter(g => g.styles.length);
      if (list.length) out[wk] = { thursday: w.thursday, stories: list };
    });
    return out;
  }

  // 출고월(구분) 줄은 줄바꿈 없이 한 줄 — 그 폭(과 기획명 줄 폭 중 큰 쪽)을 왼쪽 블록 폭으로 맞춰, 채널 칩·복종 칩이 같은 시작점에서 이어지게 한다
  function syncLeftWidth() {
    const f = document.querySelector('.filters'), a = document.getElementById('catPlanRow'), b = document.querySelector('.fpair .fl');
    if (!f || !a) return;
    f.style.removeProperty('--lw');
    f.style.setProperty('--lw', Math.ceil(Math.max(a.scrollWidth, b ? b.scrollWidth : 0)) + 'px');
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => syncLeftWidth());

  function renderFilters() {
    const pc = {}, bc = {};
    eachStyle(state.material, s => {
      pc[s.plan] = (pc[s.plan] || 0) + 1;
      if (state.plan === 'ALL' || s.plan === state.plan) bc[bodyGroup(s)] = (bc[bodyGroup(s)] || 0) + 1;
    });
    const total = Object.values(pc).reduce((a, b) => a + b, 0);
    const chip = (kind, val, label, n, on) => `<button class="fchip${on ? ' active' : ''}${n ? '' : ' zero'}" data-k="${kind}" data-v="${attr(val)}">${label}</button>`;
    const planRow = `<span class="flabel">기획명</span>${chip('plan', 'ALL', '전체', total, state.plan === 'ALL')}${plansOf().map(p => chip('plan', p, p, pc[p] || 0, state.plan === p)).join('')}`;
    let html = '', topRow = '';
    const rest = (s, skip) => (skip === 'month' || state.month === 'ALL' || String(monthOf(s)) === state.month) && (skip === 'grp' || grpOk(s));
    if (state.material === 'ICONIC') {
      const gcnt = { '코어': 0, 'NEW': 0 }, gall = [];
      eachStyle(state.material, s => { if (!((state.plan === 'ALL' || s.plan === state.plan) && bodyOk(s))) return; gall.push(s);
        ['코어', 'NEW'].forEach(k => { if (s.colors.some(c => c.cgroup === CG_OF[k])) gcnt[k]++; }); });
      topRow = `<span class="flabel">구분</span>${chip('grp', 'ALL', '전체', gall.length, state.grp === 'ALL')}${['코어', 'NEW'].map(k => chip('grp', k, k, gcnt[k], state.grp === k)).join('')}`;
    } else {
      const mc = {}; let mt = 0;
      eachStyle(state.material, s => { if (!((state.plan === 'ALL' || s.plan === state.plan) && bodyOk(s))) return; mc[monthOf(s)] = (mc[monthOf(s)] || 0) + 1; mt++; });
      const months = Object.keys(TREE[state.material] || {}).filter(m => m !== '99').sort((a, b) => monthRank(a) - monthRank(b));
      topRow = `<span class="flabel">출고월</span>${chip('month', 'ALL', '전체', mt, state.month === 'ALL')}${months.map(m => chip('month', m, m + '월', mc[m] || 0, state.month === m)).join('')}`;
    }
    let bodyRow = '';   // 복종 칩은 기획명 줄 아래(의류는 아우터·우븐·니트 그룹 칩 포함)
    if (state.plan !== 'ALL') {
      const known = FILTER_ORDER[state.plan] || [];
      const list = known.concat(Object.keys(bc).filter(g => !known.includes(g)));
      const bgrp = state.plan === '의류' ? Object.keys(APPAREL_BODY_GROUPS).map(g => { const n = Object.keys(bc).filter(b => APPAREL_BODY_GROUPS[g].includes(b)).reduce((a, b) => a + bc[b], 0); return `<button class="fchip group${state.body === g ? ' active' : ''}${n ? '' : ' zero'}" data-k="body" data-v="${g}">${g}</button>`; }).join('') : '';
      bodyRow = `<span class="flabel">복종</span>${chip('body', 'ALL', '전체', pc[state.plan] || 0, state.body === 'ALL')}${bgrp}${list.map(g => chip('body', g, g, bc[g] || 0, state.body === g)).join('')}`;
    }
    html += `<div class="fpair"><div class="fl fchips">${planRow}</div></div>${bodyRow ? `<div class="fchips">${bodyRow}</div>` : ''}`;
    const ac = {}, gc = {};
    eachStyle(state.material, s => {
      if (!((state.plan === 'ALL' || s.plan === state.plan) && bodyOk(s))) return;
      const label = attrLabel(s);
      if (label) ac[label] = (ac[label] || 0) + 1;
      gc[ssGroupOf(s)] = (gc[ssGroupOf(s)] || 0) + 1;
    });
    const attrLabels = Object.keys(ac).sort((a, b) => ac[b] - ac[a]);
    const attrTotal = Object.values(ac).reduce((a, b) => a + b, 0);
    if (attrLabels.length) {
      const groupChips = state.material === 'COLLECTION_SS27' && (gc['라피아'] || gc['CMT']) ? SS27_GROUPS.map(g => `<button class="fchip group${state.attr === g ? ' active' : ''}${gc[g] ? '' : ' zero'}" data-k="attr" data-v="${g}">${g}</button>`).join('') : '';
      html += `<div class="fchips"><span class="flabel">소재</span>${chip('attr', 'ALL', '전체', attrTotal, state.attr === 'ALL')}${groupChips}${attrLabels.map(l => chip('attr', l, l, ac[l], state.attr === l)).join('')}</div>`;
    }
    let chRow = '';
    if (state.material === 'COLLECTION_SS27') {   // 채널: 오프라인 단독 / 온라인 단독 / 아울렛 전용(해당 상품이 없는 칩은 흐리게)
      const cc = {}; eachStyle(state.material, s => { if (s.channel) cc[s.channel] = (cc[s.channel] || 0) + 1; });
      chRow = `<span class="flabel">채널</span>${chip('ch', 'ALL', '전체', 1, state.ch === 'ALL')}${CHANNELS.map(c => chip('ch', c, c, cc[c] || 0, state.ch === c)).join('')}`;
    }
    document.getElementById('catPlanRow').innerHTML = topRow;
    document.getElementById('catChRow').innerHTML = chRow;  // 검색창은 이 행의 오른쪽에 고정 배치(입력 중 다시 그려지지 않도록 별도 요소)
    document.getElementById('catFilters').innerHTML = html;
    syncLeftWidth();
    document.querySelectorAll('#catPlanRow button, #catChRow button, #catFilters button').forEach(b => b.onclick = () => {
      if (b.dataset.k === 'month') { state.month = b.dataset.v; }
      else if (b.dataset.k === 'grp') { state.grp = b.dataset.v; }
      else if (b.dataset.k === 'ch') { state.ch = b.dataset.v; }
      else if (b.dataset.k === 'plan') { state.plan = b.dataset.v; state.body = 'ALL'; state.attr = 'ALL'; }
      else if (b.dataset.k === 'body') { state.body = b.dataset.v; state.attr = 'ALL'; }
      else { state.attr = b.dataset.v; }
      renderAll();
    });
  }

  // ---------------- 카드: 영문명/한글명/이미지/사이즈/가격/컬러(스와치+한글컬러명)만 남김 ----------------
  function renderCard(s) {
    const hero = (state.grp !== 'ALL' && s.colors.find(c => c.image && c.cgroup === CG_OF[state.grp])) || s.colors.find(c => c.image);
    const chipOf = c => `
      <span class="swatch-chip">${c.swatch ? `<span class="swatch-dot" style="background:${c.swatch}"></span>` : ''}${c.color_code}${c.color_kr ? ' · ' + c.color_kr : ''}</span>`;
    const cgs = cgGroups(s.colors);   // ICONIC: 코어 / NEW 시즌 / 구 시즌(기본 접힘). 구분 필터를 고르면 그 그룹을 맨 위로
    if (cgs && state.grp !== 'ALL') cgs.sort((a, b) => (b.label === CG_OF[state.grp]) - (a.label === CG_OF[state.grp]));
    const chips = cgs ? cgs.map(g => g.label === '구 시즌'
      ? `<details class="cg-old-box" onclick="event.stopPropagation()"><summary>${g.label} ${g.colors.length}</summary><div class="swatch-row">${g.colors.map(chipOf).join('')}</div></details>`
      : `<div class="cg-line"><span class="cg-label">${g.label}</span><div class="swatch-row">${g.colors.map(chipOf).join('')}</div></div>`).join('')
      : `<div class="swatch-row">${s.colors.map(chipOf).join('')}</div>`;
    return `
    <div class="simple-card" onclick="openDetailProduct('${s.item_code}')">
      <div class="simple-thumb${s.plan === '의류' ? ' apparel' : ''}">${(s.plan === '의류' ? s.image : (hero && hero.image)) ? `<img src="${s.plan === '의류' ? s.image : hero.image}" alt="${attr(s.name_sjg)}">` : '<div class="noimg"></div>'}${s.plan === '의류' && s.channel ? `<span class="ch-chip">${s.channel}</span>` : ''}${rmBadge(s.item_code)}</div>
      <div class="simple-body">
        <div class="simple-name">${s.name_sjg}${s.seasons && s.seasons.includes('R27') ? ' <span class="season-badge">R27</span>' : ''}</div>
        <div class="simple-name-kr">${s.name_kr}</div>
        <div class="simple-size">사이즈 ${s.sizes.join('/')}</div>
        ${s.plan === '의류' ? `<div class="simple-ship">출고 ${s.ship_date ? mmdd(s.ship_date) : '-'}</div>` : ''}
        <div class="simple-price">${rrpDisplay(s)}</div>
        ${chips}
      </div>
    </div>`;
  }

  // ---------------- 스토리 박스 ----------------
  const SEASON_LABEL = { AW26: 'AW26', SS27: 'SS27' };
  function seasonLabel(s) {
    if (s.season_tab === 'SS27' && s.item_code.startsWith('HYR')) return 'R27 COLLECTION';
    return SEASON_LABEL[s.season_tab] || 'COLLECTION';
  }
  function storyBox(g) {
    const cards = g.styles.map(c => STYLES[c]);
    const first = cards[0];
    const isIconic = first.material === 'ICONIC';
    const info = STORIES[g.story];
    const tags = [...new Set(cards.flatMap(c => c.seasons || []))];
    const eyebrow = info && info.eyebrow ? info.eyebrow : (isIconic ? 'ICONIC · ' + [...new Set(cards.map(c => c.plan))].join(' · ') : (tags.length > 1 ? tags.join(' · ') + ' COLLECTION' : seasonLabel(first)));
    const points = info && info.bullets && info.bullets.length
      ? `<ul class="story-points">${info.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
      : (isIconic ? '<div class="story-plain">시즌에 관계없이 상시 판매되는 아이코닉 상품입니다.</div>' : '');
    return `
    <div class="story-box" data-box="${attr(g.story)}">
      <div class="sb-head">
        <div class="sb-eyebrow">${eyebrow}</div>
        <div class="sb-title">${g.story}</div>
        ${points ? `<div class="sb-desc">${points}</div>` : ''}
      </div>
      <div class="sb-cards">${cards.map(c => renderCard(c)).join('')}</div>
    </div>`;
  }

  // ---------------- 나열 / 탭 ----------------
  function seasonMonthRank(mo) { const n = parseInt(mo, 10); return n === 12 ? -1 : n; }
  function monthKeys(material) {
    const obj = TREE[material] || {};
    if (material === 'ICONIC') return Object.keys(obj);
    return Object.keys(obj).sort((a, b) => material === 'COLLECTION_SS27' ? seasonMonthRank(a) - seasonMonthRank(b) : a - b);
  }
  // 출고월/주차 구분 없이 전부 나열하되 순서는 출고 순(월 > 주차). 컬렉션은 같은 스토리를 박스 하나로 합치고, 아이코닉은 기획명별로 나눈다.
  function collectStories() {
    const order = ['COLLECTION', 'COLLECTION_SS27', 'ICONIC', 'APPAREL'];
    const mats = globalSearch() ? Object.keys(TREE).sort((a, b) => order.indexOf(a) - order.indexOf(b)) : [state.material];
    return mats.flatMap(collectStoriesOf);
  }
  function collectStoriesOf(material) {
    const obj = TREE[material] || {};
    const isIconic = material === 'ICONIC';
    const boxes = [], byStory = {};
    monthKeys(material).forEach(mo => {
      const data = filterMonth(obj[mo]);
      const weekKeys = Object.keys(data);
      if (!isIconic) weekKeys.sort((a, b) => a - b);
      weekKeys.forEach(wk => data[wk].stories.forEach(g => {
        if (!isIconic && byStory[g.story]) { byStory[g.story].styles = byStory[g.story].styles.concat(g.styles); return; }
        const box = { story: g.story, styles: g.styles.slice(), category: mo };
        boxes.push(box);
        if (!isIconic) byStory[g.story] = box;
      }));
    });
    boxes.forEach(b => { b.styles = sortStyleCodes(b.styles); });
    if (isIconic && state.grp !== 'ALL') boxes.forEach(b => { const n = c => (STYLES[c].colors.filter(x => x.cgroup === CG_OF[state.grp]).length); b.styles.sort((x, y) => n(y) - n(x)); });  // 스토리 안 기본 정렬(모자 > 가방 > 액세서리 > 그 외, 클로슈 > 버킷 > 보터, 발주 많은 순)
    if (!isIconic) { const isAp = b => b.styles.length && STYLES[b.styles[0]].plan === '의류'; return boxes.filter(b => !isAp(b)).concat(boxes.filter(isAp)); }
    return boxes;
  }
  function renderStories() {
    const boxes = collectStories();
    document.getElementById('catStories').innerHTML = boxes.length ? boxes.map(storyBox).join('') : '<div class="empty">해당 조건의 상품이 없습니다.</div>';
  }

  const MATERIAL_LABELS = { COLLECTION: 'AW26', COLLECTION_SS27: 'SS27', ICONIC: 'ICONIC', APPAREL: '의류' };
  function renderMaterialTabs() {
    const order = ['COLLECTION', 'COLLECTION_SS27', 'ICONIC', 'APPAREL'];
    const materials = Object.keys(TREE).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (!state.material) state.material = TREE.COLLECTION_SS27 ? 'COLLECTION_SS27' : materials[0];
    const el = document.getElementById('catMaterialTabs');
    el.innerHTML = materials.map(m => {
      let n = 0;
      eachStyle(m, s => { if (matches(s)) n++; });
      return `<button data-mat="${m}" class="${m === state.material && !globalSearch() ? 'active' : ''}">${MATERIAL_LABELS[m] || m}</button>`;
    }).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (globalSearch()) { state.search = ''; document.getElementById('catSearch').value = ''; }
      state.material = b.dataset.mat; state.sub = 'products'; state.plan = 'ALL'; state.body = 'ALL'; state.attr = 'ALL'; state.month = 'ALL'; state.grp = 'ALL'; state.ch = 'ALL'; renderAll();
    });
  }


  // ---------------- 내부 리마크: admin = 전체 / 김수용 = 의류 리마크만 (그 외·로그인 없음 = 안 보임). 화면에서만 제어하는 수준(로그인 게이트와 동일) ----------------
  const REMARK_SCOPES = { '김수용': ['apparel'] };
  const RM_CLS = { '확인 필요': 'chk', '업데이트 필요': 'upd', '오류 수정': 'err' };
  const RM = { list: [], by: {}, all: false, type: 'ALL', scope: 'ALL' };
  function rmViewer() {
    try {
      const t = JSON.parse(localStorage.getItem('dg_auth_v1') || 'null');
      if (!t || !(t.exp > Date.now())) return null;
      const users = window.USERS || (window.parent && window.parent.USERS) || [];
      const u = users.find(x => x.code === t.code && x.hash === t.h);
      if (!u) return null;
      return u.role === 'admin' ? 'ALL' : (REMARK_SCOPES[u.code] || null);
    } catch (e) { return null; }
  }
  const rmItems = x => (x.items || []).map(c => STYLES[c]).filter(Boolean);
  const rmBadge = code => {
    const n = (RM.by[code] || []).filter(x => x.badge !== false).length;
    return n ? `<span class="rm-badge" title="내부 리마크 ${n}건">!</span>` : '';
  };
  window.catRemarkHtml = code => {
    const a = RM.by[code] || [];
    if (!a.length) return '';
    return `<div class="rm-box"><div class="rm-title">내부 리마크 <small>${RM.all ? 'admin' : '의류 담당'}만 보임</small></div>${a.map(x => `<div class="rm-row ${RM_CLS[x.type]}"><span class="rm-pill">${x.type}</span><span>${esc(x.text)}</span></div>`).join('')}</div>`;
  };
  const rmPanel = document.createElement('div');
  rmPanel.className = 'rm-panel'; rmPanel.hidden = true;
  document.body.appendChild(rmPanel);
  function rmRender() {
    const list = RM.list.filter(x => (RM.type === 'ALL' || x.type === RM.type) && (RM.scope === 'ALL' || x.scope === RM.scope));
    const chip = (k, v, l) => `<button type="button" class="fchip${RM[k] === v ? ' active' : ''}" data-rk="${k}" data-rv="${v}">${l}</button>`;
    const cnt = t => RM.list.filter(x => x.type === t).length;
    const row = x => {
      const items = rmItems(x);
      const links = items.length ? `<div class="rm-links">${items.slice(0, 8).map(s => `<button type="button" class="rm-link" data-open="${s.item_code}">${esc(s.name_sjg)}</button>`).join('')}${items.length > 8 ? `<span class="rm-more">외 ${items.length - 8}개</span>` : ''}</div>` : '';
      return `<div class="rm-row ${RM_CLS[x.type]}"><span class="rm-pill">${x.type}</span><div class="rm-body"><div>${esc(x.text)}${x.scope === 'general' ? ' <small>(전체)</small>' : ''}</div>${links}</div></div>`;
    };
    rmPanel.innerHTML = `<div class="rm-sheet"><div class="rm-head"><b>내부 리마크 ${RM.list.length}건</b><button type="button" class="rm-x" aria-label="닫기">×</button></div>
      <div class="fchips">${chip('type', 'ALL', '전체')}${['확인 필요', '업데이트 필요', '오류 수정'].map(t => chip('type', t, `${t} ${cnt(t)}`)).join('')}</div>
      ${RM.all ? `<div class="fchips">${chip('scope', 'ALL', '전체')}${chip('scope', 'apparel', '의류')}${chip('scope', 'general', '그 외')}</div>` : ''}
      <div class="rm-list">${list.map(row).join('') || '<div class="empty">해당 리마크가 없습니다.</div>'}</div></div>`;
  }
  rmPanel.addEventListener('click', e => {
    const k = e.target.closest('[data-rk]'), o = e.target.closest('[data-open]');
    if (k) { RM[k.dataset.rk] = k.dataset.rv; rmRender(); }
    else if (o) { rmPanel.hidden = true; openDetailProduct(o.dataset.open); }
    else if (e.target.closest('.rm-x') || e.target === rmPanel) rmPanel.hidden = true;
  });
  function rmLoad() {
    const sc = rmViewer();
    if (!sc) return;
    fetch('remarks.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(list => {
      RM.all = sc === 'ALL';
      RM.list = list.filter(x => RM.all || sc.includes(x.scope));
      RM.by = {};
      RM.list.forEach(x => (x.items || []).forEach(c => { (RM.by[c] = RM.by[c] || []).push(x); }));
      const b = document.getElementById('catRemarkBtn');
      if (b) { b.hidden = !RM.list.length; b.innerHTML = `리마크 <b>${RM.list.length}</b>건`; b.onclick = () => { rmRender(); rmPanel.hidden = false; }; }
      if (ready) renderAll();
    }).catch(() => {});
  }
  rmLoad();

  // ---------------- SS27 탭 전용: 마우스 커서 오른쪽 아래에 딸기·나비 장식 (마우스가 있는 화면만, 터치 기기는 해당 없음) ----------------
  const berry = (() => {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
    const el = document.createElement('img');
    el.src = 'guide-img/berry-butterfly.png'; el.alt = ''; el.className = 'cursor-berry'; el.hidden = true;
    document.body.appendChild(el);
    let x = 0, y = 0, raf = 0, on = false;
    const draw = () => { raf = 0; el.style.transform = `translate(${x + 8}px, ${y + 15}px)`; };
    document.addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(draw); if (on) el.style.opacity = 1; }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { el.style.opacity = 0; });
    return { set(v) { on = v; el.hidden = !v; el.style.opacity = 0; } };
  })();

  // ---------------- 사진 확대 보기 ----------------
  let lbSet = [], lbIdx = 0;
  const lb = document.createElement('div');
  lb.className = 'cat-lb'; lb.hidden = true;
  lb.innerHTML = '<button type="button" class="lb-x" aria-label="닫기">×</button><button type="button" class="lb-nav lb-prev" aria-label="이전 사진">‹</button><img alt=""><button type="button" class="lb-nav lb-next" aria-label="다음 사진">›</button><div class="lb-cap" hidden></div>';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('img'), lbCap = lb.querySelector('.lb-cap');
  function lbShow(i) {
    if (!lbSet.length) return;
    lbIdx = (i + lbSet.length) % lbSet.length;
    lbImg.src = lbSet[lbIdx].full;
    const cap = [lbSet[lbIdx].label, lbSet.length > 1 ? `${lbIdx + 1} / ${lbSet.length}` : ''].filter(Boolean).join('   ');
    lbCap.textContent = cap; lbCap.hidden = !cap;
    lb.querySelectorAll('.lb-nav').forEach(b => b.hidden = lbSet.length < 2);
    lb.hidden = false; document.body.classList.add('lb-open');
  }
  function lbClose() { lb.hidden = true; lbImg.removeAttribute('src'); document.body.classList.remove('lb-open'); }
  lb.addEventListener('click', e => {
    if (lb._swiped) return;
    if (e.target.closest('.lb-prev')) lbShow(lbIdx - 1);
    else if (e.target.closest('.lb-next')) lbShow(lbIdx + 1);
    else lbClose();      // 바깥 · 사진 · × 어디를 눌러도 닫힘(이전/다음 제외)
  });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(lbIdx - 1); else if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
  });
  // 상품 상세 사진: 누르면 확대, 좌우로 다른 컬러 사진으로 넘어감(화살표·방향키·스와이프)
  document.getElementById('dview-product').addEventListener('click', e => {
    const img = e.target.closest('.gallery-list-item img, .product-gallery .cell img');
    if (!img) return;
    const st = detailState && detailState.product ? STYLES[detailState.product] : null;
    const all = [...document.querySelectorAll('#dview-product .gallery-list-item img, #dview-product .product-gallery .cell img')];
    lbSet = all.map(im => {
      const code = (im.parentElement.querySelector('.tag') || {}).textContent || '';
      const c = st && st.colors.find(x => x.color_code === code);
      return { full: im.currentSrc || im.src, label: code ? code + (c && c.color_kr ? ' · ' + c.color_kr : '') : '' };
    });
    lbShow(all.indexOf(img));
  });
  let lbTouchX = null;
  lb.addEventListener('touchstart', e => { lbTouchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (lbTouchX == null) return;
    const dx = e.changedTouches[0].clientX - lbTouchX; lbTouchX = null;
    if (Math.abs(dx) > 50 && lbSet.length > 1) { lbShow(lbIdx + (dx < 0 ? 1 : -1)); lb._swiped = true; setTimeout(() => { lb._swiped = false; }, 350); }
  });
  document.getElementById('catTheme').addEventListener('click', e => { const b = e.target.closest('[data-lb]'); if (b) lbShow(parseInt(b.dataset.lb, 10)); });

  // ---------------- 시즌 가이드: 시즌 테마 / 상품 / 룩북 (SEASON_GUIDE에 자료가 있는 시즌만) ----------------
  const GUIDE_KEY = { COLLECTION: 'AW26', COLLECTION_SS27: 'SS27' };
  const SUBS = [['theme', '시즌 테마'], ['products', '상품'], ['look', '룩북']];
  function guideOf() {
    const k = GUIDE_KEY[state.material], G = window.SEASON_GUIDE || {};
    return !globalSearch() && k && G[k] ? Object.assign({ key: k }, G[k]) : null;
  }
  function renderSubTabs(g) {
    const el = document.getElementById('catSubTabs');
    el.hidden = !g;
    if (!g) return;
    let n = 0; eachStyle(state.material, s => { if (matches(s)) n++; });
    el.innerHTML = SUBS.map(([k, l]) => `<button data-sub="${k}" class="${state.sub === k ? 'active' : ''}">${l}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => { state.sub = b.dataset.sub; renderAll(); window.scrollTo(0, 0); });
  }
  function renderGuidePages(g) {
    const th = document.getElementById('catTheme'), lk = document.getElementById('catLook');
    th.hidden = !g || state.sub !== 'theme'; lk.hidden = !g || state.sub !== 'look';
    if (!g) return;
    const T = g.theme || {}, L = (g.look && g.look.images) || [];
    const hero = T.image ? { thumb: T.image, full: T.imageFull || T.image } : null;
    lbSet = [hero].concat(T.refs || []).filter(Boolean);
    const off = hero ? 1 : 0;
    th.innerHTML = `<article class="theme${hero ? ' has-img' : ''}"><div class="theme-media">${hero ? `<button type="button" class="theme-hero" data-lb="0" aria-label="사진 크게 보기"><img src="${attr(hero.thumb)}" alt="${attr(T.title)}"></button>` : ''}` +
      `${(T.refs || []).length ? `<div class="theme-refs">${T.refs.map((r, i) => `<button type="button" class="theme-ref" data-lb="${i + off}" aria-label="참고 사진 ${i + 1} 크게 보기"><img src="${attr(r.thumb)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>` +
      `<div class="theme-text"><h2 class="theme-title">${esc(T.title)}</h2><p class="theme-lead">${esc(T.lead)}</p>${(T.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('')}</div></article>`;
    lk.innerHTML = L.length ? `<div class="look-grid">${L.map(src => `<figure class="look-item"><img src="${attr(src)}" alt="" loading="lazy"></figure>`).join('')}</div>` : '<div class="empty">룩북은 준비 중입니다.</div>';
  }

  function renderAll() {
    ready = true; renderMaterialTabs();
    if (berry) berry.set(state.material === 'COLLECTION_SS27');
    const g = guideOf(), onProducts = !g || state.sub === 'products';
    renderSubTabs(g); renderGuidePages(g);
    renderFilters(); renderStories();
    document.getElementById('catStories').hidden = !onProducts;
    const fl = document.querySelector('.filters'); if (fl && window.CATALOG_GLOBAL_SEARCH) fl.hidden = !onProducts;
    // 전체 검색 중에는 필터 칩만 숨기고 검색창은 그대로 둔다(검색창이 .filters 안에 있어 통째로 숨기면 사라짐)
    ['catPlanRow', 'catChRow', 'catFilters'].forEach(id => { const e = document.getElementById(id); if (e) e.hidden = !!window.CATALOG_GLOBAL_SEARCH && globalSearch(); });
    const cnt = document.getElementById('catSearchCount');
    if (cnt) cnt.textContent = '';
  }
  document.getElementById('catSearch').oninput = e => { state.search = e.target.value; renderAll(); };

  // ---------------- 바깥에서 호출 ----------------
  function materialOfStyle(s) { return s.material === 'APPAREL' ? 'APPAREL' : s.material === 'ICONIC' ? 'ICONIC' : (s.season_tab === 'SS27' ? 'COLLECTION_SS27' : 'COLLECTION'); }
  function materialOfStory(name) {
    return Object.keys(TREE).find(m => Object.values(TREE[m]).some(weeks => Object.values(weeks).some(w => w.stories.some(g => g.story === name))));
  }
  window.catalogShow = () => { if (!ready) renderAll(); };
  // MAP에서 스토리/상품을 눌렀을 때: 설명집 탭이 보이는 상태에서 호출 — 스토리는 해당 박스로 스크롤, 상품은 상세 화면 열기
  window.catalogLand = (kind, value) => {
    if (kind === 'product' && STYLES[value]) {
      state.material = materialOfStyle(STYLES[value]); state.sub = 'products'; state.plan = 'ALL'; state.body = 'ALL'; state.attr = 'ALL'; state.month = 'ALL'; state.grp = 'ALL'; state.ch = 'ALL';
      renderAll();
      openDetailProduct(value);
    } else if (kind === 'story') {
      const m = materialOfStory(value);
      if (!m) { window.catalogShow(); return; }
      state.material = m; state.sub = 'products'; state.plan = 'ALL'; state.body = 'ALL'; state.attr = 'ALL'; state.month = 'ALL'; state.grp = 'ALL'; state.ch = 'ALL';
      renderAll();
      const box = [...document.querySelectorAll('#catStories .story-box')].find(b => b.dataset.box === value);
      if (box) { box.scrollIntoView({ block: 'start' }); box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 2200); }
    }
  };
})();
