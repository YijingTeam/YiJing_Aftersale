/* =========== 归档分类配置（总部，依据《关单归档树.xlsx》3层树） =========== */
/* 依赖 app.js 中的通用 helper：npOpenModal / npCloseModal / npFItem / npTH / npRenderTable / npEscape / npToast */
var ARC = { tree: [], view: 'tree', expanded: {}, search: '', maxLevel: 3 };
/* 种子数据：每行 = [1级, 2级, 3级]（依据《关单归档树.xlsx》3层；原 4/5 列"备注"为一次性维护痕迹，按 Q2 丢弃；Q3 增加 创建/更新时间） */
var ARC_SEED = [
  ['无效工单', '', ''],
  ['疑难案件', '软件偶发', ''],
  ['疑难案件', '硬件偶发', ''],
  ['疑难案件', '复杂案件', ''],
  ['疑难案件', '无案例案例精确性不足', ''],
  ['疑难案件', '无标准或标准不清晰', ''],
  ['疑难案件', '符合参数要求但车辆异常', ''],
  ['疑难案件', 'OTA异常', ''],
  ['疑难案件', '保修判定', ''],
  ['疑难案件', '辅助驾驶类案件定性', ''],
  ['门店诊断能力', '未查阅维修案例或技术公告等', ''],
  ['门店诊断能力', '门店排查工具不足', ''],
  ['门店诊断能力', '人员诊断能力不足', ''],
  ['门店诊断能力', '未完成基础排查', ''],
  ['门店诊断能力', '门店配合度不足', ''],
  ['专项', '电池', '电池压差（清单内）'],
  ['专项', '电池', '电池弹窗'],
  ['专项', '服务活动', ''],
  ['专项', '异响专项', '底盘异响'],
  ['专项', '异响专项', '内饰异响'],
  ['专项', '异响专项', '传动转向异响'],
  ['专项', '异响专项', '空调异响（出风口蒸发器）'],
  ['专项', '异响专项', '车身钣金异响'],
  ['专项', '异响专项', '减速器异响'],
  ['专项', '异响专项', '电驱异响'],
  ['专项', '异响专项', '扬声器异响'],
  ['专项', '异响专项', '压缩机异响'],
  ['专项', '异响专项', '其他'],
  ['专项', '重大事件', '上报信息'],
  ['流程咨询报备', '保修问题咨询', ''],
  ['流程咨询报备', '亲善申请', ''],
  ['流程咨询报备', '高风险案例报备', ''],
  ['流程咨询报备', '申请外力鉴定报告', ''],
  ['流程咨询报备', '质量包拉通维修（已经判断）', ''],
  ['门店改善建议', '产品体验类', ''],
  ['门店改善建议', '可维修性建议', ''],
  ['门店改善建议', '电路图/维修手册错误/不完善', ''],
  ['门店改善建议', '诊断仪软件bug', ''],
  ['门店改善建议', '质量信息反馈', ''],
  ['门店无权限（非能力问题）', '电池压差查询', ''],
  ['门店无权限（非能力问题）', 'OTA升级（特殊问题修复&更换大屏主机推送OTA）', ''],
  ['门店无权限（非能力问题）', '流量查询', ''],
  ['门店无权限（非能力问题）', '维修模式进入调码', ''],
  ['门店无权限（非能力问题）', '非技术支持类', ''],
  ['其他', '', '']
];

function arcSeedTime() {
  // 种子创建/更新时间默认 2026-07-21（用户指定：创建=2026-07-21，更新≥2026-07-21）
  function p(n){ return (n < 10 ? '0' : '') + n; }
  return '2026-07-21 ' + p(9) + ':' + p(0) + ':' + p(0);
}
function arcNowStr() {
  var d = new Date();
  function p(n){ return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function buildArcTreeFromSeed() {
  var tree = [];
  var idc = 0;
  function findChild(arr, name) {
    for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) return arr[i]; }
    return null;
  }
  ARC_SEED.forEach(function (row, ri) {
    var labels = [row[0], row[1], row[2]].filter(function (x) { return x && x !== ''; });
    var t = arcSeedTime();
    var parent = null;
    var level = 0;
    var arr = tree;
    labels.forEach(function (name) {
      level++;
      var node = findChild(arr, name);
      if (!node) {
        node = { id: 'arc' + (idc++), name: name, parentId: parent ? parent.id : null, level: level, createdAt: t, updatedAt: t, children: [] };
        arr.push(node);
      }
      parent = node; arr = node.children;
    });
  });
  return tree;
}

function arcFindById(arr, id) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === id) return arr[i];
    var f = arcFindById(arr[i].children, id); if (f) return f;
  }
  return null;
}
function arcPathName(arr, id) {
  var node = arcFindById(arr, id);
  if (!node || !node.parentId) return node ? node.name : '';
  return arcPathName(arr, node.parentId) + ' / ' + node.name;
}
function arcFlatten(arr, lv1, lv2, lv3) {
  var out = [];
  arr.forEach(function (n) {
    var a = lv1, b = lv2, c = lv3;
    if (n.level === 1) a = n.name; else if (n.level === 2) b = n.name; else if (n.level === 3) c = n.name;
    var row = { id: n.id, lv1: a, lv2: b, lv3: c, level: n.level, createdAt: n.createdAt, updatedAt: n.updatedAt };
    if (!n.children || n.children.length === 0) out.push(row);
    if (n.children && n.children.length) out = out.concat(arcFlatten(n.children, a, b, c));
  });
  return out;
}

function initArchiveCategory() {
  ARC.tree = buildArcTreeFromSeed();
  ARC.view = 'tree';
  ARC.expanded = {};
  ARC.tree.forEach(function (n) { ARC.expanded[n.id] = true; });
  if (!NP['archive-category']) NP['archive-category'] = { page: 1, pageSize: 10, filtered: [], render: null };
  NP['archive-category'].page = 1;

  var root = document.getElementById('page-archive-category');
  root.innerHTML =
    '<div class="lt-wrap">' +
      '<div class="lt-filter"><div class="lt-filter-grid" id="arc-filterGrid">' +
        npFItem('分类名称', '<input type="text" id="arc-f-name" class="np-input" placeholder="请输入">') +
        npFItem('层级', '<select id="arc-f-level" class="np-input"><option value="">全部</option><option>1级</option><option>2级</option><option>3级</option></select>') +
        '<div class="lt-filter-footer"><button class="lt-btn-filter primary" onclick="arcSearch()">查询</button><button class="lt-btn-filter default" onclick="arcReset()">重置</button><a href="javascript:void(0)" class="lt-filter-toggle" onclick="arcToggleFilter()">收起</a></div>' +
      '</div></div>' +
      '<div class="lt-list-area">' +
        '<div class="lt-toolbar"><div class="lt-toolbar-left">' +
          '<button class="lt-btn lt-btn-primary" onclick="arcOpenAdd(-1)">+ 新增根分类</button>' +
          '<button class="lt-btn lt-btn-default" onclick="arcImport()">导入</button>' +
          '<button class="lt-btn lt-btn-default" onclick="arcExport()">导出</button>' +
          '<button class="lt-btn lt-btn-default" onclick="arcExpandAll()">展开全部</button>' +
          '<button class="lt-btn lt-btn-default" onclick="arcCollapseAll()">收起全部</button>' +
          '<button class="lt-btn lt-btn-default" id="arc-view-btn" onclick="arcSwitchView()">切换为平铺表</button>' +
        '</div></div>' +
        '<div class="lt-table-wrap" style="background:#fff;"><div id="arc-view"></div></div>' +
        '<div class="lt-pager" id="arc-pager"></div>' +
      '</div></div>';
  arcSearch();
}

function arcToggleFilter() { var g = document.getElementById('arc-filterGrid'); if (!g) return; g.style.display = (g.style.display === 'none') ? '' : 'none'; }

function arcMatch(node) {
  var name = (document.getElementById('arc-f-name') || {}).value || '';
  var lv = (document.getElementById('arc-f-level') || {}).value || '';
  if (name && node.name.indexOf(name) < 0) return false;
  if (lv && lv !== node.level + '级') return false;
  return true;
}

function arcSearch() {
  var hasFilter = [document.getElementById('arc-f-name'), document.getElementById('arc-f-level')].some(function (e) { return e && e.value !== ''; });
  if (hasFilter) {
    (function markMatch(arr) {
      arr.forEach(function (n) {
        var hit = arcMatch(n);
        var childHit = markMatch(n.children);
        if (hit || childHit) ARC.expanded[n.id] = true;
        return hit || childHit;
      });
    })(ARC.tree);
  }
  arcRender();
}

function arcReset() {
  ['arc-f-name', 'arc-f-level'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
  ARC.expanded = {};
  ARC.tree.forEach(function (n) { ARC.expanded[n.id] = true; });
  arcRender();
}

function arcRender() {
  var box = document.getElementById('arc-view');
  if (!box) return;
  if (ARC.view === 'tree') arcRenderTree(); else arcRenderFlat();
}

function arcRenderTree() {
  var box = document.getElementById('arc-view');
  function rowHtml(node) {
    var hasChild = node.children && node.children.length > 0;
    var expanded = !!ARC.expanded[node.id];
    var toggle = hasChild
      ? '<span class="arc-toggle ' + (expanded ? 'open' : '') + '" onclick="arcToggle(\'' + node.id + '\')">' + (expanded ? '▾' : '▸') + '</span>'
      : '<span class="arc-toggle empty"></span>';
    var childBtn = (node.level < ARC.maxLevel)
      ? '<a href="javascript:void(0)" class="lt-link" onclick="arcOpenAdd(\'' + node.id + '\')">+子级</a>'
      : '<a href="javascript:void(0)" class="lt-link arc-disabled" onclick="arcMaxLevelTip()">+子级</a>';
    var actions = '<span class="arc-actions">' + childBtn +
      '<a href="javascript:void(0)" class="lt-link" onclick="arcOpenEdit(\'' + node.id + '\')">编辑</a>' +
      '<a href="javascript:void(0)" class="lt-link np-red" onclick="arcDelete(\'' + node.id + '\')">删除</a></span>';
    var html = '<div class="arc-node" style="--lv:' + node.level + ';">' +
      '<div class="arc-row">' + toggle +
      '<span class="arc-name">' + npEscape(node.name) + '</span>' +
      (node.updatedAt ? '<span class="arc-remark" title="更新时间 ' + npEscape(node.updatedAt) + '">更新 ' + npEscape(node.updatedAt) + '</span>' : '') +
      actions + '</div>';
    if (hasChild && expanded) {
      html += '<div class="arc-children">';
      node.children.forEach(function (c) { html += rowHtml(c); });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }
  var html = '<div class="arc-tree">';
  if (ARC.tree.length === 0) html += '<div class="arc-empty">暂无数据，点击「+ 新增根分类」添加</div>';
  ARC.tree.forEach(function (n) { html += rowHtml(n); });
  html += '</div>';
  var pg = document.getElementById('arc-pager'); if (pg) pg.style.display = 'none';
  box.innerHTML = html;
}

function arcRenderFlat() {
  var K = 'archive-category';
  var data = arcFlatten(ARC.tree, '', '', '');
  var name = (document.getElementById('arc-f-name') || {}).value || '';
  var lv = (document.getElementById('arc-f-level') || {}).value || '';
  data = data.filter(function (r) {
    if (name && (r.lv1 + r.lv2 + r.lv3).indexOf(name) < 0) return false;
    if (lv) {
      var rowLv = r.lv3 ? '3级' : (r.lv2 ? '2级' : '1级');
      if (lv !== rowLv) return false;
    }
    return true;
  });
  var cols = [
    { t: '序号', w: 60, f: function (r, i) { return i + 1; } },
    { t: '操作', w: 170, f: function (r) {
      var childBtn = (r.level < ARC.maxLevel)
        ? '<a href="javascript:void(0)" class="lt-link" onclick="arcOpenAdd(\'' + r.id + '\')">+子级</a>'
        : '<a href="javascript:void(0)" class="lt-link arc-disabled" onclick="arcMaxLevelTip()">+子级</a>';
      return childBtn + ' <a href="javascript:void(0)" class="lt-link" onclick="arcOpenEdit(\'' + r.id + '\')">编辑</a> <a href="javascript:void(0)" class="lt-link np-red" onclick="arcDelete(\'' + r.id + '\')">删除</a>';
    } },
    { t: '层级1', f: function (r) { return npEscape(r.lv1); } },
    { t: '层级2', f: function (r) { return npEscape(r.lv2); } },
    { t: '层级3', f: function (r) { return npEscape(r.lv3); } },
    { t: '创建时间', w: 130, f: function (r) { return npEscape(r.createdAt || ''); } },
    { t: '更新时间', w: 130, f: function (r) { return npEscape(r.updatedAt || ''); } }
  ];
  NP[K].filtered = data;
  NP[K].page = 1;
  NP[K].render = function () { npRenderTable(K, 'arc-tbody', 'arc-pager', cols, NP[K].filtered, NP[K]); };
  var box = document.getElementById('arc-view');
  var pg = document.getElementById('arc-pager'); if (pg) pg.style.display = '';
  box.innerHTML = '<table class="lt-table"><thead><tr>' + npTH(cols) + '</tr></thead><tbody id="arc-tbody"></tbody></table>';
  NP[K].render();
}

function arcToggle(id) { ARC.expanded[id] = !ARC.expanded[id]; arcRenderTree(); }
function arcExpandAll() { (function set(arr) { arr.forEach(function (n) { ARC.expanded[n.id] = true; set(n.children); }); })(ARC.tree); arcRenderTree(); }
function arcCollapseAll() { (function set(arr) { arr.forEach(function (n) { if (n.children && n.children.length) ARC.expanded[n.id] = false; set(n.children); }); })(ARC.tree); arcRenderTree(); }
function arcSwitchView() {
  ARC.view = (ARC.view === 'tree') ? 'flat' : 'tree';
  var btn = document.getElementById('arc-view-btn');
  if (btn) btn.textContent = (ARC.view === 'tree') ? '切换为平铺表' : '切换为树形';
  arcRender();
}
function arcMaxLevelTip() { npToast('已达最大层级（' + ARC.maxLevel + '级），不能再新增子级'); }

function arcOpenAdd(parentId) {
  var parent = (parentId && parentId !== -1) ? arcFindById(ARC.tree, parentId) : null;
  var pathTxt = parent ? arcPathName(ARC.tree, parent.id) : '（无，作为一级分类）';
  var html =
    '<div class="np-form">' +
      '<div class="np-field"><label class="np-req">分类名称</label><input id="arc-m-name" class="np-input" placeholder="请输入分类名称"></div>' +
      '<div class="np-field"><label>上级分类</label><span class="arc-parent-path">' + npEscape(pathTxt) + '</span></div>' +
    '</div>';
  var pid = parent ? ('\'' + parent.id + '\'') : 'null';
  npOpenModal(parent ? '新增子分类' : '新增根分类', html,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="arcSave(-1,' + pid + ')">确定</button>');
  setTimeout(function () { var e = document.getElementById('arc-m-name'); if (e) e.focus(); }, 50);
}

function arcOpenEdit(id) {
  var node = arcFindById(ARC.tree, id);
  if (!node) { npToast('未找到节点'); return; }
  var pathTxt = node.parentId ? arcPathName(ARC.tree, node.parentId) : '（无，作为一级分类）';
  var html =
    '<div class="np-form">' +
      '<div class="np-field"><label class="np-req">分类名称</label><input id="arc-m-name" class="np-input" value="' + npEscape(node.name) + '"></div>' +
      '<div class="np-field"><label>上级分类</label><span class="arc-parent-path">' + npEscape(pathTxt) + '</span></div>' +
      '<div class="np-field"><label>创建时间</label><span class="arc-parent-path">' + npEscape(node.createdAt || '') + '</span></div>' +
      '<div class="np-field"><label>更新时间</label><span class="arc-parent-path">' + npEscape(node.updatedAt || '') + '</span></div>' +
    '</div>';
  npOpenModal('编辑分类', html,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="arcSave(\'' + id + '\', null)">确定</button>');
}

/* id === -1 表示新增：parentId 有值=子级，null=根；否则为编辑已有节点（id 为字符串） */
function arcSave(id, parentId) {
  var name = (document.getElementById('arc-m-name') || {}).value || '';
  if (!name || !name.trim()) { npToast('请填写分类名称'); return; }
  name = name.trim();
  var now = arcNowStr();
  if (id === -1) {
    if (parentId) {
      var p = arcFindById(ARC.tree, parentId);
      if (!p) { npToast('未找到上级'); return; }
      p.children.push({ id: 'arc' + Date.now() + Math.floor(Math.random() * 1000), name: name, parentId: p.id, level: p.level + 1, createdAt: now, updatedAt: now, children: [] });
    } else {
      ARC.tree.push({ id: 'arc' + Date.now() + Math.floor(Math.random() * 1000), name: name, parentId: null, level: 1, createdAt: now, updatedAt: now, children: [] });
    }
  } else {
    var node = arcFindById(ARC.tree, id);
    if (!node) { npToast('未找到节点'); return; }
    node.name = name; node.updatedAt = now;
  }
  npCloseModal();
  arcRender();
  npToast('已保存');
}

function arcDelete(id) {
  var node = arcFindById(ARC.tree, id);
  if (!node) return;
  var hasChild = node.children && node.children.length > 0;
  var msg = hasChild ? ('确定删除「' + node.name + '」及其下全部子分类？此操作不可恢复。') : ('确定删除「' + node.name + '」？');
  if (!confirm(msg)) return;
  var arr;
  if (node.parentId) {
    var parent = arcFindById(ARC.tree, node.parentId);
    arr = parent ? parent.children : ARC.tree;
  } else {
    arr = ARC.tree;
  }
  for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) { arr.splice(i, 1); break; } }
  arcRender();
  npToast('已删除');
}

function arcExport() {
  var rows = arcFlatten(ARC.tree, '', '', '');
  var header = ['1级', '2级', '3级', '创建时间', '更新时间'];
  var lines = [header.join(',')];
  rows.forEach(function (r) {
    lines.push([r.lv1, r.lv2, r.lv3, r.createdAt, r.updatedAt].map(function (v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(','));
  });
  var csv = '﻿' + lines.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = '归档分类配置_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  npToast('已导出 CSV');
}

function arcDownloadTemplate() {
  var header = ['1级', '2级', '3级', '创建时间', '更新时间'];
  var lines = [header.join(',')];
  var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '归档分类_导入模板.csv';
  a.click();
}

function arcDoImport(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var text = e.target.result;
      var lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
        if (lines.length < 2) { npToast('文件无数据'); return; }
      lines.slice(1).forEach(function (line) {
        var cells = line.split(',');
        var lv1 = (cells[0] || '').trim(), lv2 = (cells[1] || '').trim(), lv3 = (cells[2] || '').trim(), createdAt = (cells[3] || '').trim(), updatedAt = (cells[4] || '').trim();
        if (!lv1) return;
        var labels = [lv1, lv2, lv3].filter(function (x) { return x; });
        var parent = null, arr = ARC.tree, level = 0;
        labels.forEach(function (name) {
          level++;
          var found = null;
          for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) { found = arr[i]; break; } }
          if (!found) {
            found = { id: 'arc' + Date.now() + Math.floor(Math.random() * 100000) + level, name: name, parentId: parent ? parent.id : null, level: level, createdAt: createdAt || arcNowStr(), updatedAt: updatedAt || arcNowStr(), children: [] };
            arr.push(found);
          } else if (level === labels.length) { found.createdAt = createdAt || found.createdAt; found.updatedAt = updatedAt || found.updatedAt; }
          parent = found; arr = found.children;
        });
      });
      arcRender();
      npToast('已导入 ' + (lines.length - 1) + ' 行');
      npCloseModal();
    } catch (err) { npToast('导入失败：' + err.message); }
  };
  reader.readAsText(file, 'utf-8');
}

function arcImport() {
  var body = '<div style="padding:4px 0">' +
    '<p style="margin:0 0 10px"><a href="javascript:void(0)" style="color:#861B2F;font-size:13px;text-decoration:underline" onclick="arcDownloadTemplate()">下载导入模板</a></p>' +
    '<div id="arc-drop-zone" style="border:2px dashed #d9d9d9;border-radius:6px;padding:40px 20px;text-align:center;cursor:pointer;color:#999;transition:border-color .2s,background .2s">' +
    '<p style="margin:0 0 8px;font-size:14px;color:#666">将文件拖到此处，或<span style="color:#861B2F;text-decoration:underline">点击选择文件</span></p>' +
    '<p style="margin:0;font-size:12px;color:#bbb">支持 .csv 格式</p>' +
    '<input type="file" id="arc-import-file" accept=".csv" style="display:none">' +
    '</div>' +
    '<p style="margin:10px 0 0;font-size:12px;color:#999">≤1000条，按1级/2级/3级分类名称解析，自动创建或更新树节点</p>' +
    '</div>';
  npOpenModal('导入分类数据', body, '', { width: 560 });
  setTimeout(function () {
    var zone = document.getElementById('arc-drop-zone');
    var input = document.getElementById('arc-import-file');
    if (!zone || !input) return;
    zone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { arcDoImport(input.files[0]); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = '#861B2F'; zone.style.background = '#fdf5f6'; });
    zone.addEventListener('dragleave', function (e) { e.preventDefault(); zone.style.borderColor = '#d9d9d9'; zone.style.background = ''; });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.style.borderColor = '#d9d9d9'; zone.style.background = '';
      arcDoImport(e.dataTransfer.files[0]);
    });
  }, 50);
}
