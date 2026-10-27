/* ============================================================
   售后管理 / 维保服务 / 预收款
   - Tab 1「预收款记录」：每笔预收款登记的清单（npShell 列表页 + 新增侧滑面板）
   - Tab 2「预收款余额」：按「车主 + 门店」汇总的余额（npShell 列表页 + 查看明细侧滑面板）
   数据来源：
     · 车主（客档）主数据 → window.CAR_OWNERS（由 js/car-owner.js 暴露，故本文件必须排在其后引入）
     · 门店主数据       → NP['store-manage'].allData（只取 shortName / code，不另建门店字典）
   余额与明细一律由「预收款记录（充值）＋使用记录」实时派生，
   新增一笔预收款后，余额页与明细立即跟随，不存第二份余额数据。
   渲染层全部使用当前原型既有类与公共 helper（npShell / npTH / npSelect / npFItem /
   npOpenModal / npRenderTable / npRenderActions / msOpenStorePicker / npExportExcelRowsRaw）。

   2026-10-27（用户两条）：
     ① 预收款余额列表加「导出」（yskExportBalance，导出当前筛选结果，不含操作列）；
     ② 查看明细列表加「业务单据号」列（位置：业务 ~ 金额之间）与「导出」（yskExportDetail）。
        业务单据号取值规则见规范 §4.9.5（唯一出口 YSK_BIZ_DOC_PREFIX）；充值行显示「—」。
        明细表同时从"手写逐行拼 td"收口到 cols() + npRenderTable（th 与 td 同源，杜绝再加列错位）。
   ============================================================ */

/* ---------- 枚举（存成常量，杜绝多处硬编码字符串漂移） ---------- */
var YSK_CHANNEL = '门店自行(线下收款)';        /* 收款渠道：本模块只有门店自行线下收款一种 */
var YSK_METHODS = ['微信', '支付宝', '银行卡', '现金'];
var YSK_BIZ = ['交付横向费用', '维修结算', '配件销售', '保险', '服务包'];
var YSK_TYPES = ['充值', '使用'];
/* 业务单据号前缀（规范 §4.9.5 唯一出口）：单号＝前缀-门店编码+YYMMDD+3位流水；
   维修结算沿用「维修结算收款」的结算单号格式（WXJSDYJ-…），不另造一套。 */
var YSK_BIZ_DOC_PREFIX = {
  '维修结算': 'WXJSDYJ',
  '配件销售': 'PSXD',
  '保险': 'BXD',
  '服务包': 'FWB',
  '交付横向费用': 'JFHX'
};
/* 演示口径：当前登录门店 ＝ 上海浦东店（与「常用件建储情况」等门店侧页面的默认门店一致） */
var YSK_CUR_STORE_CODE = 'SH001';
/* 收款登记人的取法（2026-10-27 用户口径：登记收款的都是门店的人，不可能是登录用户自己）：
   取「该门店的门店财务经理（R12）」真实姓名，该店没有这个人时退到「门店管理员（R05）」。
   人名一律从人员主数据（用户管理 › 人员）现取，页面里不写死任何人名，也不再写「当前门店用户」这类角色占位。规范 §4.9.6 */
var YSK_REGISTRAR_ROLES = ['R12', 'R05'];

/* ---------- 状态容器（两个 Table 页各一份，走全站 NP 状态表） ---------- */
NP['prepayment-record'] = { page: 1, pageSize: 20, allData: [], filtered: [], render: null, query: null, reset: null };
NP['prepayment-balance'] = { page: 1, pageSize: 20, allData: [], filtered: [], render: null, query: null, reset: null };
/* 明细面板：一次给满（该车主在该门店的流水条数有限，不做分页），但仍走公共渲染 npRenderTable */
NP['prepayment-detail'] = { page: 1, pageSize: 1000, filtered: [], render: null };

/* ---------- 小工具 ---------- */
function yskNum(v) { var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function yskMoney(v) { return yskNum(v).toFixed(2); }
function yskMoneyHtml(v) { return '<span class="np-money">¥' + yskMoney(v) + '</span>'; }
function yskOwner(name) {
  var all = window.CAR_OWNERS || [];
  for (var i = 0; i < all.length; i++) { if (all[i].name === name) return all[i]; }
  return null;
}
function yskStore(code) {
  var all = (NP['store-manage'] && NP['store-manage'].allData) || [];
  for (var i = 0; i < all.length; i++) { if (all[i].code === code) return all[i]; }
  return null;
}
/* 门店名称统一显示门店简称（取门店管理主数据，与维修结算收款一致） */
function yskStoreShort(code) { var s = yskStore(code); return s ? (s.shortName || s.name) : '—'; }
function yskStoreLabel(code) { var s = yskStore(code); return s ? ((s.shortName || s.name) + '(' + s.code + ')') : '—'; }
/* 收款登记人：该门店的财务经理（缺员退门店管理员），真实姓名现取 —— 与登录身份档位无关 */
function yskRegistrar(storeCode) {
  return npStorePersonName(storeCode || YSK_CUR_STORE_CODE, YSK_REGISTRAR_ROLES);
}
/* 表单/查询取值：combobox 残留的「请选择」按空处理 */
function yskVal(id) {
  var v = (document.getElementById(id) || {}).value || '';
  return v === '请选择' ? '' : v;
}
/* 多选门店框 → 门店简称数组 */
function yskStoreNames(raw) {
  return String(raw || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
}

/* ============================================================
   一、预收款记录（充值）种子数据
   日期落在 2026-09-23 ~ 2026-10-23（规范默认区间＝上月今天~今天），否则进页面 0 条
   收款登记人不写死人名：按各自门店从人员主数据取（见下方 st.allData 的 registrar 派生），
   否则会重犯 2026-10-27 用户抓到的问题——「王芳」是上海浦东店的人却挂在河北店的记录上。
   ============================================================ */
var YSK_RECORD_SEED = [
  { owner: '沐云汐', storeCode: 'SH001',  method: '微信',   amount: '3000.00', time: '2026-10-23 10:12:33' },
  { owner: '张建国', storeCode: 'BJ001',  method: '银行卡', amount: '5000.00', time: '2026-10-20 09:25:41' },
  { owner: '刘婉如', storeCode: 'HBZ01',  method: '现金',   amount: '4000.00', time: '2026-10-19 13:17:09' },
  { owner: '李思远', storeCode: 'GZ001',  method: '微信',   amount: '2000.00', time: '2026-10-18 11:33:55' },
  { owner: '沐云汐', storeCode: 'SH001',  method: '支付宝', amount: '2000.00', time: '2026-10-16 15:40:08' },
  { owner: '陈志明', storeCode: 'WH001',  method: '微信',   amount: '1000.00', time: '2026-10-15 10:02:47' },
  { owner: '王雅静', storeCode: 'SCZ01',  method: '支付宝', amount: '8000.00', time: '2026-10-12 16:48:20' },
  { owner: '沐云汐', storeCode: 'BJ001',  method: '微信',   amount: '1200.00', time: '2026-10-11 09:48:36' },
  { owner: '张建国', storeCode: 'BJ001',  method: '现金',   amount: '1500.00', time: '2026-10-09 14:06:12' },
  { owner: '李思远', storeCode: 'HZ001',  method: '银行卡', amount: '3000.00', time: '2026-10-07 15:55:14' },
  { owner: '王雅静', storeCode: 'SZ001',  method: '支付宝', amount: '2500.00', time: '2026-09-29 10:36:28' },
  /* ★ 2026-10-27：这一条原为 2026-09-26，落在「近一月」默认区间（上个月同日 ~ 今天）之外，
     日期一滚到 10-27 就被默认区间挡掉 → 「重置回到全量」用例变 12/13。
     种子的日期是写死的、默认区间却随时间滚动，这类"隔一段时间就红一次"的用例必须靠数据落在区间内来避免，
     故把最老这条挪到 2026-09-28（仍是全表最早，倒序位置不变）。 */
  { owner: '赵文博', storeCode: 'SH001',  method: '现金',   amount: '600.00',  time: '2026-09-28 11:20:05' }
];
(function () {
  var st = NP['prepayment-record'];
  st.allData = YSK_RECORD_SEED.map(function (r, i) {
    return {
      idx: i,
      owner: r.owner,
      ownerCode: (yskOwner(r.owner) || {}).code || '—',
      storeCode: r.storeCode,
      channel: YSK_CHANNEL,
      method: r.method,
      amount: r.amount,
      /* 收款登记人：按该行门店从人员主数据派生（不写死人名，见 YSK_REGISTRAR_ROLES 注释） */
      registrar: yskRegistrar(r.storeCode),
      time: r.time
    };
  });
})();

/* ============================================================
   二、使用记录（预收款被消耗的流水）
   口径：预收款在「交付横向费用 / 维修结算 / 配件销售 / 保险 / 服务包」五个业务场景被扣减；
        充值不属于任何业务场景，故充值行「业务」显示「—」。
   2026-10-27：每条使用流水带「业务单据号」docNo（＝发生这笔业务的单据号），
        明细页把它显示在「业务」与「金额」之间；规则见规范 §4.9.5：
        前缀-门店编码+YYMMDD+3位流水，YYMMDD 取该笔流水发生时间。
   数据为原型演示数据，不与维修结算收款、配件销售等页面实时联动。
   ============================================================ */
var YSK_USAGE = [
  { owner: '刘婉如', storeCode: 'HBZ01', biz: '保险',           docNo: 'BXD-HBZ01261022001',    amount: '2600.00', time: '2026-10-22 09:33:18' },
  { owner: '沐云汐', storeCode: 'SH001', biz: '维修结算',       docNo: 'WXJSDYJ-SH001261021001', amount: '680.00',  time: '2026-10-21 14:22:10' },
  { owner: '张建国', storeCode: 'BJ001', biz: '维修结算',       docNo: 'WXJSDYJ-BJ001261021001', amount: '1250.00', time: '2026-10-21 16:30:12' },
  { owner: '王雅静', storeCode: 'SCZ01', biz: '服务包',         docNo: 'FWB-SCZ01261020001',    amount: '1200.00', time: '2026-10-20 14:08:55' },
  { owner: '李思远', storeCode: 'GZ001', biz: '配件销售',       docNo: 'PSXD-GZ001261020001',   amount: '460.00',  time: '2026-10-20 15:47:03' },
  { owner: '沐云汐', storeCode: 'SH001', biz: '配件销售',       docNo: 'PSXD-SH001261019001',   amount: '320.00',  time: '2026-10-19 11:05:36' },
  { owner: '王雅静', storeCode: 'SCZ01', biz: '维修结算',       docNo: 'WXJSDYJ-SCZ01261017001', amount: '2380.00', time: '2026-10-17 10:36:29' },
  { owner: '张建国', storeCode: 'BJ001', biz: '保险',           docNo: 'BXD-BJ001261014001',    amount: '2000.00', time: '2026-10-14 09:12:51' },
  { owner: '沐云汐', storeCode: 'BJ001', biz: '服务包',         docNo: 'FWB-BJ001261013001',    amount: '800.00',  time: '2026-10-13 10:18:44' },
  { owner: '李思远', storeCode: 'HZ001', biz: '交付横向费用',   docNo: 'JFHX-HZ001261009001',   amount: '900.00',  time: '2026-10-09 13:24:16' },
  { owner: '王雅静', storeCode: 'SZ001', biz: '配件销售',       docNo: 'PSXD-SZ001261005001',   amount: '730.00',  time: '2026-10-05 11:52:37' }
];

/* ============================================================
   三、余额与明细派生（唯一出口：任何时候都从上面两份流水现算）
   ============================================================ */
/* 按「车主 + 门店」汇总；返回 [{owner, storeCode, recharge, used, balance, rows}] */
function yskLedger() {
  var map = {}, list = [];
  function ensure(owner, storeCode) {
    var k = owner + '|' + storeCode;
    if (!map[k]) {
      map[k] = { owner: owner, storeCode: storeCode, recharge: 0, used: 0, rows: [] };
      list.push(map[k]);
    }
    return map[k];
  }
  (NP['prepayment-record'].allData || []).forEach(function (r) {
    var it = ensure(r.owner, r.storeCode);
    it.recharge += yskNum(r.amount);
    /* 充值行的「业务」不属于五个业务场景，显示「—」；充值不挂业务单据，单据号同样是「—」 */
    it.rows.push({ type: '充值', biz: '—', docNo: '—', amount: yskNum(r.amount), time: r.time, method: r.method });
  });
  YSK_USAGE.forEach(function (u) {
    var it = ensure(u.owner, u.storeCode);
    it.used += yskNum(u.amount);
    it.rows.push({ type: '使用', biz: u.biz, docNo: u.docNo || '—', amount: yskNum(u.amount), time: u.time, method: '' });
  });
  list.forEach(function (it) {
    it.balance = it.recharge - it.used;
    /* 明细倒序：充值记录与使用记录混在一起，按发生时间从近到远 */
    it.rows.sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
  });
  return list;
}
function yskLedgerOf(owner, storeCode) {
  var list = yskLedger();
  for (var i = 0; i < list.length; i++) {
    if (list[i].owner === owner && list[i].storeCode === storeCode) return list[i];
  }
  return null;
}
/* 明细筛选：充值/使用、业务、业务单据号；空值＝全部（默认全部）
   业务单据号按「模糊包含」匹配、忽略大小写（2026-10-27 用户口径：文本搜索框即可）；
   充值行的单据号是「—」，按文本参与匹配（输入「—」能筛出充值行，输真实单号则筛不到它）。 */
function yskFilterRows(rows, type, biz, docNo) {
  var kw = String(docNo === null || docNo === undefined ? '' : docNo).trim().toLowerCase();
  return (rows || []).filter(function (x) {
    if (type !== '' && x.type !== type) return false;
    if (biz !== '' && x.biz !== biz) return false;
    if (kw !== '') {
      var dn = String(x.docNo || '—').toLowerCase();
      if (dn.indexOf(kw) < 0) return false;
    }
    return true;
  });
}

/* ============================================================
   四、页面骨架：两个 Tab + 两个 npShell 列表
   ============================================================ */
function initPrepayment() {
  var root = document.getElementById('page-prepayment');
  if (!root) return;
  root.innerHTML =
    '<div class="cs-tabs">' +
      '<button class="cs-tab active" data-tab="record" onclick="yskSwitchTab(\'record\')">预收款记录</button>' +
      '<button class="cs-tab" data-tab="balance" onclick="yskSwitchTab(\'balance\')">预收款余额</button>' +
    '</div>' +
    '<div id="ysk-panel-record" class="cs-panel"></div>' +
    '<div id="ysk-panel-balance" class="cs-panel hidden"></div>';

  yskInitRecordPanel();
  yskInitBalancePanel();
}

/* Tab 切换：切过去时重算一次，保证新增的预收款立刻出现在余额页 */
function yskSwitchTab(tab) {
  var isRecord = tab === 'record';
  var pr = document.getElementById('ysk-panel-record');
  var pb = document.getElementById('ysk-panel-balance');
  if (pr) pr.classList.toggle('hidden', !isRecord);
  if (pb) pb.classList.toggle('hidden', isRecord);
  var tabs = document.querySelectorAll('#page-prepayment .cs-tab');
  if (tabs) tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === tab); });
  var st = NP[isRecord ? 'prepayment-record' : 'prepayment-balance'];
  if (st && st.query) st.query();
  else if (st && st.render) st.render();
}

/* 门店筛选框：全站统一门店选择器（.lt-input-wrap.search.store-pick + 放大镜图标 + 白底可点）
   id 必须以 -flt-store 结尾：msStoreConfirm 靠该后缀反推模块前缀并回调 xxxApplyFilter */
function yskStoreFilterItem(inputId) {
  return '<div class="lt-filter-item"><div class="lt-input-wrap search store-pick">' +
    '<span class="lt-filter-prefix">门店</span>' +
    '<input type="text" id="' + inputId + '" placeholder="请选择" readonly onclick="msOpenStorePicker(\'' + inputId + '\')">' +
    '<svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg>' +
    '</div></div>';
}

/* ---------- Tab 1：预收款记录 ---------- */
function yskInitRecordPanel() {
  var K = 'prepayment-record';
  var cols = [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    { t: '车主姓名', w: 100, cls: 'col-owner sticky', f: function (r) { return npEscape(r.owner); } },
    { t: '门店名称', w: 150, cls: 'col-store-name', f: function (r) { return npEscape(yskStoreShort(r.storeCode)); } },
    { t: '门店编码', w: 90, cls: 'col-store-code', f: function (r) { return npEscape(r.storeCode); } },
    { t: '收款渠道', w: 170, cls: 'col-channel', f: function (r) { return npEscape(r.channel); } },
    { t: '收款方式', w: 100, cls: 'col-method', f: function (r) { return npEscape(r.method); } },
    { t: '金额', w: 120, cls: 'col-amount', f: function (r) { return yskMoneyHtml(r.amount); } },
    { t: '收款登记人', w: 120, cls: 'col-registrar', f: function (r) { return npEscape(r.registrar); } },
    { t: '收款时间', w: 170, cls: 'col-time', f: function (r) { return npEscape(r.time); } }
  ];

  /* 查询项：车主姓名、门店、收款方式、收款日期（4 项，未超过 7 项，无需折叠） */
  var filter =
    npFItem('车主姓名', '<input type="text" id="ysk-f-owner" placeholder="请输入">') +
    yskStoreFilterItem('ysk-flt-store') +
    npSelect('收款方式', '<select id="ysk-f-method" onchange="yskApplyFilter()"><option value="">请选择</option>' +
      YSK_METHODS.map(function (m) { return '<option>' + npEscape(m) + '</option>'; }).join('') + '</select>') +
    '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">收款日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" id="ysk-flt-date-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="yskApplyFilter">' +
      '<div class="lt-date-range-drop">' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="ysk-flt-date-start" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
        '<span>—</span>' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="ysk-flt-date-end" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div>' +
    '</div></div>';

  var toolbar =
    '<button class="lt-btn lt-btn-primary" onclick="yskOpenAdd()">新增</button>' +
    '<button class="lt-btn lt-btn-default" onclick="yskExportRecords()">导出</button>';

  var root = document.getElementById('ysk-panel-record');
  root.innerHTML = npShell(K, { l2: '售后管理', l3: '预收款' }, filter, toolbar, npTH(cols), 'ysk-rec-tbody', 'ysk-rec-pager');

  var st = NP[K];
  st.query = function () {
    var owner = yskVal('ysk-f-owner');
    var names = yskStoreNames(yskVal('ysk-flt-store'));
    var method = yskVal('ysk-f-method');
    var ds = yskVal('ysk-flt-date-start');
    var de = yskVal('ysk-flt-date-end');
    st.filtered = st.allData.filter(function (r) {
      var d = (r.time || '').slice(0, 10);
      return (owner === '' || r.owner.indexOf(owner) >= 0) &&
        (names.length === 0 || names.indexOf(yskStoreShort(r.storeCode)) >= 0) &&
        (method === '' || r.method === method) &&
        (ds === '' || d >= ds) &&
        (de === '' || d <= de);
    });
    /* 倒序：最近登记的排最上 */
    st.filtered.sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
    st.page = 1; st.render();
  };
  st.reset = function () {
    ['ysk-f-owner', 'ysk-flt-store', 'ysk-f-method'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.value = '';
    });
    npDefaultDateRange('ysk-flt-date-start', 'ysk-flt-date-end');
    st.query();
  };
  st.render = function () { npRenderTable(K, 'ysk-rec-tbody', 'ysk-rec-pager', cols, st.filtered, st); };

  st.filtered = st.allData.slice();
  st.page = 1;
  st.render();
  /* 默认日期区间＝上月今天~今天（规范口径），否则进页面看不到数据；
     npDefaultDateRange 内部会同步日期范围文本框并经 data-callback 触发 yskApplyFilter */
  npDefaultDateRange('ysk-flt-date-start', 'ysk-flt-date-end');
  st.query();
  initFilterGrid(K + '-filterGrid', 7);
  npInitComboboxes();
}

/* 门店选择器确认后回调（msStoreConfirm 按 id 后缀 -flt-store 反推 mod + 'ApplyFilter'） */
function yskApplyFilter() { var st = NP['prepayment-record']; if (st && st.query) st.query(); }

/* 记录页导出：导出当前筛选结果 */
function yskExportRecords() {
  var st = NP['prepayment-record'];
  var data = (st && st.filtered) ? st.filtered : [];
  if (!data.length) { npToast('当前没有可导出的数据'); return; }
  var headers = ['序号', '车主姓名', '门店名称', '门店编码', '收款渠道', '收款方式', '金额', '收款登记人', '收款时间'];
  var rows = data.map(function (r, i) {
    return [i + 1, r.owner, yskStoreShort(r.storeCode), r.storeCode, r.channel, r.method, yskMoney(r.amount), r.registrar, r.time];
  });
  npExportExcelRowsRaw('预收款记录_' + npNowLocal().slice(0, 10).replace(/-/g, ''), headers, rows);
  npToast('导出成功');
}

/* ---------- Tab 2：预收款余额 ---------- */
function yskInitBalancePanel() {
  var K = 'prepayment-balance';
  var cols = [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    { t: '车主姓名', w: 100, cls: 'col-owner sticky', f: function (r) { return npEscape(r.owner); } },
    { t: '余额', w: 130, cls: 'col-balance', f: function (r) { return yskMoneyHtml(r.balance); } },
    { t: '门店名称', w: 150, cls: 'col-store-name', f: function (r) { return npEscape(yskStoreShort(r.storeCode)); } },
    { t: '门店编码', w: 90, cls: 'col-store-code', f: function (r) { return npEscape(r.storeCode); } },
    { t: '合计充值金额', w: 150, cls: 'col-total', f: function (r) { return yskMoneyHtml(r.recharge); } },
    {
      t: '操作', w: 110, cls: 'col-actions', f: function (r) {
        return npRenderActions(['<a href="javascript:void(0)" class="lt-btn-link" onclick="yskOpenDetail(\'' + npEscape(r.owner) + '\',\'' + npEscape(r.storeCode) + '\')">查看明细</a>']);
      }
    }
  ];

  var filter =
    npFItem('车主姓名', '<input type="text" id="ysk-bal-f-owner" placeholder="请输入">') +
    yskStoreFilterItem('ysk-bal-flt-store');

  /* 工具栏：导出当前筛选结果（2026-10-27 用户口径：预收款余额列表加导出） */
  var toolbar = '<button class="lt-btn lt-btn-default" onclick="yskExportBalance()">导出</button>';

  var root = document.getElementById('ysk-panel-balance');
  root.innerHTML = npShell(K, { l2: '售后管理', l3: '预收款' }, filter, toolbar, npTH(cols), 'ysk-bal-tbody', 'ysk-bal-pager');

  var st = NP[K];
  st.query = function () {
    var owner = yskVal('ysk-bal-f-owner');
    var names = yskStoreNames(yskVal('ysk-bal-flt-store'));
    st.filtered = yskLedger().filter(function (r) {
      return (owner === '' || r.owner.indexOf(owner) >= 0) &&
        (names.length === 0 || names.indexOf(yskStoreShort(r.storeCode)) >= 0);
    });
    /* 排序：预收款合计多的排前面，同额按车主姓名稳定排 */
    st.filtered.sort(function (a, b) {
      if (b.recharge !== a.recharge) return b.recharge - a.recharge;
      return (a.owner || '').localeCompare(b.owner || '');
    });
    st.page = 1; st.render();
  };
  st.reset = function () {
    ['ysk-bal-f-owner', 'ysk-bal-flt-store'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.value = '';
    });
    st.query();
  };
  st.render = function () { npRenderTable(K, 'ysk-bal-tbody', 'ysk-bal-pager', cols, st.filtered, st); };

  st.query();
  initFilterGrid(K + '-filterGrid', 7);
  npInitComboboxes();
}

/* 余额页门店选择器确认回调 */
function yskBalApplyFilter() { var st = NP['prepayment-balance']; if (st && st.query) st.query(); }
/* 余额页门店选择器的 id 后缀是 -flt-store，msStoreConfirm 反推出的 mod 是「ysk-bal」*/
window['ysk-balApplyFilter'] = yskBalApplyFilter;

/* 余额页导出：导出当前筛选结果（列头与列表一致，不含操作列），走全站公共导出组件 */
function yskExportBalance() {
  var st = NP['prepayment-balance'];
  var data = (st && st.filtered) ? st.filtered : [];
  if (!data.length) { npToast('当前没有可导出的数据'); return; }
  var headers = ['序号', '车主姓名', '余额', '门店名称', '门店编码', '合计充值金额'];
  var rows = data.map(function (r, i) {
    return [i + 1, r.owner, yskMoney(r.balance), yskStoreShort(r.storeCode), r.storeCode, yskMoney(r.recharge)];
  });
  npExportExcelRowsRaw('预收款余额_' + npNowLocal().slice(0, 10).replace(/-/g, ''), headers, rows);
  npToast('导出成功');
}

/* ============================================================
   五、新增预收款（侧滑面板 pm-panel）
   ============================================================ */
function yskEnsureAddPanel() {
  if (document.getElementById('ysk-add-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML =
    '<div class="pm-panel-overlay" id="ysk-add-overlay" onclick="yskCloseAdd()"></div>' +
    '<div class="pm-panel" id="ysk-add-panel" style="width:640px">' +
      '<div class="pm-panel-header">' +
        '<div style="display:flex;align-items:center">' +
          '<span class="pm-panel-title" id="ysk-add-title">新增预收款</span>' +
          '<span class="pm-panel-badge" id="ysk-add-badge">新增</span>' +
        '</div>' +
        '<button class="pm-panel-close" onclick="yskCloseAdd()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body" id="ysk-add-body"></div>' +
      '<div class="pm-panel-footer" id="ysk-add-footer"></div>' +
    '</div>';
  while (d.firstChild) document.body.appendChild(d.firstChild);
}

function yskOpenAdd() {
  yskEnsureAddPanel();
  document.getElementById('ysk-add-body').innerHTML =
    '<div class="pm-form-grid" style="grid-template-columns:repeat(2, minmax(0,1fr));">' +
      '<div class="lt-input-wrap plain"><span class="lt-filter-prefix">门店</span>' +
        '<input type="text" id="ysk-add-store" readonly value="' + npEscape(yskStoreLabel(YSK_CUR_STORE_CODE)) + '">' +
      '</div>' +
      '<div class="lt-input-wrap required pick" onclick="npOpenOwnerPicker(\'ysk-add-owner\', yskOnOwnerPicked)">' +
        '<span class="lt-filter-prefix">车主</span>' +
        '<input type="text" id="ysk-add-owner" readonly placeholder="请从车主管理中选择">' +
        '<svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg>' +
      '</div>' +
      '<div class="lt-input-wrap plain"><span class="lt-filter-prefix">收款渠道</span>' +
        '<input type="text" id="ysk-add-channel" readonly value="' + npEscape(YSK_CHANNEL) + '">' +
      '</div>' +
      '<div class="lt-input-wrap"><span class="lt-filter-prefix">收款方式</span>' +
        '<select id="ysk-add-method"><option value="">请选择</option>' +
          YSK_METHODS.map(function (m) { return '<option>' + npEscape(m) + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<div class="lt-input-wrap plain required"><span class="lt-filter-prefix">收款金额</span>' +
        '<input type="text" id="ysk-add-amount" placeholder="请输入" oninput="yskOnAmountInput(this)">' +
      '</div>' +
    '</div>' +
    /* 单独一行红色提示：钱到账才登记 */
    '<div style="color:#861B2F;font-size:13px;line-height:1.8;margin-top:2px">请确保钱已到账再登记收款。</div>' +
    '<input type="hidden" id="ysk-add-owner-code" value="">';

  document.getElementById('ysk-add-footer').innerHTML =
    '<button class="lt-btn lt-btn-default" onclick="yskCloseAdd()">取消</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="yskSubmitAdd()">提交</button>';

  document.getElementById('ysk-add-overlay').classList.add('show');
  document.getElementById('ysk-add-panel').classList.add('show');
}

function yskCloseAdd() {
  var ov = document.getElementById('ysk-add-overlay');
  var pn = document.getElementById('ysk-add-panel');
  if (ov) ov.classList.remove('show');
  if (pn) pn.classList.remove('show');
}

/* 金额只允许数字和小数点（文本框口径，不做千分位） */
function yskOnAmountInput(el) {
  var v = String(el.value || '').replace(/[^\d.]/g, '');
  var parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  el.value = v;
}

/* ---------- 车主选择器（统一件）：确认后回填「姓名(编号)」，并把车主编号写入隐藏域 ---------- */
function yskOnOwnerPicked(o) {
  var code = document.getElementById('ysk-add-owner-code');
  if (code) code.value = o ? o.code : '';
}

/* ---------- 提交：落库为一条预收款记录，登记人＝提交人、收款时间＝提交时间 ---------- */
function yskSubmitAdd() {
  var ownerRaw = yskVal('ysk-add-owner');
  var method = yskVal('ysk-add-method');
  var amount = yskVal('ysk-add-amount');
  if (ownerRaw === '') { npToast('请选择车主'); return; }
  if (method === '') { npToast('请选择收款方式'); return; }
  if (amount === '' || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { npToast('请填写正确的收款金额'); return; }

  /* 车主姓名：输入框存的是「姓名(编号)」，取姓名部分 */
  var ownerName = ownerRaw.replace(/\(.*\)$/, '').trim();
  var st = NP['prepayment-record'];
  var rec = {
    idx: npNextIdx(st.allData),
    owner: ownerName,
    ownerCode: yskVal('ysk-add-owner-code') || (yskOwner(ownerName) || {}).code || '—',
    storeCode: YSK_CUR_STORE_CODE,
    channel: YSK_CHANNEL,
    method: method,
    amount: yskMoney(amount),
    /* 收款登记人＝本门店的门店财务经理（真实姓名，从人员主数据现取；不是登录身份档位） */
    registrar: yskRegistrar(YSK_CUR_STORE_CODE),
    /* 收款时间默认＝提交时间 */
    time: npNowLocal()
  };
  st.allData.push(rec);

  yskCloseAdd();
  /* 两个 Table 页一起刷新：记录页出现新行，余额页余额随之变化 */
  if (typeof st.query === 'function') st.query();
  else if (typeof st.render === 'function') st.render();
  var stb = NP['prepayment-balance'];
  if (stb && typeof stb.query === 'function') stb.query();
  npToast('预收款登记成功');
}

/* ============================================================
   六、查看明细（侧滑面板：该车主在该门店的全部充值/使用流水，按时间倒序）
   列表 8 列固定顺序：序号 / 车主姓名 / 门店 / 充值(使用) / 业务 / 业务单据号 / 金额 / 时间
   ——「业务单据号」夹在「业务」与「金额」之间（2026-10-27 用户口径，规范 §4.9.5）。
   ============================================================ */
var YSK_DETAIL_KEY = { owner: '', storeCode: '' };

/* 明细列定义（唯一真源：表头交 npTH、行交 npRenderTable，加列不会再错位） */
function yskDetailCols() {
  return [
    { t: '序号', w: 60, f: function (r, i) { return i + 1; } },
    { t: '车主姓名', w: 100, f: function () { return npEscape(YSK_DETAIL_KEY.owner); } },
    { t: '门店', w: 140, f: function () { return npEscape(yskStoreShort(YSK_DETAIL_KEY.storeCode)); } },
    { t: '充值/使用', w: 100, f: function (r) { return npEscape(r.type); } },
    { t: '业务', w: 130, f: function (r) { return npEscape(r.biz); } },
    { t: '业务单据号', w: 170, cls: 'col-bill-no', f: function (r) { return npEscape(r.docNo || '—'); } },
    {
      t: '金额', w: 120, f: function (r) {
        return '<span class="np-money">' + (r.type === '使用' ? '-' : '') + '¥' + yskMoney(r.amount) + '</span>';
      }
    },
    { t: '时间', w: 170, f: function (r) { return npEscape(r.time); } }
  ];
}

/* 明细面板骨架（HTML 独立成函数：面板结构与查询区/工具栏只此一份，自检也能断言真实产物） */
function yskDetailPanelHtml() {
  return '<div class="pm-panel-overlay" id="ysk-detail-overlay" onclick="yskCloseDetail()"></div>' +
    /* 面板宽度 1060：8 列声明宽度合计 990 + 面板左右内边距 48 = 1038，留 22 余量，
       否则新增「业务单据号」这一列后 22 位单号会被横向滚动切掉（2026-10-27） */
    '<div class="pm-panel" id="ysk-detail-panel" style="width:1060px">' +
      '<div class="pm-panel-header">' +
        '<div style="display:flex;align-items:center">' +
          '<span class="pm-panel-title" id="ysk-detail-title">预收款明细</span>' +
          '<span class="pm-panel-badge" id="ysk-detail-badge">明细</span>' +
        '</div>' +
        '<button class="pm-panel-close" onclick="yskCloseDetail()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body" id="ysk-detail-body">' +
        /* 查询项：充值/使用（默认全部）、业务、业务单据号（文本模糊）；查询区走全站 .lt-filter-grid（4 列）
           + 按钮固定第 4 列 → 3 项正好与按钮共占一行，未超一屏 7 项，不出「﹀展开」 */
        '<div class="lt-filter-grid" id="ysk-detail-filterGrid">' +
          npSelect('充值/使用', '<select id="ysk-det-f-type" onchange="yskRenderDetail()"><option value="">请选择</option>' +
            YSK_TYPES.map(function (t) { return '<option>' + npEscape(t) + '</option>'; }).join('') + '</select>') +
          npSelect('业务', '<select id="ysk-det-f-biz" onchange="yskRenderDetail()"><option value="">请选择</option>' +
            YSK_BIZ.map(function (b) { return '<option>' + npEscape(b) + '</option>'; }).join('') + '</select>') +
          npFItem('业务单据号', '<input type="text" id="ysk-det-f-docno" placeholder="请输入">') +
          '<div class="lt-filter-footer">' +
            '<button class="lt-btn lt-btn-primary" onclick="yskRenderDetail()">查询</button>' +
            '<button class="lt-btn lt-btn-default" onclick="yskResetDetail()">重置</button>' +
          '</div>' +
        '</div>' +
        /* 工具栏：导出当前明细筛选结果（2026-10-27 用户口径：明细列表加导出） */
        '<div class="lt-toolbar"><div class="lt-toolbar-left">' +
          '<button class="lt-btn lt-btn-default" onclick="yskExportDetail()">导出</button>' +
        '</div></div>' +
        '<div class="lt-table-wrap" id="ysk-detail-tableWrap"></div>' +
      '</div>' +
    '</div>';
}

function yskEnsureDetailPanel() {
  if (document.getElementById('ysk-detail-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML = yskDetailPanelHtml();
  while (d.firstChild) document.body.appendChild(d.firstChild);
}

function yskOpenDetail(owner, storeCode) {
  yskEnsureDetailPanel();
  YSK_DETAIL_KEY = { owner: owner, storeCode: storeCode };
  document.getElementById('ysk-detail-title').textContent = '预收款明细 · ' + owner + '（' + yskStoreShort(storeCode) + '）';
  var ty = document.getElementById('ysk-det-f-type'); if (ty) ty.value = '';
  var bz = document.getElementById('ysk-det-f-biz'); if (bz) bz.value = '';
  var dn = document.getElementById('ysk-det-f-docno'); if (dn) dn.value = '';
  yskRenderDetail();
  document.getElementById('ysk-detail-overlay').classList.add('show');
  document.getElementById('ysk-detail-panel').classList.add('show');
}

function yskCloseDetail() {
  var ov = document.getElementById('ysk-detail-overlay');
  var pn = document.getElementById('ysk-detail-panel');
  if (ov) ov.classList.remove('show');
  if (pn) pn.classList.remove('show');
}

function yskResetDetail() {
  var ty = document.getElementById('ysk-det-f-type'); if (ty) ty.value = '';
  var bz = document.getElementById('ysk-det-f-biz'); if (bz) bz.value = '';
  var dn = document.getElementById('ysk-det-f-docno'); if (dn) dn.value = '';
  yskRenderDetail();
}

function yskRenderDetail() {
  var wrap = document.getElementById('ysk-detail-tableWrap');
  if (!wrap) return;
  var it = yskLedgerOf(YSK_DETAIL_KEY.owner, YSK_DETAIL_KEY.storeCode);
  var rows = it ? it.rows.slice() : [];
  var type = yskVal('ysk-det-f-type');
  var biz = yskVal('ysk-det-f-biz');
  var docNo = yskVal('ysk-det-f-docno');
  rows = yskFilterRows(rows, type, biz, docNo);

  /* 列定义只有一份（yskDetailCols）：表头与单元格同源，加列不会再出现 th/td 错位。
     表格骨架自己搭（抽屉里没有 npShell），行与空态交给公共 npRenderTable。 */
  var cols = yskDetailCols();
  wrap.innerHTML = '<table class="lt-table"><thead><tr>' + npTH(cols) + '</tr></thead>' +
    '<tbody id="ysk-det-tbody"></tbody></table>';
  var st = NP['prepayment-detail'];
  st.filtered = rows;
  st.render = function () { npRenderTable('prepayment-detail', 'ysk-det-tbody', '', cols, st.filtered, st); };
  st.render();
}

/* 明细导出：导出当前明细筛选结果（列头与列表 8 列一致），走全站公共导出组件。
   筛选条件与页面共用同一份 yskFilterRows（含业务单据号），保证「看到的」＝「导出的」。 */
function yskExportDetail() {
  var it = yskLedgerOf(YSK_DETAIL_KEY.owner, YSK_DETAIL_KEY.storeCode);
  var rows = yskFilterRows(it ? it.rows.slice() : [],
    yskVal('ysk-det-f-type'), yskVal('ysk-det-f-biz'), yskVal('ysk-det-f-docno'));
  if (!rows.length) { npToast('当前没有可导出的数据'); return; }
  var headers = ['序号', '车主姓名', '门店', '充值/使用', '业务', '业务单据号', '金额', '时间'];
  var data = rows.map(function (x, i) {
    return [
      i + 1,
      YSK_DETAIL_KEY.owner,
      yskStoreShort(YSK_DETAIL_KEY.storeCode),
      x.type,
      x.biz,
      x.docNo || '—',
      (x.type === '使用' ? '-' : '') + yskMoney(x.amount),
      x.time
    ];
  });
  var fname = '预收款明细_' + YSK_DETAIL_KEY.owner + '_' + npNowLocal().slice(0, 10).replace(/-/g, '');
  npExportExcelRowsRaw(fname, headers, data);
  npToast('导出成功');
}

/* ---------- 注册切页初始化 ---------- */
npRegisterModuleInit('prepayment', function () { initPrepayment(); });
