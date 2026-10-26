/* ============================================================
   配件销售管理 —— 配件销售单 / 配件销售取消 / 配件销售退货 + 发票
   依据：飞书 PRD《奕境售后》6.9 章节（6.9.1/ 6.9.2 / 6.9.3 / 6.9.4）
   依赖 app.js 通用 helper（全部复用，不自造）：
     npShell / npFItem / npSelect / npTH / npRenderTable / npRenderPager /
     npRenderActions / npEscape / npToast / npOpenModal / npCloseModal /
     npExportExcelRows / npDefaultDateRange / npNowLocal / npDateTime /
     npFindByIdx / npNextIdx / initFilterGrid / npRegisterModuleInit /
     msOpenStorePicker
   依赖 car-owner.js：window.CAR_OWNERS（客档唯一来源，惰性读取）
   约定：种子 idx 一律 0 基；行操作取数一律 npFindByIdx；时间一律秒级
   ============================================================ */

/* ---------------- 公共常量与字典 ---------------- */

/* 备件折扣比率权限（原型暂无「员工权限设置」主数据，此处为当前登录账号可用区间） */
window.PSO_DISCOUNT_RANGE = { min: 0.80, max: 1.00 };

var PSO_TYPE_OPTS = ['店销', '个销'];
var PSO_PAY_OPTS = ['未收款', '部分收款', '已结清'];
var PSO_OUT_OPTS = ['未出库', '部分出库', '全部出库'];
var PSO_DOC_OPTS = ['有效', '已作废'];
var PSR_REFUND_OPTS = ['未退款', '部分退款', '已退款'];
var PSR_INSTOCK_OPTS = ['未入库', '已入库'];
var PSR_REASON_OPTS = ['配件不匹配', '客户多购', '质量问题', '运输破损', '客户取消'];

var PSO_SUBMITTERS = ['沐云汐', '张建国', '李思远', '王雅静'];

/* 折后价 = 单价(含税) × 折扣比率，四舍五入保留 2 位（PRD：350.88 × 0.88 = 308.7744 → 308.77）*/
function psoCalcDiscountPrice(unitPrice, ratio) {
  var p = parseFloat(unitPrice);
  var r = parseFloat(ratio);
  if (isNaN(p) || isNaN(r)) return 0;
  return Math.round(p * r * 100) / 100;
}

/* 金额格式化：两位小数 */
function psoMoney(v) {
  var n = parseFloat(v);
  if (isNaN(n)) n = 0;
  return n.toFixed(2);
}

/* 数量格式化：PRD 截图统一两位小数（3.00 / 10.00）*/
function psoQty(v) {
  var n = parseFloat(v);
  if (isNaN(n)) n = 0;
  return n.toFixed(2);
}

/* 折扣比率是否在当前账号权限内 */
function psoDiscountAllowed(ratio) {
  var r = parseFloat(ratio);
  if (isNaN(r)) return false;
  var R = window.PSO_DISCOUNT_RANGE;
  return r >= R.min - 1e-9 && r <= R.max + 1e-9;
}

/* 读取客档有效车主（惰性读取，避免 car-owner.js 加载顺序导致 undefined）*/
function psoCarOwners() {
  return (window.CAR_OWNERS || []).filter(function (o) { return o.valid === '有效'; });
}

/* ---------------- 销售单明细种子 ---------------- */
/* 每个销售单的明细行：含单价/折扣比率/折后价/数量/金额/出库SNP/取消数量/退货数量/实际数量
   出库SNP = 销售数量 − 已出库数量 */
function psoMakeItems(orderIdx, cfg) {
  var items = [];
  for (var i = 0; i < cfg.length; i++) {
    var c = cfg[i];
    var dp = psoCalcDiscountPrice(c.unit, c.ratio);
    var qty = c.qty;
    var shipped = c.shipped === undefined ? 0 : c.shipped;
    var items2 = {
      code: c.code,
      name: c.name,
      unit: 'EA',
      snp: psoQty(qty - shipped),
      unitPrice: psoMoney(c.unit),
      ratio: c.ratio,
      discountPrice: psoMoney(dp),
      qty: psoQty(qty),
      amount: psoMoney(dp * qty),
      stock: c.stock,
      onway: c.onway,
      canceled: c.canceled || '0.00',
      returned: c.returned || '0.00',
      actual: psoQty(qty - (c.canceled ? parseFloat(c.canceled) : 0) - (c.returned ? parseFloat(c.returned) : 0))
    };
    items.push(items2);
  }
  return items;
}

/* 12 条销售单：逐条排布覆盖 4×4 状态矩阵
   有效+未收款+未出库 ×3（可编辑可作废）
   已作废 ×2
   有效+已结清+未出库 ×2（可取消）
   有效+已结清+全部出库 ×3（可退货可开票）
   有效+部分收款+部分出库 ×2 */
function psoOrderSeed() {
  var orders = [];

  /* ---- 组1：有效 + 未收款 + 未出库（可编辑、可作废）---- */
  orders.push({
    idx: 0, orderNo: 'HUB02510150001', store: '经开永旺店', storeCode: 'JY001', customer: '星海汽贸有限公司',
    saleType: '店销', saleDate: '2026-10-08', docStatus: '有效', payStatus: '未收款', outStatus: '未出库',
    submitter: PSO_SUBMITTERS[0], submitTime: '2026-10-08 09:12:33', repairOrder: 'WX20261008001',
    items: psoMakeItems(0, [
      { code: '290F60471R', name: '系列控制器', unit: 799.70, ratio: 1.00, qty: 10, stock: 120, onway: 0 },
      { code: '6401704', name: '储物盒', unit: 279.60, ratio: 1.00, qty: 5, stock: 60, onway: 0 }
    ])
  });
  orders.push({
    idx: 1, orderNo: 'HUB02510150002', store: '经开永旺店', storeCode: 'JY001', customer: '远航汽车服务连锁',
    saleType: '店销', saleDate: '2026-10-09', docStatus: '有效', payStatus: '未收款', outStatus: '未出库',
    submitter: PSO_SUBMITTERS[1], submitTime: '2026-10-09 10:05:47', repairOrder: '',
    items: psoMakeItems(1, [
      { code: '8020979', name: '前大灯总成', unit: 1580.00, ratio: 0.95, qty: 4, stock: 18, onway: 6 },
      { code: '6412377', name: '后视镜总成（左）', unit: 460.00, ratio: 0.90, qty: 6, stock: 40, onway: 0 }
    ])
  });
  orders.push({
    idx: 2, orderNo: 'HUB02510150003', store: '经开永旺店', storeCode: 'JY001', customer: psoCarOwners()[0] ? psoCarOwners()[0].name : '沐云汐',
    saleType: '个销', saleDate: '2026-10-10', docStatus: '有效', payStatus: '未收款', outStatus: '未出库',
    submitter: PSO_SUBMITTERS[2], submitTime: '2026-10-10 14:22:08', repairOrder: 'WX20261010007',
    items: psoMakeItems(2, [
      { code: '8020985', name: '机油滤清器', unit: 350.88, ratio: 0.88, qty: 2, stock: 200, onway: 0 }
    ])
  });

  /* ---- 组2：已作废 ---- */
  orders.push({
    idx: 3, orderNo: 'HUB02510150004', store: '经开永旺店', storeCode: 'JY001', customer: '星海汽贸有限公司',
    saleType: '店销', saleDate: '2026-10-11', docStatus: '已作废', payStatus: '未收款', outStatus: '未出库',
    submitter: PSO_SUBMITTERS[0], submitTime: '2026-10-11 08:40:19', repairOrder: '',
    items: psoMakeItems(3, [{ code: '6401704', name: '储物盒', unit: 279.60, ratio: 1.00, qty: 20, stock: 60, onway: 0 }])
  });
  orders.push({
    idx: 4, orderNo: 'HUB02510150005', store: '经开永旺店', storeCode: 'JY001', customer: '远航汽车服务连锁',
    saleType: '店销', saleDate: '2026-10-12', docStatus: '已作废', payStatus: '未收款', outStatus: '未出库',
    submitter: PSO_SUBMITTERS[1], submitTime: '2026-10-12 11:30:55', repairOrder: '',
    items: psoMakeItems(4, [{ code: '8020979', name: '前大灯总成', unit: 1580.00, ratio: 0.90, qty: 2, stock: 18, onway: 0 }])
  });

  /* ---- 组3：有效 + 已结清 + 未出库（可取消）---- */
  orders.push({
    idx: 5, orderNo: 'HUB02510150006', store: '经开永旺店', storeCode: 'JY001', customer: psoCarOwners()[1] ? psoCarOwners()[1].name : '张建国',
    saleType: '个销', saleDate: '2026-10-13', docStatus: '有效', payStatus: '已结清', outStatus: '未出库',
    submitter: PSO_SUBMITTERS[2], submitTime: '2026-10-13 09:55:04', repairOrder: 'WX20261013003',
    items: psoMakeItems(5, [
      { code: '6412377', name: '后视镜总成（左）', unit: 460.00, ratio: 0.95, qty: 4, stock: 40, onway: 0 },
      { code: '6401704', name: '储物盒', unit: 279.60, ratio: 1.00, qty: 8, stock: 60, onway: 0 }
    ])
  });
  orders.push({
    idx: 6, orderNo: 'HUB02510150007', store: '经开永旺店', storeCode: 'JY001', customer: psoCarOwners()[2] ? psoCarOwners()[2].name : '李思远',
    saleType: '个销', saleDate: '2026-10-14', docStatus: '有效', payStatus: '已结清', outStatus: '未出库',
    submitter: PSO_SUBMITTERS[3], submitTime: '2026-10-14 16:18:41', repairOrder: '',
    items: psoMakeItems(6, [{ code: '290F60471R', name: '系列控制器', unit: 799.70, ratio: 0.90, qty: 3, stock: 120, onway: 0 }])
  });

  /* ---- 组4：有效 + 已结清 + 全部出库（可退货、可开票）---- */
  orders.push({
    idx: 7, orderNo: 'HUB02510150008', store: '经开永旺店', storeCode: 'JY001', customer: psoCarOwners()[3] ? psoCarOwners()[3].name : '王雅静',
    saleType: '个销', saleDate: '2026-10-15', docStatus: '有效', payStatus: '已结清', outStatus: '全部出库',
    submitter: PSO_SUBMITTERS[0], submitTime: '2026-10-15 10:02:26', repairOrder: 'WX20261015002',
    items: psoMakeItems(7, [
      { code: '290F60471R', name: '系列控制器', unit: 799.70, ratio: 1.00, qty: 10, shipped: 10, stock: 120, onway: 0, returned: '2.00' }
    ])
  });
  orders.push({
    idx: 8, orderNo: 'HUB02510150009', store: '经开永旺店', storeCode: 'JY001', customer: '星海汽贸有限公司',
    saleType: '店销', saleDate: '2026-10-16', docStatus: '有效', payStatus: '已结清', outStatus: '全部出库',
    submitter: PSO_SUBMITTERS[1], submitTime: '2026-10-16 13:44:12', repairOrder: '',
    items: psoMakeItems(8, [
      { code: '8020979', name: '前大灯总成', unit: 1580.00, ratio: 0.95, qty: 4, shipped: 4, stock: 18, onway: 0, returned: '1.00' },
      { code: '6412377', name: '后视镜总成（左）', unit: 460.00, ratio: 1.00, qty: 6, shipped: 6, stock: 40, onway: 0 }
    ])
  });
  orders.push({
    idx: 9, orderNo: 'HUB02510150010', store: '经开永旺店', storeCode: 'JY001', customer: '远航汽车服务连锁',
    saleType: '店销', saleDate: '2026-10-17', docStatus: '有效', payStatus: '已结清', outStatus: '全部出库',
    submitter: PSO_SUBMITTERS[2], submitTime: '2026-10-17 09:20:38', repairOrder: '',
    items: psoMakeItems(9, [{ code: '6401704', name: '储物盒', unit: 279.60, ratio: 0.90, qty: 12, shipped: 12, stock: 60, onway: 0 }])
  });

  /* ---- 组5：有效 + 部分收款 + 部分出库 ---- */
  orders.push({
    idx: 10, orderNo: 'HUB02510150011', store: '经开永旺店', storeCode: 'JY001', customer: psoCarOwners()[4] ? psoCarOwners()[4].name : '陈志明',
    saleType: '个销', saleDate: '2026-10-18', docStatus: '有效', payStatus: '部分收款', outStatus: '部分出库',
    submitter: PSO_SUBMITTERS[3], submitTime: '2026-10-18 15:07:50', repairOrder: 'WX20261018005',
    items: psoMakeItems(10, [
      { code: '290F60471R', name: '系列控制器', unit: 799.70, ratio: 0.95, qty: 8, shipped: 5, stock: 120, onway: 10 }
    ])
  });
  orders.push({
    idx: 11, orderNo: 'HUB02510150012', store: '经开永旺店', storeCode: 'JY001', customer: psoCarOwners()[5] ? psoCarOwners()[5].name : '刘婉如',
    saleType: '个销', saleDate: '2026-10-19', docStatus: '有效', payStatus: '部分收款', outStatus: '部分出库',
    submitter: PSO_SUBMITTERS[0], submitTime: '2026-10-19 11:33:24', repairOrder: '',
    items: psoMakeItems(11, [
      { code: '8020985', name: '机油滤清器', unit: 350.88, ratio: 0.88, qty: 6, shipped: 3, stock: 200, onway: 0, canceled: '1.00' }
    ])
  });

  /* 汇总合计品种 / 合计金额 */
  orders.forEach(function (o) {
    var kinds = 0, amount = 0;
    o.items.forEach(function (it) {
      kinds += 1;
      amount += parseFloat(it.amount);
    });
    o.kinds = psoQty(kinds);
    o.amount = psoMoney(amount);
  });
  return orders;
}

/* ---------------- 销售取消单种子（6 条）----------------
   退款登记：未退款 ×3 / 部分退款 ×2 / 已退款 ×1
   时序铁律：取消时间 ≥ 关联销售单提交时间 */
function psoCancelSeed() {
  var src = [
    { orderIdx: 0, qty: 2.00, pay: '未退款', at: '2026-10-09 16:20:11' },
    { orderIdx: 1, qty: 1.00, pay: '未退款', at: '2026-10-10 09:12:37' },
    { orderIdx: 3, qty: 5.00, pay: '部分退款', at: '2026-10-12 14:05:22' },
    { orderIdx: 4, qty: 1.00, pay: '部分退款', at: '2026-10-13 10:48:03' },
    { orderIdx: 5, qty: 3.00, pay: '已退款', at: '2026-10-14 15:30:19' },
    { orderIdx: 11, qty: 1.00, pay: '未退款', at: '2026-10-19 17:02:44' }
  ];
  return src.map(function (s, i) {
    var o = psoOrderAll()[s.orderIdx];
    var amount = 0;
    var items = s.qty > 0 ? [{
      code: o.items[0].code,
      name: o.items[0].name,
      unit: o.items[0].unit,
      snp: o.items[0].snp,
      saleQty: o.items[0].qty,
      cancelQty: psoQty(s.qty),
      unitPrice: o.items[0].discountPrice,
      amount: psoMoney(parseFloat(o.items[0].discountPrice) * s.qty)
    }] : [];
    items.forEach(function (it) { amount += parseFloat(it.amount); });
    return {
      idx: i,
      cancelNo: 'HUB0251015300' + (i + 1),
      orderNo: o.orderNo,
      orderIdx: s.orderIdx,
      store: o.store,
      storeCode: o.storeCode,
      customer: o.customer,
      cancelType: o.saleType === '个销' ? '个销取消' : '店销取消',
      kinds: psoQty(s.qty > 0 ? 1 : 0),
      amount: psoMoney(amount),
      refundStatus: s.pay,
      submitter: PSO_SUBMITTERS[i % PSO_SUBMITTERS.length],
      cancelTime: s.at,
      items: items
    };
  });
}

/* ---------------- 销售退货单种子（6 条）----------------
   退库状态：未入库 ×3 / 已入库 ×3；退款登记各 ×2 */
function psoReturnSeed() {
  var src = [
    { orderIdx: 7, reason: '配件不匹配', instock: '未入库', refund: '未退款', at: '2026-10-16 10:11:05', qty: 2.00 },
    { orderIdx: 8, reason: '质量问题', instock: '未入库', refund: '未退款', at: '2026-10-17 09:38:52', qty: 1.00 },
    { orderIdx: 9, reason: '客户多购', instock: '未入库', refund: '未退款', at: '2026-10-18 14:22:16', qty: 2.00 },
    { orderIdx: 7, reason: '运输破损', instock: '已入库', refund: '部分退款', at: '2026-10-18 16:40:33', qty: 1.00 },
    { orderIdx: 8, reason: '客户取消', instock: '已入库', refund: '部分退款', at: '2026-10-19 11:15:28', qty: 2.00 },
    { orderIdx: 9, reason: '质量问题', instock: '已入库', refund: '已退款', at: '2026-10-19 16:52:47', qty: 3.00 }
  ];
  return src.map(function (s, i) {
    var o = psoOrderAll()[s.orderIdx];
    var amount = 0;
    var items = [{
      code: o.items[0].code,
      name: o.items[0].name,
      unit: o.items[0].unit,
      snp: o.items[0].snp,
      saleQty: o.items[0].qty,
      returnQty: psoQty(s.qty),
      unitPrice: o.items[0].discountPrice,
      amount: psoMoney(parseFloat(o.items[0].discountPrice) * s.qty)
    }];
    items.forEach(function (it) { amount += parseFloat(it.amount); });
    return {
      idx: i,
      returnNo: 'HUB0251015400' + (i + 1),
      orderNo: o.orderNo,
      orderIdx: s.orderIdx,
      store: o.store,
      storeCode: o.storeCode,
      customer: o.customer,
      returnType: o.saleType === '个销' ? '个销退货' : '店销退货',
      reason: s.reason,
      kinds: psoQty(1),
      amount: psoMoney(amount),
      instockStatus: s.instock,
      refundStatus: s.refund,
      submitter: PSO_SUBMITTERS[i % PSO_SUBMITTERS.length],
      returnTime: s.at,
      items: items
    };
  });
}

/* 销售单全量（订单种子先生成，取消/退货种子依赖它）*/
function psoOrderAll() {
  if (!window.__PSO_ORDER_ALL) {
    window.__PSO_ORDER_ALL = psoOrderSeed();
  }
  return window.__PSO_ORDER_ALL;
}

/* ---------------- 发票记录种子（5 条，覆盖 4 种卡片状态 × 专票/普票）----------------
   发票号 / 开票申请编号 = 32 位哈希串（依实际截图口径）
   invType  = 该张发票的发票类型（点「复制开票信息」时按它决定申请开票页填哪块抬头）
   orderIdx = 归属销售单，购买方信息按这张单实时带出（详见 psiInvoiceBuyer）
   title    = 普票（002）的开票抬头；专票（001）的抬头在 buyer 6 项里 */
function psoInvoiceSeed() {
  return [
    {
      idx: 0, status: '开票中', invType: '001数电专用发票', orderIdx: 0,
      applyNo: 'a8473d4c593bab3031f6c793f1c324c1', invoiceNo: '',
      applyTime: '2026-10-18 10:22:31', redTime: '', redReason: ''
    },
    {
      idx: 1, status: '开票成功', invType: '002数电普通发票', orderIdx: 8, title: '星海汽贸有限公司',
      applyNo: '6aca9d12dcd13f51d049555e6977e5af', invoiceNo: 'f85af0c5adc2192ccb1f41e1fb3b4b90',
      applyTime: '2026-10-18 10:22:31', redTime: '', redReason: ''
    },
    {
      idx: 2, status: '开票成功', invType: '001数电专用发票', orderIdx: 6,
      applyNo: '130506f74fe5ee5ecbdf90d129663c11', invoiceNo: '74f67f24db629afc4214ed2362946538',
      applyTime: '2026-10-18 09:47:26', redTime: '', redReason: ''
    },
    {
      idx: 3, status: '作废冲红中', invType: '002数电普通发票', orderIdx: 5, title: '张建国',
      applyNo: 'ce4c3110761d689dfef6c293e7bbacad', invoiceNo: '126004daf8dedacb4f29a779c80f0c7a',
      applyTime: '2026-10-18 09:33:46', redTime: '', redReason: ''
    },
    {
      idx: 4, status: '已冲红', invType: '001数电专用发票', orderIdx: 0,
      applyNo: '4642d3e798f02b0f27b8dff95d08f5b0', invoiceNo: 'a4f9098598b14d772f52fc3640ed19f5',
      applyTime: '2026-10-17 15:35:26', redTime: '2026-10-18 10:02:11',
      redReason: '客户名称开具有误，重新开具'
    }
  ];
}

/* 某张专票发票的购买方 6 项信息：按该发票归属的销售单带出
   （用户口径：「复制的哪个就从哪个里面带出来」）
   购买方名称 = 销售单收费对象（第三方单位）或门店名；税号 = 门店纳税识别号；其余为该单示例值 */
function psiInvoiceBuyer(iv) {
  var r = npFindByIdx(psoOrderAll(), iv.orderIdx === undefined ? 0 : iv.orderIdx);
  var DEMO = {
    addr: '上海市浦东新区申江路 2888 号',
    tel: '021-58880000',
    bank: '中国工商银行上海分行张江支行',
    account: '1001 2345 6789 0123'
  };
  return {
    name: r ? (r.customer || r.store) : '',
    tax: r ? psiStoreTaxText(r) : '',
    addr: DEMO.addr, tel: DEMO.tel, bank: DEMO.bank, account: DEMO.account
  };
}

/* ---------------- 出库单视图（退货第一步用）----------------
   数据源 = 配件销售单中出库状态 ∈ 部分出库 / 全部出库 */
function psoOutboundList() {
  return psoOrderAll().filter(function (o) {
    return o.outStatus === '部分出库' || o.outStatus === '全部出库';
  }).map(function (o) {
    var kinds = 0, qty = 0;
    o.items.forEach(function (it) { kinds += 1; qty += parseFloat(it.qty); });
    return {
      idx: o.idx,
      outNo: o.orderNo,
      orderNo: o.orderNo,
      kinds: psoQty(kinds),
      qty: psoQty(qty),
      amount: o.amount,
      customer: o.customer,
      submitter: o.submitter,
      submitTime: o.submitTime,
      saleDate: o.saleDate
    };
  });
}

/* ============================================================
   页面一：配件销售单
   ============================================================ */

/* ---- 列定义 ---- */
function psoCols() {
  return [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    {
      t: '销售单号', w: 130, cls: 'col-no sticky', f: function (r) {
        return '<a href="javascript:void(0)" class="lt-link" onclick="psoOpenPanel(\'detail\',' + r.idx + ')">' + npEscape(r.orderNo) + '</a>';
      }
    },
    { t: '门店名称', w: 110, cls: 'col-store', f: function (r) { return npEscape(r.store); } },
    { t: '门店编码', w: 100, cls: 'col-store-code', f: function (r) { return npEscape(r.storeCode); } },
    { t: '客户', w: 110, cls: 'col-cust', f: function (r) { return npEscape(r.customer); } },
    { t: '销售日期', w: 100, cls: 'col-date', f: function (r) { return npEscape(r.saleDate); } },
    { t: '合计品种', w: 90, cls: 'col-kinds', f: function (r) { return npEscape(r.kinds); } },
    { t: '合计金额', w: 100, cls: 'col-amount', f: function (r) { return npEscape(r.amount); } },
    { t: '单据状态', w: 90, cls: 'col-doc-status', f: function (r) { return npEscape(r.docStatus); } },
    { t: '收款登记情况', w: 110, cls: 'col-pay-status', f: function (r) { return npEscape(r.payStatus); } },
    { t: '出库状态', w: 100, cls: 'col-out-status', f: function (r) { return npEscape(r.outStatus); } },
    { t: '提交人', w: 90, cls: 'col-submitter', f: function (r) { return npEscape(r.submitter); } },
    { t: '提交时间', w: 150, cls: 'col-submit-time', f: function (r) { return npEscape(r.submitTime); } },
    { t: '操作', w: 130, cls: 'col-actions', f: function (r) { return psoOpsHtml(r); } }
  ];
}

/* ---- 行操作状态机（2026-10-20 用户拍板：按订单逻辑显示对应按钮，不能操作的直接不显示）----
   有效 + 未收款 + 未出库     → 编辑 / 作废 / 取消
   有效 + 已(部分)收款 + 未出库 → 取消
   有效 + 已(部分)收款 + 已出库 → 退货 / 发票
   已作废 → 不显示任何按钮 */
function psoOpsHtml(r) {
  var btns = [];
  var editable = (r.docStatus === '有效' && r.payStatus === '未收款');
  var shipped = (r.outStatus === '部分出库' || r.outStatus === '全部出库');

  if (r.docStatus !== '有效') return '';   /* 已作废：无任何操作 */

  if (editable) {
    btns.push('<a href="javascript:void(0)" class="lt-link" onclick="psoOpenPanel(\'edit\',' + r.idx + ')">编辑</a>');
    btns.push('<a href="javascript:void(0)" class="lt-link np-red" onclick="psoVoidOrder(' + r.idx + ')">作废</a>');
  }

  if (!shipped) {
    /* 未出库（无论收款与否）→ 可取消 */
    btns.push('<a href="javascript:void(0)" class="lt-link" onclick="psoOpenCancel(' + r.idx + ')">取消</a>');
  } else {
    /* 已出库 → 可退货、可开票 */
    btns.push('<a href="javascript:void(0)" class="lt-link" onclick="psoGoReturn(' + r.idx + ')">退货</a>');
    btns.push('<a href="javascript:void(0)" class="lt-link" onclick="psoOpenInvoice(' + r.idx + ')">发票</a>');
  }
  return npRenderActions(btns, btns.length);
}

/* ---- 作废 ---- */
function psoVoidOrder(idx) {
  var st = NP['parts-sales-order'];
  var r = npFindByIdx(st.allData, idx);
  if (!r) { npToast('未找到该销售单'); return; }
  if (r.docStatus === '已作废') { npToast('该销售单已作废'); return; }
  if (r.payStatus !== '未收款') { npToast('已结清的销售单不可作废，请走取消流程'); return; }
  if (!window.confirm('确认作废销售单「' + r.orderNo + '」？')) return;
  r.docStatus = '已作废';
  st.query();
  npToast('已作废');
}

/* ---- 导出 ---- */
function psoExport() {
  var st = NP['parts-sales-order'];
  var data = st.filtered;
  if (!data || data.length === 0) { npToast('暂无数据可导出'); return; }
  var headers = ['序号', '销售单号', '门店名称', '门店编码', '客户', '销售日期', '合计品种', '合计金额', '单据状态', '收款登记情况', '出库状态', '提交人', '提交时间'];
  var rows = data.map(function (r, i) {
    return [i + 1, r.orderNo, r.store, r.storeCode, r.customer, r.saleDate, r.kinds, r.amount, r.docStatus, r.payStatus, r.outStatus, r.submitter, r.submitTime];
  });
  npExportExcelRowsRaw('配件销售单_' + npNowLocal().slice(0, 10).replace(/-/g, ''), headers, rows);
  npToast('导出成功');
}

/* ---- 从销售单跳转到退货页并带入单号 ---- */
function psoGoReturn(idx) {
  var st = NP['parts-sales-order'];
  var r = npFindByIdx(st.allData, idx);
  if (!r) { npToast('未找到该销售单'); return; }
  showContent('parts-sales-return');
  var rs = NP['parts-sales-return'];
  if (rs) {
    var el = document.getElementById('psr-f-no');
    if (el) el.value = r.orderNo;
    rs.query();
    /* 直接打开第二步退货录入，父弹框（选单）不打开 */
    setTimeout(function () { psrOpenForm(r.idx); }, 60);
  }
}

/* ---- 页面初始化 ---- */
function initPartsSalesOrder() {
  var K = 'parts-sales-order';
  var root = document.getElementById('page-' + K);
  if (!root) return;

  var filter =
    npFItem('销售单号', '<input type="text" id="' + K + '-f-no" placeholder="请输入">') +
    npSelect('销售类型', '<select id="' + K + '-f-type"><option value="">请选择</option>' +
      PSO_TYPE_OPTS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
    npFItem('客户', '<input type="text" id="' + K + '-f-cust" placeholder="请输入">') +
    '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">销售日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="NP[\'' + K + '\'].query()">' +
      '<div class="lt-date-range-drop">' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + K + '-d-s" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
        '<span>—</span>' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + K + '-d-e" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div></div></div>' +
    npSelect('收款登记情况', '<select id="' + K + '-f-pay"><option value="">请选择</option>' +
      PSO_PAY_OPTS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
    npSelect('出库状态', '<select id="' + K + '-f-out"><option value="">请选择</option>' +
      PSO_OUT_OPTS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
    npSelect('单据状态', '<select id="' + K + '-f-doc"><option value="">请选择</option><option selected>有效</option><option>已作废</option></select>');

  var toolbar = '<button class="lt-btn lt-btn-primary" onclick="psoOpenPanel(\'add\',-1)">新建</button>' +
    '<button class="lt-btn lt-btn-default" onclick="psoExport()">导出</button>';

  var cols = psoCols();
  root.innerHTML = npShell(K, { l2: '配件销售管理', l3: '配件销售单' }, filter, toolbar, npTH(cols), K + '-tbody', K + '-pager');

  NP[K] = { page: 1, pageSize: 20, allData: psoOrderAll().slice(), filtered: [], render: null, query: null, reset: null };
  var st = NP[K];

  initFilterGrid(K + '-filterGrid', 7); st._fShow = 7; st._fExp = false;

  function readRange() {
    var ds = document.getElementById(K + '-d-s');
    var de = document.getElementById(K + '-d-e');
    return { s: ds ? ds.value.trim() : '', e: de ? de.value.trim() : '' };
  }

  st.query = function () {
    var g = function (id) { var e = document.getElementById(K + id); return e ? e.value.trim() : ''; };
    var no = g('-f-no'), type = g('-f-type'), cust = g('-f-cust');
    var pay = g('-f-pay'), out = g('-f-out'), doc = g('-f-doc');
    var rg = readRange();
    st.filtered = st.allData.filter(function (r) {
      return (no === '' || r.orderNo.indexOf(no) >= 0) &&
        (type === '' || r.saleType === type) &&
        (cust === '' || r.customer.indexOf(cust) >= 0) &&
        (pay === '' || r.payStatus === pay) &&
        (out === '' || r.outStatus === out) &&
        (doc === '' || r.docStatus === doc) &&
        (rg.s === '' || r.saleDate >= rg.s) &&
        (rg.e === '' || r.saleDate <= rg.e);
    });
    st.page = 1; st.render();
  };

  st.reset = function () {
    ['-f-no', '-f-cust'].forEach(function (s) { var e = document.getElementById(K + s); if (e) e.value = ''; });
    ['-f-type', '-f-pay', '-f-out'].forEach(function (s) { var e = document.getElementById(K + s); if (e) e.value = ''; });
    var ed = document.getElementById(K + '-f-doc'); if (ed) ed.value = '有效';
    var ds = document.getElementById(K + '-d-s'); if (ds) ds.value = '';
    var de = document.getElementById(K + '-d-e'); if (de) de.value = '';
    var tx = root.querySelector('.lt-date-range-text'); if (tx) tx.value = '';
    st.query();
  };

  st.render = function () { npRenderTable(K, K + '-tbody', K + '-pager', cols, st.filtered, st); };

  st.filtered = st.allData.filter(function (r) { return r.docStatus === '有效'; });
  st.page = 1; st.render();
}

npRegisterModuleInit('parts-sales-order', function () { initPartsSalesOrder(); });

/* ============================================================
   销售单制作 / 详情 —— 右侧滑出面板（1000px，沿用 pm-panel 结构）
   ============================================================ */

/* 确保面板骨架存在（只建一次）*/
function psoEnsurePanel() {
  if (document.getElementById('pso-panel-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML =
    '<div class="pm-panel-overlay" id="pso-panel-overlay" onclick="psoClosePanel()"></div>' +
    '<div class="pm-panel" id="pso-panel" style="width:1000px">' +
      '<div class="pm-panel-header">' +
        '<div style="display:flex;align-items:center">' +
          '<span class="pm-panel-title" id="pso-panel-title">配件销售单</span>' +
          '<span class="pm-panel-badge" id="pso-panel-badge">新增</span>' +
        '</div>' +
        '<button class="pm-panel-close" onclick="psoClosePanel()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body">' +
        '<div class="pm-section-title">基本信息</div>' +
        '<div class="pm-form-grid" id="pso-basic-info"></div>' +
        '<div class="pm-section-title" id="pso-items-title">配件明细 <span id="pso-items-toolbar" class="pp-parts-toolbar"></span></div>' +
        '<div style="overflow-x:auto;margin-bottom:8px">' +
          '<table class="pp-parts-table" id="pso-items-table">' +
            '<thead><tr>' +
              '<th style="width:36px"><input type="checkbox" id="psof-check-all" onchange="psofToggleAll(this.checked)"></th>' +
              '<th style="width:40px">序号</th>' +
              '<th style="width:100px">配件编码</th>' +
              '<th>配件名称</th>' +
              '<th style="width:70px">计量单位</th>' +
              '<th style="width:80px">出库SNP</th>' +
              '<th style="width:90px">单价(含税)</th>' +
              '<th style="width:80px">折扣比率</th>' +
              '<th style="width:90px">折后价</th>' +
              '<th style="width:70px">数量</th>' +
              '<th style="width:100px">金额(含税)</th>' +
              '<th style="width:70px">库存数</th>' +
              '<th style="width:70px">在途数</th>' +
            '</tr></thead>' +
            '<tbody id="psof-items-tbody"></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="pp-panel-totals" id="psof-totals">金额合计(含税): <b>¥0.00</b></div>' +
        '<div class="pso-export-row" id="pso-export-row" style="display:none">' +
          '<button class="lt-btn lt-btn-default" onclick="psoDetailExport()">导出</button>' +
        '</div>' +
      '</div>' +
      '<div class="pm-panel-footer" id="pso-panel-footer"></div>' +
    '</div>';
  while (d.firstChild) document.body.appendChild(d.firstChild);
}

/* 打开面板：mode = add / edit / detail */
function psoOpenPanel(mode, idx) {
  psoEnsurePanel();
  var isDetail = (mode === 'detail');
  var isEdit = (mode === 'edit');
  var r = null;
  if (isEdit || isDetail) {
    r = npFindByIdx(NP['parts-sales-order'].allData, idx);
    if (!r) { npToast('未找到该销售单'); return; }
  }

  document.getElementById('pso-panel-title').textContent = isDetail ? '配件销售单详情' : '配件销售单制作';
  var badge = document.getElementById('pso-panel-badge');
  badge.textContent = isDetail ? '详情' : (isEdit ? '编辑' : '新增');
  badge.className = 'pm-panel-badge' + (isDetail ? ' detail' : (isEdit ? '' : ' add'));

  /* 基本信息 */
  var basic =
    '<div class="lt-input-wrap"><span class="lt-filter-prefix">销售类型</span><select id="pso-form-type"' + (isDetail ? ' disabled' : '') + '>' +
      '<option value="">请选择</option>' +
      PSO_TYPE_OPTS.map(function (t) {
        return '<option' + (r && r.saleType === t ? ' selected' : '') + '>' + npEscape(t) + '</option>';
      }).join('') +
    '</select></div>' +
    '<div class="lt-input-wrap required ' + (isDetail ? 'plain' : 'pick') + '"' + (isDetail ? '' : ' onclick="psoPickCustomer()"') + '>' +
      '<span class="lt-filter-prefix">客户</span>' +
      '<input type="text" id="pso-form-cust" readonly' + (isDetail ? '' : ' placeholder="请从车主管理中选择"') + ' value="' + (r ? npEscape(r.customer) : '') + '">' +
      (isDetail ? '' :
        '<svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg>') +
    '</div>' +
    '<div class="lt-input-wrap required plain"><span class="lt-filter-prefix">销售日期</span>' +
      '<input type="text" id="pso-form-date"' + (isDetail ? ' readonly' : ' placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" onchange="this.classList.remove(\'date-shim\')"') +
      ' value="' + (r ? npEscape(r.saleDate) : '') + '">' +
    '</div>' +
    '<div class="lt-input-wrap plain"><span class="lt-filter-prefix">报修单</span>' +
      '<input type="text" id="pso-form-repair"' + (isDetail ? ' readonly' : ' placeholder="请输入"') + ' value="' + (r ? npEscape(r.repairOrder || '') : '') + '">' +
    '</div>';
  document.getElementById('pso-basic-info').innerHTML = basic;

  /* 明细工具栏：详情态不显示 */
  document.getElementById('pso-items-toolbar').innerHTML = isDetail ? '' :
    '<button class="lt-btn lt-btn-default" onclick="psofAddRow()">配件选择</button>' +
    '<button class="lt-btn lt-btn-default" onclick="psofImport()">导入</button>' +
    '<button class="lt-btn lt-btn-default" onclick="psofRemoveRows()">配件删除</button>' +
    '<button class="lt-btn lt-btn-default" onclick="psoResetForm()">重置</button>';

  /* footer：详情态只有导出 */
  document.getElementById('pso-panel-footer').innerHTML = isDetail ? '' :
    '<button class="lt-btn lt-btn-default" onclick="psoSaveDraft()">保存草稿</button>' +
    '<button class="lt-btn lt-btn-default" onclick="psoResetForm()">重置</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="psoSubmit()">保存提交</button>';

  document.getElementById('pso-export-row').style.display = isDetail ? 'block' : 'none';

  /* 明细：详情态列不同（取消数量/退货数量/实际数量），先重写表头 */
  psoRenderItemsHead(isDetail);
  psoRenderItems(isDetail ? (r ? r.items : []) : (r ? r.items.slice() : [{ code: '', name: '', unit: 'EA', snp: '0.00', unitPrice: '', ratio: '1.00', qty: '', amount: '0.00', stock: '0', onway: '0' }]), isDetail);

  document.getElementById('pso-panel-overlay').classList.add('show');
  document.getElementById('pso-panel').classList.add('show');
}

/* 明细表头：制作态13 列 / 详情态 12 列（PRD 截图口径）*/
function psoRenderItemsHead(isDetail) {
  var th = isDetail
    ? '<th style="width:40px">序号</th><th style="width:100px">配件编码</th><th>配件名称</th>' +
      '<th style="width:70px">计量单位</th><th style="width:80px">出库SNP</th><th style="width:70px">数量</th>' +
      '<th style="width:90px">单价(含税)</th><th style="width:100px">折后单价(含税)</th><th style="width:100px">金额(含税)</th>' +
      '<th style="width:90px">取消数量</th><th style="width:90px">退货数量</th><th style="width:90px">实际数量</th>'
    : '<th style="width:36px"><input type="checkbox" id="psof-check-all" onchange="psofToggleAll(this.checked)"></th>' +
      '<th style="width:40px">序号</th><th style="width:100px">配件编码</th><th>配件名称</th>' +
      '<th style="width:70px">计量单位</th><th style="width:80px">出库SNP</th><th style="width:90px">单价(含税)</th>' +
      '<th style="width:80px">折扣比率</th><th style="width:90px">折后价</th><th style="width:70px">数量</th>' +
      '<th style="width:100px">金额(含税)</th><th style="width:70px">库存数</th><th style="width:70px">在途数</th>';
  document.querySelector('#pso-items-table thead tr').innerHTML = th;
}

/* 明细行渲染 */
function psoRenderItems(items, isDetail) {
  var tb = document.getElementById('psof-items-tbody');
  if (!tb) return;
  var h = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (isDetail) {
      h += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + npEscape(it.code) + '</td>' +
        '<td>' + npEscape(it.name) + '</td>' +
        '<td>' + npEscape(it.unit) + '</td>' +
        '<td>' + npEscape(it.snp) + '</td>' +
        '<td>' + npEscape(it.qty) + '</td>' +
        '<td>' + npEscape(it.unitPrice) + '</td>' +
        '<td>' + npEscape(it.discountPrice) + '</td>' +
        '<td>' + npEscape(it.amount) + '</td>' +
        '<td>' + npEscape(it.canceled || '0.00') + '</td>' +
        '<td>' + npEscape(it.returned || '0.00') + '</td>' +
        '<td>' + npEscape(it.actual) + '</td>' +
        '</tr>';
    } else {
      h += '<tr>' +
        '<td><input type="checkbox" class="psof-check" data-i="' + i + '"' + (it.code ? '' : ' checked') + '></td>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><input type="text" class="psof-code" data-i="' + i + '" value="' + npEscape(it.code) + '" placeholder="请输入"></td>' +
        '<td><input type="text" class="psof-name" data-i="' + i + '" value="' + npEscape(it.name) + '" placeholder="请输入"></td>' +
        '<td><input type="text" class="psof-unit" data-i="' + i + '" value="' + npEscape(it.unit) + '" readonly></td>' +
        '<td>' + npEscape(it.snp || '0.00') + '</td>' +
        '<td><input type="text" class="psof-price js-lock" data-i="' + i + '" value="' + npEscape(it.unitPrice) + '" readonly placeholder="请输入"></td>' +
        '<td><input type="text" class="psof-ratio" data-i="' + i + '" value="' + npEscape(it.ratio || '1.00') + '" placeholder="请输入" onchange="psofRecalc(' + i + ')"></td>' +
        '<td><input type="text" class="psof-dp js-lock" data-i="' + i + '" value="' + npEscape(it.discountPrice || '0.00') + '" readonly></td>' +
        '<td><input type="text" class="psof-qty" data-i="' + i + '" value="' + npEscape(it.qty === '0.00' ? '' : it.qty) + '" placeholder="请输入" onchange="psofRecalc(' + i + ')"></td>' +
        '<td><input type="text" class="psof-amt js-lock" data-i="' + i + '" value="' + npEscape(it.amount || '0.00') + '" readonly></td>' +
        '<td>' + npEscape(it.stock === undefined ? '0' : it.stock) + '</td>' +
        '<td>' + npEscape(it.onway === undefined ? '0' : it.onway) + '</td>' +
        '</tr>';
    }
  }
  tb.innerHTML = h;
  psoRecalcTotals();
}

/* 重算某行：折后价 = 单价 × 折扣比率；金额 = 折后价 × 数量 */
function psofRecalc(i) {
  var priceEl = document.querySelector('.psof-price[data-i="' + i + '"]');
  var ratioEl = document.querySelector('.psof-ratio[data-i="' + i + '"]');
  var qtyEl = document.querySelector('.psof-qty[data-i="' + i + '"]');
  var dpEl = document.querySelector('.psof-dp[data-i="' + i + '"]');
  var amtEl = document.querySelector('.psof-amt[data-i="' + i + '"]');
  if (!priceEl || !ratioEl || !dpEl || !amtEl) return;

  var ratio = ratioEl.value.trim();
  if (ratio !== '' && !psoDiscountAllowed(ratio)) {
    var R = window.PSO_DISCOUNT_RANGE;
    npToast('折扣比率超出您的权限范围（' + (R.min * 100) + '%~' + (R.max * 100) + '%），请保留草稿交由有权限的同事编辑提交');
  }
  var dp = psoCalcDiscountPrice(priceEl.value, ratio || '0');
  dpEl.value = psoMoney(dp);
  var qty = qtyEl && qtyEl.value.trim() !== '' ? parseFloat(qtyEl.value) : 0;
  amtEl.value = psoMoney(isNaN(qty) ? 0 : dp * qty);
  psoRecalcTotals();
}

/* 合计：仅勾选行计入（沿用配件采购口径）*/
function psoRecalcTotals() {
  var checks = document.querySelectorAll('#psof-items-tbody .psof-check');
  var total = 0;
  for (var i = 0; i < checks.length; i++) {
    if (!checks[i].checked) continue;
    var amtEl = document.querySelector('.psof-amt[data-i="' + checks[i].getAttribute('data-i') + '"]');
    if (amtEl) total += parseFloat(amtEl.value || 0);
  }
  var box = document.getElementById('psof-totals');
  if (box) box.innerHTML = '金额合计(含税): <b>¥' + psoMoney(total) + '</b>';
}

/* 全选 */
function psofToggleAll(checked) {
  var checks = document.querySelectorAll('#psof-items-tbody .psof-check');
  for (var i = 0; i < checks.length; i++) checks[i].checked = checked;
  psoRecalcTotals();
}

/* 配件选择：演示弹框，从既有配件里选一行加入明细 */
function psofAddRow() {
  var pool = [
    { code: '290F60471R', name: '系列控制器', unit: 'EA', price: 799.70, stock: 120, onway: 0 },
    { code: '6401704', name: '储物盒', unit: 'EA', price: 279.60, stock: 60, onway: 0 },
    { code: '8020979', name: '前大灯总成', unit: 'EA', price: 1580.00, stock: 18, onway: 6 },
    { code: '8020985', name: '机油滤清器', unit: 'EA', price: 350.88, stock: 200, onway: 0 },
    { code: '6412377', name: '后视镜总成（左）', unit: 'EA', price: 460.00, stock: 40, onway: 0 }
  ];
  var rows = pool.map(function (p, i) {
    return '<tr><td><input type="checkbox" class="pso-pick-check" data-i="' + i + '"></td>' +
      '<td>' + i + '</td><td>' + npEscape(p.code) + '</td><td>' + npEscape(p.name) + '</td>' +
      '<td>' + npEscape(p.unit) + '</td><td>' + psoMoney(p.price) + '</td>' +
      '<td>' + p.stock + '</td><td>' + p.onway + '</td></tr>';
  }).join('');
  var body = '<div style="max-height:320px;overflow:auto"><table class="pp-parts-table">' +
    '<thead><tr><th style="width:36px"></th><th style="width:40px">序号</th><th style="width:100px">配件编码</th><th>配件名称</th>' +
    '<th style="width:70px">计量单位</th><th style="width:90px">单价(含税)</th><th style="width:70px">库存数</th><th style="width:70px">在途数</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
  npOpenModal('配件选择', body,
    '<button class="lt-btn lt-btn-primary" onclick="psofConfirmPick()">确定</button>', { width: 760 });
}

/* 确认配件选择 → 追加到明细 */
function psofConfirmPick() {
  var picks = document.querySelectorAll('.pso-pick-check');
  var tb = document.getElementById('psof-items-tbody');
  if (!tb) { npCloseModal(); return; }
  var pool = [
    { code: '290F60471R', name: '系列控制器', unit: 'EA', price: 799.70, stock: 120, onway: 0 },
    { code: '6401704', name: '储物盒', unit: 'EA', price: 279.60, stock: 60, onway: 0 },
    { code: '8020979', name: '前大灯总成', unit: 'EA', price: 1580.00, stock: 18, onway: 6 },
    { code: '8020985', name: '机油滤清器', unit: 'EA', price: 350.88, stock: 200, onway: 0 },
    { code: '6412377', name: '后视镜总成（左）', unit: 'EA', price: 460.00, stock: 40, onway: 0 }
  ];
  for (var i = 0; i < picks.length; i++) {
    if (!picks[i].checked) continue;
    var p = pool[parseInt(picks[i].getAttribute('data-i'), 10)];
    var idx = tb.rows.length;
    tb.insertAdjacentHTML('beforeend',
      '<tr>' +
      '<td><input type="checkbox" class="psof-check" data-i="' + idx + '" checked></td>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td><input type="text" class="psof-code" data-i="' + idx + '" value="' + npEscape(p.code) + '" readonly></td>' +
      '<td><input type="text" class="psof-name" data-i="' + idx + '" value="' + npEscape(p.name) + '" readonly></td>' +
      '<td><input type="text" class="psof-unit" data-i="' + idx + '" value="' + npEscape(p.unit) + '" readonly></td>' +
      '<td>0.00</td>' +
      '<td><input type="text" class="psof-price js-lock" data-i="' + idx + '" value="' + psoMoney(p.price) + '" readonly></td>' +
      '<td><input type="text" class="psof-ratio" data-i="' + idx + '" value="1.00" onchange="psofRecalc(' + idx + ')"></td>' +
      '<td><input type="text" class="psof-dp js-lock" data-i="' + idx + '" value="' + psoMoney(p.price) + '" readonly></td>' +
      '<td><input type="text" class="psof-qty" data-i="' + idx + '" placeholder="请输入" onchange="psofRecalc(' + idx + ')"></td>' +
      '<td><input type="text" class="psof-amt js-lock" data-i="' + idx + '" value="0.00" readonly></td>' +
      '<td>' + p.stock + '</td><td>' + p.onway + '</td></tr>');
  }
  npCloseModal();
  psoRecalcTotals();
}

/* 导入：走 npExportExcelRows 的同源 XLSX 解析入口不足，本轮按演示提示处理（不写死 alert）*/
function psofImport() {
  npToast('批量导入模板下载与解析待SAP 接口联调后开放，本轮请用「配件选择」逐行添加');
}

/* 配件删除：删除勾选行 */
function psofRemoveRows() {
  var tb = document.getElementById('psof-items-tbody');
  if (!tb) return;
  var checks = tb.querySelectorAll('.psof-check');
  var removed = 0;
  for (var i = checks.length - 1; i >= 0; i--) {
    if (checks[i].checked) { checks[i].closest('tr').remove(); removed++; }
  }
  if (removed === 0) { npToast('请先勾选要删除的配件行'); return; }
  /* 重排序号与 data-i */
  var rows = tb.querySelectorAll('tr');
  for (var j = 0; j < rows.length; j++) {
    rows[j].cells[1].textContent = j + 1;
    var cbs = rows[j].querySelectorAll('[data-i]');
    for (var k = 0; k < cbs.length; k++) cbs[k].setAttribute('data-i', j);
  }
  psoRecalcTotals();
  npToast('已删除 ' + removed + ' 行');
}

/* 重置表单 */
function psoResetForm() {
  if (!window.confirm('确认重置当前销售单？已填写内容将清空')) return;
  psoClosePanel();
  psoOpenPanel('add', -1);
}

/* 保存草稿 */
function psoSaveDraft() {
  var v = psoReadForm();
  if (!v.cust) { npToast('请选择客户'); return; }
  npToast('草稿已保存（演示）：' + (v.orderNo || '未生成单号'));
}

/* 保存提交 */
function psoSubmit() {
  var v = psoReadForm();
  if (!v.saleType) { npToast('请选择销售类型'); return; }
  if (!v.cust) { npToast('请选择客户'); return; }
  if (!v.saleDate) { npToast('请选择销售日期'); return; }
  if (v.items.length === 0) { npToast('请至少添加一行配件明细'); return; }
  for (var i = 0; i < v.items.length; i++) {
    var it = v.items[i];
    if (!it.code) { npToast('第 ' + (i + 1) + ' 行配件编码不能为空'); return; }
    if (it.ratio === '' || isNaN(parseFloat(it.ratio))) { npToast('第 ' + (i + 1) + ' 行请填写折扣比率'); return; }
    if (!psoDiscountAllowed(it.ratio)) {
      var R = window.PSO_DISCOUNT_RANGE;
      npToast('第 ' + (i + 1) + ' 行折扣比率超出您的权限范围（' + (R.min * 100) + '%~' + (R.max * 100) + '%），请保存草稿交由有权限的同事提交');
      return;
    }
    if (it.qty === '' || isNaN(parseFloat(it.qty)) || parseFloat(it.qty) <= 0) {
      npToast('第 ' + (i + 1) + ' 行请填写正确的数量'); return;
    }
  }
  npToast('销售单已提交（演示）');
  psoClosePanel();
}

/* 读取表单 */
function psoReadForm() {
  var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var items = [];
  var tb = document.getElementById('psof-items-tbody');
  if (tb) {
    var rows = tb.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var codeEl = rows[i].querySelector('.psof-code');
      var nameEl = rows[i].querySelector('.psof-name');
      var priceEl = rows[i].querySelector('.psof-price');
      var ratioEl = rows[i].querySelector('.psof-ratio');
      var qtyEl = rows[i].querySelector('.psof-qty');
      var checkEl = rows[i].querySelector('.psof-check');
      if (!codeEl) continue;
      if (checkEl && !checkEl.checked) continue;
      items.push({
        code: codeEl.value.trim(),
        name: nameEl ? nameEl.value.trim() : '',
        unitPrice: priceEl ? priceEl.value.trim() : '',
        ratio: ratioEl ? ratioEl.value.trim() : '',
        qty: qtyEl ? qtyEl.value.trim() : ''
      });
    }
  }
  return {
    saleType: g('pso-form-type'),
    /* 车主选择器回填的是「姓名(编号)」，落库存姓名本体（与历史数据口径一致） */
    cust: (g('pso-form-cust') || '').replace(/\(.*\)$/, '').trim(),
    saleDate: g('pso-form-date'),
    repairOrder: g('pso-form-repair'),
    items: items,
    orderNo: g('pso-form-orderno')
  };
}

/* 客户选择：店销走门店穿梭框，个销走全站统一车主选择器 */
function psoPickCustomer() {
  var typeEl = document.getElementById('pso-form-type');
  var type = typeEl ? typeEl.value : '';
  if (type === '店销') {
    /* 门店穿梭框：店销选「门店管理」中除自己门店外的其它门店 */
    var inp = document.createElement('input');
    inp.type = 'hidden';
    inp.id = 'pso-flt-store';
    document.body.appendChild(inp);
    msOpenStorePicker('pso-flt-store', function (names) {
      var target = document.getElementById('pso-form-cust');
      if (target && names && names.length) target.value = names.join('、');
    });
  } else if (type === '个销') {
    /* 个销：全站统一车主选择器（单框+放大镜 → 车主管理弹框 → 回填姓名(编号)） */
    npOpenOwnerPicker('pso-form-cust');
  } else {
    npToast('请先选择销售类型');
  }
}

/* 关闭面板 */
function psoClosePanel() {
  var ov = document.getElementById('pso-panel-overlay');
  var pn = document.getElementById('pso-panel');
  if (ov) ov.classList.remove('show');
  if (pn) pn.classList.remove('show');
}

/* 详情态导出 */
function psoDetailExport() {
  var noEl = document.getElementById('pso-form-orderno');
  npToast('销售单明细导出（演示）' + (noEl ? noEl.value : ''));
}

/* ============================================================
   页面二：配件销售取消
   ============================================================ */

/* ---- 取消单全量（懒加载，避免种子循环依赖）---- */
function psoCancelAll() {
  if (!window.__PSO_CANCEL_ALL) window.__PSO_CANCEL_ALL = psoCancelSeed();
  return window.__PSO_CANCEL_ALL;
}

/* ---- 列定义 ---- */
function pscCols() {
  return [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    {
      t: '销售取消单号', w: 135, cls: 'col-cno sticky', f: function (r) {
        return '<a href="javascript:void(0)" class="lt-link" onclick="pscOpenDetail(' + r.idx + ')">' + npEscape(r.cancelNo) + '</a>';
      }
    },
    { t: '销售单号', w: 130, cls: 'col-no', f: function (r) { return npEscape(r.orderNo); } },
    { t: '门店名称', w: 110, cls: 'col-store', f: function (r) { return npEscape(r.store); } },
    { t: '门店编码', w: 100, cls: 'col-store-code', f: function (r) { return npEscape(r.storeCode); } },
    { t: '客户', w: 110, cls: 'col-cust', f: function (r) { return npEscape(r.customer); } },
    { t: '取消品种', w: 90, cls: 'col-kinds', f: function (r) { return npEscape(r.kinds); } },
    { t: '取消金额', w: 100, cls: 'col-amount', f: function (r) { return npEscape(r.amount); } },
    { t: '退款登记情况', w: 110, cls: 'col-refund', f: function (r) { return npEscape(r.refundStatus); } },
    { t: '提交人', w: 90, cls: 'col-submitter', f: function (r) { return npEscape(r.submitter); } },
    { t: '取消时间', w: 150, cls: 'col-cancel-time', f: function (r) { return npEscape(r.cancelTime); } }
  ];
}

/* ---- 导出 ---- */
function pscExport() {
  var st = NP['parts-sales-cancel'];
  var data = st.filtered;
  if (!data || data.length === 0) { npToast('暂无数据可导出'); return; }
  var headers = ['序号', '销售取消单号', '销售单号', '门店名称', '门店编码', '客户', '取消品种', '取消金额', '退款登记情况', '提交人', '取消时间'];
  var rows = data.map(function (r, i) {
    return [i + 1, r.cancelNo, r.orderNo, r.store, r.storeCode, r.customer, r.kinds, r.amount, r.refundStatus, r.submitter, r.cancelTime];
  });
  npExportExcelRowsRaw('配件销售取消_' + npNowLocal().slice(0, 10).replace(/-/g, ''), headers, rows);
  npToast('导出成功');
}

/* ---- 取消单详情（只读弹框）---- */
function pscOpenDetail(idx) {
  var r = npFindByIdx(psoCancelAll(), idx);
  if (!r) { npToast('未找到该销售取消单'); return; }
  var info =
    '<div class="pso-info-grid">' +
      psoInfoItem('销售取消单号', r.cancelNo) +
      psoInfoItem('销售单号', r.orderNo) +
      psoInfoItem('销售取消类型', r.cancelType) +
      psoInfoItem('客户', r.customer) +
      psoInfoItem('取消品种', r.kinds) +
      psoInfoItem('取消金额', r.amount) +
    '</div>';
  var rows = r.items.map(function (it, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + npEscape(it.code) + '</td><td>' + npEscape(it.name) + '</td>' +
      '<td>' + npEscape(it.unit) + '</td><td>' + npEscape(it.snp) + '</td><td>' + npEscape(it.saleQty) + '</td>' +
      '<td>' + npEscape(it.cancelQty) + '</td><td>' + npEscape(it.unitPrice) + '</td><td>' + npEscape(it.amount) + '</td></tr>';
  }).join('');
  var body = info +
    '<div class="pso-detail-title">取消明细</div>' +
    '<div style="overflow-x:auto"><table class="pp-parts-table">' +
    '<thead><tr><th style="width:40px">序号</th><th style="width:100px">配件编码</th><th>配件名称</th>' +
    '<th style="width:70px">计量单位</th><th style="width:80px">出库SNP</th><th style="width:80px">销售数量</th>' +
    '<th style="width:90px">取消数量</th><th style="width:90px">单价(含税)</th><th style="width:100px">取消金额(含税)</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
  npOpenModal('销售取消单详情', body,
    '<button class="lt-btn lt-btn-default" onclick="pscDetailExport()">导出</button>', { width: 980 });
}

function pscDetailExport() {
  npToast('销售取消单明细导出（演示）');
}

/* ---- 新建取消（从销售单列表行内【取消】直开）---- */
function psoOpenCancel(orderIdx) {
  var r = npFindByIdx(NP['parts-sales-order'].allData, orderIdx);
  if (!r) { npToast('未找到该销售单'); return; }
  /* 前置校验：PRD「配件已付款未出库之前」可取消 */
  if (r.outStatus !== '未出库') {
    npToast('已出库的销售单不可取消，请走退货流程');
    return;
  }
  if (r.docStatus === '已作废') { npToast('已作废的销售单不可取消'); return; }

  /* 弹框内查询项：配件编码 / 配件名称（走全站 .lt-filter-grid 4 列网格 + .lt-filter-footer，查询按钮固定第 4 列） */
  var head = '<div class="lt-filter-grid">' +
    npFItem('配件编码', '<input type="text" id="pcf-code" placeholder="请输入">') +
    npFItem('配件名称', '<input type="text" id="pcf-name" placeholder="请输入">') +
    '<div class="lt-filter-footer"><button class="lt-btn lt-btn-primary" onclick="pcfQuery()">查询</button></div>' +
    '</div>';

  var rows = r.items.map(function (it, i) {
    var shipped = parseFloat(it.snp);
    var canceled = parseFloat(it.canceled || '0');
    var maxCancel = parseFloat(it.qty) - canceled - shipped;
    return { i: i, it: it, maxCancel: maxCancel, shipped: shipped, canceled: canceled };
  });

  var body = head +
    psoBlueInvoiceCheckHtml(orderIdx, 'pcf-red-invoice') +
    '<div style="overflow-x:auto;margin-top:10px"><table class="pp-parts-table">' +
    '<thead><tr><th style="width:36px"><input type="checkbox" id="pcf-check-all" onchange="pcfToggleAll(this.checked)"></th>' +
    '<th style="width:40px">序号</th><th style="width:100px">配件编码</th><th>配件名称</th><th style="width:70px">计量单位</th>' +
    '<th style="width:80px">出库SNP</th><th style="width:80px">销售数量</th><th style="width:90px">已取消数量</th>' +
    '<th style="width:90px">已出库数量</th><th style="width:110px">本次取消数量</th><th style="width:100px">单价(含税)</th>' +
    '<th style="width:110px">取消金额(含税)</th></tr></thead><tbody id="pcf-tbody"></tbody></table></div>' +
    '<div class="lt-pager" id="pcf-pager"></div>' +
    '<div class="pso-modal-total" id="pcf-total">取消金额合计(含税): <b>¥0.00</b></div>';

  var footer = '<button class="lt-btn lt-btn-primary" onclick="pcfConfirm(' + orderIdx + ')">确认</button>';
  npOpenModal('取消 - ' + r.orderNo, body, footer, { width: 1100 });

  window.__PCF_ROWS = rows;
  pcfRender();
}

/* 取消弹框：渲染 + 查询 + 勾选 + 计算 */
function pcfRender() {
  var tb = document.getElementById('pcf-tbody');
  if (!tb) return;
  var code = (document.getElementById('pcf-code') || {}).value || '';
  var name = (document.getElementById('pcf-name') || {}).value || '';
  code = code.trim(); name = name.trim();
  var list = (window.__PCF_ROWS || []).filter(function (x) {
    return (code === '' || x.it.code.indexOf(code) >= 0) && (name === '' || x.it.name.indexOf(name) >= 0);
  });
  var h = '';
  for (var i = 0; i < list.length; i++) {
    var x = list[i];
    h += '<tr>' +
      '<td><input type="checkbox" class="pcf-check" data-i="' + x.i + '"' + (x.maxCancel > 0 ? ' checked' : '') + '></td>' +
      '<td>' + (x.i + 1) + '</td>' +
      '<td>' + npEscape(x.it.code) + '</td>' +
      '<td>' + npEscape(x.it.name) + '</td>' +
      '<td>' + npEscape(x.it.unit) + '</td>' +
      '<td>' + npEscape(x.it.snp) + '</td>' +
      '<td>' + npEscape(x.it.qty) + '</td>' +
      '<td>' + psoQty(x.canceled) + '</td>' +
      '<td>' + psoQty(x.shipped) + '</td>' +
      '<td><input type="text" class="pcf-qty" data-i="' + x.i + '" max="' + psoQty(x.maxCancel) + '" placeholder="请输入" onchange="pcfRecalc()"></td>' +
      '<td><input type="text" class="pcf-price js-lock" data-i="' + x.i + '" value="' + npEscape(x.it.discountPrice) + '" readonly></td>' +
      '<td><input type="text" class="pcf-amt js-lock" data-i="' + x.i + '" value="0.00" readonly></td>' +
      '</tr>';
  }
  tb.innerHTML = h;
  pcfRecalc();
}

function pcfQuery() { pcfRender(); }

function pcfToggleAll(checked) {
  var checks = document.querySelectorAll('#pcf-tbody .pcf-check');
  for (var i = 0; i < checks.length; i++) checks[i].checked = checked;
  pcfRecalc();
}

function pcfRecalc() {
  var total = 0;
  var checks = document.querySelectorAll('#pcf-tbody .pcf-check');
  for (var i = 0; i < checks.length; i++) {
    var idx = checks[i].getAttribute('data-i');
    var qtyEl = document.querySelector('.pcf-qty[data-i="' + idx + '"]');
    var amtEl = document.querySelector('.pcf-amt[data-i="' + idx + '"]');
    var priceEl = document.querySelector('.pcf-price[data-i="' + idx + '"]');
    if (!qtyEl || !amtEl || !priceEl) continue;
    if (!checks[i].checked) { amtEl.value = '0.00'; continue; }
    var q = parseFloat(qtyEl.value || '0');
    if (isNaN(q)) q = 0;
    var amt = q * parseFloat(priceEl.value || '0');
    amtEl.value = psoMoney(amt);
    total += amt;
  }
  var box = document.getElementById('pcf-total');
  if (box) box.innerHTML = '取消金额合计(含税): <b>¥' + psoMoney(total) + '</b>';
}

/* 确认取消 */
function pcfConfirm(orderIdx) {
  var r = npFindByIdx(NP['parts-sales-order'].allData, orderIdx);
  if (!r) { npToast('未找到该销售单'); return; }
  var checks = document.querySelectorAll('#pcf-tbody .pcf-check');
  var picked = 0, total = 0;
  for (var i = 0; i < checks.length; i++) {
    if (!checks[i].checked) continue;
    var idx = checks[i].getAttribute('data-i');
    var qtyEl = document.querySelector('.pcf-qty[data-i="' + idx + '"]');
    var priceEl = document.querySelector('.pcf-price[data-i="' + idx + '"]');
    var raw = qtyEl ? qtyEl.value.trim() : '';
    if (raw === '') { npToast('请填写本次取消数量，或取消勾选该行'); return; }
    var q = parseFloat(raw);
    if (isNaN(q) || q <= 0) { npToast('本次取消数量必须为正数'); return; }
    var max = parseFloat(qtyEl.getAttribute('max'));
    if (q > max + 1e-9) {
      npToast('第 ' + (parseInt(idx, 10) + 1) + ' 行取消数量超出可取消上限（' + psoQty(max) + '）');
      return;
    }
    picked++;
    total += q * parseFloat(priceEl.value || '0');
  }
  if (picked === 0) { npToast('请至少勾选一行并填写本次取消数量'); return; }
  if (!window.confirm('确认提交销售取消单？取消金额合计（含税）' + psoMoney(total) + '元')) return;

  /* 生成取消单 */
  var all = psoCancelAll();
  var rec = {
    idx: npNextIdx(all),
    cancelNo: 'HUB0251015300' + (all.length + 1),
    orderNo: r.orderNo,
    orderIdx: r.idx,
    store: r.store,
    storeCode: r.storeCode,
    customer: r.customer,
    cancelType: r.saleType === '个销' ? '个销取消' : '店销取消',
    kinds: psoQty(picked),
    amount: psoMoney(total),
    refundStatus: '未退款',
    submitter: r.submitter,
    cancelTime: npNowLocal(),
    items: []
  };
  for (var k = 0; k < checks.length; k++) {
    if (!checks[k].checked) continue;
    var ii = checks[k].getAttribute('data-i');
    var qe = document.querySelector('.pcf-qty[data-i="' + ii + '"]');
    var pe = document.querySelector('.pcf-price[data-i="' + ii + '"]');
    var src = null;
    for (var m = 0; m < r.items.length; m++) { if (String(m) === String(ii)) { src = r.items[m]; break; } }
    if (!src) continue;
    rec.items.push({
      code: src.code, name: src.name, unit: src.unit, snp: src.snp,
      saleQty: src.qty,
      cancelQty: psoQty(parseFloat(qe.value)),
      unitPrice: src.discountPrice,
      amount: psoMoney(parseFloat(qe.value) * parseFloat(pe.value))
    });
    src.canceled = psoQty((parseFloat(src.canceled || '0') + parseFloat(qe.value)));
    src.actual = psoQty(parseFloat(src.qty) - parseFloat(src.canceled || '0') - parseFloat(src.returned || '0'));
  }
  /* 提交前先记住勾选项（关闭弹框后元素即销毁） */
  var redChk = document.getElementById('pcf-red-invoice');
  var wantRed = !!(redChk && redChk.checked);

  all.unshift(rec);
  npCloseModal();

  /* PRD 10.19：勾选了「同时发票红冲」→ 取消单创建成功后，再把该单已开蓝票置为「作废冲红中」 */
  if (wantRed) {
    psoMarkBlueInvoiceRed(orderIdx, '配件销售取消单 ' + rec.cancelNo + ' 红冲');
    psiRenderInvoicePage();
  }

  /* 刷新销售单与取消单两个列表 */
  var so = NP['parts-sales-order'];
  if (so) { so.query(); }
  var sc = NP['parts-sales-cancel'];
  if (sc) { sc.allData = all.slice(); sc.query(); }
  npToast('销售取消单已提交');
}

/* ---- 页面初始化 ---- */
function initPartsSalesCancel() {
  var K = 'parts-sales-cancel';
  var root = document.getElementById('page-' + K);
  if (!root) return;

  var filter =
    npFItem('销售单号', '<input type="text" id="' + K + '-f-no" placeholder="请输入">') +
    npFItem('销售取消单号', '<input type="text" id="' + K + '-f-cno" placeholder="请输入">') +
    npFItem('客户', '<input type="text" id="' + K + '-f-cust" placeholder="请输入">') +
    '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">取消日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="NP[\'' + K + '\'].query()">' +
      '<div class="lt-date-range-drop">' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + K + '-d-s" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
        '<span>—</span>' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + K + '-d-e" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div></div></div>' +
    npSelect('退款登记情况', '<select id="' + K + '-f-refund"><option value="">请选择</option>' +
      PSR_REFUND_OPTS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>');

  var toolbar = '<button class="lt-btn lt-btn-default" onclick="pscExport()">导出</button>';
  var cols = pscCols();
  root.innerHTML = npShell(K, { l2: '配件销售管理', l3: '配件销售取消' }, filter, toolbar, npTH(cols), K + '-tbody', K + '-pager');

  NP[K] = { page: 1, pageSize: 20, allData: psoCancelAll().slice(), filtered: [], render: null, query: null, reset: null };
  var st = NP[K];
  initFilterGrid(K + '-filterGrid', 7); st._fShow = 7; st._fExp = false;

  st.query = function () {
    var g = function (id) { var e = document.getElementById(K + id); return e ? e.value.trim() : ''; };
    var no = g('-f-no'), cno = g('-f-cno'), cust = g('-f-cust'), ref = g('-f-refund');
    var ds = (document.getElementById(K + '-d-s') || {}).value || '';
    var de = (document.getElementById(K + '-d-e') || {}).value || '';
    ds = ds.trim(); de = de.trim();
    st.filtered = st.allData.filter(function (r) {
      var d = r.cancelTime.slice(0, 10);
      return (no === '' || r.orderNo.indexOf(no) >= 0) &&
        (cno === '' || r.cancelNo.indexOf(cno) >= 0) &&
        (cust === '' || r.customer.indexOf(cust) >= 0) &&
        (ref === '' || r.refundStatus === ref) &&
        (ds === '' || d >= ds) && (de === '' || d <= de);
    });
    st.page = 1; st.render();
  };

  st.reset = function () {
    ['-f-no', '-f-cno', '-f-cust'].forEach(function (s) { var e = document.getElementById(K + s); if (e) e.value = ''; });
    var er = document.getElementById(K + '-f-refund'); if (er) er.value = '';
    var ds = document.getElementById(K + '-d-s'); if (ds) ds.value = '';
    var de = document.getElementById(K + '-d-e'); if (de) de.value = '';
    var tx = root.querySelector('.lt-date-range-text'); if (tx) tx.value = '';
    st.query();
  };

  st.render = function () { npRenderTable(K, K + '-tbody', K + '-pager', cols, st.filtered, st); };

  st.filtered = st.allData.slice(); st.page = 1; st.render();
}

npRegisterModuleInit('parts-sales-cancel', function () { initPartsSalesCancel(); });

/* ============================================================
   页面三：配件销售退货
   ============================================================ */

function psoReturnAll() {
  if (!window.__PSO_RETURN_ALL) window.__PSO_RETURN_ALL = psoReturnSeed();
  return window.__PSO_RETURN_ALL;
}

/* ---- 列定义 ---- */
function psrCols() {
  return [
    { t: '序号', w: 40, cls: 'col-seq sticky', f: function (r, i) { return i + 1; } },
    {
      t: '销售退货单号', w: 135, cls: 'col-rno sticky', f: function (r) {
        return '<a href="javascript:void(0)" class="lt-link" onclick="psrOpenDetail(' + r.idx + ')">' + npEscape(r.returnNo) + '</a>';
      }
    },
    { t: '销售单号', w: 130, cls: 'col-no', f: function (r) { return npEscape(r.orderNo); } },
    { t: '门店名称', w: 110, cls: 'col-store', f: function (r) { return npEscape(r.store); } },
    { t: '门店编码', w: 100, cls: 'col-store-code', f: function (r) { return npEscape(r.storeCode); } },
    { t: '客户', w: 110, cls: 'col-cust', f: function (r) { return npEscape(r.customer); } },
    { t: '退货品种', w: 90, cls: 'col-kinds', f: function (r) { return npEscape(r.kinds); } },
    { t: '退货金额', w: 100, cls: 'col-amount', f: function (r) { return npEscape(r.amount); } },
    { t: '退货原因', w: 120, cls: 'col-reason', f: function (r) { return npEscape(r.reason); } },
    { t: '退库状态', w: 90, cls: 'col-instock', f: function (r) { return npEscape(r.instockStatus); } },
    { t: '退款登记情况', w: 110, cls: 'col-refund', f: function (r) { return npEscape(r.refundStatus); } },
    { t: '提交人', w: 90, cls: 'col-submitter', f: function (r) { return npEscape(r.submitter); } },
    { t: '退货时间', w: 150, cls: 'col-return-time', f: function (r) { return npEscape(r.returnTime); } }
  ];
}

function psrExport() {
  var st = NP['parts-sales-return'];
  var data = st.filtered;
  if (!data || data.length === 0) { npToast('暂无数据可导出'); return; }
  var headers = ['序号', '销售退货单号', '销售单号', '门店名称', '门店编码', '客户', '退货品种', '退货金额', '退货原因', '退库状态', '退款登记情况', '提交人', '退货时间'];
  var rows = data.map(function (r, i) {
    return [i + 1, r.returnNo, r.orderNo, r.store, r.storeCode, r.customer, r.kinds, r.amount, r.reason, r.instockStatus, r.refundStatus, r.submitter, r.returnTime];
  });
  npExportExcelRowsRaw('配件销售退货_' + npNowLocal().slice(0, 10).replace(/-/g, ''), headers, rows);
  npToast('导出成功');
}

/* ---- 退货单详情 ---- */
function psrOpenDetail(idx) {
  var r = npFindByIdx(psoReturnAll(), idx);
  if (!r) { npToast('未找到该销售退货单'); return; }
  var info = '<div class="pso-info-grid">' +
    psoInfoItem('销售退货单号', r.returnNo) +
    psoInfoItem('销售单号', r.orderNo) +
    psoInfoItem('销售退货类型', r.returnType) +
    psoInfoItem('客户', r.customer) +
    psoInfoItem('退货品种', r.kinds) +
    psoInfoItem('退货金额', r.amount) +
    psoInfoItem('退货原因', r.reason) +
    psoInfoItem('退库状态', r.instockStatus) +
    '</div>';
  var rows = r.items.map(function (it, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + npEscape(it.code) + '</td><td>' + npEscape(it.name) + '</td>' +
      '<td>' + npEscape(it.unit) + '</td><td>' + npEscape(it.snp) + '</td><td>' + npEscape(it.saleQty) + '</td>' +
      '<td>' + npEscape(it.returnQty) + '</td><td>' + npEscape(it.unitPrice) + '</td><td>' + npEscape(it.amount) + '</td></tr>';
  }).join('');
  var body = info + '<div class="pso-detail-title">退货明细</div>' +
    '<div style="overflow-x:auto"><table class="pp-parts-table">' +
    '<thead><tr><th style="width:40px">序号</th><th style="width:100px">配件编码</th><th>配件名称</th>' +
    '<th style="width:70px">计量单位</th><th style="width:80px">出库SNP</th><th style="width:80px">销售数量</th>' +
    '<th style="width:80px">退货数量</th><th style="width:90px">单价(元)</th><th style="width:100px">退货金额(元)</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
  npOpenModal('销售退货单详情', body,
    '<button class="lt-btn lt-btn-default" onclick="psrDetailExport()">导出</button>', { width: 980 });
}

function psrDetailExport() { npToast('销售退货单明细导出（演示）'); }

/* ---- 发起退货：第一步 选已出库单 ---- */
function psrOpenPicker(presetOrderNo) {
  var head = '<div class="lt-filter-grid">' +
    npFItem('销售单号', '<input type="text" id="prf-no" placeholder="请输入" value="' + npEscape(presetOrderNo || '') + '">') +
    npFItem('客户', '<input type="text" id="prf-cust" placeholder="请输入">') +
    npFItem('出库单号', '<input type="text" id="prf-outno" placeholder="请输入">') +
    npFItem('出库日期起', '<input type="text" id="prf-ds" class="date-shim" placeholder="yyyy-mm-dd">') +
    npFItem('出库日期止', '<input type="text" id="prf-de" class="date-shim" placeholder="yyyy-mm-dd">') +
    '<div class="lt-filter-footer"><button class="lt-btn lt-btn-primary" onclick="prfQuery()">查询</button></div>' +
    '</div>';

  var body = head +
    '<div style="overflow-x:auto;margin-top:10px"><table class="pp-parts-table">' +
    '<thead><tr><th style="width:40px">序号</th><th style="width:80px">操作</th><th style="width:135px">出库单号</th>' +
    '<th style="width:130px">销售单号</th><th style="width:80px">出库品种</th><th style="width:80px">出库数量</th>' +
    '<th style="width:100px">合计金额</th><th>客户</th><th style="width:90px">提交人</th><th style="width:150px">提交时间</th></tr></thead>' +
    '<tbody id="prf-tbody"></tbody></table></div>' +
    '<div class="lt-pager" id="prf-pager"></div>';

  var footer = '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>';
  npOpenModal('配件销售退货单制作', body, footer, { width: 1180 });
  window.__PRF_ALL = psoOutboundList();
  prfQuery();
}

function prfQuery() {
  var tb = document.getElementById('prf-tbody');
  if (!tb) return;
  var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var no = g('prf-no'), cust = g('prf-cust'), outno = g('prf-outno');
  var ds = g('prf-ds'), de = g('prf-de');
  var list = (window.__PRF_ALL || []).filter(function (r) {
    return (no === '' || r.orderNo.indexOf(no) >= 0) &&
      (cust === '' || r.customer.indexOf(cust) >= 0) &&
      (outno === '' || r.outNo.indexOf(outno) >= 0) &&
      (ds === '' || r.saleDate >= ds) && (de === '' || r.saleDate <= de);
  });
  var h = '';
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    h += '<tr><td>' + (i + 1) + '</td>' +
      '<td><a href="javascript:void(0)" class="lt-link np-red" onclick="psrOpenForm(' + r.idx + ')">退货</a></td>' +
      '<td>' + npEscape(r.outNo) + '</td><td>' + npEscape(r.orderNo) + '</td>' +
      '<td>' + npEscape(r.kinds) + '</td><td>' + npEscape(r.qty) + '</td><td>' + npEscape(r.amount) + '</td>' +
      '<td>' + npEscape(r.customer) + '</td><td>' + npEscape(r.submitter) + '</td><td>' + npEscape(r.submitTime) + '</td></tr>';
  }
  tb.innerHTML = h;
}

/* ---- 发起退货：第二步 退货录入（与「取消」一致，统一走全站通用弹框 npOpenModal）---- */
function psrOpenForm(orderIdx) {
  /* 若从第一步「选单」弹框进来，先关掉父弹框（npOpenModal 是单例，新弹框会覆盖它） */
  npCloseModal();

  var r = npFindByIdx(psoOrderAll(), orderIdx);
  if (!r) { npToast('未找到该销售单'); return; }
  if (r.outStatus !== '部分出库' && r.outStatus !== '全部出库') {
    npToast('未出库的销售单不可退货，请走取消流程');
    return;
  }

  var body =
    '<div class="lt-input-wrap plain required" style="margin-bottom:10px"><span class="lt-filter-prefix required">退货原因</span>' +
      '<input type="text" id="prr-reason" maxlength="20" placeholder="请输入（≤20字）"></div>' +
    '<div class="lt-filter-grid">' +
      npFItem('配件编码', '<input type="text" id="prr-code" placeholder="请输入">') +
      npFItem('配件名称', '<input type="text" id="prr-name" placeholder="请输入">') +
      '<div class="lt-filter-footer"><button class="lt-btn lt-btn-primary" onclick="prrQuery()">查询</button></div>' +
    '</div>' +
    psoBlueInvoiceCheckHtml(orderIdx, 'prr-red-invoice') +
    '<div style="overflow-x:auto;margin-top:10px"><table class="pp-parts-table">' +
    '<thead><tr><th style="width:36px"><input type="checkbox" id="prr-check-all" onchange="prrToggleAll(this.checked)"></th>' +
    '<th style="width:40px">序号</th><th style="width:100px">配件编码</th><th>配件名称</th><th style="width:70px">计量单位</th>' +
    '<th style="width:80px">出库SNP</th><th style="width:80px">销售数量</th><th style="width:100px">可退货数量</th>' +
    '<th style="width:110px">本次退货数量</th><th style="width:110px">退货单价(含税)</th><th style="width:110px">退货金额(含税)</th></tr></thead>' +
    '<tbody id="prr-tbody"></tbody></table></div>' +
    '<div class="lt-pager" id="prr-pager"></div>' +
    '<div class="pso-modal-total" id="prr-total">退货金额合计(含税): <b>¥0.00</b></div>';
  var footer = '<button class="lt-btn lt-btn-primary" onclick="prrConfirm(' + orderIdx + ')">确认</button>';
  npOpenModal('退货 - ' + r.orderNo, body, footer, { width: 1180 });

  var rows = r.items.map(function (it, i) {
    var returned = parseFloat(it.returned || '0');
    var maxReturn = parseFloat(it.qty) - returned;
    return { i: i, it: it, maxReturn: maxReturn, returned: returned };
  });
  window.__PRR_ROWS = rows;

  prrRender();
}

function prrRender() {
  var tb = document.getElementById('prr-tbody');
  if (!tb) return;
  var code = ((document.getElementById('prr-code') || {}).value || '').trim();
  var name = ((document.getElementById('prr-name') || {}).value || '').trim();
  var list = (window.__PRR_ROWS || []).filter(function (x) {
    return (code === '' || x.it.code.indexOf(code) >= 0) && (name === '' || x.it.name.indexOf(name) >= 0);
  });
  var h = '';
  for (var i = 0; i < list.length; i++) {
    var x = list[i];
    h += '<tr>' +
      '<td><input type="checkbox" class="prr-check" data-i="' + x.i + '"' + (x.maxReturn > 0 ? ' checked' : '') + '></td>' +
      '<td>' + (x.i + 1) + '</td><td>' + npEscape(x.it.code) + '</td><td>' + npEscape(x.it.name) + '</td>' +
      '<td>' + npEscape(x.it.unit) + '</td><td>' + npEscape(x.it.snp) + '</td><td>' + npEscape(x.it.qty) + '</td>' +
      '<td>' + psoQty(x.maxReturn) + '</td>' +
      '<td><input type="text" class="prr-qty" data-i="' + x.i + '" max="' + psoQty(x.maxReturn) + '" placeholder="请输入" onchange="prrRecalc()"></td>' +
      '<td><input type="text" class="prr-price js-lock" data-i="' + x.i + '" value="' + npEscape(x.it.discountPrice) + '" readonly></td>' +
      '<td><input type="text" class="prr-amt js-lock" data-i="' + x.i + '" value="0.00" readonly></td>' +
      '</tr>';
  }
  tb.innerHTML = h;
  prrRecalc();
}

function prrQuery() { prrRender(); }

function prrToggleAll(checked) {
  var checks = document.querySelectorAll('#prr-tbody .prr-check');
  for (var i = 0; i < checks.length; i++) checks[i].checked = checked;
  prrRecalc();
}

function prrRecalc() {
  var total = 0;
  var checks = document.querySelectorAll('#prr-tbody .prr-check');
  for (var i = 0; i < checks.length; i++) {
    var idx = checks[i].getAttribute('data-i');
    var qtyEl = document.querySelector('.prr-qty[data-i="' + idx + '"]');
    var amtEl = document.querySelector('.prr-amt[data-i="' + idx + '"]');
    var priceEl = document.querySelector('.prr-price[data-i="' + idx + '"]');
    if (!qtyEl || !amtEl || !priceEl) continue;
    if (!checks[i].checked) { amtEl.value = '0.00'; continue; }
    var q = parseFloat(qtyEl.value || '0');
    if (isNaN(q)) q = 0;
    var amt = q * parseFloat(priceEl.value || '0');
    amtEl.value = psoMoney(amt);
    total += amt;
  }
  var box = document.getElementById('prr-total');
  if (box) box.innerHTML = '退货金额合计(含税): <b>¥' + psoMoney(total) + '</b>';
}

function prrConfirm(orderIdx) {
  var reason = ((document.getElementById('prr-reason') || {}).value || '').trim();
  if (!reason) { npToast('请填写退货原因'); return; }
  if (reason.length > 20) { npToast('退货原因不能超过 20 字'); return; }

  var r = npFindByIdx(psoOrderAll(), orderIdx);
  if (!r) { npToast('未找到该销售单'); return; }
  var checks = document.querySelectorAll('#prr-tbody .prr-check');
  var picked = 0, total = 0;
  for (var i = 0; i < checks.length; i++) {
    if (!checks[i].checked) continue;
    var idx = checks[i].getAttribute('data-i');
    var qtyEl = document.querySelector('.prr-qty[data-i="' + idx + '"]');
    var priceEl = document.querySelector('.prr-price[data-i="' + idx + '"]');
    var raw = qtyEl ? qtyEl.value.trim() : '';
    if (raw === '') { npToast('请填写本次退货数量，或取消勾选该行'); return; }
    var q = parseFloat(raw);
    if (isNaN(q) || q <= 0) { npToast('本次退货数量必须为正数'); return; }
    var max = parseFloat(qtyEl.getAttribute('max'));
    if (q > max + 1e-9) {
      npToast('第 ' + (parseInt(idx, 10) + 1) + ' 行退货数量超出可退货上限（' + psoQty(max) + '）');
      return;
    }
    picked++;
    total += q * parseFloat(priceEl.value || '0');
  }
  if (picked === 0) { npToast('请至少勾选一行并填写本次退货数量'); return; }
  if (!window.confirm('确认提交销售退货单？退货金额合计（含税）' + psoMoney(total) + '元')) return;

  var all = psoReturnAll();
  var rec = {
    idx: npNextIdx(all),
    returnNo: 'HUB0251015400' + (all.length + 1),
    orderNo: r.orderNo,
    orderIdx: r.idx,
    store: r.store,
    storeCode: r.storeCode,
    customer: r.customer,
    returnType: r.saleType === '个销' ? '个销退货' : '店销退货',
    reason: reason,
    kinds: psoQty(picked),
    amount: psoMoney(total),
    instockStatus: '未入库',
    refundStatus: '未退款',
    submitter: r.submitter,
    returnTime: npNowLocal(),
    items: []
  };
  for (var k = 0; k < checks.length; k++) {
    if (!checks[k].checked) continue;
    var ii = checks[k].getAttribute('data-i');
    var qe = document.querySelector('.prr-qty[data-i="' + ii + '"]');
    var pe = document.querySelector('.prr-price[data-i="' + ii + '"]');
    var src = null;
    for (var m = 0; m < r.items.length; m++) { if (String(m) === String(ii)) { src = r.items[m]; break; } }
    if (!src) continue;
    rec.items.push({
      code: src.code, name: src.name, unit: src.unit, snp: src.snp,
      saleQty: src.qty,
      returnQty: psoQty(parseFloat(qe.value)),
      unitPrice: src.discountPrice,
      amount: psoMoney(parseFloat(qe.value) * parseFloat(pe.value))
    });
    src.returned = psoQty((parseFloat(src.returned || '0') + parseFloat(qe.value)));
    src.actual = psoQty(parseFloat(src.qty) - parseFloat(src.canceled || '0') - parseFloat(src.returned || '0'));
  }
  /* 提交前先记住勾选项（关闭弹框后元素即销毁） */
  var redChk = document.getElementById('prr-red-invoice');
  var wantRed = !!(redChk && redChk.checked);

  all.unshift(rec);
  npCloseModal();

  /* PRD 10.19：勾选了「同时发票红冲」→ 退货单创建成功后，再把该单已开蓝票置为「作废冲红中」 */
  if (wantRed) {
    psoMarkBlueInvoiceRed(orderIdx, '配件销售退货单 ' + rec.returnNo + ' 红冲');
    psiRenderInvoicePage();
  }

  var so = NP['parts-sales-order']; if (so) { so.query(); }
  var sr = NP['parts-sales-return']; if (sr) { sr.allData = all.slice(); sr.query(); }
  npToast('销售退货单已提交');
}

/* ---- 页面初始化 ---- */
function initPartsSalesReturn() {
  var K = 'parts-sales-return';
  var root = document.getElementById('page-' + K);
  if (!root) return;

  var filter =
    npFItem('销售单号', '<input type="text" id="' + K + '-f-no" placeholder="请输入">') +
    npFItem('销售退货单号', '<input type="text" id="' + K + '-f-rno" placeholder="请输入">') +
    npFItem('客户', '<input type="text" id="' + K + '-f-cust" placeholder="请输入">') +
    '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix">退货日期</span>' +
      '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="NP[\'' + K + '\'].query()">' +
      '<div class="lt-date-range-drop">' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + K + '-d-s" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
        '<span>—</span>' +
        '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="' + K + '-d-e" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">' +
      '</div></div></div>' +
    npSelect('退库状态', '<select id="' + K + '-f-instock"><option value="">请选择</option>' +
      PSR_INSTOCK_OPTS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>') +
    npSelect('退款登记情况', '<select id="' + K + '-f-refund"><option value="">请选择</option>' +
      PSR_REFUND_OPTS.map(function (o) { return '<option>' + npEscape(o) + '</option>'; }).join('') + '</select>');

  var toolbar = '<button class="lt-btn lt-btn-default" onclick="psrExport()">导出</button>';

  var cols = psrCols();
  root.innerHTML = npShell(K, { l2: '配件销售管理', l3: '配件销售退货' }, filter, toolbar, npTH(cols), K + '-tbody', K + '-pager');

  NP[K] = { page: 1, pageSize: 20, allData: psoReturnAll().slice(), filtered: [], render: null, query: null, reset: null };
  var st = NP[K];
  initFilterGrid(K + '-filterGrid', 7); st._fShow = 7; st._fExp = false;

  st.query = function () {
    var g = function (id) { var e = document.getElementById(K + id); return e ? e.value.trim() : ''; };
    var no = g('-f-no'), rno = g('-f-rno'), cust = g('-f-cust'), instk = g('-f-instock'), ref = g('-f-refund');
    var ds = ((document.getElementById(K + '-d-s') || {}).value || '').trim();
    var de = ((document.getElementById(K + '-d-e') || {}).value || '').trim();
    st.filtered = st.allData.filter(function (r) {
      var d = r.returnTime.slice(0, 10);
      return (no === '' || r.orderNo.indexOf(no) >= 0) &&
        (rno === '' || r.returnNo.indexOf(rno) >= 0) &&
        (cust === '' || r.customer.indexOf(cust) >= 0) &&
        (instk === '' || r.instockStatus === instk) &&
        (ref === '' || r.refundStatus === ref) &&
        (ds === '' || d >= ds) && (de === '' || d <= de);
    });
    st.page = 1; st.render();
  };

  st.reset = function () {
    ['-f-no', '-f-rno', '-f-cust'].forEach(function (s) { var e = document.getElementById(K + s); if (e) e.value = ''; });
    ['-f-instock', '-f-refund'].forEach(function (s) { var e = document.getElementById(K + s); if (e) e.value = ''; });
    var ds = document.getElementById(K + '-d-s'); if (ds) ds.value = '';
    var de = document.getElementById(K + '-d-e'); if (de) de.value = '';
    var tx = root.querySelector('.lt-date-range-text'); if (tx) tx.value = '';
    st.query();
  };

  st.render = function () { npRenderTable(K, K + '-tbody', K + '-pager', cols, st.filtered, st); };

  st.filtered = st.allData.slice(); st.page = 1; st.render();
}

npRegisterModuleInit('parts-sales-return', function () { initPartsSalesReturn(); });

/* ============================================================
   发票（从销售单列表行内【发票】进入）
   ============================================================ */

/* 只读信息项：文字在框内，同排 */
function psoInfoItem(label, value) {
  return '<div class="pso-info-item"><span class="pso-info-label">' + npEscape(label) + '</span>' +
    '<span class="pso-info-value">' + npEscape(value === undefined || value === null || value === '' ? '—' : value) + '</span></div>';
}

/* ---------------- 发票记录全量（懒加载）*/
function psoInvoiceAll() {
  if (!window.__PSO_INVOICE_ALL) window.__PSO_INVOICE_ALL = psoInvoiceSeed();
  return window.__PSO_INVOICE_ALL;
}

/* 某张销售单是否已开蓝票（= 存在「开票成功」的发票记录）
   PRD 10.19：配件销售「取消、退货」提交时检测是否有已开蓝票，
   有则显示勾选项框「检测到有已开发票，勾选可同时发票红冲」（默认不勾选）*/
function psoBlueInvoiceList(orderIdx) {
  return psoInvoiceAll().filter(function (iv) {
    return String(iv.orderIdx) === String(orderIdx) && iv.status === '开票成功';
  });
}

/* 勾选项框 HTML（有已开蓝票时才出现；复用全站 .lt-filter-item + .lt-check 组件，不自造样式）
   左边距 4px = 表格首列单元格内边距，使本勾选框与表头「全选」框、行内多选框三者左对齐 */
function psoBlueInvoiceCheckHtml(orderIdx, chkId) {
  if (psoBlueInvoiceList(orderIdx).length === 0) return '';
  return '<div class="lt-filter-item" style="margin:10px 0 4px 4px">' +
    '<label class="lt-check"><input type="checkbox" id="' + chkId + '">检测到有已开发票，勾选可同时发票红冲</label>' +
    '</div>';
}

/* 勾选后：单据创建成功，再把该单「开票成功」的发票置为「作废冲红中」
   （PRD 10.19：一定要取消/退货单创建成功再调发票红冲接口）*/
function psoMarkBlueInvoiceRed(orderIdx, reason) {
  var list = psoBlueInvoiceList(orderIdx);
  for (var i = 0; i < list.length; i++) {
    list[i].status = '作废冲红中';
    list[i].redReason = reason;
  }
  return list.length;
}


/* ==========================================================================
   发票页 / 申请开票页（2026-10-20 重做：对齐 PRD 6.9.1 原型）
   - 发票 = 独立整页（非弹框），左上角返回箭头，统一回「配件销售单」
   - 顶部信息区 = 纯文字「标签：值」，不带框、不带输入框
   - 申请开票页字段 = 一行一个，不并排
   - 「明细要求」与「发票类型」是两个独立字段
   - 购买方信息区随发票类型联动（红框）
   ========================================================================== */

/* 取当前发票/申请开票页的销售单 */
function psiCurOrder() {
  var idx = window.__PSI_ORDER_IDX;
  if (idx === undefined || idx === null || idx === -1) {
    var all = (NP['parts-sales-order'] && NP['parts-sales-order'].allData) || [];
    return all.length ? all[0] : null;
  }
  return npFindByIdx(NP['parts-sales-order'].allData, idx);
}

/* 表单字段必填变体：**转发到全站公共组件** npFormItem / npFormSelect（app.js）。
   2026-10-25 收敛：此前这里自写了一份实现，与 app.js 的公共组件重复；
   现只保留函数名做兼容转发，新页面直接用 npFormItem / npFormSelect。 */
function psiFItem(label, controlHtml, required) {
  return npFormItem(label, controlHtml, required);
}

function psiSelect(label, innerHtml, required) {
  return npFormSelect(label, innerHtml, required);
}

/* 顶部纯文字信息区（标签：值，无边框、无输入框）
   格式（依实际截图）：3 列网格，每项都是「标签：值」；金额类的值用红色
   空值规则（用户明确要求）：标签恒显示、值为空则值区留空，保证每行格数固定、位置不跳 */
function psiInfoLine(pairs) {
  var cells = pairs.map(function (p) {
    var val = (p[1] === undefined || p[1] === null) ? '' : p[1];
    return '<span class="psi-info-cell">' +
      '<span class="psi-info-k">' + npEscape(p[0]) + '：</span>' +
      '<span class="psi-info-v' + (p[2] ? ' money' : '') + '">' + npEscape(val) + '</span>' +
      '</span>';
  });
  return '<div class="psi-info-row">' + cells.join('') + '</div>';
}

/* 计算顶部信息区数据（发票页与申请开票页共用同一份） */
function psiTopInfo(r) {
  var cancels = psoCancelAll().filter(function (c) { return c.orderIdx === r.idx; });
  var returns = psoReturnAll().filter(function (t) { return t.orderIdx === r.idx; });
  var shouldRefund = 0;
  cancels.forEach(function (c) { shouldRefund += parseFloat(c.amount); });
  returns.forEach(function (t) { shouldRefund += parseFloat(t.amount); });

  var receivable = parseFloat(r.amount);
  var netAmount = receivable - shouldRefund;

  /* 发票已开金额 = 已开票的 + 开票中的 − 冲红的 */
  var invoices = psoInvoiceAll();
  var invoiced = 0;
  invoices.forEach(function (iv) {
    var amt = 500;
    if (iv.status === '开票成功' || iv.status === '开票中' || iv.status === '作废冲红中') invoiced += amt;
    if (iv.status === '已冲红') invoiced -= amt;
  });
  invoiced = Math.max(0, invoiced);

  return {
    receivable: receivable,
    netAmount: netAmount,
    shouldRefund: shouldRefund,
    invoiced: invoiced,
    remaining: Math.max(0, netAmount - invoiced),
    settleNo: 'JS' + String(r.orderNo).slice(2),
    cancelNo: cancels.length ? cancels[0].cancelNo : '',
    returnNo: returns.length ? returns[0].returnNo : ''
  };
}

/* 收费对象显示文案：统一「名称(ID)」
   口径（依 PRD）：车主 → 客户姓名(客户编号)；门店 → 门店名称(门店编码)；第三方单位 → 单位名称(单位编号) */
function psiFeeObjectText(r) {
  if (r.customer === r.store) return r.store + '(' + r.storeCode + ')';
  var own = (window.CAR_OWNERS || []).filter(function (o) { return o.name === r.customer; })[0];
  if (own && own.code) return own.name + '(' + own.code + ')';
  /* 第三方单位（非车主主数据）：示例数据用固定单位编号 */
  var THIRD = { '星海汽贸有限公司': 'KH9001', '远航汽车服务连锁': 'KH9002' };
  return r.customer + '(' + (THIRD[r.customer] || '') + ')';
}

/* 门店纳税识别号显示（依PRD：发票页顶部信息区「门店」与「收费对象」之间）
   取数顺序：① 销售单自带 storeTaxNo → ② 门店管理主数据的纳税识别号/统一社会信用代码字段
              → ③ 示例数据回落值（当前门店管理主数据尚未维护该字段） */
function psiStoreTaxText(r) {
  if (r.storeTaxNo) return r.storeTaxNo;
  var st = npDictStoreList().filter(function (s) {
    return s.code === r.storeCode || s.name === r.store;
  })[0];
  if (st) {
    var v = st.taxNo || st.creditCode || '';
    if (v) return v;
  }
  /* 示例数据回落：销售单示例均取经开永旺店(JY001) */
  return { JY001: '91310115MA1K35QX7B' }[r.storeCode] || '';
}

/* 顶部信息区 HTML（发票页 / 申请开票页完全一致）
   依实际截图：3 列网格，金额类值标红 */
function psiTopInfoHtml(r) {
  var t = psiTopInfo(r);
  return '<div class="psi-info">' +
    psiInfoLine([
      ['门店', r.store + '(' + r.storeCode + ')'],
      ['门店纳税识别号', psiStoreTaxText(r)],
      ['收费对象', psiFeeObjectText(r)]
    ]) +
    psiInfoLine([
      ['销售单号', r.orderNo],
      ['销售取消单号', t.cancelNo],
      ['销售退货单号', t.returnNo]
    ]) +
    psiInfoLine([
      ['应收金额', psoMoney(t.receivable), true],
      ['应退金额', psoMoney(t.shouldRefund), true],
      ['发票已开金额', psoMoney(t.invoiced), true]
    ]) +
    '</div>';
}

/* ---- 发票页整页渲染 ---- */
function psiRenderInvoicePage() {
  var root = document.getElementById('page-parts-sales-invoice');
  if (!root) return;
  var r = psiCurOrder();
  if (!r) { root.innerHTML = '<div class="psi-page">未找到销售单</div>'; return; }

  var invoices = psoInvoiceAll();
  var cards = '';
  for (var i = 0; i < invoices.length; i++) {
    var iv = invoices[i];

    /* 卡片左侧：每项单独一行「标签：值」（依实际截图口径） */
    var left = '';
    if (iv.invoiceNo) {
      left += '<div class="psi-inv-line"><span class="psi-inv-k">发票号：</span>' + npEscape(iv.invoiceNo) + '</div>';
      left += '<div class="psi-inv-line"><span class="psi-inv-k">申请时间：</span>' + npEscape(iv.applyTime) + '</div>';
      left += '<div class="psi-inv-line"><span class="psi-inv-k">开票申请编号：</span>' + npEscape(iv.applyNo) + '</div>';
    } else {
      /* 开票中：尚无发票号，只显示申请时间与申请编号 */
      left += '<div class="psi-inv-line"><span class="psi-inv-k">申请时间：</span>' + npEscape(iv.applyTime) + '</div>';
      left += '<div class="psi-inv-line"><span class="psi-inv-k">开票申请编号：</span>' + npEscape(iv.applyNo) + '</div>';
    }
    /* 注：发票类型只在后台记录（iv.invType），供「复制开票信息」带出哪套抬头，页面不展示 */

    /* 卡片右上角：状态标签（复用全站 .lt-badge）+ 右侧操作按钮 */
    var badge = '';
    var right = '<button class="lt-btn lt-btn-default" onclick="psoCopyInvoiceInfo(' + iv.idx + ')">复制开票信息</button>';
    if (iv.status === '开票中') {
      badge = '<span class="lt-badge warn">开票中</span>';
    } else if (iv.status === '开票成功') {
      badge = '<span class="lt-badge ok">开票成功</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="psoDownloadInvoice()">下载发票</button>';
      right += '<button class="lt-btn lt-btn-primary" onclick="psoVoidInvoice(' + iv.idx + ')">作废冲红</button>';
    } else if (iv.status === '作废冲红中') {
      badge = '<span class="lt-badge warn">作废冲红中</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="psoDownloadInvoice()">下载发票</button>';
    } else if (iv.status === '已冲红') {
      badge = '<span class="lt-badge off">已冲红</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="psoDownloadInvoice()">下载发票</button>';
    } else {
      badge = '<span class="lt-badge off">' + npEscape(iv.status) + '</span>';
    }

    /* 作废冲红原因：有则显示，没有则整行不出现 */
    var reasonLine = (iv.status === '已冲红' && iv.redReason)
      ? '<div class="psi-inv-reason">作废冲红原因：' + npEscape(iv.redReason) + '</div>' : '';

    /* 卡片布局（依实际截图）：左侧信息文字块，右侧一列 = 状态标签（顶对齐）+ 操作按钮（底对齐）
   卡片总高度 = 左侧文字行数决定，按钮不额外占一行 */
    cards += '<div class="psi-inv-card">' +
      '<div class="psi-inv-body">' +
        '<div class="psi-inv-info">' + left + '</div>' +
        '<div class="psi-inv-side">' +
          '<div class="psi-inv-badge">' + badge + '</div>' +
          '<div class="psi-inv-ops">' + right + '</div>' +
        '</div>' +
      '</div>' +
      reasonLine +
      '</div>';
  }

  root.innerHTML =
    '<div class="psi-page">' +
      '<div class="psi-page-head">' +
        '<button class="psi-back" onclick="psiBackToOrder()" title="返回">&#10094;</button>' +
        '<span class="psi-page-title">发票</span>' +
      '</div>' +
      psiTopInfoHtml(r) +
      '<div class="psi-inv-list">' + (cards || '<div class="psi-inv-empty">暂无发票记录</div>') + '</div>' +
      '<div class="psi-page-foot">' +
        '<button class="psi-full-btn" onclick="psiOpenApplyPage()">+申请开票</button>' +
      '</div>' +
    '</div>';
}

/* 返回：统一回「配件销售单」 */
function psiBackToOrder() {
  window.__PSI_ORDER_IDX = undefined;
  showContent('parts-sales-order');
}

/* 从销售单行内【发票】进入发票页 */
function psoOpenInvoice(orderIdx) {
  window.__PSI_ORDER_IDX = orderIdx;
  showContent('parts-sales-invoice');
}

/* ---- 申请开票：侧滑弹框（复用全站 .pm-panel 范式，宽 1000px）---- */
function psiEnsureApplyPanel() {
  if (document.getElementById('psi-panel-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML =
    '<div class="pm-panel-overlay" id="psi-panel-overlay" onclick="psiBackToInvoice()"></div>' +
    '<div class="pm-panel" id="psi-panel" style="width:1200px">' +
      '<div class="pm-panel-header">' +
        '<span class="pm-panel-title">申请开票</span>' +
        '<button class="pm-panel-close" onclick="psiBackToInvoice()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body" id="psi-panel-body"></div>' +
      '<div class="pm-panel-footer" id="psi-panel-foot"></div>' +
    '</div>';
  while (d.firstChild) document.body.appendChild(d.firstChild);
}

/* ---- 申请开票内容渲染（渲染进侧滑面板 body；无面板时回退到整页容器）---- */
function psiRenderApplyPage() {
  var root = document.getElementById('psi-panel-body') || document.getElementById('page-parts-sales-invoice-apply');
  if (!root) return;
  var r = psiCurOrder();
  if (!r) { root.innerHTML = '<div class="psi-page">未找到销售单</div>'; return; }

  var t = psiTopInfo(r);

  /* 「复制开票信息」带来的预填值（一次性，用后即清，避免残留脏数据）
     无 prefill 时行为与原来完全一致：默认 002、客户名称取销售单客户 */
  var pf = window.__PSI_PREFILL || null;
  var pfType = (pf && pf.type === '001数电专用发票') ? '001数电专用发票' : '002数电普通发票';
  var pfBuyer = (pf && pf.buyer) ? pf.buyer : null;
  var pfTitle = (pf && pf.title) ? pf.title : r.customer;
  var v = function (x) { return x === undefined || x === null ? '' : String(x); };

  root.innerHTML =
    psiTopInfoHtml(r) +
    '<div class="psi-form">' +

        /* 开票金额：默认填剩余未开票金额，不可编辑（PRD 10.19：改为不可编辑，即整单开票）
           用户明确：不可编辑 ≠ 非必填，仍是必传字段（不能为空、不能为 0，否则提交不了）→ 保留必填红星 + 提交时校验
           业务规则提示语放在框的右侧 */
        '<div class="psi-field psi-field-side">' +
          psiFItem('开票金额',
            '<input type="text" id="pia-amount" readonly value="' + psoMoney(t.remaining) + '" data-net="' + psoMoney(t.netAmount) + '">', true) +
          '<span class="psi-rule">开票已开金额+当前正在申请的应收金额；开票已开金额=已开票的+开票中的-冲红的</span>' +
        '</div>' +

        /* 明细要求：与发票类型无关的独立字段 */
        '<div class="psi-field">' +
          psiFItem('明细要求',
            '<label class="psi-radio"><input type="radio" name="pia-detail" value="汇总一行" checked>汇总一行</label>' +
            '<label class="psi-radio"><input type="radio" name="pia-detail" value="明细">明细</label>', true) +
        '</div>' +

        /* 发票类型：选001 数电专用发票时，本字段下方展开购买方信息、并隐藏「客户名称」 */
        '<div class="psi-field">' +
          psiSelect('发票类型',
            '<select id="pia-type" onchange="psiOnInvTypeChange()">' +
              '<option value="001数电专用发票"' + (pfType === '001数电专用发票' ? ' selected' : '') + '>001数电专用发票</option>' +
              '<option value="002数电普通发票"' + (pfType === '002数电普通发票' ? ' selected' : '') + '>002数电普通发票</option>' +
            '</select>', true) +
        '</div>' +

        /* 购买方信息区：发票类型联动，位置在「发票类型」~「发票发送手机号」之间，无外框 */
        '<div id="pia-buyer-box">' +
          '<div class="psi-field">' + psiFItem('购买方名称',
            '<input type="text" id="pia-buyer" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer && pfBuyer.name)) + '">', true) + '</div>' +
          '<div class="psi-field">' + psiFItem('纳税人识别号',
            '<input type="text" id="pia-tax" maxlength="30" placeholder="最多30字符" value="' + npEscape(v(pfBuyer && pfBuyer.tax)) + '">', true) + '</div>' +
          '<div class="psi-field">' + psiFItem('地址',
            '<input type="text" id="pia-addr" maxlength="80" placeholder="最多80字符" value="' + npEscape(v(pfBuyer && pfBuyer.addr)) + '">', true) + '</div>' +
          '<div class="psi-field">' + psiFItem('电话',
            '<input type="text" id="pia-tel" maxlength="20" placeholder="最多20字符" value="' + npEscape(v(pfBuyer && pfBuyer.tel)) + '">', true) + '</div>' +
          '<div class="psi-field">' + psiFItem('开户行',
            '<input type="text" id="pia-bank" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer && pfBuyer.bank)) + '">', true) + '</div>' +
          '<div class="psi-field">' + psiFItem('账号',
            '<input type="text" id="pia-account" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer && pfBuyer.account)) + '">', true) + '</div>' +
        '</div>' +

        /* 客户名称：仅非专用发票时显示（001 时隐藏，由购买方信息替代） */
        '<div class="psi-field" id="pia-cust-field">' +
          psiFItem('客户名称',
            '<input type="text" id="pia-cust" maxlength="50" placeholder="默认填充客户姓名或门店名称，可修改" value="' + npEscape(pfTitle) + '">', true) +
        '</div>' +

        '<div class="psi-field">' +
          npFItem('发票发送手机号',
            '<input type="text" id="pia-phone" maxlength="20" placeholder="默认填充客户姓名或门店手机号，可修改">') +
        '</div>' +
        '<div class="psi-field">' +
          npFItem('发票发送邮箱',
            '<input type="text" id="pia-email" maxlength="50" placeholder="请输入">') +
        '</div>' +
        '<div class="psi-field">' +
          npFItem('备注',
            '<input type="text" id="pia-remark" maxlength="100" placeholder="请输入">') +
        '</div>' +

      '</div>';
  /* 底部操作区：复用全站 .pm-panel-footer（侧滑面板标准底部） */
  var foot = document.getElementById('psi-panel-foot');
  if (foot) {
    foot.innerHTML = '<button class="lt-btn lt-btn-primary" onclick="psoSubmitInvoiceApply()">提交开票信息</button>';
  }

  psiOnInvTypeChange();
  /* 预填值只用一次，渲染完即清；下次从底部「+申请开票」进来仍是默认值 */
  window.__PSI_PREFILL = undefined;
}

/* 打开申请开票侧滑面板 */
function psiOpenApplyPage() {
  psiEnsureApplyPanel();
  psiRenderApplyPage();
  document.getElementById('psi-panel-overlay').classList.add('show');
  document.getElementById('psi-panel').classList.add('show');
}

/* 关闭申请开票侧滑面板（回到发票页） */
function psiBackToInvoice() {
  var ov = document.getElementById('psi-panel-overlay');
  var pn = document.getElementById('psi-panel');
  if (ov) ov.classList.remove('show');
  if (pn) pn.classList.remove('show');
  showContent('parts-sales-invoice');
}

/* 发票类型联动：
   001数电专用发票 → 在「发票类型」下方展开购买方信息（无外框），并隐藏「客户名称」
   002数电普通发票 → 收起购买方信息，显示「客户名称」 */
function psiOnInvTypeChange() {
  var box = document.getElementById('pia-buyer-box');
  var custField = document.getElementById('pia-cust-field');
  var sel = document.getElementById('pia-type');
  if (!sel) return;
  var isSpecial = (sel.value === '001数电专用发票');
  if (box) box.style.display = isSpecial ? 'block' : 'none';
  if (custField) custField.style.display = isSpecial ? 'none' : 'block';
}

/* 「复制开票信息」（发票页每张卡片一个按钮）
   行为：跳到申请开票页，并按被点的这张发票的类型自动带出「发票类型 + 开票抬头」
   —— 专票 001 带出购买方 6 项；普票 002 带出客户名称（用户口径：复制的哪个就从哪个里面带出来） */
function psoCopyInvoiceInfo(idx) {
  var iv = npFindByIdx(psoInvoiceAll(), idx);
  if (!iv) { npToast('未找到该发票记录'); return; }
  window.__PSI_PREFILL = {
    type: iv.invType,
    /* 专票：购买方 6 项；普票：客户名称（开票抬头） */
    buyer: iv.invType === '001数电专用发票' ? psiInvoiceBuyer(iv) : null,
    title: iv.invType === '001数电专用发票' ? '' : (iv.title || psiFeeObjectText(psiCurOrder()))
  };
  psiOpenApplyPage();
}

/* 下载发票（PRD 7.29：发票平台不支持预览，按钮名为「下载发票」）*/
function psoDownloadInvoice() {
  npToast('发票下载（演示）：文件流待对接集团电子发票平台后开放');
}

/* 作废冲红 */
function psoVoidInvoice(idx) {
  var iv = npFindByIdx(psoInvoiceAll(), idx);
  if (!iv) { npToast('未找到该发票记录'); return; }
  if (iv.status !== '开票成功') { npToast('仅开票成功的发票可作废冲红'); return; }
  if (!window.confirm('确认对发票「' + iv.invoiceNo + '」作废冲红？')) return;
  var reason = window.prompt('请输入作废冲红原因（可留空）', '');
  if (reason === null) return;
  iv.status = '作废冲红中';
  iv.redReason = reason.trim();
  psiRenderInvoicePage();
  npToast('已提交作废冲红申请' + (reason.trim() ? '，原因：' + reason.trim() : ''));
}

/* 提交开票信息 */
function psoSubmitInvoiceApply() {
  var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var amount = g('pia-amount');
  var cust = g('pia-cust');
  var type = g('pia-type');

  /* 开票金额虽不可编辑，但仍是必传字段：不能为空、不能为 0，否则提交不了（用户明确） */
  if (!amount) { npToast('开票金额不能为空'); return; }
  if (!(parseFloat(amount) > 0)) { npToast('开票金额不能为 0'); return; }
  if (!cust) { npToast('请填写客户名称'); return; }
  if (!type) { npToast('请选择发票类型'); return; }

  /* 仅电子专用发票需填购买方信息 */
  if (type === '001数电专用发票') {
    var must = ['pia-buyer', 'pia-tax', 'pia-addr', 'pia-tel', 'pia-bank', 'pia-account'];
    for (var i = 0; i < must.length; i++) {
      if (!g(must[i])) { npToast('请完整填写购买方信息（' + must[i].replace('pia-', '') + '）'); return; }
    }
  }

  var all = psoInvoiceAll();
  var curOrder = psiCurOrder();
  var isSpecial = (type === '001数电专用发票');
  all.unshift({
    idx: npNextIdx(all),
    status: '开票中',
    /* 发票类型 + 对应抬头一起记下来：新记录的「复制开票信息」也能按类型带出 */
    invType: type,
    orderIdx: curOrder ? curOrder.idx : 0,
    title: isSpecial ? '' : cust,
    applyNo: psiHash32(),
    invoiceNo: '',
    applyTime: npNowLocal(),
    redTime: '',
    redReason: ''
  });

  psiRenderInvoicePage();
  psiBackToInvoice();
  npToast('开票信息已提交');
}

/* 生成 32 位哈希串（发票号 / 开票申请编号用，格式依实际截图） */
function psiHash32() {
  var s = '';
  var hex = '0123456789abcdef';
  for (var i = 0; i < 32; i++) s += hex.charAt(Math.floor(Math.random() * 16));
  return s;
}

npRegisterModuleInit('parts-sales-invoice', function () { psiRenderInvoicePage(); });
