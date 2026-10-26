// =====================================================================
// 用户管理（系统设置）—— 组织 / 角色 / 人员 主数据查看与配置
// 数据源：ORG_MASTER（org-master.js）；门店字典引用门店主数据，不重复造。
// 页面结构一律走 npShell（查询区 + 列表区工具栏 + 表格 + 分页），
// 控件一律用全站组件：文本 npFItem / 枚举 npSelect / 模糊下拉 npComboMarkup /
// 门店 .lt-input-wrap.search.store-pick + msOpenStorePicker（点框弹门店选择）。
// 2026-10-25 返工：不再手写查询区/工具栏结构、不再用原生下拉选门店、
// 角色改回「带搜索的下拉」（模糊下拉）、查询/重置由 npShell 统一接到 NP 状态上。
// =====================================================================
(function () {
  var K = 'user';
  NP[K] = { page: 1, pageSize: 10, filtered: [], render: null };
  NP['user-role'] = { page: 1, pageSize: 10, filtered: [], render: null, query: null, reset: null };
  NP['user-person'] = { page: 1, pageSize: 10, filtered: [], render: null, query: null, reset: null };
  var curTab = 'org'; // org | role | person

  function org() { return window.ORG_MASTER || { roles: [], stores: [], persons: [] }; }
  function val(id) { var el = document.getElementById(id); return el ? (el.value || '') : ''; }
  function badge(status) {
    return status === '启用' ? '<span class="lt-badge ok">启用</span>' : '<span class="lt-badge off">停用</span>';
  }
  // 新建时间倒序（新建的排最前）：时间串固定宽度，直接按字符串倒排序
  function descByCreated(list) {
    return list.slice().sort(function (a, b) {
      var x = a.createdAt || '', y = b.createdAt || '';
      if (x === y) return 0;
      return x < y ? 1 : -1;
    });
  }

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
    if (curTab === 'org') { body.innerHTML = orgTabHtml(); return; }
    if (curTab === 'role') {
      body.innerHTML = npShell('user-role', { l2: '系统设置', l3: '用户管理' },
        roleFilterHtml(), roleToolbarHtml(), npTH(roleCols()), 'user-role-tbody', 'user-role-pager');
      initFilterGrid('user-role-filterGrid', 7);
      NP['user-role'].query();
      return;
    }
    body.innerHTML = npShell('user-person', { l2: '系统设置', l3: '用户管理' },
      personFilterHtml(), personToolbarHtml(), npTH(personCols()), 'user-person-tbody', 'user-person-pager');
    initFilterGrid('user-person-filterGrid', 7);
    // 查询区「角色」是 combobox，DOM 刚拼出来 → 补一次注入，× 才会出现（同 tech-notice/prepayment 口径）
    if (typeof npInitComboboxes === 'function') npInitComboboxes();
    NP['user-person'].query();
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
  function roleToolbarHtml() {
    return '<button class="lt-btn lt-btn-primary" onclick="userRoleAdd()">新增角色</button>';
  }
  function roleFilterHtml() {
    return npFItem('角色ID', '<input type="text" id="user-r-id" placeholder="请输入">') +
      npFItem('角色名称', '<input type="text" id="user-r-name" placeholder="请输入">') +
      npSelect('归属', '<select id="user-r-scope"><option value="">请选择</option><option>总部</option><option>门店</option></select>') +
      npSelect('状态', '<select id="user-r-status"><option value="">请选择</option><option>启用</option><option>停用</option></select>');
  }
  function roleCols() {
    return [
      { t: '序号', w: 50, f: function (r, i) { return i + 1; } },
      { t: '角色ID', w: 90, f: function (r) { return npEscape(r.id); } },
      { t: '角色名称', f: function (r) { return npEscape(r.name); } },
      { t: '归属', w: 80, f: function (r) { return npEscape(r.scope); } },
      { t: '说明', f: function (r) { return npEscape(r.desc); } },
      { t: '状态', w: 80, f: function (r) { return badge(r.status); } },
      { t: '新建时间', w: 150, f: function (r) { return npEscape(r.createdAt || '—'); } },
      { t: '更新时间', w: 150, f: function (r) { return npEscape(r.updatedAt || '—'); } },
      {
        t: '操作', w: 130, cls: 'col-actions', f: function (r) {
          return npRenderActions([
            '<a href="javascript:void(0)" class="lt-btn-link" onclick="userRoleEdit(\'' + r.id + '\')">编辑</a>',
            '<a href="javascript:void(0)" class="lt-link np-red" onclick="userRoleDel(\'' + r.id + '\')">删除</a>'
          ]);
        }
      }
    ];
  }
  NP['user-role'].query = function () {
    var o = org(), st = NP['user-role'];
    var id = val('user-r-id').trim(), name = val('user-r-name').trim();
    var scope = val('user-r-scope'), status = val('user-r-status');
    st.filtered = descByCreated(o.roles.filter(function (r) {
      return (!id || r.id.indexOf(id) >= 0) && (!name || r.name.indexOf(name) >= 0) &&
        (!scope || r.scope === scope) && (!status || r.status === status);
    }));
    st.page = 1;
    st.render();
  };
  NP['user-role'].reset = function () {
    ['user-r-id', 'user-r-name', 'user-r-scope', 'user-r-status'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    NP['user-role'].query();
  };
  NP['user-role'].render = function () {
    var st = NP['user-role'];
    npRenderTable('user-role', 'user-role-tbody', 'user-role-pager', roleCols(), st.filtered, st);
  };

  // ===== 人员 Tab =====
  // 门店选择框（规范 §3.1）：.lt-input-wrap.search.store-pick + 放大镜 → 全站「门店选择」弹框
  function storePickItem(label, id, pickFn) {
    return '<div class="lt-filter-item"><div class="lt-input-wrap search store-pick">' +
      '<span class="lt-filter-prefix">' + npEscape(label) + '</span>' +
      '<input type="text" id="' + id + '" placeholder="请选择" readonly onclick="' + pickFn + '">' +
      '<svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg>' +
      '</div></div>';
  }
  // 角色名清单（按归属过滤）——模糊下拉的选项来源，纯函数便于自检
  window.userRoleNamesByScope = function (scope) {
    var o = org();
    return o.roles.filter(function (r) { return !scope || r.scope === scope; })
      .map(function (r) { return r.name; });
  };
  function roleNamesByScope(scope) { return window.userRoleNamesByScope(scope); }

  function personToolbarHtml() {
    return '<button class="lt-btn lt-btn-primary" onclick="userPersonAdd()">新增人员</button>';
  }
  function personFilterHtml() {
    return npFItem('关键字', '<input type="text" id="user-p-q" placeholder="姓名/人员ID">') +
      npSelect('归属', '<select id="user-p-scope" onchange="userPersonScopeChange()"><option value="">请选择</option><option>总部</option><option>门店</option></select>') +
      storePickItem('门店', 'user-p-store', "userPickStore('filter')") +
      npComboMarkup('user-person', 'user-p-role', '角色', roleNamesByScope(''));
  }
  function personCols() {
    var o = org();
    return [
      { t: '序号', w: 50, f: function (r, i) { return i + 1; } },
      { t: '人员ID', w: 110, f: function (r) { return npEscape(r.personId); } },
      { t: '姓名', w: 90, f: function (r) { return npEscape(r.name); } },
      {
        t: '归属', f: function (r) {
          if (r.orgType === '总部') return '总部';
          var s = o.storeByCode(r.storeCode) || {};
          return npEscape((s.name || r.storeCode) + '（' + r.storeCode + '）');
        }
      },
      { t: '角色', f: function (r) { return npEscape(o.roleLabel(r.roleId)); } },
      { t: '状态', w: 80, f: function (r) { return badge(r.status); } },
      { t: '新建时间', w: 150, f: function (r) { return npEscape(r.createdAt || '—'); } },
      { t: '更新时间', w: 150, f: function (r) { return npEscape(r.updatedAt || '—'); } },
      {
        t: '操作', w: 130, cls: 'col-actions', f: function (r) {
          return npRenderActions([
            '<a href="javascript:void(0)" class="lt-btn-link" onclick="userPersonEdit(\'' + r.personId + '\')">编辑</a>',
            '<a href="javascript:void(0)" class="lt-link np-red" onclick="userPersonDel(\'' + r.personId + '\')">删除</a>'
          ]);
        }
      }
    ];
  }
  function roleIdByName(name) {
    var o = org();
    for (var i = 0; i < o.roles.length; i++) if (o.roles[i].name === name) return o.roles[i].id;
    return '';
  }
  function storeCodeOf(id) {
    var el = document.getElementById(id);
    if (!el) return '';
    var code = el.getAttribute ? el.getAttribute('data-code') : '';
    if (code) return code;
    var m = /[（(]([^）)]+)[）)]\s*$/.exec(el.value || '');
    return m ? m[1] : '';
  }
  NP['user-person'].query = function () {
    var o = org(), st = NP['user-person'];
    var q = val('user-p-q').trim();
    var scope = val('user-p-scope');
    var storeCode = storeCodeOf('user-p-store');
    var roleId = roleIdByName(val('user-p-role'));
    st.filtered = descByCreated(o.persons.filter(function (p) {
      var scopeOk = !scope || (scope === '总部' ? p.orgType === '总部' : p.orgType === '门店');
      var storeOk = !storeCode || p.storeCode === storeCode;
      var roleOk = !roleId || p.roleId === roleId;
      var qOk = !q || p.name.indexOf(q) >= 0 || p.personId.indexOf(q) >= 0;
      return scopeOk && storeOk && roleOk && qOk;
    }));
    st.page = 1;
    st.render();
  };
  NP['user-person'].reset = function () {
    ['user-p-q', 'user-p-scope', 'user-p-role'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    userSetStorePick('user-p-store', '', '');
    NP['user-person'].query();
  };
  NP['user-person'].render = function () {
    var st = NP['user-person'];
    npRenderTable('user-person', 'user-person-tbody', 'user-person-pager', personCols(), st.filtered, st);
  };
  // 兼容旧调用点（内联 onclick 走这两个名字）
  window.userPersonQuery = function () { NP['user-person'].query(); };
  window.userPersonReset = function () { NP['user-person'].reset(); };

  function userSetStorePick(id, name, code) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = name || '';
    if (el.setAttribute) el.setAttribute('data-code', code || '');
  }

  // 点门店框 → 全站统一「门店选择」弹框（单选）
  window.userPickStore = function (target) {
    var inputId = target === 'form' ? 'user-person-store' : 'user-p-store';
    msOpenStorePicker(inputId, function (sel) {
      var s = (sel && sel[0]) || null;
      userSetStorePick(inputId, s ? (s.name + '（' + s.code + '）') : '', s ? s.code : '');
      if (target !== 'form') NP['user-person'].query();
    }, { single: true });
  };

  // 模糊下拉（角色）选项按归属重建：.lt-input-wrap.combobox 内的 <ul class="lt-datalist">
  function userFillRoleCombo(inputId, scope, keep) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var list = roleNamesByScope(scope);
    var wrap = inp.closest ? inp.closest('.lt-input-wrap.combobox') : null;
    if (wrap) {
      var ul = wrap.querySelector ? wrap.querySelector('.lt-datalist') : null;
      if (ul) {
        ul.innerHTML = '<li data-val="" onclick="npComboboxSelect(this)">请选择</li>' +
          list.map(function (n) { return '<li data-val="' + npEscape(n) + '" onclick="npComboboxSelect(this)">' + npEscape(n) + '</li>'; }).join('');
      }
    }
    inp.value = (keep && list.indexOf(keep) >= 0) ? keep : '';
  }

  // 查询区：归属变 → 角色下拉只留该归属的角色（门店角色/总部角色不互串）
  window.userPersonScopeChange = function () {
    var scope = val('user-p-scope');
    if (scope === '总部') userSetStorePick('user-p-store', '', '');
    userFillRoleCombo('user-p-role', scope, '');
  };

  // 录入弹框：归属变 → 角色下拉跟着换（且归属未选时只能选「请选择」）；选门店才出现门店框
  window.userFormScopeChange = function () {
    var scope = val('user-person-scope');
    var wrap = document.getElementById('user-person-store-wrap');
    if (wrap) {
      if (scope === '门店') { wrap.style.display = ''; }
      else {
        wrap.style.display = 'none';
        userSetStorePick('user-person-store', '', '');
      }
    }
    userFillRoleCombo('user-person-role', scope, '');
  };

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
      npSelect('归属', '<select id="user-role-scope"><option value="门店">门店</option><option value="总部">总部</option></select>') +
      npSelect('状态', '<select id="user-role-status"><option value="启用">启用</option><option value="停用">停用</option></select>') +
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
      npSelect('归属', '<select id="user-role-scope"><option value="门店"' + (r.scope === '门店' ? ' selected' : '') + '>门店</option><option value="总部"' + (r.scope === '总部' ? ' selected' : '') + '>总部</option></select>') +
      npSelect('状态', '<select id="user-role-status"><option value="启用"' + (r.status === '启用' ? ' selected' : '') + '>启用</option><option value="停用"' + (r.status === '停用' ? ' selected' : '') + '>停用</option></select>') +
      npFItem('说明', '<input type="text" id="user-role-desc" value="' + npEscape(r.desc) + '">') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="userRoleSave()">保存</button>');
  };
  window.userRoleSave = function () {
    var o = org();
    var id = val('user-role-id');
    var name = val('user-role-name');
    var scope = val('user-role-scope') || '门店';
    var status = val('user-role-status') || '启用';
    var desc = val('user-role-desc');
    if (!id || !name) { alert('角色ID和角色名称必填'); return; }
    var now = npNowLocal();
    if (editingRoleId) {
      var r = o.roleById(editingRoleId);
      if (r) { r.name = name; r.scope = scope; r.status = status; r.desc = desc; r.updatedAt = now; }
    } else {
      if (o.roleById(id)) { alert('角色ID已存在'); return; }
      o.roles.push({ id: id, name: name, scope: scope, desc: desc, status: status, createdAt: now, updatedAt: now });
    }
    npCloseModal();
    NP['user-role'].reset();
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
    NP['user-role'].reset();
    npToast('已删除');
  };

  // ===== 人员 增删改 =====
  var editingPersonId = null;
  window.userPersonAdd = function () {
    editingPersonId = null;
    npOpenModal('新增人员',
      '<div class="pm-form-grid">' +
      npFItem('姓名', '<input type="text" id="user-person-name" placeholder="请输入姓名">') +
      npSelect('归属', '<select id="user-person-scope" onchange="userFormScopeChange()"><option value="">请选择</option><option>总部</option><option>门店</option></select>') +
      '<div id="user-person-store-wrap" style="display:none">' +
        storePickItem('门店', 'user-person-store', "userPickStore('form')") +
      '</div>' +
      npComboMarkup('user-person', 'user-person-role', '角色', roleNamesByScope('')) +
      npSelect('状态', '<select id="user-person-status"><option value="启用">启用</option><option value="停用">停用</option></select>') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="userPersonSave()">保存</button>');
    // 弹窗内「角色」也是 combobox，弹窗内容刚生成 → 补一次注入，× 才会出现
    if (typeof npInitComboboxes === 'function') npInitComboboxes();
  };
  window.userPersonEdit = function (id) {
    editingPersonId = id;
    var o = org();
    var p = o.personById(id);
    if (!p) return;
    var isHq = p.orgType === '总部';
    var scope = isHq ? '总部' : '门店';
    var scopeOpts = '<option value="">请选择</option>' +
      '<option' + (isHq ? ' selected' : '') + '>总部</option>' +
      '<option' + (isHq ? '' : ' selected') + '>门店</option>';
    var roleName = (o.roleById(p.roleId) || {}).name || '';
    npOpenModal('编辑人员',
      '<div class="pm-form-grid">' +
      npFItem('人员ID', '<input type="text" id="user-person-id" value="' + npEscape(p.personId) + '" readonly>') +
      npFItem('姓名', '<input type="text" id="user-person-name" value="' + npEscape(p.name) + '">') +
      npSelect('归属', '<select id="user-person-scope" onchange="userFormScopeChange()">' + scopeOpts + '</select>') +
      '<div id="user-person-store-wrap" style="display:' + (isHq ? 'none' : '') + '">' +
        storePickItem('门店', 'user-person-store', "userPickStore('form')") +
      '</div>' +
      npComboMarkup('user-person', 'user-person-role', '角色', roleNamesByScope(scope)) +
      npSelect('状态', '<select id="user-person-status"><option value="启用"' + (p.status === '启用' ? ' selected' : '') + '>启用</option><option value="停用"' + (p.status === '停用' ? ' selected' : '') + '>停用</option></select>') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="userPersonSave()">保存</button>');
    // 回填门店框与角色模糊下拉
    if (!isHq) {
      var s = o.storeByCode(p.storeCode) || {};
      userSetStorePick('user-person-store', (s.name || p.storeCode) + '（' + p.storeCode + '）', p.storeCode);
    }
    userFillRoleCombo('user-person-role', scope, roleName);
    // 回填后再注入一次：此时角色框有值，× 会正确显示（npComboboxInit 的 sync 只在注入时跑一次）
    if (typeof npInitComboboxes === 'function') npInitComboboxes();
  };
  window.userPersonSave = function () {
    var o = org();
    var name = val('user-person-name');
    var scope = val('user-person-scope');
    var storeCode = storeCodeOf('user-person-store');
    var roleName = val('user-person-role');
    var status = val('user-person-status') || '启用';
    if (!name) { alert('姓名必填'); return; }
    if (!scope) { alert('请选择归属'); return; }
    if (scope === '门店' && !storeCode) { alert('请选择门店'); return; }
    var roleId = roleIdByName(roleName);
    if (!roleId) { alert('请选择角色'); return; }
    var orgType = scope === '总部' ? '总部' : '门店';
    // 不做事后校验：角色下拉的候选集已按归属过滤，且切换归属时会清空已选角色，越权角色选不出来
    var code = scope === '总部' ? '' : storeCode;
    var now = npNowLocal();
    if (editingPersonId) {
      var p = o.personById(editingPersonId);
      if (p) {
        p.name = name; p.status = status; p.roleId = roleId;
        p.orgType = orgType; p.storeCode = code;
        p.updatedAt = now;
      }
    } else {
      var prefix = orgType === '总部' ? 'HQ-' : (code + '-');
      var seq = 1;
      while (o.personById(prefix + pad2(seq))) seq++;
      o.persons.push({
        personId: prefix + pad2(seq), name: name, roleId: roleId,
        orgType: orgType, storeCode: code, status: status,
        createdAt: now, updatedAt: now
      });
    }
    npCloseModal();
    NP['user-person'].reset();
    npToast('已保存');
  };
  window.userPersonDel = function (id) {
    var o = org();
    if (!confirm('确定删除该人员？')) return;
    var idx = -1;
    for (var i = 0; i < o.persons.length; i++) if (o.persons[i].personId === id) idx = i;
    if (idx === -1) return;
    o.persons.splice(idx, 1);
    NP['user-person'].reset();
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
