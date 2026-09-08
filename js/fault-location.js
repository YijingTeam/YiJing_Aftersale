// =====================================================================
// 参考系-故障部位（售后管理 → 参考系 → 故障部位）
// 故障部位字典：技术公告「故障部位」下拉从这里取（window.FAULT_LOCATIONS）。
// 权限：总部 + 超级管理员 维护。
// =====================================================================
window.FAULT_LOCATIONS = [
  { code: 'FA001', name: '前保险杠', status: '启用' },
  { code: 'FA002', name: '前大灯', status: '启用' },
  { code: 'FA003', name: '后保险杠', status: '启用' },
  { code: 'FA004', name: '刹车系统', status: '启用' },
  { code: 'FA005', name: '转向系统', status: '启用' },
  { code: 'FA006', name: '悬挂系统', status: '启用' },
  { code: 'FA007', name: '空调系统', status: '启用' },
  { code: 'FA008', name: '动力电池', status: '启用' },
  { code: 'FA009', name: '驱动电机', status: '启用' },
  { code: 'FA010', name: '电控系统', status: '启用' },
  { code: 'FA011', name: '车身钣金', status: '启用' },
  { code: 'FA012', name: '内饰系统', status: '启用' }
];

(function () {
  var K = 'fault-location';
  NP[K] = { page: 1, pageSize: 10, filtered: [] };
  var st = { page: 1, pageSize: 10, filtered: [] };
  var editingId = null;

  function list() { return window.FAULT_LOCATIONS || []; }

  function buildShell() {
    var root = document.getElementById('page-fault-location');
    if (!root) return;
    var cols = [
      { t: '序号', w: 50 }, { t: '编码', w: 100 }, { t: '名称' }, { t: '状态', w: 80 }, { t: '操作', w: 130, cls: 'col-actions' }
    ];
    root.innerHTML = '<div class="lt-wrap">' +
      '<div class="lt-list-area"><div class="lt-toolbar"><div class="lt-toolbar-left">' +
      '<button class="lt-btn lt-btn-primary" onclick="flAdd()">新增故障部位</button></div></div>' +
      '<div class="lt-table-wrap"><table class="lt-table"><thead><tr>' + npTH(cols) + '</tr></thead><tbody id="fl-tbody"></tbody></table></div>' +
      '<div class="lt-pager" id="fl-pager"><div class="lt-pager-left"><span class="pager-total">共 0 条</span></div>' +
      '<div class="lt-pager-right"><button class="pg-prev">上一页</button><span class="pg-pages"></span><button class="pg-next">下一页</button>' +
      '<div class="pager-goto">前往 <input type="text"> 页</div><select class="pager-size"><option value="10">10条/页</option><option value="20" selected>20条/页</option><option value="50">50条/页</option><option value="100">100条/页</option></select></div></div>' +
      '</div></div>';
  }

  function renderTable() {
    st.filtered = list().slice();
    var tb = document.getElementById('fl-tbody');
    if (!tb) return;
    var pages = Math.max(1, Math.ceil(st.filtered.length / st.pageSize));
    if (st.page > pages) st.page = pages;
    if (st.page < 1) st.page = 1;
    var start = (st.page - 1) * st.pageSize;
    var rows = st.filtered.slice(start, start + st.pageSize);
    var html = '';
    rows.forEach(function (r, i) {
      html += '<tr><td>' + (start + i + 1) + '</td><td>' + npEscape(r.code) + '</td><td>' + npEscape(r.name) + '</td>' +
        '<td>' + (r.status === '启用' ? '<span class="lt-badge ok">启用</span>' : '<span class="lt-badge off">停用</span>') + '</td>' +
        '<td class="col-actions">' + npRenderActions([
          '<a href="javascript:void(0)" class="lt-btn-link" onclick="flEdit(\'' + r.code + '\')">编辑</a>',
          '<a href="javascript:void(0)" class="lt-link np-red" onclick="flDel(\'' + r.code + '\')">删除</a>'
        ]) + '</td></tr>';
    });
    if (!rows.length) html = '<tr><td colspan="5" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    tb.innerHTML = html;
    var pager = document.getElementById('fl-pager');
    if (pager) {
      npRenderPager(pager, {
        page: st.page, pageSize: st.pageSize, total: st.filtered.length,
        go: function (p) { st.page = p; renderTable(); },
        size: function (v) { st.pageSize = v; st.page = 1; renderTable(); }
      });
    }
  }

  function nextCode() {
    var n = list().length + 1;
    while (list().some(function (r) { return r.code === 'FA' + pad3(n); })) n++;
    return 'FA' + pad3(n);
  }
  function pad3(n) { return String(n).padStart(3, '0'); }

  window.flAdd = function () {
    editingId = null;
    npOpenModal('新增故障部位',
      '<div class="pm-form-grid">' +
      npFItem('编码', '<input type="text" id="fl-f-code" value="' + nextCode() + '">') +
      npFItem('名称', '<input type="text" id="fl-f-name" placeholder="请输入故障部位名称">') +
      npFItem('状态', '<select id="fl-f-status"><option value="启用">启用</option><option value="停用">停用</option></select>') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="flSave()">保存</button>');
  };
  window.flEdit = function (code) {
    editingId = code;
    var r = list().filter(function (x) { return x.code === code; })[0];
    if (!r) return;
    npOpenModal('编辑故障部位',
      '<div class="pm-form-grid">' +
      npFItem('编码', '<input type="text" id="fl-f-code" value="' + npEscape(r.code) + '" readonly>') +
      npFItem('名称', '<input type="text" id="fl-f-name" value="' + npEscape(r.name) + '">') +
      npFItem('状态', '<select id="fl-f-status"><option value="启用"' + (r.status === '启用' ? ' selected' : '') + '>启用</option><option value="停用"' + (r.status === '停用' ? ' selected' : '') + '>停用</option></select>') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="flSave()">保存</button>');
  };
  window.flSave = function () {
    var code = (document.getElementById('fl-f-code') || {}).value || '';
    var name = (document.getElementById('fl-f-name') || {}).value || '';
    var status = (document.getElementById('fl-f-status') || {}).value || '启用';
    if (!code || !name) { alert('编码和名称必填'); return; }
    if (editingId) {
      list().forEach(function (r) { if (r.code === editingId) { r.name = name; r.status = status; } });
    } else {
      if (list().some(function (r) { return r.code === code; })) { alert('编码已存在'); return; }
      list().push({ code: code, name: name, status: status });
    }
    npCloseModal();
    renderTable();
    npToast('已保存');
  };
  window.flDel = function (code) {
    if (!confirm('确定删除该故障部位？')) return;
    var arr = window.FAULT_LOCATIONS;
    for (var i = 0; i < arr.length; i++) if (arr[i].code === code) { arr.splice(i, 1); break; }
    renderTable();
    npToast('已删除');
  };

  window.initFaultLocation = function () {
    buildShell();
    renderTable();
  };

  npRegisterModuleInit('fault-location', function () { initFaultLocation(); });
})();
