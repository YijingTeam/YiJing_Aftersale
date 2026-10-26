/* ============================================================================
   配件库存管理 · 配件内部领用单（2026-10-25 依 PRD 5.7.2 新建）
   ----------------------------------------------------------------------------
   需求原文：PRD-配件0625.md 5.7.2（本地：李荣云/obsidianVault/10-奕境/配件）
     · 总部配件人员查询门店领用单；门店人员做领用申请、领用审核
     · 查询：领用单号 / 单据状态 / 发起部门(下拉带模糊搜索) / 申请日期区间 / 领用申请人
     · 列表：操作(撤回·编辑·审核·查看) / 领用单号 / 发起部门 / 合计品种 / 合计数量 /
             合计金额(含税) / 单据状态 / 申请原因 / 领用申请人 / 申请时间
     · 规则：待审核可修改、已审核不可改、已备货的单据不能审核、单号保存时自动生成
     · 详情：四级节点(领用申请→财务审核→总经理审核→领用出库) + 配件行含出库数量 + 打印
     · 新增/编辑：发起部门 / 申请原因 / 选配件+申请数量 / 细分类型(直营店必填) / 申请人=提交人 / 打印
     · 审核：门店业务 → 门店财务 → 门店总经理（三级）
   原型元素（与站内单据页一致，pso/ep 同构）：
     侧滑面板 pm-panel + 基本信息(pm-form-grid 行内同框) + 单据节点条 + 配件明细表 +
     合计行 + 审批记录表(7 列) + 审核区(通过/驳回 + 审批意见) + 底部按钮
   原型元素来源（2026-10-25 用户认可版，务必按此理解，勿误标为"按原型页面实现"）：
     · PRD 文字表格（5.7.2 查询/列表/详情/新增/审核 各表 + 3 条补充说明）→ 已逐项落地
     · 站内范本（零件采购/外采的单据面板）：四态共壳 pm-panel、审批记录 7 列、
       审核结果单选+审批意见、底部按钮组 —— 这些是「站内范本」来源，不是原型页面来源
     · **PRD 原型页面 5.7.2_04.png（新增/编辑）、5.7.2_05.png（审核）未读到**
       （当前模型不支持图片输入，read_image 报 does not declare image input）；
       执行本文件时若已获得这两张页面的元素清单，请逐项对齐后删除本段说明。
   设计依据：
     · 原型规范 §3.1.2 表单字段行内同框、§3.1.3 单据四态面板元素清单、
       §4.2 列宽映射表、§4.2.1 操作列最后一列、§4.9 单据字典
     · 范本：js/parts-sales.js psoEnsurePanel/psoOpenPanel（侧滑面板骨架）、
             js/app.js L8073-8102（审批记录 + 审核结果区）
   ========================================================================== */
(function () {
  'use strict';

  var K = 'parts-internal-usage';

  /* ---------- 字典（与原型规范 §4.9 一一对应，页面内不得再散落字面量） ---------- */
  window.PIU_STATUS = ['未提交', '待审核', '审核中', '审核通过', '已驳回'];
  window.PIU_SUBTYPES = [
    '劳动保护用品', '赠送客户礼品', '售后服务活动', '试驾车领用及装饰', '展车领用及装饰',
    '店面布置用品及客休区用品', '辅料领用', '小金额工具件', '服务部清洁用品'
  ];
  window.PIU_DEPTS = ['维修部', '保养部', '配件部', '美容部'];
  /* 四级节点（PRD 节点推进表） */
  window.PIU_NODES = ['领用申请', '财务审核', '总经理审核', '领用出库'];
  /* 三级审核环节（PRD「内部领用：门店业务、门店财务、门店总经理审核」） */
  window.PIU_AUDIT_STEPS = ['门店业务审核', '门店财务审核', '门店总经理审核'];

  /* ---------- 配件池：全站唯一来源 = app.js 的 window.NP_PARTS（规范 §4.8 / AGENTS §2） ---------- */
  var PARTS = window.NP_PARTS;
  window.PIU_PARTS = PARTS;

  function storeOf(code) {
    var all = (NP['store-manage'] && NP['store-manage'].allData) || [];
    for (var i = 0; i < all.length; i++) if (all[i].code === code) return all[i];
    return null;
  }
  function partOf(code) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].code === code) return PARTS[i];
    return null;
  }
  /* 单据派生值：合计品种 / 合计数量 / 合计金额(含税) */
  function varietyOf(r) { return r.items.length; }
  function qtyOf(r) { var s = 0; r.items.forEach(function (it) { s += it.qty; }); return s; }
  function amtOf(r) {
    var s = 0;
    r.items.forEach(function (it) { s += it.qty * it.price; });
    return Math.round(s * 100) / 100;
  }
  /* 已全部出库：每行出库数量 = 申请数量 */
  function allPicked(r) {
    return r.items.length > 0 && r.items.every(function (it) { return (it.pickedQty || 0) >= it.qty; });
  }
  /* 节点状态（PRD 5 行对照表）：返回 4 个 'done' | 'doing' | 'todo' */
  function nodeStates(r) {
    var picked = allPicked(r);
    switch (r.status) {
      case '未提交':
      case '已驳回': return ['doing', 'todo', 'todo', 'todo'];
      case '待审核': return ['done', 'doing', 'todo', 'todo'];
      case '审核中': return ['done', 'done', 'doing', 'todo'];
      case '审核通过': return picked ? ['done', 'done', 'done', 'done'] : ['done', 'done', 'done', 'doing'];
      default: return ['doing', 'todo', 'todo', 'todo'];
    }
  }
  var NODE_TEXT = { done: '已完成', doing: '进行中', todo: '未开始' };

  /* ---------- 种子：单号沿用 LY 前缀（与「内部领用明细」同业务），门店取自门店主数据 ---------- */
  function seedDocs() {
    /* 审批记录按单据状态生成，字段口径同站内其它单据：{step, person, time, result, opinion, attach} */
    function logs(status, applicant, applyTime) {
      if (status === '未提交') return [];
      var l = [{ step: '领用申请', person: applicant, time: applyTime, result: '提交', opinion: '—', attach: '—' }];
      if (status === '待审核') return l;
      if (status === '审核中') {
        l.push({ step: '门店财务审核', person: '李四', time: nextMin(applyTime, 95), result: '通过', opinion: '同意领用', attach: '—' });
        return l;
      }
      if (status === '审核通过') {
        l.push({ step: '门店财务审核', person: '李四', time: nextMin(applyTime, 95), result: '通过', opinion: '同意领用', attach: '—' });
        l.push({ step: '门店总经理审核', person: '王五', time: nextMin(applyTime, 240), result: '通过', opinion: '同意', attach: '—' });
        return l;
      }
      /* 已驳回 */
      l.push({ step: '门店财务审核', person: '李四', time: nextMin(applyTime, 95), result: '驳回', opinion: '本季度劳保用品额度已用完，请下季度再提', attach: '—' });
      return l;
    }
    function nextMin(t, min) {
      var d = new Date(t.replace(/-/g, '/'));
      d.setMinutes(d.getMinutes() + min);
      function p2(n) { return (n < 10 ? '0' : '') + n; }
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
        p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    }
    function mk(no, code, dept, reason, applicant, time, status, subType, picked, items) {
      var s = storeOf(code) || {};
      return {
        id: no,
        docNo: no,
        storeCode: code,
        storeName: s.shortName || s.name || code,
        region: s.region || '',
        district: s.district || '',
        channelMode: s.channelMode || '非直营',
        dept: dept,
        reason: reason,
        applicant: applicant,
        applyTime: time,
        status: status,
        subType: subType,
        /* 已备货：仓库已开始备料，PRD 规定此时不能审核 */
        hasPicked: !!picked,
        items: items,
        auditLog: logs(status, applicant, time)
      };
    }
    function it(code, qty, pickedQty) {
      var p = partOf(code);
      return { code: p.code, name: p.name, unit: p.unit, price: p.price, qty: qty, pickedQty: pickedQty || 0 };
    }
    return [
      /* 未提交 2 条（可编辑） */
      mk('LY2025100001', 'BJ001', '维修部', '维修更换机油滤清器', '张三', '2026-10-08 09:12:35', '未提交', '', false,
        [it('P001', 2), it('P003', 1)]),
      mk('LY2025100002', 'SH001', '保养部', '定期保养耗材', '李四', '2026-10-09 10:05:21', '未提交', '', false,
        [it('P005', 3)]),
      /* 待审核 4 条（可撤回/编辑/审核；其中 1 条已备货 → 不能审核） */
      mk('LY2025100003', 'GZ001', '配件部', '售后活动备件', '王五', '2026-10-10 14:20:08', '待审核', '售后服务活动', false,
        [it('P002', 4), it('P006', 2)]),
      mk('LY2025100004', 'WH001', '维修部', '维修领用刹车油', '赵六', '2026-10-11 08:45:52', '待审核', '', true,
        [it('P007', 5)]),
      mk('LY2025100005', 'HBZ01', '美容部', '店面布置用品', '钱七', '2026-10-12 16:30:12', '待审核', '店面布置用品及客休区用品', false,
        [it('P006', 6), it('P005', 2)]),
      mk('LY2025100006', 'SZ001', '保养部', '试驾车装饰备件', '孙八', '2026-10-13 11:10:40', '待审核', '试驾车领用及装饰', false,
        [it('P001', 4)]),
      /* 审核中 2 条（财务已过，总经理审核中） */
      mk('LY2025100007', 'HZ001', '维修部', '维修车间辅料', '周九', '2026-10-14 09:00:30', '审核中', '辅料领用', false,
        [it('P003', 5), it('P004', 8)]),
      mk('LY2025100008', 'SCZ01', '配件部', '小工具领用', '吴十', '2026-10-15 13:25:16', '审核中', '小金额工具件', false,
        [it('P008', 1)]),
      /* 审核通过 4 条：2 条已全部出库、2 条未出库 */
      mk('LY2025100009', 'BJ001', '保养部', '保养用蓄电池', '张三', '2026-10-16 10:40:05', '审核通过', '', false,
        [it('P008', 2, 2), it('P001', 3, 3)]),
      mk('LY2025100010', 'SH001', '维修部', '维修用空气滤清器', '李四', '2026-10-17 15:18:44', '审核通过', '', false,
        [it('P003', 4, 4)]),
      mk('LY2025100011', 'GZ001', '维修部', '钣喷车间劳保用品', '王五', '2026-10-18 08:20:11', '审核通过', '劳动保护用品', false,
        [it('P002', 2, 1), it('P006', 1, 0)]),
      mk('LY2025100012', 'WH001', '美容部', '清洁用品领用', '赵六', '2026-10-19 17:05:33', '审核通过', '服务部清洁用品', false,
        [it('P005', 2, 0)]),
      /* 已驳回 2 条（可编辑后重新提交） */
      mk('LY2025100013', 'SZ001', '配件部', '赠送客户礼品', '孙八', '2026-10-20 09:35:27', '已驳回', '赠送客户礼品', false,
        [it('P006', 3)]),
      mk('LY2025100014', 'HZ001', '保养部', '展车装饰备件', '周九', '2026-10-21 14:55:48', '已驳回', '展车领用及装饰', false,
        [it('P001', 2), it('P005', 1)])
    ];
  }
  window.PIU_DOCS = seedDocs();

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
  /* 当前登录人（PRD：领用申请人=提交人，不允许代申请） */
  function currentUser() {
    return window.gUserName || '当前登录人';
  }

  /* ---------- 列定义（PRD 字段顺序 + 序号 + 门店两列；操作固定最后一列） ---------- */
  function cols() {
    return [
      { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
      {
        t: '领用单号', w: 140, cls: 'col-doc-no sticky', f: function (r) {
          return '<a href="javascript:void(0)" class="lt-btn-link" onclick="piuView(\'' + r.id + '\')">' + npEscape(r.docNo) + '</a>';
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
      { t: '领用申请人', w: 90, cls: 'col-applicant', f: function (r) { return npEscape(r.applicant); } },
      { t: '申请时间', w: 140, cls: 'col-apply-time', f: function (r) { return npEscape(r.applyTime); } },
      {
        /* 操作列必须最后一列：.col-actions 是 sticky right:0（规范 §4.2.1） */
        t: '操作', w: 150, cls: 'col-actions', f: function (r) {
          var ops = [];
          if (r.status === '待审核') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="piuWithdraw(\'' + r.id + '\')">撤回</a>');
          }
          /* PRD：待审核可改；已审核（审核中/审核通过）不能改；驳回后可改后重提 */
          if (r.status === '未提交' || r.status === '待审核' || r.status === '已驳回') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="piuEdit(\'' + r.id + '\')">编辑</a>');
          }
          /* PRD：已备货的单据不能审核（不渲染，符合"不能操作的不给按钮"） */
          if ((r.status === '待审核' || r.status === '审核中') && !r.hasPicked) {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="piuAudit(\'' + r.id + '\')">审核</a>');
          }
          ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="piuView(\'' + r.id + '\')">查看</a>');
          return npRenderActions(ops, 4);
        }
      }
    ];
  }

  /* ---------- 查询区（PRD 5 项） ---------- */
  var P = 'piu';
  function filterHtml() {
    return npFItem('领用单号', '<input type="text" id="' + P + '-f-no" placeholder="请输入">') +
      npSelect('单据状态', '<select id="' + P + '-f-status"><option value="">请选择</option>' +
        window.PIU_STATUS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
      /* PRD：发起部门 = 下拉带模糊搜索 → 用全站唯一 combobox 组件 */
      npComboMarkup(K, P + '-f-dept', '发起部门', window.PIU_DEPTS) +
      '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">申请日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="NP[\'' + K + '\'].query()">' +
      '<div class="lt-date-range-drop">' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-s" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '<span>—</span>' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-e" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div></div></div>' +
      npFItem('领用申请人', '<input type="text" id="' + P + '-f-applicant" placeholder="请输入">');
  }

  function readRange() { return { s: val(P + '-d-s'), e: val(P + '-d-e') }; }

  function toolbarHtml() {
    return '<button class="lt-btn lt-btn-primary" onclick="piuAdd()">新增领用单</button>';
  }

  /* ==========================================================================
     四态侧滑面板（新增 / 编辑 / 查看 / 审核 同一壳，与 pso/ep 同构）
     元素清单（PRD 5.7.2 全部落地）：
       基本信息（行内同框）+ 单据节点 + 配件明细(含出库数量) + 合计 +
       审批记录 + 审核区（通过/驳回 + 审批意见）+ 打印
     ========================================================================== */
  var panel = { mode: null, id: null, draft: null };

  function ensurePanel() {
    if (document.getElementById('piu-panel-overlay')) return;
    var d = document.createElement('div');
    d.innerHTML =
      '<div class="pm-panel-overlay" id="piu-panel-overlay" onclick="piuClosePanel()"></div>' +
      '<div class="pm-panel" id="piu-panel" style="width:1100px">' +
      '<div class="pm-panel-header">' +
      '<div style="display:flex;align-items:center">' +
      '<span class="pm-panel-title" id="piu-panel-title">配件内部领用单</span>' +
      '<span class="pm-panel-badge" id="piu-panel-badge">新增</span>' +
      '</div>' +
      '<button class="pm-panel-close" onclick="piuClosePanel()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body" id="piu-panel-body"></div>' +
      '<div class="pm-panel-footer np-split-footer" id="piu-panel-footer"></div>' +
      '</div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
  }

  window.piuClosePanel = function () {
    var ov = document.getElementById('piu-panel-overlay');
    var pn = document.getElementById('piu-panel');
    if (ov) ov.classList.remove('show');
    if (pn) pn.classList.remove('show');
  };

  function openPanel(mode, id) {
    ensurePanel();
    panel.mode = mode;
    panel.id = id || null;
    var badge = document.getElementById('piu-panel-badge');
    var title = document.getElementById('piu-panel-title');
    var rec = id ? findDoc(id) : null;
    if (mode === 'add') {
      var s0 = (NP['store-manage'] && NP['store-manage'].allData[0]) || null;
      panel.draft = {
        storeCode: s0 ? s0.code : '', storeName: s0 ? (s0.shortName || s0.name) : '',
        dept: '', reason: '', subType: '', applicant: currentUser(),
        applyTime: nowText(), items: [], status: '未提交', hasPicked: false, auditLog: []
      };
      title.textContent = '配件内部领用单';
      badge.textContent = '新增';
      badge.className = 'pm-panel-badge';
    } else if (mode === 'edit') {
      panel.draft = {
        storeCode: rec.storeCode, storeName: rec.storeName, dept: rec.dept, reason: rec.reason,
        subType: rec.subType, applicant: rec.applicant, applyTime: rec.applyTime,
        status: rec.status, hasPicked: rec.hasPicked, auditLog: rec.auditLog || [],
        items: rec.items.map(function (x) { return { code: x.code, qty: x.qty }; })
      };
      title.textContent = '配件内部领用单 ' + rec.docNo;
      badge.textContent = '编辑';
      badge.className = 'pm-panel-badge';
    } else if (mode === 'audit') {
      title.textContent = '领用单审核 — ' + rec.docNo;
      badge.textContent = '审核';
      badge.className = 'pm-panel-badge';
    } else {
      title.textContent = '领用单详情 — ' + rec.docNo;
      badge.textContent = '查看详情';
      badge.className = 'pm-panel-badge detail';
    }
    renderPanel();
    document.getElementById('piu-panel-overlay').classList.add('show');
    document.getElementById('piu-panel').classList.add('show');
  }

  /* 只读字段：与可编辑字段同一套行内同框，只是 input 加 readonly */
  function roItem(label, value) {
    return npFormItem(label, '<input type="text" readonly value="' + npEscape(value == null ? '' : value) + '">', false);
  }
  function roSelect(label, value) {
    return npFormSelect(label, '<select disabled><option>' + npEscape(value == null ? '' : value) + '</option></select>', false);
  }

  function rec() {
    return panel.mode === 'add' || panel.mode === 'edit' ? panel.draft : findDoc(panel.id);
  }
  function editable() { return panel.mode === 'add' || panel.mode === 'edit'; }

  function renderPanel() {
    var body = document.getElementById('piu-panel-body');
    var footer = document.getElementById('piu-panel-footer');
    if (!body || !footer) return;
    var r = rec();
    if (!r) return;
    var mode = panel.mode;
    var isEdit = mode === 'edit';
    var showReadParts = !editable();

    /* --- ① 基本信息（行内同框；新增/编辑可改，其余只读） --- */
    var basic;
    if (editable()) {
      var deptOptions = '<option value="">请选择</option>' + window.PIU_DEPTS.map(function (o) {
        return '<option' + (r.dept === o ? ' selected' : '') + '>' + npEscape(o) + '</option>';
      }).join('');
      var subOptions = '<option value="">请选择</option>' + window.PIU_SUBTYPES.map(function (o) {
        return '<option' + (r.subType === o ? ' selected' : '') + '>' + npEscape(o) + '</option>';
      }).join('');
      basic = npFormItem('领用单号', '<input type="text" readonly value="' + (isEdit ? npEscape(r.docNo || panel.id) : '保存后自动生成') + '">', false) +
        npFormItem('门店', '<input type="text" id="piu-f-store" readonly placeholder="请选择" value="' +
          npEscape(r.storeName + '（' + r.storeCode + '）') + '"' +
          (isEdit ? ' disabled' : ' onclick="msOpenStorePicker(\'piu-f-store\')"') + '>', true) +
        npFormSelect('发起部门', '<select id="piu-f-dept">' + deptOptions + '</select>', true) +
        npFormSelect('内部领用细分类型', '<select id="piu-f-subtype">' + subOptions + '</select>', false) +
        /* PRD 第 2 条：申请人员=提交人，不允许代申请 → 只读带出 */
        npFormItem('领用申请人', '<input type="text" id="piu-f-applicant" readonly value="' + npEscape(r.applicant) + '">', false) +
        npFormItem('申请时间', '<input type="text" readonly value="' + npEscape(r.applyTime) + '">', false) +
        '<div class="lt-filter-item np-grid-full">' + npFormItem('申请原因', '<input type="text" id="piu-f-reason" placeholder="请输入申请原因" value="' +
          npEscape(r.reason) + '">', true) + '</div>';
    } else {
      basic = roItem('领用单号', r.docNo) + roItem('门店', r.storeName + '（' + r.storeCode + '）') +
        roItem('发起部门', r.dept) + roItem('内部领用细分类型', r.subType || '—') +
        roItem('领用申请人', r.applicant) + roItem('申请时间', r.applyTime) +
        roItem('单据状态', r.status) + roItem('申请原因', r.reason || '—');
    }

    /* --- ② 单据节点（PRD 节点 5 行对照表）→ 面板最顶部（用户 2026-10-25：节点要在最上面） --- */
    var ns = nodeStates(r);
    var nodesHtml = '<div class="pm-section-title">单据节点</div><div class="np-steps">' +
      window.PIU_NODES.map(function (n, i) {
        var s = ns[i];
        return '<div class="np-step ' + s + '"><span class="np-step-dot"></span>' +
          '<span class="np-step-name">' + npEscape(n) + '</span>' +
          '<span class="np-step-state">' + NODE_TEXT[s] + '</span></div>';
      }).join('') + '</div>';

    /* --- ③ 配件明细（PRD 2：详情里显示「出库数量」）
       口径（用户 2026-10-25）：选配件后自动带入 配件编码/配件名称/计量单位/单价，
       带入后这四列一律只读；只有「申请数量」可编辑。选择动作走「配件选择」弹窗（站内范本 psofAddRow）。
       不再单起「配件明细」小节标题：与基本信息同属「领用单信息」一段。 --- */
    var itemsHtml = (editable() ? '<div class="np-items-toolbar"><button class="lt-btn lt-btn-default" onclick="piuOpenPartPicker()">配件选择</button></div>' : '') +
      '<div style="overflow-x:auto"><table class="pp-parts-table np-items-table" id="np-items-table"><thead><tr>' +
      '<th style="width:44px">序号</th><th style="width:110px">配件编码</th><th style="width:180px">配件名称</th>' +
      '<th style="width:90px">计量单位</th><th style="width:100px">申请数量</th>' +
      (showReadParts ? '<th style="width:90px">出库数量</th>' : '') +
      '<th style="width:100px">单价(含税)</th><th style="width:110px">金额(含税)</th>' +
      (editable() ? '<th style="width:70px">操作</th>' : '') +
      '</tr></thead><tbody id="piu-items-tbody"></tbody></table></div>' +
      '<div class="pp-panel-totals" id="piu-totals"></div>';
    /* --- ④ 审批记录（站内单据统一 7 列；空态「暂无审批记录」） --- */
    var logHtml = '<div class="pm-section-title">审批记录</div><div style="overflow-x:auto"><table class="pp-parts-table">' +
      '<thead><tr><th style="width:44px">序号</th><th style="width:130px">审核节点</th><th style="width:90px">审核人</th>' +
      '<th style="width:150px">审核时间</th><th style="width:80px">审核结果</th><th>审批意见</th><th style="width:90px">附件</th>' +
      '</tr></thead><tbody id="piu-log-tbody"></tbody></table></div>';
    /* --- ⑤ 审核区（仅审核态） --- */
    var auditHtml = '';
    if (mode === 'audit') {
      var step = r.status === '待审核' ? window.PIU_AUDIT_STEPS[1] : window.PIU_AUDIT_STEPS[2];
      auditHtml = '<div class="pm-section-title">审核</div>' +
        '<div class="np-audit-box">' +
        '<div class="np-audit-radio">审核结果：' +
        '<label class="lt-radio"><input type="radio" name="piu-audit-result" value="pass" checked>通过</label>' +
        '<label class="lt-radio"><input type="radio" name="piu-audit-result" value="reject">驳回</label>' +
        '<span class="np-audit-step">本次环节：<b>' + npEscape(step) + '</b>（门店业务 → 门店财务 → 门店总经理）</span>' +
        '</div>' +
        '<div class="np-audit-memo">' +
        '<textarea id="piu-audit-memo" placeholder="请输入审批意见（驳回时必填）"></textarea>' +
        '</div>' +
        '<div class="np-form-hint">驳回必须填写审批意见</div>' +
        '</div>';
    }

    /* 顺序：单据节点（最顶）→ 领用单信息（基本信息 + 配件明细 + 合计，一个段落不再拆）→ 审批记录 → 审核区 */
    body.innerHTML = nodesHtml +
      '<div class="pm-section-title">领用单信息</div><div class="np-form-grid">' + basic + '</div>' + itemsHtml +
      logHtml + auditHtml;
    renderItems();
    renderLog();
    renderTotals();
    renderFooter();
  }

  /* 明细行：可编辑 = 选择配件 + 输入申请数量；只读 = 文本 + 出库数量 */
  function renderItems() {
    var tb = document.getElementById('piu-items-tbody');
    if (!tb) return;
    var r = rec();
    if (!r) return;
    var editableMode = editable();
    var showPicked = !editableMode;
    var list = editableMode ? (r.items || []) : r.items;
    if (editableMode && !list.length) {
      tb.innerHTML = '<tr><td colspan="' + (showPicked ? 8 : 7) + '" style="text-align:center;color:#999;padding:14px">请点击右上「配件选择」勾选要领用的配件</td></tr>';
      return;
    }
    tb.innerHTML = list.map(function (itRow, i) {
      var p = partOf(itRow.code) || { name: '', unit: '', price: 0 };
      /* 配件编码/名称/单位/单价：选配件后自动带入，一律只读文本（禁止在行内改） */
      var codeCell = '<td>' + (itRow.code ? npEscape(itRow.code) : '—') + '</td>';
      var nameCell = '<td>' + (itRow.code ? npEscape(p.name) : '—') + '</td>';
      var unitCell = '<td>' + (itRow.code ? npEscape(p.unit) : '—') + '</td>';
      var priceCell = '<td>' + (itRow.code ? p.price.toFixed(2) : '—') + '</td>';
      if (editableMode) {
        return '<tr><td>' + (i + 1) + '</td>' + codeCell + nameCell + unitCell +
          '<td><div class="lt-input-wrap pl-s"><input type="text" id="piu-item-qty-' + i + '" value="' +
          (itRow.qty || 0) + '" oninput="piuItemQty(' + i + ')"></div></td>' +
          priceCell +
          '<td id="piu-item-amt-' + i + '">' + (itRow.code ? (itRow.qty * p.price).toFixed(2) : '0.00') + '</td>' +
          '<td><a href="javascript:void(0)" class="lt-link np-red" onclick="piuItemDel(' + i + ')">删除</a></td></tr>';
      }
      return '<tr><td>' + (i + 1) + '</td>' + codeCell + nameCell + unitCell +
        '<td>' + itRow.qty + '</td>' +
        (showPicked ? '<td>' + (itRow.pickedQty || 0) + '</td>' : '') +
        priceCell + '<td>' + (itRow.qty * itRow.price).toFixed(2) + '</td></tr>';
    }).join('');
    /* 只读态的「出库数量」合计提示（PRD 第 2 条） */
    var tip = document.getElementById('piu-picked-tip');
    if (!editableMode && tip) tip.textContent = '';
  }

  function renderLog() {
    var tb = document.getElementById('piu-log-tbody');
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
    var el = document.getElementById('piu-totals');
    if (!el) return;
    var r = rec();
    if (!r) return;
    var rows = editable() ? r.items.map(function (x) {
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
    var footer = document.getElementById('piu-panel-footer');
    if (!footer) return;
    var r = rec();
    var id = panel.id || '';
    if (panel.mode === 'add' || panel.mode === 'edit') {
      footer.innerHTML = '<div class="np-footer-left">' +
        '<button class="lt-btn lt-btn-default" onclick="piuPrintDraft()">打印</button></div>' +
        '<div class="np-footer-right">' +
        '<button class="lt-btn lt-btn-default" onclick="piuClosePanel()">取消</button>' +
        '<button class="lt-btn lt-btn-primary" onclick="piuSave()">保存</button></div>';
    } else if (panel.mode === 'audit') {
      footer.innerHTML = '<div class="np-footer-left">' +
        '<button class="lt-btn lt-btn-default" onclick="piuPrint(\'' + id + '\')">打印</button></div>' +
        '<div class="np-footer-right">' +
        '<button class="lt-btn lt-btn-default" onclick="piuClosePanel()">关闭</button>' +
        '<button class="lt-btn lt-btn-default" onclick="piuAuditSubmit(\'' + id + '\',\'reject\')">驳回</button>' +
        '<button class="lt-btn lt-btn-primary" onclick="piuAuditSubmit(\'' + id + '\',\'pass\')">通过</button></div>';
    } else {
      footer.innerHTML = '<div class="np-footer-left">' +
        '<button class="lt-btn lt-btn-default" onclick="piuPrint(\'' + id + '\')">打印</button></div>' +
        '<div class="np-footer-right">' +
        '<button class="lt-btn lt-btn-default" onclick="piuClosePanel()">关闭</button></div>';
    }
  }

  /* ---------- 入口：查看 / 新增 / 编辑 / 审核 ---------- */
  window.piuView = function (id) {
    if (!findDoc(id)) return;
    openPanel('view', id);
  };
  window.piuAdd = function () { openPanel('add', null); };
  window.piuEdit = function (id) {
    var r = findDoc(id);
    if (!r) return;
    if (!(r.status === '未提交' || r.status === '待审核' || r.status === '已驳回')) {
      npToast('已审核的单据不能修改'); return;
    }
    openPanel('edit', id);
  };
  window.piuAudit = function (id) {
    var r = findDoc(id);
    if (!r) return;
    /* PRD：已备货的单据不能审核 */
    if (r.hasPicked) { npToast('已备货的单据不能审核'); return; }
    if (!(r.status === '待审核' || r.status === '审核中')) { npToast('当前状态不可审核'); return; }
    openPanel('audit', id);
  };

  /* ---------- 明细行编辑：只有「申请数量」可编辑；配件编码/名称/单位/单价 由选择带入且只读 ---------- */
  window.piuItemQty = function (i) {
    var v = parseInt(val('piu-item-qty-' + i), 10);
    panel.draft.items[i].qty = isNaN(v) ? 0 : v;
    var p = partOf(panel.draft.items[i].code);
    var cellEl = document.getElementById('piu-item-amt-' + i);
    if (cellEl) cellEl.textContent = p ? (panel.draft.items[i].qty * p.price).toFixed(2) : '0.00';
    renderTotals();
  };
  window.piuItemDel = function (i) {
    panel.draft.items.splice(i, 1);
    renderItems(); renderTotals();
  };
  /* 追加一行配件（范本：psofConfirmPick 追加行；编码/名称/单位/单价 全部带入只读） */
  window.piuAddPartRow = function (code) {
    var p = partOf(code);
    if (!p) { npToast('未找到配件 ' + code); return; }
    if (!panel.draft) return;
    /* 清掉新增时预置的空行（未选任何配件的占位行） */
    for (var i = panel.draft.items.length - 1; i >= 0; i--) {
      if (!panel.draft.items[i].code) panel.draft.items.splice(i, 1);
    }
    var exist = null;
    for (var j = 0; j < panel.draft.items.length; j++) {
      if (panel.draft.items[j].code === code) exist = panel.draft.items[j];
    }
    if (exist) { npToast('该配件已在明细中，请直接改申请数量'); renderItems(); renderTotals(); return; }
    panel.draft.items.push({ code: p.code, qty: 1 });
    renderItems(); renderTotals();
  };

  /* ---------- 「配件选择」弹窗（站内范本 psofAddRow：勾选 → 确定 → 追加明细行） ---------- */
  window.piuOpenPartPicker = function () {
    var rows = PARTS.map(function (p, i) {
      return '<tr><td><input type="checkbox" class="piu-pick-check" data-code="' + p.code + '"></td>' +
        '<td>' + (i + 1) + '</td><td>' + npEscape(p.code) + '</td><td>' + npEscape(p.name) + '</td>' +
        '<td>' + npEscape(p.unit) + '</td><td>' + p.price.toFixed(2) + '</td></tr>';
    }).join('');
    var body = '<div style="max-height:320px;overflow:auto"><table class="pp-parts-table">' +
      '<thead><tr><th style="width:36px"></th><th style="width:40px">序号</th><th style="width:110px">配件编码</th>' +
      '<th>配件名称</th><th style="width:90px">计量单位</th><th style="width:100px">单价(含税)</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    npOpenModal('配件选择', body,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="piuConfirmParts()">确定</button>', { width: 760 });
  };
  window.piuConfirmParts = function () {
    var boxes = document.querySelectorAll('.piu-pick-check');
    var picked = [];
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked) picked.push(boxes[i].getAttribute('data-code'));
    }
    if (!picked.length) { npToast('请先勾选要领用的配件'); return; }
    picked.forEach(function (code) { window.piuAddPartRow(code); });
    npCloseModal();
  };

  /* ---------- 保存（新增/编辑） ---------- */
  window.piuSave = function () {
    var d = panel.draft;
    var storeTxt = val('piu-f-store');
    var dept = val('piu-f-dept');
    var subType = val('piu-f-subtype');
    var reason = val('piu-f-reason');
    var m = /[（(]([^（）()]+)[）)]$/.exec(storeTxt);
    var storeCode = m ? m[1] : '';
    if (!storeCode) { npToast('请选择门店'); return; }
    var s = storeOf(storeCode) || {};
    if (!dept) { npToast('请选择发起部门'); return; }
    if (!reason) { npToast('请填写申请原因'); return; }
    /* PRD 第 3 条：内部领用细分类型，直营店必填 */
    if (s.channelMode === '直营' && !subType) { npToast('直营店必须选择内部领用细分类型'); return; }
    var items = [];
    if (!d.items.length) { npToast('请先点「配件选择」添加领用配件'); return; }
    for (var i = 0; i < d.items.length; i++) {
      if (!d.items[i].code) { npToast('第 ' + (i + 1) + ' 行请选择配件'); return; }
      if (!(d.items[i].qty > 0)) { npToast('第 ' + (i + 1) + ' 行申请数量必须大于 0'); return; }
      var p = partOf(d.items[i].code);
      items.push({ code: p.code, name: p.name, unit: p.unit, price: p.price, qty: d.items[i].qty, pickedQty: 0 });
    }
    var all = st().allData;
    if (panel.mode === 'edit') {
      var r = findDoc(panel.id);
      r.storeCode = storeCode; r.storeName = s.shortName || s.name || storeCode;
      r.region = s.region || ''; r.district = s.district || ''; r.channelMode = s.channelMode || '非直营';
      r.dept = dept; r.reason = reason; r.subType = subType; r.items = items;
      npToast('已保存');
    } else {
      var no = nextDocNo();
      all.unshift({
        id: no, docNo: no, storeCode: storeCode, storeName: s.shortName || s.name || storeCode,
        region: s.region || '', district: s.district || '', channelMode: s.channelMode || '非直营',
        dept: dept, reason: reason, applicant: d.applicant, applyTime: d.applyTime,
        status: '未提交', subType: subType, hasPicked: false, items: items,
        auditLog: []
      });
      npToast('已保存，单号 ' + no);
    }
    window.piuClosePanel();
    st().query();
  };

  /* 单号自动生成：LY + YYYYMM + 4 位流水（PRD：保存时自动生成） */
  function nextDocNo() {
    var ym = nowText().slice(0, 7).replace('-', '');
    var prefix = 'LY' + ym;
    var max = 0;
    st().allData.forEach(function (r) {
      if (r.docNo.indexOf(prefix) === 0) {
        var n = parseInt(r.docNo.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return prefix + ('000' + (max + 1)).slice(-4);
  }

  /* ---------- 撤回 / 审核（三级流转 + 审批记录落库） ---------- */
  window.piuWithdraw = function (id) {
    var r = findDoc(id);
    if (!r) return;
    if (r.status !== '待审核') { npToast('只有「待审核」的单据可以撤回'); return; }
    r.status = '未提交';
    npToast('已撤回，可修改后重新提交');
    st().query();
  };

  window.piuAuditSubmit = function (id, result) {
    var r = findDoc(id);
    if (!r) return;
    if (!result) {
      var radios = document.getElementsByName('piu-audit-result');
      for (var i = 0; i < radios.length; i++) if (radios[i].checked) result = radios[i].value;
    }
    var memo = val('piu-audit-memo');
    var stepName = r.status === '待审核' ? window.PIU_AUDIT_STEPS[1] : window.PIU_AUDIT_STEPS[2];
    if (result === 'reject') {
      /* PRD（采购/外采同口径）：审核驳回，审批意见必填 */
      if (!memo) { npToast('驳回时必须填写审批意见'); return; }
      r.auditLog = (r.auditLog || []).concat([{
        step: stepName, person: currentUser(), time: nowText(), result: '驳回', opinion: memo, attach: '—'
      }]);
      r.status = '已驳回';
      npToast('已驳回');
    } else if (r.status === '待审核') {
      r.auditLog = (r.auditLog || []).concat([{
        step: stepName, person: currentUser(), time: nowText(), result: '通过', opinion: memo || '同意', attach: '—'
      }]);
      r.status = '审核中';   /* 门店财务审核通过 → 进入门店总经理审核 */
      npToast('审核通过，流转至门店总经理审核');
    } else {
      r.auditLog = (r.auditLog || []).concat([{
        step: stepName, person: currentUser(), time: nowText(), result: '通过', opinion: memo || '同意', attach: '—'
      }]);
      r.status = '审核通过'; /* 门店总经理审核通过 → 待领用出库 */
      npToast('审核通过');
    }
    window.piuClosePanel();
    st().query();
  };

  /* ---------- 打印（PRD 1-3：详情可打印 / 新增编辑可打印当前内容） ---------- */
  function printHtml(r) {
    var rows = (r.items || []).map(function (x, i) {
      var p = x.price != null ? x : (partOf(x.code) || { name: '', unit: '', price: 0 });
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
      '<div class="np-print-title">配件内部领用单</div>' +
      '<div class="np-print-meta">单号：' + npEscape(r.docNo || '（未保存）') +
      '　门店：' + npEscape(r.storeName || '—') + '（' + npEscape(r.storeCode || '—') + '）' +
      '　发起部门：' + npEscape(r.dept || '—') +
      '<br>领用申请人：' + npEscape(r.applicant || '—') +
      '　申请时间：' + npEscape(r.applyTime || '—') +
      '　内部领用细分类型：' + npEscape(r.subType || '—') +
      '<br>申请原因：' + npEscape(r.reason || '—') + '</div>' +
      '<table class="pp-parts-table"><thead><tr><th style="width:44px">序号</th><th style="width:100px">配件编码</th>' +
      '<th>配件名称</th><th style="width:80px">计量单位</th><th style="width:90px">申请数量</th>' +
      '<th style="width:90px">单价(含税)</th><th style="width:100px">金额(含税)</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="pp-panel-totals">合计数量 <b>' + q + '</b>　合计金额(含税) <b>¥' + m.toFixed(2) + '</b></div>' +
      '<div class="np-print-sign">领用申请人签字：____________　　审核人签字：____________</div>' +
      '</div>';
  }
  window.piuPrint = function (id) {
    var r = findDoc(id);
    if (!r) return;
    npOpenModal('打印预览 — ' + r.docNo, printHtml(r),
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>', { width: 860 });
  };
  /* 新增/编辑态打印：打印当前面板内容（PRD 新增第 4 条） */
  window.piuPrintDraft = function () {
    var d = panel.draft;
    if (!d) return;
    var tmp = {
      docNo: panel.mode === 'edit' ? panel.id : '（未保存）',
      storeName: d.storeName, storeCode: d.storeCode, dept: val('piu-f-dept') || d.dept,
      applicant: d.applicant, applyTime: d.applyTime, subType: val('piu-f-subtype') || d.subType,
      reason: val('piu-f-reason') || d.reason,
      items: d.items.filter(function (x) { return x.code; }).map(function (x) {
        var p = partOf(x.code);
        return { code: p.code, name: p.name, unit: p.unit, price: p.price, qty: x.qty || 0 };
      })
    };
    if (!tmp.items.length) { npToast('请先添加配件再打印'); return; }
    npOpenModal('打印预览 — ' + (panel.mode === 'edit' ? tmp.docNo : '新增领用单'), printHtml(tmp),
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>', { width: 860 });
  };

  /* ---------- 页面初始化 ---------- */
  window.initPartsInternalUsage = function () {
    var root = document.getElementById('page-' + K);
    if (!root) return;
    root.innerHTML = npShell(K, { l2: '配件库存管理', l3: '配件内部领用单' },
      filterHtml(), toolbarHtml(), npTH(cols()), P + '-tbody', P + '-pager');
    NP[K] = { page: 1, pageSize: 20, allData: window.PIU_DOCS.slice(), filtered: [], query: null, reset: null, render: null };
    initFilterGrid(K + '-filterGrid', 7);
    NP[K]._fShow = 7; NP[K]._fExp = false;
    npDefaultDateRange(P + '-d-s', P + '-d-e');   // PRD：默认当前 1 个月
    /* 动态页必须在 DOM 生成后自己补一次 npInitComboboxes()：
       showContent 里的那次注入跑在 npInitModule 之前，本页 DOM 那时还不存在（规范 §Combobox 第 9 款）。 */
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

  /* 供测试与其它模块复用的派生函数 */
  window.piuVariety = varietyOf;
  window.piuTotalQty = qtyOf;
  window.piuTotalAmount = amtOf;
  window.piuAllPicked = allPicked;
  window.piuNodeStates = nodeStates;
  window.piuPanelMode = function () { return panel.mode; };

  if (typeof npRegisterModuleInit === 'function') {
    npRegisterModuleInit(K, function () { window.initPartsInternalUsage(); });
  }
})();
