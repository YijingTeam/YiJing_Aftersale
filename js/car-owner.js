/* ============ 车主管理（系统设置 › 客档主数据）============
   依赖 app.js 通用 helper：npShell / npTH / npRenderTable / npFItem / npSelect / npEscape / npToast
        / npOpenModal / npCloseModal / npExportExcelRows / npFindByIdx / npNextIdx / npRegisterModuleInit
   本页功能：车主（客档）主数据维护 —— 查询列表 + 新增/编辑/删除
   数据出口：window.CAR_OWNERS 是「客档」的唯一权威来源，配件销售（个销）客户从本页取，
             故 js/car-owner.js 必须排在 js/parts-sales.js 之前引入。
   ============================================================ */

/* ---- 车型字典 ---- */
var CO_CAR_MODELS = ['奕境S 2024款', '奕境X9 纯电版', '奕境X9 增程版', '奕境X10', '奕境L7 PHEV', '奕境L7 EV'];

/* ---- 车主种子（客档主数据）----
   idx 为 0 基（tests/modules/scan-s2-key.js R1 强制）
   注册状态：有效 ×6 / 无效 ×2，供配件销售个销客户候选取「有效」 */
function coSeed() {
  var raw = [
    { name: '沐云汐', sex: '女', phone: '138****2041', email: 'muyx@example.com', buyDate: '2024-03-16', vin: 'YJTEST00A00000041', model: '奕境S 2024款', valid: '有效' },
    { name: '张建国', sex: '男', phone: '139****8876', email: 'zhangjg@example.com', buyDate: '2023-11-02', vin: 'YJTEST00A00000052', model: '奕境X9 纯电版', valid: '有效' },
    { name: '李思远', sex: '男', phone: '136****3312', email: 'lisy@example.com', buyDate: '2025-01-20', vin: 'YJTEST00A00000063', model: '奕境X9 增程版', valid: '有效' },
    { name: '王雅静', sex: '女', phone: '137****5528', email: 'wangyj@example.com', buyDate: '2024-08-09', vin: 'YJTEST00A00000074', model: '奕境X10', valid: '有效' },
    { name: '陈志明', sex: '男', phone: '135****9903', email: 'chenzm@example.com', buyDate: '2023-06-25', vin: 'YJTEST00A00000085', model: '奕境L7 PHEV', valid: '有效' },
    { name: '刘婉如', sex: '女', phone: '188****1174', email: 'liuwr@example.com', buyDate: '2025-04-11', vin: 'YJTEST00A00000096', model: '奕境L7 EV', valid: '有效' },
    { name: '赵文博', sex: '男', phone: '159****6640', email: 'zhaowb@example.com', buyDate: '2022-12-30', vin: 'YJTEST00A00000107', model: '奕境S 2024款', valid: '无效' },
    { name: '孙丽华', sex: '女', phone: '150****4417', email: 'sunlh@example.com', buyDate: '2024-05-18', vin: 'YJTEST00A00000118', model: '奕境X9 纯电版', valid: '无效' }
  ];
  return raw.map(function (r, i) {
    var mm = ((i % 12) + 1);
    var dd = ((i % 28) + 1);
    var hh = 9 + (i % 8);
    var mi = (i * 11) % 60;
    var ss = (i * 17) % 60;
    var p = function (x) { return x < 10 ? '0' + x : '' + x; };
    return {
      idx: i,
      code: 'KH' + (20250 + i),
      name: r.name,
      sex: r.sex,
      phone: r.phone,
      email: r.email,
      buyDate: r.buyDate,
      vin: r.vin,
      model: r.model,
      valid: r.valid,
      remark: '',
      updateTime: '2026-' + p(mm) + '-' + p(dd) + ' ' + p(hh) + ':' + p(mi) + ':' + p(ss)
    };
  });
}

/* 客档唯一权威来源（全局，供配件销售个销客户读取） */
window.CAR_OWNERS = coSeed();

/* ---- 列定义 ---- */
function coCols() {
  return [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    { t: '客户编号', w: 100, cls: 'col-code sticky', f: function (r) { return npEscape(r.code); } },
    { t: '客户姓名', w: 100, cls: 'col-name', f: function (r) { return npEscape(r.name); } },
    { t: '性别', w: 60, cls: 'col-sex', f: function (r) { return npEscape(r.sex); } },
    { t: '手机号', w: 120, cls: 'col-phone', f: function (r) { return npEscape(r.phone); } },
    { t: '邮箱', w: 170, cls: 'col-email', f: function (r) { return npEscape(r.email); } },
    { t: '购车日期', w: 100, cls: 'col-buy-date', f: function (r) { return npEscape(r.buyDate); } },
    { t: '车架号', w: 190, cls: 'col-vin', f: function (r) { return npEscape(r.vin); } },
    { t: '车型', w: 140, cls: 'col-model', f: function (r) { return npEscape(r.model); } },
    { t: '注册状态', w: 90, cls: 'col-valid', f: function (r) { return npEscape(r.valid); } },
    { t: '最近更新时间', w: 150, cls: 'col-update', f: function (r) { return npEscape(r.updateTime); } },
    {
      t: '操作', w: 120, cls: 'col-actions', f: function (r) {
        return npRenderActions([
          '<a href="javascript:void(0)" class="lt-link" onclick="coOpenForm(\'edit\',' + r.idx + ')">编辑</a>',
          '<a href="javascript:void(0)" class="lt-link" onclick="coDelete(' + r.idx + ')">删除</a>'
        ]);
      }
    }
  ];
}

/* ---- 导出 ---- */
function coExport() {
  var st = NP['car-owner'];
  var data = st.filtered;
  if (!data || data.length === 0) { npToast('暂无数据可导出'); return; }
  npExportExcelRows(
    '车主管理_' + npNowLocal().slice(0, 10).replace(/-/g, ''),
    ['客户编号', '客户姓名', '性别', '手机号', '邮箱', '购车日期', '车架号', '车型', '注册状态', '最近更新时间'],
    ['code', 'name', 'sex', 'phone', 'email', 'buyDate', 'vin', 'model', 'valid', 'updateTime'],
    data
  );
  npToast('导出成功');
}

/* ---- 新增/编辑弹窗 ---- */
function coOpenForm(mode, idx) {
  var r = null;
  if (mode === 'edit') {
    r = npFindByIdx(NP['car-owner'].allData, idx);
    if (!r) { npToast('未找到该车主'); return; }
  }
  var isEdit = (mode === 'edit');
  var body =
    '<div class="pm-form-grid">' +
      '<div class="lt-input-wrap required plain"><span class="lt-filter-prefix">客户姓名</span><input type="text" id="co-form-name" maxlength="20" placeholder="请输入" value="' + (isEdit ? npEscape(r.name) : '') + '"></div>' +
      '<div class="lt-input-wrap"><span class="lt-filter-prefix">性别</span><select id="co-form-sex"><option value="">请选择</option><option' + (isEdit && r.sex === '男' ? ' selected' : '') + '>男</option><option' + (isEdit && r.sex === '女' ? ' selected' : '') + '>女</option></select></div>' +
      '<div class="lt-input-wrap required plain"><span class="lt-filter-prefix">手机号</span><input type="text" id="co-form-phone" maxlength="11" placeholder="请输入" value="' + (isEdit ? npEscape(r.phone) : '') + '"></div>' +
      '<div class="lt-input-wrap plain"><span class="lt-filter-prefix">邮箱</span><input type="text" id="co-form-email" maxlength="50" placeholder="请输入" value="' + (isEdit ? npEscape(r.email) : '') + '"></div>' +
      '<div class="lt-input-wrap plain"><span class="lt-filter-prefix">购车日期</span><input type="text" id="co-form-buydate" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" onchange="this.classList.remove(\'date-shim\')" value="' + (isEdit ? npEscape(r.buyDate) : '') + '"></div>' +
      '<div class="lt-input-wrap required plain"><span class="lt-filter-prefix">车架号</span><input type="text" id="co-form-vin" maxlength="17" placeholder="请输入" value="' + (isEdit ? npEscape(r.vin) : '') + '"></div>' +
      '<div class="lt-input-wrap"><span class="lt-filter-prefix">车型</span><select id="co-form-model"><option value="">请选择</option>' +
        CO_CAR_MODELS.map(function (m) {
          return '<option' + (isEdit && r.model === m ? ' selected' : '') + '>' + npEscape(m) + '</option>';
        }).join('') +
      '</select></div>' +
      '<div class="lt-input-wrap"><span class="lt-filter-prefix">注册状态</span><select id="co-form-valid"><option' + (!isEdit || r.valid === '有效' ? ' selected' : '') + '>有效</option><option' + (isEdit && r.valid === '无效' ? ' selected' : '') + '>无效</option></select></div>' +
      '<div class="lt-input-wrap plain"><span class="lt-filter-prefix">备注</span><input type="text" id="co-form-remark" maxlength="100" placeholder="请输入" value="' + (isEdit ? npEscape(r.remark || '') : '') + '"></div>' +
    '</div>';
  var footer = '<button class="lt-btn lt-btn-primary" onclick="coSaveForm(\'' + mode + '\',' + (isEdit ? idx : -1) + ')">保存</button>';
  npOpenModal(isEdit ? '编辑车主' : '新增车主', body, footer, { width: 720 });
}

/* ---- 保存 ---- */
function coSaveForm(mode, idx) {
  var get = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var name = get('co-form-name');
  var phone = get('co-form-phone');
  var vin = get('co-form-vin');
  if (!name) { npToast('请输入客户姓名'); return; }
  if (!phone) { npToast('请输入手机号'); return; }
  if (!vin) { npToast('请输入车架号'); return; }

  var st = NP['car-owner'];
  var data = {
    name: name,
    sex: get('co-form-sex'),
    phone: phone,
    email: get('co-form-email'),
    buyDate: get('co-form-buydate'),
    vin: vin,
    model: get('co-form-model'),
    valid: get('co-form-valid') || '有效',
    remark: get('co-form-remark'),
    updateTime: npNowLocal()
  };

  if (mode === 'edit') {
    var r = npFindByIdx(st.allData, idx);
    if (!r) { npToast('未找到该车主'); return; }
    Object.keys(data).forEach(function (k) { r[k] = data[k]; });
  } else {
    data.idx = npNextIdx(st.allData);
    data.code = 'KH' + (20250 + data.idx);
    st.allData.unshift(data);
  }
  /* 同步全局客档来源，保证配件销售读到最新数据 */
  window.CAR_OWNERS = st.allData;
  npCloseModal();
  st.allData = st.allData.slice();
  st.query();
  npToast(mode === 'edit' ? '保存成功' : '新增成功');
}

/* ---- 删除 ---- */
function coDelete(idx) {
  var st = NP['car-owner'];
  var r = npFindByIdx(st.allData, idx);
  if (!r) { npToast('未找到该车主'); return; }
  var dup = 0;
  for (var i = 0; i < st.allData.length; i++) { if (st.allData[i].vin === r.vin) dup++; }
  if (dup > 1) { npToast('该车架号已被其他车主占用，无法删除'); return; }
  if (!window.confirm('确认删除车主「' + r.name + '」？')) return;
  st.allData = st.allData.filter(function (x) { return x.idx !== idx; });
  window.CAR_OWNERS = st.allData;
  st.filtered = st.filtered.filter(function (x) { return x.idx !== idx; });
  st.render();
  npToast('删除成功');
}

/* ---- 页面初始化 ---- */
function initCarOwner() {
  var K = 'car-owner';
  var root = document.getElementById('page-car-owner');
  if (!root) return;

  /* 查询区 */
  var filter =
    npFItem('客户姓名', '<input type="text" id="' + K + '-f-name" placeholder="请输入">') +
    npFItem('客户编号', '<input type="text" id="' + K + '-f-code" placeholder="请输入">') +
    npFItem('手机号', '<input type="text" id="' + K + '-f-phone" placeholder="请输入">') +
    npSelect('注册状态', '<select id="' + K + '-f-valid"><option value="">请选择</option><option value="有效">有效</option><option value="无效">无效</option></select>');

  /* 工具栏 */
  var toolbar = '<button class="lt-btn lt-btn-primary" onclick="coOpenForm(\'add\',-1)">新增</button>' +
    '<button class="lt-btn lt-btn-default" onclick="coExport()">导出</button>';

  var cols = coCols();

  root.innerHTML = npShell(K, { l2: '系统设置', l3: '车主管理' }, filter, toolbar, npTH(cols), K + '-tbody', K + '-pager');

  /* 状态 */
  NP[K] = { page: 1, pageSize: 20, allData: window.CAR_OWNERS.slice(), filtered: [], render: null, query: null, reset: null };
  var st = NP[K];

  initFilterGrid(K + '-filterGrid', 7); st._fShow = 7; st._fExp = false;

  function readFilters() {
    var g = function (id) { var e = document.getElementById(K + id); return e ? e.value.trim() : ''; };
    return { name: g('-f-name'), code: g('-f-code'), phone: g('-f-phone'), valid: g('-f-valid') };
  }

  st.query = function () {
    var f = readFilters();
    st.filtered = st.allData.filter(function (r) {
      return (f.name === '' || r.name.indexOf(f.name) >= 0) &&
        (f.code === '' || r.code.indexOf(f.code) >= 0) &&
        (f.phone === '' || r.phone.indexOf(f.phone) >= 0) &&
        (f.valid === '' || r.valid === f.valid);
    });
    st.page = 1; st.render();
  };

  st.reset = function () {
    ['-f-name', '-f-code', '-f-phone'].forEach(function (s) {
      var e = document.getElementById(K + s); if (e) e.value = '';
    });
    var ev = document.getElementById(K + '-f-valid'); if (ev) ev.value = '';
    st.filtered = st.allData.slice(); st.page = 1; st.render();
  };

  st.render = function () { npRenderTable(K, K + '-tbody', K + '-pager', cols, st.filtered, st); };

  st.filtered = st.allData.slice(); st.page = 1; st.render();
}

/* 模块登记：走 app.js 的 npInitModule 统一调度，不改 showContent 的 if 链 */
npRegisterModuleInit('car-owner', function () { initCarOwner(); });
