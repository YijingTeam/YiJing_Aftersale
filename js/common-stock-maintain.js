/* ============ 常用件建储维护 ============ */
/* 依赖 app.js 通用 helper：npShell / npTH / npRenderTable / npFItem / npEscape / npToast / npOpenModal / npCloseModal / initFilterGrid */
/* 依赖 common-stock.js：CS_CAT_OPTS / CS_ATTR_OPTS / csComboMarkup / csComboboxFilter / csComboboxShow / csComboboxToggle / csComboboxSelect */
/* 本页功能：查询列表 + 导出 + 导入（更新建议数量/是否有效并记录变更）+ 变更记录弹窗 */

/* ---- 车系字典（复用 common-stock.js csSeed 中定义）---- */
var CSM_CAR_OPTS = ['奕境S 2024款', '奕境X9 纯电版', '奕境X9 增程版', '奕境X10', '奕境L7 PHEV', '奕境L7 EV'];

/* ---- Mock 数据 ---- */
function csmSeed() {
  var a = [];
  var cats = CS_CAT_OPTS;        // 5项：配件/精品附件/辅料/工具/虚拟件
  var attrs = CS_ATTR_OPTS;      // 12项：关键配件/自制件/沿用件/保养件/车身件/发动机件/变速箱件/电器/空调及安全设备/化学类原辅材料/精品/随车工具
  var names = ['刹车片', '机油滤清器', '空气滤清器', '火花塞', '雨刮片', '空调滤芯', '前大灯总成', '后尾灯总成', '冷凝器', '水箱', '蓄电池', '轮胎', '轮毂', '前减震器', '后减震器', '刹车盘', '离合器片', '正时皮带', '涨紧轮', '水泵', '发电机', '起动机', '方向机', '半轴'];
  var operators = ['张三', '李四', '王五', '赵六'];
  for (var i = 0; i < 24; i++) {
    var cat = cats[i % cats.length];
    var name = names[i];
    var code = 'P' + (200000 + i);
    var valid = i % 5 === 0 ? '无效' : '有效'; // 约20%无效
    var mm = ((i % 12) + 1);
    var dd = ((i % 28) + 1);
    var hh = 8 + (i % 10);
    var mi = (i * 7) % 60;
    var ss = (i * 13) % 60;
    var updateTime = '2025-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd) + ' ' + (hh < 10 ? '0' + hh : hh) + ':' + (mi < 10 ? '0' + mi : mi) + ':' + (ss < 10 ? '0' + ss : ss);
    var suggest = 15 + (i % 5) * 5;
    var price = (20 + (i % 15) * 12.5).toFixed(2);

    // 变更记录：约一半配件有 1~3 条
    var changeLog = [];
    if (i % 2 === 0) {
      var logCount = 1 + (i % 3);
      for (var j = 0; j < logCount; j++) {
        var lm = ((i + j + 5) % 12) + 1;
        var ld = ((i + j + 3) % 28) + 1;
        changeLog.push({
          code: code,
          name: name,
          suggest: suggest - (j + 1) * 2,
          valid: j % 2 === 0 ? '有效' : '无效',
          operator: operators[(i + j) % operators.length],
          time: '2025-' + (lm < 10 ? '0' + lm : lm) + '-' + (ld < 10 ? '0' + ld : ld) + ' 10:30:00'
        });
      }
      // 倒序：最新在前
      changeLog.reverse();
    }

    a.push({
      idx: i,
      code: code,
      name: name,
      cat: cat,
      attr: attrs[i % attrs.length],
      car: CSM_CAR_OPTS[i % CSM_CAR_OPTS.length],
      suggest: suggest,
      price: price,
      valid: valid,
      updateTime: updateTime,
      changeLog: changeLog
    });
  }
  return a;
}
var CSM_ALL = csmSeed();

/* ---- 列定义 ---- */
function csmCols() {
  return [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    { t: '配件编码', w: 110, cls: 'col-code sticky', f: function (r) { return r.code; } },
    { t: '配件名称', w: 170, cls: 'col-name sticky', f: function (r) { return npEscape(r.name); } },
    { t: '建议数量', w: 90, cls: 'col-suggest', f: function (r) { return r.suggest; } },
    { t: '单价（含税）', w: 110, cls: 'col-price', f: function (r) { return r.price; } },
    { t: '适用车系', w: 170, cls: 'col-car', f: function (r) { return npEscape(r.car); } },
    { t: '配件类别', w: 110, cls: 'col-cat', f: function (r) { return npEscape(r.cat); } },
    { t: '配件销售属性', w: 140, cls: 'col-attr', f: function (r) { return npEscape(r.attr); } },
    { t: '是否有效', w: 90, cls: 'col-valid', f: function (r) { return r.valid; } },
    { t: '最近更新时间', w: 150, cls: 'col-update', f: function (r) { return r.updateTime; } },
    { t: '操作', w: 100, cls: 'col-actions', f: function (r) { return '<a href="javascript:void(0)" class="lt-link" onclick="csmOpenLog(\'' + r.code + '\')">变更记录</a>'; } }
  ];
}

/* ---- 导出 ---- */
function csmExport() {
  var st = NP['common-stock-maintain'];
  var data = st.filtered;
  if (!data || data.length === 0) { npToast('暂无数据可导出'); return; }
  var cols = [
    { t: '序号', f: function (r, i) { return i + 1; } },
    { t: '配件编码', f: function (r) { return r.code; } },
    { t: '配件名称', f: function (r) { return r.name; } },
    { t: '建议数量', f: function (r) { return r.suggest; } },
    { t: '单价（含税）', f: function (r) { return r.price; } },
    { t: '适用车系', f: function (r) { return r.car; } },
    { t: '配件类别', f: function (r) { return r.cat; } },
    { t: '配件销售属性', f: function (r) { return r.attr; } },
    { t: '是否有效', f: function (r) { return r.valid; } },
    { t: '最近更新时间', f: function (r) { return r.updateTime; } }
  ];
  var header = cols.map(function (c) { return c.t; });
  var rows = data.map(function (r, i) { return cols.map(function (c) { return c.f(r, i); }); });
  var wsData = [header].concat(rows);
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '常用件建储维护');
  var now = new Date();
  var dn = '常用件建储维护_' + now.getFullYear() + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1) + (now.getDate() < 10 ? '0' : '') + now.getDate() + '.xlsx';
  XLSX.writeFile(wb, dn);
  npToast('导出成功');
}

/* ---- 导入：下载模板 ---- */
function csmDownloadTemplate() {
  var header = ['配件编码', '配件名称', '建议数量', '是否有效'];
  var ws = XLSX.utils.aoa_to_sheet([header]);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '导入模板');
  XLSX.writeFile(wb, '常用件建储维护_导入模板.xlsx');
}

/* ---- 导入：解析文件 ---- */
function csmDoImport(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var wb = XLSX.read(e.target.result, { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length < 2) { npToast('文件无数据行'); return; }
    var expected = ['配件编码', '配件名称', '建议数量', '是否有效'];
    for (var h = 0; h < expected.length; h++) {
      if (!rows[0][h] || rows[0][h].toString().trim() !== expected[h]) {
        npToast('模板格式不正确，表头应为：' + expected.join(' / ')); return;
      }
    }
    var succ = 0; var fail = 0; var failCodes = [];
    var now = new Date();
    var timeStr = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1) + '-' + (now.getDate() < 10 ? '0' : '') + now.getDate() + ' ' + (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row[0]) continue;
      var code = row[0].toString().trim();
      var newSuggest = parseInt(row[2], 10);
      var newValid = (row[3] || '').toString().trim();
      if (newValid !== '有效' && newValid !== '无效') { fail++; failCodes.push(code + '(是否有效值错误)'); continue; }
      if (isNaN(newSuggest) || newSuggest < 0) { fail++; failCodes.push(code + '(建议数量格式错误)'); continue; }
      var found = false;
      for (var d = 0; d < CSM_ALL.length; d++) {
        if (CSM_ALL[d].code === code) {
          found = true;
          if (!CSM_ALL[d].changeLog) CSM_ALL[d].changeLog = [];
          CSM_ALL[d].changeLog.unshift({ code: code, name: CSM_ALL[d].name, suggest: CSM_ALL[d].suggest, valid: CSM_ALL[d].valid, operator: '导入操作', time: timeStr });
          CSM_ALL[d].suggest = newSuggest;
          CSM_ALL[d].valid = newValid;
          CSM_ALL[d].updateTime = timeStr;
          succ++;
          break;
        }
      }
      if (!found) { fail++; failCodes.push(code); }
    }
    var st = NP['common-stock-maintain'];
    st.allData = CSM_ALL.slice(); st.reset();
    var msg = '成功更新 ' + succ + ' 条';
    if (fail > 0) { msg += '，失败 ' + fail + ' 条'; if (failCodes.length <= 3) msg += '（' + failCodes.join('、') + '）'; else msg += '（' + failCodes.slice(0, 3).join('、') + ' 等）'; }
    npToast(msg);
    npCloseModal();
  };
  reader.readAsArrayBuffer(file);
}

/* ---- 导入弹窗（拖拽上传区） ---- */
function csmOpenImport() {
  var body = '<div style="padding:4px 0">' +
    '<p style="margin:0 0 10px"><a href="javascript:void(0)" style="color:#861B2F;font-size:13px;text-decoration:underline" onclick="csmDownloadTemplate()">下载导入模板</a></p>' +
    '<div id="csm-drop-zone" style="border:2px dashed #d9d9d9;border-radius:6px;padding:40px 20px;text-align:center;cursor:pointer;color:#999;transition:border-color .2s,background .2s">' +
    '<p style="margin:0 0 8px;font-size:14px;color:#666">将文件拖到此处，或<span style="color:#861B2F;text-decoration:underline">点击选择文件</span></p>' +
    '<p style="margin:0;font-size:12px;color:#bbb">支持 .xlsx / .xls 格式</p>' +
    '<input type="file" id="csm-import-file" accept=".xlsx,.xls" style="display:none">' +
    '</div>' +
    '<p style="margin:10px 0 0;font-size:12px;color:#999">≤1000条，按配件编码匹配，更新建议数量和是否有效，自动记录变更</p>' +
    '</div>';
  npOpenModal('导入数据', body, '', { width: 560 });

  // 绑定拖拽事件
  setTimeout(function () {
    var zone = document.getElementById('csm-drop-zone');
    var input = document.getElementById('csm-import-file');
    if (!zone || !input) return;

    zone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { csmDoImport(input.files[0]); });

    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = '#861B2F'; zone.style.background = '#fdf5f6'; });
    zone.addEventListener('dragleave', function (e) { e.preventDefault(); zone.style.borderColor = '#d9d9d9'; zone.style.background = ''; });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.style.borderColor = '#d9d9d9'; zone.style.background = '';
      var file = e.dataTransfer.files[0];
      csmDoImport(file);
    });
  }, 50);
}

/* ---- 变更记录弹窗 ---- */
function csmOpenLog(code) {
  var item = null;
  for (var i = 0; i < CSM_ALL.length; i++) {
    if (CSM_ALL[i].code === code) { item = CSM_ALL[i]; break; }
  }
  if (!item) { npToast('未找到该配件'); return; }

  var logs = item.changeLog || [];
  var title = '变更记录 - ' + item.code + ' ' + npEscape(item.name);

  if (logs.length === 0) {
    npOpenModal(title, '<div style="text-align:center;padding:40px;color:#999;font-size:14px">暂无变更记录</div>', '');
    return;
  }

  // 构建弹窗内表格
  var tbodyId = 'csm-log-tbody';
  var bodyHtml = '<div style="overflow-x:auto"><table class="lt-table csm-log-table" style="min-width:680px"><thead><tr>' +
    '<th class="col-seq" style="width:40px;min-width:40px;max-width:40px">序号</th>' +
    '<th class="col-code" style="width:80px;min-width:80px;max-width:80px">配件编码</th>' +
    '<th class="col-name" style="width:120px;min-width:120px;max-width:120px">配件名称</th>' +
    '<th class="col-suggest" style="min-width:90px">建议数量</th>' +
    '<th class="col-valid" style="min-width:90px">是否有效</th>' +
    '<th class="col-operator" style="min-width:100px">操作人员</th>' +
    '<th class="col-time" style="min-width:160px">维护时间</th>' +
    '</tr></thead><tbody id="' + tbodyId + '"></tbody></table></div>';

  npOpenModal(title, bodyHtml, '');

  // 渲染行
  setTimeout(function () {
    var tb = document.getElementById(tbodyId);
    if (!tb) return;
    var h = '';
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      h += '<tr>' +
        '<td class="col-seq">' + (i + 1) + '</td>' +
        '<td class="col-code">' + npEscape(l.code) + '</td>' +
        '<td class="col-name">' + npEscape(l.name) + '</td>' +
        '<td class="col-suggest">' + l.suggest + '</td>' +
        '<td class="col-valid">' + npEscape(l.valid) + '</td>' +
        '<td class="col-operator">' + npEscape(l.operator) + '</td>' +
        '<td class="col-time">' + npEscape(l.time) + '</td>' +
        '</tr>';
    }
    tb.innerHTML = h;
  }, 50);
}

/* ---- 页面初始化 ---- */
function initCommonStockMaintain() {
  var K = 'common-stock-maintain';
  var root = document.getElementById('page-common-stock-maintain');
  if (!root) return;

  /* 筛选区 */
  var filter = npFItem('配件编码', '<input type="text" id="' + K + '-f-code" placeholder="请输入">') +
    npFItem('配件名称', '<input type="text" id="' + K + '-f-name" placeholder="请输入">') +
    '<div class="lt-filter-item"><div class="lt-input-wrap"><span class="lt-filter-prefix">是否有效</span><select id="' + K + '-f-valid"><option value="">全部</option><option value="有效" selected>有效</option><option value="无效">无效</option></select></div></div>' +
    csComboMarkup(K, K + '-f-car', '适用车系', CSM_CAR_OPTS);

  /* 工具栏 */
  var toolbar = '<button class="lt-btn lt-btn-default" onclick="csmExport()">导出</button>' +
    '<button class="lt-btn lt-btn-default" onclick="csmOpenImport()">导入</button>';

  /* 列 */
  var cols = csmCols();

  /* 外壳 */
  root.innerHTML = npShell(K, { l2: '配件订单管理', l3: '常用件建储维护' }, filter, toolbar, npTH(cols), K + '-tbody', K + '-pager');

  /* 状态 */
  NP[K] = { page: 1, pageSize: 20, allData: CSM_ALL.slice(), filtered: [], render: null, query: null, reset: null };
  var st = NP[K];

  initFilterGrid(K + '-filterGrid', 4); st._fShow = 4; st._fExp = false;

  /* 查询 */
  st.query = function () {
    var c = (document.getElementById(K + '-f-code') || {}).value || '';
    var n = (document.getElementById(K + '-f-name') || {}).value || '';
    var v = (document.getElementById(K + '-f-valid') || {}).value || '';
    var car = (document.getElementById(K + '-f-car') || {}).value || '';
    st.filtered = st.allData.filter(function (r) {
      return (c === '' || r.code.indexOf(c) >= 0) &&
        (n === '' || r.name.indexOf(n) >= 0) &&
        (v === '' || r.valid === v) &&
        (car === '' || r.car.indexOf(car) >= 0);
    });
    st.page = 1; st.render();
  };

  /* 重置 */
  st.reset = function () {
    ['-f-code', '-f-name', '-f-car'].forEach(function (s) { var e = document.getElementById(K + s); if (e) e.value = ''; });
    var ev = document.getElementById(K + '-f-valid'); if (ev) ev.value = '有效';
    st.filtered = st.allData.filter(function(r){ return r.valid === '有效'; }); st.page = 1; st.render();
  };

  /* 渲染 */
  st.render = function () { npRenderTable(K, K + '-tbody', K + '-pager', cols, st.filtered, st); };

  /* 初始渲染 */
  st.filtered = st.allData.filter(function(r){ return r.valid === '有效'; }); st.page = 1; st.render();
}
