/* ============================================================================
   配件库存管理 · 配件报废单（2026-10-25 依 PRD 5.7.3 新建，排「配件库存管理」第 3 位）
   ----------------------------------------------------------------------------
   需求原文：PRD-配件0625.md 5.7.3（本地：李荣云/obsidianVault/10-奕境/配件；飞书同源）
     · 总部配件人员查询门店报废单；门店人员做配件报废申请、报废审核
     · 查询：报废单号 / 单据状态 / 发起部门(下拉带模糊搜索) / 申请日期区间(默认近 1 月) / 报废申请人
     · 列表：操作(撤回·编辑·审核·查看) / 报废单号 / 发起部门 / 合计品种 / 合计数量 /
             合计金额(含税) / 单据状态 / 申请原因 / 报废申请人 / 申请时间
     · 规则：待审核可修改、已审核不可改、单号保存时自动生成
     · 详情：单据节点 + 配件行显示「出库数量」+ 打印当前报废单
     · 新增/编辑：选发起部门 / 填申请原因 / 选需报废的配件 + 输入申请数量；
                报废申请人 = 提交人，不允许代申请；
                **申请数量只能 ≤ 不良品库存**（不良品库存取自库存管理该配件的不良品合计）；
                可打印当前报废单内容
     · 审核：非直营 = 门店业务、门店财务（2 级）；直营 = 门店业务、门店财务、总部财务（3 级）
   元素来源对照（诚实标注，勿误标为"按原型页面实现"）：
     · PRD 文字表格 + 文字规则（5.7.3 查询/列表/节点表/详情 3 条/新增 2 条/审核级次）→ 逐项落地
     · 站内范本：四态共壳 pm-panel、单据节点条(np-steps)、审批记录 7 列、
       审核结果单选 + 审批意见（np-audit-*）、底部「打印/关闭/驳回/通过」 —— 来源=站内范本
     · **PRD 原型页面 5.7.3_01.._05.png 未读到**（当前模型不支持图片输入：
       read_image 报 `does not declare image input`；飞书文档与 lark-cli 在本会话也不可执行）
       取得这 5 张页面的元素清单后，须逐项对齐并删除本段。
   设计依据：
     · 原型规范 §3.1.2 行内同框 / §3.1.3 单据四态面板 / §3.1.4 明细子表口径 /
       §4.2 列宽映射 / §4.2.1 操作列最后一列 / §4.9 单据字典
     · 配件池与不良品库存：app.js `window.NP_PARTS` / `window.NP_BAD_STOCK`（全站唯一来源）
   与 5.7.2 的两处 PRD 差异（已在汇报中说明）：
     ① PRD 5.7.3「查询」表把申请人写成「领用申请人」，而「列表」写「报废申请人」→
        按列表口径统一为「报废申请人」（查询表显然是 5.7.2 复制未改）。
     ② PRD 5.7.3「单据节点状态」表直接复用 5.7.2 的节点名（领用申请/财务审核/总经理审核/领用出库），
        与本节「审核」段（门店业务→门店财务[→总部财务]）矛盾 → 节点按审核段实现：
        报废申请 → 门店业务审核 → 门店财务审核 →〔直营加：总部财务审核〕→ 报废出库。
   ========================================================================== */
(function () {
  'use strict';

  var K = 'parts-scrap';

  /* ---------- 字典（与原型规范 §4.9 一一对应） ---------- */
  window.PSC_STATUS = ['未提交', '待审核', '审核中', '审核通过', '已驳回'];
  window.PSC_DEPTS = ['维修部', '保养部', '配件部', '美容部'];
  /* 审核级次：PRD「报废，非直营：门店业务、门店财务审核；直营：门店业务、门店财务、总部财务审核」 */
  window.PSC_STEPS = {
    '非直营': ['门店业务审核', '门店财务审核'],
    '直营': ['门店业务审核', '门店财务审核', '总部财务审核']
  };
  window.PSC_LAST_NODE = '报废出库';

  var PARTS = window.NP_PARTS;

  /* ---------- 基础取值 ---------- */
  function storeOf(code) {
    var all = (NP['store-manage'] && NP['store-manage'].allData) || [];
    for (var i = 0; i < all.length; i++) if (all[i].code === code) return all[i];
    return null;
  }
  function partOf(code) { return window.npPartOf(code); }
  function badStock(code) { return window.npBadStock(code); }
  function isDirect(r) { return (r.channelMode === '直营'); }
  function stepsOf(r) { return window.PSC_STEPS[isDirect(r) ? '直营' : '非直营']; }
  function nodesOf(r) { return ['报废申请'].concat(stepsOf(r), [window.PSC_LAST_NODE]); }

  /* ---------- 派生值 ---------- */
  function varietyOf(r) { return r.items.length; }
  function qtyOf(r) { var s = 0; r.items.forEach(function (it) { s += it.qty; }); return s; }
  function amtOf(r) {
    var s = 0;
    r.items.forEach(function (it) { s += it.qty * it.price; });
    return Math.round(s * 100) / 100;
  }
  function allPicked(r) {
    return r.items.length > 0 && r.items.every(function (it) { return (it.pickedQty || 0) >= it.qty; });
  }
  /* 节点状态：申请节点 → 各审核环节 → 报废出库；与 auditStep（已通过环节数）严格对应 */
  function nodeStates(r) {
    var steps = stepsOf(r);
    var st = [];
    if (r.status === '未提交' || r.status === '已驳回') {
      st.push('doing');
      steps.forEach(function () { st.push('todo'); });
      st.push('todo');
      return st;
    }
    st.push('done');                                   // 报废申请
    var passed = (typeof r.auditStep === 'number') ? r.auditStep : 0;
    for (var i = 0; i < steps.length; i++) {
      if (i < passed) st.push('done');
      else if (i === passed && r.status !== '审核通过') st.push('doing');
      else st.push(r.status === '审核通过' ? 'done' : 'todo');
    }
    if (r.status === '审核通过') st.push(allPicked(r) ? 'done' : 'doing');
    else st.push('todo');
    return st;
  }
  var NODE_TEXT = { done: '已完成', doing: '进行中', todo: '未开始' };
  /* 由 auditStep 推导单据状态（审核引擎唯一出口） */
  function statusByStep(r) {
    var steps = stepsOf(r);
    if (r.auditStep <= 0) return '待审核';
    if (r.auditStep >= steps.length) return '审核通过';
    return '审核中';
  }

  /* ---------- 种子 ---------- */
  function seedDocs() {
    function nextMin(t, min) {
      var d = new Date(t.replace(/-/g, '/'));
      d.setMinutes(d.getMinutes() + min);
      function p2(n) { return (n < 10 ? '0' : '') + n; }
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
        p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    }
    /* 审批记录：按 状态/已通过环节数 生成 {step, person, time, result, opinion, attach} */
    function logs(r) {
      if (r.status === '未提交') return [];
      var steps = stepsOf(r);
      var l = [{ step: '报废申请', person: r.applicant, time: r.applyTime, result: '提交', opinion: '—', attach: '—' }];
      var passed = (typeof r.auditStep === 'number') ? r.auditStep : 0;
      for (var i = 0; i < passed; i++) {
        l.push({
          step: steps[i], person: i === 0 ? '李四' : '王五', time: nextMin(r.applyTime, 90 * (i + 1)),
          result: '通过', opinion: '同意报废', attach: '—'
        });
      }
      if (r.status === '已驳回') {
        l.push({
          step: steps[0], person: '李四', time: nextMin(r.applyTime, 90),
          result: '驳回', opinion: '不良品数量与实物不符，请重新盘点后申请', attach: '—'
        });
      }
      return l;
    }
    function it(code, qty, pickedQty) {
      var p = partOf(code);
      return { code: p.code, name: p.name, unit: p.unit, price: p.price, qty: qty, pickedQty: pickedQty || 0 };
    }
    function mk(no, storeCode, dept, reason, applicant, time, status, auditStep, items) {
      var s = storeOf(storeCode) || {};
      var r = {
        id: no, docNo: no,
        storeCode: storeCode,
        storeName: s.shortName || s.name || storeCode,
        region: s.region || '', district: s.district || '',
        channelMode: s.channelMode || '非直营',
        dept: dept, reason: reason, applicant: applicant, applyTime: time,
        status: status, auditStep: auditStep, items: items, auditLog: []
      };
      r.auditLog = logs(r);
      return r;
    }
    return [
      /* 未提交 2 条（可编辑） */
      mk('BF2025100001', 'BJ001', '维修部', '拆卸损坏件报废', '张三', '2026-10-08 09:20:11', '未提交', 0,
        [it('P001', 2), it('P003', 1)]),
      mk('BF2025100002', 'SH001', '保养部', '保养拆下旧件报废', '李四', '2026-10-09 10:15:42', '未提交', 0,
        [it('P005', 2)]),
      /* 待审核 4 条（其中 2 条直营 → 走 3 级审核） */
      mk('BF2025100003', 'GZ001', '配件部', '入库破损件报废', '王五', '2026-10-10 14:05:08', '待审核', 0,
        [it('P002', 2), it('P006', 1)]),
      mk('BF2025100004', 'WH001', '维修部', '维修损坏件报废', '赵六', '2026-10-11 08:40:52', '待审核', 0,
        [it('P007', 3)]),
      mk('BF2025100005', 'HBZ01', '美容部', '美容施工损坏件报废', '钱七', '2026-10-12 16:12:31', '待审核', 0,
        [it('P006', 2)]),
      mk('BF2025100006', 'SCZ01', '配件部', '试驾车拆件报废', '孙八', '2026-10-13 11:04:19', '待审核', 0,
        [it('P001', 3), it('P004', 5)]),
      /* 审核中 3 条：非直营 1 条（财务在审）、直营 2 条（分别在第 2、第 3 环节） */
      mk('BF2025100007', 'HZ001', '维修部', '维修车间不良件报废', '周九', '2026-10-14 09:02:37', '审核中', 1,
        [it('P003', 4), it('P004', 6)]),
      mk('BF2025100008', 'HBZ01', '保养部', '保养旧件报废（直营）', '吴十', '2026-10-15 13:22:05', '审核中', 2,
        [it('P008', 1)]),
      mk('BF2025100009', 'SCZ01', '维修部', '事故车拆检件报废（直营）', '张三', '2026-10-16 10:31:47', '审核中', 1,
        [it('P002', 3)]),
      /* 审核通过 3 条：2 条已出库完成、1 条未出库 */
      mk('BF2025100010', 'BJ001', '保养部', '蓄电池老化报废', '李四', '2026-10-17 15:08:26', '审核通过', 2,
        [it('P008', 1, 1)]),
      mk('BF2025100011', 'SH001', '维修部', '滤清器污染报废', '王五', '2026-10-18 08:19:54', '审核通过', 2,
        [it('P003', 3, 3), it('P001', 1, 1)]),
      mk('BF2025100012', 'HBZ01', '配件部', '库存过期件报废（直营）', '赵六', '2026-10-19 17:02:13', '审核通过', 3,
        [it('P005', 2, 0)]),
      /* 已驳回 2 条 */
      mk('BF2025100013', 'SZ001', '配件部', '不良品报废', '孙八', '2026-10-20 09:31:44', '已驳回', 0,
        [it('P006', 2)]),
      mk('BF2025100014', 'HZ001', '保养部', '拆车件报废（直营）', '周九', '2026-10-21 14:50:12', '已驳回', 0,
        [it('P001', 1), it('P005', 1)])
    ];
  }
  window.PSC_DOCS = seedDocs();

  /* ---------- 工具 ---------- */
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function setv(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
  function st() { return NP[K]; }
  function findDoc(id) {
    var all = st().allData;
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function statusBadge(s) {
    var cls = s === '审核通过' ? 'ok' : (s === '已驳回' ? 'off' : 'warn');
    return '<span class="lt-badge ' + cls + '">' + npEscape(s) + '</span>';
  }
  function nowText() {
    var d = new Date();
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
      p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }
  function currentUser() { return window.gUserName || '当前登录人'; }

  /* ---------- 列定义（PRD 字段顺序 + 序号 + 门店两列；操作固定最后一列 §4.2.1） ---------- */
  function cols() {
    return [
      { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
      {
        t: '报废单号', w: 140, cls: 'col-doc-no sticky', f: function (r) {
          return '<a href="javascript:void(0)" class="lt-btn-link" onclick="pscView(\'' + r.id + '\')">' + npEscape(r.docNo) + '</a>';
        }
      },
      { t: '门店名称', w: 160, cls: 'col-store-name', f: function (r) { return npEscape(r.storeName); } },
      { t: '门店编码', w: 80, cls: 'col-store-code', f: function (r) { return npEscape(r.storeCode); } },
      { t: '发起部门', w: 100, cls: 'col-dept', f: function (r) { return npEscape(r.dept); } },
      { t: '合计品种', w: 80, cls: 'col-variety-count', f: function (r) { return varietyOf(r); } },
      { t: '合计数量', w: 80, cls: 'col-total-qty', f: function (r) { return qtyOf(r); } },
      { t: '合计金额(含税)', w: 110, cls: 'col-total-amount', f: function (r) { return amtOf(r).toFixed(2); } },
      { t: '单据状态', w: 90, cls: 'col-doc-status', f: function (r) { return statusBadge(r.status); } },
      { t: '申请原因', w: 120, cls: 'col-reason', f: function (r) { return npEscape(r.reason); } },
      { t: '报废申请人', w: 90, cls: 'col-applicant', f: function (r) { return npEscape(r.applicant); } },
      { t: '申请时间', w: 140, cls: 'col-apply-time', f: function (r) { return npEscape(r.applyTime); } },
      {
        t: '操作', w: 150, cls: 'col-actions', f: function (r) {
          var ops = [];
          if (r.status === '待审核') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="pscWithdraw(\'' + r.id + '\')">撤回</a>');
          }
          /* PRD：申请状态为"待审核"的门店可以修改，已审核单据不能修改 */
          if (r.status === '未提交' || r.status === '待审核' || r.status === '已驳回') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="pscEdit(\'' + r.id + '\')">编辑</a>');
          }
          if (r.status === '待审核' || r.status === '审核中') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="pscAudit(\'' + r.id + '\')">审核</a>');
          }
          ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="pscView(\'' + r.id + '\')">查看</a>');
          return npRenderActions(ops, 4);
        }
      }
    ];
  }

  /* ---------- 查询区（PRD 5 项） ---------- */
  var P = 'psc';
  function filterHtml() {
    return npFItem('报废单号', '<input type="text" id="' + P + '-f-no" placeholder="请输入">') +
      npSelect('单据状态', '<select id="' + P + '-f-status"><option value="">请选择</option>' +
        window.PSC_STATUS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
      /* PRD：发起部门 = 下拉带模糊搜索 → 全站唯一 combobox 组件 */
      npComboMarkup(K, P + '-f-dept', '发起部门', window.PSC_DEPTS) +
      '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">申请日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="NP[\'' + K + '\'].query()">' +
      '<div class="lt-date-range-drop">' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-s" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '<span>—</span>' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-e" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div></div></div>' +
      npFItem('报废申请人', '<input type="text" id="' + P + '-f-applicant" placeholder="请输入">');
  }
  function readRange() { return { s: val(P + '-d-s'), e: val(P + '-d-e') }; }
  function toolbarHtml() {
    return '<button class="lt-btn lt-btn-primary" onclick="pscAdd()">新增报废单</button>';
  }

  /* ==========================================================================
     四态侧滑面板（新增 / 编辑 / 查看 / 审核 同一壳，与 5.7.2 领用单同构）
     顺序：单据节点（最顶）→ 报废单信息（字段 + 配件明细 + 合计）→ 审批记录 → 审核区
     ========================================================================== */
  var panel = { mode: null, id: null, draft: null };

  function ensurePanel() {
    if (document.getElementById('psc-panel-overlay')) return;
    var d = document.createElement('div');
    d.innerHTML =
      '<div class="pm-panel-overlay" id="psc-panel-overlay" onclick="pscClosePanel()"></div>' +
      '<div class="pm-panel" id="psc-panel" style="width:1100px">' +
      '<div class="pm-panel-header">' +
      '<div style="display:flex;align-items:center">' +
      '<span class="pm-panel-title" id="psc-panel-title">配件报废单</span>' +
      '<span class="pm-panel-badge" id="psc-panel-badge">新增</span>' +
      '</div>' +
      '<button class="pm-panel-close" onclick="pscClosePanel()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body" id="psc-panel-body"></div>' +
      '<div class="pm-panel-footer np-split-footer" id="psc-panel-footer"></div>' +
      '</div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
  }

  window.pscClosePanel = function () {
    var ov = document.getElementById('psc-panel-overlay');
    var pn = document.getElementById('psc-panel');
    if (ov) ov.classList.remove('show');
    if (pn) pn.classList.remove('show');
  };

  function openPanel(mode, id) {
    ensurePanel();
    panel.mode = mode;
    panel.id = id || null;
    var badge = document.getElementById('psc-panel-badge');
    var title = document.getElementById('psc-panel-title');
    var rec = id ? findDoc(id) : null;
    if (mode === 'add') {
      var s0 = (NP['store-manage'] && NP['store-manage'].allData[0]) || null;
      panel.draft = {
        storeCode: s0 ? s0.code : '', storeName: s0 ? (s0.shortName || s0.name) : '',
        channelMode: s0 ? (s0.channelMode || '非直营') : '非直营',
        dept: '', reason: '', applicant: currentUser(), applyTime: nowText(),
        items: [], status: '未提交', auditStep: 0, auditLog: []
      };
      title.textContent = '配件报废单';
      badge.textContent = '新增';
    } else {
      panel.draft = JSON.parse(JSON.stringify(rec));
      panel.draft.items = (rec.items || []).map(function (x) { return { code: x.code, qty: x.qty, pickedQty: x.pickedQty || 0 }; });
      if (mode === 'edit') { title.textContent = '配件报废单'; badge.textContent = '编辑'; }
      else if (mode === 'audit') { title.textContent = '报废单审核 — ' + rec.docNo; badge.textContent = '审核'; }
      else { title.textContent = '报废单详情 — ' + rec.docNo; badge.textContent = '查看'; }
    }
    renderPanel();
    var ov = document.getElementById('psc-panel-overlay');
    var pn = document.getElementById('psc-panel');
    if (ov) ov.classList.add('show');
    if (pn) pn.classList.add('show');
  }

  function editable() { return panel.mode === 'add' || panel.mode === 'edit'; }
  function rec() { return panel.draft; }

  /* 只读字段（查看/审核用同一套行内同框，禁止上下结构） */
  function roItem(label, v) {
    return window.npFormItem(label, '<input type="text" readonly value="' + npEscape(v == null ? '' : v) + '">', false);
  }

  function renderPanel() {
    var body = document.getElementById('psc-panel-body');
    if (!body) return;
    var r = rec();
    if (!r) return;
    var mode = panel.mode;
    var isEdit = mode === 'edit';
    var deptOptions = window.PSC_DEPTS.map(function (d) {
      return '<option value="' + npEscape(d) + '"' + (r.dept === d ? ' selected' : '') + '>' + npEscape(d) + '</option>';
    }).join('');
    var basic;
    if (editable()) {
      basic = window.npFormItem('报废单号', '<input type="text" readonly value="' + (isEdit ? npEscape(r.docNo || panel.id) : '保存后自动生成') + '">', false) +
        window.npFormItem('门店', '<input type="text" id="psc-f-store" readonly placeholder="请选择" value="' +
          npEscape(r.storeName + '（' + r.storeCode + '）') + '"' +
          (isEdit ? ' disabled' : ' onclick="msOpenStorePicker(\'psc-f-store\')"') + '>', true) +
        window.npFormSelect('发起部门', '<select id="psc-f-dept"><option value="">请选择</option>' + deptOptions + '</select>', true) +
        /* PRD：报废申请人即为提交人，不允许代申请 → 只读带出 */
        window.npFormItem('报废申请人', '<input type="text" id="psc-f-applicant" readonly value="' + npEscape(r.applicant) + '">', false) +
        window.npFormItem('申请时间', '<input type="text" readonly value="' + npEscape(r.applyTime) + '">', false) +
        '<div class="lt-filter-item np-grid-full">' + window.npFormItem('申请原因', '<input type="text" id="psc-f-reason" placeholder="请输入申请原因" value="' +
          npEscape(r.reason) + '">', true) + '</div>';
    } else {
      basic = roItem('报废单号', r.docNo) + roItem('门店', r.storeName + '（' + r.storeCode + '）') +
        roItem('发起部门', r.dept) + roItem('报废申请人', r.applicant) + roItem('申请时间', r.applyTime) +
        roItem('单据状态', r.status) + roItem('申请原因', r.reason || '—');
    }

    /* ① 单据节点（最顶） */
    var ns = nodeStates(r);
    var nodes = nodesOf(r);
    var nodesHtml = '<div class="pm-section-title">单据节点</div><div class="np-steps">' +
      nodes.map(function (n, i) {
        var s = ns[i];
        return '<div class="np-step ' + s + '"><span class="np-step-dot"></span>' +
          '<span class="np-step-name">' + npEscape(n) + '</span>' +
          '<span class="np-step-state">' + NODE_TEXT[s] + '</span></div>';
      }).join('') + '</div>';

    /* ② 报废单信息（字段 + 配件明细 + 合计，一段不拆） */
    var showReadParts = !editable();
    var itemsHtml = (editable() ? '<div class="np-items-toolbar"><button class="lt-btn lt-btn-default" onclick="pscOpenPartPicker()">配件选择</button></div>' : '') +
      '<div style="overflow-x:auto"><table class="pp-parts-table np-items-table" id="psc-items-table"><thead><tr>' +
      '<th style="width:44px">序号</th><th style="width:110px">配件编码</th><th style="width:180px">配件名称</th>' +
      '<th style="width:90px">计量单位</th><th style="width:100px">不良品库存</th><th style="width:100px">申请数量</th>' +
      (showReadParts ? '<th style="width:90px">出库数量</th>' : '') +
      '<th style="width:100px">单价(含税)</th><th style="width:110px">金额(含税)</th>' +
      (editable() ? '<th style="width:70px">操作</th>' : '') +
      '</tr></thead><tbody id="psc-items-tbody"></tbody></table></div>' +
      '<div class="pp-panel-totals" id="psc-totals"></div>';

    /* ③ 审批记录（站内单据统一 7 列） */
    var logHtml = '<div class="pm-section-title">审批记录</div><div style="overflow-x:auto"><table class="pp-parts-table">' +
      '<thead><tr><th style="width:44px">序号</th><th style="width:130px">审核节点</th><th style="width:90px">审核人</th>' +
      '<th style="width:150px">审核时间</th><th style="width:80px">审核结果</th><th>审批意见</th><th style="width:90px">附件</th>' +
      '</tr></thead><tbody id="psc-log-tbody"></tbody></table></div>';

    /* ④ 审核区（仅审核态）：审核结果单选 + 审批意见（驳回必填）+ 当前环节 */
    var auditHtml = '';
    if (mode === 'audit') {
      var steps = stepsOf(r);
      var cur = Math.min(r.auditStep || 0, steps.length - 1);
      auditHtml = '<div class="pm-section-title">审核</div>' +
        '<div class="np-audit-box">' +
        '<div class="np-audit-radio">审核结果：' +
        '<label class="lt-radio"><input type="radio" name="psc-audit-result" value="pass" checked>通过</label>' +
        '<label class="lt-radio"><input type="radio" name="psc-audit-result" value="reject">驳回</label>' +
        '<span class="np-audit-step">本次环节：<b>' + npEscape(steps[cur]) + '</b>（' + npEscape(steps.join(' → ')) + '）</span>' +
        '</div>' +
        '<div class="np-audit-memo">' +
        '<textarea id="psc-audit-memo" placeholder="请输入审批意见（驳回时必填）"></textarea>' +
        '</div>' +
        '<div class="np-form-hint">驳回必须填写审批意见</div>' +
        '</div>';
    }

    body.innerHTML = nodesHtml +
      '<div class="pm-section-title">报废单信息</div><div class="np-form-grid">' + basic + '</div>' + itemsHtml +
      logHtml + auditHtml;
    renderItems();
    renderLog();
    renderTotals();
    renderFooter();
  }

  /* 明细行：编码/名称/单位/不良品库存/单价 一律只读带入，只有「申请数量」可编辑（规范 §3.1.4） */
  function renderItems() {
    var tb = document.getElementById('psc-items-tbody');
    if (!tb) return;
    var r = rec();
    if (!r) return;
    var editableMode = editable();
    var showPicked = !editableMode;
    var list = r.items || [];
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="' + (editableMode ? 9 : (showPicked ? 9 : 8)) +
        '" style="text-align:center;color:#999;padding:14px">' +
        (editableMode ? '请点击右上「配件选择」勾选需报废的配件' : '无配件明细') + '</td></tr>';
      return;
    }
    tb.innerHTML = list.map(function (itRow, i) {
      var p = partOf(itRow.code) || { name: '', unit: '', price: 0 };
      var codeCell = '<td>' + (itRow.code ? npEscape(itRow.code) : '—') + '</td>';
      var nameCell = '<td>' + (itRow.code ? npEscape(p.name) : '—') + '</td>';
      var unitCell = '<td>' + (itRow.code ? npEscape(p.unit) : '—') + '</td>';
      var badCell = '<td>' + badStock(itRow.code) + '</td>';
      var priceCell = '<td>' + (itRow.code ? p.price.toFixed(2) : '—') + '</td>';
      if (editableMode) {
        return '<tr><td>' + (i + 1) + '</td>' + codeCell + nameCell + unitCell + badCell +
          '<td><div class="lt-input-wrap pl-s"><input type="text" id="psc-item-qty-' + i + '" value="' +
          (itRow.qty || 0) + '" oninput="pscItemQty(' + i + ')"></div></td>' +
          priceCell +
          '<td id="psc-item-amt-' + i + '">' + (itRow.code ? (itRow.qty * p.price).toFixed(2) : '0.00') + '</td>' +
          '<td><a href="javascript:void(0)" class="lt-link np-red" onclick="pscItemDel(' + i + ')">删除</a></td></tr>';
      }
      return '<tr><td>' + (i + 1) + '</td>' + codeCell + nameCell + unitCell +
        '<td>' + itRow.qty + '</td>' +
        (showPicked ? '<td>' + (itRow.pickedQty || 0) + '</td>' : '') +
        priceCell + '<td>' + (itRow.qty * itRow.price).toFixed(2) + '</td></tr>';
    }).join('');
  }

  function renderLog() {
    var tb = document.getElementById('psc-log-tbody');
    if (!tb) return;
    var r = rec();
    var log = (r && r.auditLog) || [];
    if (!log.length) {
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:16px">暂无审批记录</td></tr>';
      return;
    }
    tb.innerHTML = log.map(function (l, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + npEscape(l.step || '—') + '</td><td>' + npEscape(l.person || '—') + '</td>' +
        '<td>' + npEscape(l.time || '—') + '</td><td>' + npEscape(l.result || '—') + '</td>' +
        '<td>' + npEscape(l.opinion || '—') + '</td><td>' + npEscape(l.attach || '—') + '</td></tr>';
    }).join('');
  }

  function renderTotals() {
    var el = document.getElementById('psc-totals');
    if (!el) return;
    var r = rec();
    if (!r) return;
    var rows = editable() ? (r.items || []).map(function (x) {
      var p = partOf(x.code);
      return { qty: x.qty || 0, price: p ? p.price : 0, code: x.code };
    }) : r.items;
    var v = rows.filter(function (x) { return x.code; }).length;
    var q = rows.reduce(function (a, x) { return a + (x.qty || 0); }, 0);
    var m = rows.reduce(function (a, x) { return a + (x.qty || 0) * (x.price || 0); }, 0);
    el.innerHTML = '合计品种 <b>' + v + '</b> 项　合计数量 <b>' + q +
      '</b>　合计金额(含税) <b class="np-money">¥' + m.toFixed(2) + '</b>';
  }

  function renderFooter() {
    var footer = document.getElementById('psc-panel-footer');
    if (!footer) return;
    var r = rec();
    var id = panel.id || '';
    if (editable()) {
      footer.innerHTML = '<div class="np-footer-left">' +
        '<button class="lt-btn lt-btn-default" onclick="pscPrintDraft()">打印</button></div>' +
        '<div class="np-footer-right">' +
        '<button class="lt-btn lt-btn-default" onclick="pscClosePanel()">取消</button>' +
        '<button class="lt-btn lt-btn-primary" onclick="pscSave()">保存</button></div>';
    } else if (panel.mode === 'audit') {
      footer.innerHTML = '<div class="np-footer-left">' +
        '<button class="lt-btn lt-btn-default" onclick="pscPrint(\'' + id + '\')">打印</button></div>' +
        '<div class="np-footer-right">' +
        '<button class="lt-btn lt-btn-default" onclick="pscClosePanel()">关闭</button>' +
        '<button class="lt-btn lt-btn-default" onclick="pscAuditSubmit(\'' + id + '\',\'reject\')">驳回</button>' +
        '<button class="lt-btn lt-btn-primary" onclick="pscAuditSubmit(\'' + id + '\',\'pass\')">通过</button></div>';
    } else {
      footer.innerHTML = '<div class="np-footer-left">' +
        '<button class="lt-btn lt-btn-default" onclick="pscPrint(\'' + id + '\')">打印</button></div>' +
        '<div class="np-footer-right">' +
        '<button class="lt-btn lt-btn-default" onclick="pscClosePanel()">关闭</button></div>';
    }
  }

  /* ---------- 四态入口 ---------- */
  window.pscView = function (id) { openPanel('view', id); };
  window.pscAdd = function () { openPanel('add'); };
  window.pscEdit = function (id) {
    var r = findDoc(id);
    if (!r) return;
    if (!(r.status === '未提交' || r.status === '待审核' || r.status === '已驳回')) {
      npToast('已审核的单据不能修改'); return;
    }
    openPanel('edit', id);
  };
  window.pscAudit = function (id) {
    var r = findDoc(id);
    if (!r) return;
    if (!(r.status === '待审核' || r.status === '审核中')) { npToast('当前状态不可审核'); return; }
    openPanel('audit', id);
  };

  /* ---------- 明细行编辑：只有「申请数量」可编辑，且必须 ≤ 不良品库存 ---------- */
  window.pscItemQty = function (i) {
    var v = parseInt(val('psc-item-qty-' + i), 10);
    var r = rec();
    var code = r.items[i].code;
    var cap = badStock(code);
    if (isNaN(v) || v < 0) v = 0;
    if (v > cap) {
      v = cap;
      setv('psc-item-qty-' + i, String(cap));
      npToast('申请数量不能超过不良品库存（' + cap + '）');
    }
    r.items[i].qty = v;
    var p = partOf(code);
    var cellEl = document.getElementById('psc-item-amt-' + i);
    if (cellEl) cellEl.textContent = p ? (v * p.price).toFixed(2) : '0.00';
    renderTotals();
  };
  window.pscItemDel = function (i) {
    rec().items.splice(i, 1);
    renderItems(); renderTotals();
  };
  window.pscAddPartRow = function (code) {
    var p = partOf(code);
    if (!p) { npToast('未找到配件 ' + code); return; }
    var r = rec();
    if (!r) return;
    for (var i = r.items.length - 1; i >= 0; i--) if (!r.items[i].code) r.items.splice(i, 1);
    var exist = null;
    for (var j = 0; j < r.items.length; j++) if (r.items[j].code === code) exist = r.items[j];
    if (exist) { npToast('该配件已在明细中，请直接改申请数量'); renderItems(); renderTotals(); return; }
    var cap = badStock(code);
    if (cap <= 0) { npToast('该配件无不良品库存，不能申请报废'); return; }
    r.items.push({ code: p.code, qty: 1, pickedQty: 0 });
    renderItems(); renderTotals();
  };

  /* 「配件选择」弹窗：只列有不良品库存的配件，并展示不良品库存供判断（PRD 数量上限依据） */
  window.pscOpenPartPicker = function () {
    var pool = PARTS.filter(function (p) { return badStock(p.code) > 0; });
    var rows = pool.map(function (p, i) {
      return '<tr><td><input type="checkbox" class="psc-pick-check" data-code="' + p.code + '"></td>' +
        '<td>' + (i + 1) + '</td><td>' + npEscape(p.code) + '</td><td>' + npEscape(p.name) + '</td>' +
        '<td>' + npEscape(p.unit) + '</td><td>' + badStock(p.code) + '</td><td>' + p.price.toFixed(2) + '</td></tr>';
    }).join('');
    var body = '<div style="max-height:320px;overflow:auto"><table class="pp-parts-table">' +
      '<thead><tr><th style="width:36px"></th><th style="width:40px">序号</th><th style="width:110px">配件编码</th>' +
      '<th>配件名称</th><th style="width:90px">计量单位</th><th style="width:100px">不良品库存</th>' +
      '<th style="width:100px">单价(含税)</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    npOpenModal('配件选择', body,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="pscConfirmParts()">确定</button>', { width: 800 });
  };
  window.pscConfirmParts = function () {
    var boxes = document.querySelectorAll('.psc-pick-check');
    var picked = [];
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) picked.push(boxes[i].getAttribute('data-code'));
    if (!picked.length) { npToast('请先勾选需报废的配件'); return; }
    picked.forEach(function (code) { window.pscAddPartRow(code); });
    npCloseModal();
  };

  /* ---------- 保存 ---------- */
  window.pscSave = function () {
    var d = panel.draft;
    var storeTxt = val('psc-f-store');
    var dept = val('psc-f-dept');
    var reason = val('psc-f-reason');
    var m = /[（(]([^（）()]+)[）)]$/.exec(storeTxt);
    var storeCode = m ? m[1] : '';
    if (!storeCode) { npToast('请选择门店'); return; }
    var s = storeOf(storeCode) || {};
    if (!dept) { npToast('请选择发起部门'); return; }
    if (!reason) { npToast('请填写申请原因'); return; }
    if (!d.items.length) { npToast('请先点「配件选择」添加需报废的配件'); return; }
    var items = [];
    for (var i = 0; i < d.items.length; i++) {
      if (!d.items[i].code) { npToast('第 ' + (i + 1) + ' 行请选择配件'); return; }
      var cap = badStock(d.items[i].code);
      if (!(d.items[i].qty > 0)) { npToast('第 ' + (i + 1) + ' 行申请数量必须大于 0'); return; }
      /* PRD：报废申请的「数量」只能输入 ≤ 不良品库存 */
      if (d.items[i].qty > cap) {
        npToast('第 ' + (i + 1) + ' 行申请数量不能超过不良品库存（' + cap + '）'); return;
      }
      var p = partOf(d.items[i].code);
      items.push({ code: p.code, name: p.name, unit: p.unit, price: p.price, qty: d.items[i].qty, pickedQty: 0 });
    }
    var all = st().allData;
    if (panel.mode === 'edit') {
      var r = findDoc(panel.id);
      r.storeCode = storeCode; r.storeName = s.shortName || s.name || storeCode;
      r.region = s.region || ''; r.district = s.district || '';
      r.channelMode = s.channelMode || '非直营';
      r.dept = dept; r.reason = reason; r.items = items;
      npToast('已保存');
    } else {
      var no = nextDocNo();
      all.unshift({
        id: no, docNo: no, storeCode: storeCode, storeName: s.shortName || s.name || storeCode,
        region: s.region || '', district: s.district || '',
        channelMode: s.channelMode || '非直营',
        dept: dept, reason: reason, applicant: d.applicant, applyTime: d.applyTime,
        status: '未提交', auditStep: 0, items: items, auditLog: []
      });
      npToast('已保存，单号 ' + no);
    }
    window.pscClosePanel();
    st().query();
  };

  /* 单号自动生成：BF + YYYYMM + 4 位流水（PRD：保存时自动生成） */
  function nextDocNo() {
    var ym = nowText().slice(0, 7).replace('-', '');
    var prefix = 'BF' + ym;
    var max = 0;
    st().allData.forEach(function (r) {
      if (r.docNo.indexOf(prefix) === 0) {
        var n = parseInt(r.docNo.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return prefix + ('000' + (max + 1)).slice(-4);
  }

  /* ---------- 撤回 / 审核（按渠道走 2 级或 3 级流转，落库审批记录） ---------- */
  window.pscWithdraw = function (id) {
    var r = findDoc(id);
    if (!r) return;
    if (r.status !== '待审核') { npToast('只有「待审核」的单据可以撤回'); return; }
    r.status = '未提交';
    r.auditStep = 0;
    npToast('已撤回，可修改后重新提交');
    st().query();
  };

  window.pscAuditSubmit = function (id, result) {
    var r = findDoc(id);
    if (!r) return;
    if (!result) {
      var radios = document.getElementsByName('psc-audit-result');
      for (var i = 0; i < radios.length; i++) if (radios[i].checked) result = radios[i].value;
    }
    var memo = val('psc-audit-memo');
    var steps = stepsOf(r);
    var cur = Math.min(r.auditStep || 0, steps.length - 1);
    if (result === 'reject') {
      if (!memo) { npToast('驳回时必须填写审批意见'); return; }
      r.auditLog = (r.auditLog || []).concat([{
        step: steps[cur], person: currentUser(), time: nowText(), result: '驳回', opinion: memo, attach: '—'
      }]);
      r.status = '已驳回';
      npToast('已驳回');
    } else {
      r.auditLog = (r.auditLog || []).concat([{
        step: steps[cur], person: currentUser(), time: nowText(), result: '通过', opinion: memo || '同意', attach: '—'
      }]);
      r.auditStep = cur + 1;
      r.status = statusByStep(r);
      npToast(r.status === '审核通过' ? '审核通过' : ('审核通过，流转至' + steps[r.auditStep]));
    }
    window.pscClosePanel();
    st().query();
  };

  /* ---------- 打印（PRD 详情第 3 条 / 新增第 2 条） ---------- */
  function printHtml(r) {
    var rows = (r.items || []).map(function (x, i) {
      var p = partOf(x.code) || { name: '', unit: '', price: 0 };
      var price = x.price != null ? x.price : (p.price || 0);
      var name = x.name || p.name, unit = x.unit || p.unit;
      return '<tr><td>' + (i + 1) + '</td><td>' + npEscape(x.code) + '</td><td>' + npEscape(name) + '</td>' +
        '<td>' + npEscape(unit) + '</td><td>' + (x.qty || 0) + '</td><td>' + price.toFixed(2) + '</td>' +
        '<td>' + ((x.qty || 0) * price).toFixed(2) + '</td></tr>';
    }).join('');
    var q = (r.items || []).reduce(function (a, x) { return a + (x.qty || 0); }, 0);
    var m = (r.items || []).reduce(function (a, x) {
      var price = x.price != null ? x.price : ((partOf(x.code) || {}).price || 0);
      return a + (x.qty || 0) * price;
    }, 0);
    return '<div class="np-print">' +
      '<div class="np-print-title">配件报废单</div>' +
      '<div class="np-print-meta">单号：' + npEscape(r.docNo || '（未保存）') +
      '　门店：' + npEscape(r.storeName || '—') + '（' + npEscape(r.storeCode || '—') + '）' +
      '　发起部门：' + npEscape(r.dept || '—') +
      '<br>报废申请人：' + npEscape(r.applicant || '—') +
      '　申请时间：' + npEscape(r.applyTime || '—') +
      '<br>申请原因：' + npEscape(r.reason || '—') + '</div>' +
      '<table class="pp-parts-table"><thead><tr><th style="width:44px">序号</th><th style="width:100px">配件编码</th>' +
      '<th>配件名称</th><th style="width:80px">计量单位</th><th style="width:90px">申请数量</th>' +
      '<th style="width:90px">单价(含税)</th><th style="width:100px">金额(含税)</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="pp-panel-totals">合计数量 <b>' + q + '</b>　合计金额(含税) <b>¥' + m.toFixed(2) + '</b></div>' +
      '<div class="np-print-sign">报废申请人签字：____________　　审核人签字：____________</div>' +
      '</div>';
  }
  window.pscPrint = function (id) {
    var r = findDoc(id);
    if (!r) return;
    npOpenModal('打印预览 — ' + r.docNo, printHtml(r),
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>', { width: 860 });
  };
  window.pscPrintDraft = function () {
    var d = panel.draft;
    if (!d) return;
    var tmp = {
      docNo: panel.mode === 'edit' ? panel.id : '（未保存）',
      storeName: d.storeName, storeCode: d.storeCode, dept: val('psc-f-dept') || d.dept,
      applicant: d.applicant, applyTime: d.applyTime, reason: val('psc-f-reason') || d.reason,
      items: (d.items || []).filter(function (x) { return x.code; }).map(function (x) {
        var p = partOf(x.code);
        return { code: p.code, name: p.name, unit: p.unit, price: p.price, qty: x.qty || 0 };
      })
    };
    if (!tmp.items.length) { npToast('请先添加配件再打印'); return; }
    npOpenModal('打印预览 — ' + (panel.mode === 'edit' ? tmp.docNo : '新增报废单'), printHtml(tmp),
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>', { width: 860 });
  };

  /* ---------- 页面初始化 ---------- */
  window.initPartsScrap = function () {
    var root = document.getElementById('page-' + K);
    if (!root) return;
    root.innerHTML = npShell(K, { l2: '配件库存管理', l3: '配件报废单' },
      filterHtml(), toolbarHtml(), npTH(cols()), P + '-tbody', P + '-pager');
    NP[K] = { page: 1, pageSize: 20, allData: window.PSC_DOCS.slice(), filtered: [], query: null, reset: null, render: null };
    initFilterGrid(K + '-filterGrid', 7);
    NP[K]._fShow = 7; NP[K]._fExp = false;
    npDefaultDateRange(P + '-d-s', P + '-d-e');   // PRD：默认当前 1 个月
    /* 动态页必须自己补一次 npInitComboboxes()（showContent 内那次跑在本页 DOM 生成之前）。 */
    if (typeof npInitComboboxes === 'function') npInitComboboxes();

    var s = NP[K];
    s.query = function () {
      var no = val(P + '-f-no');
      var status = val(P + '-f-status');
      var dept = val(P + '-f-dept');
      var applicant = val(P + '-f-applicant');
      var rg = readRange();
      s.filtered = s.allData.filter(function (r) {
        return (no === '' || r.docNo.indexOf(no) >= 0) &&
          (status === '' || r.status === status) &&
          (dept === '' || r.dept === dept) &&
          (applicant === '' || r.applicant.indexOf(applicant) >= 0) &&
          (rg.s === '' || r.applyTime.slice(0, 10) >= rg.s) &&
          (rg.e === '' || r.applyTime.slice(0, 10) <= rg.e);
      });
      s.page = 1;
      s.render();
    };
    s.reset = function () {
      setv(P + '-f-no', ''); setv(P + '-f-status', ''); setv(P + '-f-dept', ''); setv(P + '-f-applicant', '');
      setv(P + '-d-s', ''); setv(P + '-d-e', '');
      var tx = root.querySelector('.lt-date-range-text'); if (tx) tx.value = '';
      npDefaultDateRange(P + '-d-s', P + '-d-e');
      s.query();
    };
    s.render = function () {
      npRenderTable(K, P + '-tbody', P + '-pager', cols(), s.filtered, s);
    };
    s.query();
  };

  /* 供测试与其它模块复用 */
  window.pscVariety = varietyOf;
  window.pscTotalQty = qtyOf;
  window.pscTotalAmount = amtOf;
  window.pscAllPicked = allPicked;
  window.pscNodeStates = nodeStates;
  window.pscNodes = nodesOf;
  window.pscSteps = stepsOf;
  window.pscBadStock = badStock;
  window.pscPanelMode = function () { return panel.mode; };
  /* 供测试读取草稿（真实交互不直接改草稿，一律走 pscItemQty） */
  window.pscDraft = function () { return panel.draft; };

  if (typeof npRegisterModuleInit === 'function') {
    npRegisterModuleInit(K, function () { window.initPartsScrap(); });
  }
})();
