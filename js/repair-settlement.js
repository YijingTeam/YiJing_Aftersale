/* ============================================================
   售后管理 / 维保服务 / 维修结算收款
   - 列表页（动态 npShell 范式）
   - 收款详情侧滑面板（pm-panel 范式）
   数据/状态枚举/文案照搬 920 迭代包 settlement-payment-list.html +
   settlement-payment-detail.html + invoice-management.js；
   渲染层全部使用当前原型的 lt-/pm-/pp- 既有类与公共 helper。
   ============================================================ */

NP['repair-settlement'] = { page:1, pageSize:20, allData:[], filtered:[], render:null, query:null, reset:null };

/* ---------- 状态枚举（照搬 920 invoice-management.js labels） ---------- */
var RSC_LABELS = {
  status: {
    UNPAID:'未支付', PAYING:'支付中', PAID_PENDING_COLLECTION:'已支付待收款确认',
    PAID:'已支付', REFUNDING:'退款中', REFUND_FAIL:'退款失败待核对',
    REFUNDED:'已退款', EXCEPTION:'支付异常'
  },
  settlement: { WAITING_PAYMENT:'待收款', SETTLED:'已结算', REVERSED:'已反结算' },
  invoice: {
    NOT_READY:'待开票', PROCESSING:'开票中', ISSUED:'已开票', FAILED:'开票失败',
    CREDITING:'冲红中', CREDITED:'已冲红', CREDIT_FAIL:'作废失败'
  }
};
/* lt-badge 只有 ok/off/warn 三个修饰类，按语义收敛（不自造类） */
var RSC_BADGE = {
  UNPAID:'warn', PAYING:'warn', PAID_PENDING_COLLECTION:'warn', PAID:'ok',
  REFUNDING:'warn', REFUNDED:'ok', REFUND_FAIL:'off', EXCEPTION:'off',
  WAITING_PAYMENT:'warn', SETTLED:'ok', REVERSED:'off', UNSETTLED:'warn',
  NOT_READY:'warn', PROCESSING:'warn', ISSUED:'ok', FAILED:'off',
  CREDITING:'warn', CREDITED:'off', CREDIT_FAIL:'off'
};
var RSC_REFUND_REASONS = ['重复收款','收款金额错误','维修项目取消或未实施','客户协商终止服务'];

/* ---------- 示例数据（9 行，字段与 920 结算单一一对应）
   门店按已拍板口径分布：直营（SCZ01/HBZ01）与非直营（上海浦东店/北京朝阳店/武汉光谷店）都有，
   用于验证「门店类型」取门店管理主数据，且「收款」与渠道模式无关
   2026-10-20 调整：日期平移到 2026-09-20 ~ 2026-10-19（规范默认区间＝上月今天~今天，
   否则进页面 0 条）；补报修人/报修人电话/报修日期（截图新增查询项需要）；
   服务顾问由人员主数据「门店服务顾问」在初始化时按门店回填（见 rscApplyAdvisors） ---------- */
(function(){
  var a = [
    { id:'WXJSDYJ-HBZ05261019001', order:'Z05RO261019001', storeCode:'HBZ01', plate:'鄂A·E9201', vin:'LAB00R12635092001',
      date:'2026-10-19 15:20', reporter:'张伟', reporterPhone:'13800138001', reportDate:'2026-10-17',
      labor:'325.63', part:'351.62', total:'677.25',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'按商务政策', amount:'0.00', labor:'0.00', part:'0.00', remark:''}],
      /* 收退款流水（渠道→方式按联动规则：门店自行全量；支付二维码/用户App 只有微信、支付宝） */
      payRecords:[
        { type:'收款', channel:'门店自行', method:'现金', amount:'300.00', time:'2026-10-19 15:22', payState:'OK' },
        { type:'收款', channel:'门店自行', method:'挂账', amount:'377.25', time:'2026-10-19 15:26', payState:'OK' }
      ] },
    { id:'WXJSDYJ-SCZ01261015011', order:'Z05RO261015011', storeCode:'SCZ01', plate:'川A·Q9026', vin:'LDP41B960TD920011',
      date:'2026-10-15 13:06', reporter:'李静', reporterPhone:'13900139002', reportDate:'2026-10-13',
      labor:'180.00', part:'0.00', total:'180.00',
      status:'PAYING', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'优惠券', amount:'0.00', labor:'0.00', part:'0.00', remark:''}], payOrderNo:'YJ_WXSK_Z05RO26101501101',
      payRecords:[
        { type:'收款', channel:'支付二维码', method:'微信', amount:'180.00', time:'2026-10-15 13:08', payState:'WAIT' }
      ] },
    { id:'WXJSDYJ-SH001261012007', order:'Z05RO261012007', storeCode:'SH001', plate:'沪A·M2308', vin:'LAP31CZ60GG920007',
      date:'2026-10-12 10:18', reporter:'王芳', reporterPhone:'13700137003', reportDate:'2026-10-10',
      labor:'720.00', part:'0.00', total:'720.00',
      status:'PAID_PENDING_COLLECTION', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'按商务政策', amount:'100.00', labor:'100.00', part:'0.00', remark:''},
                 {type:'优惠券', amount:'100.00', labor:'100.00', part:'0.00', remark:''}],
      recommend:'客户为老客户，按商务政策折让 100 元，另发 100 元优惠券。',
      payOrderNo:'YJ_WXSK_Z05RO26101200701',
      payRecords:[
        { type:'收款', channel:'用户App', method:'支付宝', amount:'520.00', time:'2026-10-12 10:20', payState:'OK' },
        { type:'收款', channel:'用户App', method:'微信', amount:'200.00', time:'2026-10-12 10:24', payState:'PAY_FAIL' }
      ] },
    { id:'WXJSDYJ-HBZ05261010003', order:'Z05RO261010003', storeCode:'HBZ01', plate:'鄂A·X9286', vin:'LAB00R12635092003',
      date:'2026-10-10 09:52', reporter:'刘洋', reporterPhone:'13600136004', reportDate:'2026-10-08',
      labor:'266.40', part:'0.00', total:'266.40',
      status:'PAID', settlement:'SETTLED', invoice:'NOT_READY',
      discounts:[], payOrderNo:'YJ_WXSK_Z05RO26101000301',
      payRecords:[
        { type:'收款', channel:'门店自行', method:'银行卡', amount:'266.40', time:'2026-10-10 09:56', payState:'OK' }
      ],
      /* 发票整页卡片：直营店 + 开票中（直营不出「上传发票」） */
      invoices:[
        { state:'开票中', invType:'002数电普通发票', invoiceNo:'', applyNo:'3d8f1a60c7b24e9fb05a2d71e8c4f193',
          applyTime:'2026-10-18 09:47:26', source:'App', buyer:null, title:'刘洋', amount:'266.40' }
      ] },
    { id:'WXJSDYJ-BJ001261008006', order:'Z05RO261008006', storeCode:'BJ001', plate:'京A·V6608', vin:'FSTEST15B00092006',
      date:'2026-10-08 11:16', reporter:'陈敏', reporterPhone:'13500135005', reportDate:'2026-10-06',
      labor:'180.00', part:'420.00', total:'600.00',
      status:'PAID', settlement:'SETTLED', invoice:'ISSUED', invoiceNo:'251420000092006',
      invoiceDate:'2026-10-09', discounts:[], payOrderNo:'YJ_WXSK_Z05RO26100800601',
      header:{ type:'个人', name:'张三', invoiceType:'普通发票', content:'商品明细', version:1, source:'结算客户信息' },
      payRecords:[
        { type:'收款', channel:'门店自行', method:'现金', amount:'600.00', time:'2026-10-08 11:18', payState:'OK' }
      ],
      /* 发票整页卡片：非直营店 + 作废冲红中（出「上传发票」）+ 重新开出的那张
         金额口径：作废冲红中的那张冲红完成后金额退回（记 0），实际占用额度的是重新开出的那张 */
      invoices:[
        { state:'作废冲红中', invType:'001数电专用发票', invoiceNo:'126004daf8dedacb4f29a779c80f0c7a',
          applyNo:'ce4c3110761d689dfef6c293e7bbacad', applyTime:'2026-10-09 15:20:11',
          source:'App', amount:'0.00',
          buyer:{ name:'北京朝阳店', tax:'',
            addr:'北京市朝阳区建国路 118 号', tel:'010-85660000',
            bank:'中国银行北京朝阳支行', account:'1001 2345 6789 0321' }, title:'', redReason:'' },
        { state:'开票成功', invType:'001数电专用发票', invoiceNo:'251420000092006',
          applyNo:'b7c4e2f18a094d3cb62e5f0d7413a9ce', applyTime:'2026-10-09 11:03:44',
          source:'DMS', amount:'600.00',
          buyer:{ name:'北京朝阳店', tax:'',
            addr:'北京市朝阳区建国路 118 号', tel:'010-85660000',
            bank:'中国银行北京朝阳支行', account:'1001 2345 6789 0321' }, title:'', redReason:'' }
      ] },
    { id:'SK2026100500000001', order:'WX2026100500000001', storeCode:'SCZ01', plate:'川A·R9201', vin:'LAB00R12635092021',
      date:'2026-10-05 14:30', reporter:'杨磊', reporterPhone:'13400134006', reportDate:'2026-10-03',
      labor:'200.00', part:'100.00', total:'300.00',
      status:'REFUNDING', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[], refundRoute:'BEFORE_COLLECTION', refundReason:'重复收款', refundRequestNo:'RF-920-0021-1',
      payOrderNo:'YJ_WXSK_WX202610050000000101',
      payRecords:[
        { type:'收款', channel:'门店自行', method:'现金', amount:'300.00', time:'2026-10-05 14:32', payState:'OK' },
        { type:'退款', channel:'门店自行', method:'现金', amount:'300.00', time:'2026-10-05 14:40', payState:'OK' }
      ] },
    { id:'SK2026100200000001', order:'WX2026100200000001', storeCode:'WH001', plate:'鄂A·R9202', vin:'LAB00R12635092022',
      date:'2026-10-02 11:10', reporter:'黄军', reporterPhone:'13300133007', reportDate:'2026-09-30',
      labor:'180.00', part:'120.00', total:'300.00',
      status:'REFUNDED', settlement:'REVERSED', invoice:'CREDITED',
      discounts:[], refundRoute:'AFTER_COLLECTION', refundHadInvoice:true,
      refundReason:'维修项目取消或未实施', refundRequestNo:'RF-920-0022-1',
      payOrderNo:'YJ_WXSK_WX202610020000000101',
      payRecords:[
        { type:'收款', channel:'支付二维码', method:'微信', amount:'300.00', time:'2026-10-02 11:12', payState:'OK' },
        { type:'退款', channel:'支付二维码', method:'微信', amount:'300.00', time:'2026-10-02 16:26', payState:'OK' }
      ],
      /* 发票整页卡片：已冲红（下载的是冲红那张发票） */
      invoices:[
        { state:'已冲红', invType:'002数电普通发票', invoiceNo:'9f2c48b7e1a34d56bc07e28a4d1f6c93',
          applyNo:'5e9d3a17b8c04f62a93d17c60b8e4f2', applyTime:'2026-10-02 16:24:08',
          source:'App', amount:'300.00', buyer:null, title:'黄军',
          redReason:'维修项目取消或未实施' }
      ] },
    { id:'SK2026092800000001', order:'WX2026092800000001', storeCode:'SCZ01', plate:'川A·R9203', vin:'LAB00R12635092023',
      date:'2026-09-28 10:20', reporter:'周勇', reporterPhone:'13200132008', reportDate:'2026-09-26',
      labor:'260.00', part:'140.00', total:'400.00',
      status:'REFUND_FAIL', settlement:'REVERSED', invoice:'NOT_READY',
      discounts:[], refundRoute:'AFTER_COLLECTION', refundReason:'收款金额错误', refundRequestNo:'RF-920-0023-1',
      payOrderNo:'YJ_WXSK_WX202609280000000101',
      payRecords:[
        { type:'收款', channel:'门店自行', method:'挂账', amount:'400.00', time:'2026-09-28 10:24', payState:'OK' },
        /*退款流水支付状态＝失败（本单状态＝退款失败待核对） */
        { type:'退款', channel:'门店自行', method:'挂账', amount:'400.00', time:'2026-09-28 10:31', payState:'FAIL' }
      ] },
    { id:'SK2026092500000001', order:'WX2026092500000001', storeCode:'BJ001', plate:'京A·R9204', vin:'LAB00R12635092024',
      date:'2026-09-25 09:15', reporter:'吴涛', reporterPhone:'13100131009', reportDate:'2026-09-24',
      labor:'120.00', part:'80.00', total:'200.00',
      status:'EXCEPTION', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[], payOrderNo:'YJ_WXSK_WX202609250000000101',
      /* 支付异常单：流水支付状态＝支付超时（配合列表「支付异常」） */
      payRecords:[
        { type:'收款', channel:'用户App', method:'微信', amount:'200.00', time:'2026-09-25 09:17', payState:'TIMEOUT' }
      ] },
    /* 直营店 + 已结算 + 发票「作废冲红中」：用于直营门店侧的冲红场景（直营不出「上传发票」） */
    { id:'WXJSDYJ-SCZ01261007005', order:'Z05RO261007005', storeCode:'SCZ01', plate:'川A·R9205', vin:'LDP41B960TD920025',
      date:'2026-10-07 16:40', reporter:'罗敏', reporterPhone:'13600136007', reportDate:'2026-10-05',
      labor:'380.00', part:'0.00', total:'380.00',
      status:'PAID', settlement:'SETTLED', invoice:'CREDITING',
      discounts:[], payOrderNo:'YJ_WXSK_Z05RO26100700501',
      payRecords:[
        { type:'收款', channel:'门店自行', method:'银行卡', amount:'380.00', time:'2026-10-07 16:44', payState:'OK' }
      ],
      /* 发票整页卡片：作废冲红中（直营店 → 不出「上传发票」） */
      invoices:[
        { state:'作废冲红中', invType:'001数电专用发票', invoiceNo:'7c3d9e15a04b62f8d1e570b3946a2c81',
          applyNo:'b6e2a4d90f37c158e2a4d6b0931c7f8', applyTime:'2026-10-07 17:02:10',
          source:'DMS', amount:'0.00',
          buyer:{ name:'成都锦江店', tax:'91510100MAKFGRJ5XK',
            addr:'成都市锦江区红星路三段 88 号', tel:'028-85580000',
            bank:'中国工商银行成都锦江支行', account:'1001 2345 6789 0876' }, title:'', redReason:'' },
        { state:'开票成功', invType:'001数电专用发票', invoiceNo:'2f8b6c04d7a951e3b6c0d47f82915a6',
          applyNo:'e4c1b7f28a035d69c7b12e8f45091d3', applyTime:'2026-10-07 16:58:33',
          source:'DMS', amount:'380.00',
          buyer:{ name:'成都锦江店', tax:'91510100MAKFGRJ5XK',
            addr:'成都市锦江区红星路三段 88 号', tel:'028-85580000',
            bank:'中国工商银行成都锦江支行', account:'1001 2345 6789 0876' }, title:'', redReason:'' }
      ] },
    /* 非直营店 + 已结算 + 发票「开票中」：非直营侧的申请开票中场景（非直营 → 出「上传发票」） */
    { id:'WXJSDYJ-SH001261009009', order:'Z05RO261009009', storeCode:'SH001', plate:'沪A·M2310', vin:'LAP31CZ60SG920009',
      date:'2026-10-09 11:20', reporter:'许诺', reporterPhone:'13700137009', reportDate:'2026-10-07',
      labor:'260.00', part:'140.00', total:'400.00',
      status:'PAID', settlement:'SETTLED', invoice:'PROCESSING',
      discounts:[], payOrderNo:'YJ_WXSK_Z05RO26100900901',
      payRecords:[
        { type:'收款', channel:'门店自行', method:'现金', amount:'400.00', time:'2026-10-09 11:24', payState:'OK' }
      ],
      /* 发票整页卡片：开票中（非直营店 → 出「上传发票」）；申请来源 App */
      invoices:[
        { state:'开票中', invType:'001数电专用发票', invoiceNo:'',
          applyNo:'d5a0c83f27b194e6a0c83f27b194e6a01', applyTime:'2026-10-09 11:26:40',
          source:'App', amount:'400.00',
          buyer:{ name:'上海浦东店', tax:'',
            addr:'上海市浦东新区张杨路 500 号', tel:'021-58880000',
            bank:'中国银行上海浦东支行', account:'1001 2345 6789 0132' }, title:'', redReason:'' }
      ] },
    /* 直营店 + 已结算 + 发票「开票失败」：开票申请被平台驳回，卡片右侧只出「复制开票信息」 */
    { id:'WXJSDYJ-HBZ05261020013', order:'Z05RO261020013', storeCode:'HBZ01', plate:'鄂A·E9213', vin:'LAB00R12635092013',
      date:'2026-10-20 10:26', reporter:'孙梅', reporterPhone:'13500135013', reportDate:'2026-10-18',
      labor:'320.00', part:'180.00', total:'500.00',
      status:'PAID', settlement:'SETTLED', invoice:'FAILED',
      discounts:[], payOrderNo:'YJ_WXSK_Z05RO26102001301',
      payRecords:[
        { type:'收款', channel:'门店自行', method:'银行卡', amount:'500.00', time:'2026-10-20 10:30', payState:'OK' }
      ] },
    /* 非直营店 + 已结算 + 发票「作废失败」：冲红未成功，发票仍有效，可下载、可再次作废冲红 */
    { id:'WXJSDYJ-SH001261021014', order:'Z05RO261021014', storeCode:'SH001', plate:'沪A·M2314', vin:'LAP31CZ60SG920014',
      date:'2026-10-21 15:08', reporter:'钱进', reporterPhone:'13700137014', reportDate:'2026-10-19',
      labor:'460.00', part:'240.00', total:'700.00',
      status:'PAID', settlement:'SETTLED', invoice:'CREDIT_FAIL',
      discounts:[], payOrderNo:'YJ_WXSK_Z05RO26102101401',
      payRecords:[
        { type:'收款', channel:'用户App', method:'微信', amount:'700.00', time:'2026-10-21 15:12', payState:'OK' }
      ] }
  ];
  a.forEach(function(r, i){ r.idx = i; });
  NP['repair-settlement'].allData = a;
})();

/* ---------- 门店主数据取「门店类型」（唯一来源：门店管理） ---------- */
function rscStore(code){
  var all = (NP['store-manage'] && NP['store-manage'].allData) || [];
  for (var i = 0; i < all.length; i++){ if (all[i].code === code) return all[i]; }
  return null;
}
/* 门店简称（新增「门店」列取值，与门店选择器回填口径一致） */
function rscStoreShort(code){
  var s = rscStore(code);
  return s ? (s.shortName || s.name) : '—';
}
/* 920 的 DIRECT 口径 → 取门店主数据的渠道模式：直营显示「直营店」，非直营显示「非直营店」 */
function rscStoreType(r){
  var s = rscStore(r.storeCode);
  if (!s) return '—';
  return s.channelMode === '直营' ? '直营店' : '非直营店';
}
/* ---------- 人员主数据：门店服务顾问（R06） ----------
   「服务顾问」查询项与列表列的唯一来源；示例数据的 advisor 也按门店回填，
   保证下拉选了能筛出数据（口径同原型规范：大区/小区/人员均以主数据为准） */
function rscAdvisors(){
  var o = window.ORG_MASTER;
  if (!o || !o.personsByRole) return [];
  return o.personsByRole('R06');
}
function rscAdvisorNames(){
  var seen = {}, out = [];
  rscAdvisors().forEach(function(p){
    if (p && p.name && !seen[p.name]){ seen[p.name] = 1; out.push(p.name); }
  });
  return out;
}
function rscApplyAdvisors(){
  var o = window.ORG_MASTER;
  if (!o || !o.personsByStore) return;
  var all = (NP['repair-settlement'] && NP['repair-settlement'].allData) || [];
  all.forEach(function(r){
    var ps = o.personsByStore(r.storeCode) || [];
    for (var i = 0; i < ps.length; i++){
      if (ps[i].roleId === 'R06'){ r.advisor = ps[i].name; break; }
    }
  });
}

/* ---------- 金额/状态派生 ---------- */
function rscNum(v){ var n = parseFloat(String(v || '0').replace(/,/g,'')); return isNaN(n) ? 0 : n; }
function rscMoney(v){ return rscNum(v).toFixed(2); }
function rscDiscountTotal(r){
  return (r.discounts || []).reduce(function(s, d){ return s + rscNum(d.amount); }, 0);
}
/* 实际收款金额 = 应收总额 - 折让合计 */
function rscNet(r){ return Math.max(0, Math.round((rscNum(r.total) - rscDiscountTotal(r)) * 100) / 100); }
function rscInvoiceAmount(r){ return rscNet(r); }
function rscBadge(key, label){
  return '<span class="lt-badge ' + (RSC_BADGE[key] || 'warn') + '">' + npEscape(label) + '</span>';
}
/* 发票卡片状态 → 结算单发票状态码（列表发票状态列与发票整页卡片保持同一口径） */
var RSC_CARD_CODE = { '开票中':'PROCESSING', '开票成功':'ISSUED', '作废冲红中':'CREDITING', '已冲红':'CREDITED',
  '开票失败':'FAILED', '作废失败':'CREDIT_FAIL' };
/* 发票状态显示文案（照搬 920 invoiceLabel 逻辑） */
function rscInvoiceLabel(r){
  /* 已挂发票卡片时：以最新一张卡片为准（发票整页与列表列同一口径） */
  var cards = rscInvoices(r);
  if (cards.length){
    var code = RSC_CARD_CODE[cards[0].state];
    if (code) return RSC_LABELS.invoice[code];
  }
  if (r.invoice === 'ISSUED') return RSC_LABELS.invoice.ISSUED;
  if (r.invoice !== 'NOT_READY') return RSC_LABELS.invoice[r.invoice];
  if (r.status === 'REFUNDING' || r.status === 'REFUNDED' || r.status === 'REFUND_FAIL') return '未开票';
  if (r.status !== 'PAID' || r.settlement !== 'SETTLED') return '待完成收款';
  return '待开票';
}
/* 列表发票状态列的 badge key（跟随卡片口径） */
function rscInvoiceBadgeKey(r){
  var cards = rscInvoices(r);
  if (cards.length){
    var code = RSC_CARD_CODE[cards[0].state];
    if (code) return code;
  }
  return r.invoice;
}
/* 是否可开票（照搬 920 canInvoice） */
function rscCanInvoice(r){ return r.status === 'PAID' && r.settlement === 'SETTLED'; }
/* 是否处于退款流程（照搬 920） */
function rscInRefund(r){ return r.status === 'REFUNDING' || r.status === 'REFUNDED' || r.status === 'REFUND_FAIL'; }

/* ---------- 列表页 ---------- */
function initRepairSettlement(){
  var K = 'repair-settlement'; var st = NP[K];

  /* 日期区间：label 随「日期类型」联动（提交结算日期 / 报修日期） */
  var dateRangeHtml = '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix" id="rsc-f-date-label">提交结算日期</span>'
    + '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="rscApplyFilter">'
    + '<div class="lt-date-range-drop">'
    + '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="rsc-flt-date-start" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">'
    + '<span>—</span>'
    + '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="rsc-flt-date-end" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">'
    + '</div></div></div>';

  /* 门店：系统全局统一门店选择器（穿梭框），数据源＝门店管理主数据 */
  var storePickHtml = '<div class="lt-filter-item"><div class="lt-input-wrap search store-pick">'
    + '<span class="lt-filter-prefix">门店</span>'
    + '<input type="text" id="rsc-f-store" placeholder="请选择" readonly onclick="msOpenStorePicker(\'rsc-f-store\')">'
    + '<svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg>'
    + '</div></div>';

  /* 服务顾问：选项取人员主数据「门店服务顾问」(R06) */
  var advisorOpts = rscAdvisorNames().map(function(n){
    return '<option value="' + npEscape(n) + '">' + npEscape(n) + '</option>';
  }).join('');

  /* 结算状态：2 个独立单选（已结算 / 已提交结算申请），无框无标签，单独占 1 格；默认都不选＝不过滤 */
  var settleRadioHtml = '<div class="lt-filter-item"><span class="lt-radio-group">'
    + '<label class="lt-radio"><input type="radio" name="rsc-f-settle" value="SETTLED"><span>已结算</span></label>'
    + '<label class="lt-radio"><input type="radio" name="rsc-f-settle" value="UNSETTLED"><span>已提交结算申请</span></label>'
    + '</span></div>';

  var filter =
    npSelect('品牌','<select id="rsc-f-brand"><option value="">请选择</option><option>奕境汽车</option></select>') +
    storePickHtml +
    npSelect('日期类型','<select id="rsc-f-datetype" onchange="rscDateTypeChange()"><option value="提交结算日期">提交结算日期</option><option value="报修日期">报修日期</option></select>') +
    dateRangeHtml +
    npFItem('VIN','<input type="text" id="rsc-f-vin" placeholder="请输入">') +
    npFItem('维修工单号','<input type="text" id="rsc-f-order" placeholder="请输入">') +
    npFItem('车牌号','<input type="text" id="rsc-f-plate" placeholder="请输入">') +
    npFItem('报修人','<input type="text" id="rsc-f-reporter" placeholder="请输入">') +
    npFItem('报修人电话','<input type="text" id="rsc-f-reporter-phone" placeholder="请输入">') +
    npSelect('服务顾问','<select id="rsc-f-advisor"><option value="">请选择</option>' + advisorOpts + '</select>') +
    settleRadioHtml;

  var toolbar = '<button class="lt-btn lt-btn-default" onclick="rscRefreshStatus()">刷新状态</button>'
    + '<button class="lt-btn lt-btn-default" onclick="rscExport()">导出</button>';

  function money(v){ return '<span style="color:#185FA5">¥' + rscMoney(v) + '</span>'; }

  var cols = [
    {t:'序号', w:60, cls:'col-seq sticky', f:function(r,i){ return i+1; }},
    {t:'维修工单号', w:150, cls:'col-order sticky', f:function(r){
      return '<a href="javascript:void(0)" class="lt-btn-link" onclick="rscOpenPanel(' + r.idx + ')">' + npEscape(r.order) + '</a>';
    }},
    {t:'结算单号', w:210, f:function(r){ return npEscape(r.id); }},
    {t:'门店', w:110, f:function(r){ return npEscape(rscStoreShort(r.storeCode)); }},
    {t:'门店类型', w:100, f:function(r){ return rscStoreType(r); }},
    {t:'车牌号', w:110, f:function(r){ return npEscape(r.plate); }},
    {t:'VIN码', w:200, f:function(r){ return npEscape(r.vin); }},
    {t:'服务顾问', w:100, f:function(r){ return npEscape(r.advisor); }},
    {t:'提交结算日期', w:150, f:function(r){ return npEscape(r.date); }},
    {t:'工时应收', w:110, f:function(r){ return money(r.labor); }},
    {t:'配件应收', w:110, f:function(r){ return money(r.part); }},
    {t:'应收总额', w:120, f:function(r){ return money(r.total); }},
    {t:'支付状态', w:170, f:function(r){ return rscBadge(r.status, RSC_LABELS.status[r.status]); }},
    {t:'结算状态', w:110, f:function(r){ return rscBadge(rscSettleState(r), rscSettleLabel(r)); }},
    {t:'发票状态', w:150, f:function(r){ return rscBadge(rscInvoiceBadgeKey(r), rscInvoiceLabel(r)); }},
    {t:'操作', w:150, cls:'col-actions sticky', f:function(r){ return rscActions(r); }}
  ];

  var root = document.getElementById('page-repair-settlement');
  if (!root) return;
  root.innerHTML = npShell(K, {l2:'售后管理', l3:'维修结算收款'}, filter, toolbar, npTH(cols), 'rsc-tbody', 'rsc-pager');
  initFilterGrid(K + '-filterGrid', 7); NP[K]._fShow = 7; NP[K]._fExp = false;
  /* 服务顾问按门店从人员主数据回填（保证下拉选了能筛出数据） */
  rscApplyAdvisors();
  /* 日期默认值：规范「上月今天~今天」 */
  rscSetDefaultRange();

  st.query = function(){
    function val(id){ var v = (document.getElementById(id) || {}).value || ''; return v === '请选择' ? '' : v; }
    var brand = val('rsc-f-brand');
    var store = val('rsc-f-store');
    var dateType = val('rsc-f-datetype') || '提交结算日期';
    var vin = val('rsc-f-vin').toUpperCase();
    var order = val('rsc-f-order').toUpperCase();
    var plate = val('rsc-f-plate');
    var reporter = val('rsc-f-reporter');
    var reporterPhone = val('rsc-f-reporter-phone');
    var advisor = val('rsc-f-advisor');
    var settle = '';
    var sr = document.querySelector('input[name="rsc-f-settle"]:checked');
    if (sr) settle = sr.value;
    var ds = (document.getElementById('rsc-flt-date-start') || {}).value || '';
    var de = (document.getElementById('rsc-flt-date-end') || {}).value || '';
    var storeNames = store.split(/[,，、]/).map(function(s){ return s.trim(); }).filter(Boolean);
    st.filtered = st.allData.filter(function(r){
      var d = (dateType === '报修日期' ? (r.reportDate || '') : r.date.slice(0, 10));
      return (brand === '' || brand === '奕境汽车') &&
        (storeNames.length === 0 || storeNames.indexOf(rscStoreShort(r.storeCode)) >= 0) &&
        (vin === '' || r.vin.indexOf(vin) >= 0) &&
        (order === '' || r.order.indexOf(order) >= 0 || r.id.indexOf(order) >= 0) &&
        (plate === '' || r.plate.indexOf(plate) >= 0) &&
        (reporter === '' || (r.reporter || '').indexOf(reporter) >= 0) &&
        (reporterPhone === '' || (r.reporterPhone || '').indexOf(reporterPhone) >= 0) &&
        (advisor === '' || r.advisor === advisor) &&
        (settle === '' || rscSettleState(r) === settle) &&
        (ds === '' || d >= ds) && (de === '' || d <= de);
    });
    st.page = 1; st.render();
  };
  st.reset = function(){
    ['rsc-f-brand','rsc-f-store','rsc-f-vin','rsc-f-order','rsc-f-plate',
     'rsc-f-reporter','rsc-f-reporter-phone','rsc-f-advisor']
      .forEach(function(id){ var e = document.getElementById(id); if (e) e.value = ''; });
    var dt = document.getElementById('rsc-f-datetype');
    if (dt) dt.value = '提交结算日期';
    var lb = document.getElementById('rsc-f-date-label');
    if (lb) lb.textContent = '提交结算日期';
    var rs = document.querySelectorAll('input[name="rsc-f-settle"]');
    for (var i = 0; i < rs.length; i++) rs[i].checked = false;
    /* 日期恢复规范默认值（上月今天~今天） */
    rscSetDefaultRange();
    st.filtered = st.allData.slice(); st.page = 1; st.render();
  };
  st.render = function(){ npRenderTable(K, 'rsc-tbody', 'rsc-pager', cols, st.filtered, st); };
  st.filtered = st.allData.slice(); st.page = 1; st.render();
}
/* 默认日期区间：规范「上月今天~今天」（npDefaultDateRange 统一口径，禁止手写） */
function rscSetDefaultRange(){
  if (!document.getElementById('rsc-flt-date-start')) return;
  npDefaultDateRange('rsc-flt-date-start', 'rsc-flt-date-end');
}
/* 「日期类型」切换：日期区间 label 联动 */
function rscDateTypeChange(){
  var dt = document.getElementById('rsc-f-datetype');
  var lb = document.getElementById('rsc-f-date-label');
  if (dt && lb) lb.textContent = dt.value;
}
/* 结算状态两态：已结算 / 未结算
   —— 反结算（REVERSED）不单独显示在「结算状态」列里，只在数据层保留标记 */
function rscSettleState(r){
  return (r.settlement === 'SETTLED') ? 'SETTLED' : 'UNSETTLED';
}
function rscSettleLabel(r){
  return rscSettleState(r) === 'SETTLED' ? '已结算' : '未结算';
}
function rscApplyFilter(){ var st = NP['repair-settlement']; if (st && st.query) st.query(); }

/* ---------- 操作列按钮规则（唯一依据＝工单结算状态，2026-10-23 用户纠正后确立）----------
   未结算：收款、收退款详情、发票
   已结算：查看、打印、收退款详情、发票
   ★ 支付状态不参与判定：任何状态（含支付异常）都只能落在上面两档里，不设例外。
     原「支付异常行独占查看异常」是我自造的例外，已于 2026-10-23 删除。
   「收退款详情」取代原「查看退款」（后者是它的子集）
   「发票」每行都出：反结算行可能留有历史发票
   点击效果：收退款详情 / 查看 / 打印 暂做占位提示，待补 */
function rscActions(r){
  var ops = [];
  if (rscSettleState(r) === 'SETTLED') {
    /* 已结算：查看、打印 */
    ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="npToast(\'查看结算单（原型演示）\')">查看</a>');
    ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="npToast(\'打印结算单（原型演示）\')">打印</a>');
  } else {
    /* 未结算：收款（与门店渠道模式无关，直营/非直营都出）
       退款流程行（退款中/已退款/退款失败）也出「收款」——否则这些行点不开收款详情面板，
       面板底部的「本轮已结束/本轮不可收款/再次收款」永远看不到，成为死路 */
    ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="rscOpenPanel(' + r.idx + ')">收款</a>');
  }
  ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="rscOpenPayRefundDetail(' + r.idx + ')">收退款详情</a>');
  ops.push(rscInvoiceEntry(r));
  return npRenderActions(ops, 4);
}
/* 注：「收退款详情」弹框实现见下方 rscOpenPayRefundDetail（函数声明提升，可直接调用） */
function rscInvoiceButton(r){
  /* 收款详情面板底部的「发票」按钮：仅可开票 / 已开票时出（面板口径，不随列表规则变） */
  if (r.invoice === 'CREDITING' || r.invoice === 'CREDITED' || r.invoice === 'CREDIT_FAIL') return '';
  if (!rscCanInvoice(r) && r.invoice !== 'ISSUED') return '';
  return '<a href="javascript:void(0)" class="lt-btn-link" onclick="rscOpenInvoicePage(' + r.idx + ')">发票</a>';
}
/* 列表操作列的「发票」入口：每行都出（反结算行可能留有历史发票，可进去查看） */
function rscInvoiceEntry(r){
  return '<a href="javascript:void(0)" class="lt-btn-link" onclick="rscOpenInvoicePage(' + r.idx + ')">发票</a>';
}

/* ---------- 工具栏 ---------- */
function rscRefreshStatus(){
  NP['repair-settlement'].render();
  npToast('状态、结算状态和发票状态已刷新');
}
function rscExport(){
  var st = NP['repair-settlement'];
  var data = (st && st.filtered) ? st.filtered : [];
  if (!data.length) { npToast('当前没有可导出的数据'); return; }
  var headers = ['维修工单号','结算单号','门店','门店类型','车牌号','VIN码','服务顾问','提交结算日期',
    '工时应收','配件应收','应收总额','支付状态','结算状态','发票状态'];
  var rows = data.map(function(r){
    return [r.order, r.id, rscStoreShort(r.storeCode), rscStoreType(r), r.plate, r.vin, r.advisor, r.date,
      rscMoney(r.labor), rscMoney(r.part), rscMoney(r.total),
      RSC_LABELS.status[r.status], rscSettleLabel(r), rscInvoiceLabel(r)];
  });
  npExportExcelRowsRaw('维修结算收款清单', headers, rows);
}

/* ============================================================
   收款详情侧滑面板（pm-panel 范式）
   ============================================================ */
function rscEnsurePanel(){
  if (document.getElementById('rsc-panel-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML =
    '<div class="pm-panel-overlay" id="rsc-panel-overlay" onclick="rscClosePanel()"></div>' +
    '<div class="pm-panel" id="rsc-panel" style="width:1000px">' +
      '<div class="pm-panel-header">' +
        '<div style="display:flex;align-items:center">' +
          '<span class="pm-panel-title" id="rsc-panel-title">维修结算收款</span>' +
          '<span class="pm-panel-badge" id="rsc-panel-badge">详情</span>' +
        '</div>' +
        '<button class="pm-panel-close" onclick="rscClosePanel()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body">' +
        '<div class="pm-tip-warn" id="rsc-lock-tip"></div>' +
        '<div class="pm-section-title">结算单信息</div>' +
        '<div class="pso-info-grid" id="rsc-order-info"></div>' +
        '<div class="pm-section-title">折让项目 <span id="rsc-discount-toolbar" class="pp-parts-toolbar"></span></div>' +
        '<div style="overflow-x:auto;margin-bottom:8px">' +
          '<table class="pp-parts-table" id="rsc-discount-table">' +
            '<thead><tr>' +
              '<th style="width:40px">序号</th>' +
              '<th style="width:120px">折让项目</th>' +
              '<th style="width:100px">折让金额</th>' +
              '<th style="width:100px">工时折让</th>' +
              '<th style="width:100px">配件折让</th>' +
              '<th>备注</th>' +
              '<th style="width:70px">操作</th>' +
            '</tr></thead>' +
            '<tbody id="rsc-discount-tbody"></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="lt-form-item full" style="margin-bottom:16px"><span class="lt-form-label">推荐项目</span>' +
          '<textarea id="rsc-recommend" rows="2" readonly></textarea>' +
        '</div>' +
        '<div class="pm-section-title">金额账类 <span id="rsc-net-tip" style="float:right;font-weight:400;color:#333"></span></div>' +
        '<div style="overflow-x:auto;margin-bottom:8px">' +
          '<table class="lt-table" id="rsc-account-table">' +
            '<thead><tr>' +
              '<th style="width:110px">项目</th><th>用户</th><th>免保</th><th>保修</th><th>保险</th><th>内部</th><th>协议</th><th>合计</th>' +
            '</tr></thead>' +
            '<tbody id="rsc-account-tbody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="pm-panel-footer" id="rsc-panel-footer"></div>' +
    '</div>';
  while (d.firstChild) document.body.appendChild(d.firstChild);
}
function rscClosePanel(){
  var o = document.getElementById('rsc-panel-overlay');
  var p = document.getElementById('rsc-panel');
  if (o) o.classList.remove('show');
  if (p) p.classList.remove('show');
}
function rscGet(idx){
  var all = (NP['repair-settlement'] && NP['repair-settlement'].allData) || [];
  return npFindByIdx(all, idx);
}
/* 状态变更后：列表与面板同步（面板开着就原地重开） */
function rscRenderAfterChange(r){
  var st = NP['repair-settlement'];
  if (st) st.render();
  var p = document.getElementById('rsc-panel');
  if (p && p.classList.contains('show')) rscOpenPanel(r.idx);
}
/* 只读信息项（文字在框里，复用 .pso-info-grid / .pso-info-item 既有结构） */
function rscInfoItem(label, value){
  return '<div class="pso-info-item"><span class="pso-info-label">' + npEscape(label) + '</span>'
    + '<span class="pso-info-value">' + npEscape(value === undefined || value === null || value === '' ? '—' : value) + '</span></div>';
}
function rscOpenPanel(idx){
  rscEnsurePanel();
  var r = rscGet(idx);
  if (!r) { npToast('未找到该结算单'); return; }
  window.__rscCur = r;
  document.getElementById('rsc-panel-title').textContent = '维修结算收款';
  var badge = document.getElementById('rsc-panel-badge');
  badge.textContent = RSC_LABELS.status[r.status];
  badge.className = 'pm-panel-badge ' + (r.status === 'PAID' ? 'pass' : (r.status === 'EXCEPTION' || r.status === 'REFUND_FAIL' ? 'reject' : ''));

  /* 封存条文案（照搬 920 setMode 的 lockTitle / lockText） */
  document.getElementById('rsc-lock-tip').innerHTML =
    '<b>' + npEscape(rscLockTitle(r)) + '</b><br>' + npEscape(rscLockText(r));

  var store = rscStore(r.storeCode);
  document.getElementById('rsc-order-info').innerHTML =
    rscInfoItem('维修工单号', r.order) +
    rscInfoItem('结算单号', r.id) +
    rscInfoItem('车牌号', r.plate) +
    rscInfoItem('VIN', r.vin) +
    rscInfoItem('服务顾问', r.advisor) +
    rscInfoItem('门店', store ? store.name : '—') +
    rscInfoItem('门店编码', r.storeCode) +
    rscInfoItem('渠道模式', store ? store.channelMode : '—') +
    rscInfoItem('纳税人识别号', store && store.taxNo ? store.taxNo : '—') +
    rscInfoItem('支付商户号', rscMerchantNo(r)) +
    rscInfoItem('结算状态', rscSettleLabel(r)) +
    rscInfoItem('提交结算日期', r.date);

  /* 折让项目：仅「未支付」可增删，其余状态只读 */
  var canEditDiscount = (r.status === 'UNPAID');
  document.getElementById('rsc-discount-toolbar').innerHTML = canEditDiscount
    ? '<button class="lt-btn lt-btn-default" onclick="rscAddDiscount()">新增折让</button>' : '';
  rscRenderDiscounts(r);

  var rec = document.getElementById('rsc-recommend');
  rec.value = r.recommend || '';

  /* 金额账类：应收 / 实收 / 差额 */
  var total = rscNum(r.total), net = rscNet(r), diff = total - net;
  var zero = '<span style="color:#999">¥ 0.00</span>';
  var moneyTd = function(v){ return '<span style="color:#185FA5">¥ ' + v.toFixed(2) + '</span>'; };
  document.getElementById('rsc-net-tip').textContent = '实际收款金额 ¥' + rscMoney(net);
  document.getElementById('rsc-account-tbody').innerHTML =
    '<tr><td><b>应收金额</b></td><td>' + moneyTd(total) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(total) + '</td></tr>' +
    '<tr><td><b>实收金额</b></td><td>' + moneyTd(net) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(net) + '</td></tr>' +
    '<tr><td><b>差额</b></td><td>' + moneyTd(diff) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(diff) + '</td></tr>';

  /* 底部条（照搬 920 payment-bar） */
  document.getElementById('rsc-panel-footer').innerHTML =
    '<div class="pp-panel-totals" style="margin-right:auto;text-align:left">'
    + '总金额 <b>¥' + rscMoney(total) + '</b> · 总折让额 <b>¥' + rscMoney(rscDiscountTotal(r)) + '</b> · 待在线支付 <b>¥' + rscMoney(net) + '</b>'
    + '</div>' + rscFooterButtons(r);

  document.getElementById('rsc-panel-overlay').classList.add('show');
  document.getElementById('rsc-panel').classList.add('show');
}
function rscMerchantNo(r){
  var s = rscStore(r.storeCode);
  if (!s) return '—';
  return 'MER-YJ-' + s.code;
}
function rscLockTitle(r){
  if (r.settlement === 'REVERSED' || r.status === 'REFUNDED') return '本轮支付与优惠保持归档';
  if (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL') return RSC_LABELS.status[r.status];
  if (r.status === 'EXCEPTION') return '支付结果待核对';
  if (r.status === 'PAYING') return '当前页面已封存';
  if (r.status === 'PAID_PENDING_COLLECTION') return '已收到支付成功回调';
  if (r.status === 'PAID') return '服务中心已写入结算单';
  return '当前页面已封存';
}
function rscLockText(r){
  if (r.settlement === 'REVERSED' || r.status === 'REFUNDED') {
    return r.refundRoute === 'BEFORE_COLLECTION'
      ? '退款已完成，可点击【再次收款】开始新一轮支付。'
      : '反结算、发票红冲和退款均已完成，可点击【再次收款】开始新一轮支付。';
  }
  if (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL') return '请核对本次退款结果，当前不可收款或再次支付。';
  if (r.status === 'EXCEPTION') return '请联系财务核对原支付单，当前不可修改金额、再次支付或确认收款。';
  if (r.status === 'PAYING') return '支付二维码已绑定本轮金额快照，折让、优惠券和应收金额不可修改。';
  if (r.status === 'PAID_PENDING_COLLECTION') return '金额快照继续封存，可选择【收款】完成结算，或选择【退款】原路退回。';
  if (r.status === 'PAID') return '收款、折让、优惠券和支付信息已归档，页面保持只读，可在详情或列表发起开票。';
  return '支付二维码已绑定当前金额版本，折让、优惠券和应收金额暂不可修改。';
}
function rscFooterButtons(r){
  var btns = [];
  if (r.settlement === 'REVERSED' || r.status === 'REFUNDED') {
    btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'本轮已结束\')">本轮已结束</button>');
    btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'本轮不可收款\')">本轮不可收款</button>');
    btns.push('<button class="lt-btn lt-btn-default" onclick="rscNewCycle(' + r.idx + ')">再次收款</button>');
  } else if (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL') {
    btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'本轮已支付\')">本轮已支付</button>');
    btns.push('<button class="lt-btn lt-btn-default" onclick="rscOpenRefund(' + r.idx + ')">' + (r.status === 'REFUND_FAIL' ? '退款待核对' : '退款中') + '</button>');
  } else {
    /* 在线支付：与门店渠道模式无关，直营/非直营都显示（用户已拍板）
       ★ 支付异常行不出「在线支付」：该状态下 rscOpenOnlinePay 的守卫必拦（当前状态不可在线支付），
         且与同一面板封存条「当前不可修改金额、再次支付或确认收款」自相矛盾，
         按用户「不能操作的按钮不显示」口径处理（2026-10-23） */
    if (r.status !== 'EXCEPTION') {
      var payText = '在线支付', payDisabled = '';
      if (r.status === 'PAYING') payText = '查看支付二维码';
      else if (r.status === 'PAID_PENDING_COLLECTION' || r.status === 'PAID') { payText = '已支付'; payDisabled = ' disabled'; }
      else if (rscNet(r) <= 0) payDisabled = ' disabled';
      btns.push('<button class="lt-btn lt-btn-primary"' + payDisabled + ' onclick="rscOpenOnlinePay(' + r.idx + ')">' + payText + '</button>');
    }

    var collectText = '收款', collectDisabled = ' disabled';
    if (r.status === 'PAID_PENDING_COLLECTION') collectDisabled = '';
    else if (r.status === 'PAID') collectText = '已收款';
    btns.push('<button class="lt-btn lt-btn-default"' + collectDisabled + ' onclick="rscOpenCollection(' + r.idx + ')">' + collectText + '</button>');
  }
  if (rscInvoiceButton(r)) btns.push('<button class="lt-btn lt-btn-default" onclick="rscOpenInvoicePage(' + r.idx + ')">发票</button>');
  btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'打印结算单功能演示\')">打印结算单</button>');
  btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'打印出门证功能演示\')">打印出门证</button>');
  return btns.join('');
}
function rscRenderDiscounts(r){
  var list = r.discounts || [];
  var lock = (r.status !== 'UNPAID');
  var html = list.map(function(d, i){
    return '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td>' + npEscape(d.type) + '</td>' +
      '<td><input type="text" value="' + npEscape(rscMoney(d.amount)) + '" readonly></td>' +
      '<td><input type="text" value="' + npEscape(rscMoney(d.labor)) + '" readonly></td>' +
      '<td><input type="text" value="' + npEscape(rscMoney(d.part)) + '" readonly></td>' +
      '<td>' + (d.remark ? npEscape(d.remark) : '—') + '</td>' +
      '<td>' + (lock ? '—' : '<a href="javascript:void(0)" class="lt-link np-red" onclick="rscDeleteDiscount(' + r.idx + ',' + i + ')">删除</a>') + '</td>' +
    '</tr>';
  }).join('');
  if (!list.length) html = '<tr><td colspan="7" style="text-align:center;color:#999;padding:14px;">暂无折让项目</td></tr>';
  document.getElementById('rsc-discount-tbody').innerHTML = html;
}
function rscAddDiscount(){
  var r = window.__rscCur; if (!r) return;
  if (!r.discounts) r.discounts = [];
  r.discounts.push({ type:'按商务政策', amount:'0.00', labor:'0.00', part:'0.00', remark:'' });
  rscRenderDiscounts(r);
  npToast('已新增一行折让项目');
}
function rscDeleteDiscount(idx, di){
  var r = rscGet(idx); if (!r) return;
  if (!r.discounts || !r.discounts[di]) return;
  r.discounts.splice(di, 1);
  rscRenderDiscounts(r);
}
function rscNewCycle(idx){
  var r = rscGet(idx); if (!r) return;
  npToast('再次收款：新一轮支付需从「未支付」重新发起（原型演示）');
}

/* ---------- 弹框：在线支付 ---------- */
function rscOpenOnlinePay(idx){
  var r = rscGet(idx); if (!r) return;
  if (r.status !== 'UNPAID' && r.status !== 'PAYING') { npToast('当前状态不可在线支付'); return; }
  var net = rscNet(r);
  if (net <= 0) { npToast('线上实付现金须大于0；当前没有待在线支付金额'); return; }
  var payNo = r.payOrderNo || ('YJ_WXSK_' + r.order + '01');
  var body =
    '<div class="pso-info-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      rscInfoItem('优惠后实际收款', '¥' + rscMoney(net)) +
      rscInfoItem('支付单号', payNo) +
    '</div>' +
    '<div class="pm-tip-warn" style="margin-top:0">请使用微信扫码支付。默认 5 分钟（可配置，最长 120 分钟），剩余 <b>005:00</b>。关闭弹窗不会解除页面封存。</div>';
  npOpenModal('在线支付', body,
    '<button class="lt-btn lt-btn-default" onclick="rscPayExpire(' + idx + ')">支付关闭</button>' +
    '<button class="lt-btn lt-btn-default" onclick="rscPayUnknown()">结果待确认</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="rscPaySuccess(' + idx + ')">支付成功</button>',
    {width:720});
}
function rscPayExpire(idx){
  var r = rscGet(idx); if (!r) return;
  r.status = 'UNPAID';
  npCloseModal(); rscRenderAfterChange(r);
  npToast('二维码已失效，支付中心确认未支付后已解除封存');
}
function rscPayUnknown(){ npToast('支付结果未知，保持封存；核对原支付单，不能重付或解除封存。'); }
function rscPaySuccess(idx){
  var r = rscGet(idx); if (!r) return;
  if (r.status !== 'PAYING' && r.status !== 'UNPAID') { npToast('当前状态不可支付'); return; }
  r.status = 'PAID_PENDING_COLLECTION';
  npCloseModal(); rscOpenPanel(idx);
  npToast('支付已到账，请点击【收款】完成结算确认');
}

/* ---------- 弹框：确认收款 ---------- */
function rscOpenCollection(idx){
  var r = rscGet(idx); if (!r) return;
  if (r.status !== 'PAID_PENDING_COLLECTION') { npToast('当前状态不可收款'); return; }
  var body =
    '<div class="pso-info-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      rscInfoItem('支付已到账', '¥' + rscMoney(rscNet(r))) +
      rscInfoItem('本次折让及优惠合计', '¥' + rscMoney(rscDiscountTotal(r))) +
      rscInfoItem('结算单号', r.id) +
      rscInfoItem('结算单状态', rscSettleLabel(r)) +
    '</div>' +
    '<div class="pm-tip-warn" style="margin-top:0">请确认支付金额和结算单信息无误。</div>';
  npOpenModal('确认收款', body,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="rscConfirmCollection(' + idx + ')">确认收款</button>',
    {width:720});
}
function rscConfirmCollection(idx){
  var r = rscGet(idx); if (!r) return;
  if (r.status !== 'PAID_PENDING_COLLECTION') { npCloseModal(); npToast('状态已变化，请刷新后重试'); return; }
  r.status = 'PAID'; r.settlement = 'SETTLED';
  npCloseModal(); rscOpenPanel(idx);
  npToast('收款已保存，可开票');
}

/* ---------- 弹框：收退款详情 ----------
   用户口径（2026-10-21）：
   1 顶部信息区 4 格顺序＝维修工单号、结算单号、已收款金额、已退款金额
   2 表格去掉「票据号」列
   3 收退款渠道＝门店自行 / 支付二维码 / 用户App
     收退款方式＝微信 / 支付宝 / 银行卡 / 现金 / 挂账
     渠道与方式联动：门店自行 → 微信、支付宝、银行卡、现金、挂账（全量）
                     支付二维码 → 只有微信、支付宝
                     用户App   → 只有微信、支付宝 */
var RSC_PAY_CHANNELS = ['门店自行', '支付二维码', '用户App'];
var RSC_PAY_METHODS_ALL = ['微信', '支付宝', '银行卡', '现金', '挂账'];
var RSC_PAY_METHODS_BY_CHANNEL = {
  '门店自行': ['微信', '支付宝', '银行卡', '现金', '挂账'],
  '支付二维码': ['微信', '支付宝'],
  '用户App': ['微信', '支付宝']
};
/* 按渠道取可用收退款方式（渠道→方式联动口径的唯一来源） */
function rscPayMethodsOf(channel){
  return RSC_PAY_METHODS_BY_CHANNEL[channel] || [];
}
/* 渠道切换 → 方式下拉重画（仅保留该渠道允许的方式） */
function rscPayChannelChange(channel, selId){
  var sel = document.getElementById(selId);
  if (!sel) return;
  var opts = rscPayMethodsOf(channel);
  sel.innerHTML = '<option value="">请选择</option>'
    + opts.map(function(m){ return '<option value="' + npEscape(m) + '">' + npEscape(m) + '</option>'; }).join('');
}
/* 收退款流水每笔的支付状态（用户 2026-10-22 口径：成功 / 失败 / 待支付 / 支付超时 / 支付失败）
   收款行用：成功、待支付、支付超时、支付失败；退款行用：成功、失败（退款失败，无"支付超时/待支付"） */
var RSC_PAY_STATE = {
  OK:'成功', FAIL:'失败', WAIT:'待支付', TIMEOUT:'支付超时', PAY_FAIL:'支付失败'
};
/* lt-badge 只有 ok/off/warn 三个修饰类，按语义收敛（不自造类） */
var RSC_PAY_STATE_BADGE = {
  OK:'ok', FAIL:'off', WAIT:'warn', TIMEOUT:'off', PAY_FAIL:'off'
};
/* 支付状态标签（复用全站 .lt-badge 三档修饰类，不自造样式） */
function rscPayStateBadge(state){
  var label = RSC_PAY_STATE[state] || '';
  return '<span class="lt-badge ' + (RSC_PAY_STATE_BADGE[state] || 'warn') + '">' + npEscape(label) + '</span>';
}
/* 收退款流水示例数据：挂在结算单上 r.payRecords（payState＝支付状态，见RSC_PAY_STATE） */
function rscPayRecords(r){
  return r.payRecords || [];
}
/* 明细行按时间倒序（最新在上）；时间格式固定 YYYY-MM-DD HH:mm，字符串比较即可，
   同秒再按原顺序稳定（Array.prototype.sort 在各引擎均为稳定排序） */
function rscPayRecordsByTimeDesc(r){
  return rscPayRecords(r).slice().sort(function(a, b){
    return (b.time || '').localeCompare(a.time || '');
  });
}
/* 已收/已退款金额只累计「支付状态＝成功」的流水；待支付、支付超时、支付失败、失败均不计入 */
function rscPayIsOk(x){
  return x.payState === 'OK';
}
function rscOpenPayRefundDetail(idx){
  var r = rscGet(idx); if (!r) return;
  var recs = rscPayRecordsByTimeDesc(r);
  var received = 0, refunded = 0;
  recs.forEach(function(x){
    if (!rscPayIsOk(x)) return;
    if (x.type === '退款') refunded += rscNum(x.amount); else received += rscNum(x.amount);
  });
  /* 顶部信息区：维修工单号、结算单号、已收款金额、已退款金额（4 格一行，只读框内标签） */
  var head =
    '<div class="lt-filter-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));">' +
      npFItem('维修工单号', '<input type="text" readonly value="' + npEscape(r.order) + '">') +
      npFItem('结算单号', '<input type="text" readonly value="' + npEscape(r.id) + '">') +
      npFItem('已收款金额', '<input type="text" readonly value="' + rscMoney(received) + '">') +
      npFItem('已退款金额', '<input type="text" readonly value="' + rscMoney(refunded) + '">') +
    '</div>';
  /* 明细表：序号、收款/退款、收退款渠道、收退款方式、支付状态、金额、时间 */
  var cols = [
    {t:'序号', w:60}, {t:'收款/退款', w:90}, {t:'收退款渠道', w:110}, {t:'收退款方式', w:100},
    {t:'支付状态', w:110}, {t:'金额', w:110}, {t:'时间', w:170}
  ];
  var rows = recs.length ? recs.map(function(x, i){
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + npEscape(x.type) + '</td>'
      + '<td>' + npEscape(x.channel) + '</td>'
      + '<td>' + npEscape(x.method) + '</td>'
      + '<td>' + rscPayStateBadge(x.payState) + '</td>'
      + '<td>' + npEscape(rscMoney(x.amount)) + '</td>'
      + '<td>' + npEscape(x.time) + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#999;padding:20px">暂无收退款记录</td></tr>';
  var body = head
    + '<div class="lt-table-wrap" style="box-shadow:none;margin-top:12px">'
    + '<table class="lt-table"><thead><tr>' + npTH(cols) + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  npOpenModal('收退款详情', body, '', {width:1040});
}
/* ---------- 弹框：查看退款 / 查看异常 ---------- */
function rscRefundSteps(r){
  var before = r.refundRoute === 'BEFORE_COLLECTION';
  var labels = before ? ['发起退款','退款完成']
    : ['反结算', r.refundHadInvoice ? '红冲发票' : '无票跳过红冲', '发起退款', '退款完成'];
  var done = (r.status === 'REFUNDED') ? labels.length : labels.length - 1;
  return labels.map(function(t, i){
    return '<span style="display:inline-block;margin-right:16px;color:' + (i < done ? '#185FA5' : '#999') + '">'
      + (i < done ? '✓ ' : (i+1) + '. ') + npEscape(t) + '</span>';
  }).join('');
}
function rscOpenRefund(idx){
  var r = rscGet(idx); if (!r) return;
  if (!rscInRefund(r)) { npToast('当前状态不可查看退款'); return; }
  var body =
    '<div class="pso-info-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      rscInfoItem('结算单号', r.id) +
      rscInfoItem('门店', (rscStore(r.storeCode) || {}).name) +
      rscInfoItem('车辆', r.plate + ' / ' + r.vin.slice(0, 8) + '****') +
      rscInfoItem('退款状态', RSC_LABELS.status[r.status]) +
      rscInfoItem('退款原因', r.refundReason) +
      rscInfoItem('退款单号', r.refundRequestNo) +
      rscInfoItem('退款金额', '¥' + rscMoney(rscNet(r))) +
      rscInfoItem('结算状态', rscSettleLabel(r)) +
    '</div>' +
    '<div class="pm-section-title">退款流程</div><div style="font-size:13px;margin-bottom:12px">' + rscRefundSteps(r) + '</div>' +
    (r.refundRoute === 'BEFORE_COLLECTION'
      ? '<div class="pm-tip-warn" style="margin-top:0">本单收款前发起退款，退款成功后不反结算、不红冲发票。</div>'
      : '<div class="pm-tip-warn" style="margin-top:0">本单收款后发起退款，系统已依次反结算'
        + (r.refundHadInvoice ? '、红冲已开具发票' : '（无票跳过红冲）') + '并发起原路退款。</div>');
  var pending = (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL');
  npOpenModal('退款详情', body,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>' +
    (pending ? '<button class="lt-btn lt-btn-default" onclick="rscRefundResult(' + idx + ',0)">退款失败</button>' +
               '<button class="lt-btn lt-btn-primary" onclick="rscRefundResult(' + idx + ',1)">退款成功</button>' : ''),
    {width:780});
}
function rscRefundResult(idx, ok){
  var r = rscGet(idx); if (!r) return;
  if (!rscInRefund(r) || r.status === 'REFUNDED') { npCloseModal(); npToast('状态已变化，请关闭后刷新'); return; }
  r.status = ok ? 'REFUNDED' : 'REFUND_FAIL';
  npCloseModal(); rscRenderAfterChange(r);
  rscOpenRefund(idx);
}
/* ★ 2026-10-23：「查看异常」已从列表操作列移除（操作列只按工单结算状态分两档，用户口径），
   本弹框当前无任何页面入口（rscOpenException 全站仅此定义、无调用）。
   保留定义不删的理由：弹框内容（结算单号/门店/车辆/结算状态/应收可退金额/支付单号）是现成的，
   后续若要从收款详情面板或收退款详情复用可直接接；是否彻底清除待用户定。 */
function rscOpenException(idx){
  var r = rscGet(idx); if (!r) return;
  var body =
    '<div class="pso-info-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      rscInfoItem('结算单号', r.id) +
      rscInfoItem('门店', (rscStore(r.storeCode) || {}).name) +
      rscInfoItem('车辆', r.plate + ' / ' + r.vin.slice(0, 8) + '****') +
      rscInfoItem('结算状态', rscSettleLabel(r)) +
      rscInfoItem('应收/可退金额', '¥' + rscMoney(r.total)) +
      rscInfoItem('支付单号', r.payOrderNo) +
    '</div>' +
    '<div class="pm-tip-warn" style="margin-top:0">金额或门店信息待核对，支付及开票入口已关闭。请联系财务人员处理。</div>';
  npOpenModal('支付异常', body,
    '<button class="lt-btn lt-btn-primary" onclick="npCloseModal()">知道了</button>', {width:720});
}

/* ---------- 发票整页（psi 范式：顶部信息区 + 卡片列表 + 底部通栏申请开票） ---------- */

/* 发票记录：挂在结算单上（r.invoices），未挂时按发票状态派生一张
   2026-10-21：新增申请来源 source（App / DMS）、发票类型 invType + 对应抬头
   source 示例数据混合分布（按用户拍板，不按渠道模式区分） */
function rscInvoices(r){
  if (r.invoices && r.invoices.length) return r.invoices;
  var list = [];
  var net = rscNet(r);
  /* 已开票 */
  if (r.invoice === 'ISSUED' || r.invoice === 'CREDITING' || r.invoice === 'CREDITED' || r.invoice === 'CREDIT_FAIL'){
    list.push({
      state: r.invoice === 'ISSUED' ? '开票成功'
        : (r.invoice === 'CREDITING' ? '作废冲红中'
          : (r.invoice === 'CREDIT_FAIL' ? '作废失败' : '已冲红')),
      invType: '001数电专用发票',
      invoiceNo: r.invoiceNo || rscHash32(),
      applyNo: rscHash32(),
      applyTime: (r.invoiceDate || r.date || '').slice(0, 16),
      source: 'DMS',
      amount: rscMoney(net),
      buyer: rscInvoiceBuyer(r),
      title: '',
      redReason: r.invoice === 'CREDITED' ? '维修项目取消，已红冲' : '',
      failReason: r.invoice === 'CREDIT_FAIL' ? (r.failReason || '冲红请求提交失败，发票平台未确认，请重新发起作废冲红') : ''
    });
  }
  /* 开票中 / 开票失败 */
  if (r.invoice === 'PROCESSING' || r.invoice === 'FAILED'){
    list.push({
      state: r.invoice === 'FAILED' ? '开票失败' : '开票中',
      invType: '002数电普通发票',
      invoiceNo: '',
      applyNo: rscHash32(),
      applyTime: r.date,
      source: 'App',
      amount: rscMoney(net),
      buyer: null,
      title: rscFeeObjectName(r),
      failReason: r.invoice === 'FAILED' ? (r.failReason || '开票平台返回：购买方信息校验未通过，请核对后重新申请开票') : ''
    });
  }
  return list;
}
/* 001 数电专用发票的购买方 6 项（购买方名称 = 门店名，其余取结算单示例值） */
function rscInvoiceBuyer(r){
  var s = rscStore(r.storeCode);
  return {
    name: s ? s.name : '',
    tax: (s && s.taxNo) ? s.taxNo : '',
    addr: '武汉市江汉区建设大道 568 号',
    tel: '027-85580000',
    bank: '中国工商银行武汉江汉支行',
    account: '1001 2345 6789 0456'
  };
}
/* 收费对象：客户姓名(客户ID)，取报修人 + 车主主数据编号（对齐配件销售口径） */
function rscFeeObjectText(r){
  var name = r.reporter || '—';
  var own = (window.CAR_OWNERS || []).filter(function(o){ return o.name === name; })[0];
  var code = own ? own.code : ('KH' + (9001 + r.idx));
  return name + '(' + code + ')';
}
/* 收费对象姓名（不含客户ID）—— 申请开票的「客户名称」用这个 */
function rscFeeObjectName(r){
  return r.reporter || '—';
}
/* 门店纳税识别号：直营取门店主数据税号，非直营留空 */
function rscStoreTaxText(r){
  var s = rscStore(r.storeCode);
  if (!s) return '';
  return s.channelMode === '直营' ? (s.taxNo || '') : '';
}
/* 顶部信息区数据（9 项，3 列 × 3 行） */
function rscInvTopInfo(r){
  var received = rscNet(r);
  var refunded = rscInRefund(r) && r.refundRoute === 'AFTER_COLLECTION' ? received : 0;
  var invoiced = 0;
  rscInvoices(r).forEach(function(iv){
    var amt = iv.amount ? rscNum(iv.amount) : received;
    if (iv.state === '开票成功' || iv.state === '开票中' || iv.state === '作废冲红中' || iv.state === '作废失败') invoiced += amt;
    if (iv.state === '已冲红') invoiced -= amt;
  });
  invoiced = Math.max(0, invoiced);
  return {
    received: received, refunded: refunded, invoiced: invoiced,
    payable: rscNum(r.total) - rscDiscountTotal(r)
  };
}
/* 顶部信息区一行（3 格，与配件销售 psi-info-row 同构） */
function rscInvInfoLine(pairs){
  var cells = pairs.map(function(p){
    var val = (p[1] === undefined || p[1] === null) ? '' : p[1];
    return '<span class="psi-info-cell"><span class="psi-info-k">' + npEscape(p[0]) + '：</span>'
      + '<span class="psi-info-v' + (p[2] ? ' money' : '') + '">' + npEscape(val) + '</span></span>';
  });
  return '<div class="psi-info-row">' + cells.join('') + '</div>';
}
function rscInvTopInfoHtml(r){
  var s = rscStore(r.storeCode);
  var t = rscInvTopInfo(r);
  return '<div class="psi-info">'
    + rscInvInfoLine([
        ['门店', rscStoreShort(r.storeCode) + '(' + r.storeCode + ')'],
        ['门店纳税识别号', rscStoreTaxText(r)],
        ['收费对象', rscFeeObjectText(r)]
      ])
    + rscInvInfoLine([
        ['维修工单号', r.order],
        ['结算单号', r.id],
        ['用户自费金额', rscMoney(t.payable), true]
      ])
    + rscInvInfoLine([
        ['已收金额', rscMoney(t.received), true],
        ['已退金额', rscMoney(t.refunded), true],
        ['发票已开金额', rscMoney(t.invoiced), true]
      ])
    + '</div>';
}
/* 发票类型 + 该类型下开票申请时填的内容
   用户口径：「001数电专用发票」本身就是标签（带冒号），冒号后面才是内容；
   内容 = 001 的购买方名称/纳税人识别号/地址/电话/开户行/账号，或 002 的客户名称。
   内容之间逗号分隔挤一行，且不带任何子标签；空值不占位（过滤掉，避免「，，」） */
function rscInvTypeLine(iv){
  var vals = [];
  if (iv.invType === '001数电专用发票'){
    var b = iv.buyer || {};
    vals = [b.name, b.tax, b.addr, b.tel, b.bank, b.account];
  } else {
    vals = [iv.title];
  }
  var txt = vals.filter(function(v){
    return v !== undefined && v !== null && String(v) !== '';
  }).join('，');
  return (iv.invType || '') + '：' + txt;
}
/* 发票整页渲染 */
function rsiRenderInvoicePage(){
  var root = document.getElementById('page-repair-settlement-invoice');
  if (!root) return;
  var r = rsiCurSettle();
  if (!r) { root.innerHTML = '<div class="psi-page">未找到该结算单</div>'; return; }

  var isDirect = rscStoreType(r) === '直营店';
  var list = rscInvoices(r);
  var cards = '';
  for (var i = 0; i < list.length; i++){
    var iv = list[i];

    /* 卡片左侧：每项单独一行。申请来源并入「开票申请编号」一行；发票类型 + 抬头单独一行 */
    var left = '';
    if (iv.invoiceNo) left += '<div class="psi-inv-line"><span class="psi-inv-k">发票号：</span>' + npEscape(iv.invoiceNo) + '</div>';
    left += '<div class="psi-inv-line"><span class="psi-inv-k">申请时间：</span>' + npEscape(iv.applyTime) + '</div>';
    left += '<div class="psi-inv-line"><span class="psi-inv-k">开票申请编号：</span>' + npEscape(iv.applyNo)
      + '，来源：' + npEscape(iv.source || '') + '</div>';
    left += '<div class="psi-inv-line">' + npEscape(rscInvTypeLine(iv)) + '</div>';
    /* 失败原因：开票失败 / 作废失败 —— 左侧卡片最后一行，红色字体 */
    if (iv.state === '开票失败' && iv.failReason){
      left += '<div class="psi-inv-line psi-inv-reason">开票失败原因：' + npEscape(iv.failReason) + '</div>';
    } else if (iv.state === '作废失败' && iv.failReason){
      left += '<div class="psi-inv-line psi-inv-reason">作废失败原因：' + npEscape(iv.failReason) + '</div>';
    }

    /* 卡片右上：状态标签（复用全站 .lt-badge）+ 右侧按钮 */
    var badge = '', right = '';
    right += '<button class="lt-btn lt-btn-default" onclick="rsiCopyInvoiceInfo(' + i + ')">复制开票信息</button>';
    if (iv.state === '开票中') {
      badge = '<span class="lt-badge warn">开票中</span>';
    } else if (iv.state === '开票成功') {
      badge = '<span class="lt-badge ok">开票成功</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsiDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
      right += '<button class="lt-btn lt-btn-primary" onclick="rsiVoidInvoice(' + i + ')">作废冲红</button>';
    } else if (iv.state === '作废冲红中') {
      badge = '<span class="lt-badge warn">作废冲红中</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsiDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
    } else if (iv.state === '已冲红') {
      badge = '<span class="lt-badge off">已冲红</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsiDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
    } else if (iv.state === '开票失败') {
      /* 开票失败：右侧只有「复制开票信息」（重新发起开票用），不出下载发票/作废冲红 */
      badge = '<span class="lt-badge off">开票失败</span>';
    } else if (iv.state === '作废失败') {
      /* 作废失败：发票仍有效，可下载、可再次发起作废冲红 */
      badge = '<span class="lt-badge off">作废失败</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsiDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
      right += '<button class="lt-btn lt-btn-primary" onclick="rsiVoidInvoice(' + i + ')">作废冲红</button>';
    } else {
      badge = '<span class="lt-badge off">' + npEscape(iv.state) + '</span>';
    }
    /* 上传发票：仅非直营门店，与其它操作按钮同排同款（用户口径：按钮旁多一个按钮，不要提示文字） */
    if (!isDirect && (iv.state === '开票中' || iv.state === '作废冲红中')){
      right += '<button class="lt-btn lt-btn-default" onclick="rsiUploadInvoice()">上传发票</button>';
    }
    /* 标记失败：仅非直营门店 —— 开票中 → 开票失败；作废冲红中 → 作废失败
       （直营由总部统一开票，门店不自行标失败） */
    if (!isDirect && iv.state === '开票中'){
      right += '<button class="lt-btn lt-btn-default" onclick="rsiOpenFailPanel(' + i + ')">开票失败</button>';
    }
    if (!isDirect && iv.state === '作废冲红中'){
      right += '<button class="lt-btn lt-btn-default" onclick="rsiOpenFailPanel(' + i + ')">作废失败</button>';
    }

    var reasonLine = (iv.state === '已冲红' && iv.redReason)
      ? '<div class="psi-inv-reason">作废冲红原因：' + npEscape(iv.redReason) + '</div>' : '';

    cards += '<div class="psi-inv-card"><div class="psi-inv-body">'
      + '<div class="psi-inv-info">' + left + '</div>'
      + '<div class="psi-inv-side"><div class="psi-inv-badge">' + badge + '</div>'
      + '<div class="psi-inv-ops">' + right + '</div></div>'
      + '</div>' + reasonLine + '</div>';
  }

  root.innerHTML =
    '<div class="psi-page">'
    + '<div class="psi-page-head">'
      + '<button class="psi-back" onclick="rsiBackToList()" title="返回">&#10094;</button>'
      + '<span class="psi-page-title">发票</span>'
    + '</div>'
    + rscInvTopInfoHtml(r)
    + '<div class="psi-inv-list">' + (cards || '<div class="psi-inv-empty">暂无发票记录</div>') + '</div>'
    + '<div class="psi-page-foot"><button class="psi-full-btn" onclick="rsiOpenApplyPanel()">+申请开票</button></div>'
    + '</div>';
}
/* 当前结算单（从列表行 / 详情面板跳进来时带上 idx） */
function rsiCurSettle(){
  var idx = window.__RSC_INVOICE_IDX;
  if (idx === undefined || idx === null) return null;
  return rscGet(idx);
}
/* 从列表行 / 详情面板进入发票整页 */
function rscOpenInvoicePage(idx){
  window.__RSC_INVOICE_IDX = idx;
  rscClosePanel();
  showContent('repair-settlement-invoice');
}
/* 返回：统一回「维修结算收款」列表 */
function rsiBackToList(){
  window.__RSC_INVOICE_IDX = undefined;
  showContent('repair-settlement');
}
/* 复制开票信息：跳申请开票侧滑面板，并按被点的这张发票类型带出抬头 */
function rsiCopyInvoiceInfo(i){
  var r = rsiCurSettle(); if (!r) return;
  var iv = rscInvoices(r)[i];
  if (!iv) { npToast('未找到该发票记录'); return; }
  window.__RSC_PREFILL = {
    type: iv.invType,
    buyer: iv.invType === '001数电专用发票' ? iv.buyer : null,
    title: iv.invType === '001数电专用发票' ? '' : (iv.title || rscFeeObjectName(r))
  };
  rsiOpenApplyPanel();
}
/* 下载发票：已冲红状态下下载的是冲红的那张发票 */
function rsiDownloadInvoice(state){
  npToast(state === '已冲红'
    ? '发票下载（演示）：下载冲红发票文件'
    : '发票下载（演示）：文件流待对接集团电子发票平台后开放');
}
/* 上传发票（复用全站 .np-upload / .np-hint，写法同「配件退货索赔」） */
function rsiUploadInvoice(){
  npToast('上传文件（演示）');
}
/* ---------- 标记失败弹框：开票中 → 开票失败 / 作废冲红中 → 作废失败 ----------
   用户 2026-10-22 口径：非直营门店的卡片点「开票失败」「作废失败」→ 弹框填失败原因 → 提交后才变成失败态。
   原因必填、≤50 字（与「退货原因」≤20 字同一套校验写法：提交时判空 + 判长）。 */
var RSC_FAIL_REASON_MAX = 50;
function rsiOpenFailPanel(i){
  var r = rsiCurSettle(); if (!r) { npToast('请先从结算单进入发票页'); return; }
  var iv = rscInvoices(r)[i];
  if (!iv) { npToast('未找到该发票记录'); return; }
  if (iv.state !== '开票中' && iv.state !== '作废冲红中') { npToast('仅开票中、作废冲红中的发票可标记失败'); return; }
  var isDirect = rscStoreType(r) === '直营店';
  if (isDirect) { npToast('直营门店不支持标记失败'); return; }
  var title = (iv.state === '开票中') ? '开票失败' : '作废失败';
  var body =
    '<div class="lt-input-wrap plain required" style="margin-bottom:10px"><span class="lt-filter-prefix required">' + title + '原因</span>' +
      '<input type="text" id="rsi-fail-reason" maxlength="' + RSC_FAIL_REASON_MAX + '" placeholder="请输入' + title + '原因（≤' + RSC_FAIL_REASON_MAX + '字）"></div>';
  var footer =
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="rsiSubmitFail(' + i + ')">提交</button>';
  npOpenModal(title + ' - ' + r.id, body, footer, { width: 560 });
}
/* 提交失败原因 → 卡片转失败态、左侧末行红字显示原因 */
function rsiSubmitFail(i){
  var r = rsiCurSettle(); if (!r) return;
  var iv = rscInvoices(r)[i];
  if (!iv) { npCloseModal(); npToast('未找到该发票记录'); return; }
  if (iv.state !== '开票中' && iv.state !== '作废冲红中') { npCloseModal(); npToast('该发票状态已变化，请重新操作'); return; }
  var el = document.getElementById('rsi-fail-reason');
  var reason = el ? el.value.trim() : '';
  if (!reason) { npToast('请填写失败原因'); return; }
  if (reason.length > RSC_FAIL_REASON_MAX) { npToast('失败原因不能超过 ' + RSC_FAIL_REASON_MAX + ' 字'); return; }
  iv.state = (iv.state === '开票中') ? '开票失败' : '作废失败';
  iv.failReason = reason;
  /* 派生卡片（r.invoices 为空、按 r.invoice 状态派生）没有可写的 invoices 数组，
     需把状态回写到结算单的 invoice 字段，否则重新渲染又变回原状态 */
  if (!r.invoices || !r.invoices.length){
    r.invoice = (iv.state === '开票失败') ? 'FAILED' : 'CREDIT_FAIL';
    r.failReason = reason;
  }
  npCloseModal();
  rsiRenderInvoicePage();
  /* 不弹 toast：失败原因已写在卡片最后一行（红字），再弹一次是重复信息 */
}
/* 作废冲红 */
function rsiVoidInvoice(i){
  var r = rsiCurSettle(); if (!r) return;
  var iv = rscInvoices(r)[i];
  if (!iv) { npToast('未找到该发票记录'); return; }
  if (iv.state !== '开票成功' && iv.state !== '作废失败') { npToast('仅开票成功的发票可作废冲红'); return; }
  if (!window.confirm('确认对发票「' + iv.invoiceNo + '」作废冲红？')) return;
  var reason = window.prompt('请输入作废冲红原因（可留空）', '');
  if (reason === null) return;
  iv.state = '作废冲红中';
  iv.redReason = reason.trim();
  rsiRenderInvoicePage();
  npToast('已提交作废冲红申请' + (reason.trim() ? '，原因：' + reason.trim() : ''));
}
/* 生成 32 位哈希串（发票号 / 开票申请编号用，格式同配件销售） */
function rscHash32(){
  var s = '', hex = '0123456789abcdef';
  for (var i = 0; i < 32; i++) s += hex.charAt(Math.floor(Math.random() * 16));
  return s;
}

/* ---------- 申请开票侧滑面板（pm-panel 范式） ---------- */
function rsiEnsureApplyPanel(){
  if (document.getElementById('rsc-inv-panel-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML =
    '<div class="pm-panel-overlay" id="rsc-inv-panel-overlay" onclick="rsiCloseApplyPanel()"></div>'
    + '<div class="pm-panel" id="rsc-inv-panel" style="width:1000px">'
      + '<div class="pm-panel-header">'
        + '<span class="pm-panel-title">申请开票</span>'
        + '<button class="pm-panel-close" onclick="rsiCloseApplyPanel()">&#10005;</button>'
      + '</div>'
      + '<div class="pm-panel-body" id="rsc-inv-panel-body"></div>'
      + '<div class="pm-panel-footer" id="rsc-inv-panel-foot"></div>'
    + '</div>';
  while (d.firstChild) document.body.appendChild(d.firstChild);
}
function rsiOpenApplyPanel(){
  var r = rsiCurSettle();
  if (!r) { npToast('请先从结算单进入发票页'); return; }
  if (!rscCanInvoice(r) && rscInvoices(r).length){
    var has = rscInvoices(r).some(function(iv){ return iv.state === '开票成功' || iv.state === '开票中' || iv.state === '作废冲红中' || iv.state === '作废失败'; });
    if (has) { npToast('已有开票请求，请勿重复提交'); return; }
  }
  rsiEnsureApplyPanel();
  rsiRenderApplyPanel();
  document.getElementById('rsc-inv-panel-overlay').classList.add('show');
  document.getElementById('rsc-inv-panel').classList.add('show');
}
function rsiCloseApplyPanel(){
  var o = document.getElementById('rsc-inv-panel-overlay');
  var p = document.getElementById('rsc-inv-panel');
  if (o) o.classList.remove('show');
  if (p) p.classList.remove('show');
  window.__RSC_PREFILL = undefined;
  rsiRenderInvoicePage();
}
function rsiRenderApplyPanel(){
  var body = document.getElementById('rsc-inv-panel-body');
  var r = rsiCurSettle();
  if (!body || !r) return;
  var t = rscInvTopInfo(r);
  var remain = Math.max(0, t.received - t.invoiced);

  var pf = window.__RSC_PREFILL || null;
  var isSpecial = pf && pf.type === '001数电专用发票';
  var pfType = isSpecial ? '001数电专用发票' : '002数电普通发票';
  var pfBuyer = (pf && pf.buyer) ? pf.buyer : {};
  var pfTitle = (pf && pf.title) ? pf.title : rscFeeObjectName(r);
  var v = function(x){ return (x === undefined || x === null) ? '' : String(x); };

  body.innerHTML = rscInvTopInfoHtml(r)
    + '<div class="psi-form">'
      + '<div class="psi-field psi-field-side">'
        + rsiInvFItem('开票金额',
            '<input type="text" id="rsc-inv-amount" readonly value="' + rscMoney(remain) + '">', true)
        + '<span class="psi-rule">开票已开金额+当前正在申请的应收金额；开票已开金额=已开票的+开票中的-冲红的</span>'
      + '</div>'
      + '<div class="psi-field">'
        + rsiInvFItem('明细要求',
            '<label class="psi-radio"><input type="radio" name="rsc-inv-detail" value="汇总一行" checked>汇总一行</label>'
            + '<label class="psi-radio"><input type="radio" name="rsc-inv-detail" value="明细">明细</label>', true)
      + '</div>'
      + '<div class="psi-field">'
        + rsiInvSelect('发票类型',
            '<select id="rsc-inv-type" onchange="rsiOnInvTypeChange()">'
            + '<option value="001数电专用发票"' + (isSpecial ? ' selected' : '') + '>001数电专用发票</option>'
            + '<option value="002数电普通发票"' + (isSpecial ? '' : ' selected') + '>002数电普通发票</option>'
            + '</select>', true)
      + '</div>'
      + '<div id="rsc-inv-buyer-box">'
        + '<div class="psi-field">' + rsiInvFItem('购买方名称',
            '<input type="text" id="rsc-inv-buyer" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer.name)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsiInvFItem('纳税人识别号',
            '<input type="text" id="rsc-inv-tax" maxlength="30" placeholder="最多30字符" value="' + npEscape(v(pfBuyer.tax)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsiInvFItem('地址',
            '<input type="text" id="rsc-inv-addr" maxlength="80" placeholder="最多80字符" value="' + npEscape(v(pfBuyer.addr)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsiInvFItem('电话',
            '<input type="text" id="rsc-inv-tel" maxlength="20" placeholder="最多20字符" value="' + npEscape(v(pfBuyer.tel)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsiInvFItem('开户行',
            '<input type="text" id="rsc-inv-bank" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer.bank)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsiInvFItem('账号',
            '<input type="text" id="rsc-inv-account" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer.account)) + '">', true) + '</div>'
      + '</div>'
      + '<div class="psi-field" id="rsc-inv-cust-field">'
        + rsiInvFItem('客户名称',
            '<input type="text" id="rsc-inv-cust" maxlength="50" placeholder="默认填充报修人，可修改" value="' + npEscape(pfTitle) + '">', true)
      + '</div>'
      + '<div class="psi-field">' + rsiInvFItem('发票发送手机号',
          '<input type="text" id="rsc-inv-phone" maxlength="20" placeholder="默认填充报修人手机号，可修改" value="' + npEscape(r.reporterPhone || '') + '">') + '</div>'
      + '<div class="psi-field">' + rsiInvFItem('发票发送邮箱',
          '<input type="text" id="rsc-inv-email" maxlength="50" placeholder="请输入">') + '</div>'
      + '<div class="psi-field">' + rsiInvFItem('备注',
          '<input type="text" id="rsc-inv-remark" maxlength="100" placeholder="请输入">') + '</div>'
    + '</div>';

  var foot = document.getElementById('rsc-inv-panel-foot');
  if (foot) foot.innerHTML = '<button class="lt-btn lt-btn-primary" onclick="rsiSubmitApply()">提交开票信息</button>';

  rsiOnInvTypeChange();
}
/* 文本框字段：同配件销售 psiFItem —— lt-input-wrap plain（plain 不画 V 形箭头，文本框不能像下拉框）
   required 变体额外显示红星 */
function rsiInvFItem(label, inner, required){
  return '<div class="lt-filter-item"><div class="lt-input-wrap plain' + (required ? ' required' : '') + '">'
    + '<span class="lt-filter-prefix">' + npEscape(label) + '</span>' + inner + '</div></div>';
}
/* 下拉字段：同配件销售 psiSelect —— 非 plain（保留 V 形箭头），required 变体加红星 */
function rsiInvSelect(label, inner, required){
  return '<div class="lt-filter-item"><div class="lt-input-wrap' + (required ? ' required' : '') + '">'
    + '<span class="lt-filter-prefix">' + npEscape(label) + '</span>' + inner + '</div></div>';
}
/* 发票类型联动：001 → 展开购买方 6 项并隐藏「客户名称」；002 → 反之 */
function rsiOnInvTypeChange(){
  var box = document.getElementById('rsc-inv-buyer-box');
  var cust = document.getElementById('rsc-inv-cust-field');
  var sel = document.getElementById('rsc-inv-type');
  if (!sel) return;
  var sp = (sel.value === '001数电专用发票');
  if (box) box.style.display = sp ? 'block' : 'none';
  if (cust) cust.style.display = sp ? 'none' : 'block';
}
/* 提交开票信息：写入一张「开票中」发票记录 */
function rsiSubmitApply(){
  var g = function(id){ var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var r = rsiCurSettle(); if (!r) return;
  var amount = g('rsc-inv-amount');
  var type = g('rsc-inv-type');
  var cust = g('rsc-inv-cust');
  /* 开票金额虽不可编辑，但仍是必传字段：不能为空、不能为 0（与配件销售同口径） */
  if (!amount) { npToast('开票金额不能为空'); return; }
  if (!(parseFloat(amount) > 0)) { npToast('开票金额不能为 0'); return; }
  if (!type) { npToast('请选择发票类型'); return; }
  if (type === '002数电普通发票' && !cust) { npToast('请填写客户名称'); return; }
  if (type === '001数电专用发票'){
    var must = ['rsc-inv-buyer','rsc-inv-tax','rsc-inv-addr','rsc-inv-tel','rsc-inv-bank','rsc-inv-account'];
    var names = { 'rsc-inv-buyer':'购买方名称','rsc-inv-tax':'纳税人识别号','rsc-inv-addr':'地址',
      'rsc-inv-tel':'电话','rsc-inv-bank':'开户行','rsc-inv-account':'账号' };
    for (var i = 0; i < must.length; i++){
      if (!g(must[i])) { npToast('请完整填写购买方信息（' + names[must[i]] + '）'); return; }
    }
  }
  var sp = (type === '001数电专用发票');
  if (!r.invoices) r.invoices = [];
  r.invoices.unshift({
    state: '开票中',
    invType: type,
    invoiceNo: '',
    applyNo: rscHash32(),
    applyTime: (r.date || '').slice(0, 16),
    /* 申请来源：直营店走 DMS，非直营走 App（示例数据两种都有） */
    source: rscStoreType(r) === '直营店' ? 'DMS' : 'App',
    amount: rscMoney(remain),
    buyer: sp ? { name:g('rsc-inv-buyer'), tax:g('rsc-inv-tax'), addr:g('rsc-inv-addr'),
      tel:g('rsc-inv-tel'), bank:g('rsc-inv-bank'), account:g('rsc-inv-account') } : null,
    title: sp ? '' : cust,
    redReason: ''
  });
  /* 同步回结算单的发票状态（列表页发票状态列随之变化） */
  r.invoice = 'PROCESSING';
  var st = NP['repair-settlement']; if (st) st.render();
  rsiCloseApplyPanel();
  npToast('开票信息已提交');
}

/* ---------- 注册切页初始化 ---------- */
npRegisterModuleInit('repair-settlement', function(){ initRepairSettlement(); });
npRegisterModuleInit('repair-settlement-invoice', function(){ rsiRenderInvoicePage(); });
