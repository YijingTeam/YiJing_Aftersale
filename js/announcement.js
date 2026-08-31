// =====================================================================
// 技术公告（系统设置）—— 总部发布、门店/总部查看、阅读情况跟踪
// 数据源：ORG_MASTER（org-master.js）组织/角色/人员主数据。
// 阅读情况按用户口径：静态快照，列 = 角色 / 人员 / 已读未读 / 查阅时间（精确到秒）。
// =====================================================================
(function () {
  var K = 'announcement';
  NP[K] = { page: 1, pageSize: 20, allData: [], filtered: [], render: null, query: null, reset: null };

  function org() { return window.ORG_MASTER || { roles: [], stores: [], persons: [], roleById: function(){return null;}, storeByCode: function(){return null;}, roleLabel: function(r){return r;} }; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isHq() { var r = window.gUserRole || '门店'; return r === '总部' || r === '超级管理员'; }

  // ===== 纯函数（可测） =====
  function annHash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h; }

  function subtreeState(node, checked) {
    if (!node.children || !node.children.length) return checked[node.key] ? 'on' : 'off';
    var any = false, all = true;
    node.children.forEach(function (c) {
      var s = subtreeState(c, checked);
      if (s !== 'off') any = true;
      if (s !== 'on') all = false;
    });
    return all ? 'on' : (any ? 'partial' : 'off');
  }

  function resolvePersons(tree, checked) {
    var ids = [];
    (function walk(nodes) {
      nodes.forEach(function (n) {
        if (n.type === 'person') { if (checked[n.key]) ids.push(n.personId); }
        else if (n.children) walk(n.children);
      });
    })(tree);
    return ids;
  }

  function buildTargetTree() {
    var o = org();
    function personNode(p) { return { key: 'P-' + p.personId, type: 'person', label: p.name + '(' + p.personId + ')', personId: p.personId }; }
    function roleNodesFor(persons, prefix) {
      var out = [];
      o.roles.forEach(function (role) {
        var ps = persons.filter(function (p) { return p.roleId === role.id; });
        if (ps.length) out.push({ key: prefix + role.id, type: 'role', label: role.name + '(' + role.id + ')', children: ps.map(personNode) });
      });
      return out;
    }
    var hqPersons = o.persons.filter(function (p) { return p.orgType === '总部'; });
    function buildRegions() {
      var regions = {};
      o.stores.forEach(function (s) { var r = s.region || '其他'; if (!regions[r]) regions[r] = []; regions[r].push(s); });
      var order = ['华东', '华南', '华北', '西南', '东北', '华中'];
      var out = [];
      order.concat(Object.keys(regions).filter(function (r) { return order.indexOf(r) === -1; })).forEach(function (r) {
        var list = regions[r]; if (!list || !list.length) return;
        out.push({ key: 'REGION-' + r, type: 'region', label: r, children: list.map(function (s) {
          var sp = o.persons.filter(function (p) { return p.storeCode === s.code; });
          return { key: 'S-' + s.code, type: 'store', label: s.name + '(' + s.code + ')', children: roleNodesFor(sp, 'SR-' + s.code + '-') };
        })});
      });
      return out;
    }
    return [
      { key: 'ORG-HQ', type: 'org', label: '总部', children: roleNodesFor(hqPersons, 'HQ-ROLE-') },
      { key: 'ORG-STORES', type: 'org', label: '门店', children: buildRegions() }
    ];
  }

  function shiftSeconds(dtStr, secs) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(dtStr);
    if (!m) return dtStr;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    d = new Date(d.getTime() + secs * 1000);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function makeRecipients(personIds) {
    var o = org();
    return personIds.map(function (pid) {
      var p = o.personById(pid);
      if (!p) return null;
      var role = o.roleById(p.roleId);
      var storeName = p.orgType === '总部' ? '总部' : ((o.storeByCode(p.storeCode) || {}).name || p.storeCode);
      return { personId: p.personId, personName: p.name, roleId: p.roleId, roleName: role ? role.name : '', orgType: p.orgType, storeCode: p.storeCode, storeName: storeName, read: false, readTime: '' };
    }).filter(function (r) { return !!r; });
  }

  function scopeOf(recipients) {
    var hq = recipients.some(function (r) { return r.orgType === '总部'; });
    var st = recipients.some(function (r) { return r.orgType === '门店'; });
    return hq && st ? '总部+门店' : (hq ? '总部' : '门店');
  }

  // ===== 种子公告（固定日期 + 静态已读/未读快照） =====
  function seed() {
    var o = org();
    var allStorePersons = o.persons.filter(function (p) { return p.orgType === '门店'; }).map(function (p) { return p.personId; });
    var allPersons = o.persons.map(function (p) { return p.personId; });
    var hqPersons = o.persons.filter(function (p) { return p.orgType === '总部'; }).map(function (p) { return p.personId; });

    function fillRead(recs, aid) {
      recs.forEach(function (r) {
        var h = annHash(r.personId + '|' + aid);
        r.read = (h % 100) < 65;
        if (r.read) r.readTime = shiftSeconds(r.publishTime, h % 86400);
      });
    }
    function mk(id, title, body, publishTime, personIds) {
      var recs = makeRecipients(personIds);
      recs.forEach(function (r) { r.publishTime = publishTime; });
      fillRead(recs, id);
      var sc = scopeOf(recs);
      var storeCnt = 0; var seen = {};
      recs.forEach(function (r) { if (r.orgType === '门店' && !seen[r.storeCode]) { seen[r.storeCode] = 1; storeCnt++; } });
      var scopeSummary = sc === '门店' ? ('门店 ' + storeCnt + ' 家·' + recs.length + ' 人')
        : (sc === '总部' ? ('总部 ' + recs.length + ' 人') : ('总部+门店 共 ' + recs.length + ' 人'));
      return { id: id, title: title, bodyHtml: body, attachments: [], scopeType: sc, scopeSummary: scopeSummary, publisher: '总部管理员', publishTime: publishTime, recipients: recs };
    }

    NP[K].allData = [
      mk('GG0003', '售后服务流程更新通知',
        '<p>为提升客户满意度，自 <b>2026-08-20</b> 起售后服务流程做如下调整：</p><ol><li>预约客户优先接待；</li><li>工单关单前须完成质检签字；</li><li>客户回访时限缩短至 48 小时。</li></ol><p>如有疑问请联系 <a href="javascript:void(0)">总部运营部</a>。</p>',
        '2026-08-20 10:00:00', hqPersons),
      mk('GG0002', '新能源汽车高压系统维修安全规范',
        '<p><span style="color:#861B2F;font-weight:bold;">【安全规范】</span>维修高压系统前必须执行断电、验电、挂牌上锁三步，严禁带电作业。</p><p><span style="background-color:#fff3cd;">重点：高压线束拆卸后需静置 5 分钟再测量残压。</span></p><p>作业分类：</p><table border="1" cellspacing="0" cellpadding="4"><tr><th>电压等级</th><th>防护要求</th></tr><tr><td>≤60V</td><td>绝缘手套</td></tr><tr><td>&gt;60V</td><td>全套高压防护</td></tr></table>',
        '2026-08-12 09:30:00', allPersons),
      mk('GG0001', '关于刹车片批次召回的技术公告',
        '<p><span style="color:#861B2F;font-weight:bold;">【重要】</span>近期检测发现部分批次刹车片存在异常磨损，请各门店立即排查。</p><p>涉及批次：</p><table border="1" cellspacing="0" cellpadding="4"><tr><th>批次号</th><th>车型</th><th>处理方式</th></tr><tr><td>B202605</td><td>奕境E5</td><td>免费更换</td></tr><tr><td>B202606</td><td>奕境E7</td><td>免费更换</td></tr></table><p>详细说明见附件，疑问联系 <a href="javascript:void(0)">总部技术部</a>。</p>',
        '2026-08-05 09:00:00', allStorePersons)
    ];
  }
  seed();

  function findAnn(id) { for (var i = 0; i < NP[K].allData.length; i++) if (NP[K].allData[i].id === id) return NP[K].allData[i]; return null; }

  // ===== 列表页 =====
  function listFilterHtml() {
    return '<div class="lt-filter"><div class="lt-filter-grid" id="ann-filterGrid">' +
      npFItem('关键字', '<input type="text" id="ann-f-key" placeholder="标题/关键字">') +
      npSelect('发布范围', '<select id="ann-f-scope"><option value="">请选择</option><option>总部</option><option>门店</option><option>总部+门店</option></select>') +
      npFItem('发布人', '<input type="text" id="ann-f-pub" placeholder="发布人">') +
      '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">发布时间</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="annQuery">' +
      '<div class="lt-date-range-drop"><input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="ann-f-date-start" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')"><span>—</span><input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="ann-f-date-end" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')"></div></div></div>' +
      '<div class="lt-filter-footer"><button class="lt-btn lt-btn-primary" onclick="annQuery()">查询</button><button class="lt-btn lt-btn-default" onclick="annReset()">重置</button></div>' +
      '</div></div>';
  }

  function listToolbarHtml() {
    return (isHq() ? '<button class="lt-btn lt-btn-primary" onclick="annOpenPublish()">发布公告</button>' : '');
  }

  function buildShell() {
    var root = document.getElementById('page-announcement');
    if (!root) return;
    var cols = [
      { t: '序号', w: 50 },
      { t: '标题' },
      { t: '发布范围' },
      { t: '发布人', w: 100 },
      { t: '发布时间', w: 160 },
      { t: '操作', w: 200, cls: 'col-actions' }
    ];
    root.innerHTML = '<div class="lt-wrap">' + listFilterHtml() +
      '<div class="lt-list-area"><div class="lt-toolbar"><div class="lt-toolbar-left">' + listToolbarHtml() + '</div></div>' +
      '<div class="lt-table-wrap"><table class="lt-table"><thead><tr>' + npTH(cols) + '</tr></thead><tbody id="ann-tbody"></tbody></table></div>' +
      '<div class="lt-pager" id="ann-pager"><div class="lt-pager-left"><span class="pager-total">共 0 条</span></div>' +
      '<div class="lt-pager-right"><button class="pg-prev">上一页</button><span class="pg-pages"></span><button class="pg-next">下一页</button>' +
      '<div class="pager-goto">前往 <input type="text"> 页</div><select class="pager-size"><option value="10">10条/页</option><option value="20" selected>20条/页</option><option value="50">50条/页</option><option value="100">100条/页</option></select></div></div>' +
      '</div></div>';
  }

  function annQuery() {
    var st = NP[K];
    var key = ((document.getElementById('ann-f-key') || {}).value || '').trim();
    var pub = ((document.getElementById('ann-f-pub') || {}).value || '').trim();
    var scope = (document.getElementById('ann-f-scope') || {}).value || '';
    var ds = (document.getElementById('ann-f-date-start') || {}).value || '';
    var de = (document.getElementById('ann-f-date-end') || {}).value || '';
    st.filtered = st.allData.filter(function (a) {
      var okKey = !key || a.title.indexOf(key) >= 0;
      var okPub = !pub || a.publisher.indexOf(pub) >= 0;
      var okScope = !scope || a.scopeType === scope;
      var day = a.publishTime.substring(0, 10);
      var okDate = (!ds || day >= ds) && (!de || day <= de);
      return okKey && okPub && okScope && okDate;
    });
    st.page = 1;
    renderAnnList();
  }

  function annReset() {
    ['ann-f-key', 'ann-f-pub', 'ann-f-scope', 'ann-f-date-start', 'ann-f-date-end'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    var txt = document.querySelector('#page-announcement .lt-date-range-text');
    if (txt) txt.value = '';
    annQuery();
  }

  function renderAnnList() {
    var st = NP[K];
    var tb = document.getElementById('ann-tbody');
    if (!tb) return;
    var pages = Math.max(1, Math.ceil(st.filtered.length / st.pageSize));
    if (st.page > pages) st.page = pages;
    if (st.page < 1) st.page = 1;
    var start = (st.page - 1) * st.pageSize;
    var rows = st.filtered.slice(start, start + st.pageSize);
    var html = '';
    rows.forEach(function (a, i) {
      var ops = ['<a href="javascript:void(0)" class="lt-btn-link" onclick="annOpenDetail(\'' + a.id + '\')">查看</a>'];
      if (isHq()) {
        ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="annOpenRead(\'' + a.id + '\')">阅读情况</a>');
        ops.push('<a href="javascript:void(0)" class="lt-link np-red" onclick="annDelete(\'' + a.id + '\')">删除</a>');
      }
      html += '<tr><td>' + (start + i + 1) + '</td><td>' + npEscape(a.title) + '</td><td>' + npEscape(a.scopeSummary) + '</td>' +
        '<td>' + npEscape(a.publisher) + '</td><td>' + a.publishTime + '</td>' +
        '<td class="col-actions">' + npRenderActions(ops) + '</td></tr>';
    });
    if (!rows.length) html = '<tr><td colspan="6" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    tb.innerHTML = html;
    var pager = document.getElementById('ann-pager');
    if (pager) {
      npRenderPager(pager, {
        page: st.page, pageSize: st.pageSize, total: st.filtered.length,
        go: function (p) { st.page = p; renderAnnList(); },
        size: function (v) { st.pageSize = v; st.page = 1; renderAnnList(); }
      });
    }
  }

  window.annQuery = annQuery;
  window.annReset = annReset;
  window.annDelete = function (id) {
    if (!confirm('确定删除该公告？')) return;
    var st = NP[K];
    for (var i = 0; i < st.allData.length; i++) {
      if (st.allData[i].id === id) { st.allData.splice(i, 1); break; }
    }
    annQuery();
    npToast('已删除');
  };

  // ===== 富文本编辑器 =====
  window.annExec = function (cmd, val) {
    var ed = document.getElementById('ann-editor');
    if (ed && ed.focus) ed.focus();
    document.execCommand(cmd, false, val || null);
  };
  window.annInsertLink = function () {
    var url = prompt('请输入链接地址', 'https://');
    if (url) document.execCommand('createLink', false, url);
  };
  window.annInsertTable = function () {
    var spec = prompt('请输入表格 行×列（如 3×4）', '2×3');
    if (!spec) return;
    var m = /(\d+)\s*[×xX*]\s*(\d+)/.exec(spec);
    if (!m) { alert('格式如 3×4'); return; }
    var rows = parseInt(m[1], 10), cols = parseInt(m[2], 10);
    if (rows < 1 || cols < 1 || rows > 10 || cols > 10) { alert('行列在 1~10 之间'); return; }
    var html = '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;">';
    for (var r = 0; r < rows; r++) {
      html += '<tr>';
      for (var c = 0; c < cols; c++) html += r === 0 ? '<th>表头</th>' : '<td>&nbsp;</td>';
      html += '</tr>';
    }
    html += '</table>';
    document.execCommand('insertHTML', false, html);
  };
  window.annRemoveFormat = function () { document.execCommand('removeFormat', false, null); };

  var editorToolbarHtml = function () {
    return '<div class="ann-editor-toolbar">' +
      '<button type="button" title="加粗" onclick="annExec(\'bold\')"><b>B</b></button>' +
      '<button type="button" title="斜体" onclick="annExec(\'italic\')"><i>I</i></button>' +
      '<button type="button" title="下划线" onclick="annExec(\'underline\')"><u>U</u></button>' +
      '<button type="button" title="删除线" onclick="annExec(\'strikeThrough\')"><s>S</s></button>' +
      '<span class="ann-tb-sep"></span>' +
      '<select onchange="annExec(\'fontSize\', this.value)"><option value="3">字号</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option></select>' +
      '<label class="ann-color" title="字体颜色">字体色<input type="color" value="#333333" onchange="annExec(\'foreColor\', this.value)"></label>' +
      '<label class="ann-color" title="背景色">背景色<input type="color" value="#ffffff" onchange="annExec(\'hiliteColor\', this.value)"></label>' +
      '<span class="ann-tb-sep"></span>' +
      '<button type="button" title="超链接" onclick="annInsertLink()">链接</button>' +
      '<button type="button" title="取消链接" onclick="annExec(\'unlink\')">去链</button>' +
      '<button type="button" title="插入表格" onclick="annInsertTable()">表格</button>' +
      '<button type="button" title="有序列表" onclick="annExec(\'insertOrderedList\')">1.</button>' +
      '<button type="button" title="无序列表" onclick="annExec(\'insertUnorderedList\')">•</button>' +
      '<button type="button" title="清除格式" onclick="annRemoveFormat()">清除</button>' +
      '<button type="button" title="撤销" onclick="annExec(\'undo\')">撤销</button>' +
      '<button type="button" title="重做" onclick="annExec(\'redo\')">重做</button>' +
      '</div>';
  };

  // ===== 发布公告 =====
  var annTree = [];
  var annChecked = {};
  var annSearchQ = '';
  var annAttachments = [];

  function filterTree(nodes, q) {
    if (!q) return nodes;
    q = String(q).toLowerCase();
    var out = [];
    nodes.forEach(function (n) {
      var selfMatch = (n.label || '').toLowerCase().indexOf(q) >= 0;
      var kids = n.children ? filterTree(n.children, q) : null;
      if (selfMatch || (kids && kids.length)) {
        out.push({ key: n.key, type: n.type, label: n.label, personId: n.personId, children: selfMatch ? n.children : kids });
      }
    });
    return out;
  }

  function renderAnnTree() {
    var tree = filterTree(annTree, annSearchQ);
    var html = '';
    (function walk(nodes, depth) {
      nodes.forEach(function (n) {
        var st = subtreeState(n, annChecked);
        html += '<div class="ann-tnode" style="--lv:' + depth + '"><label class="ann-tlabel">' +
          '<input type="checkbox" id="annck-' + n.key + '"' + (st === 'on' ? ' checked' : '') + ' onchange="annTreeToggle(\'' + n.key + '\', this.checked)">' +
          '<span class="ann-tlabel-txt">' + npEscape(n.label) + '</span></label></div>';
        if (n.children) walk(n.children, depth + 1);
      });
    })(tree, 0);
    var box = document.getElementById('ann-tree-box');
    if (box) box.innerHTML = html;
    (function setInd(nodes) {
      nodes.forEach(function (n) {
        if (n.children && n.children.length && subtreeState(n, annChecked) === 'partial') {
          var cb = document.getElementById('annck-' + n.key); if (cb) cb.indeterminate = true;
          setInd(n.children);
        } else if (n.children) { setInd(n.children); }
      });
    })(tree);
    updateTreeSummary();
  }

  function findTreeNode(key) {
    var found = null;
    (function walk(nodes) {
      nodes.forEach(function (n) { if (n.key === key) found = n; else if (n.children) walk(n.children); });
    })(annTree);
    return found;
  }

  function nodeKeys(n, acc) { acc[n.key] = 1; if (n.children) n.children.forEach(function (c) { nodeKeys(c, acc); }); return acc; }

  window.annTreeToggle = function (key, on) {
    var n = findTreeNode(key); if (!n) return;
    var acc = nodeKeys(n, {});
    Object.keys(acc).forEach(function (k) { if (on) annChecked[k] = 1; else delete annChecked[k]; });
    renderAnnTree();
  };

  window.annTreeSearch = function (v) { annSearchQ = v; renderAnnTree(); };

  function updateTreeSummary() {
    var ids = resolvePersons(annTree, annChecked);
    var orgOn = 0, storeOn = 0, roleOn = 0;
    (function walk(nodes) {
      nodes.forEach(function (n) {
        var st = subtreeState(n, annChecked);
        if (st === 'on') { if (n.type === 'org') orgOn++; else if (n.type === 'store') storeOn++; else if (n.type === 'role') roleOn++; }
        if (n.children) walk(n.children);
      });
    })(annTree);
    var el = document.getElementById('ann-tree-summary');
    if (el) el.textContent = '已选人员：' + ids.length + ' 人（组织 ' + orgOn + ' / 门店 ' + storeOn + ' / 角色 ' + roleOn + '）';
  }

  function renderAnnAttachments() {
    var box = document.getElementById('ann-attach-list');
    if (!box) return;
    if (!annAttachments.length) { box.innerHTML = '<div class="ann-attach-empty">未上传附件</div>'; return; }
    box.innerHTML = annAttachments.map(function (f, i) {
      var size = f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + 'M' : Math.round(f.size / 1024) + 'K';
      return '<div class="ann-attach-item"><span class="ann-attach-name">' + npEscape(f.name) + '（' + size + ' · ' + npEscape(f.type) + '）</span>' +
        '<button class="ann-attach-del" onclick="annRemoveAttach(' + i + ')">×</button></div>';
    }).join('');
  }
  window.annRemoveAttach = function (i) { annAttachments.splice(i, 1); renderAnnAttachments(); };
  window.annHandleFiles = function (files) {
    for (var i = 0; i < files.length; i++) {
      if (annAttachments.length >= 5) { alert('最多上传 5 个附件'); break; }
      var f = files[i];
      var dot = f.name.lastIndexOf('.');
      annAttachments.push({ name: f.name, size: f.size, type: dot >= 0 ? f.name.substring(dot + 1).toUpperCase() : '-' });
    }
    renderAnnAttachments();
    var inp = document.getElementById('ann-file-input'); if (inp) inp.value = '';
  };

  window.annOpenPublish = function () {
    annTree = buildTargetTree();
    annChecked = {};
    annSearchQ = '';
    annAttachments = [];
    var body = '<div class="ann-pub">' +
      '<div class="ann-prow"><label>标题 <span class="req">*</span></label><input type="text" id="ann-title" class="ann-input" placeholder="请输入公告标题"></div>' +
      '<div class="ann-prow"><label>正文 <span class="req">*</span></label><div class="ann-editor">' + editorToolbarHtml() +
      '<div class="ann-editor-body" id="ann-editor" contenteditable="true"></div></div></div>' +
      '<div class="ann-prow"><label>附件</label><div class="ann-attach"><button class="lt-btn lt-btn-default" onclick="document.getElementById(\'ann-file-input\').click()">上传附件</button>' +
      '<input type="file" id="ann-file-input" multiple style="display:none" onchange="annHandleFiles(this.files)"><div class="ann-attach-list" id="ann-attach-list"></div></div></div>' +
      '<div class="ann-prow"><label>发布对象 <span class="req">*</span></label><div class="ann-target">' +
      '<div class="ann-target-search"><input type="text" id="ann-tree-search" placeholder="搜索角色/门店/人员…" oninput="annTreeSearch(this.value)"></div>' +
      '<div class="ann-target-summary" id="ann-tree-summary"></div><div class="ann-tree-box" id="ann-tree-box"></div></div></div>' +
      '</div>';
    npOpenModal('发布技术公告', body,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="annPublish()">发布</button>',
      { width: 960 });
    renderAnnTree();
    renderAnnAttachments();
  };

  window.annPublish = function () {
    var title = ((document.getElementById('ann-title') || {}).value || '').trim();
    var bodyHtml = (document.getElementById('ann-editor') || {}).innerHTML || '';
    var ids = resolvePersons(annTree, annChecked);
    if (!title) { alert('请输入公告标题'); return; }
    if (!ids.length) { alert('请选择发布对象'); return; }
    var recipients = makeRecipients(ids);
    var sc = scopeOf(recipients);
    var storeCnt = 0, seen = {};
    recipients.forEach(function (r) { if (r.orgType === '门店' && !seen[r.storeCode]) { seen[r.storeCode] = 1; storeCnt++; } });
    var scopeSummary = sc === '门店' ? ('门店 ' + storeCnt + ' 家·' + recipients.length + ' 人')
      : (sc === '总部' ? ('总部 ' + recipients.length + ' 人') : ('总部+门店 共 ' + recipients.length + ' 人'));
    var id = 'GG' + String(Date.now()).slice(-6);
    NP[K].allData.unshift({ id: id, title: title, bodyHtml: bodyHtml, attachments: annAttachments.slice(), scopeType: sc, scopeSummary: scopeSummary, publisher: isHq() && window.gUserRole === '超级管理员' ? '超级管理员' : '总部管理员', publishTime: npNowLocal(), recipients: recipients });
    npCloseModal();
    annQuery();
    npToast('公告已发布');
  };

  // ===== 详情 =====
  window.annOpenDetail = function (id) {
    var a = findAnn(id); if (!a) return;
    var attHtml = !a.attachments.length ? '<div class="ann-attach-empty">无附件</div>' :
      a.attachments.map(function (f) {
        var size = f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + 'M' : Math.round(f.size / 1024) + 'K';
        return '<div class="ann-attach-item"><span class="ann-attach-name">' + npEscape(f.name) + '（' + size + ' · ' + npEscape(f.type) + '）</span>' +
          '<a href="javascript:void(0)" class="lt-btn-link" onclick="npToast(\'附件下载（演示）\')">下载</a></div>';
      }).join('');
    var html = '<div class="ann-detail">' +
      '<div class="ann-detail-meta"><span>发布人：' + npEscape(a.publisher) + '</span><span>发布时间：' + a.publishTime + '</span><span>发布范围：' + npEscape(a.scopeSummary) + '</span></div>' +
      '<div class="ann-detail-body">' + (a.bodyHtml || '') + '</div>' +
      '<div class="ann-detail-att"><div class="ann-detail-att-title">附件</div>' + attHtml + '</div>' +
      '</div>';
    npOpenModal(a.title, html,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>' +
      (isHq() ? '<button class="lt-btn lt-btn-default" onclick="annOpenRead(\'' + a.id + '\')">查看阅读情况</button>' : ''),
      { width: 860 });
  };

  // ===== 阅读情况 =====
  var readState = { aid: '', page: 1, pageSize: 20, filtered: [] };
  function readRoleComboHtml() {
    var o = org();
    var lis = '<li data-val="" onclick="annReadRoleSelect(this)">请选择</li>' +
      o.roles.map(function (r) { return '<li data-val="' + npEscape(r.id) + '" onclick="annReadRoleSelect(this)">' + npEscape(r.name) + '</li>'; }).join('');
    return '<div class="lt-input-wrap combobox" style="position:relative">' +
      '<input type="text" id="ann-read-role" placeholder="请选择或输入" onfocus="npComboboxShow(this)" oninput="npComboboxFilter(this)">' +
      '<span class="cb-arrow" onclick="npComboboxToggle(this)">▼</span>' +
      '<ul class="lt-datalist">' + lis + '</ul></div>';
  }
  window.annReadRoleSelect = function (li) {
    var w = li.closest('.lt-input-wrap.combobox'); if (!w) return;
    var inp = w.querySelector('input'); if (inp) inp.value = cmbSelVal(li);
    var l = w.querySelector('.lt-datalist'); if (l) { l.classList.remove('show'); l.querySelectorAll('li').forEach(function (x) { x.classList.remove('hidden'); }); }
    annReadQuery();
  };
  window.annOpenRead = function (id) {
    var a = findAnn(id); if (!a) return;
    readState.aid = id;
    readState.page = 1;
    var read = a.recipients.filter(function (r) { return r.read; }).length;
    var total = a.recipients.length;
    var rate = total ? Math.round(read / total * 100) : 0;
    var orgOpts = '<option value="">请选择</option><option value="总部">总部</option><option value="门店">门店</option>';
    var html = '<div class="ann-read">' +
      '<div class="ann-read-summary"><span>已读 <b>' + read + '</b> 人</span><span>未读 <b>' + (total - read) + '</b> 人</span><span>共 <b>' + total + '</b> 人</span><span>已读率 <b>' + rate + '%</b></span></div>' +
      '<div class="ann-read-filter">' +
      '<span class="ann-read-fitem">总部/门店 <select id="ann-read-org" onchange="annReadQuery()">' + orgOpts + '</select></span>' +
      '<span class="ann-read-fitem">角色 ' + readRoleComboHtml() + '</span>' +
      '<span class="ann-read-fitem">人员 <input type="text" id="ann-read-person" placeholder="姓名/人员ID" oninput="annReadQuery()"></span>' +
      '<span class="ann-read-fitem">状态 <select id="ann-read-status" onchange="annReadQuery()"><option value="">请选择</option><option value="read">已读</option><option value="unread">未读</option></select></span>' +
      '</div>' +
      '<div class="lt-table-wrap" style="max-height:320px;"><table class="lt-table"><thead><tr>' +
      npTH([{ t: '角色', w: 130 }, { t: '人员', w: 150 }, { t: '已读/未读', w: 90 }, { t: '查阅时间', w: 160 }]) +
      '</tr></thead><tbody id="ann-read-tbody"></tbody></table></div>' +
      '<div class="lt-pager" id="ann-read-pager"><div class="lt-pager-left"><span class="pager-total">共 0 条</span></div>' +
      '<div class="lt-pager-right"><button class="pg-prev">上一页</button><span class="pg-pages"></span><button class="pg-next">下一页</button>' +
      '<div class="pager-goto">前往 <input type="text"> 页</div><select class="pager-size"><option value="10">10条/页</option><option value="20" selected>20条/页</option><option value="50">50条/页</option><option value="100">100条/页</option></select></div></div>' +
      '</div>';
    npOpenModal('阅读情况 — ' + a.title, html,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>', { width: 820 });
    renderReadTable();
  };

  window.annReadQuery = function () {
    readState.page = 1;
    renderReadTable();
  };

  function renderReadTable() {
    var a = findAnn(readState.aid);
    if (!a) return;
    var fOrg = (document.getElementById('ann-read-org') || {}).value || '';
    var fRole = (document.getElementById('ann-read-role') || {}).value || '';
    var fPerson = ((document.getElementById('ann-read-person') || {}).value || '').trim();
    var fStatus = (document.getElementById('ann-read-status') || {}).value || '';
    readState.filtered = a.recipients.filter(function (r) {
      return (!fOrg || r.orgType === fOrg) && (!fRole || r.roleId === fRole) &&
        (!fPerson || r.personName.indexOf(fPerson) >= 0 || r.personId.indexOf(fPerson) >= 0) &&
        (!fStatus || (fStatus === 'read' ? r.read : !r.read));
    });
    var tb = document.getElementById('ann-read-tbody');
    if (!tb) return;
    var pages = Math.max(1, Math.ceil(readState.filtered.length / readState.pageSize));
    if (readState.page > pages) readState.page = pages;
    if (readState.page < 1) readState.page = 1;
    var start = (readState.page - 1) * readState.pageSize;
    var rows = readState.filtered.slice(start, start + readState.pageSize);
    var html = '';
    rows.forEach(function (r) {
      html += '<tr><td>' + npEscape(r.roleName + '(' + r.roleId + ')') + '</td>' +
        '<td>' + npEscape(r.personName + '(' + r.personId + ')') + '</td>' +
        '<td>' + (r.read ? '<span class="lt-badge ok">已读</span>' : '<span class="lt-badge warn">未读</span>') + '</td>' +
        '<td>' + (r.read ? r.readTime : '—') + '</td></tr>';
    });
    if (!rows.length) html = '<tr><td colspan="4" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    tb.innerHTML = html;
    var pager = document.getElementById('ann-read-pager');
    if (pager) {
      npRenderPager(pager, {
        page: readState.page, pageSize: readState.pageSize, total: readState.filtered.length,
        go: function (p) { readState.page = p; renderReadTable(); },
        size: function (v) { readState.pageSize = v; readState.page = 1; renderReadTable(); }
      });
    }
  }

  // ===== 初始化 =====
  window.initAnnouncement = function () {
    buildShell();
    annQuery();
  };

  // 切角色时刷新（门店→总部/超管 后「发布公告/阅读情况/删除」按钮要跟着显隐）
  window.annApplyRoleUI = function () {
    var page = document.getElementById('page-announcement');
    if (page && page.classList.contains('active')) initAnnouncement();
  };

  // 供测试使用（纯函数）
  window.ANN_API = { buildTargetTree: buildTargetTree, resolvePersons: resolvePersons, subtreeState: subtreeState, hash: annHash };

  npRegisterModuleInit('announcement', function () { initAnnouncement(); });
})();
