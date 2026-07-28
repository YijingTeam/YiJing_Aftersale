/* =========== 归档分类配置2（总部，仿故障树三列联列布局） =========== */
/* 依赖 app.js 中的通用 helper：npOpenModal / npCloseModal / npEscape / npToast */
/* 数据复用 archive-category.js 中的 ARC_SEED 与 buildArcTreeFromSeed() */

var FT2 = {
  tree: [],
  selected: [null, null, null], // 三列各自选中的节点 id（字符串或 null）
  search: '',
  matchIds: new Set()          // 搜索匹配的节点 id 集合
};

/* ---- 复用 archive-category.js 的种子数据与构建函数（若尚未定义则抄一份） ---- */
if (typeof ARC_SEED === 'undefined') {
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
    ['专项', '异响专题', '扬声器异响'],
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
}

if (typeof buildArcTreeFromSeed === 'undefined') {
  function buildArcTreeFromSeed() {
    var tree = [];
    var idc = 0;
    function findChild(arr, name) {
      for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) return arr[i]; }
      return null;
    }
    function seedTime() { return '2026-07-21 09:00:00'; }
    ARC_SEED.forEach(function (row) {
      var labels = [row[0], row[1], row[2]].filter(function (x) { return x && x !== ''; });
      var t = seedTime();
      var parent = null;
      var level = 0;
      var arr = tree;
      labels.forEach(function (name) {
        level++;
        var node = findChild(arr, name);
        if (!node) {
          node = { id: 'ft2' + (idc++), name: name, parentId: parent ? parent.id : null, level: level, status: 'enable', createdAt: t, updatedAt: t, children: [] };
          arr.push(node);
        }
        parent = node; arr = node.children;
      });
    });
    return tree;
  }
}

/* 复用 archive-category.js 的查找函数 */
if (typeof arcFindById === 'undefined') {
  function arcFindById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
      var f = arcFindById(arr[i].children, id); if (f) return f;
    }
    return null;
  }
}

function ft2NowStr() {
  var d = new Date();
  function p(n){ return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* 统计子节点总数（递归） */
function ft2CountChildren(node) {
  if (!node.children || !node.children.length) return 0;
  var c = node.children.length;
  node.children.forEach(function (ch) { c += ft2CountChildren(ch); });
  return c;
}

/* 获取面包屑路径文字 */
function ft2Breadcrumb() {
  var parts = [];
  for (var i = 0; i < 3; i++) {
    if (FT2.selected[i]) {
      var n = arcFindById(FT2.tree, FT2.selected[i]);
      if (n) parts.push(n.name);
    } else { break; }
  }
  return parts.length > 0 ? parts.join(' / ') : '';
}

/* 获取某节点的完整路径（含自身，用 / 连接）；用于弹窗"上级分类"展示 */
function ft2FullPath(node) {
  var parts = [];
  var cur = node;
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? arcFindById(FT2.tree, cur.parentId) : null;
  }
  return parts.length ? parts.join('/') : '';
}

/* ==================== 初始化 ==================== */

function initArchiveCategory2() {
  FT2.tree = buildArcTreeFromSeed();
  FT2.selected = [null, null, null];
  FT2.search = '';
  FT2.matchIds = new Set();

  // 默认选中第一个一级分类
  if (FT2.tree.length > 0) {
    FT2.selected[0] = FT2.tree[0].id;
    if (FT2.tree[0].children && FT2.tree[0].children.length > 0) {
      FT2.selected[1] = FT2.tree[0].children[0].id;
    }
  }

  var root = document.getElementById('page-archive-category2');
  root.innerHTML =
    '<div class="lt-wrap">' +
      '<div class="ft2-topbar">' +
        '<span class="ft2-breadcrumb" id="ft2-breadcrumb"></span>' +
        '<div class="ft2-topbar-right">' +
          '<input type="text" class="ft2-search-input" id="ft2-search" placeholder="搜索 分类名称" onkeydown="if(event.key===\'Enter\')ft2Locate()">' +
          '<button class="lt-btn lt-btn-primary" onclick="ft2Locate()">定位</button>' +
          '<button class="lt-btn lt-btn-default" onclick="ft2ClearSearch()">清空搜索</button>' +
          '<button class="lt-btn lt-btn-default" onclick="ft2Import()">批量导入</button>' +
          '<button class="lt-btn lt-btn-default" onclick="ft2Export()">导出</button>' +
        '</div>' +
      '</div>' +
      '<div class="ft2-result-bar" id="ft2-result-bar" style="display:none;">' +
        '<span class="ft2-result-count" id="ft2-result-count"></span>' +
        '<span class="ft2-result-tags" id="ft2-result-tags"></span>' +
      '</div>' +
      '<div class="ft2-cascade">' +
        '<div class="ft2-col" id="ft2-col-0">' +
          '<div class="ft2-col-header"><span class="ft2-col-title">一级分类</span><span class="ft2-col-count" id="ft2-count-0">0项</span><a class="ft2-col-add" onclick="ft2OpenAdd(null)">+ 新增</a></div>' +
          '<div class="ft2-col-body" id="ft2-body-0"></div>' +
        '</div>' +
        '<div class="ft2-col" id="ft2-col-1">' +
          '<div class="ft2-col-header"><span class="ft2-col-title">二级分类</span><span class="ft2-col-count" id="ft2-count-1">0项</span><a class="ft2-col-add" onclick="ft2OpenAdd(0)">+ 新增</a></div>' +
          '<div class="ft2-col-body" id="ft2-body-1"></div>' +
        '</div>' +
        '<div class="ft2-col" id="ft2-col-2">' +
          '<div class="ft2-col-header"><span class="ft2-col-title">三级分类</span><span class="ft2-col-count" id="ft2-count-2">0项</span><a class="ft2-col-add" onclick="ft2OpenAdd(1)">+ 新增</a></div>' +
          '<div class="ft2-col-body" id="ft2-body-2"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  ft2Render();
}

/* ==================== 渲染 ==================== */

function ft2Render() {
  ft2RenderCol(0); // 一级：始终显示全部根节点
  ft2RenderCol(1); // 二级：根据列1选中项显示子节点
  ft2RenderCol(2); // 三级：根据列2选中项显示子节点
  ft2UpdateBreadcrumb();
  ft2UpdateResultBar();
}

function ft2RenderCol(colIdx) {
  var bodyId = 'ft2-body-' + colIdx;
  var countId = 'ft2-count-' + colIdx;
  var body = document.getElementById(bodyId);
  var countEl = document.getElementById(countId);
  if (!body) return;

  var items;
  if (colIdx === 0) {
    items = FT2.tree; // 根级全部
  } else {
    var parentId = FT2.selected[colIdx - 1];
    if (!parentId) { items = []; }
    else {
      var parent = arcFindById(FT2.tree, parentId);
      items = parent ? parent.children : [];
    }
  }

  // 更新计数
  if (countEl) countEl.textContent = items.length + '项';

  if (items.length === 0) {
    body.innerHTML = '<div class="ft2-empty">暂无数据</div>';
    return;
  }

  var html = '';
  items.forEach(function (node) {
    var sel = FT2.selected[colIdx] === node.id;
    var matched = FT2.search && FT2.matchIds.has(node.id);
    var childCnt = ft2CountChildren(node);
    var selCls = sel ? ' selected' : '';
    var matchCls = matched ? ' ft2-matched' : '';

    html += '<div class="ft2-row' + selCls + matchCls + '" onclick="ft2Select(\'' + node.id + '\',' + colIdx + ')">' +
      '<span class="ft2-row-name" title="' + npEscape(node.name) + '">' + npEscape(node.name) + '</span>' +
      (childCnt > 0 ? '<span class="ft2-badge">' + childCnt + '</span>' : '') +
      '<span class="ft2-status ' + (node.status === 'enable' ? 'ft2-status-enable' : 'ft2-status-disable') + '">' + (node.status === 'enable' ? '启用' : '停用') + '</span>' +
      '<span class="ft2-actions">' +
        '<a href="javascript:void(0)" class="ft2-action-icon" title="编辑" onclick="event.stopPropagation();ft2OpenEdit(\'' + node.id + '\')">✎</a>' +
        '<a href="javascript:void(0)" class="ft2-action-icon" title="删除" onclick="event.stopPropagation();ft2Delete(\'' + node.id + '\')">🗑</a>' +
      '</span>' +
    '</div>';
  });

  body.innerHTML = html;
}

function ft2UpdateBreadcrumb() {
  var el = document.getElementById('ft2-breadcrumb');
  if (el) { var b = ft2Breadcrumb(); el.textContent = b ? b : ''; el.style.visibility = b ? 'visible' : 'hidden'; }
}

function ft2UpdateResultBar() {
  var bar = document.getElementById('ft2-result-bar');
  var cntEl = document.getElementById('ft2-result-count');
  var tagsEl = document.getElementById('ft2-result-tags');
  if (!bar) return;

  if (!FT2.search) { bar.style.display = 'none'; return; }

  bar.style.display = '';
  var matchNames = [];
  FT2.matchIds.forEach(function (id) {
    var n = arcFindById(FT2.tree, id);
    if (n) matchNames.push(n.name);
  });

  if (cntEl) cntEl.textContent = '找到 ' + FT2.matchIds.size + ' 条';
  if (tagsEl) tagsEl.innerHTML = matchNames.slice(0, 20).map(function (n) {
    return '<span class="ft2-tag">' + npEscape(n) + '</span>';
  }).join('');
}

/* ==================== 交互 ==================== */

function ft2Select(id, colIdx) {
  FT2.selected[colIdx] = id;
  // 清除右侧列的选中态
  for (var j = colIdx + 1; j < 3; j++) { FT2.selected[j] = null; }
  ft2Render();

  // 滚动选中行到可见区域
  setTimeout(function () {
    var body = document.getElementById('ft2-body-' + colIdx);
    if (body) {
      var selRow = body.querySelector('.ft2-row.selected');
      if (selRow) selRow.scrollIntoView({ block: 'nearest' });
    }
  }, 0);
}

function ft2OnSearch() {
  var input = document.getElementById('ft2-search');
  FT2.search = input ? (input.value || '').trim() : '';
  FT2.matchIds = new Set();

  if (FT2.search) {
    (function collectMatch(arr) {
      arr.forEach(function (n) {
        if (n.name.indexOf(FT2.search) >= 0) FT2.matchIds.add(n.id);
        collectMatch(n.children);
      });
    })(FT2.tree);
  }

  ft2Render();
}

function ft2ClearSearch() {
  var input = document.getElementById('ft2-search');
  if (input) input.value = '';
  FT2.search = '';
  FT2.matchIds = new Set();
  ft2Render();
}

function ft2Locate() {
  ft2OnSearch();
}

/* ==================== CRUD ==================== */

/* colParentIdx: null=新增一级, 0=在当前选中的一级下新增二级, 1=在当前选中的二级下新增三级 */
function ft2OpenAdd(colParentIdx) {
  var parentId = null;
  var parentPath = '根节点';
  var parentNode = null;
  var levelLabel = '一级分类';

  if (colParentIdx === null) {
    // 新增根级
    levelLabel = '一级分类';
    parentPath = '根节点';
  } else {
    parentId = FT2.selected[colParentIdx];
    if (!parentId) { npToast('请先选择父级分类'); return; }
    parentNode = arcFindById(FT2.tree, parentId);
    parentPath = parentNode ? ft2FullPath(parentNode) : '';
    levelLabel = colParentIdx === 0 ? '二级分类' : '三级分类';
  }

  var html =
    '<div class="np-form">' +
      '<div class="np-field"><label>上级分类</label><input id="ft2-m-parent" class="ft2-parent-input" value="' + npEscape(parentPath) + '" disabled></div>' +
      '<div class="np-field"><label class="np-req">分类名称</label><input id="ft2-m-name" class="np-input" placeholder="请输入分类名称"></div>' +
    '</div>';

  var pidJs = parentId ? ('\'' + parentId + '\'') : 'null';
  npOpenModal('新增' + levelLabel, html,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="ft2Save(-1,' + pidJs + ')">确定</button>');
  setTimeout(function () { var e = document.getElementById('ft2-m-name'); if (e) e.focus(); }, 50);
}

function ft2OpenEdit(id) {
  var node = arcFindById(FT2.tree, id);
  if (!node) { npToast('未找到节点'); return; }
  var parentNode = node.parentId ? arcFindById(FT2.tree, node.parentId) : null;
  var parentPath = parentNode ? ft2FullPath(parentNode) : '根节点';

  var html =
    '<div class="np-form">' +
      '<div class="np-field"><label>上级分类</label><input id="ft2-m-parent" class="ft2-parent-input" value="' + npEscape(parentPath) + '" disabled></div>' +
      '<div class="np-field"><label class="np-req">分类名称</label><input id="ft2-m-name" class="np-input" value="' + npEscape(node.name) + '"></div>' +
      '<div class="np-field"><label>状态</label>' +
        '<select id="ft2-m-status" class="np-input"><option value="enable"' + (node.status === 'enable' ? ' selected' : '') + '>启用</option><option value="disable"' + (node.status !== 'enable' ? ' selected' : '') + '>停用</option></select>' +
      '</div>' +
      '<div class="np-field"><label>创建时间</label><span class="arc-parent-path">' + npEscape(node.createdAt || '') + '</span></div>' +
      '<div class="np-field"><label>更新时间</label><span class="arc-parent-path">' + npEscape(node.updatedAt || '') + '</span></div>' +
    '</div>';

  npOpenModal('编辑分类', html,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button><button class="lt-btn lt-btn-primary" onclick="ft2Save(\'' + id + '\',null)">确定</button>');
}

function ft2Save(id, parentId) {
  var name = (document.getElementById('ft2-m-name') || {}).value || '';
  if (!name || !name.trim()) { npToast('请填写分类名称'); return; }
  name = name.trim();
  var now = ft2NowStr();
  var statusEl = document.getElementById('ft2-m-status');
  var status = statusEl ? statusEl.value : 'enable';

  if (id === -1) {
    // 新增
    if (parentId) {
      var p = arcFindById(FT2.tree, parentId);
      if (!p) { npToast('未找到上级'); return; }
      var newNode = { id: 'ft2' + Date.now() + Math.floor(Math.random() * 1000), name: name, parentId: p.id, level: p.level + 1, status: status, createdAt: now, updatedAt: now, children: [] };
      p.children.push(newNode);
      // 自动选中新节点所在列
      var targetCol = p.level; // 父级level=1→新节点在列1(二级)，父级level=2→新节点在列2(三级)
      if (targetCol < 3) FT2.selected[targetCol] = newNode.id;
      // 清除右侧
      for (var k = targetCol + 1; k < 3; k++) FT2.selected[k] = null;
    } else {
      var newNode = { id: 'ft2' + Date.now() + Math.floor(Math.random() * 1000), name: name, parentId: null, level: 1, status: status, createdAt: now, updatedAt: now, children: [] };
      FT2.tree.push(newNode);
      FT2.selected[0] = newNode.id;
      FT2.selected[1] = null;
      FT2.selected[2] = null;
    }
  } else {
    // 编辑
    var node = arcFindById(FT2.tree, id);
    if (!node) { npToast('未找到节点'); return; }
    node.name = name;
    node.status = status;
    node.updatedAt = now;
  }

  npCloseModal();
  ft2Render();
  npToast('已保存');
}

function ft2Delete(id) {
  var node = arcFindById(FT2.tree, id);
  if (!node) return;
  var hasChild = node.children && node.children.length > 0;
  var msg = hasChild ? ('确定删除「' + node.name + '」及其下全部子分类？此操作不可恢复。') : ('确定删除「' + node.name + '」？');
  if (!confirm(msg)) return;

  // 从父节点的 children 中移除
  var arr;
  if (node.parentId) {
    var parent = arcFindById(FT2.tree, node.parentId);
    arr = parent ? parent.children : FT2.tree;
  } else {
    arr = FT2.tree;
  }
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === id) { arr.splice(i, 1); break; }
  }

  // 清除相关选中态
  for (var c = 0; c < 3; c++) {
    if (FT2.selected[c] === id) FT2.selected[c] = null;
  }

  ft2Render();
  npToast('已删除');
}

/* ==================== 导入 / 导出 ==================== */

function ft2Export() {
  /* 复用 archive-category.js 的 arcFlatten 或自己展平 */
  function flatten(arr, lv1, lv2, lv3) {
    var out = [];
    arr.forEach(function (n) {
      var a = lv1, b = lv2, c = lv3;
      if (n.level === 1) a = n.name; else if (n.level === 2) b = n.name; else if (n.level === 3) c = n.name;
      var row = { lv1: a, lv2: b, lv3: c, status: n.status };
      if (!n.children || n.children.length === 0) out.push(row);
      if (n.children && n.children.length) out = out.concat(flatten(n.children, a, b, c));
    });
    return out;
  }

  var rows = flatten(FT2.tree, '', '', '');
  var header = ['一级分类', '二级分类', '三级分类', '状态'];
  var lines = [header.join(',')];
  rows.forEach(function (r) {
    lines.push([r.lv1, r.lv2, r.lv3, r.status].map(function (v) {
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

function ft2DownloadTemplate() {
  var header = ['1级', '2级', '3级', '状态'];
  var lines = [header.join(',')];
  var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '归档分类_导入模板.csv';
  a.click();
}

function ft2DoImport(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var text = e.target.result;
      var lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
        if (lines.length < 2) { npToast('文件无数据'); return; }
        var imported = 0;
        lines.slice(1).forEach(function (line) {
          var cells = line.split(',');
          var lv1 = (cells[0] || '').trim(), lv2 = (cells[1] || '').trim(), lv3 = (cells[2] || '').trim(), status = (cells[3] || '').trim() || 'enable';
          if (!lv1) return;
          var labels = [lv1, lv2, lv3].filter(function (x) { return x; });
          var parent = null, arr = FT2.tree, level = 0, found = null;
          labels.forEach(function (name) {
            level++;
            found = null;
            for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) { found = arr[i]; break; } }
            if (!found) {
              found = { id: 'ft2' + Date.now() + Math.floor(Math.random() * 100000) + level, name: name, parentId: parent ? parent.id : null, level: level, status: status, createdAt: ft2NowStr(), updatedAt: ft2NowStr(), children: [] };
              arr.push(found);
            }
            parent = found; arr = found.children;
          });
          imported++;
        });
        ft2Render();
        npToast('已导入 ' + imported + ' 行');
        npCloseModal();
      } catch (err) { npToast('导入失败：' + err.message); }
    };
    reader.readAsText(file, 'utf-8');
  }

function ft2Import() {
  var body = '<div style="padding:4px 0">' +
    '<p style="margin:0 0 10px"><a href="javascript:void(0)" style="color:#861B2F;font-size:13px;text-decoration:underline" onclick="ft2DownloadTemplate()">下载导入模板</a></p>' +
    '<div id="ft2-drop-zone" style="border:2px dashed #d9d9d9;border-radius:6px;padding:40px 20px;text-align:center;cursor:pointer;color:#999;transition:border-color .2s,background .2s">' +
    '<p style="margin:0 0 8px;font-size:14px;color:#666">将文件拖到此处，或<span style="color:#861B2F;text-decoration:underline">点击选择文件</span></p>' +
    '<p style="margin:0;font-size:12px;color:#bbb">支持 .csv 格式</p>' +
    '<input type="file" id="ft2-import-file" accept=".csv" style="display:none">' +
    '</div>' +
    '<p style="margin:10px 0 0;font-size:12px;color:#999">按1级/2级/3级分类名称解析，自动创建树节点</p>' +
    '</div>';
  npOpenModal('批量导入分类', body, '', { width: 560 });
  setTimeout(function () {
    var zone = document.getElementById('ft2-drop-zone');
    var input = document.getElementById('ft2-import-file');
    if (!zone || !input) return;
    zone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { ft2DoImport(input.files[0]); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = '#861B2F'; zone.style.background = '#fdf5f6'; });
    zone.addEventListener('dragleave', function (e) { e.preventDefault(); zone.style.borderColor = '#d9d9d9'; zone.style.background = ''; });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.style.borderColor = '#d9d9d9'; zone.style.background = '';
      ft2DoImport(e.dataTransfer.files[0]);
    });
  }, 50);
}
