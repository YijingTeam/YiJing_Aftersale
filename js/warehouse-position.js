// =====================================================================
// 仓库仓位管理（售后管理 → 配件库存管理 → 仓库仓位管理）
// 需求：《奕境售后管理系统需求文档》5.7.1 仓库仓位维护
//   总部配件人员：查询门店的仓库仓位；门店配件人员：创建、查询仓库仓位
//   【仓库名称】查看仓库仓位 / 【新增·编辑】维护仓位 / 【导入】导入仓库仓位
// 结构：npShell 外壳页（照页范本 js/fault-location.js），查询区/工具栏/表格/分页全由外壳生成。
// 数据：window.WH_POSITIONS —— 仓库仓位主数据（1 条仓库记录 = 1 行列表；仓位挂在其 positions 上）
//   门店字段（名称/编码/大区/小区）一律从「门店管理」主数据取，不手写（原型规范 §4.8）。
// =====================================================================

window.WH_TYPES = ['存储仓', '签收仓', '旧件仓'];      // PRD：仓库类型默认「存储仓」，未来拓展签收仓/旧件仓
window.WH_ENABLED = ['是', '否'];                       // PRD：是否启用默认「是」

/* 种子：6 家标准门店（§4.8）× 每店仓库；仓位编码形如 A1-01-01 */
window.WH_POSITIONS = [];

(function buildSeed() {
  var stores = (typeof NP !== 'undefined' && NP['store-manage'] && NP['store-manage'].allData) || [];
  function pick(code) {
    for (var i = 0; i < stores.length; i++) if (stores[i].code === code) return stores[i];
    return null;
  }
  var plan = [
    { code: 'BJ001', whs: [
      { whCode: 'GR-01', whName: '配件存储仓', whType: '存储仓', enabled: '是', remark: '', positions: [
        { code: 'A1-01-01', hasStock: true, remark: '' },
        { code: 'A1-01-02', hasStock: false, remark: '' },
        { code: 'A1-01-03', hasStock: false, remark: '高价件专架' }
      ] },
      { whCode: 'QR-01', whName: '签收仓', whType: '签收仓', enabled: '是', remark: '到货待检区', positions: [
        { code: 'A2-01-01', hasStock: false, remark: '' },
        { code: 'A2-01-02', hasStock: false, remark: '' }
      ] }
    ] },
    { code: 'SH001', whs: [
      { whCode: 'GR-01', whName: '配件存储仓', whType: '存储仓', enabled: '是', remark: '', positions: [
        { code: 'B1-01-01', hasStock: true, remark: '' },
        { code: 'B1-01-02', hasStock: true, remark: '' },
        { code: 'B1-01-03', hasStock: false, remark: '' },
        { code: 'B1-02-01', hasStock: false, remark: '大件区' }
      ] },
      { whCode: 'QR-01', whName: '签收仓', whType: '签收仓', enabled: '是', remark: '', positions: [
        { code: 'B2-01-01', hasStock: false, remark: '' }
      ] }
    ] },
    { code: 'GZ001', whs: [
      { whCode: 'GR-01', whName: '配件存储仓', whType: '存储仓', enabled: '是', remark: '', positions: [
        { code: 'C1-01-01', hasStock: true, remark: '' },
        { code: 'C1-01-02', hasStock: false, remark: '' }
      ] },
      { whCode: 'JJ-01', whName: '旧件仓', whType: '旧件仓', enabled: '否', remark: '停用整改中', positions: [
        { code: 'C2-01-01', hasStock: false, remark: '' }
      ] }
    ] },
    { code: 'WH001', whs: [
      { whCode: 'GR-01', whName: '配件存储仓', whType: '存储仓', enabled: '是', remark: '', positions: [
        { code: 'D1-01-01', hasStock: true, remark: '' },
        { code: 'D1-01-02', hasStock: true, remark: '' },
        { code: 'D1-01-03', hasStock: false, remark: '' }
      ] },
      { whCode: 'QR-01', whName: '签收仓', whType: '签收仓', enabled: '是', remark: '', positions: [
        { code: 'D2-01-01', hasStock: false, remark: '' }
      ] }
    ] },
    { code: 'SZ001', whs: [
      { whCode: 'GR-01', whName: '配件存储仓', whType: '存储仓', enabled: '是', remark: '', positions: [
        { code: 'E1-01-01', hasStock: false, remark: '' },
        { code: 'E1-01-02', hasStock: false, remark: '' }
      ] },
      { whCode: 'QR-01', whName: '签收仓', whType: '签收仓', enabled: '是', remark: '', positions: [
        { code: 'E2-01-01', hasStock: false, remark: '' }
      ] }
    ] },
    { code: 'HZ001', whs: [
      { whCode: 'GR-01', whName: '配件存储仓', whType: '存储仓', enabled: '是', remark: '', positions: [
        { code: 'F1-01-01', hasStock: true, remark: '' },
        { code: 'F1-01-02', hasStock: false, remark: '' },
        { code: 'F1-01-03', hasStock: false, remark: '' }
      ] }
    ] }
  ];
  var out = [];
  plan.forEach(function (p, si) {
    var s = pick(p.code);
    if (!s) return;   // 门店主数据里没有就跳过，绝不硬编码门店名
    p.whs.forEach(function (w, wi) {
      out.push({
        id: 'WH' + String(si + 1).padStart(2, '0') + String(wi + 1).padStart(2, '0'),
        storeCode: s.code, storeName: s.shortName || s.name,
        region: s.region, district: s.district,
        whCode: w.whCode, whName: w.whName, whType: w.whType,
        enabled: w.enabled, remark: w.remark,
        positions: w.positions.map(function (x) { return { code: x.code, hasStock: !!x.hasStock, remark: x.remark || '' }; })
      });
    });
  });
  window.WH_POSITIONS = out;
})();

window.wpmHasStock = function (r) { return r.positions.some(function (p) { return p.hasStock; }); };
window.wpmPosCount = function (r) { return r.positions.length; };

(function () {
  var K = 'warehouse-position';
  NP[K] = { page: 1, pageSize: 10, allData: [], filtered: [], query: null, reset: null, render: null };
  var st = NP[K];
  var editingId = null;   // null=新增；否则=仓库记录 id
  var draft = null;       // 弹窗内正在编辑的仓库（含 positions）

  function list() { return window.WH_POSITIONS || []; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function setv(id, s) { var e = document.getElementById(id); if (e) e.value = s; }
  function pad2(n) { return String(n).padStart(2, '0'); }

  function cols() {
    return [
      /* 列 1~3 冻结固定左（2026-10-25 用户拍板）：序号 0 → 仓库编码 40 → 仓库名称 150 */
      { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
      { t: '仓库编码', w: 110, cls: 'col-warehouse-code sticky', f: function (r) { return npEscape(r.whCode); } },
      {
        t: '仓库名称', w: 120, cls: 'col-warehouse-name sticky', f: function (r) {
          return '<a href="javascript:void(0)" class="lt-link" onclick="wpmView(\'' + r.id + '\')">' + npEscape(r.whName) + '</a>';
        }
      },
      { t: '门店名称', w: 120, cls: 'col-store-name', f: function (r) { return npEscape(r.storeName); } },
      { t: '门店编码', w: 80, cls: 'col-store-code', f: function (r) { return npEscape(r.storeCode); } },
      { t: '仓库类型', w: 100, cls: 'col-warehouse-type', f: function (r) { return npEscape(r.whType); } },
      {
        t: '是否启用', w: 80, cls: 'col-enabled', f: function (r) {
          return r.enabled === '是'
            ? '<span class="lt-badge ok">是</span>'
            : '<span class="lt-badge off">否</span>';
        }
      },
      {
        t: '是否有库存', w: 100, cls: 'col-has-stock', f: function (r) {
          return window.wpmHasStock(r) ? '<span class="lt-badge warn">是</span>' : '<span class="lt-badge off">否</span>';
        }
      },
      { t: '仓位数量', w: 90, cls: 'col-position-count', f: function (r) { return window.wpmPosCount(r); } },
      { t: '备注', w: 120, cls: 'col-remark', f: function (r) { return npEscape(r.remark); } },
      /* 操作列必须在最后一列：.col-actions 是 sticky right:0（规范 §4.2.1） */
      {
        t: '操作', w: 90, cls: 'col-actions', f: function (r) {
          return npRenderActions([
            '<a href="javascript:void(0)" class="lt-btn-link" onclick="wpmEdit(\'' + r.id + '\')">编辑</a>'
          ]);
        }
      }
    ];
  }

  function dictCombo(label, id, key) {
    /* 容器带 data-k（全站 combobox 通用约定，× 清空后回源 NP[data-k].query() 重查）
       + data-apply（规范 §Combobox 第 6 款）。两者都有时 data-apply 优先。 */
    return '<div class="lt-filter-item"><div class="lt-input-wrap combobox" style="position:relative" data-k="' + K + '" data-dict="' + key + '" data-dict-cb="gtComboboxSelect" data-apply="wpmApplyFilter">' +
      '<span class="lt-filter-prefix">' + label + '</span>' +
      '<input type="text" id="' + id + '" placeholder="请选择" onfocus="gtComboboxShow(this)" oninput="gtComboboxFilter(this)">' +
      '<span class="cb-arrow" onclick="gtComboboxToggle(this)">▼</span>' +
      '<ul class="lt-datalist"></ul></div></div>';
  }

  function filterHtml() {
    return dictCombo('大区', 'wpm-flt-region', 'region') +
      dictCombo('小区', 'wpm-flt-district', 'district') +
      '<div class="lt-filter-item"><div class="lt-input-wrap search store-pick"><span class="lt-filter-prefix">门店</span>' +
        '<input type="text" id="wpm-flt-store" placeholder="请选择" readonly onclick="msOpenStorePicker(\'wpm-flt-store\')">' +
        '<svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg>' +
      '</div></div>' +
      npFItem('仓库编码', '<input type="text" id="wpm-flt-whcode" placeholder="请输入">') +
      npFItem('仓库名称', '<input type="text" id="wpm-flt-whname" placeholder="请输入">') +
      npSelect('是否启用', '<select id="wpm-flt-enabled"><option value="">请选择</option><option value="是">是</option><option value="否">否</option></select>');
  }

  function toolbarHtml() {
    return '<button class="lt-btn lt-btn-primary" onclick="wpmAdd()">新增仓库仓位</button>' +
      '<button class="lt-btn lt-btn-default" onclick="wpmImport()">导入</button>' +
      '<button class="lt-btn lt-btn-default" onclick="wpmExport()">导出</button>';
  }

  /* ---------------- 弹窗：新增 / 编辑 ---------------- */
  function posRowsHtml() {
    var h = '';
    if (!draft.positions.length) {
      h = '<tr><td colspan="6" style="text-align:center;color:#999">暂无仓位，点「新增仓位」添加</td></tr>';
    } else {
      draft.positions.forEach(function (p, i) {
        var locked = !!p.hasStock;   // PRD：只有无配件的仓位才能删除，有配件的「删除」置灰
        h += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><input type="text" id="wpm-pos-code-' + i + '" value="' + npEscape(p.code) + '"' + (p._isNew ? '' : ' readonly') + '></td>' +
          '<td>' + (p.hasStock ? '<span class="lt-badge warn">是</span>' : '<span class="lt-badge off">否</span>') + '</td>' +
          '<td><input type="text" id="wpm-pos-remark-' + i + '" value="' + npEscape(p.remark) + '"></td>' +
          '<td>' + (locked
            ? '<a href="javascript:void(0)" class="lt-link wpm-disabled" title="有配件的仓位不能删除">删除</a>'
            : '<a href="javascript:void(0)" class="lt-link np-red" onclick="wpmPosDel(' + i + ')">删除</a>') + '</td>' +
          '</tr>';
      });
    }
    return '<table class="lt-table wpm-pos-table"><thead><tr>' +
      '<th style="width:50px">序号</th><th style="width:150px">仓位编码</th><th style="width:100px">是否有库存</th>' +
      '<th>备注</th><th style="width:80px">操作</th></tr></thead><tbody>' + h + '</tbody></table>';
  }

  function modalBodyHtml() {
    var isEdit = !!editingId;
    return '<div class="pm-form-grid">' +
      npFormItem('仓库编码', '<input type="text" id="wpm-f-whcode" value="' + npEscape(draft.whCode) + '"' + (isEdit ? ' readonly' : '') + ' placeholder="字母、数字、-">', true) +
      npFormItem('仓库名称', '<input type="text" id="wpm-f-whname" value="' + npEscape(draft.whName) + '" placeholder="请输入">', true) +
      npFormSelect('仓库类型', '<select id="wpm-f-whType">' + window.WH_TYPES.map(function (t) {
        return '<option value="' + t + '"' + (draft.whType === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('') + '</select>', true) +
      npFormSelect('是否启用', '<select id="wpm-f-enabled">' + window.WH_ENABLED.map(function (t) {
        return '<option value="' + t + '"' + (draft.enabled === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('') + '</select>', true) +
      npFormItem('备注', '<input type="text" id="wpm-f-remark" value="' + npEscape(draft.remark) + '" placeholder="请输入">') +
      '</div>' +
      '<div class="wpm-pos-head"><span>仓位明细（仓位编码必填）</span><button class="lt-btn lt-btn-default" onclick="wpmPosAdd()">新增仓位</button></div>' +
      '<div id="wpm-pos-wrap">' + posRowsHtml() + '</div>';
  }

  function openEditor() {
    npOpenModal(editingId ? '编辑仓库仓位' : '新增仓库仓位', modalBodyHtml(),
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="wpmSave()">保存</button>', { width: 860 });
  }

  function syncDraftFromForm() {
    draft.whCode = val('wpm-f-whcode').trim();
    draft.whName = val('wpm-f-whname').trim();
    draft.whType = val('wpm-f-whType') || '存储仓';
    draft.enabled = val('wpm-f-enabled') || '是';
    draft.remark = val('wpm-f-remark').trim();
    draft.positions.forEach(function (p, i) {
      var c = document.getElementById('wpm-pos-code-' + i);
      var rm = document.getElementById('wpm-pos-remark-' + i);
      if (c) p.code = c.value.trim();
      if (rm) p.remark = rm.value.trim();
    });
  }

  window.wpmPosAdd = function () {
    syncDraftFromForm();
    draft.positions.push({ code: '', hasStock: false, remark: '', _isNew: true });
    document.getElementById('wpm-pos-wrap').innerHTML = posRowsHtml();
    var i = draft.positions.length - 1;
    var el = document.getElementById('wpm-pos-code-' + i);
    if (el) el.focus();
  };
  window.wpmPosDel = function (i) {
    syncDraftFromForm();
    var p = draft.positions[i];
    if (!p) return;
    if (p.hasStock) { npToast('有配件的仓位无法删除'); return; }   // PRD 第 5 条
    draft.positions.splice(i, 1);
    document.getElementById('wpm-pos-wrap').innerHTML = posRowsHtml();
  };

  window.wpmAdd = function () {
    if (!list().length && typeof NP !== 'undefined' && !(NP['store-manage'] && NP['store-manage'].allData.length)) {
      npToast('门店主数据未加载');
      return;
    }
    editingId = null;
    var s = (NP['store-manage'] && NP['store-manage'].allData[0]) || null;
    draft = {
      id: '', storeCode: s ? s.code : '', storeName: s ? (s.shortName || s.name) : '',
      region: s ? s.region : '', district: s ? s.district : '',
      whCode: '', whName: '', whType: '存储仓', enabled: '是', remark: '', positions: []
    };
    openEditor();
  };

  window.wpmEdit = function (id) {
    var r = list().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    editingId = id;
    draft = {
      id: r.id, storeCode: r.storeCode, storeName: r.storeName, region: r.region, district: r.district,
      whCode: r.whCode, whName: r.whName, whType: r.whType, enabled: r.enabled, remark: r.remark,
      positions: r.positions.map(function (p) { return { code: p.code, hasStock: !!p.hasStock, remark: p.remark || '' }; })
    };
    openEditor();
  };

  window.wpmSave = function () {
    syncDraftFromForm();
    // PRD 第 1 条：仓库编码支持字母、数字、-
    if (!draft.whCode) { npToast('仓库编码必填'); return; }
    if (!/^[A-Za-z0-9-]+$/.test(draft.whCode)) { npToast('仓库编码只支持字母、数字、-'); return; }
    if (!draft.whName) { npToast('仓库名称必填'); return; }
    // 仓位编码必填 + 同仓库内唯一
    var seen = {};
    for (var i = 0; i < draft.positions.length; i++) {
      var c = draft.positions[i].code;
      if (!c) { npToast('仓位编码必填'); return; }
      if (!/^[A-Za-z0-9-]+$/.test(c)) { npToast('仓位编码只支持字母、数字、-'); return; }
      if (seen[c]) { npToast('仓位编码重复：' + c); return; }
      seen[c] = 1;
    }
    // 同门店内仓库编码唯一
    var dup = list().filter(function (x) {
      return x.storeCode === draft.storeCode && x.whCode === draft.whCode && x.id !== editingId;
    });
    if (dup.length) { npToast('该门店下仓库编码已存在'); return; }
    // PRD 第 7 条：有库存的仓库不能停用
    if (draft.enabled === '否' && draft.positions.some(function (p) { return p.hasStock; })) {
      npToast('有库存的仓库无法停用');
      return;
    }
    if (editingId) {
      var r = list().filter(function (x) { return x.id === editingId; })[0];
      if (r) {
        r.whName = draft.whName; r.whType = draft.whType; r.enabled = draft.enabled; r.remark = draft.remark;
        r.positions = draft.positions.map(function (p) { return { code: p.code, hasStock: !!p.hasStock, remark: p.remark || '' }; });
      }
    } else {
      var seq = list().length + 1;
      list().push({
        id: 'WHN' + pad2(seq) + Date.now().toString().slice(-4),
        storeCode: draft.storeCode, storeName: draft.storeName, region: draft.region, district: draft.district,
        whCode: draft.whCode, whName: draft.whName, whType: draft.whType, enabled: draft.enabled, remark: draft.remark,
        positions: draft.positions.map(function (p) { return { code: p.code, hasStock: !!p.hasStock, remark: p.remark || '' }; })
      });
    }
    npCloseModal();
    st.query();
    npToast('已保存');
  };

  /* ---------------- 查看（点仓库名称） ---------------- */
  window.wpmView = function (id) {
    var r = list().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var rows = r.positions.map(function (p, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + npEscape(p.code) + '</td>' +
        '<td>' + (p.hasStock ? '<span class="lt-badge warn">是</span>' : '<span class="lt-badge off">否</span>') + '</td>' +
        '<td>' + npEscape(p.remark || '—') + '</td></tr>';
    }).join('');
    var body = '<div class="pm-form-grid">' +
      npFItem('门店名称', '<input type="text" value="' + npEscape(r.storeName) + '" readonly>') +
      npFItem('仓库编码', '<input type="text" value="' + npEscape(r.whCode) + '" readonly>') +
      npFItem('仓库名称', '<input type="text" value="' + npEscape(r.whName) + '" readonly>') +
      npFItem('仓库类型', '<input type="text" value="' + npEscape(r.whType) + '" readonly>') +
      npFItem('是否启用', '<input type="text" value="' + npEscape(r.enabled) + '" readonly>') +
      npFItem('是否有库存', '<input type="text" value="' + (window.wpmHasStock(r) ? '是' : '否') + '" readonly>') +
      npFItem('备注', '<input type="text" value="' + npEscape(r.remark || '—') + '" readonly>') +
      '</div>' +
      '<div class="wpm-pos-head"><span>仓位明细（共 ' + r.positions.length + ' 个）</span></div>' +
      '<table class="lt-table wpm-pos-table"><thead><tr><th style="width:50px">序号</th><th style="width:150px">仓位编码</th>' +
      '<th style="width:100px">是否有库存</th><th>备注</th></tr></thead><tbody>' + rows + '</tbody></table>';
    npOpenModal('查看仓库仓位', body, '', { width: 860 });   // 无「关闭」按钮，右上 × 关闭（规范 D10）
  };

  /* ---------------- 导入 / 导出 ---------------- */
  window.wpmImport = function () {
    var body = '<div class="wpm-hint">模板列（必填）：仓库编码 ｜ 仓库名称 ｜ 仓位编码。仓库需已存在，导入只追加仓位。</div>' +
      '<table class="lt-table wpm-pos-table"><thead><tr><th>*仓库编码</th><th>*仓库名称</th><th>*仓位编码</th></tr></thead>' +
      '<tbody><tr><td>GR-01</td><td>配件存储仓</td><td>A1-01-04</td></tr></tbody></table>' +
      '<div style="margin-top:12px"><input type="file" id="wpm-import-file" accept=".xlsx,.xls"></div>';
    npOpenModal('导入仓库仓位', body,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="wpmImportConfirm()">开始导入</button>', { width: 620 });
  };
  window.wpmImportConfirm = function () {
    var fi = document.getElementById('wpm-import-file');
    var f = fi && fi.files && fi.files[0];
    if (!f) { npToast('请先选择文件'); return; }
    var X = window.XLSX;
    if (!X) { npToast('导入组件未加载，请刷新后重试'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = X.read(new Uint8Array(e.target.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = X.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length < 2) { npToast('文件无有效数据'); return; }
        var added = 0, skipped = 0;
        rows.slice(1).forEach(function (row) {
          if (!row || !row[0] || !row[2]) { skipped++; return; }
          var whCode = String(row[0]).trim(), posCode = String(row[2]).trim();
          var hit = list().filter(function (x) { return x.whCode === whCode && x.whName === String(row[1] || '').trim(); })[0]
            || list().filter(function (x) { return x.whCode === whCode; })[0];
          if (!hit) { skipped++; return; }
          if (hit.positions.some(function (p) { return p.code === posCode; })) { skipped++; return; }
          hit.positions.push({ code: posCode, hasStock: false, remark: '' });
          added++;
        });
        npCloseModal();
        st.query();
        npToast('导入完成：新增 ' + added + ' 个仓位' + (skipped ? '，跳过 ' + skipped + ' 行' : ''));
      } catch (err) {
        npToast('文件解析失败，请检查模板');
      }
    };
    reader.readAsArrayBuffer(f);
  };

  window.wpmExport = function () {
    var rows = st.filtered.map(function (r, i) {
      return [i + 1, r.whCode, r.whName, r.storeName, r.storeCode, r.whType, r.enabled,
        window.wpmHasStock(r) ? '是' : '否', window.wpmPosCount(r), r.remark];
    });
    npExportExcelRowsRaw('仓库仓位', ['序号', '仓库编码', '仓库名称', '门店名称', '门店编码', '仓库类型', '是否启用', '是否有库存', '仓位数量', '备注'], rows);
  };

  /* ---------------- 页面入口 ---------------- */
  window.initWarehousePosition = function () {
    var root = document.getElementById('page-warehouse-position');
    if (!root) return;
    root.innerHTML = npShell(K, { l2: '配件库存管理', l3: '仓库仓位管理' },
      filterHtml(), toolbarHtml(), npTH(cols()), 'wpm-tbody', 'wpm-pager');
    initFilterGrid(K + '-filterGrid', 7);
    st._fShow = 7; st._fExp = false;
    /* 动态页必须在 DOM 生成后自己补一次 npInitComboboxes()：
       showContent 里的那次注入跑在 npInitModule 之前（app.js L241 vs L243），本页 DOM 那时还不存在，
       不补这一次，大区/小区两个 combobox 就没有清除 ×（与 tech-notice.js、prepayment.js 同口径）。
       npInitComboboxes 内部会依次做：灌字典选项 → 注入 combobox × → 注入文本框/门店 ×。 */
    if (typeof npInitComboboxes === 'function') npInitComboboxes();

    st.query = function () {
      var rg = val('wpm-flt-region').trim();
      var dt = val('wpm-flt-district').trim();
      var store = val('wpm-flt-store').trim();   // 门店选择器回显「名称(编码)」
      var wc = val('wpm-flt-whcode').trim();
      var wn = val('wpm-flt-whname').trim();
      var en = val('wpm-flt-enabled');
      st.allData = list().slice();
      st.filtered = st.allData.filter(function (r) {
        return (rg === '' || r.region === rg) &&
          (dt === '' || r.district === dt) &&
          (store === '' || store.indexOf(r.storeCode) >= 0 || store.indexOf(r.storeName) >= 0) &&
          (wc === '' || r.whCode.indexOf(wc) >= 0) &&
          (wn === '' || r.whName.indexOf(wn) >= 0) &&
          (en === '' || r.enabled === en);
      });
      st.page = 1;
      st.render();
    };
    st.reset = function () {
      setv('wpm-flt-region', ''); setv('wpm-flt-district', ''); setv('wpm-flt-store', '');
      setv('wpm-flt-whcode', ''); setv('wpm-flt-whname', ''); setv('wpm-flt-enabled', '');
      if (typeof npDictFillComboboxes === 'function') npDictFillComboboxes();
      st.query();
    };
    st.render = function () {
      npRenderTable(K, 'wpm-tbody', 'wpm-pager', cols(), st.filtered, st);
    };
    st.query();
  };

  /* combobox 的 × 点击回调（容器 data-apply="wpmApplyFilter" 指到这里）：清空后按当前条件重查 */
  window.wpmApplyFilter = function () {
    if (NP[K] && typeof NP[K].query === 'function') NP[K].query();
  };

  npRegisterModuleInit('warehouse-position', function () { initWarehousePosition(); });
})();
