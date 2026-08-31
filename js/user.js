// =====================================================================
// 用户管理（系统设置）—— 组织 / 角色 / 人员 主数据查看与配置
// 数据源：ORG_MASTER（org-master.js）；门店字典引用门店主数据，不重复造。
// 角色在此页「角色」Tab 维护（权威 = ORG_MASTER.roles）。
// =====================================================================
(function () {
  var K = 'user';
  NP[K] = { page: 1, pageSize: 10, filtered: [], render: null };
  var curTab = 'org'; // org | role | person
  var roleState = { page: 1, pageSize: 10, filtered: [] };
  var personState = { page: 1, pageSize: 10, filtered: [], q: '', org: '', role: '' };

  function org() { return window.ORG_MASTER || { roles: [], stores: [], persons: [] }; }

  // ===== 页面外壳（三 Tab） =====
  function buildShell() {
    var tabs = '<div class="user-tabs">' +
      '<span class="user-tab' + (curTab === 'org' ? ' active' : '') + '" onclick="userTab(\'org\')">组织架构</span>' +
      '<span class="user-tab' + (curTab === 'role' ? ' active' : '') + '" onclick="userTab(\'role\')">角色</span>' +
      '<span class="user-tab' + (curTab === 'person' ? ' active' : '') + '" onclick="userTab(\'person\')">人员</span>' +
      '</div><div class="user-body" id="user-body"></div>';
    var root = document.getElementById('page-user');
    if (root) root.innerHTML = '<div class="lt-wrap">' + tabs + '</div>';
  }

  function renderTab() {
    var body = document.getElementById('user-body');
    if (!body) return;
    if (curTab === 'org') body.innerHTML = orgTabHtml();
    else if (curTab === 'role') { body.innerHTML = roleTabHtml(); renderRoleTable(); }
    else { body.innerHTML = personTabHtml(); renderPersonTable(); }
  }

  // ===== 组织架构 Tab（只读树） =====
  function orgTabHtml() {
    var o = org();
    var regions = {};
    o.stores.forEach(function (s) {
      var r = s.region || '其他';
      if (!regions[r]) regions[r] = [];
      regions[r].push(s);
    });
    var order = ['华东', '华南', '华北', '西南', '东北', '华中'];
    var html = '<div class="pm-tip-warn" style="margin-bottom:12px;">组织架构：总部 + 门店。门店由「门店管理」维护；角色在「角色」Tab 配置、人员在「人员」Tab 配置。</div>';
    html += '<div class="user-org-tree"><div class="user-org-node user-org-root"><span class="user-org-name">总部</span><div class="user-org-kids">';
    o.roles.filter(function (r) { return r.scope === '总部'; }).forEach(function (r) {
      html += '<div class="user-org-leaf">' + npEscape(r.name) + '（' + r.id + '）— ' + o.personsByRole(r.id).length + ' 人</div>';
    });
    html += '</div></div>';
    html += '<div class="user-org-node user-org-root"><span class="user-org-name">门店（' + o.stores.length + ' 家）</span><div class="user-org-kids">';
    order.concat(Object.keys(regions).filter(function (r) { return order.indexOf(r) === -1; })).forEach(function (r) {
      var list = regions[r];
      if (!list || !list.length) return;
      html += '<div class="user-org-node"><span class="user-org-name">' + npEscape(r) + '</span><div class="user-org-kids">';
      list.forEach(function (s) {
        html += '<div class="user-org-leaf">' + npEscape(s.name) + '（' + s.code + '）— ' + o.personsByStore(s.code).length + ' 人</div>';
      });
      html += '</div></div>';
    });
    html += '</div></div></div>';
    return html;
  }

  // ===== 角色 Tab =====
  function roleTabHtml() {
    return '<div class="lt-toolbar" style="margin-bottom:10px;"><div class="lt-toolbar-left">' +
      '<button class="lt-btn lt-btn-primary" onclick="userRoleAdd()">新增角色</button></div></div>' +
      '<div class="lt-table-wrap"><table class="lt-table"><thead><tr>' +
      npTH([{ t: '序号', w: 50 }, { t: '角色ID', w: 90 }, { t: '角色名称' }, { t: '归属', w: 80 }, { t: '说明' }, { t: '状态', w: 80 }, { t: '操作', w: 130, cls: 'col-actions' }]) +
      '</tr></thead><tbody id="user-role-tbody"></tbody></table></div>' +
      '<div class="lt-pager" id="user-role-pager"><div class="lt-pager-left"><span class="pager-total">共 0 条</span></div>' +
      '<div class="lt-pager-right"><button class="pg-prev">上一页</button><span class="pg-pages"></span><button class="pg-next">下一页</button>' +
      '<div class="pager-goto">前往 <input type="text"> 页</div><select class="pager-size"><option value="10">10条/页</option><option value="20" selected>20条/页</option><option value="50">50条/页</option><option value="100">100条/页</option></select></div></div>';
  }

  function renderRoleTable() {
    var o = org();
    roleState.filtered = o.roles.slice();
    var tb = document.getElementById('user-role-tbody');
    if (!tb) return;
    var pages = Math.max(1, Math.ceil(roleState.filtered.length / roleState.pageSize));
    if (roleState.page > pages) roleState.page = pages;
    if (roleState.page < 1) roleState.page = 1;
    var start = (roleState.page - 1) * roleState.pageSize;
    var rows = roleState.filtered.slice(start, start + roleState.pageSize);
    var html = '';
    rows.forEach(function (r, i) {
      html += '<tr><td>' + (start + i + 1) + '</td><td>' + npEscape(r.id) + '</td><td>' + npEscape(r.name) + '</td>' +
        '<td>' + npEscape(r.scope) + '</td><td>' + npEscape(r.desc) + '</td>' +
        '<td>' + (r.status === '启用' ? '<span class="lt-badge ok">启用</span>' : '<span class="lt-badge off">停用</span>') + '</td>' +
        '<td class="col-actions">' + npRenderActions([
          '<a href="javascript:void(0)" class="lt-btn-link" onclick="userRoleEdit(\'' + r.id + '\')">编辑</a>',
          '<a href="javascript:void(0)" class="lt-link np-red" onclick="userRoleDel(\'' + r.id + '\')">删除</a>'
        ]) + '</td></tr>';
    });
    if (!rows.length) html = '<tr><td colspan="7" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    tb.innerHTML = html;
    var pager = document.getElementById('user-role-pager');
    if (pager) {
      npRenderPager(pager, {
        page: roleState.page, pageSize: roleState.pageSize, total: roleState.filtered.length,
        go: function (p) { roleState.page = p; renderRoleTable(); },
        size: function (v) { roleState.pageSize = v; roleState.page = 1; renderRoleTable(); }
      });
    }
  }

  // ===== 人员 Tab =====
  function personTabHtml() {
    var o = org();
    var orgOpts = '<option value="">请选择</option><option value="总部">总部</option>' +
      o.stores.map(function (s) { return '<option value="' + npEscape(s.code) + '">' + npEscape(s.name) + '</option>'; }).join('');
    var roleOpts = '<option value="">请选择</option>' +
      o.roles.map(function (r) { return '<option value="' + npEscape(r.id) + '">' + npEscape(r.name) + '</option>'; }).join('');
    var filter = '<div class="lt-filter"><div class="lt-filter-grid" id="user-p-filter">' +
      npFItem('关键字', '<input type="text" id="user-p-q" placeholder="姓名/人员ID">') +
      npSelect('所属组织', '<select id="user-p-org">' + orgOpts + '</select>') +
      npSelect('角色', '<select id="user-p-role">' + roleOpts + '</select>') +
      '<div class="lt-filter-footer"><button class="lt-btn lt-btn-primary" onclick="userPersonQuery()">查询</button><button class="lt-btn lt-btn-default" onclick="userPersonReset()">重置</button></div>' +
      '</div></div>';
    return filter + '<div class="lt-list-area"><div class="lt-toolbar"><div class="lt-toolbar-left">' +
      '<button class="lt-btn lt-btn-primary" onclick="userPersonAdd()">新增人员</button></div></div>' +
      '<div class="lt-table-wrap"><table class="lt-table"><thead><tr>' +
      npTH([{ t: '序号', w: 50 }, { t: '人员ID', w: 110 }, { t: '姓名', w: 90 }, { t: '所属组织' }, { t: '角色' }, { t: '状态', w: 80 }, { t: '操作', w: 130, cls: 'col-actions' }]) +
      '</tr></thead><tbody id="user-person-tbody"></tbody></table></div>' +
      '<div class="lt-pager" id="user-person-pager"><div class="lt-pager-left"><span class="pager-total">共 0 条</span></div>' +
      '<div class="lt-pager-right"><button class="pg-prev">上一页</button><span class="pg-pages"></span><button class="pg-next">下一页</button>' +
      '<div class="pager-goto">前往 <input type="text"> 页</div><select class="pager-size"><option value="10">10条/页</option><option value="20" selected>20条/页</option><option value="50">50条/页</option><option value="100">100条/页</option></select></div></div></div>';
  }

  function userPersonQuery() {
    var o = org();
    var q = ((document.getElementById('user-p-q') || {}).value || '').trim();
    var fOrg = (document.getElementById('user-p-org') || {}).value || '';
    var fRole = (document.getElementById('user-p-role') || {}).value || '';
    personState.q = q; personState.org = fOrg; personState.role = fRole;
    personState.filtered = o.persons.filter(function (p) {
      var orgMatch = !fOrg || (fOrg === '总部' ? p.orgType === '总部' : p.storeCode === fOrg);
      var roleMatch = !fRole || p.roleId === fRole;
      var qMatch = !q || p.name.indexOf(q) >= 0 || p.personId.indexOf(q) >= 0;
      return orgMatch && roleMatch && qMatch;
    });
    personState.page = 1;
    renderPersonTable();
  }

  function userPersonReset() {
    ['user-p-q', 'user-p-org', 'user-p-role'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    userPersonQuery();
  }

  function renderPersonTable() {
    var o = org();
    var tb = document.getElementById('user-person-tbody');
    if (!tb) return;
    var pages = Math.max(1, Math.ceil(personState.filtered.length / personState.pageSize));
    if (personState.page > pages) personState.page = pages;
    if (personState.page < 1) personState.page = 1;
    var start = (personState.page - 1) * personState.pageSize;
    var rows = personState.filtered.slice(start, start + personState.pageSize);
    var html = '';
    rows.forEach(function (p, i) {
      var storeName = p.orgType === '总部' ? '总部' : ((o.storeByCode(p.storeCode) || {}).name || p.storeCode);
      html += '<tr><td>' + (start + i + 1) + '</td><td>' + npEscape(p.personId) + '</td><td>' + npEscape(p.name) + '</td>' +
        '<td>' + npEscape(storeName) + '</td><td>' + npEscape(o.roleLabel(p.roleId)) + '</td>' +
        '<td>' + (p.status === '启用' ? '<span class="lt-badge ok">启用</span>' : '<span class="lt-badge off">停用</span>') + '</td>' +
        '<td class="col-actions">' + npRenderActions([
          '<a href="javascript:void(0)" class="lt-btn-link" onclick="userPersonEdit(\'' + p.personId + '\')">编辑</a>',
          '<a href="javascript:void(0)" class="lt-link np-red" onclick="userPersonDel(\'' + p.personId + '\')">删除</a>'
        ]) + '</td></tr>';
    });
    if (!rows.length) html = '<tr><td colspan="7" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    tb.innerHTML = html;
    var pager = document.getElementById('user-person-pager');
    if (pager) {
      npRenderPager(pager, {
        page: personState.page, pageSize: personState.pageSize, total: personState.filtered.length,
        go: function (p) { personState.page = p; renderPersonTable(); },
        size: function (v) { personState.pageSize = v; personState.page = 1; renderPersonTable(); }
      });
    }
  }

  // ===== 角色 增删改 =====
  var editingRoleId = null;
  function nextRoleId() {
    var o = org();
    var n = o.roles.length + 1;
    while (o.roleById('R' + pad2(n))) n++;
    return 'R' + pad2(n);
  }
  window.userRoleAdd = function () {
    editingRoleId = null;
    npOpenModal('新增角色',
      '<div class="pm-form-grid">' +
      npFItem('角色ID', '<input type="text" id="user-role-id" value="' + nextRoleId() + '">') +
      npFItem('角色名称', '<input type="text" id="user-role-name" placeholder="请输入">') +
      npFItem('归属', '<select id="user-role-scope"><option value="门店">门店</option><option value="总部">总部</option></select>') +
      npFItem('状态', '<select id="user-role-status"><option value="启用">启用</option><option value="停用">停用</option></select>') +
      npFItem('说明', '<input type="text" id="user-role-desc" placeholder="请输入说明">') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="userRoleSave()">保存</button>');
  };
  window.userRoleEdit = function (id) {
    editingRoleId = id;
    var o = org();
    var r = o.roleById(id);
    if (!r) return;
    npOpenModal('编辑角色',
      '<div class="pm-form-grid">' +
      npFItem('角色ID', '<input type="text" id="user-role-id" value="' + npEscape(r.id) + '" readonly>') +
      npFItem('角色名称', '<input type="text" id="user-role-name" value="' + npEscape(r.name) + '">') +
      npFItem('归属', '<select id="user-role-scope"><option value="门店"' + (r.scope === '门店' ? ' selected' : '') + '>门店</option><option value="总部"' + (r.scope === '总部' ? ' selected' : '') + '>总部</option></select>') +
      npFItem('状态', '<select id="user-role-status"><option value="启用"' + (r.status === '启用' ? ' selected' : '') + '>启用</option><option value="停用"' + (r.status === '停用' ? ' selected' : '') + '>停用</option></select>') +
      npFItem('说明', '<input type="text" id="user-role-desc" value="' + npEscape(r.desc) + '">') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="userRoleSave()">保存</button>');
  };
  window.userRoleSave = function () {
    var o = org();
    var id = (document.getElementById('user-role-id') || {}).value || '';
    var name = (document.getElementById('user-role-name') || {}).value || '';
    var scope = (document.getElementById('user-role-scope') || {}).value || '门店';
    var status = (document.getElementById('user-role-status') || {}).value || '启用';
    var desc = (document.getElementById('user-role-desc') || {}).value || '';
    if (!id || !name) { alert('角色ID和角色名称必填'); return; }
    if (editingRoleId) {
      var r = o.roleById(editingRoleId);
      if (r) { r.name = name; r.scope = scope; r.status = status; r.desc = desc; }
    } else {
      if (o.roleById(id)) { alert('角色ID已存在'); return; }
      o.roles.push({ id: id, name: name, scope: scope, desc: desc, status: status });
    }
    npCloseModal();
    renderRoleTable();
    npToast('已保存');
  };
  window.userRoleDel = function (id) {
    var o = org();
    if (o.personsByRole && o.personsByRole(id).length) { alert('该角色下仍有人员，无法删除'); return; }
    if (!confirm('确定删除该角色？')) return;
    var idx = -1;
    for (var i = 0; i < o.roles.length; i++) if (o.roles[i].id === id) idx = i;
    if (idx === -1) return;
    o.roles.splice(idx, 1);
    renderRoleTable();
    npToast('已删除');
  };

  // ===== 人员 增删改 =====
  var editingPersonId = null;
  function personFormOrgOptions(sel) {
    var o = org();
    var html = '<option value="总部"' + (sel === '总部' ? ' selected' : '') + '>总部</option>';
    o.stores.forEach(function (s) {
      html += '<option value="' + npEscape(s.code) + '"' + (sel === s.code ? ' selected' : '') + '>' + npEscape(s.name) + '</option>';
    });
    return html;
  }
  function personFormRoleOptions(sel) {
    var o = org();
    return o.roles.map(function (r) { return '<option value="' + npEscape(r.id) + '"' + (sel === r.id ? ' selected' : '') + '>' + npEscape(r.name) + '</option>'; }).join('');
  }
  window.userPersonAdd = function () {
    editingPersonId = null;
    npOpenModal('新增人员',
      '<div class="pm-form-grid">' +
      npFItem('姓名', '<input type="text" id="user-person-name" placeholder="请输入姓名">') +
      npFItem('所属组织', '<select id="user-person-org">' + personFormOrgOptions('总部') + '</select>') +
      npFItem('角色', '<select id="user-person-role">' + personFormRoleOptions('') + '</select>') +
      npFItem('状态', '<select id="user-person-status"><option value="启用">启用</option><option value="停用">停用</option></select>') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="userPersonSave()">保存</button>');
  };
  window.userPersonEdit = function (id) {
    editingPersonId = id;
    var o = org();
    var p = o.personById(id);
    if (!p) return;
    npOpenModal('编辑人员',
      '<div class="pm-form-grid">' +
      npFItem('人员ID', '<input type="text" id="user-person-id" value="' + npEscape(p.personId) + '" readonly>') +
      npFItem('姓名', '<input type="text" id="user-person-name" value="' + npEscape(p.name) + '">') +
      npFItem('所属组织', '<select id="user-person-org">' + personFormOrgOptions(p.orgType === '总部' ? '总部' : p.storeCode) + '</select>') +
      npFItem('角色', '<select id="user-person-role">' + personFormRoleOptions(p.roleId) + '</select>') +
      npFItem('状态', '<select id="user-person-status"><option value="启用"' + (p.status === '启用' ? ' selected' : '') + '>启用</option><option value="停用"' + (p.status === '停用' ? ' selected' : '') + '>停用</option></select>') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="userPersonSave()">保存</button>');
  };
  window.userPersonSave = function () {
    var o = org();
    var name = (document.getElementById('user-person-name') || {}).value || '';
    var fOrg = (document.getElementById('user-person-org') || {}).value || '总部';
    var fRole = (document.getElementById('user-person-role') || {}).value || '';
    var status = (document.getElementById('user-person-status') || {}).value || '启用';
    if (!name) { alert('姓名必填'); return; }
    if (!fRole) { alert('请选择角色'); return; }
    if (editingPersonId) {
      var p = o.personById(editingPersonId);
      if (p) {
        p.name = name; p.status = status; p.roleId = fRole;
        p.orgType = fOrg === '总部' ? '总部' : '门店';
        p.storeCode = fOrg === '总部' ? '' : fOrg;
      }
    } else {
      var orgType = fOrg === '总部' ? '总部' : '门店';
      var storeCode = fOrg === '总部' ? '' : fOrg;
      var prefix = orgType === '总部' ? 'HQ-' : (storeCode + '-');
      var seq = 1;
      while (o.personById(prefix + pad2(seq))) seq++;
      o.persons.push({ personId: prefix + pad2(seq), name: name, roleId: fRole, orgType: orgType, storeCode: storeCode, status: status });
    }
    npCloseModal();
    userPersonQuery();
    npToast('已保存');
  };
  window.userPersonDel = function (id) {
    var o = org();
    if (!confirm('确定删除该人员？')) return;
    var idx = -1;
    for (var i = 0; i < o.persons.length; i++) if (o.persons[i].personId === id) idx = i;
    if (idx === -1) return;
    o.persons.splice(idx, 1);
    userPersonQuery();
    npToast('已删除');
  };

  function pad2(n) { return String(n).padStart(2, '0'); }

  window.userTab = function (tab) {
    curTab = tab;
    buildShell();
    renderTab();
  };

  window.initUser = function () {
    buildShell();
    renderTab();
  };

  npRegisterModuleInit('user', function () { initUser(); });
})();
