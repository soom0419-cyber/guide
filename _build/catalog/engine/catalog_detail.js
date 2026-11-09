// ---------------- detail overlay ----------------

function openDetailProduct(itemCode) {
  detailState.product = itemCode;
  document.getElementById('detail-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderDetailProduct(itemCode);
  document.getElementById('detail-overlay').scrollTo(0, 0);
}
function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('active');
  document.body.style.overflow = '';
}
function renderCrumb(storyName, productName) {
  const el = document.getElementById('crumb');
  if (productName) {
    el.innerHTML = `<span>${storyName}</span><span class="sep">/</span><button class="current">${productName}</button>`;
  } else {
    el.innerHTML = `<button class="current">${storyName}</button>`;
  }
}

function productThumb(s) {
  const first = s.colors.find(c => c.image);
  return first ? first.image : null;
}

// ICONIC 컬러 그룹(코어 / NEW 시즌 / 구 시즌): 모든 컬러에 cgroup이 있을 때만 그룹으로 나눈다. 구 시즌은 기본 접힘.
function cgGroups(colors) {
  if (!colors.length || !colors.every(c => c.cgroup)) return null;
  return ['코어', 'NEW 시즌', '구 시즌'].map(l => ({ label: l, colors: colors.filter(c => c.cgroup === l) })).filter(g => g.colors.length);
}
// 컬러코드 앞에 붙이는 작은 딱지: 코어 / NEW / 구시즌
function cgTagHtml(g) {
  const k = g === '코어' ? 'core' : g === 'NEW 시즌' ? 'new' : 'old';
  return `<span class="cg-tag cg-${k}">${g === 'NEW 시즌' ? 'NEW' : g === '구 시즌' ? '구시즌' : g}</span>`;
}

function renderDetailProduct(itemCode) {
  document.getElementById('dview-product').classList.add('active');
  const s = STYLES[itemCode];
  if (!s) return;
  renderCrumb(s.story, s.name_sjg);

  const galleryHtml = s.has_hq_gallery
    ? `<div class="gallery-list">${s.colors.filter(c => c.gallery).flatMap(c => c.gallery.map(img => `
        <div class="gallery-list-item">
          <img src="${img}" alt="${s.name_sjg} ${c.color_code}">
          <span class="tag">${c.color_code}</span>
        </div>`)).join('')}</div>`
    : (s.colors.filter(c => c.image).map(c => `
        <div class="cell"><img src="${c.image}" alt="${s.name_sjg} ${c.color_code}"><span class="tag">${c.color_code}</span></div>`).join('')
        || `<div class="cell"></div>`);

  const specs = [
    ['복종', s.body], ['챙길이', s.brim], ['기장', s.length_cm ? s.length_cm + 'cm' : ''], ['핏', s.fit], ['안감', s.lining], ['사이즈', s.sizes.join('/')],
    ['원산지', s.origin], ['더스트백', s.dustbag], ['출고일', mmdd(s.ship_date)],
  ].filter(([, v]) => v);
  const specsHtml = specs.map(([label, val]) => `
    <div class="spec-item"><div class="s-label">${label}</div><div class="s-val">${val}</div></div>`).join('');

  const tagsHtml = (s.tags && s.tags.length)
    ? `<div class="tag-row">${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : '';

  const descHtml = (s.desc && s.desc.length)
    ? `<div class="section-label">제품 설명</div><ul class="desc-list">${s.desc.map(d => `<li>${d}</li>`).join('')}</ul>` : '';

  const showQty = s.material !== 'APPAREL';  // 의류는 발주수량 비공개
  const colorRowOf = c => `<tr><td>${c.cgroup ? cgTagHtml(c.cgroup) : ''}${c.color_code}</td><td>${c.color_kr || ''}</td>${showQty ? `<td>${fmtNum(c.order)}</td>` : ''}</tr>`;
  const colorRows = s.colors.map(colorRowOf).join('');
  const totalRow = showQty && s.colors.length > 1 ? `<tr class="total"><td>TOTAL</td><td></td><td>${fmtNum(s.total.order)}</td></tr>` : '';

  const materialHtml = (s.material_full || s.material_main)
    ? `<div class="section-label">혼용율</div><div class="material-box"><div class="m-label">Composition</div>${s.material_full || s.material_main}</div>` : '';

  const careHtml = (s.care && s.care.length)
    ? `<div class="section-label">제품 케어 방법</div><div class="care-box"><p>${s.care.join(' / ')}</p></div>` : '';

  const infoHtml = `
      <div>
        <div class="product-eyebrow">${s.story}</div>
        <h1 class="product-title">${s.name_sjg} <span class="name-kr-inline">${s.name_kr}</span></h1>
        ${s.transition_note ? `<div class="transition-note">${s.transition_note}</div>` : ''}
        <div class="product-code">품번 ${s.material === 'ICONIC' ? (s.display_code || '') : s.item_code}</div>
        <div class="product-price">${rrpDisplay(s)}</div>
        <div class="spec-grid">${specsHtml}</div>
        ${tagsHtml}
        ${descHtml}
        <div class="section-label">${showQty ? '컬러 · 수량' : '컬러'}</div>
        <table class="color-table"><thead><tr><th>컬러</th><th>컬러명</th>${showQty ? '<th>발주수량</th>' : ''}</tr></thead><tbody>${colorRows}${totalRow}</tbody></table>
        ${materialHtml}
        ${careHtml}
      </div>`;

  document.getElementById('dview-product').innerHTML =
    `<div class="product-layout"><div class="${s.has_hq_gallery ? 'gallery-col' : 'product-gallery'}">${galleryHtml}</div>${infoHtml}</div>`;
}

