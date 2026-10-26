/* ============================================================
   财务管理 —— 配件销售收款 / 配件销售退款
   依据：飞书《奕境售后》5.4.1 / 5.4.2（只取元素与字段口径；样式与布局按原型规范）
   数据来源（唯一权威，不另造数据）：
     psoOrderAll()              配件销售单（parts-sales.js）
     psoCancelAll()             销售取消单
     psoReturnAll()             销售退货单
     window.CAR_OWNERS          客档（联系电话）
     NP['store-manage'].allData 门店主数据（直营 → 收款渠道只能是支付平台收款）
   复用 app.js 公共组件（不自造）：
     npShell / npRenderTable / npTH / npRenderActions / npFItem / npSelect /
     npEscape / npToast / npOpenModal / npCloseModal / npDefaultDateRange /
     npNowLocal / initFilterGrid / npRegisterModuleInit
   约定：行操作取数传单据号；时间秒级 YYYY-MM-DD HH:mm:ss；金额两位小数
   ============================================================ */

/* ---------------- 收付款字典（唯一一处，收款页与退款页共用） ---------------- */
window.PS_FIN = {
  CH_OWN: '门店自行收款',
  CH_PLATFORM: '支付平台收款',
  CH_RFD_OWN: '门店自行退款',
  CH_RFD_PLATFORM: '支付平台退款',
  METHOD_OWN: ['微信', '支付宝', '银行', '现金', '内部'],
  METHOD_PLATFORM: ['微信扫码', '支付宝扫码'],
  BILL_TYPES: ['增值税发票', '普通发票', '收据'],
  PAY_STATUS: ['未收款', '部分收款', '已结清'],
  REFUND_STATUS: ['未退款', '已退款'],
  REFUND_TYPES: ['销售取消', '销售退货']
};

/* ============================================================
   一、取数与计算（纯函数，可被测试直接调用）
   ============================================================ */

/* 客档电话：店销客户（公司）没有客档 → '—' */
function psfinPhone(name) {
  var list = window.CAR_OWNERS || [];
  for (var i = 0; i < list.length; i++) { if (list[i].name === name) return list[i].phone || '—'; }
  return '—';
}

/* 门店主数据取数（门店管理是门店信息唯一来源） */
function psfinStore(code) {
  var all = (NP['store-manage'] && NP['store-manage'].allData) || [];
  for (var i = 0; i < all.length; i++) { if (all[i].code === code) return all[i]; }
  return null;
}
/* 直营店只能走支付平台收款（非直营两种都可以） */
function psfinIsDirect(code) {
  var s = psfinStore(code);
  return !!(s && s.channelMode === '直营');
}

/* 时间加分钟（收款/退款时间 = 单据提交时间之后若干分钟） */
function psfinAddMin(t, min) {
  var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return npNowLocal();
  var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6] + min);
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* ---- 收款记录：orderNo → [{ch, method, amount, time, billType, billNo, billAmount}] ---- */
function psfinPayMap() {
  if (window.__PSF_PAY) return window.__PSF_PAY;
  var map = {};
  (typeof psoOrderAll === 'function' ? psoOrderAll() : []).forEach(function (o, i) {
    var arr = [];
    if (o.payStatus === '已结清') {
      arr.push({
        ch: PS_FIN.CH_OWN, method: '微信', amount: o.amount, time: psfinAddMin(o.submitTime, 12 + i),
        billType: '普通发票', billNo: '', billAmount: 0
      });
    } else if (o.payStatus === '部分收款') {
      arr.push({
        ch: PS_FIN.CH_OWN, method: '支付宝', amount: psoMoney(parseFloat(o.amount) * 0.6),
        time: psfinAddMin(o.submitTime, 25 + i), billType: '收据', billNo: '', billAmount: 0
      });
    }
    map[o.orderNo] = arr;
  });
  window.__PSF_PAY = map;
  return map;
}

/* ---- 退款记录：单据编号（取消单号/退货单号）→ [{amount, time, ch, method}] ---- */
function psfinRefundMap() {
  if (window.__PSF_RFD) return window.__PSF_RFD;
  var map = {};
  var add = function (docNo, amount, time, status) {
    var arr = [];
    if (status === '已退款') {
      arr.push({ ch: PS_FIN.CH_RFD_OWN, method: '微信', amount: amount, time: psfinAddMin(time, 40) });
    } else if (status === '部分退款') {
      arr.push({ ch: PS_FIN.CH_RFD_OWN, method: '微信', amount: psoMoney(parseFloat(amount) * 0.5), time: psfinAddMin(time, 40) });
    }
    map[docNo] = arr;
  };
  (typeof psoCancelAll === 'function' ? psoCancelAll() : []).forEach(function (c) { add(c.cancelNo, c.amount, c.cancelTime, c.refundStatus); });
  (typeof psoReturnAll === 'function' ? psoReturnAll() : []).forEach(function (r) { add(r.returnNo, r.amount, r.returnTime, r.refundStatus); });
  window.__PSF_RFD = map;
  return map;
}

function psfinSum(list, key) {
  var s = 0;
  (list || []).forEach(function (x) { s += parseFloat(x[key] || 0) || 0; });
  return Math.round(s * 100) / 100;
}
function psfinReceived(orderNo) { return psfinSum(psfinPayMap()[orderNo], 'amount'); }
function psfinRefunded(docNo) { return psfinSum(psfinRefundMap()[docNo], 'amount'); }

/* 收款登记情况：按收款记录实时算（收了钱状态就变，不靠种子标签） */
function psfinPayStatusOf(o) {
  var got = psfinReceived(o.orderNo);
  if (got <= 0) return '未收款';
  return got + 0.005 >= parseFloat(o.amount) ? '已结清' : '部分收款';
}

/* 收款列表行：配件销售单里「有效」的单 */
function psfinPayRows() {
  return (typeof psoOrderAll === 'function' ? psoOrderAll() : [])
    .filter(function (o) { return o.docStatus === '有效'; })
    .map(function (o) {
      return {
        orderNo: o.orderNo, store: o.store, storeCode: o.storeCode, customer: o.customer,
        phone: psfinPhone(o.customer), amount: o.amount, received: psoMoney(psfinReceived(o.orderNo)),
        payStatus: psfinPayStatusOf(o), submitter: o.submitter, submitTime: o.submitTime,
        submitDate: String(o.submitTime || '').slice(0, 10)
      };
    })
    .sort(function (a, b) { return a.submitTime < b.submitTime ? 1 : -1; });
}

/* 退款列表行：销售取消单 + 销售退货单 */
function psfinRefundRows() {
  var rows = [];
  (typeof psoCancelAll === 'function' ? psoCancelAll() : []).forEach(function (c) {
    rows.push({
      type: '销售取消', docNo: c.cancelNo, orderNo: c.orderNo, store: c.store, storeCode: c.storeCode,
      customer: c.customer, amount: c.amount, submitter: c.submitter, submitTime: c.cancelTime
    });
  });
  (typeof psoReturnAll === 'function' ? psoReturnAll() : []).forEach(function (r) {
    rows.push({
      type: '销售退货', docNo: r.returnNo, orderNo: r.orderNo, store: r.store, storeCode: r.storeCode,
      customer: r.customer, amount: r.amount, submitter: r.submitter, submitTime: r.returnTime
    });
  });
  rows.forEach(function (x) {
    x.phone = psfinPhone(x.customer);
    x.refunded = psoMoney(psfinRefunded(x.docNo));
    x.refundStatus = parseFloat(x.refunded) > 0 ? '已退款' : '未退款';
    x.submitDate = String(x.submitTime || '').slice(0, 10);
  });
  return rows.sort(function (a, b) { return a.submitTime < b.submitTime ? 1 : -1; });
}

/* ============================================================
   二、配件销售收款
   ============================================================ */
(function () {
  var K = 'parts-sales-receipt';
  var P = 'psf-pay';
  var st = null;

  function cols() {
    return [
      { t: '序号', w: 50, f: function (r, i) { return i + 1; } },
      {
        t: '销售单号', w: 140, f: function (r) {
          return '<a href="javascript:void(0)" class="lt-link" onclick="psfinOpenFlow(\'' + r.orderNo + '\')">' + npEscape(r.orderNo) + '</a>';
        }
      },
      { t: '门店名称', w: 110, f: function (r) { return npEscape(r.store); } },
      { t: '门店编码', w: 100, f: function (r) { return npEscape(r.storeCode); } },
      { t: '客户', w: 120, f: function (r) { return npEscape(r.customer); } },
      { t: '联系电话', w: 130, f: function (r) { return npEscape(r.phone); } },
      { t: '销售单金额', w: 110, f: function (r) { return npEscape(r.amount); } },
      { t: '已收金额', w: 110, f: function (r) { return npEscape(r.received); } },
      {
        t: '收款登记情况', w: 110, f: function (r) {
          var cls = r.payStatus === '已结清' ? 'ok' : (r.payStatus === '部分收款' ? 'warn' : 'off');
          return '<span class="lt-badge ' + cls + '">' + npEscape(r.payStatus) + '</span>';
        }
      },
      { t: '提交人', w: 90, f: function (r) { return npEscape(r.submitter); } },
      { t: '提交时间', w: 160, f: function (r) { return npEscape(r.submitTime); } },
      /* 操作列必须放最后一列：.col-actions 是 position:sticky; right:0，
         放在中间会吸附到可视区右缘、盖住后面的列（2026-10-25 修） */
      {
        t: '操作', w: 170, cls: 'col-actions', f: function (r) {
          var ops = [];
          if (r.payStatus !== '已结清') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinOpenPay(\'' + r.orderNo + '\')">收款</a>');
          }
          if (r.payStatus !== '未收款') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinOpenFlow(\'' + r.orderNo + '\')">收退款详情</a>');
          }
          return npRenderActions(ops);
        }
      }
    ];
  }

  function filterHtml() {
    return npFItem('销售单号', '<input type="text" id="' + P + '-f-no" placeholder="请输入">') +
      npFItem('客户', '<input type="text" id="' + P + '-f-cust" placeholder="请输入">') +
      npSelect('收款登记情况', '<select id="' + P + '-f-status"><option value="">请选择</option>' +
        PS_FIN.PAY_STATUS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
      '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">提交日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="NP[\'' + K + '\'].query()">' +
      '<div class="lt-date-range-drop">' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-s" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '<span>—</span>' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-e" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div></div></div>';
  }

  function readRange() {
    var s = document.getElementById(P + '-d-s'); var e = document.getElementById(P + '-d-e');
    return { s: s ? s.value.trim() : '', e: e ? e.value.trim() : '' };
  }

  window.initPartsSalesReceipt = function () {
    var root = document.getElementById('page-' + K);
    if (!root) return;
    root.innerHTML = npShell(K, { l2: '财务管理', l3: '配件销售收款' }, filterHtml(), '', npTH(cols()), K + '-tbody', K + '-pager');
    NP[K] = { page: 1, pageSize: 20, allData: [], filtered: [], query: null, reset: null, render: null };
    st = NP[K];
    initFilterGrid(K + '-filterGrid', 7); st._fShow = 7; st._fExp = false;
    npDefaultDateRange(P + '-d-s', P + '-d-e');

    st.query = function () {
      var g = function (id) { var el = document.getElementById(P + id); return el ? el.value.trim() : ''; };
      var no = g('-f-no'), cust = g('-f-cust'), status = g('-f-status'), rg = readRange();
      st.allData = psfinPayRows();
      st.filtered = st.allData.filter(function (r) {
        return (no === '' || r.orderNo.indexOf(no) >= 0) &&
          (cust === '' || r.customer.indexOf(cust) >= 0) &&
          (status === '' || r.payStatus === status) &&
          (rg.s === '' || r.submitDate >= rg.s) &&
          (rg.e === '' || r.submitDate <= rg.e);
      });
      st.page = 1; st.render();
    };
    st.reset = function () {
      ['-f-no', '-f-cust'].forEach(function (s) { var el = document.getElementById(P + s); if (el) el.value = ''; });
      var se = document.getElementById(P + '-f-status'); if (se) se.value = '';
      var ds = document.getElementById(P + '-d-s'); if (ds) ds.value = '';
      var de = document.getElementById(P + '-d-e'); if (de) de.value = '';
      var tx = root.querySelector('.lt-date-range-text'); if (tx) tx.value = '';
      npDefaultDateRange(P + '-d-s', P + '-d-e');
      st.query();
    };
    st.render = function () { npRenderTable(K, K + '-tbody', K + '-pager', cols(), st.filtered, st); };
    st.query();
  };

  npRegisterModuleInit(K, function () { window.initPartsSalesReceipt(); });
})();

/* ============================================================
   三、配件销售退款
   ============================================================ */
(function () {
  var K = 'parts-sales-refund';
  var P = 'psf-rfd';
  var st = null;

  function cols() {
    return [
      { t: '序号', w: 50, f: function (r, i) { return i + 1; } },
      {
        t: '单据编号', w: 150, f: function (r) {
          return '<a href="javascript:void(0)" class="lt-link" onclick="psfinOpenFlow(\'' + r.docNo + '\')">' + npEscape(r.docNo) + '</a>';
        }
      },
      { t: '门店名称', w: 110, f: function (r) { return npEscape(r.store); } },
      { t: '门店编码', w: 100, f: function (r) { return npEscape(r.storeCode); } },
      { t: '退款类型', w: 100, f: function (r) { return npEscape(r.type); } },
      { t: '客户', w: 120, f: function (r) { return npEscape(r.customer); } },
      { t: '联系电话', w: 130, f: function (r) { return npEscape(r.phone); } },
      { t: '退款金额', w: 110, f: function (r) { return npEscape(r.amount); } },
      {
        t: '退款登记情况', w: 110, f: function (r) {
          return '<span class="lt-badge ' + (r.refundStatus === '已退款' ? 'ok' : 'off') + '">' + npEscape(r.refundStatus) + '</span>';
        }
      },
      { t: '提交人', w: 90, f: function (r) { return npEscape(r.submitter); } },
      { t: '提交时间', w: 160, f: function (r) { return npEscape(r.submitTime); } },
      /* 操作列必须放最后一列（同收款页口径） */
      {
        t: '操作', w: 170, cls: 'col-actions', f: function (r) {
          var ops = [];
          if (r.refundStatus === '未退款') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinOpenRefund(\'' + r.docNo + '\')">退款</a>');
          }
          ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinOpenFlow(\'' + r.docNo + '\')">收退款详情</a>');
          return npRenderActions(ops);
        }
      }
    ];
  }

  function filterHtml() {
    return npFItem('单据编号', '<input type="text" id="' + P + '-f-no" placeholder="请输入">') +
      npFItem('客户', '<input type="text" id="' + P + '-f-cust" placeholder="请输入">') +
      npSelect('退款登记情况', '<select id="' + P + '-f-status"><option value="">请选择</option>' +
        PS_FIN.REFUND_STATUS.map(function (o) {
          return '<option' + (o === '未退款' ? ' selected' : '') + '>' + npEscape(o) + '</option>';
        }).join('') + '</select>') +
      npSelect('退款类型', '<select id="' + P + '-f-type"><option value="">请选择</option>' +
        PS_FIN.REFUND_TYPES.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
      '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">提交日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="NP[\'' + K + '\'].query()">' +
      '<div class="lt-date-range-drop">' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-s" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '<span>—</span>' +
      '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + P + '-d-e" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div></div></div>';
  }

  function readRange() {
    var s = document.getElementById(P + '-d-s'); var e = document.getElementById(P + '-d-e');
    return { s: s ? s.value.trim() : '', e: e ? e.value.trim() : '' };
  }

  window.initPartsSalesRefund = function () {
    var root = document.getElementById('page-' + K);
    if (!root) return;
    root.innerHTML = npShell(K, { l2: '财务管理', l3: '配件销售退款' }, filterHtml(), '', npTH(cols()), K + '-tbody', K + '-pager');
    NP[K] = { page: 1, pageSize: 20, allData: [], filtered: [], query: null, reset: null, render: null };
    st = NP[K];
    initFilterGrid(K + '-filterGrid', 7); st._fShow = 7; st._fExp = false;
    npDefaultDateRange(P + '-d-s', P + '-d-e');

    st.query = function () {
      var g = function (id) { var el = document.getElementById(P + id); return el ? el.value.trim() : ''; };
      var no = g('-f-no'), cust = g('-f-cust'), status = g('-f-status'), type = g('-f-type'), rg = readRange();
      st.allData = psfinRefundRows();
      st.filtered = st.allData.filter(function (r) {
        return (no === '' || r.docNo.indexOf(no) >= 0) &&
          (cust === '' || r.customer.indexOf(cust) >= 0) &&
          (status === '' || r.refundStatus === status) &&
          (type === '' || r.type === type) &&
          (rg.s === '' || r.submitDate >= rg.s) &&
          (rg.e === '' || r.submitDate <= rg.e);
      });
      st.page = 1; st.render();
    };
    st.reset = function () {
      ['-f-no', '-f-cust'].forEach(function (s) { var el = document.getElementById(P + s); if (el) el.value = ''; });
      var se = document.getElementById(P + '-f-status'); if (se) se.value = '未退款';
      var te = document.getElementById(P + '-f-type'); if (te) te.value = '';
      var ds = document.getElementById(P + '-d-s'); if (ds) ds.value = '';
      var de = document.getElementById(P + '-d-e'); if (de) de.value = '';
      var tx = root.querySelector('.lt-date-range-text'); if (tx) tx.value = '';
      npDefaultDateRange(P + '-d-s', P + '-d-e');
      st.query();
    };
    st.render = function () { npRenderTable(K, K + '-tbody', K + '-pager', cols(), st.filtered, st); };
    st.query();
  };

  npRegisterModuleInit(K, function () { window.initPartsSalesRefund(); });
})();

/* ============================================================
   四、收款弹窗（门店自行收款 / 支付平台收款）
   ============================================================ */
window.psfinOpenPay = function (orderNo) {
  var row = psfinPayRows().filter(function (r) { return r.orderNo === orderNo; })[0];
  if (!row) { npToast('未找到该销售单'); return; }
  var canGet = Math.round((parseFloat(row.amount) - parseFloat(row.received)) * 100) / 100;
  if (canGet <= 0) { npToast('该销售单已结清，无需收款'); return; }
  var direct = psfinIsDirect(row.storeCode);
  var chans = direct ? [PS_FIN.CH_PLATFORM] : [PS_FIN.CH_OWN, PS_FIN.CH_PLATFORM];

  var html = '<div class="pm-form-grid">' +
    npFItem('单据编号', '<input type="text" id="psf-pay-no" value="' + npEscape(row.orderNo) + '" readonly>') +
    npSelect('收款渠道', '<select id="psf-pay-ch" onchange="psfinSyncPayMethod()">' +
      chans.map(function (c) { return '<option>' + npEscape(c) + '</option>'; }).join('') + '</select>') +
    npSelect('收款方式', '<select id="psf-pay-method"></select>') +
    npFItem('收款金额', '<input type="text" id="psf-pay-amount" value="' + canGet.toFixed(2) + '" placeholder="可收 ' + canGet.toFixed(2) + '">') +
    npSelect('票据类型', '<select id="psf-pay-billtype"><option value="">请选择</option>' +
      PS_FIN.BILL_TYPES.map(function (b) { return '<option>' + npEscape(b) + '</option>'; }).join('') + '</select>') +
    npFItem('票据号', '<input type="text" id="psf-pay-billno" placeholder="请输入">') +
    npFItem('票据金额', '<input type="text" id="psf-pay-billamount" placeholder="请输入">') +
    '</div>' +
    '<div class="psf-qr" id="psf-qr" style="display:none">' +
    '<div class="psf-qr-box">收款码</div>' +
    '<div class="psf-qr-tip">收款码有效期 15-30 分钟，如失效可重新发起获取新的支付二维码</div>' +
    '</div>' +
    '<div class="psf-hint">可收金额 ' + canGet.toFixed(2) + ' 元' + (direct ? '（直营店仅支持支付平台收款）' : '') + '</div>';

  npOpenModal('收款',
    html,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="psfinSubmitPay()">确认收款</button>',
    { width: 720 });
  window.__psfPayCtx = { orderNo: orderNo, canGet: canGet };
  psfinSyncPayMethod();
};

/* 收款渠道变化 → 收款方式候选跟着换；支付平台显示收款码 */
window.psfinSyncPayMethod = function () {
  var ch = (document.getElementById('psf-pay-ch') || {}).value || '';
  var sel = document.getElementById('psf-pay-method');
  var qr = document.getElementById('psf-qr');
  var isPlatform = ch === PS_FIN.CH_PLATFORM;
  var list = isPlatform ? PS_FIN.METHOD_PLATFORM : PS_FIN.METHOD_OWN;
  if (sel) {
    sel.innerHTML = '<option value="">请选择</option>' +
      list.map(function (m) { return '<option>' + m + '</option>'; }).join('');
    if (isPlatform) sel.value = list[0];
  }
  if (qr) qr.style.display = isPlatform ? '' : 'none';
};

window.psfinSubmitPay = function () {
  var ctx = window.__psfPayCtx || {};
  var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var ch = g('psf-pay-ch'), method = g('psf-pay-method'), amount = g('psf-pay-amount');
  var billType = g('psf-pay-billtype'), billNo = g('psf-pay-billno'), billAmount = g('psf-pay-billamount');
  if (!ch) { npToast('请选择收款渠道'); return; }
  if (!method) { npToast('请选择收款方式'); return; }
  var n = parseFloat(amount);
  if (isNaN(n) || n <= 0) { npToast('收款金额需大于 0'); return; }
  if (n - ctx.canGet > 0.005) { npToast('收款金额不能超过可收金额 ' + ctx.canGet.toFixed(2)); return; }
  var list = psfinPayMap()[ctx.orderNo] || (psfinPayMap()[ctx.orderNo] = []);
  list.push({
    ch: ch, method: method, amount: psoMoney(n), time: npNowLocal(),
    billType: billType || '—', billNo: billNo, billAmount: billAmount ? psoMoney(billAmount) : 0
  });
  npCloseModal();
  var st = NP['parts-sales-receipt']; if (st && st.query) st.query();
  npToast('收款成功');
};

/* ============================================================
   五、退款弹窗（可退金额范围内输入，合计须等于需退金额）
   ============================================================ */
window.psfinOpenRefund = function (docNo) {
  var row = psfinRefundRows().filter(function (r) { return r.docNo === docNo; })[0];
  if (!row) { npToast('未找到该单据'); return; }
  var pays = psfinPayMap()[row.orderNo] || [];
  if (!pays.length) { npToast('该单据对应销售单尚未收款，不能退款'); return; }
  var refunded = psfinRefunded(docNo);
  var need = Math.round((parseFloat(row.amount) - refunded) * 100) / 100;

  var body = '<div class="pm-form-grid">' +
    npFItem('单据编号', '<input type="text" id="psf-rfd-no" value="' + npEscape(row.docNo) + '" readonly>') +
    npFItem('退款类型', '<input type="text" value="' + npEscape(row.type) + '" readonly>') +
    npFItem('退款日期', '<input type="text" value="' + npEscape(npNowLocal().slice(0, 10)) + '" readonly>') +
    npFItem('操作人', '<input type="text" value="当前门店用户" readonly>') +
    npFItem('退款金额', '<input type="text" value="' + need.toFixed(2) + '" readonly>') +
    '</div>' +
    '<div class="lt-table-wrap" style="max-height:300px;margin-top:8px"><table class="lt-table"><thead><tr>' +
    npTH([
      { t: '序号', w: 50 }, { t: '收款渠道', w: 130 }, { t: '收款方式', w: 100 },
      { t: '收款金额', w: 100 }, { t: '收款时间', w: 160 }, { t: '已退金额', w: 100 },
      { t: '可退金额', w: 100 }, { t: '退款金额', w: 120 }
    ]) + '</tr></thead><tbody id="psf-rfd-tbody">' + psfinRefundTableHtml(pays, refunded) + '</tbody></table></div>' +
    '<div class="psf-hint">本次退款合计 <b id="psf-rfd-sum">0.00</b> 元，应为 ' + need.toFixed(2) + ' 元</div>';

  npOpenModal('退款 ' + row.docNo, body,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="psfinSubmitRefund()">确认退款</button>',
    { width: 900 });
  window.__psfRfdCtx = { docNo: docNo, need: need, orderNo: row.orderNo, refunded: refunded };
  psfinSyncRefundSum();
};

function psfinRefundTableHtml(pays, refunded) {
  var left = refunded;
  var html = '';
  pays.forEach(function (p, i) {
    var used = Math.min(left, parseFloat(p.amount) || 0);
    left = Math.round((left - used) * 100) / 100;
    var canBack = Math.round(((parseFloat(p.amount) || 0) - used) * 100) / 100;
    html += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + npEscape(p.ch) + '</td>' +
      '<td>' + npEscape(p.method) + '</td>' +
      '<td>' + npEscape(p.amount) + '</td>' +
      '<td>' + npEscape(p.time) + '</td>' +
      '<td>' + psoMoney(used) + '</td>' +
      '<td>' + canBack.toFixed(2) + '</td>' +
      '<td><input type="text" id="psf-rfd-amt-' + i + '" data-can="' + canBack.toFixed(2) + '" value="" placeholder="≤' + canBack.toFixed(2) + '" oninput="psfinSyncRefundSum()"></td>' +
      '</tr>';
  });
  if (!html) html = '<tr><td colspan="8" style="text-align:center;color:#999;padding:24px">暂无收款记录</td></tr>';
  return html;
}

window.psfinSyncRefundSum = function () {
  var tb = document.getElementById('psf-rfd-tbody');
  if (!tb) return;
  var inputs = tb.querySelectorAll('input[id^="psf-rfd-amt-"]');
  var sum = 0;
  for (var i = 0; i < inputs.length; i++) {
    var v = parseFloat(inputs[i].value);
    if (!isNaN(v) && v > 0) sum += v;
  }
  sum = Math.round(sum * 100) / 100;
  var el = document.getElementById('psf-rfd-sum');
  if (el) el.textContent = sum.toFixed(2);
  return sum;
};

window.psfinSubmitRefund = function () {
  var ctx = window.__psfRfdCtx || {};
  var tb = document.getElementById('psf-rfd-tbody');
  if (!tb) return;
  var inputs = tb.querySelectorAll('input[id^="psf-rfd-amt-"]');
  var picks = [];
  for (var i = 0; i < inputs.length; i++) {
    var v = parseFloat(inputs[i].value);
    if (isNaN(v) || v <= 0) continue;
    var can = parseFloat(inputs[i].getAttribute('data-can')) || 0;
    if (v - can > 0.005) { npToast('可退金额≤' + can.toFixed(2)); return; }
    picks.push({ i: i, amount: v });
  }
  if (!picks.length) { npToast('请输入退款金额'); return; }
  var sum = Math.round(picks.reduce(function (s, p) { return s + p.amount; }, 0) * 100) / 100;
  if (Math.abs(sum - ctx.need) > 0.005) { npToast('退款金额应为' + ctx.need.toFixed(2)); return; }

  var pays = psfinPayMap()[ctx.orderNo] || [];
  var list = psfinRefundMap()[ctx.docNo] || (psfinRefundMap()[ctx.docNo] = []);
  picks.forEach(function (p) {
    var pay = pays[p.i] || {};
    list.push({
      ch: pay.ch === PS_FIN.CH_PLATFORM ? PS_FIN.CH_RFD_PLATFORM : PS_FIN.CH_RFD_OWN,
      method: pay.method || '—', amount: psoMoney(p.amount), time: npNowLocal()
    });
  });
  npCloseModal();
  var st = NP['parts-sales-refund']; if (st && st.query) st.query();
  npToast('退款成功');
};

/* ============================================================
   六、收退款详情（收款页与退款页共用一个）
   docNo 可以是销售单号，也可以是取消/退货单号
   ============================================================ */
window.psfinOpenFlow = function (docNo) {
  var orderNo = docNo;
  var refundDocNos = [];
  var rows = psfinRefundRows();
  var hit = rows.filter(function (r) { return r.docNo === docNo; })[0];
  if (hit) {
    orderNo = hit.orderNo;
    refundDocNos = [docNo];
  } else {
    refundDocNos = rows.filter(function (r) { return r.orderNo === docNo; }).map(function (r) { return r.docNo; });
  }

  var flows = [];
  (psfinPayMap()[orderNo] || []).forEach(function (p) {
    flows.push({ kind: '收款', ch: p.ch, method: p.method, amount: p.amount, time: p.time, billType: p.billType || '—', billNo: p.billNo || '—', billAmount: p.billAmount ? psoMoney(p.billAmount) : '—' });
  });
  refundDocNos.forEach(function (dn) {
    (psfinRefundMap()[dn] || []).forEach(function (r) {
      flows.push({ kind: '退款', ch: r.ch, method: r.method, amount: r.amount, time: r.time, billType: '—', billNo: '—', billAmount: '—' });
    });
  });
  flows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });

  var got = psoMoney(psfinSum(psfinPayMap()[orderNo], 'amount'));
  var back = 0;
  refundDocNos.forEach(function (dn) { back += psfinRefunded(dn); });
  back = psoMoney(back);

  var html = '<div class="pm-form-grid">' +
    npFItem('单据编号', '<input type="text" value="' + npEscape(docNo) + '" readonly>') +
    npFItem('销售单号', '<input type="text" value="' + npEscape(orderNo) + '" readonly>') +
    npFItem('已收款金额', '<input type="text" value="' + got + '" readonly>') +
    npFItem('已退款金额', '<input type="text" value="' + back + '" readonly>') +
    '</div>' +
    '<div class="lt-table-wrap" style="max-height:340px;margin-top:8px"><table class="lt-table"><thead><tr>' +
    npTH([
      { t: '序号', w: 50 }, { t: '收款/退款', w: 100 }, { t: '收退款渠道', w: 140 },
      { t: '收退款方式', w: 110 }, { t: '收退款金额', w: 110 }, { t: '收退款时间', w: 160 },
      { t: '票据类型', w: 110 }, { t: '票据号', w: 120 }, { t: '票据金额', w: 110 }
    ]) + '</tr></thead><tbody>' + (function () {
      if (!flows.length) return '<tr><td colspan="9" style="text-align:center;color:#999;padding:24px">暂无收退款记录</td></tr>';
      return flows.map(function (f, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + f.kind + '</td><td>' + npEscape(f.ch) + '</td><td>' +
          npEscape(f.method) + '</td><td>' + npEscape(f.amount) + '</td><td>' + npEscape(f.time) + '</td><td>' +
          npEscape(f.billType) + '</td><td>' + npEscape(f.billNo) + '</td><td>' + npEscape(f.billAmount) + '</td></tr>';
      }).join('');
    })() + '</tbody></table></div>';

  npOpenModal('收退款详情', html, '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>', { width: 980 });
};
