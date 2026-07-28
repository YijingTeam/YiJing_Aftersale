/* ============ 常用件建储情况（需求文档 6.2；由「库存上下限」生成） ============ */
/* 依赖 app.js 通用 helper：npShell / npTH / npRenderTable / npFItem / npEscape / npToast / initFilterGrid / toggleFilterGrid */
/* 两个 Tab：建储明细（全量）、待建储明细（待建储数量>0 的子集）；列结构相同，数据集不同 */
/* 全局标准词为「配件」（其他既有页面均用「配件」），本页统一用「配件」 */
/* 全局字典：配件类别 = 配件/精品附件/辅料/工具/虚拟件（5 项，不含 X；X 为待定内部标记，不由用户选择）；配件销售属性 = 全站统一 12 项 */
/* 配件类别 / 配件销售属性 查询项均为模糊下拉（combobox），与全站其它菜单一致 */

/* ---- 通用模糊下拉（combobox）助手：本页两个查询项复用，按最近 .lt-input-wrap.combobox 定位 ---- */
function csComboboxFilter(input) {
  var w = input.closest('.lt-input-wrap.combobox'); if (!w) return;
  var l = w.querySelector('.lt-datalist'); if (!l) return;
  var v = input.value.toLowerCase();
  l.querySelectorAll('li').forEach(function (li) { li.classList.toggle('hidden', !li.textContent.toLowerCase().includes(v)); });
}
function csComboboxShow(input) {
  var w = input.closest('.lt-input-wrap.combobox'); if (!w) return;
  var l = w.querySelector('.lt-datalist'); if (l) l.classList.add('show');
}
function csComboboxToggle(arrow) {
  var w = arrow.closest('.lt-input-wrap.combobox'); if (!w) return;
  var l = w.querySelector('.lt-datalist'); if (!l) return;
  l.classList.toggle('show');
  if (l.classList.contains('show')) { var i = w.querySelector('input'); if (i) i.focus(); }
}
function csComboboxSelect(li) {
  var w = li.closest('.lt-input-wrap.combobox'); if (!w) return;
  var inp = w.querySelector('input'); var l = w.querySelector('.lt-datalist');
  if (inp) inp.value = li.textContent.trim();
  if (l) { l.classList.remove('show'); l.querySelectorAll('li').forEach(function (x) { x.classList.remove('hidden'); }); }
  var k = w.getAttribute('data-k'); if (k && NP[k] && NP[k].query) NP[k].query();
}
function csComboMarkup(K, fieldId, prefix, opts) {
  var lis = '<li data-val="" onclick="csComboboxSelect(this)">请选择</li>' +
    opts.map(function (o) { return '<li data-val="' + o + '" onclick="csComboboxSelect(this)">' + o + '</li>'; }).join('');
  // 结构与全站其它菜单（配件主数据 / 配件库存台账）的 combobox 完全一致：
  // .lt-filter-item > .lt-input-wrap.combobox(含 lt-filter-prefix + input + cb-arrow + lt-datalist)，不套 npFItem（避免双层 .lt-input-wrap 边框）
  return '<div class="lt-filter-item"><div class="lt-input-wrap combobox" style="position:relative" data-k="' + K + '">' +
    '<span class="lt-filter-prefix">' + prefix + '</span>' +
    '<input type="text" id="' + fieldId + '" placeholder="请选择或输入" onfocus="csComboboxShow(this)" oninput="csComboboxFilter(this)">' +
    '<span class="cb-arrow" onclick="csComboboxToggle(this)">▼</span>' +
    '<ul class="lt-datalist">' + lis + '</ul></div></div>';
}

/* 全局字典 */
var CS_CAT_OPTS = ['配件', '精品附件', '辅料', '工具', '虚拟件'];
var CS_ATTR_OPTS = ['关键配件', '自制件', '沿用件', '保养件', '车身件', '发动机件', '变速箱件', '电器', '空调及安全设备', '化学类原辅材料', '精品', '随车工具'];
var CS_REGION_OPTS = ['华东', '华南', '华北', '西南', '东北', '华中'];
var CS_DISTRICT_OPTS = ['上海', '广州', '北京', '成都', '沈阳', '杭州', '深圳', '天津', '重庆', '南京', '武汉', '苏州', '厦门', '宁波', '大连', '长沙', '济南', '石家庄', '昆明'];

function csSeed() {
  var a = [];
  var brands = ['奕境'];
  var cats = CS_CAT_OPTS;                                                       // 配件类别：全局 5 项字典
  var cars = [['奕境S 2024款'], ['奕境X9 纯电版', '奕境X9 增程版'], ['奕境X10'], ['奕境L7 PHEV', '奕境L7 EV']]; // 适用车系：奕境品牌
  var attrs = CS_ATTR_OPTS;                                                     // 配件销售属性：全站统一 12 项
  var stores = [                                                                // 大区/小区/门店：循环分配 6 个门店
    { region: '华东', district: '上海', store: '上海浦东店' },
    { region: '华南', district: '广州', store: '广州风丽店' },
    { region: '华北', district: '北京', store: '北京朝阳店' },
    { region: '西南', district: '成都', store: '成都武侯店' },
    { region: '东北', district: '沈阳', store: '沈阳和平店' },
    { region: '华东', district: '杭州', store: '杭州西湖店' }
  ];
  for (var i = 0; i < 24; i++) {
    var cat = cats[i % cats.length];
    var suggest = 20 + (i % 4) * 10;                       // 建议建储数量（来自库存上下限）
    var actual = (i % 3 === 0) ? suggest : (suggest - (5 + (i % 9))); // 实际库存数量
    if (actual < 0) actual = 0;
    var pending = Math.max(0, suggest - actual);           // 待建储数量 = 建议 - 实际（由库存上下限比对得出）
    var price = (15 + (i % 12) * 8.5).toFixed(2);
    var total = (pending * parseFloat(price)).toFixed(2);
    var mm = ((i % 12) + 1);                               // 维护时间 YYYY-MM-DD HH:MM:SS
    var dd = ((i % 28) + 1);
    var hh = 8 + (i % 10);
    var mi = (i * 7) % 60;
    var ss = (i * 13) % 60;
    var mdate = '2025-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd) + ' ' + (hh < 10 ? '0' + hh : hh) + ':' + (mi < 10 ? '0' + mi : mi) + ':' + (ss < 10 ? '0' + ss : ss);
    var si = i % stores.length;
    a.push({
      idx: i,
      brand: brands[i % brands.length],
      code: 'P' + (100000 + i),
      name: cat + '·' + String.fromCharCode(65 + i % 26) + (i + 1),
      cat: cat,
      attr: attrs[i % attrs.length],
      mdate: mdate,
      suggest: suggest,
      actual: actual,
      price: price,
      pending: pending,
      total: total,
      car: cars[i % cars.length].join(' / '),
      valid: i % 5 === 0 ? '无效' : '有效',
      region: stores[si].region,
      district: stores[si].district,
      store: stores[si].store
    });
  }
  return a;
}
var CS_ALL = csSeed();

function csCols() {
  return [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    { t: '配件编码', w: 110, cls: 'col-code sticky', f: function (r) { return r.code; } },
    { t: '配件名称', w: 170, cls: 'col-name sticky', f: function (r) { return npEscape(r.name); } },
    { t: '建议数量', w: 90, cls: 'col-suggest', f: function (r) { return r.suggest; } },
    { t: '实际库存数量', w: 110, cls: 'col-actual', f: function (r) { return r.actual; } },
    { t: '单价（含税）', w: 110, cls: 'col-price', f: function (r) { return r.price; } },
    { t: '待建储数量', w: 100, cls: 'col-pending', f: function (r) { return r.pending; } },
    { t: '待建储总价', w: 120, cls: 'col-total', f: function (r) { return r.total; } },
    { t: '适用车系', w: 170, cls: 'col-car', f: function (r) { return npEscape(r.car); } },
    { t: '配件类别', w: 110, cls: 'col-cat', f: function (r) { return npEscape(r.cat); } },
    { t: '配件销售属性', w: 140, cls: 'col-attr', f: function (r) { return npEscape(r.attr); } },
    { t: '是否有效', w: 90, cls: 'col-valid', f: function (r) { return r.valid; } },
    { t: '维护时间', w: 150, cls: 'col-mdate', f: function (r) { return r.mdate; } }
  ];
}

function csInitPanel(K, tb, pg, isPending) {
  var st = NP[K];
  var filter = npFItem('配件编码', '<input type="text" id="' + K + '-f-code" placeholder="请输入">') +
    npFItem('配件名称', '<input type="text" id="' + K + '-f-name" placeholder="请输入">') +
    csComboMarkup(K, K + '-f-cat', '配件类别', CS_CAT_OPTS) +
    csComboMarkup(K, K + '-f-attr', '配件销售属性', CS_ATTR_OPTS) +
    '<div class="lt-filter-item"><div class="lt-input-wrap"><span class="lt-filter-prefix">是否有效</span><select id="' + K + '-f-valid"><option value="">全部</option><option value="有效" selected>有效</option><option value="无效">无效</option></select></div></div>' +
    csComboMarkup(K, K + '-f-region', '大区', CS_REGION_OPTS) +
    csComboMarkup(K, K + '-f-district', '小区', CS_DISTRICT_OPTS) +
    npFItem('门店', '<input type="text" id="' + K + '-f-store" placeholder="请输入">');
  var toolbar = '<button class="lt-btn lt-btn-default" onclick="npToast(\'导出功能演示\')">导出</button>' +
    (isPending ? '<span id="cs-pending-total" style="margin-left:auto;font-size:13px;color:#333">待建储总计：<b style="color:#185FA5;font-weight:700">0.00元</b></span>' : '');
  var cols = csCols();
  var root = document.getElementById('cs-panel-' + (isPending ? 'pending' : 'built'));
  root.innerHTML = npShell(K, { l2: '配件订单管理', l3: '常用件建储情况' }, filter, toolbar, npTH(cols), tb, pg);
  initFilterGrid(K + '-filterGrid', 7); NP[K]._fShow = 7; NP[K]._fExp = false;
  st.query = function () {
    var c = (document.getElementById(K + '-f-code') || {}).value || '';
    var n = (document.getElementById(K + '-f-name') || {}).value || '';
    var cat = (document.getElementById(K + '-f-cat') || {}).value || '';
    var attr = (document.getElementById(K + '-f-attr') || {}).value || '';
    var v = (document.getElementById(K + '-f-valid') || {}).value || '';
    var region = (document.getElementById(K + '-f-region') || {}).value || '';
    var district = (document.getElementById(K + '-f-district') || {}).value || '';
    var store = (document.getElementById(K + '-f-store') || {}).value || '';
    st.filtered = st.allData.filter(function (r) {
      return (c === '' || r.code.indexOf(c) >= 0) && (n === '' || r.name.indexOf(n) >= 0) && (cat === '' || r.cat.indexOf(cat) >= 0) && (attr === '' || r.attr.indexOf(attr) >= 0) && (v === '' || r.valid === v) && (region === '' || r.region.indexOf(region) >= 0) && (district === '' || r.district.indexOf(district) >= 0) && (store === '' || r.store.indexOf(store) >= 0);
    });
    st.page = 1; st.render();
  };
  st.reset = function () {
    ['-f-code', '-f-name', '-f-cat', '-f-attr', '-f-region', '-f-district', '-f-store'].forEach(function (s) { var e = document.getElementById(K + s); if (e) e.value = ''; });
    var ev = document.getElementById(K + '-f-valid'); if (ev) ev.value = '有效';
    st.filtered = st.allData.filter(function(r){ return r.valid === '有效'; }); st.page = 1; st.render();
  };
  st.render = function () { npRenderTable(K, tb, pg, cols, st.filtered, st); if (isPending) csUpdatePendingTotal(); };
  st.filtered = st.allData.filter(function(r){ return r.valid === '有效'; }); st.page = 1; st.render();
}
function csUpdatePendingTotal() {
  var el = document.getElementById('cs-pending-total');
  if (!el) return;
  var st = NP['common-stock-pending'];
  var sum = 0;
  for (var i = 0; i < st.filtered.length; i++) { sum += parseFloat(st.filtered[i].total) || 0; }
  el.innerHTML = '待建储总计：<b style="color:#185FA5;font-weight:700">' + sum.toFixed(2) + '元</b>';
}

function initCommonStock() {
  var root = document.getElementById('page-common-stock');
  root.innerHTML =
    '<div class="cs-tabs">' +
    '<button class="cs-tab active" data-tab="built" onclick="csSwitchTab(\'built\')">建储明细</button>' +
    '<button class="cs-tab" data-tab="pending" onclick="csSwitchTab(\'pending\')">待建储明细</button>' +
    '</div>' +
    '<div id="cs-panel-built" class="cs-panel"></div>' +
    '<div id="cs-panel-pending" class="cs-panel" style="display:none"></div>';
  NP['common-stock-built'] = { page: 1, pageSize: 10, allData: CS_ALL.slice(), filtered: [], render: null, query: null, reset: null };
  NP['common-stock-pending'] = { page: 1, pageSize: 10, allData: CS_ALL.filter(function (r) { return r.pending > 0; }), filtered: [], render: null, query: null, reset: null };
  csInitPanel('common-stock-built', 'cs-built-tbody', 'cs-built-pager', false);
  csInitPanel('common-stock-pending', 'cs-pending-tbody', 'cs-pending-pager', true);
  csApplyStoreDefault();
}

function csApplyStoreDefault() {
  var role = (typeof gUserRole !== 'undefined') ? gUserRole : '门店';
  var isStore = (role === '门店');
  ['common-stock-built', 'common-stock-pending'].forEach(function (K) {
    // 大区 (combobox)
    var rEl = document.getElementById(K + '-f-region');
    if (rEl) { rEl.value = isStore ? '华东' : ''; rEl.readOnly = isStore; }
    // 小区 (combobox)
    var dEl = document.getElementById(K + '-f-district');
    if (dEl) { dEl.value = isStore ? '上海' : ''; dEl.readOnly = isStore; }
    // 门店 (text input)
    var sEl = document.getElementById(K + '-f-store');
    if (sEl) { sEl.value = isStore ? '上海浦东店' : ''; sEl.readOnly = isStore; }
    // 门店角色：隐藏大区/小区的 combobox 下拉箭头
    var tab = K === 'common-stock-built' ? 'built' : 'pending';
    var panel = document.getElementById('cs-panel-' + tab);
    if (panel) {
      panel.querySelectorAll('.cb-arrow').forEach(function (a) {
        a.style.display = isStore ? 'none' : '';
      });
    }
    if (NP[K] && NP[K].query) NP[K].query();
  });
}

function csSwitchTab(tab) {
  var built = tab === 'built';
  var pb = document.getElementById('cs-panel-built');
  var pp = document.getElementById('cs-panel-pending');
  if (pb) pb.style.display = built ? '' : 'none';
  if (pp) pp.style.display = built ? 'none' : '';
  var tabs = document.querySelectorAll('.cs-tab');
  if (tabs) tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === tab); });
  if (built) { if (NP['common-stock-built'].render) NP['common-stock-built'].render(); }
  else { if (NP['common-stock-pending'].render) NP['common-stock-pending'].render(); }
}
