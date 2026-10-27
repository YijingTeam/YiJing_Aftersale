/* ============================================================
   财务管理·配件销售收款(新) / 配件销售退款(新)
   复制原「配件销售收款/退款」（js/parts-sales-fin.js）并按需求改造：
   收款(新)：
     ① 收款渠道“支付平台收款”→“支付二维码”
     ② 收款渠道前加 应收金额/预付款余额；收款渠道从第2行起（第1行第4列留空）
     ③ “确认/取消”下加“演示切换区域”（预收款 4 态，默认=余额不足）
     ④ 余额充足 = 预付款余额 ≥ 应收金额（可更大）：可全额抵扣，隐藏“收款渠道/收款方式/获取支付码/票据”；
        在“收款渠道”前增加可编辑“预付款抵扣”字段：默认值=min(应收金额,预付款余额)，可改，硬上限=min(应收金额,预付款余额)
   退款(新)：
     复制原退款（原函数改名 New 后缀，逻辑一字未改）
     ① (新) 模块专属「预收款账户」收款种子 `psfinNewPrepaySeed()`：约一半销售单有「预付款抵扣」记录
        （PSFIN_NEW_PREPAY_ORDERS，当前 8 条退款单据中 4 条 = 50%）；金额从该单实收额中划出，实收总额不变。
        退款弹窗与「收退款详情」同源渲染（psfinNewAllPays），不重复造行；原「配件销售退款」不受影响。
     ② 预付款「退款」行由真实退款记录拆分而来（只改渠道归属、不改金额合计），保证详情表格行合计 == 「已退款金额」字段。
     ③ 退款弹窗「已退金额」按渠道核销（退款渠道名先映射回收款渠道：门店自行退款↔门店自行收款、支付平台退款↔支付平台收款）。
   复用：psfinPayRows / psfinRefundRows / psfinPayMap / psfinRefundMap / psoMoney / PS_FIN / 全局 np* 组件
   不改原文件任何逻辑。
   ============================================================ */

/* 新页面本地字典（不污染原 PS_FIN） */
var PS_FIN_NEW = {
  CH_OWN: '门店自行收款',
  CH_PLATFORM: '支付二维码',
  METHOD_OWN: ['微信', '支付宝', '银行', '现金', '内部'],
  BILL_TYPES: ['增值税发票', '普通发票', '收据']
};

/* ============================================================
   一、配件销售收款(新)
   ============================================================ */
(function () {
  var K = 'parts-sales-receipt-new';
  var P = 'psf-pay-n';
  var st = null;

  function cols() {
    return [
      { t: '序号', w: 50, f: function (r, i) { return i + 1; } },
      {
        t: '销售单号', w: 140, f: function (r) {
          return '<a href="javascript:void(0)" class="lt-link" onclick="psfinNewOpenFlow(\'' + r.orderNo + '\')">' + npEscape(r.orderNo) + '</a>';
        }
      },
      { t: '门店名称', w: 110, f: function (r) { return npEscape(r.store); } },
      { t: '门店编码', w: 100, f: function (r) { return npEscape(r.storeCode); } },
      { t: '客户', w: 120, f: function (r) { return npEscape(psfinMaskName(r.customer)); } },
      { t: '联系电话', w: 130, f: function (r) { return npEscape(psfinMaskPhone(r.phone)); } },
      { t: '销售单金额', w: 110, f: function (r) { return npEscape(r.amount); } },
      { t: '已收金额', w: 110, f: function (r) { return npEscape(r.received); } },
      {
        t: '收款情况', w: 110, f: function (r) {
          var cls = r.payStatus === '已结清' ? 'ok' : (r.payStatus === '部分收款' ? 'warn' : 'off');
          return '<span class="lt-badge ' + cls + '">' + npEscape(r.payStatus) + '</span>';
        }
      },
      { t: '提交人', w: 90, f: function (r) { return npEscape(r.submitter); } },
      { t: '提交时间', w: 160, f: function (r) { return npEscape(r.submitTime); } },
      {
        t: '操作', w: 170, cls: 'col-actions', f: function (r) {
          var ops = [];
          if (r.payStatus !== '已结清') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinNewOpenPay(\'' + r.orderNo + '\')">收款</a>');
          }
          if (r.payStatus !== '未收款') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinNewOpenFlow(\'' + r.orderNo + '\')">收退款详情</a>');
          }
          return npRenderActions(ops);
        }
      }
    ];
  }

  function filterHtml() {
    return npFItem('销售单号', '<input type="text" id="' + P + '-f-no" placeholder="请输入">') +
      npFItem('客户', '<input type="text" id="' + P + '-f-cust" placeholder="请输入">') +
      npSelect('收款情况', '<select id="' + P + '-f-status"><option value="">请选择</option>' +
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

  window.initPartsSalesReceiptNew = function () {
    var root = document.getElementById('page-' + K);
    if (!root) return;
    var toolbar = '<button class="lt-btn lt-btn-default" onclick="psfinExportPayNew()">导出</button>';
    root.innerHTML = npShell(K, { l2: '财务管理', l3: '配件销售收款(新)' }, filterHtml(), toolbar, npTH(cols()), K + '-tbody', K + '-pager');
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

  npRegisterModuleInit(K, function () { window.initPartsSalesReceiptNew(); });

  window.psfinExportPayNew = function () {
    var st = NP[K];
    var data = st && st.filtered ? st.filtered : [];
    if (!data.length) { npToast('当前没有可导出的数据'); return; }
    var headers = ['序号', '销售单号', '门店名称', '门店编码', '客户', '联系电话', '销售单金额', '已收金额', '收款情况', '提交人', '提交时间'];
    var rows = data.map(function (r, i) {
      return [i + 1, r.orderNo, r.store, r.storeCode, psfinMaskName(r.customer), psfinMaskPhone(r.phone), r.amount, r.received, r.payStatus, r.submitter, r.submitTime];
    });
    npExportExcelRowsRaw('配件销售收款(新)导出', headers, rows);
  };

  /* 收款弹窗（新） */
  window.psfinNewOpenPay = function (orderNo) {
    var row = psfinPayRows().filter(function (r) { return r.orderNo === orderNo; })[0];
    if (!row) { npToast('未找到该销售单'); return; }
    var gross = parseFloat(row.amount) || 0;
    var canGet = Math.round((gross - parseFloat(row.received)) * 100) / 100;
    if (canGet <= 0) { npToast('该销售单已结清，无需收款'); return; }
    var direct = psfinIsDirect(row.storeCode);
    var chans = direct ? [PS_FIN_NEW.CH_PLATFORM] : [PS_FIN_NEW.CH_OWN, PS_FIN_NEW.CH_PLATFORM];
    /* 预收款余额（演示定值）：余额不足态基准 = 应收(canGet)的 60%，保证“余额不足”确为部分抵扣 */
    var prepayBalance = Math.round(canGet * 0.6 * 100) / 100;
    var prepayShow = prepayBalance.toFixed(2);
    /* 预付款抵扣默认 = min(应收金额(canGet), 预付款余额)，可改，硬上限 = min(应收金额,预付款余额) */
    var deductDefault = Math.min(canGet, prepayBalance);

    var html = '<div class="pm-form-grid col4">' +
      npFItem('单据编号', '<input type="text" id="psf-pay-n-no" value="' + npEscape(row.orderNo) + '" readonly>') +
      npFItem('应收金额', '<input type="text" id="psf-pay-n-rev" value="' + canGet.toFixed(2) + '" readonly>') +
      npFItem('预付款余额', '<input type="text" id="psf-pay-n-prepay" value="' + prepayShow + '" readonly>') +
      '<div></div>' +
      npFormItem('预付款抵扣', '<input type="text" id="psf-pay-n-deduct" value="' + deductDefault.toFixed(2) + '" oninput="psfinNewSyncDeduct()">') +
      npFormSelect('收款渠道', '<select id="psf-pay-n-ch" onchange="psfinNewSyncPayMethod()">' +
        chans.map(function (c) { return '<option>' + npEscape(c) + '</option>'; }).join('') + '</select>', true) +
      npFormSelect('收款方式', '<select id="psf-pay-n-method"></select>', true) +
      npFormItem('收款金额', '<input type="text" id="psf-pay-n-amount" value="' + (canGet - deductDefault).toFixed(2) + '" placeholder="可收 ' + canGet.toFixed(2) + '">', true) +
      '<div class="lt-filter-item form-actions" data-col="4" id="psf-pay-n-qrbtn" style="display:' + (direct ? '' : 'none') + '">' +
      '<button class="lt-btn lt-btn-primary" onclick="psfinNewGetQr()">获取支付码</button>' +
      '</div>' +
      '<div id="psf-pay-n-bill-block" style="display:' + (direct ? 'none' : 'contents') + '">' +
      npSelect('票据类型', '<select id="psf-pay-n-billtype"><option value="">请选择</option>' +
        PS_FIN_NEW.BILL_TYPES.map(function (b) { return '<option>' + npEscape(b) + '</option>'; }).join('') + '</select>') +
      npFItem('票据号', '<input type="text" id="psf-pay-n-billno" placeholder="请输入">') +
      npFItem('票据金额', '<input type="text" id="psf-pay-n-billamount" placeholder="请输入">') +
      '</div>' +
      '</div>' +
      '<div class="psf-qr" id="psf-pay-n-qr" style="display:' + (direct ? '' : 'none') + '">' +
      '<div class="psf-qr-row">' +
      '<div class="psf-qr-box">收款码</div>' +
      '<div class="psf-qr-side">' +
      '<div class="psf-qr-tip">二维码有效期：15-30分钟，如失效，请重新发起获取新的支付二维码</div>' +
      '<a href="javascript:void(0)" class="lt-link" onclick="npToast(\'下载图片（演示）\')">下载图片</a>' +
      '</div>' +
      '</div>' +
      '</div>';

    /* 演示切换区域：挂在「确认/取消」按钮下方（belowFooterHtml），不混入正文元素之间（用户最初指令） */
    var payDemoHtml =
      '<div class="psf-demo" id="psf-pay-n-demo">' +
      '<div class="psf-demo-title">演示切换区域</div>' +
      '<div class="psf-demo-row"><span class="psf-demo-label">预收款</span>' +
      '<label><input type="radio" name="psf-pay-n-prepay-mode" value="充足" onchange="psfinNewSetPrepay(this.value)"> 余额充足</label>' +
      '<label><input type="radio" name="psf-pay-n-prepay-mode" value="不足" checked onchange="psfinNewSetPrepay(this.value)"> 余额不足</label>' +
      '<label><input type="radio" name="psf-pay-n-prepay-mode" value="无" onchange="psfinNewSetPrepay(this.value)"> 无预收款</label>' +
      '</div>' +
      '<div class="psf-demo-hint" id="psf-pay-n-demo-hint"></div>' +
      '</div>';

    npOpenModal('收款',
      html,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="psfinNewSubmitPay()">确认</button>',
      { width: 1000, belowFooterHtml: payDemoHtml });
    window.__psfPayNCtx = { orderNo: orderNo, canGet: canGet, direct: direct, gross: gross, prepayBalance: prepayBalance };
    psfinNewSyncPayMethod();
    psfinNewSetPrepay('不足');
  };

  /* 收款渠道切换 → 收款方式候选/获取支付码/票据块 显隐（支付二维码＝二码合一，无收款方式） */
  window.psfinNewSyncPayMethod = function () {
    var ch = (document.getElementById('psf-pay-n-ch') || {}).value || '';
    var sel = document.getElementById('psf-pay-n-method');
    var methodCell = sel ? sel.closest('.lt-filter-item') : null;
    var qr = document.getElementById('psf-pay-n-qr');
    var qrbtn = document.getElementById('psf-pay-n-qrbtn');
    var bill = document.getElementById('psf-pay-n-bill-block');
    var isPlatform = ch === PS_FIN_NEW.CH_PLATFORM;
    if (methodCell) methodCell.style.display = isPlatform ? 'none' : '';
    if (sel) {
      if (isPlatform) { sel.innerHTML = ''; }
      else {
        sel.innerHTML = '<option value="">请选择</option>' +
          PS_FIN_NEW.METHOD_OWN.map(function (m) { return '<option>' + m + '</option>'; }).join('');
      }
    }
    if (qr) qr.style.display = isPlatform ? '' : 'none';
    if (qrbtn) qrbtn.style.display = isPlatform ? '' : 'none';
    if (bill) bill.style.display = isPlatform ? 'none' : 'contents';
  };

  window.psfinNewGetQr = function () {
    var qr = document.getElementById('psf-pay-n-qr');
    if (qr) qr.style.display = '';
    npToast('已生成支付二维码（二码合一，微信/支付宝均可扫码）');
  };

  /* 预付款抵扣金额变化 → 联动 收款金额 = max(0, 应收金额 - 预付款抵扣)；硬上限 = min(应收金额, 预付款余额) */
  window.psfinNewSyncDeduct = function () {
    var ctx = window.__psfPayNCtx || {};
    var revEl = document.getElementById('psf-pay-n-rev');
    var prepayEl = document.getElementById('psf-pay-n-prepay');
    var deductEl = document.getElementById('psf-pay-n-deduct');
    var amtEl = document.getElementById('psf-pay-n-amount');
    var rev = revEl ? (parseFloat(revEl.value) || 0) : 0;            /* 应收金额 */
    var bal = prepayEl ? (parseFloat(prepayEl.value !== '—' ? prepayEl.value : '0') || 0) : 0; /* 预付款余额 */
    var cap = Math.min(rev, bal);                                    /* 可抵扣上限 */
    var d = deductEl ? parseFloat(deductEl.value) : 0;
    if (isNaN(d) || d < 0) d = 0;
    if (d - cap > 0.005) { d = cap; if (deductEl) deductEl.value = cap.toFixed(2); npToast('预付款抵扣不能超过 min(应收金额,预付款余额)=' + cap.toFixed(2)); }
    if (amtEl) amtEl.value = Math.max(0, Math.round((rev - d) * 100) / 100).toFixed(2);
    psfinNewApplyCollectVisibility();
  };

  /* 收款渠道/收款方式/获取支付码/票据 的显隐，由“剩余待收金额”决定：有剩余→必须选收款渠道付款；无剩余→隐藏 */
  window.psfinNewApplyCollectVisibility = function () {
    var ctx = window.__psfPayNCtx || {};
    var direct = ctx.direct || false;
    var amtEl = document.getElementById('psf-pay-n-amount');
    var remaining = amtEl ? (parseFloat(amtEl.value) || 0) : 0;
    var showCollect = remaining > 0.005; /* 有剩余待收 → 必须选收款渠道 */
    var chCell = document.getElementById('psf-pay-n-ch');
    var methodCell = document.getElementById('psf-pay-n-method');
    var qrbtnCell = document.getElementById('psf-pay-n-qrbtn');
    var billBlock = document.getElementById('psf-pay-n-bill-block');
    var amtCell = amtEl ? amtEl.closest('.lt-filter-item') : null;
    /* 收款金额 = 剩余待收；剩余为 0（已全额抵扣）时连“收款金额”字段本身一并隐藏，避免展示“收款金额 0.00” */
    [chCell, methodCell, amtCell].forEach(function (el) {
      var cell = el && el.closest ? el.closest('.lt-filter-item') : null;
      if (cell) cell.style.display = showCollect ? '' : 'none';
    });
    if (qrbtnCell) qrbtnCell.style.display = (showCollect && !direct) ? '' : 'none';
    if (billBlock) billBlock.style.display = (showCollect && !direct) ? 'contents' : 'none';
    var hint = document.getElementById('psf-pay-n-demo-hint');
    if (hint) {
      var dEl = document.getElementById('psf-pay-n-deduct');
      var dVal = dEl ? (parseFloat(dEl.value) || 0) : 0;
      if (showCollect) {
        hint.textContent = '预付款抵扣 ￥' + dVal.toFixed(2) + '（可修改），仍需收款 ￥' + remaining.toFixed(2);
      } else {
        var pEl = document.getElementById('psf-pay-n-prepay');
        var balVal = pEl && pEl.value !== '—' ? (parseFloat(pEl.value) || 0) : 0;
        hint.textContent = '预付款余额 ￥' + balVal.toFixed(2) + '，可抵扣 ￥' + dVal.toFixed(2) + ' 已全额抵扣，无需收款';
      }
    }
    if (showCollect) psfinNewSyncPayMethod();
  };

  /* 演示切换：改 预付款余额/预付款抵扣 显示值 + 提示；余额充足 = 余额≥应收 → 全额抵扣（剩余=0，自动隐藏收款渠道） */
  window.psfinNewSetPrepay = function (mode) {
    var radios = document.querySelectorAll('input[name="psf-pay-n-prepay-mode"]');
    radios.forEach(function (r) { r.checked = (r.value === mode); });
    var revEl = document.getElementById('psf-pay-n-rev');
    var prepayEl = document.getElementById('psf-pay-n-prepay');
    var deductEl = document.getElementById('psf-pay-n-deduct');
    var hint = document.getElementById('psf-pay-n-demo-hint');
    var ctx = window.__psfPayNCtx || {};
    var canGet = ctx.canGet || (revEl ? parseFloat(revEl.value) || 0 : 0);
    var direct = ctx.direct || false;
    var base = ctx.prepayBalance || 0;  /* 演示基准余额（=应收的40%，余额不足态使用） */
    var showPrepay = 0, note = '', deduct = 0;
    if (mode === '充足') {
      showPrepay = Math.round(Math.max(canGet, base) * 1.3 * 100) / 100; /* 余额≥应收，可更大 */
      deduct = Math.min(canGet, showPrepay); /* = 应收，全额抵扣 */
      note = '预收款余额充足（￥' + showPrepay.toFixed(2) + ' ≥ 应收 ￥' + canGet.toFixed(2) + '），本次可抵扣 ￥' + deduct.toFixed(2) + '（可修改），无需收款';
    } else if (mode === '不足') {
      showPrepay = base;
      deduct = Math.min(canGet, showPrepay);
      note = '预收款抵扣 ￥' + deduct.toFixed(2) + '（可修改），仍需收款 ￥' + (canGet - deduct).toFixed(2);
    } else if (mode === '无') {
      showPrepay = 0; deduct = 0; note = '无预收款余额';
    }
    if (prepayEl) prepayEl.value = (showPrepay === '—' ? '—' : showPrepay.toFixed(2));
    if (deductEl) deductEl.value = deduct.toFixed(2);
    if (hint) hint.textContent = note;
    /* 收款金额 = max(0, 应收金额 - 预付款抵扣) */
    var amtEl = document.getElementById('psf-pay-n-amount');
    if (amtEl) amtEl.value = Math.max(0, Math.round((canGet - deduct) * 100) / 100).toFixed(2);
    /* 收款渠道等显隐由“剩余待收金额”驱动（见 psfinNewApplyCollectVisibility），不绑死在演示模式上 */
    psfinNewApplyCollectVisibility();
  };

  window.psfinNewSubmitPay = function () {
    var ctx = window.__psfPayNCtx || {};
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    /* 预付款抵扣（可改，默认 min(实际应收,预付款余额)） */
    var deductEl = document.getElementById('psf-pay-n-deduct');
    var prepayEl = document.getElementById('psf-pay-n-prepay');
    var balance = parseFloat(prepayEl && prepayEl.value !== '—' ? prepayEl.value : '0') || 0;
    var deduct = deductEl ? parseFloat(deductEl.value) : 0;
    if (isNaN(deduct) || deduct < 0) { npToast('预付款抵扣金额需大于等于 0'); return; }
    if (deduct - ctx.canGet > 0.005) { npToast('预付款抵扣金额不能超过应收金额 ' + ctx.canGet.toFixed(2)); return; }
    var cap = Math.min(ctx.canGet, balance);
    if (deduct - cap > 0.005) { npToast('预付款抵扣金额不能超过 min(应收金额,预付款余额)=' + cap.toFixed(2)); return; }
    /* 收款渠道 */
    var ch = g('psf-pay-n-ch'), method = g('psf-pay-n-method'), amount = g('psf-pay-n-amount');
    var billType = g('psf-pay-n-billtype'), billNo = g('psf-pay-n-billno'), billAmount = g('psf-pay-n-billamount');
    var isPlatform = ch === PS_FIN_NEW.CH_PLATFORM;
    var n = parseFloat(amount);
    if (isNaN(n) || n < 0) { npToast('收款金额需大于等于 0'); return; }
    if (n > 0.005) {
      if (!ch) { npToast('请选择收款渠道'); return; }
      if (!isPlatform && !method) { npToast('请选择收款方式'); return; }
      if (n - ctx.canGet > 0.005) { npToast('收款金额不能超过可收金额 ' + ctx.canGet.toFixed(2)); return; }
    }
    if (deduct + n - ctx.canGet > 0.005) { npToast('预付款抵扣 + 收款金额 不能超过可收金额 ' + ctx.canGet.toFixed(2)); return; }
    var list = psfinPayMap()[ctx.orderNo] || (psfinPayMap()[ctx.orderNo] = []);
    if (deduct > 0.005) {
      list.push({ ch: '预收款账户', method: '预收款抵扣', amount: psoMoney(deduct), time: npNowLocal(), billType: '—', billNo: '', billAmount: 0 });
    }
    if (n > 0.005) {
      list.push({
        ch: ch, method: isPlatform ? '二码合一' : method, amount: psoMoney(n), time: npNowLocal(),
        billType: billType || '—', billNo: billNo, billAmount: billAmount ? psoMoney(billAmount) : 0
      });
    }
    npCloseModal();
    var st = NP['parts-sales-receipt-new']; if (st && st.query) st.query();
    npToast('收款成功');
  };
})();

/* ============================================================
   二、配件销售退款(新)
   ============================================================ */
(function () {
  var K = 'parts-sales-refund-new';
  var P = 'psf-rfd-n';
  var st = null;

  function cols() {
    return [
      { t: '序号', w: 50, f: function (r, i) { return i + 1; } },
      {
        t: '单据编号', w: 150, f: function (r) {
          return '<a href="javascript:void(0)" class="lt-link" onclick="psfinNewOpenFlow(\'' + r.docNo + '\')">' + npEscape(r.docNo) + '</a>';
        }
      },
      { t: '门店名称', w: 110, f: function (r) { return npEscape(r.store); } },
      { t: '门店编码', w: 100, f: function (r) { return npEscape(r.storeCode); } },
      { t: '退款类型', w: 100, f: function (r) { return npEscape(r.type); } },
      { t: '客户', w: 120, f: function (r) { return npEscape(psfinMaskName(r.customer)); } },
      { t: '联系电话', w: 130, f: function (r) { return npEscape(psfinMaskPhone(r.phone)); } },
      { t: '退款金额', w: 110, f: function (r) { return npEscape(r.amount); } },
      {
        t: '退款情况', w: 110, f: function (r) {
          return '<span class="lt-badge ' + (r.refundStatus === '已退款' ? 'ok' : 'off') + '">' + npEscape(r.refundStatus) + '</span>';
        }
      },
      { t: '提交人', w: 90, f: function (r) { return npEscape(r.submitter); } },
      { t: '提交时间', w: 160, f: function (r) { return npEscape(r.submitTime); } },
      {
        t: '操作', w: 170, cls: 'col-actions', f: function (r) {
          var ops = [];
          if (r.refundStatus === '未退款') {
            ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinNewOpenRefund(\'' + r.docNo + '\')">退款</a>');
          }
          ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="psfinNewOpenFlow(\'' + r.docNo + '\')">收退款详情</a>');
          return npRenderActions(ops);
        }
      }
    ];
  }

  function filterHtml() {
    return npFItem('单据编号', '<input type="text" id="' + P + '-f-no" placeholder="请输入">') +
      npFItem('客户', '<input type="text" id="' + P + '-f-cust" placeholder="请输入">') +
      npSelect('退款情况', '<select id="' + P + '-f-status"><option value="">请选择</option>' +
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

  window.initPartsSalesRefundNew = function () {
    var root = document.getElementById('page-' + K);
    if (!root) return;
    var toolbar = '<button class="lt-btn lt-btn-default" onclick="psfinExportRefundNew()">导出</button>';
    root.innerHTML = npShell(K, { l2: '财务管理', l3: '配件销售退款(新)' }, filterHtml(), toolbar, npTH(cols()), K + '-tbody', K + '-pager');
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

  npRegisterModuleInit(K, function () { window.initPartsSalesRefundNew(); });

  window.psfinExportRefundNew = function () {
    var st = NP[K];
    var data = st && st.filtered ? st.filtered : [];
    if (!data.length) { npToast('当前没有可导出的数据'); return; }
    var headers = ['序号', '单据编号', '门店名称', '门店编码', '退款类型', '客户', '联系电话', '退款金额', '退款情况', '提交人', '提交时间'];
    var rows = data.map(function (r, i) {
      return [i + 1, r.docNo, r.store, r.storeCode, r.type, psfinMaskName(r.customer), psfinMaskPhone(r.phone), r.amount, r.refundStatus, r.submitter, r.submitTime];
    });
    npExportExcelRowsRaw('配件销售退款(新)导出', headers, rows);
  };

  /* 退款弹窗（新，复制原逻辑，提交后刷新新页面） */
  window.psfinNewOpenRefund = function (docNo) {
    var row = psfinRefundRows().filter(function (r) { return r.docNo === docNo; })[0];
    if (!row) { npToast('未找到该单据'); return; }
    var pays = psfinNewAllPays(row.orderNo, docNo);
    if (!pays.length) { npToast('该单据对应销售单尚未收款，不能退款'); return; }
    var refunded = psfinRefunded(docNo);
    var need = Math.round((Math.min(parseFloat(row.amount), psfinReceived(row.orderNo)) - refunded) * 100) / 100;

    var body = '<div class="pm-form-grid col4">' +
      npFItem('单据编号', '<input type="text" id="psf-rfd-n-no" value="' + npEscape(row.docNo) + '" readonly>') +
      npFItem('退款日期', '<input type="text" value="' + npEscape(npNowLocal().slice(0, 10)) + '" readonly>') +
      npFItem('操作人', '<input type="text" value="张三" readonly>') +
      npFItem('退款金额', '<input type="text" value="' + need.toFixed(2) + '" readonly>') +
      '</div>' +
      '<div class="psf-hint">退款后请注意作废票据</div>' +
      '<div class="lt-table-wrap" style="max-height:300px;margin-top:8px"><table class="lt-table"><thead><tr>' +
      npTH([
        { t: '序号', w: 50 }, { t: '收款渠道', w: 130 }, { t: '收款方式', w: 100 },
        { t: '收款金额', w: 100 }, { t: '收款时间', w: 160 }, { t: '已退金额', w: 100 },
        { t: '可退金额', w: 100 }, { t: '退款金额', w: 120 }
      ]) + '</tr></thead><tbody id="psf-rfd-n-tbody">' + psfinRefundTableHtmlN(pays, refunded, psfinNewRefundedByCh(docNo, row.orderNo)) + '</tbody></table></div>';

    npOpenModal('退款', body,
      '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
      '<button class="lt-btn lt-btn-primary" onclick="psfinNewSubmitRefund()">确认</button>',
      { width: 1060 });
    window.__psfRfdNCtx = { docNo: docNo, need: need, orderNo: row.orderNo, refunded: refunded };
    psfinNewSyncRefundSum();
  };

  /* 该单据【各收款渠道】的已退金额：按真实退款记录统计，并把「退款渠道」映射回「收款渠道」再归集
     （退款渠道名与收款渠道名不同：门店自行退款↔门店自行收款、支付平台退款↔支付平台收款；
      不映射会导致已退金额核销不到任何行，可退金额虚高）
     —— 用于退款弹窗「已退金额」逐渠道核销 */
  function psfinNewRefundedByCh(docNo, orderNo) {
    var toPayCh = function (ch) {
      if (ch === PS_FIN.CH_RFD_PLATFORM) return PS_FIN.CH_PLATFORM;
      if (ch === PS_FIN.CH_RFD_OWN) return PS_FIN.CH_OWN;
      return ch;                                  /* 预收款账户 等同名渠道 */
    };
    var byCh = {};
    psfinNewRefundFlows(docNo, orderNo).forEach(function (r) {
      var k = toPayCh(r.ch);
      byCh[k] = Math.round(((byCh[k] || 0) + (parseFloat(r.amount) || 0)) * 100) / 100;
    });
    return byCh;
  }

  function psfinRefundTableHtmlN(pays, refunded, refundedByCh) {
    var left = refunded;
    var html = '';
    pays.forEach(function (p, i) {
      /* 已退金额优先按【该渠道的真实已退额】核销；无渠道级数据时退回按行序核销（原逻辑） */
      var used;
      if (refundedByCh) {
        used = Math.min(refundedByCh[p.ch] || 0, parseFloat(p.amount) || 0);
        refundedByCh[p.ch] = Math.round(((refundedByCh[p.ch] || 0) - used) * 100) / 100;
      } else {
        used = Math.min(left, parseFloat(p.amount) || 0);
      }
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
        '<td><input type="text" id="psf-rfd-n-amt-' + i + '" data-can="' + canBack.toFixed(2) + '" data-ch="' + npEscape(p.ch) + '" data-method="' + npEscape(p.method) + '"' + (canBack <= 0.005 ? ' value="0" readonly' : ' value="" placeholder="≤' + canBack.toFixed(2) + '"') + ' oninput="psfinNewSyncRefundSum()"></td>' +
        '</tr>';
    });
    if (!html) html = '<tr><td colspan="8" style="text-align:center;color:#999;padding:24px">暂无收款记录</td></tr>';
    return html;
  }

  window.psfinNewSyncRefundSum = function () {
    var tb = document.getElementById('psf-rfd-n-tbody');
    if (!tb) return;
    var inputs = tb.querySelectorAll('input[id^="psf-rfd-n-amt-"]');
    var sum = 0;
    for (var i = 0; i < inputs.length; i++) {
      var v = parseFloat(inputs[i].value);
      if (!isNaN(v) && v > 0) sum += v;
    }
    sum = Math.round(sum * 100) / 100;
    var el = document.getElementById('psf-rfd-n-sum');
    if (el) el.textContent = sum.toFixed(2);
    return sum;
  };

  window.psfinNewSubmitRefund = function () {
    var ctx = window.__psfRfdNCtx || {};
    var tb = document.getElementById('psf-rfd-n-tbody');
    if (!tb) return;
    var inputs = tb.querySelectorAll('input[id^="psf-rfd-n-amt-"]');
    var picks = [];
    for (var i = 0; i < inputs.length; i++) {
      var v = parseFloat(inputs[i].value);
      if (isNaN(v) || v <= 0) continue;
      var can = parseFloat(inputs[i].getAttribute('data-can')) || 0;
      if (v - can > 0.005) { npToast('可退金额≤' + can.toFixed(2)); return; }
      picks.push({ i: i, amount: v, ch: inputs[i].getAttribute('data-ch') || '', method: inputs[i].getAttribute('data-method') || '' });
    }
    if (!picks.length) { npToast('请输入退款金额'); return; }
    var sum = Math.round(picks.reduce(function (s, p) { return s + p.amount; }, 0) * 100) / 100;
    if (Math.abs(sum - ctx.need) > 0.005) { npToast('退款金额应为' + ctx.need.toFixed(2)); return; }

    var list = psfinRefundMap()[ctx.docNo] || (psfinRefundMap()[ctx.docNo] = []);
    picks.forEach(function (p) {
      /* 渠道/方式取该行输入框上标记的值（渲染时写入），不按下标反查，避免数据变化后错配 */
      var rch = p.ch === '预收款账户' ? '预收款账户' : (p.ch === PS_FIN.CH_PLATFORM ? PS_FIN.CH_RFD_PLATFORM : PS_FIN.CH_RFD_OWN);
      var rmethod = p.ch === '预收款账户' ? '预收款退款' : (p.method || '—');
      list.push({ ch: rch, method: rmethod, amount: psoMoney(p.amount), time: npNowLocal() });
    });
    npCloseModal();
    var st = NP['parts-sales-refund-new']; if (st && st.query) st.query();
    npToast('退款成功');
  };

  /* ===== 「预收款账户」收款记录种子（仅退款(新) 使用；原「配件销售退款」不改动） =====
     需求：退款列表约一半的单据有「预付款抵扣」记录，点「退款」时可看到并可退。
     实现：这不是渲染时临时派生，而是 (新) 模块专属的真实收款记录种子——
           金额从该销售单的【实收额】中划出（实收总额不变），与主渠道收款并存。 */
  /* 约一半的退款单据有「预付款抵扣」记录：当前 8 行中选 4 行
     （HUB02510150009 / HUB02510150010 各对应 2 条退款单据，共 4 行 = 50%） */
  var PSFIN_NEW_PREPAY_ORDERS = ['HUB02510150009', 'HUB02510150010'];
  function psfinNewPrepaySeed() {
    if (window.__PSF_NEW_PREPAY) return window.__PSF_NEW_PREPAY;
    var map = {};
    PSFIN_NEW_PREPAY_ORDERS.forEach(function (orderNo) {
      var got = parseFloat(psfinReceived(orderNo) || 0);
      if (got <= 0.005) return;
      /* 预付款额 = 实收额的 30%（从实收中划出，不新增实收），四舍五入到分 */
      var amt = psoMoney(Math.round(got * 0.3 * 100) / 100);
      if (amt <= 0.005) return;
      var ord = (typeof psfinPayRows === 'function') ? psfinPayRows().filter(function (r) { return r.orderNo === orderNo; })[0] : null;
      map[orderNo] = [{
        ch: '预收款账户', method: '预收款抵扣', amount: amt,
        time: psfinAddMin((ord && ord.submitTime) || '2026-10-10 09:00:00', 6),
        billType: '—', billNo: '', billAmount: 0
      }];
    });
    window.__PSF_NEW_PREPAY = map;
    return map;
  }

  /* (新) 专属的「退款记录」视图：把该单据【真实退款记录】中的一笔拆出「预收款账户」退款行
     —— 拆分只改渠道归属、不改金额合计，保证详情表格行合计 == 「已退款金额」字段（口径自洽） */
  function psfinNewRefundFlows(docNo, orderNo) {
    var out = (psfinRefundMap()[docNo] || []).map(function (r) {
      return { kind: '退款', ch: r.ch, method: r.method, amount: r.amount, time: r.time, billType: '', billNo: '', billAmount: '' };
    });
    var seed = psfinNewPrepaySeed()[orderNo];
    if (!seed || !out.length) return out;
    var seedAmt = parseFloat(seed[0].amount) || 0;
    var split = psoMoney(Math.round(Math.min(parseFloat(out[0].amount) || 0, seedAmt) * 100) / 100);
    if (split <= 0.005) return out;
    var first = out[0];
    var rest = psoMoney(Math.round(((parseFloat(first.amount) || 0) - split) * 100) / 100);
    out[0] = { kind: '退款', ch: '预收款账户', method: '预收款退款', amount: split, time: first.time, billType: '', billNo: '', billAmount: '' };
    if (rest > 0.005) {
      out.splice(1, 0, { kind: '退款', ch: first.ch, method: first.method, amount: rest, time: first.time, billType: '', billNo: '', billAmount: '' });
    }
    return out;
  }

  /* 某销售单的全部「收款」记录（含 预付款账户）= 退款弹窗与收退款详情共用的数据源 */
  function psfinNewAllPays(orderNo, docNo) {
    var base = (psfinPayMap()[orderNo] || []).map(function (p) {
      return { ch: p.ch, method: p.method, amount: p.amount, time: p.time, billType: p.billType || '', billNo: p.billNo || '', billAmount: p.billAmount ? psoMoney(p.billAmount) : '' };
    });
    /* 预付款记录来自 (新) 模块专属种子（只有约一半销售单有），不是每单都派生 */
    var prepay = (psfinNewPrepaySeed()[orderNo] || []).map(function (p) {
      return { ch: p.ch, method: p.method, amount: p.amount, time: p.time, billType: p.billType || '', billNo: p.billNo || '', billAmount: p.billAmount ? psoMoney(p.billAmount) : '' };
    });
    /* 预付款行是「实收」的一部分，不是叠加在实收之上：
       ① 预付款额不得超过实收额：超出则按比例缩放预付款行金额；
       ② 再从主渠道行金额中扣除等额预付款（合计扣掉 prepaySum），
          保证「预付款 + 主渠道」合计恒等于实收额，
          否则弹窗各行金额之和会超过应退金额，导致退款提交时被「退款金额应为X」拦死。 */
    var total = psfinReceived(orderNo);
    var prepaySum = prepay.reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
    if (prepaySum > total + 0.005 && prepaySum > 0) {
      var k = total / prepaySum;                     /* 等比缩放预付款行 */
      prepay.forEach(function (p) { p.amount = psoMoney(Math.round((parseFloat(p.amount) || 0) * k * 100) / 100); });
      prepaySum = prepay.reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
    }
    var cutLeft = Math.round(prepaySum * 100) / 100;  /* 主渠道侧需扣掉的金额 */
    base.forEach(function (p) {
      if (cutLeft <= 0.005) return;
      var a = parseFloat(p.amount) || 0;
      var cut = Math.min(a, cutLeft);
      p.amount = psoMoney(a - cut);
      cutLeft = Math.round((cutLeft - cut) * 100) / 100;
    });
    /* 按收款时间排序（预付款在前）：退款弹窗「已退金额」按行序依次核销，
       与详情页「预收款账户优先核销」的拆分口径保持一致 */
    return prepay.concat(base).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
  }

  /* 收退款详情（新）：复制原逻辑，并追加 预收款账户 收款/退款 行（收退款渠道=预收款账户） */
  window.psfinNewOpenFlow = function (docNo) {
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
    /* 收款行与「退款」弹窗同源（psfinNewAllPays），保证两处口径一致、不重复造行 */
    psfinNewAllPays(orderNo, docNo).forEach(function (p) {
      flows.push({ kind: '收款', ch: p.ch, method: p.method, amount: p.amount, time: p.time, billType: p.billType || '', billNo: p.billNo || '', billAmount: p.billAmount ? psoMoney(p.billAmount) : '' });
    });
    /* 退款行：由真实退款记录拆分而来（有预付款的单据拆出「预收款账户」退款行），金额合计不变 */
    refundDocNos.forEach(function (dn) {
      psfinNewRefundFlows(dn, orderNo).forEach(function (r) { flows.push(r); });
    });
    flows.sort(function (a, b) { return a.time < b.time ? -1 : 1; });

    var got = psoMoney(psfinSum(psfinNewAllPays(orderNo, docNo), 'amount'));
    var back = 0;
    refundDocNos.forEach(function (dn) { back += psfinRefunded(dn); });
    back = psoMoney(back);

    var html = '<div class="pm-form-grid">' +
      npFItem('单据编号', '<input type="text" value="' + npEscape(docNo) + '" readonly>') +
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
})();
