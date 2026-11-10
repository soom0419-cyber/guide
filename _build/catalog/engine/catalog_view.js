// 상품 설명집 탭: 시즌 탭 > 기획명/복종 필터 > 스토리 박스(소개 문구 + 아이템 카드, 출고 순).
// generate_html.py가 바잉 마스터파일 스크립트에 끼워 넣는다(TREE/STYLES/STORIES와 fmtNum·rrpDisplay·mmdd·korMmdd 등 공용 함수를 사용).
(function () {
  const state = { material: null, plan: 'ALL', body: 'ALL', attr: 'ALL', month: 'ALL', grp: 'ALL', search: '' };
  let ready = false;
  const attr = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  // ---------------- 기획명 / 복종 / 소재 필터 ----------------
  const BODY_GROUP = { '바이저중간챙': '바이저', '바이저큰챙': '바이저', '클로슈작은챙': '클로슈', '클로슈중간챙': '클로슈', '클로슈큰챙': '클로슈',
    '버킷큰챙': '버킷', '페도라작은챙': '페도라', '페도라중간챙': '페도라' };
  const FILTER_ORDER = { '모자': ['바이저', '클로슈', '버킷', '카스켓', '보터햇', '캡', '페도라', '헌팅캡', '베레', '비니'],
    '가방': ['숄더백', '토트백', '크로스바디', '클러치'], '액세서리': ['스카프', '글로브', '액세서리'],
    '의류': ['재킷', '코트', '니트', '셔츠', '블라우스', '원피스', '스커트', '팬츠'] };
  const PLANS = ['모자', '가방', '액세서리'];
  const plansOf = () => state.material === 'APPAREL' ? ['의류'] : PLANS;
  // 소재 필터 라벨(입판재 "속성명" 원본 -> 한글 표기) — MAP과 동일한 매핑
  const ATTR_LABEL = {
    'BRAID (CLASSIC)': '브레이드', 'BRAID (LACE)': '브레이드', 'BRAID (LIGHT)': '라이트 브레이드',
    'BRAID (SCALLOP)': '스캘롭 브레이드', 'BRAID (WIDE)': '와이드 브레이드', 'CROCHET': '크로셰', 'ETC': '기타',
    'FABRIC (BOUCLE)': '부클', 'FABRIC (CORDUROY)': '코듀로이', 'FABRIC (COTTON)': '코튼', 'FABRIC (ETC)': '기타',
    'FABRIC (KNIT)': '니트', 'FABRIC (LINEN)': '린넨', 'FABRIC (NYLON)': '나일론', 'FABRIC (WOOL)': '울',
    'FINE WOOL FELT': '울펠트', 'FUR': '퍼', 'LEATHER': '레더', 'PANAMA': '파나마', 'WOOL FELT': '울펠트',
    'CROCHET&FABRIC': '크로셰&패브릭',
  };
  const bodyGroup = s => BODY_GROUP[s.body] || s.body;
  const attrLabel = s => ATTR_LABEL[s.attr] || s.attr || '';
  // 기준 = 혼용률(material_main/material_full)에 '라피아', 또는 품명에 RAFFIA/PANAMA(파나마 햇 포함)가 들어가면 라피아, 그 외 전부 CMT (혼용률 비어 있어도 품명으로 판정)
  const SS27_GROUPS = ['라피아', 'CMT'];
  const ssGroupOf = s => (/라피아/.test((s.material_full || '') + ' ' + (s.material_main || '') + ' ' + (s.name_kr || '')) || /RAFFIA|PANAMA/i.test(s.name_sjg || '') || s.attr === 'PANAMA') ? '라피아' : 'CMT';
  const attrOk = s => state.attr === 'ALL' || (SS27_GROUPS.includes(state.attr) ? (s.season_tab === 'SS27' && ssGroupOf(s) === state.attr) : attrLabel(s) === state.attr);
  // 출고월(컬렉션) / 코어·NEW(아이코닉) 필터
  const MONTH_OF = {};
  Object.entries(TREE).forEach(([mat, months]) => { if (mat !== 'ICONIC') Object.entries(months).forEach(([mo, weeks]) => Object.values(weeks).forEach(w => w.stories.forEach(g => g.styles.forEach(c => { MONTH_OF[c] = mo; })))); });
  const monthOf = s => MONTH_OF[s.item_code];
  const monthOk = s => state.month === 'ALL' || String(monthOf(s)) === state.month;
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
  const matches = s => globalSearch() ? searchOk(s) : (state.plan === 'ALL' || s.plan === state.plan) && (state.body === 'ALL' || bodyGroup(s) === state.body)
    && attrOk(s) && monthOk(s) && grpOk(s) && searchOk(s);

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

  function renderFilters() {
    const pc = {}, bc = {};
    eachStyle(state.material, s => {
      pc[s.plan] = (pc[s.plan] || 0) + 1;
      if (state.plan === 'ALL' || s.plan === state.plan) bc[bodyGroup(s)] = (bc[bodyGroup(s)] || 0) + 1;
    });
    const total = Object.values(pc).reduce((a, b) => a + b, 0);
    const chip = (kind, val, label, n, on) => `<button class="fchip${on ? ' active' : ''}${n ? '' : ' zero'}" data-k="${kind}" data-v="${attr(val)}">${label}<span class="n">${n}</span></button>`;
    const planRow = `<span class="flabel">기획명</span>${chip('plan', 'ALL', '전체', total, state.plan === 'ALL')}${plansOf().map(p => chip('plan', p, p, pc[p] || 0, state.plan === p)).join('')}`;
    let html = '', topRow = '';
    const rest = (s, skip) => (skip === 'month' || state.month === 'ALL' || String(monthOf(s)) === state.month) && (skip === 'grp' || grpOk(s));
    if (state.material === 'ICONIC') {
      const gcnt = { '코어': 0, 'NEW': 0 }, gall = [];
      eachStyle(state.material, s => { if (!((state.plan === 'ALL' || s.plan === state.plan) && (state.body === 'ALL' || bodyGroup(s) === state.body))) return; gall.push(s);
        ['코어', 'NEW'].forEach(k => { if (s.colors.some(c => c.cgroup === CG_OF[k])) gcnt[k]++; }); });
      topRow = `<span class="flabel">구분</span>${chip('grp', 'ALL', '전체', gall.length, state.grp === 'ALL')}${['코어', 'NEW'].map(k => chip('grp', k, k, gcnt[k], state.grp === k)).join('')}`;
    } else {
      const mc = {}; let mt = 0;
      eachStyle(state.material, s => { if (!((state.plan === 'ALL' || s.plan === state.plan) && (state.body === 'ALL' || bodyGroup(s) === state.body))) return; mc[monthOf(s)] = (mc[monthOf(s)] || 0) + 1; mt++; });
      const months = Object.keys(TREE[state.material] || {}).sort((a, b) => monthRank(a) - monthRank(b));
      topRow = `<span class="flabel">출고월</span>${chip('month', 'ALL', '전체', mt, state.month === 'ALL')}${months.map(m => chip('month', m, m + '월', mc[m] || 0, state.month === m)).join('')}`;
    }
    html += `<div class="fchips">${planRow}</div>`;  // 출고월(구분) 행이 맨 위(검색창과 같은 줄), 기획명은 그 아래
    if (state.plan !== 'ALL') {
      const known = FILTER_ORDER[state.plan] || [];
      const list = known.concat(Object.keys(bc).filter(g => !known.includes(g)));
      html += `<div class="fchips"><span class="flabel">복종</span>${chip('body', 'ALL', '전체', pc[state.plan] || 0, state.body === 'ALL')}${list.map(g => chip('body', g, g, bc[g] || 0, state.body === g)).join('')}</div>`;
    }
    const ac = {}, gc = {};
    eachStyle(state.material, s => {
      if (!((state.plan === 'ALL' || s.plan === state.plan) && (state.body === 'ALL' || bodyGroup(s) === state.body))) return;
      const label = attrLabel(s);
      if (label) ac[label] = (ac[label] || 0) + 1;
      gc[ssGroupOf(s)] = (gc[ssGroupOf(s)] || 0) + 1;
    });
    const attrLabels = Object.keys(ac).sort((a, b) => ac[b] - ac[a]);
    const attrTotal = Object.values(ac).reduce((a, b) => a + b, 0);
    if (attrLabels.length) {
      const groupChips = state.material === 'COLLECTION_SS27' ? SS27_GROUPS.map(g => `<button class="fchip group${state.attr === g ? ' active' : ''}${gc[g] ? '' : ' zero'}" data-k="attr" data-v="${g}">${g}<span class="n">${gc[g] || 0}</span></button>`).join('') : '';
      html += `<div class="fchips"><span class="flabel">소재</span>${chip('attr', 'ALL', '전체', attrTotal, state.attr === 'ALL')}${groupChips}${attrLabels.map(l => chip('attr', l, l, ac[l], state.attr === l)).join('')}</div>`;
    }
    document.getElementById('catPlanRow').innerHTML = topRow;  // 검색창은 이 행의 오른쪽에 고정 배치(입력 중 다시 그려지지 않도록 별도 요소)
    document.getElementById('catFilters').innerHTML = html;
    document.querySelectorAll('#catPlanRow button, #catFilters button').forEach(b => b.onclick = () => {
      if (b.dataset.k === 'month') { state.month = b.dataset.v; }
      else if (b.dataset.k === 'grp') { state.grp = b.dataset.v; }
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
      <div class="simple-thumb">${hero ? `<img src="${hero.image}" alt="${attr(s.name_sjg)}">` : '<div class="noimg"></div>'}</div>
      <div class="simple-body">
        <div class="simple-name">${s.name_sjg}${s.seasons && s.seasons.includes('R27') ? ' <span class="season-badge">R27</span>' : ''}</div>
        <div class="simple-name-kr">${s.name_kr}</div>
        <div class="simple-size">사이즈 ${s.sizes.join('/')}</div>
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
    const eyebrow = info && info.eyebrow ? info.eyebrow : (isIconic ? 'ICONIC · ' + g.category : (tags.length > 1 ? tags.join(' · ') + ' COLLECTION' : seasonLabel(first)));
    const points = info && info.bullets && info.bullets.length
      ? `<ul class="story-points">${info.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
      : (isIconic ? '<div class="story-plain">시즌에 관계없이 상시 판매되는 아이코닉 상품입니다.</div>' : '');
    return `
    <div class="story-box" data-box="${attr(g.story)}">
      <div class="sb-head">
        <div class="sb-eyebrow">${eyebrow}</div>
        <div class="sb-title">${g.story}</div>
        <div class="sb-count">스타일 ${cards.length}종</div>
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
      return `<button data-mat="${m}" class="${m === state.material && !globalSearch() ? 'active' : ''}">${MATERIAL_LABELS[m] || m}<span class="count">${n}종</span></button>`;
    }).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (globalSearch()) { state.search = ''; document.getElementById('catSearch').value = ''; }
      state.material = b.dataset.mat; state.plan = 'ALL'; state.body = 'ALL'; state.attr = 'ALL'; state.month = 'ALL'; state.grp = 'ALL'; renderAll();
    });
  }

  function renderAll() {
    ready = true; renderMaterialTabs(); renderFilters(); renderStories();
    const fl = document.querySelector('.filters'); if (fl && window.CATALOG_GLOBAL_SEARCH) fl.hidden = globalSearch();
    const cnt = document.getElementById('catSearchCount');
    if (cnt) cnt.textContent = state.search.trim() ? `${collectStories().reduce((a, b) => a + b.styles.length, 0)}종` : '';
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
      state.material = materialOfStyle(STYLES[value]); state.plan = 'ALL'; state.body = 'ALL'; state.attr = 'ALL'; state.month = 'ALL'; state.grp = 'ALL';
      renderAll();
      openDetailProduct(value);
    } else if (kind === 'story') {
      const m = materialOfStory(value);
      if (!m) { window.catalogShow(); return; }
      state.material = m; state.plan = 'ALL'; state.body = 'ALL'; state.attr = 'ALL'; state.month = 'ALL'; state.grp = 'ALL';
      renderAll();
      const box = [...document.querySelectorAll('#catStories .story-box')].find(b => b.dataset.box === value);
      if (box) { box.scrollIntoView({ block: 'start' }); box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 2200); }
    }
  };
})();
