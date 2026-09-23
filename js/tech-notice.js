// =====================================================================
// 技术公告 / 技术公告发布（系统设置）
// 查看态 = tech-notice；管理态 = tech-notice-manage（showContent 别名 + _isTechNoticeManage）。
// 编号：TI + YYMMDD + 3位流水（当天重置）。
// 状态：未发布 / 已发布（按在线 PRD 6.4：无「已下架」；已发布「取消发布」→未发布(曾发布过)，重新发布→已发布+「已更新」细字标记）。
// 发布对象：总部/门店(可同选) + 角色（粒度止于角色，2026-09-18 用户拍板：无需精确到个人），默认门店。
// =====================================================================
(function () {
  var K = 'tech-notice';
  NP[K] = { page: 1, pageSize: 20, allData: [], filtered: [], render: null, query: null, reset: null };

  var TYPES = ['TSI', 'TMI'];
  var SUBTYPES = ['召回', '交付前返修', '主动活动', '被动活动', '技术指导', '政策流程', '管理指导'];
  var NOTE_TYPES = ['不需要质量报告', '需要质量报告', '市场处置活动'];
  var SERIES = ['奕境S 2024款', '奕境X9', '奕境X10', '奕境L7'];
  var MODELS = ['纯电版', '增程版', 'PHEV', 'EV'];

  function org() { return window.ORG_MASTER || { roles: [], stores: [], persons: [], roleById: function(){return null;}, roleLabel: function(r){return r;}, personById: function(){return null;} }; }
  function flDict() { return window.FAULT_LOCATIONS || []; }
  function isHq() { var r = window.gUserRole || '门店'; return r === '总部' || r === '超级管理员'; }
  function isManage() { return !!window._isTechNoticeManage; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function pad3(n) { return String(n).padStart(3, '0'); }

  function genCode() {
    var d = new Date();
    var prefix = 'TI' + String(d.getFullYear()).slice(-2) + pad2(d.getMonth() + 1) + pad2(d.getDate());
    var seq = 1;
    NP[K].allData.forEach(function (a) {
      if (a.code && a.code.indexOf(prefix) === 0) {
        var s = parseInt(a.code.slice(prefix.length), 10) || 0;
        if (s >= seq) seq = s + 1;
      }
    });
    return prefix + pad3(seq);
  }

  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h; }
  function shiftSec(dt, sec) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(dt); if (!m) return dt;
    var d2 = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    d2 = new Date(d2.getTime() + sec * 1000);
    return d2.getFullYear() + '-' + pad2(d2.getMonth() + 1) + '-' + pad2(d2.getDate()) + ' ' + pad2(d2.getHours()) + ':' + pad2(d2.getMinutes()) + ':' + pad2(d2.getSeconds());
  }

  // 演示阅读标记（仅种子用）：按 人员ID|公告ID 哈希生成伪随机 已读/未读/是否已下载
  function demoReads(allIds, aid, publishTime) {
    var reads = {};
    allIds.forEach(function (pid) {
      var h = hash(pid + '|' + aid);
      var read = (h % 100) < 60;
      var down = (h % 100) < 30;
      reads[pid] = {
        read: read,
        readTime: read ? shiftSec(publishTime, h % 86400) : '',
        downloaded: down,
        downloadTime: down ? shiftSec(publishTime, (h >> 3) % 86400) : ''
      };
    });
    return reads;
  }

  // ===== 种子（覆盖 未发布/已发布 + 曾发布过/已更新 各示例，便于查看各状态操作） =====
  // 状态机按在线 PRD 6.4：未发布 / 已发布（无「已下架」；已发布=取消发布→回到未发布(曾发布过)，再发布→已发布+「已更新」）
  function seed() {
    var o = org();
    var allIds = o.persons.map(function (p) { return p.personId; });
    function mk(code, title, type, subtype, series, model, fl, status, publishTime, updated, publishedBefore) {
      var a = {
        id: code, code: code, title: title, type: type, subtype: subtype, factory: '', techIssueNo: '', techIssueTitle: '',
        series: series, model: model, faultLocation: fl, fdesc1: '', fdesc2: '', fdesc3: '', fdesc4: '', fdesc5: '',
        prodStart: '', prodEnd: '', summary: '', mainPartCode: '', mainPartName: '', faultCondition: '', repairPlan: '',
        bodyHtml: '<p>' + title + '</p>', attachments: [],
        target: { orgs: ['门店', '总部'], roles: [] },
        status: status, publishTime: publishTime || '', publisher: '总部管理员',
        updated: !!updated, publishedBefore: !!publishedBefore, readByMe: false, downloadedByMe: false,
        reads: demoReads(allIds, code, publishTime)
      };
      return a;
    }
    NP[K].allData = [
      mk('TI260801001', '关于奕境X9刹车系统制动力不足的技术公告', 'TSI', '召回', '奕境X9', '纯电版', '刹车系统', '已发布', '2026-08-01 09:00:00', false, false),
      mk('TI260815001', '奕境L7空调系统制冷不良维修指导', 'TMI', '技术指导', '奕境L7', 'PHEV', '空调系统', '已发布', '2026-08-15 10:30:00', true, true),
      mk('TI260828001', '奕境S 2024款动力电池主动检测活动（草稿·指定门店×角色示例）', 'TSI', '主动活动', '奕境S 2024款', '', '动力电池', '未发布', '', false, false),
      mk('TI260820001', '奕境X9整车保养活动方案调整说明（曾发布过·已取消发布）', 'TSI', '主动活动', '奕境X9', '纯电版', '电控系统', '未发布', '', false, true),
      mk('TI260812001', '奕境L7高压电池检测活动（草稿示例）', 'TSI', '主动活动', '奕境L7', 'PHEV', '动力电池', '未发布', '', false, false)
    ];
    // 公告说明（下拉：不需要质量报告/需要质量报告/市场处置活动；非必填）示例取值
    ['需要质量报告', '市场处置活动', '不需要质量报告', '需要质量报告', ''].forEach(function (nv, i) { NP[K].allData[i].noticeDesc = nv; });
    // 发布对象示例（2026-09-05 新口径：全部门店 / 指定店整发 / 指定店×角色 / 总部+门店组合），五种详情文案各有可见示例
    var al = NP[K].allData;
    var stRoles = o.roles.filter(function (r) { return r.scope === '门店'; });
    var hqRoles2 = o.roles.filter(function (r) { return r.scope === '总部'; });
    function stOfRegion(region) { var out = []; for (var i = 0; i < o.stores.length; i++) if ((o.stores[i].region || '') === region) out.push(o.stores[i]); return out; }
    function pickRole(list, name) { for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i]; return list[0] || null; }
    var eaSt = stOfRegion('华东'), scSt = stOfRegion('华南');
    var svcRole = pickRole(stRoles, '门店服务顾问'), mgrRole = pickRole(stRoles, '门店服务经理');
    var hqTech = pickRole(hqRoles2, '总部技术专家');
    if (eaSt.length >= 2 && scSt.length && svcRole && mgrRole && hqTech) {
      // al[0] 已发布普通：全部门店 + 整个总部 → 「门店，总部」
      al[0].target = { keys: ['ORG-STORES', 'ORG-HQ'] };
      // al[1] 已发布：指定店整发（华东 2 家店）
      al[1].target = { keys: ['STORE-' + eaSt[0].code, 'STORE-' + eaSt[1].code] };
      // al[2] 未发布草稿(整店示例改为 部分店×角色)：华东 2 家店的「门店服务顾问」
      al[2].target = { keys: ['STORE-' + eaSt[0].code, 'STORE-' + eaSt[1].code, 'RF-' + svcRole.id] };
      // al[3] 未发布(曾发布过)：华东 1 店+华南 1 店 × 服务顾问+服务经理，另加总部技术专家
      al[3].target = { keys: ['STORE-' + eaSt[0].code, 'STORE-' + scSt[0].code, 'RF-' + svcRole.id, 'RF-' + mgrRole.id, 'HQ-ROLE-' + hqTech.id] };
      // al[4] 未发布草稿：指定 1 家店整发
      al[4].target = { keys: ['STORE-' + eaSt[0].code] };
    } else {
      // 兜底：全部门店 + 整个总部
      al.forEach(function (x) { x.target = { keys: ['ORG-STORES', 'ORG-HQ'] }; });
    }
  }
  seed();

  function findAnn(id) { for (var i = 0; i < NP[K].allData.length; i++) if (NP[K].allData[i].id === id) return NP[K].allData[i]; return null; }

  // ===== 列表 =====
  // 模糊下拉用公共组件（.lt-input-wrap.combobox + npComboboxSelect；× 由 npComboboxInit 注入，
  // data-k 触发 NP[K].query，data-apply 触发 tnQuery）
  function tnCmb(fieldId, prefix, opts) {
    var lis = '<li data-val="" onclick="npComboboxSelect(this)">请选择</li>' +
      opts.map(function (o) { return '<li data-val="' + npEscape(o) + '" onclick="npComboboxSelect(this)">' + npEscape(o) + '</li>'; }).join('');
    return '<div class="lt-filter-item"><div class="lt-input-wrap combobox" style="position:relative" data-k="tech-notice" data-apply="tnQuery">' +
      '<span class="lt-filter-prefix">' + npEscape(prefix) + '</span>' +
      '<input type="text" id="' + fieldId + '" placeholder="请选择或输入" onfocus="npComboboxShow(this)" oninput="npComboboxFilter(this)">' +
      '<span class="cb-arrow" onclick="npComboboxToggle(this)">▼</span>' +
      '<ul class="lt-datalist">' + lis + '</ul></div></div>';
  }
  function listFilterHtml() {
    var flNames = flDict().filter(function (f) { return f.status !== '停用'; }).map(function (f) { return f.name; });
    var tail = isManage()
      ? tnCmb('tn-f-status', '状态', ['未发布', '已发布'])
      : (tnCmb('tn-f-read', '是否已读', ['已读', '未读']) + tnCmb('tn-f-down', '是否已下载', ['已下载', '未下载']));
    return '<div class="lt-filter"><div class="lt-filter-grid" id="tech-notice-filterGrid">' +
      npFItem('公告编号', '<input type="text" id="tn-f-code" placeholder="编号">') +
      npFItem('公告标题', '<input type="text" id="tn-f-title" placeholder="标题">') +
      tnCmb('tn-f-type', '公告类型', TYPES) +
      tnCmb('tn-f-subtype', '公告子类', SUBTYPES) +
      npFItem('车系', '<input type="text" id="tn-f-series" placeholder="车系关键字">') +
      npFItem('车型', '<input type="text" id="tn-f-model" placeholder="车型关键字">') +
      tnCmb('tn-f-fl', '故障部位', flNames) +
      tnCmb('tn-f-note', '公告说明', NOTE_TYPES) +
      tail +
      '<div class="lt-filter-footer"><button class="lt-btn lt-btn-primary" onclick="tnQuery()">查询</button><button class="lt-btn lt-btn-default" onclick="tnReset()">重置</button><a href="javascript:void(0)" class="lt-filter-toggle" onclick="npToggleFilter(\'tech-notice\')">﹀ 展开</a></div>' +
      '</div></div>';
  }

  function listToolbarHtml() {
    return (isManage() ? '<button class="lt-btn lt-btn-primary" onclick="tnOpenForm()">新建</button>' : '');
  }

  function buildShell() {
    var root = document.getElementById('page-tech-notice');
    if (!root) return;
    var cols = [
      { t: '序号', w: 50, cls: 'sticky col-seq' }, { t: '公告编号', w: 130, cls: 'sticky col-code' }, { t: '公告标题', w: 200, cls: 'sticky col-title' },
      { t: '公告类型', w: 80 }, { t: '公告子类', w: 90 },
      { t: '公告说明' }, { t: '车系', w: 90 }, { t: '车型', w: 80 }, { t: '故障部位', w: 90 }, { t: '发布人', w: 90 },
      { t: '发布时间', w: 150 }
    ];
    if (isManage()) { cols.push({ t: '状态', w: 120 }); }
    else { cols.push({ t: '是否已读', w: 70 }, { t: '是否已下载', w: 80 }); }
    cols.push({ t: '操作', w: 150, cls: 'col-actions' });
    root.innerHTML = '<div class="lt-wrap">' + listFilterHtml() +
      '<div class="lt-list-area"><div class="lt-toolbar"><div class="lt-toolbar-left">' + listToolbarHtml() + '</div></div>' +
      '<div class="lt-table-wrap"><table class="lt-table"><thead><tr>' + npTH(cols) + '</tr></thead><tbody id="tn-tbody"></tbody></table></div>' +
      '<div class="lt-pager" id="tn-pager"><div class="lt-pager-left"><span class="pager-total">共 0 条</span></div>' +
      '<div class="lt-pager-right"><button class="pg-prev">上一页</button><span class="pg-pages"></span><button class="pg-next">下一页</button>' +
      '<div class="pager-goto">前往 <input type="text"> 页</div><select class="pager-size"><option value="10">10条/页</option><option value="20" selected>20条/页</option><option value="50">50条/页</option><option value="100">100条/页</option></select></div></div>' +
      '</div></div>';
  }

  function tnQuery() {
    var st = NP[K];
    function v(id) { return ((document.getElementById(id) || {}).value || ''); }
    var code = v('tn-f-code').trim(), title = v('tn-f-title').trim(), type = v('tn-f-type'), subtype = v('tn-f-subtype');
    var series = v('tn-f-series').trim(), model = v('tn-f-model').trim(), fl = v('tn-f-fl'), note = v('tn-f-note').trim();
    var status = v('tn-f-status'), read = v('tn-f-read'), down = v('tn-f-down');
    st.filtered = st.allData.filter(function (a) {
      return (!code || a.code.indexOf(code) >= 0) && (!title || a.title.indexOf(title) >= 0) &&
        (!type || a.type === type) && (!subtype || a.subtype === subtype) &&
        (!series || (a.series || '').indexOf(series) >= 0) && (!model || (a.model || '').indexOf(model) >= 0) &&
        (!fl || a.faultLocation === fl) && (!note || (a.noticeDesc || '').indexOf(note) >= 0) &&
        (!status || a.status === status) &&
        (!read || (read === '已读' ? a.readByMe : !a.readByMe)) &&
        (!down || (down === '已下载' ? a.downloadedByMe : !a.downloadedByMe)) &&
        (isManage() || a.status === '已发布');
    });
    st.page = 1;
    renderList();
  }
  function tnReset() {
    ['tn-f-code', 'tn-f-title', 'tn-f-type', 'tn-f-subtype', 'tn-f-series', 'tn-f-model', 'tn-f-fl', 'tn-f-note', 'tn-f-status', 'tn-f-read', 'tn-f-down'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    tnQuery();
  }

  function renderList() {
    var st = NP[K];
    var tb = document.getElementById('tn-tbody');
    if (!tb) return;
    var pages = Math.max(1, Math.ceil(st.filtered.length / st.pageSize));
    if (st.page > pages) st.page = pages;
    if (st.page < 1) st.page = 1;
    var start = (st.page - 1) * st.pageSize;
    var rows = st.filtered.slice(start, start + st.pageSize);
    var html = '';
    rows.forEach(function (a, i) {
      var ops = [];
      if (!isManage()) { // 查看态：仅查看
        ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="tnOpenDetail(\'' + a.id + '\')">查看</a>');
      } else if (a.status === '未发布') {
        // 仅「未发布」可删除（含 曾发布过/草稿 两种）
        ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="tnOpenForm(\'' + a.id + '\')">编辑</a>');
        ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="tnPublish(\'' + a.id + '\')">发布</a>');
        ops.push('<a href="javascript:void(0)" class="lt-link np-red" onclick="tnDelete(\'' + a.id + '\')">删除</a>');
      } else if (a.status === '已发布') {
        // 已发布不可直接编辑（须先取消发布）；阅读情况仅「已发布」可看
        ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="tnOpenDetail(\'' + a.id + '\')">查看</a>');
        ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="tnCancelPublish(\'' + a.id + '\')">取消发布</a>');
        ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="tnOpenRead(\'' + a.id + '\')">阅读情况</a>');
      }
      html += '<tr><td class="sticky col-seq">' + (start + i + 1) + '</td>' +
        '<td class="sticky col-code">' + npEscape(a.code) + '</td>' +
        '<td class="sticky col-title">' + npEscape(a.title) + '</td>' +
        '<td>' + npEscape(a.type) + '</td><td>' + npEscape(a.subtype) + '</td><td>' + npEscape(a.noticeDesc || '—') + '</td>' +
        '<td>' + npEscape(a.series) + '</td><td>' + npEscape(a.model || '—') + '</td><td>' + npEscape(a.faultLocation) + '</td>' +
        '<td>' + npEscape(a.publisher) + '</td><td>' + (a.publishTime || '—') + '</td>';
      if (isManage()) {
        html += '<td>' + tnStatusHtml(a) + '</td>';
      } else {
        html += '<td>' + (a.readByMe ? '<span class="lt-badge ok">已读</span>' : '<span class="lt-badge off">未读</span>') + '</td>' +
          '<td>' + (a.downloadedByMe ? '<span class="lt-badge ok">已下载</span>' : '<span class="lt-badge off">未下载</span>') + '</td>';
      }
      html += '<td class="col-actions">' + npRenderActions(ops) + '</td></tr>';
    });
    if (!rows.length) html = '<tr><td colspan="' + (isManage() ? 13 : 14) + '" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    tb.innerHTML = html;
    var pager = document.getElementById('tn-pager');
    if (pager) {
      npRenderPager(pager, {
        page: st.page, pageSize: st.pageSize, total: st.filtered.length,
        go: function (p) { st.page = p; renderList(); },
        size: function (v) { st.pageSize = v; st.page = 1; renderList(); }
      });
    }
  }

  function tnStatusHtml(a) {
    var s = a.status;
    var cls = s === '已发布' ? 'ok' : 'warn'; // 两档：已发布(绿) / 未发布(橙)
    var html = '<span class="lt-badge ' + cls + '">' + s + '</span>';
    // 「已更新」低调细字标记：仅 已发布（曾发布过→取消发布→重新发布）时显示
    if (a.updated && s === '已发布') html += ' <span class="tn-upd-flag">已更新</span>';
    return html;
  }

  window.tnQuery = tnQuery;
  window.tnReset = tnReset;
  window.tnDelete = function (id) {
    if (!confirm('确定删除该技术公告？')) return;
    var st = NP[K];
    for (var i = 0; i < st.allData.length; i++) if (st.allData[i].id === id) { st.allData.splice(i, 1); break; }
    tnQuery();
    npToast('已删除');
  };

  // ===== 状态动作（按 6.4：发布 / 取消发布） =====
  window.tnPublish = function (id) {
    var a = findAnn(id); if (!a) return;
    // 9.8 口径：列表「发布」＝直接上线为「已发布」（不带「已更新」）；
    // 「已更新」只在「编辑 → 保存并发布」时标记（见 tnSave 的 republishNow）。
    a.status = '已发布'; a.publishTime = npNowLocal(); a.updated = false;
    tnQuery(); npToast('已发布');
  };
  // 取消发布（原「下架」），二次确认；取消后回到 未发布(曾发布过)
  window.tnCancelPublish = function (id) {
    if (!confirm('确定取消发布该技术公告？取消后门店端不可见，可编辑后重新发布。')) return;
    var a = findAnn(id); if (!a) return;
    if (a.status === '已发布') a.publishedBefore = true;
    a.status = '未发布';
    a.updated = false; // 9.8 口径：取消发布本身不保留「更新过」；再次列表发布不带「已更新」
    tnQuery(); npToast('已取消发布');
  };

  // ===== 表单 / 发布对象 / 富文本 / 附件 =====
  var editingId = null;
  var formAttachments = [];

  window.tnExec = function (cmd, val) {
    var ed = document.getElementById('tn-editor'); if (ed && ed.focus) ed.focus();
    document.execCommand(cmd, false, val || null);
  };
  window.tnInsertLink = function () { var u = prompt('链接地址', 'https://'); if (u) document.execCommand('createLink', false, u); };
  window.tnInsertTable = function () {
    var s = prompt('表格 行×列', '2×3'); if (!s) return;
    var m = /(\d+)\s*[×xX*]\s*(\d+)/.exec(s); if (!m) { alert('格式如 3×4'); return; }
    var rows = parseInt(m[1], 10), cols = parseInt(m[2], 10);
    if (rows < 1 || cols < 1 || rows > 10 || cols > 10) { alert('行列 1~10'); return; }
    var h = '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;">';
    for (var r = 0; r < rows; r++) { h += '<tr>'; for (var c = 0; c < cols; c++) h += r === 0 ? '<th>表头</th>' : '<td>&nbsp;</td>'; h += '</tr>'; }
    h += '</table>';
    document.execCommand('insertHTML', false, h);
  };
  function editorToolbarHtml() {
    return '<div class="tn-editor-toolbar">' +
      '<button type="button" title="加粗" onclick="tnExec(\'bold\')"><b>B</b></button>' +
      '<button type="button" title="斜体" onclick="tnExec(\'italic\')"><i>I</i></button>' +
      '<button type="button" title="下划线" onclick="tnExec(\'underline\')"><u>U</u></button>' +
      '<select onchange="tnExec(\'fontSize\', this.value)"><option value="3">字号</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option></select>' +
      '<label class="tn-color" title="字体颜色">字体色<input type="color" value="#333333" onchange="tnExec(\'foreColor\', this.value)"></label>' +
      '<label class="tn-color" title="背景色">背景色<input type="color" value="#ffffff" onchange="tnExec(\'hiliteColor\', this.value)"></label>' +
      '<button type="button" title="超链接" onclick="tnInsertLink()">链接</button>' +
      '<button type="button" title="取消链接" onclick="tnExec(\'unlink\')">去链</button>' +
      '<button type="button" title="插入表格" onclick="tnInsertTable()">表格</button>' +
      '<button type="button" title="有序列表" onclick="tnExec(\'insertOrderedList\')">1.</button>' +
      '<button type="button" title="无序列表" onclick="tnExec(\'insertUnorderedList\')">•</button>' +
      '<button type="button" title="清除格式" onclick="tnExec(\'removeFormat\')">清除</button>' +
      '</div>';
  }

  window.tnHandleFiles = function (files) {
    for (var i = 0; i < files.length; i++) {
      if (formAttachments.length >= 5) { alert('最多 5 个附件'); break; }
      var f = files[i]; var dot = f.name.lastIndexOf('.');
      formAttachments.push({ name: f.name, size: f.size, type: dot >= 0 ? f.name.substring(dot + 1).toUpperCase() : '-' });
    }
    renderAttach();
    var inp = document.getElementById('tn-file-input'); if (inp) inp.value = '';
  };
  window.tnRemoveAttach = function (i) { if (panelRo) return; formAttachments.splice(i, 1); renderAttach(); };
  function renderAttach() {
    var box = document.getElementById('tn-attach-list'); if (!box) return;
    if (!formAttachments.length) { box.innerHTML = '<div class="tn-attach-empty">未上传附件</div>'; return; }
    box.innerHTML = formAttachments.map(function (f, i) {
      var size = f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + 'M' : Math.round(f.size / 1024) + 'K';
      var act = panelRo
        ? '<a href="javascript:void(0)" class="lt-btn-link" onclick="tnDownload(\'' + (editingId || '') + '\')">下载</a>'
        : '<button class="tn-attach-del" onclick="tnRemoveAttach(' + i + ')">×</button>';
      return '<div class="tn-attach-item"><span>' + npEscape(f.name) + '（' + size + ' · ' + npEscape(f.type) + '）</span>' + act + '</div>';
    }).join('');
  }

  // ===== 发布对象（门店范围×角色 + 总部树；粒度止于角色） =====
  var tnTree = [];            // 组织树（构建于打开面板时）
  var tnTreeChecked = {};     // 勾选节点 key 集
  var tnTreeOpen = {};        // 展开状态覆盖（key → false=收起；缺省按类型默认）
  var tnTreeQ = '';           // 树搜索关键字

  function tnNodeDefaultOpen(type) { return type !== 'role'; } // 缺省：总部节点展开；角色节点（无子节点）不影响
  function tnNodeOpenState(n) { return tnTreeOpen[n.key] === undefined ? tnNodeDefaultOpen(n.type) : tnTreeOpen[n.key]; }

  function tnBuildTargetTree() {
    var o = org();
    // 发布对象粒度 = 角色为止（2026-09-18 用户拍板：无需精确到个人）→ 总部树 = 整个总部 → 总部角色，无人员节点
    function roleNodesFor(scopePersons, prefix) {
      var out = [];
      o.roles.forEach(function (role) {
        var ps = scopePersons.filter(function (p) { return p.roleId === role.id; });
        if (ps.length) out.push({ key: prefix + role.id, type: 'role', label: role.name + '(' + role.id + ')' });
      });
      return out;
    }
    var hqPersons = o.persons.filter(function (p) { return p.orgType === '总部'; });
    // 门店侧不走树（另用「门店范围 × 角色多选」控件）；总部侧 = 「总部」根行（要不要发给总部）+ 总部角色行
    // 2026-09-18 三次拍板：恢复「总部」根行 —— 根行不选 = 不发总部（总部是可选的一侧；门店侧要不要发由「门店范围」单选决定）
    return [{ key: 'ORG-HQ', type: 'org', label: '总部', children: roleNodesFor(hqPersons, 'HQ-ROLE-') }];
  }

  function tnSubtreeState(node) {
    if (!node.children || !node.children.length) return tnTreeChecked[node.key] ? 'on' : 'off';
    var any = false, all = true;
    node.children.forEach(function (c) {
      var s = tnSubtreeState(c);
      if (s !== 'off') any = true;
      if (s !== 'on') all = false;
    });
    return all ? 'on' : (any ? 'partial' : 'off');
  }
  function tnTreeNodeKeys(n, acc) { acc[n.key] = 1; if (n.children) n.children.forEach(function (c) { tnTreeNodeKeys(c, acc); }); return acc; }
  function tnFindNode(nodes, key) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].key === key) return nodes[i];
      if (nodes[i].children) { var f = tnFindNode(nodes[i].children, key); if (f) return f; }
    }
    return null;
  }
  // 某节点下的全部子孙键（不含自身）
  function tnChildKeys(key) {
    var n = tnFindNode(tnTree, key); if (!n || !n.children || !n.children.length) return [];
    var acc = {}; n.children.forEach(function (c) { tnTreeNodeKeys(c, acc); });
    return Object.keys(acc);
  }
  window.tnTreeToggle = function (key, on) {
    if (panelRo) return;
    var n = tnFindNode(tnTree, key); if (!n) return;
    var acc = tnTreeNodeKeys(n, {});
    Object.keys(acc).forEach(function (k) { if (on) tnTreeChecked[k] = 1; else delete tnTreeChecked[k]; });
    tnRenderTargetTree();
    tnRefreshTarget();
  };
  window.tnTreeSearch = function (v) { tnTreeQ = v; tnRenderTargetTree(); };
  // 展开/收起：仅切换节点显示，不影响勾选
  window.tnTreeFold = function (key) {
    if (panelRo) return;
    var n = tnFindNode(tnTree, key); if (!n || !n.children || !n.children.length) return;
    tnTreeOpen[key] = tnNodeOpenState(n) ? false : true;
    tnRenderTargetTree();
  };

  function tnTreeFilter(nodes, q) {
    if (!q) return nodes;
    q = String(q).toLowerCase();
    var out = [];
    nodes.forEach(function (n) {
      var selfMatch = (n.label || '').toLowerCase().indexOf(q) >= 0;
      var kids = n.children ? tnTreeFilter(n.children, q) : null;
      if (selfMatch || (kids && kids.length)) {
        out.push({ key: n.key, type: n.type, label: n.label, personId: n.personId, children: selfMatch ? n.children : kids });
      }
    });
    return out;
  }

  // 发布对象区域 HTML（新建/编辑，2026-09-05 A 方案拍板）：门店范围 = 全部门店(动态，含以后新增) / 指定门店(固定清单) 互斥单选；角色多选对门店范围整体生效（不进单店）；总部=树(只到总部角色)；下方实时预览
  var tnStoreMode = '';    // 'all' = 全部门店（动态，含以后新增）| 'part' = 指定门店（固定清单）| '' = 未选
  var tnSelStores = {};    // 指定门店模式：已选店 code → 1
  var tnSelRoles = {};     // 已选门店角色 id → 1（空 = 该范围内全员）
  var tnRoleNone = false;  // 仅影响展示：主动取消「全部角色」后角色行全部不选（发布对象仍是该范围内全员）

  function targetPanelHtml() {
    return '<div class="ts-form-item-inline plain tn-objrow"><span class="ts-form-label-inline">发布对象<i class="tn-req">*</i></span>' +
      '<div class="ann-target tn-target-new">' +
      '<div class="tn-tt-sec">' +
      '<div class="tn-tt-head"><b>门店</b>：「全部门店」＝所有门店（含以后新增）；「指定门店」＝所选门店清单。「指定角色」＝所选角色（不选＝全员）</div>' +
      '<div class="tn-tt-storemode"><label class="tn-radio"><input type="radio" name="tn-store-mode" value="all" onchange="tnStoreModeSet(\'all\')"><span>全部门店（含以后新增）</span></label>' +
      '<label class="tn-radio"><input type="radio" name="tn-store-mode" value="part" onchange="tnStoreModeSet(\'part\')"><span>指定门店</span></label></div>' +
      '<div class="tn-tt-part" id="tn-store-part">' +
      '<div class="ts-form-item-inline plain tn-tt-storeline"><span class="ts-form-label-inline">选择门店</span>' +
      '<input id="tn-fm-stores" type="text" readonly placeholder="点击选择门店（可多选）" onclick="tnPickStores()">' +
      '<span class="tn-tt-storequick"><a href="javascript:void(0)" onclick="tnPartClear()">清除</a></span></div>' +
      '<div class="tn-tt-part-hint" id="tn-store-part-hint"></div>' +
      '</div>' +
      '<div class="ann-target-search"><input type="text" id="tn-role-q" placeholder="搜索角色(支持模糊)…" oninput="tnRoleRender()"></div>' +
      '<div class="tn-tt-roles" id="tn-role-box"></div>' +
      '</div>' +
      '<div class="tn-tt-sec">' +
      '<div class="tn-tt-head"><b>总部</b>：「指定角色」＝所选角色（不选＝全员）</div>' +
      '<div class="ann-target-search"><input type="text" id="tn-target-search" placeholder="搜索角色(支持模糊)…" oninput="tnTreeSearch(this.value)"></div>' +
      '<div class="ann-tree-box" id="tn-tree-box"></div>' +
      '</div>' +
      '<div class="tn-tt-preview" id="tn-tt-preview">尚未选择发布对象</div>' +
      '</div></div>';
  }

  // —— 门店范围：全部门店(动态) / 指定门店(固定清单)，复用全站「门店多选弹窗」（筛选/表头全选/右侧已选区/确定）——
  function tnStoreDisp(s) { return (s && (s.shortName || s.name)) || ''; }
  function tnStoreModeRender() {
    var radios = document.querySelectorAll('#tn-panel input[name="tn-store-mode"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = (radios[i].value === tnStoreMode);
    var part = document.getElementById('tn-store-part'); if (!part) return;
    part.classList.toggle('tn-hide', tnStoreMode !== 'part');
    if (tnStoreMode === 'all') tnSelStores = {}; // 全部门店存"全部"语义，不依赖固定清单
    var hint = document.getElementById('tn-store-part-hint');
    if (hint) {
      if (tnStoreMode === 'part') hint.textContent = Object.keys(tnSelStores).length ? '已选 ' + Object.keys(tnSelStores).length + ' 家店（固定清单：以后新增门店不在内）' : '尚未选择门店';
      else if (tnStoreMode === 'all') hint.textContent = '「全部门店」实时按门店主数据全集发布：以后新增的门店会自动纳入';
      else hint.textContent = '';
    }
  }
  window.tnStoreModeSet = function (m) {
    if (panelRo) return;
    if (m === 'all') tnSelStores = {};
    tnStoreMode = m;
    tnSyncStoreInput();
    tnStoreModeRender();
    tnRoleRender();
    tnRefreshTarget();
  };
  function tnSyncStoreInput() {
    var inp = document.getElementById('tn-fm-stores'); if (!inp) return;
    if (tnStoreMode !== 'part') { inp.value = ''; inp.title = '点击选择门店（可多选）'; return; }
    var names = org().stores.filter(function (s) { return tnSelStores[s.code]; }).map(tnStoreDisp).join('、');
    inp.value = names;
    inp.title = names || '点击选择门店';
  }
  window.tnPickStores = function () {
    if (panelRo) return;
    if (tnStoreMode === 'all') tnStoreMode = 'part'; // 点弹窗选店即切换到"指定门店"
    tnStoreModeRender();
    tnSyncStoreInput(); // 弹窗按框内店名预选，当前已选门店回显到右侧已选区
    msOpenStorePicker('tn-fm-stores', function (sel) {
      tnSelStores = {};
      (sel || []).forEach(function (s) { if (s && s.code) tnSelStores[s.code] = 1; });
      tnSyncStoreInput();
      tnStoreModeRender();
      tnRoleRender();
      tnRefreshTarget();
    });
  };
  window.tnPartClear = function () {
    if (panelRo) return;
    tnSelStores = {};
    tnSyncStoreInput();
    tnStoreModeRender();
    tnRoleRender();
    tnRefreshTarget();
  };
  // —— 门店侧角色 = 门店范围 → 角色（粒度止于角色；2026-09-18 用户拍板：无需精确到个人）——
  // 2026-09-18 三次拍板：角色行上方恢复「全部角色」行（全选更方便）——
  //   选上 = 该范围内全部角色；取消 = 角色行全部不选（按说明「指定角色」＝所选角色（不选＝全员），发布对象仍是该范围内全员）
  function tnStoreRoles() { return org().roles.filter(function (r) { return r.scope === '门店'; }); }
  // "未指定角色" = 该范围内全员（界面按"全部选上"展示，与预览、区块说明一致）
  function tnRoleAllOn() { return !Object.keys(tnSelRoles).length && !tnRoleNone; }
  window.tnRoleTick = function (rid, on) {
    if (panelRo) return;
    var wasAllOn = tnRoleAllOn();
    tnRoleNone = false;
    if (on) {
      tnSelRoles[rid] = 1;
      // 全部角色都选上 = 一个都不选（都表示"该范围内全员"），不写一堆 RF- 键
      if (Object.keys(tnSelRoles).length >= tnStoreRoles().length) tnSelRoles = {};
    } else if (wasAllOn) {
      // 当前是"未指定角色"（展示为全部选上）：取消一个角色 = 改为显式选择其余角色
      tnSelRoles = {};
      tnStoreRoles().filter(function (r) { return r.id !== rid; }).forEach(function (r) { tnSelRoles[r.id] = 1; });
    } else delete tnSelRoles[rid];
    tnRoleRender();
    tnRefreshTarget();
  };
  // 「全部角色」行（与总部树的「总部」根行同一形态：勾选框 + 部分选中显示半选）
  window.tnRoleToggleAll = function (on) {
    if (panelRo) return;
    tnSelRoles = {}; tnRoleNone = !on;
    tnRoleRender();
    tnRefreshTarget();
  };
  function tnRoleRender() {
    var box = document.getElementById('tn-role-box'); if (!box) return;
    var hasScope = tnStoreMode === 'all' || Object.keys(tnSelStores).length > 0;
    if (!hasScope) { box.innerHTML = '<div class="tn-tt-empty">请先选择「全部门店」或「指定门店」</div>'; return; }
    var qInp = document.getElementById('tn-role-q');
    var q = qInp ? (qInp.value || '').trim().toLowerCase() : '';
    var roles = org().roles.filter(function (r) { return r.scope === '门店'; });
    var list = q ? roles.filter(function (r) { return ((r.name || '') + ' ' + (r.id || '')).toLowerCase().indexOf(q) >= 0; }) : roles;
    var allOn = tnRoleAllOn();
    var nOn = Object.keys(tnSelRoles).length;
    // 占位箭头：让这行与总部「总部」根行左对齐（本行不可展开，故用隐藏占位）
    var html = '<div class="ann-tnode tn-role-row" style="--lv:0">' +
      '<span class="tn-tree-caret tn-caret-none"></span>' +
      '<label class="ann-tlabel"><input type="checkbox" id="tnck-all-roles"' + (allOn ? ' checked' : '') +
      ' onchange="tnRoleToggleAll(this.checked)"><span class="ann-tlabel-txt"><b>全部角色</b></span></label></div>';
    list.forEach(function (r) {
      var effOn = allOn || !!tnSelRoles[r.id];
      html += '<div class="ann-tnode tn-role-row" style="--lv:1">' +
        '<label class="ann-tlabel"><input type="checkbox"' + (effOn ? ' checked' : '') +
        ' onchange="tnRoleTick(\'' + r.id + '\', this.checked)"><span class="ann-tlabel-txt">' + npEscape(r.name + '(' + r.id + ')') +
        '</span></label></div>';
    });
    if (!list.length) html += '<div class="tn-tt-empty">没有匹配的角色</div>';
    box.innerHTML = html;
    var cbAll = document.getElementById('tnck-all-roles');
    if (cbAll && !allOn && nOn) cbAll.indeterminate = true;   // 选了部分角色 → 半选（与总部树口径一致）
  }
  window.tnRoleRender = tnRoleRender;   // 行内 oninput="tnRoleRender()" 只能调全局函数（2026-09-18 补齐：此前未挂 window → 门店角色搜索框输入即 ReferenceError、列表不筛选）

  // —— 实时预览：发布对象文案 + 人数 ——
  function tnCurrentKeys() {
    var keys = [];
    // 门店：全部门店(动态)=ORG-STORES 语义；指定门店=固定 STORE-* 清单；可带 RF-* 角色收窄（粒度止于角色，不到人）
    if (tnStoreMode === 'all') {
      keys.push('ORG-STORES');
      Object.keys(tnSelRoles).forEach(function (rid) { keys.push('RF-' + rid); });
    } else if (tnStoreMode === 'part') {
      var codes = Object.keys(tnSelStores);
      if (codes.length) {
        codes.forEach(function (c) { keys.push('STORE-' + c); });
        Object.keys(tnSelRoles).forEach(function (rid) { keys.push('RF-' + rid); });
      }
    }
    // 总部：「总部」根行选上 = 整个总部（ORG-HQ，动态覆盖以后新增的总部角色）；只选部分总部角色 = 那些角色；
    //       根行不选 = 不发总部（总部是可选的一侧 —— 2026-09-18 三次拍板）
    var hqRoleKeys = Object.keys(tnTreeChecked).filter(function (k) { return k !== 'ORG-HQ'; });
    var hqAllKeys = tnChildKeys('ORG-HQ');
    if (!hqRoleKeys.length) { /* 不发总部：不产生任何总部键 */ }
    else if (hqAllKeys.length && hqRoleKeys.length >= hqAllKeys.length) keys.push('ORG-HQ');
    else hqRoleKeys.forEach(function (k) { keys.push(k); });
    return keys;
  }
  window.tnRefreshTarget = function () {
    var el = document.getElementById('tn-tt-preview'); if (!el) return;
    var keys = tnCurrentKeys();
    if (!keys.length) { el.textContent = '尚未选择发布对象'; return; }
    var info = tnTargetInfoOf({ target: { keys: keys } });
    var nStore = Object.keys(tnSelStores).length, nRole = Object.keys(tnSelRoles).length;
    var txt = '发布对象：' + info.text + '　共 ' + info.persons.length + ' 人';
    if (nStore && nRole) txt += '（' + nStore + ' 家店 × ' + nRole + ' 个角色）';
    el.textContent = txt;
  };
  // 发布对象区域 HTML（详情只读）：按发布对象实时解析分组展示（门店/角色+X人、门店+X人…）
  function targetPanelRoHtml(a) {
    var txt = tnTargetInfoOf(a).text;
    return '<div class="ts-form-item-inline plain" style="grid-column:1/-1"><span class="ts-form-label-inline">发布对象</span>' +
      '<span style="flex:1;min-width:0;padding:0 10px;font-size:13px;color:#333">' + npEscape(txt) + '</span></div>';
  }

  function tnRenderTargetTree() {
    var box = document.getElementById('tn-tree-box'); if (!box) return;
    var searching = !!tnTreeQ;
    var tree = tnTreeFilter(tnTree, tnTreeQ);
    var html = '';
    // 有子节点的行显示折叠箭头：搜索时不折叠（保证结果可见）
    (function walk(nodes, depth, parentOpen) {
      nodes.forEach(function (n) {
        var hasKids = !!(n.children && n.children.length);
        var open = searching || tnNodeOpenState(n);
        if (!parentOpen) return;
        var st = tnSubtreeState(n);
        var caret = hasKids
          ? '<span class="tn-tree-caret' + (open ? ' open' : '') + '" onclick="tnTreeFold(\'' + n.key + '\')"></span>'
          : '';
        html += '<div class="ann-tnode" style="--lv:' + depth + '">' + caret +
          '<label class="ann-tlabel">' +
          '<input type="checkbox" id="tnck-' + n.key + '"' + (st === 'on' ? ' checked' : '') + ' onchange="tnTreeToggle(\'' + n.key + '\', this.checked)">' +
          '<span class="ann-tlabel-txt">' + npEscape(n.label) + '</span></label></div>';
        if (hasKids && open) walk(n.children, depth + 1, true);
      });
    })(tree, 0, true);
    box.innerHTML = html;
    // 半选态（含大区等分组节点）
    (function setInd(nodes) {
      nodes.forEach(function (n) {
        if (n.children && n.children.length && tnSubtreeState(n) === 'partial') {
          var cb = document.getElementById('tnck-' + n.key); if (cb) cb.indeterminate = true;
          setInd(n.children);
        } else if (n.children) { setInd(n.children); }
      });
    })(tree);
  }
  function tnResolveTreeIds() {
    // 发布对象粒度只到角色：树只用于「总部 / 总部角色」勾选，返回勾选的总部角色键（不再有人员节点）
    return Object.keys(tnTreeChecked);
  }
  // 由 target（keys / 旧结构 orgs/roles 兼容）回填：门店选择、门店角色选择、总部树勾选
  // 注：旧数据里的到人键（SX-/P-）不再回填——发布对象粒度止于角色，重新保存时自然收敛为角色级
  function tnRoleScope(rid) {
    var r = org().roleById ? org().roleById(rid) : null;
    if (r && r.scope) return r.scope;
    for (var i = 0; i < org().persons.length; i++) if (org().persons[i].roleId === rid) return org().persons[i].orgType;
    return '';
  }
  function tnInitCheckedFromTarget(target) {
    tnTreeChecked = {};
    tnSelStores = {}; tnSelRoles = {}; tnRoleNone = false;
    tnStoreMode = '';
    if (!target) return;
    function markHq(key) {
      var n = tnFindNode(tnTree, key); if (!n) return;
      var acc = tnTreeNodeKeys(n, {});
      Object.keys(acc).forEach(function (k) { tnTreeChecked[k] = 1; });
    }
    var keys = (target.keys || []).slice();
    (target.orgs || []).forEach(function (nm) { keys.push(nm === '总部' ? 'ORG-HQ' : 'ORG-STORES'); });
    (target.roles || []).forEach(function (rid) { keys.push('ROLE-' + rid); });
    // 判定门店范围模式：ORG-STORES 或旧"全门店角色"(ST-ROLE/ROLE→门店侧) = 全部门店；显式 STORE-* = 指定门店
    var wholeKey = false, partKey = false;
    keys.forEach(function (k) {
      var m;
      if (k === 'ORG-STORES') wholeKey = true;
      else if (/^ST-ROLE-(.+)$/.test(k)) wholeKey = true;
      else if ((m = /^ROLE-(.+)$/.exec(k)) && tnRoleScope(m[1]) === '门店') wholeKey = true;
      else if (/^STORE-(.+)$/.test(k)) partKey = true;
    });
    if (wholeKey) tnStoreMode = 'all';
    else if (partKey) tnStoreMode = 'part';
    keys.forEach(function (k) {
      var m;
      if (k === 'ORG-STORES') { return; }
      if ((m = /^STORE-(.+)$/.exec(k))) { if (tnStoreMode === 'part' && org().storeByCode(m[1])) tnSelStores[m[1]] = 1; return; }
      if ((m = /^RF-(.+)$/.exec(k))) { tnSelRoles[m[1]] = 1; return; }
      if ((m = /^ST-ROLE-(.+)$/.exec(k))) { tnSelRoles[m[1]] = 1; return; }
      if ((m = /^ROLE-(.+)$/.exec(k))) { if (tnRoleScope(m[1]) === '总部') markHq('HQ-ROLE-' + m[1]); return; }
      if (k === 'ORG-HQ') { markHq('ORG-HQ'); return; } // 整个总部 = 选上「总部」根行（= 总部角色全选）
      if ((m = /^HQ-ROLE-(.+)$/.exec(k))) { markHq('HQ-ROLE-' + m[1]); return; }
    });
  }

  // 【2026-09-18 删除】此处原有 09-05 遗留的被覆盖同名解析函数（旧口径：可勾到具体人员、可剔人），
  // 属"改口径时只追加新实现、没删旧址"的死代码（不可达）。发布对象解析只保留文件末尾那一份，
  // 且粒度已收敛为「门店范围 × 角色 / 总部角色」——不再支持到人。

  // 打开发布对象（新建/编辑/详情共用：构建总部树 + 回填 门店/角色/总部 勾选）
  function tnInitTargetPanel(a) {
    tnTree = tnBuildTargetTree();
    tnInitCheckedFromTarget(a && a.target);
  }

  // ============ 侧滑面板（复刻 配件主数据/技术支持 面板：新建/编辑/详情三态同壳） ============
  // 字段一律 ts 式「行内同框」：<div class="ts-form-item-inline"><span class="ts-form-label-inline">标签</span>控件</div>，
  // 标签文字嵌在带边框的输入框内左侧、值与控件在框内右侧；下拉全部用公共模糊下拉（.ts-combobox + gtCombobox*）。
  var panelRo = false; // 详情态 = 只读

  function tnFmValue(id) { return ((document.getElementById(id) || {}).value || ''); }

  // 行内同框字段构建（编辑/详情共用；ro 时给只读并填值）
  function tnField(label, id, val, opt) {
    opt = opt || {};
    var inp = '<input id="' + id + '" type="' + (opt.type || 'text') + '" value="' + (val !== undefined && val !== null ? npEscape(val) : '') + '"' +
      (opt.ph && !panelRo ? ' placeholder="' + npEscape(opt.ph) + '"' : '') +
      (opt.maxlen ? ' maxlength="' + opt.maxlen + '"' : '') +
      (panelRo ? ' readonly' : '') + '>';
    return '<div class="ts-form-item-inline plain' + (opt.required ? ' required' : '') + '"><span class="ts-form-label-inline">' + npEscape(label) + '</span>' + inp + '</div>';
  }
  // 行内同框文本域（全行，标签上、文本域在框外下——与技术面板 ts-form-item.full 一致）
  // opt: { ph: 空值灰字提示语, maxlen: 输入上限，超限不再接受输入 }
  function tnTextarea(label, id, val, opt) {
    opt = opt || {};
    return '<div class="ts-form-item full"><label class="ts-form-label">' + npEscape(label) + '</label>' +
      '<textarea id="' + id + '"' +
      (opt.ph && !panelRo ? ' placeholder="' + npEscape(opt.ph) + '"' : '') +
      (opt.maxlen ? ' maxlength="' + opt.maxlen + '"' : '') +
      (panelRo ? ' readonly' : '') + '>' + (val !== undefined && val !== null ? npEscape(val) : '') + '</textarea></div>';
  }
  // 单行同框字段（文字嵌框内；公告摘要用：默认占整行，传 span 参数可改为占指定列数，如 'span 3' 与「公告说明」同排）
  function tnSummaryField(label, id, val, span, opt) {
    opt = opt || {};
    return '<div class="ts-form-item-inline plain" style="grid-column:' + (span || '1/-1') + '"><span class="ts-form-label-inline">' + npEscape(label) + '</span>' +
      '<input id="' + id + '" type="text" value="' + (val !== undefined && val !== null ? npEscape(val) : '') + '"' +
      (opt.ph && !panelRo ? ' placeholder="' + npEscape(opt.ph) + '"' : '') +
      (opt.maxlen ? ' maxlength="' + opt.maxlen + '"' : '') +
      (panelRo ? ' readonly' : '') + '></div>';
  }
  // 行内同框模糊下拉（选项数组 = 值/文案同义，首项"请选择" data-val=""）
  function tnCombo(label, id, opts, val, opt) {
    opt = opt || {};
    var lis = '<li data-val="" onclick="tnFmCbSel(this)">请选择</li>' +
      (opts || []).map(function (o) { return '<li data-val="' + npEscape(o) + '" onclick="tnFmCbSel(this)">' + npEscape(o) + '</li>'; }).join('');
    var inner = (panelRo
      ? '<input id="' + id + '" value="' + (val ? npEscape(val) : '') + '" readonly>'
      : '<input id="' + id + '" value="' + (val ? npEscape(val) : '') + '" placeholder="请选择或输入" onfocus="gtComboboxShow(this)" oninput="gtComboboxFilter(this)">' +
        '<span class="cb-arrow" onclick="gtComboboxToggle(this)">▼</span>' +
        '<ul class="lt-datalist">' + lis + '</ul>');
    return '<div class="ts-form-item-inline ts-combobox' + (opt.required ? ' required' : '') + '" data-cb="' + id + '"><span class="ts-form-label-inline">' + npEscape(label) + '</span>' + inner + '</div>';
  }

  // 车系/车型联动字典：按 csSeed(common-stock) 口径；选车型自动带出车系
  var SERIES_MODELS = { '奕境S 2024款': [], '奕境X9': ['纯电版', '增程版'], '奕境X10': [], '奕境L7': ['PHEV', 'EV'] };
  var MODEL_SERIES = { '纯电版': '奕境X9', '增程版': '奕境X9', 'PHEV': '奕境L7', 'EV': '奕境L7' };

  window.tnFmCbSel = function (li) {
    if (panelRo) return;
    var w = gtCmbWrap(li); if (!w) return;
    var inp = w.querySelector('input'); var l = w.querySelector('.lt-datalist');
    if (inp) inp.value = cmbSelVal(li);
    if (l) { l.classList.remove('show'); l.querySelectorAll('li').forEach(function (x) { x.classList.remove('hidden'); }); }
    var id = (w.getAttribute && w.getAttribute('data-cb')) || '';
    if (id === 'tn-fm-model' && inp && inp.value && MODEL_SERIES[inp.value]) {
      var sEl = document.getElementById('tn-fm-series');
      if (sEl && !sEl.value) sEl.value = MODEL_SERIES[inp.value]; // 选车型 → 自动带出车系
    }
  };

  function tnOpenPanel(titleText, badgeText, badgeCls, bodyHtml, footerHtml, opts) {
    opts = opts || {};
    var ov = document.getElementById('tn-panel-overlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'tn-panel-overlay'; ov.className = 'pm-panel-overlay';
      ov.addEventListener('click', function (e) { if (e.target === ov) tnClosePanel(); });
      document.body.appendChild(ov);
    }
    var panel = document.getElementById('tn-panel');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'tn-panel'; panel.className = 'pm-panel tn-panel';
      panel.style.width = (opts.width || 1050) + 'px';
      panel.innerHTML = '<div class="pm-panel-header"><div style="display:flex;align-items:center">' +
        '<span class="pm-panel-title" id="tn-panel-title"></span><span class="pm-panel-badge" id="tn-panel-badge"></span></div>' +
        '<button class="pm-panel-close" onclick="tnClosePanel()">&#10005;</button></div>' +
        '<div class="pm-panel-body" id="tn-panel-body" style="scrollbar-gutter:stable"></div>' +
        '<div class="pm-panel-footer" id="tn-panel-footer"></div>';
      document.body.appendChild(panel);
    }
    ov.classList.add('show'); panel.classList.add('show');
    document.getElementById('tn-panel-title').textContent = titleText;
    var badge = document.getElementById('tn-panel-badge');
    badge.textContent = badgeText; badge.className = 'pm-panel-badge ' + badgeCls;
    document.getElementById('tn-panel-body').innerHTML = bodyHtml;
    document.getElementById('tn-panel-footer').innerHTML = footerHtml || '';
  }
  window.tnClosePanel = function () {
    var ov = document.getElementById('tn-panel-overlay'); if (ov) ov.classList.remove('show');
    var panel = document.getElementById('tn-panel'); if (panel) panel.classList.remove('show');
  };

  // ============ 正文富文本：空值灰字提示 + ≤10000 字符（约500字）上限 ============
  // 超限口径＝"直接不让再输入"：回滚到上一次合法内容，不弹提示、不改成必填。
  var TN_BODY_MAX = 10000;
  function tnBodyLen(el) { return ((el.innerText || el.textContent || '').replace(/\u00a0/g, ' ')).length; }
  // 空态判定：无文本且无图片/表格等非文本元素 → 显示灰字占位（取 data-ph）
  function tnEditorSyncEmpty(el) {
    var hasBlock = !!el.querySelector('img,table,hr,iframe');
    el.classList.toggle('is-empty', !hasBlock && !(el.textContent || '').trim());
  }
  window.tnEditorGuard = function (el) {
    if (!el || el.getAttribute('contenteditable') !== 'true') return;
    if (tnBodyLen(el) > TN_BODY_MAX) { el.innerHTML = el._tnLastHtml || ''; tnEditorSyncEmpty(el); return; }
    el._tnLastHtml = el.innerHTML;
    tnEditorSyncEmpty(el);
  };
  // 面板打开后绑定（新建/编辑用；详情只读不绑、也不显示占位）
  function tnBindEditorGuard() {
    var el = document.getElementById('tn-editor');
    if (!el || el.getAttribute('contenteditable') !== 'true') return;
    el._tnLastHtml = el.innerHTML;
    tnEditorSyncEmpty(el);
    el.addEventListener('input', function () { tnEditorGuard(el); });
    el.addEventListener('paste', function () { setTimeout(function () { tnEditorGuard(el); }, 0); });
    el.addEventListener('blur', function () { tnEditorSyncEmpty(el); });
  }

  // 新建/编辑共用的表单体（编辑时 a 传入；新增时 a=null；详情走 tnOpenDetail 只读重建）
  function tnFormHtml(a) {
    var typeOpts = ['TSI', 'TMI'];
    var subOpts = SUBTYPES;
    var serOpts = SERIES;
    var modOpts = MODELS;
    return '<div class="tn-form">' +
      // —— 基本信息字段组（无标题头；标题占 2 列在编号前；工厂在公告类型前；主故障件两项接在生产日期后补满剩余列）——
      '<div class="ts-form-grid col4">' +
      '<div class="ts-form-item-inline plain required" style="grid-column:span 2"><span class="ts-form-label-inline">公告标题</span>' +
      '<input id="tn-fm-title" value="' + (a ? npEscape(a.title) : '') + '"' + (panelRo ? ' readonly' : '') + '></div>' +
      '<div class="ts-form-item-inline plain"><span class="ts-form-label-inline">公告编号</span>' +
      '<input id="tn-fm-code" value="' + (a ? npEscape(a.code) : '') + '" readonly placeholder="保存后自动生成"></div>' +
      tnField('工厂', 'tn-fm-factory', a ? a.factory : '') +
      tnCombo('公告类型', 'tn-fm-type', typeOpts, a ? a.type : '', { required: true }) +
      tnCombo('公告子类', 'tn-fm-subtype', subOpts, a ? a.subtype : '', { required: true }) +
      tnField('技术议题编号', 'tn-fm-tissue', a ? a.techIssueNo : '') +
      tnField('技术议题标题', 'tn-fm-tistitle', a ? a.techIssueTitle : '') +
      tnCombo('车系', 'tn-fm-series', serOpts, a ? a.series : '', { required: true }) +
      tnCombo('车型', 'tn-fm-model', modOpts, a ? a.model : '') +
      tnFlField(a) +
      // 故障描述1~5：空值灰字提示「≤50字」，输入上限 50 字
      tnField('故障描述1', 'tn-fm-d1', a ? a.fdesc1 : '', { ph: '≤50字', maxlen: 50 }) + tnField('故障描述2', 'tn-fm-d2', a ? a.fdesc2 : '', { ph: '≤50字', maxlen: 50 }) +
      tnField('故障描述3', 'tn-fm-d3', a ? a.fdesc3 : '', { ph: '≤50字', maxlen: 50 }) + tnField('故障描述4', 'tn-fm-d4', a ? a.fdesc4 : '', { ph: '≤50字', maxlen: 50 }) +
      tnField('故障描述5', 'tn-fm-d5', a ? a.fdesc5 : '', { ph: '≤50字', maxlen: 50 }) +
      tnField('生产日期开始', 'tn-fm-prod-start', a ? a.prodStart : '', { type: 'date' }) +
      tnField('生产日期结束', 'tn-fm-prod-end', a ? a.prodEnd : '', { type: 'date' }) +
      tnMainPartCodeField(a) +
      '<div class="ts-form-item-inline plain"><span class="ts-form-label-inline">主故障件名称</span>' +
      '<input id="tn-fm-mname" value="' + (a ? npEscape(a.mainPartName) : '') + '" readonly placeholder="选择编码后自动带出"></div>' +
      '</div>' +
      // —— 长文本组：公告说明(下拉，非必填，放前面) 与 公告摘要(单行占3列) 同排；故障条件/维修方案 仍为多行文本域 ——
      '<div class="ts-form-grid col4">' +
      tnCombo('公告说明', 'tn-fm-note', NOTE_TYPES, a ? a.noticeDesc : '') +
      tnSummaryField('公告摘要', 'tn-fm-summary', a ? a.summary : '', 'span 3', { ph: '≤100字', maxlen: 100 }) +
      tnTextarea('故障条件及现象', 'tn-fm-fcond', a ? a.faultCondition : '', { ph: '≤100字', maxlen: 100 }) +
      tnTextarea('检查过程及维修方案', 'tn-fm-repair', a ? a.repairPlan : '', { ph: '≤100字', maxlen: 100 }) +
      '</div>' +
      // —— 发布对象组织树（定时发布已移除；正文与附件在最后）——
      (panelRo ? targetPanelRoHtml(a) : targetPanelHtml()) +
      // —— 正文（必填）与附件 ——
      '<div class="ts-form-item full' + (panelRo ? '' : ' required') + ' tn-body-block"><label class="ts-form-label">正文</label>' +
      '<div class="tn-editor">' + (panelRo ? '' : editorToolbarHtml()) +
      '<div class="tn-editor-body' + (panelRo ? '' : (a && a.bodyHtml ? '' : ' is-empty')) + '" id="tn-editor"' +
      (panelRo ? '' : ' contenteditable="true" data-ph="≤10000字符（约500字）"') + '>' + (a ? a.bodyHtml : '') + '</div></div></div>' +
      '<div class="tn-attach">' + (panelRo ? '' : '<button class="lt-btn lt-btn-default" onclick="document.getElementById(\'tn-file-input\').click()">上传附件</button>') +
      '<input type="file" id="tn-file-input" multiple style="display:none" onchange="tnHandleFiles(this.files)"><div class="tn-attach-list" id="tn-attach-list"></div></div>' +
      '</div>';
  }

  // 主故障件编码：文本+弹窗搜索（与技术支持一致）；点编码弹出配件选择，选中后自动带出名称（只读）
  function tnMainPartCodeField(a) {
    var val = a ? a.mainPartCode : '';
    if (panelRo) {
      return '<div class="ts-form-item-inline plain"><span class="ts-form-label-inline">主故障件编码</span>' +
        '<input id="tn-fm-mcode" value="' + (val ? npEscape(val) : '') + '" readonly></div>';
    }
    return '<div class="ts-form-item-inline plain ts-form-search" style="cursor:pointer" onclick="tnPickPartCode()">' +
      '<span class="ts-form-label-inline">主故障件编码</span>' +
      '<input id="tn-fm-mcode" readonly placeholder="点击选择配件" style="cursor:pointer">' +
      '<svg class="ts-form-search-icon" viewBox="0 0 16 16" fill="none" onclick="event.stopPropagation();tnPickPartCode()"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg></div>';
  }
  // 主故障件 选择列表（参照 技术支持 的 mock 配件；选中带出 编码+名称）
  var TN_PART_POOL = [
    { code: 'PJ-00128', name: '高压线束总成' },
    { code: 'PJ-00245', name: '电子水泵' },
    { code: 'PJ-00371', name: '电机控制器' },
    { code: 'PJ-00402', name: '制动踏板总成' },
    { code: 'PJ-00518', name: '动力电池模组' },
    { code: 'PJ-00623', name: '压缩机总成' }
  ];
  window.tnPickPartCode = function () {
    if (panelRo) return;
    var rows = TN_PART_POOL.map(function (p, i) {
      return '<tr style="cursor:pointer" onclick="tnPickPart(' + i + ')"><td>' + p.code + '</td><td>' + npEscape(p.name) + '</td></tr>';
    }).join('');
    npOpenModal('选择主故障件', '<div class="lt-table-wrap"><table class="lt-table"><thead><tr>' +
      npTH([{ t: '编码', w: 140 }, { t: '名称' }]) + '</tr></thead><tbody>' + rows + '</tbody></table></div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>', { width: 560 });
  };
  window.tnPickPart = function (i) {
    var p = TN_PART_POOL[i]; if (!p) return;
    var c = document.getElementById('tn-fm-mcode'); if (c) c.value = p.code;
    var n = document.getElementById('tn-fm-mname'); if (n) n.value = p.name;
    npCloseModal();
  };

  // 故障部位 = 弹窗选择（2026-09-03 十四轮拍板；2026-09-04 按全站既有单选弹框样式重做：.lt-table 首列「选」radio + 关键字过滤 + 取消/确定）；
  // 选项实时取故障部位字典中「启用」项，选中后仅名称回填/存储（列表列、详情、必填校验口径不变，字段 id 仍为 tn-fm-fl）
  function tnFlField(a) {
    var val = a ? (a.faultLocation || '') : '';
    if (panelRo) {
      return '<div class="ts-form-item-inline plain required"><span class="ts-form-label-inline">故障部位</span>' +
        '<input id="tn-fm-fl" value="' + npEscape(val) + '" readonly></div>';
    }
    return '<div class="ts-form-item-inline plain required ts-form-search" style="cursor:pointer" onclick="tnPickFaultLocation()">' +
      '<span class="ts-form-label-inline">故障部位</span>' +
      '<input id="tn-fm-fl" value="' + npEscape(val) + '" readonly placeholder="点击选择故障部位" style="cursor:pointer">' +
      '<svg class="ts-form-search-icon" viewBox="0 0 16 16" fill="none" onclick="event.stopPropagation();tnPickFaultLocation()"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg></div>';
  }
  // 故障部位选择弹窗（单选；样式同全站既有单选弹框——.lt-table + 首列「选」radio + 规范查询行 + 取消/确定）
  // 打开时预选当前已存值；点「确定」才回填字段（名称口径不变）；选项实时取字典启用项。
  var flPickState = { picked: '', filtered: [] };
  function flEnabledItems() { return flDict().filter(function (f) { return f.status !== '停用'; }); }

  window.tnPickFaultLocation = function () {
    if (panelRo) return;
    var all = flEnabledItems();
    if (!all.length) { npToast('故障部位字典为空，请先在「售后管理→参考系→故障部位」维护'); return; }
    flPickState.picked = tnFmValue('tn-fm-fl') || ''; // 编辑态预选当前已存值
    flPickState.filtered = all;
    npOpenModal('选择故障部位',
      // 规范查询行：查询项（编码/名称）+ 行末列「查询/重置」（右对齐，同 阅读情况 弹窗查询行）
      '<div class="lt-filter" style="margin-bottom:6px">' +
      '<div class="lt-filter-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;">' +
      npFItem('编码', '<input id="tn-fl-code" placeholder="编码关键字">') +
      npFItem('名称', '<input id="tn-fl-name" placeholder="名称关键字">') +
      '<div style="grid-column:3/-1;display:flex;justify-content:flex-end;align-items:center;gap:8px;">' +
      '<button class="lt-btn lt-btn-primary" onclick="tnFlRender()">查询</button>' +
      '<button class="lt-btn lt-btn-default" onclick="tnFlClear()">重置</button>' +
      '</div></div></div>' +
      '<div class="lt-table-wrap" style="max-height:300px;overflow:auto;"><table class="lt-table"><thead><tr>' +
      npTH([{ t: '', w: 40 }, { t: '编码', w: 100 }, { t: '名称' }, { t: '状态', w: 80 }]) +
      '</tr></thead><tbody id="tn-fl-tbody"></tbody></table></div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="tnFlConfirm()">确定</button>',
      { width: 940 }); // 宽度对齐参照「选择销货单」弹窗(940)，保证查询项 4 等分列宽与全站一致
    tnFlRender();
  };
  window.tnFlRender = function () {
    var tbody = document.getElementById('tn-fl-tbody'); if (!tbody) return;
    var cEl = document.getElementById('tn-fl-code');
    var nEl = document.getElementById('tn-fl-name');
    var c = cEl ? (cEl.value || '').trim().toLowerCase() : '';
    var n = nEl ? (nEl.value || '').trim().toLowerCase() : '';
    var all = flEnabledItems();
    flPickState.filtered = all.filter(function (f) {
      return (!c || f.code.toLowerCase().indexOf(c) >= 0) && (!n || f.name.toLowerCase().indexOf(n) >= 0);
    });
    tbody.innerHTML = flPickState.filtered.map(function (f, i) {
      var sel = f.name === flPickState.picked;
      return '<tr style="cursor:pointer" onclick="tnFlPick(' + i + ')">' +
        '<td><input type="radio" name="tn-fl-r"' + (sel ? ' checked' : '') + ' onclick="event.stopPropagation()"></td>' +
        '<td>' + npEscape(f.code) + '</td><td>' + npEscape(f.name) + '</td>' +
        '<td>' + (f.status === '启用' ? '<span class="lt-badge ok">启用</span>' : '<span class="lt-badge off">停用</span>') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:#999;padding:24px;">没有匹配的故障部位</td></tr>';
  };
  window.tnFlClear = function () {
    var cEl = document.getElementById('tn-fl-code'); if (cEl) cEl.value = '';
    var nEl = document.getElementById('tn-fl-name'); if (nEl) nEl.value = '';
    tnFlRender();
  };
  window.tnFlPick = function (i) {
    var f = flPickState.filtered[i]; if (!f) return;
    flPickState.picked = f.name;
    var tbody = document.getElementById('tn-fl-tbody');
    if (tbody) {
      tbody.querySelectorAll('input[name="tn-fl-r"]').forEach(function (r, ri) { r.checked = (ri === i); });
    }
  };
  window.tnFlConfirm = function () {
    if (!flPickState.picked) { npToast('请先选择故障部位'); return; }
    var inp = document.getElementById('tn-fm-fl'); if (inp) inp.value = flPickState.picked;
    npCloseModal();
  };

  // 打开 新建 / 编辑（同一面板壳；标题+徽标区分）
  function tnOpenFormPanel(id) {
    editingId = id || null;
    panelRo = false;
    var a = id ? findAnn(id) : null;
    tnInitTargetPanel(a);
    formAttachments = a && a.attachments ? a.attachments.slice() : [];
    // 编号不预览：新建未提交不产生编号，提交保存时在 tnSave 中生成
    // 未发布-曾发布过（取消发布产物）→ 按钮「保存并发布」；未曾发布（草稿/新建）→ 「保存」
    var pubNow = !!(a && a.publishedBefore);
    var foot = '<button class="lt-btn lt-btn-default" onclick="tnClosePanel()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="tnSave(' + (pubNow ? 'true' : '') + ')">' + (pubNow ? '保存并发布' : '保存') + '</button>';
    tnOpenPanel(id ? '编辑技术公告' : '新建技术公告', id ? '编辑' : '新增', id ? 'edit' : 'add', tnFormHtml(a), foot, { width: 1050 });
    tnRenderTargetTree();
    tnStoreModeRender();
    tnSyncStoreInput();
    tnRoleRender();
    tnRefreshTarget();
    tnBindEditorGuard();
    renderAttach();
  }
  window.tnOpenForm = tnOpenFormPanel;

  window.tnSave = function (publishNow) {
    function v(id) { return ((document.getElementById(id) || {}).value || ''); }
    var title = v('tn-fm-title').trim(), type = v('tn-fm-type'), subtype = v('tn-fm-subtype'), series = v('tn-fm-series'), fl = v('tn-fm-fl');
    if (!title) { alert('请填写公告标题'); return; }
    if (!type) { alert('请选择公告类型'); return; }
    if (!subtype) { alert('请选择公告子类'); return; }
    if (!series) { alert('请选择车系'); return; }
    if (!fl) { alert('请选择故障部位'); return; }
    var bodyText = ((document.getElementById('tn-editor') || {}).innerHTML || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!bodyText) { alert('请填写正文'); return; }
    var a = editingId ? findAnn(editingId) : null;
    var newCode = a ? a.code : genCode(); // 编号不预览：保存时才生成并占用（当天流水）
    // 只有「未发布」可编辑。曾发布过（取消发布产物）→「保存并发布」＝保存即重新发布为「已发布+已更新」；
    // 未曾发布（草稿/新建）→「保存」＝保存后仍为「未发布」，不打「已更新」（首次发布也不带）。
    var status = '未发布';
    var publishedBefore = a ? !!a.publishedBefore : false;
    var republishNow = !!(publishNow && a && a.publishedBefore);
    // 发布对象 = 门店(范围×角色) + 总部(总部全员/总部角色) 并集；粒度止于角色；发布/保存不生成接收人快照，阅读情况按发布对象实时解析
    var tgtKeys = tnCurrentKeys();
    var tgtInfo = tnTargetInfoOf({ target: { keys: tgtKeys } });
    if (!tgtInfo.persons.length) { alert('请选择发布对象（至少勾选门店/门店角色，或总部）'); return; }
    var data = {
      id: a ? a.id : newCode,
      code: a ? a.code : newCode,
      title: title, type: type, subtype: subtype, factory: v('tn-fm-factory'),
      techIssueNo: v('tn-fm-tissue'), techIssueTitle: v('tn-fm-tistitle'),
      series: series, model: v('tn-fm-model'), faultLocation: fl,
      fdesc1: v('tn-fm-d1'), fdesc2: v('tn-fm-d2'), fdesc3: v('tn-fm-d3'), fdesc4: v('tn-fm-d4'), fdesc5: v('tn-fm-d5'),
      prodStart: v('tn-fm-prod-start'), prodEnd: v('tn-fm-prod-end'),
      summary: v('tn-fm-summary'), noticeDesc: v('tn-fm-note'), mainPartCode: v('tn-fm-mcode'), mainPartName: v('tn-fm-mname'),
      faultCondition: v('tn-fm-fcond'), repairPlan: v('tn-fm-repair'),
      bodyHtml: (document.getElementById('tn-editor') || {}).innerHTML || '',
      attachments: formAttachments.slice(),
      target: { keys: tgtKeys },
      status: status,
      updated: a ? !!a.updated : false, publishedBefore: publishedBefore,
      readByMe: a ? a.readByMe : false, downloadedByMe: a ? a.downloadedByMe : false,
      publisher: a ? a.publisher : (window.gUserRole === '超级管理员' ? '超级管理员' : '总部管理员'),
      publishTime: a ? a.publishTime : '',
      reads: a ? (a.reads || {}) : {} // 已读/下载记录（阅读情况实时读取）；无接收人快照
    };
    if (a) { var idx = -1; for (var i = 0; i < NP[K].allData.length; i++) if (NP[K].allData[i].id === editingId) idx = i; if (idx >= 0) NP[K].allData[idx] = data; }
    else { NP[K].allData.unshift(data); }
    if (republishNow) { data.status = '已发布'; data.publishTime = npNowLocal(); data.updated = true; }
    tnClosePanel();
    tnQuery();
    npToast(republishNow ? '已保存并发布' : '已保存');
  };

  // 当前面板已选发布对象 → 解析出的接收人（粒度止于角色，人员由「门店范围×角色 / 总部角色」展开而来）
  function resolveTargetPersons() { return tnTargetInfoOf({ target: { keys: tnCurrentKeys() } }).persons; }

  // ===== 详情（同一侧滑面板只读态：字段与新建/编辑一致，全部只读置灰） =====
  window.tnOpenDetail = function (id) {
    var a = findAnn(id); if (!a) return;
    a.readByMe = true;
    panelRo = true;
    editingId = id || null;
    tnInitTargetPanel(a);
    formAttachments = a && a.attachments ? a.attachments.slice() : [];
    // 详情底部无操作栏（右上角 X / 遮罩点击关闭）
    tnOpenPanel('技术公告详情', '详情', 'detail', tnFormHtml(a), '', { width: 1050 });
    renderAttach();
    tnQuery(); // 打开详情即标记本人已读 → 刷新列表「是否已读」
  };
  window.tnDownload = function (id) {
    var a = findAnn(id); if (a) { a.downloadedByMe = true; }
    npToast('附件下载（演示）');
    renderAttach();
  };

  // ===== 阅读情况（按发布对象实时解析人员 + 每条公告的已读记录；只列「已读」的人） =====
  var readState = { aid: '', page: 1, pageSize: 20, qName: '', qDown: '', filtered: [] };
  function tnReadRows(a) {
    var info = tnTargetInfoOf(a);
    var reads = (a && a.reads) || {};
    return info.persons.map(function (p) {
      var st = reads[p.personId] || { read: false, readTime: '', downloaded: false, downloadTime: '' };
      return { p: p, st: st };
    }).filter(function (x) { return x.st.read === true; });
  }
  window.tnOpenRead = function (id) {
    var a = findAnn(id); if (!a) return;
    readState.aid = id; readState.page = 1; readState.qName = ''; readState.qDown = '';
    var rows = tnReadRows(a);
    var readN = rows.length;
    var downN = rows.filter(function (x) { return x.st.downloaded; }).length;
    var html = '<div class="tn-read">' +
      // 查询项行：人员 / 是否已下载；查询/重置 放该行最后一列（右对齐）
      '<div class="lt-filter" style="margin-bottom:6px"><div class="lt-filter-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));align-items:center">' +
      npFItem('人员', '<input type="text" id="tn-read-qname" placeholder="姓名/人员ID关键字" oninput="tnReadQuery()">') +
      npFItem('是否已下载', '<select id="tn-read-qdown" onchange="tnReadQuery()"><option value="">请选择</option><option>已下载</option><option>未下载</option></select>') +
      '<div class="tn-read-querybtns">' +
      '<button class="lt-btn lt-btn-primary" onclick="tnReadQuery()">查询</button>' +
      '<button class="lt-btn lt-btn-default" onclick="tnReadReset()">重置</button>' +
      '</div>' +
      '</div></div>' +
      // 列表（表格）左上角工具栏：导出在最左，旁边留距显示 已读/已下载 汇总
      '<div class="tn-read-toolbar">' +
      '<button class="lt-btn lt-btn-default" onclick="tnReadExport()">导出</button>' +
      '<span class="tn-read-summary"><span class="tn-read-stat">已读 <b>' + readN + '</b> 人</span>' +
      '<span class="tn-read-stat">已下载 <b>' + downN + '</b> 份</span></span>' +
      '</div>' +
      '<div class="lt-table-wrap" style="max-height:340px;"><table class="lt-table"><thead><tr>' +
      npTH([{ t: '序号', w: 50 }, { t: '人员', w: 180 }, { t: '所属组织', w: 200 }, { t: '角色', w: 160 }, { t: '已读/未读', w: 90 }, { t: '阅读时间', w: 150 }, { t: '是否已下载', w: 110 }]) +
      '</tr></thead><tbody id="tn-read-tbody"></tbody></table></div>' +
      '<div class="lt-pager" id="tn-read-pager"><div class="lt-pager-left"><span class="pager-total">共 0 条</span></div>' +
      '<div class="lt-pager-right"><button class="pg-prev">上一页</button><span class="pg-pages"></span><button class="pg-next">下一页</button>' +
      '<div class="pager-goto">前往 <input type="text"> 页</div><select class="pager-size"><option value="10">10条/页</option><option value="20" selected>20条/页</option><option value="50">50条/页</option><option value="100">100条/页</option></select></div></div>' +
      '</div>';
    npOpenModal('阅读情况 — ' + a.title, html, '', { width: 960 }); // 底部无按钮，右上角 X 关闭
    renderReadTable();
  };
  window.tnReadQuery = function () {
    readState.qName = ((document.getElementById('tn-read-qname') || {}).value || '');
    readState.qDown = ((document.getElementById('tn-read-qdown') || {}).value || '');
    readState.page = 1;
    renderReadTable();
  };
  window.tnReadReset = function () {
    var n = document.getElementById('tn-read-qname'); if (n) n.value = '';
    var d = document.getElementById('tn-read-qdown'); if (d) d.value = '';
    readState.qName = ''; readState.qDown = ''; readState.page = 1;
    renderReadTable();
  };
  // 阅读记录导出（Excel）：导出当前筛选后的「已读」列表（列与表格一致）
  window.tnReadExport = function () {
    var a = findAnn(readState.aid); if (!a) return;
    var rows = readState.filtered || [];
    var data = rows.map(function (x, i) {
      return [i + 1, x.p.name + '(' + x.p.personId + ')', x.p.orgLabel,
        x.p.roleName + '(' + x.p.roleId + ')', '已读', x.st.readTime || '—', x.st.downloaded ? '已下载' : '未下载'];
    });
    npExportExcelRowsRaw('阅读情况_' + a.code + '_' + a.title,
      ['序号', '人员', '所属组织', '角色', '已读/未读', '阅读时间', '是否已下载'], data);
  };
  function renderReadTable() {
    var a = findAnn(readState.aid); if (!a) return;
    var rows = tnReadRows(a);
    var q = readState.qName.trim().toLowerCase();
    if (q) rows = rows.filter(function (x) { return (x.p.name || '').toLowerCase().indexOf(q) >= 0 || x.p.personId.toLowerCase().indexOf(q) >= 0; });
    if (readState.qDown === '已下载') rows = rows.filter(function (x) { return x.st.downloaded; });
    else if (readState.qDown === '未下载') rows = rows.filter(function (x) { return !x.st.downloaded; });
    readState.filtered = rows;
    var tb = document.getElementById('tn-read-tbody'); if (!tb) return;
    var pages = Math.max(1, Math.ceil(readState.filtered.length / readState.pageSize));
    if (readState.page > pages) readState.page = pages;
    if (readState.page < 1) readState.page = 1;
    var start = (readState.page - 1) * readState.pageSize;
    var slice = readState.filtered.slice(start, start + readState.pageSize);
    var html = '';
    slice.forEach(function (x, idx) {
      html += '<tr><td>' + (start + idx + 1) + '</td>' +
        '<td>' + npEscape(x.p.name + '(' + x.p.personId + ')') + '</td>' +
        '<td>' + npEscape(x.p.orgLabel) + '</td>' +
        '<td>' + npEscape(x.p.roleName + '(' + x.p.roleId + ')') + '</td>' +
        '<td><span class="lt-badge ok">已读</span></td>' +
        '<td>' + npEscape(x.st.readTime || '—') + '</td>' +
        '<td>' + (x.st.downloaded ? '<span class="lt-badge ok">已下载</span>' : '<span class="lt-badge off">未下载</span>') + '</td></tr>';
    });
    if (!slice.length) html = '<tr><td colspan="7" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    tb.innerHTML = html;
    var pager = document.getElementById('tn-read-pager');
    if (pager) {
      npRenderPager(pager, {
        page: readState.page, pageSize: readState.pageSize, total: readState.filtered.length,
        go: function (p) { readState.page = p; renderReadTable(); },
        size: function (v) { readState.pageSize = v; readState.page = 1; renderReadTable(); }
      });
    }
  }

  window.initTechNotice = function () {
    buildShell();
    NP[K]._fShow = 7;
    NP[K]._fExp = false;
    NP[K].query = tnQuery;   // npComboboxSelect 选值后按 data-k 触发 NP[K].query
    initFilterGrid('tech-notice-filterGrid', 7);
    npInitComboboxes();      // combobox 由 buildShell 新建（晚于 showContent 的全局注入），需补一次 × 注入
    tnQuery();
  };

  // ===== 发布对象（2026-09-05 新口径；2026-09-18 用户拍板：粒度只到角色，不再到人）=====
  // 门店 = 门店范围 × 角色：ORG-STORES（全部门店，动态含以后新增）或 STORE-<店code>（指定门店固定清单），
  //        可选 RF-<角色id> 收窄（无 RF = 该范围内全员）。
  // 总部 = ORG-HQ（整个总部）或 HQ-ROLE-<角色id>（总部角色）。
  // 兼容旧键：ST-ROLE-*/ROLE-*（门店侧=全部门店×该角色）、orgs/roles 旧结构。
  // 不再支持：SX-<人员id>（门店剔人）、P-<人员id>（到人）——发布对象粒度止于角色。
  function tnTargetInfoOf(a) {
    var o = org();
    var t = (a && a.target) || {};
    var key = {};
    (t.keys || []).forEach(function (k) { key[k] = 1; });
    (t.orgs || []).forEach(function (nm) { key[nm === '总部' ? 'ORG-HQ' : 'ORG-STORES'] = 1; });
    (t.roles || []).forEach(function (rid) { key['ROLE-' + rid] = 1; });
    var REGION_ORDER = ['华东', '华南', '华北', '西南', '东北', '华中'];
    function storeOf(code) { for (var i = 0; i < o.stores.length; i++) if (o.stores[i].code === code) return o.stores[i]; return null; }
    function roleIdx(rid) { for (var i = 0; i < o.roles.length; i++) if (o.roles[i].id === rid) return i; return 999; }
    function roleName(rid) { var r = o.roleById ? o.roleById(rid) : null; return r ? r.name + '(' + r.id + ')' : rid; }  // 文案里的角色一律带角色ID（2026-09-18 用户要求，与勾选区/阅读情况口径一致）

    // —— 键分类：只有「门店范围 / 角色 / 总部」，没有人员键 ——
    var storeWhole = !!key['ORG-STORES'];
    var storeCodes = [];
    var roleF = {};
    var hqWhole = !!key['ORG-HQ'];
    var hqRoles = {};
    Object.keys(key).forEach(function (k) {
      var m;
      if ((m = /^STORE-(.+)$/.exec(k))) { var s0 = storeOf(m[1]); if (s0 && storeCodes.indexOf(s0.code) < 0) storeCodes.push(s0.code); return; }
      if ((m = /^RF-(.+)$/.exec(k))) { roleF[m[1]] = 1; return; }
      if ((m = /^ST-ROLE-(.+)$/.exec(k))) { roleF[m[1]] = 1; storeWhole = true; return; }
      if ((m = /^HQ-ROLE-(.+)$/.exec(k))) { hqRoles[m[1]] = 1; return; }
      if ((m = /^ROLE-(.+)$/.exec(k))) {
        var st = null; for (var i = 0; i < o.persons.length; i++) if (o.persons[i].roleId === m[1]) { st = o.persons[i].orgType; break; }
        if (st === '门店') { roleF[m[1]] = 1; storeWhole = true; } else if (st === '总部') { hqRoles[m[1]] = 1; }
        return;
      }
    });
    var roleFIds = Object.keys(roleF).sort(function (x, y) { return roleIdx(x) - roleIdx(y); });

    // —— 门店人员：由「门店范围 × 角色」展开，仅用于人数统计与阅读情况（不是选择粒度）——
    var stPersons = [];
    var storeActive = storeWhole || storeCodes.length;
    if (storeActive) {
      if (storeWhole) stPersons = o.persons.filter(function (p) { return p.orgType === '门店'; });
      else stPersons = o.persons.filter(function (p) { return p.orgType === '门店' && storeCodes.indexOf(p.storeCode) >= 0; });
      if (roleFIds.length) stPersons = stPersons.filter(function (p) { return roleF[p.roleId]; });
    }
    // —— 总部人员：由「整个总部 / 总部角色」展开 ——
    var hqSet = {};
    function addHq(p) { if (p && p.orgType === '总部') hqSet[p.personId] = p; }
    if (hqWhole) { o.persons.forEach(function (p) { addHq(p); }); }
    Object.keys(hqRoles).forEach(function (rid) { o.persons.forEach(function (p) { if (p.roleId === rid) addHq(p); }); });
    var hqPersons = Object.keys(hqSet).map(function (pid) { return hqSet[pid]; });

    // —— 文案：整侧 / 门店清单 / 门店×角色 / 总部角色（不含按人粒度的档位）——
    var segs = [];
    if (storeActive) {
      var storeTxt;
      if (storeWhole) storeTxt = '全部';
      else if (storeCodes.length) {
        if (storeCodes.length <= 6) {
          storeTxt = storeCodes.map(function (c) { var s = storeOf(c); return s ? (s.name + '(' + s.code + ')') : c; }).join('、');
        } else {
          var regionN = {}, otherN = 0;
          storeCodes.forEach(function (c) { var s = storeOf(c); var r = (s && s.region) ? s.region : '其他'; if (REGION_ORDER.indexOf(r) >= 0) regionN[r] = (regionN[r] || 0) + 1; else otherN++; });
          var rp = REGION_ORDER.filter(function (r) { return regionN[r]; }).map(function (r) { return r + regionN[r] + '家'; });
          if (otherN) rp.push('其他' + otherN + '家');
          storeTxt = rp.join('、') + '，共' + storeCodes.length + '家';
        }
      } else storeTxt = '全部';
      var roleTxt = roleFIds.length ? roleFIds.map(roleName).join('、') : '';
      if (roleTxt) segs.push('门店（' + storeTxt + '）·角色：' + roleTxt);
      else segs.push(storeWhole ? '门店' : '门店（' + storeTxt + '）');
    }
    if (hqWhole) {
      segs.push('总部');
    } else if (Object.keys(hqRoles).length) {
      var names = Object.keys(hqRoles).sort(function (x, y) { return roleIdx(x) - roleIdx(y); }).map(roleName);
      segs.push('总部（' + names.join('、') + '）');
    }

    var seen = {}, persons = stPersons.concat(hqPersons).filter(function (p) { if (seen[p.personId]) return false; seen[p.personId] = 1; return true; });
    persons.sort(function (x, y) {
      if (x.orgType !== y.orgType) return x.orgType === '门店' ? -1 : 1;
      if (x.roleId !== y.roleId) return roleIdx(x.roleId) - roleIdx(y.roleId);
      return x.name < y.name ? -1 : 1;
    });
    // 展示增强：阅读情况/详情需要 所属组织、角色名 等字段
    persons = persons.map(function (p) {
      var role = o.roleById ? o.roleById(p.roleId) : null;
      var storeName = p.orgType === '总部' ? '总部' : (((o.storeByCode ? o.storeByCode(p.storeCode) : null) || {}).name) || p.storeCode;
      return {
        personId: p.personId, name: p.name, orgType: p.orgType, storeCode: p.storeCode,
        storeName: storeName, roleId: p.roleId, roleName: role ? role.name : '',
        orgLabel: p.orgType === '总部' ? '总部' : storeName + '(' + p.storeCode + ')'
      };
    });
    return { persons: persons, text: segs.length ? segs.join('，') : '—' };
  }

  // 测试钩子（纯函数）
  window.TN_API = { genCode: genCode, resolveTargetPersons: resolveTargetPersons, tnTargetInfoOf: tnTargetInfoOf, tnReadRows: tnReadRows };

  npRegisterModuleInit('tech-notice', function () { initTechNotice(); });
})();
