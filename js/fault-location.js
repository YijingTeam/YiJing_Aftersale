// =====================================================================
// 参考系-故障部位（售后管理 → 参考系 → 故障部位）
// 故障部位字典：技术公告「故障部位」下拉从这里取（window.FAULT_LOCATIONS）。
// 权限：总部 + 超级管理员 维护。
// 2026-10-25 迁到统一外壳（npShell + npRenderTable）：查询区/工具栏/表格/分页/展开全部由外壳生成，本文件不再自建。
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
  NP[K] = { page: 1, pageSize: 10, allData: [], filtered: [], query: null, reset: null, render: null };
  var st = NP[K];
  var editingId = null;

  function list() { return window.FAULT_LOCATIONS || []; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function v(id, s) { var e = document.getElementById(id); if (e) e.value = s; }

  function cols() {
    return [
      { t: '序号', w: 50, f: function (r, i) { return i + 1; } },
      { t: '编码', w: 100, f: function (r) { return npEscape(r.code); } },
      { t: '名称', f: function (r) { return npEscape(r.name); } },
      { t: '状态', w: 80, f: function (r) { return r.status === '启用' ? '<span class="lt-badge ok">启用</span>' : '<span class="lt-badge off">停用</span>'; } },
      {
        t: '操作', w: 130, cls: 'col-actions', f: function (r) {
          return npRenderActions([
            '<a href="javascript:void(0)" class="lt-btn-link" onclick="flEdit(\'' + r.code + '\')">编辑</a>',
            '<a href="javascript:void(0)" class="lt-link np-red" onclick="flDel(\'' + r.code + '\')">删除</a>'
          ]);
        }
      }
    ];
  }

  function filterHtml() {
    return npFItem('编码', '<input type="text" id="fl-f-code" placeholder="请输入">') +
      npFItem('名称', '<input type="text" id="fl-f-name" placeholder="请输入">') +
      npSelect('状态', '<select id="fl-f-status"><option value="">请选择</option><option value="启用">启用</option><option value="停用">停用</option></select>');
  }
  function toolbarHtml() {
    return '<button class="lt-btn lt-btn-primary" onclick="flAdd()">新增故障部位</button>';
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
      npSelect('状态', '<select id="fl-f-status"><option value="启用">启用</option><option value="停用">停用</option></select>') +
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
      npSelect('状态', '<select id="fl-f-status"><option value="启用"' + (r.status === '启用' ? ' selected' : '') + '>启用</option><option value="停用"' + (r.status === '停用' ? ' selected' : '') + '>停用</option></select>') +
      '</div>',
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="flSave()">保存</button>');
  };
  window.flSave = function () {
    var code = val('fl-f-code');
    var name = val('fl-f-name');
    var status = val('fl-f-status') || '启用';
    if (!code || !name) { npToast('编码和名称必填'); return; }
    if (editingId) {
      list().forEach(function (r) { if (r.code === editingId) { r.name = name; r.status = status; } });
    } else {
      if (list().some(function (r) { return r.code === code; })) { npToast('编码已存在'); return; }
      list().push({ code: code, name: name, status: status });
    }
    npCloseModal();
    st.query();
    npToast('已保存');
  };
  window.flDel = function (code) {
    if (!confirm('确定删除该故障部位？')) return;
    var arr = window.FAULT_LOCATIONS;
    for (var i = 0; i < arr.length; i++) if (arr[i].code === code) { arr.splice(i, 1); break; }
    st.query();
    npToast('已删除');
  };

  window.initFaultLocation = function () {
    var root = document.getElementById('page-fault-location');
    if (!root) return;
    st.allData = list().slice();
    root.innerHTML = npShell(K, { l2: '参考系', l3: '故障部位' }, filterHtml(), toolbarHtml(), npTH(cols()), 'fl-tbody', 'fl-pager');
    initFilterGrid(K + '-filterGrid', 7); st._fShow = 7; st._fExp = false;

    st.query = function () {
      var c = val('fl-f-code').trim();
      var n = val('fl-f-name').trim();
      var s = val('fl-f-status');
      st.allData = list().slice();
      st.filtered = st.allData.filter(function (r) {
        return (c === '' || r.code.indexOf(c) >= 0) && (n === '' || r.name.indexOf(n) >= 0) && (s === '' || r.status === s);
      });
      st.page = 1;
      st.render();
    };
    st.reset = function () {
      v('fl-f-code', ''); v('fl-f-name', ''); v('fl-f-status', '');
      st.query();
    };
    st.render = function () {
      npRenderTable(K, 'fl-tbody', 'fl-pager', cols(), st.filtered, st);
    };
    st.query();
  };

  npRegisterModuleInit('fault-location', function () { initFaultLocation(); });
})();
