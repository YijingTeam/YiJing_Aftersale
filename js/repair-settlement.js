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
/* ---------- 折让项目字典（2026-10-26 用户口径，规范 §4.9.2 登记） ----------
   顺序即下拉顺序，「其它」为兜底值。页面内禁止再写折让类型字面量（规范 §4.9 末条）。 */
var RSC_DISCOUNT_TYPES = ['按商务政策','折扣券','会员折扣','活动折扣','内部考核','总经理签免','二手车整备','集油卡抵机油','其它'];

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
      discounts:[{type:'按商务政策', labor:'20.00', part:'0.00', remark:''}],
      /* 收退款流水（渠道→方式按联动规则：门店自行全量；支付二维码/用户App 只有微信、支付宝） */
      payRecords:[
        { type:'收款', channel:'门店自行', method:'现金', amount:'300.00', time:'2026-10-19 15:22', payState:'OK' },
        { type:'收款', channel:'门店自行', method:'现金', amount:'377.25', time:'2026-10-19 15:26', payState:'OK' }
      ] },
    { id:'WXJSDYJ-SCZ01261015011', order:'Z05RO261015011', storeCode:'SCZ01', plate:'川A·Q9026', vin:'LDP41B960TD920011',
      date:'2026-10-15 13:06', reporter:'李静', reporterPhone:'13900139002', reportDate:'2026-10-13',
      labor:'180.00', part:'0.00', total:'180.00',
      status:'PAYING', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'折扣券', labor:'0.00', part:'0.00', remark:''}], payOrderNo:'YJ_WXSK_Z05RO26101501101',
      payChannel:'支付二维码', payState:'PAYING',
      payRecords:[
        { type:'收款', channel:'支付二维码', method:'微信', amount:'180.00', time:'2026-10-15 13:08', payState:'WAIT' }
      ] },
    { id:'WXJSDYJ-SH001261012007', order:'Z05RO261012007', storeCode:'SH001', plate:'沪A·M2308', vin:'LAP31CZ60GG920007',
      date:'2026-10-12 10:18', reporter:'王芳', reporterPhone:'13700137003', reportDate:'2026-10-10',
      labor:'720.00', part:'0.00', total:'720.00',
      status:'PAID_PENDING_COLLECTION', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'按商务政策', labor:'100.00', part:'0.00', remark:''},
                 {type:'折扣券', labor:'100.00', part:'0.00', remark:''}],
      recommend:'客户为老客户，按商务政策折让 100 元，另发 100 元折扣券。',
      payOrderNo:'YJ_WXSK_Z05RO26101200701',
      payChannel:'用户App', payState:'SUCCESS',
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
        { type:'收款', channel:'门店自行', method:'银行卡', amount:'400.00', time:'2026-09-28 10:24', payState:'OK' },
        /*退款流水支付状态＝失败（本单状态＝退款失败待核对） */
        { type:'退款', channel:'门店自行', method:'银行卡', amount:'400.00', time:'2026-09-28 10:31', payState:'FAIL' }
      ] },
    { id:'SK2026092500000001', order:'WX2026092500000001', storeCode:'BJ001', plate:'京A·R9204', vin:'LAB00R12635092024',
      date:'2026-09-25 09:15', reporter:'吴涛', reporterPhone:'13100131009', reportDate:'2026-09-24',
      labor:'120.00', part:'80.00', total:'200.00',
      status:'EXCEPTION', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[], payOrderNo:'YJ_WXSK_WX202609250000000101',
      payChannel:'用户App', payState:'TIMEOUT',
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
      ] },
    /* ↓ 2026-10-26 依 PRD 6.1.1【收款】在线支付场景表补充的 2 行示例（让弹框的
       「用户App·未发起（可撤回）」「用户App·支付已取消」两种场景都能在原型里点到）
       ★ 折让金额必须非 0：rscDiscountCheck 规定「折让金额为 0」不许进【收款】/【在线支付】，
         写成 0.00 会让这两个场景（以及第 1 行「渠道空」）压根打不开弹框，等于演示不出 PRD 场景。 ---------- */
    /* 非直营(接了支付) + 未支付 + 渠道已选「用户App」但 App 端还没调支付平台 → 支付状态＝未发起，可【撤回】 */
    { id:'WXJSDYJ-SH001261023015', order:'Z05RO261023015', storeCode:'SH001', plate:'沪A·M2315', vin:'LAP31CZ60SG920015',
      date:'2026-10-23 09:40', reporter:'周婕', reporterPhone:'13700137015', reportDate:'2026-10-21',
      labor:'300.00', part:'160.00', total:'460.00',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'按商务政策', labor:'10.00', part:'0.00', remark:''}],
      payChannel:'用户App', payState:'',
      payRecords:[] },
    /* 非直营(接了支付) + 未支付 + 用户App 支付已取消 → 无操作项（系统自动置空渠道、解锁折让） */
    { id:'WXJSDYJ-WH001261024016', order:'Z05RO261024016', storeCode:'WH001', plate:'鄂A·R9216', vin:'LAB00R12635092026',
      date:'2026-10-24 10:12', reporter:'马涛', reporterPhone:'13600136016', reportDate:'2026-10-22',
      labor:'360.00', part:'160.00', total:'520.00',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[], payChannel:'用户App', payState:'CANCELED',
      payRecords:[] },
    /* 非直营(没接支付) + 未支付：验证「未接支付的门店不出在线渠道」——
       底部不出【在线支付】，弹框内也没有 用户App / 支付二维码 可选（PRD 6.1.1 渠道矩阵） */
    { id:'WXJSDYJ-CS001261025017', order:'Z05RO261025017', storeCode:'CS001', plate:'湘A·R9217', vin:'LAB00R12635092027',
      date:'2026-10-25 15:20', reporter:'谭磊', reporterPhone:'13500135017', reportDate:'2026-10-23',
      labor:'150.00', part:'88.00', total:'238.00',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[],
      payRecords:[] }
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
/* 该结算单所属门店是否接入支付（在线渠道开关）
   直营店一律接入；非直营店看门店主数据 payEnabled（门店管理维护）——公共函数 storePayEnabled 唯一来源 */
function rscStorePayEnabled(r){
  var s = rscStore(r.storeCode);
  if (typeof storePayEnabled === 'function') return storePayEnabled(s);
  return s ? s.channelMode === '直营' : false;
}
/* 该门店可用的在线收退款渠道（PRD 6.1.1 渠道矩阵：非直营(没接支付) → 两个在线渠道都没有） */
function rscOnlineChannelsOf(r){
  return rscStorePayEnabled(r) ? RSC_ONLINE_CHANNELS.slice() : [];
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
/* 折让金额＝工时折让＋配件折让（2026-10-26 用户口径）。
   ★ 唯一出口：数据里不再存 amount 字段，行金额一律由本函数派生——
     两处各存一份（amount 与 labor/part）必然漂移，改完一处漏另一处就是对不上账。 */
function rscDiscountAmt(d){ return rscNum(d && d.labor) + rscNum(d && d.part); }
function rscDiscountTotal(r){
  return (r.discounts || []).reduce(function(s, d){ return s + rscDiscountAmt(d); }, 0);
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
        /* 2026-10-26：这里不能再包 overflow-x:auto —— 表格内「折让项目」是模糊下拉，
           overflow-x:auto 会把 overflow-y 一并变成 auto，最后一行下拉列表被裁掉。
           列宽（2026-10-26 用户反馈「折让项目里的项目挤到换行、备注太宽」后按实测调）：
           折让项目 120→180（模糊下拉要放得下最长字典值「集油卡抵机油」，实测 120 时该选项折成两行 46px），
           备注由自动列（实测 353px）改为声明 140px 收窄；表格仍 width:100% 撑满面板，
           余量按列宽比例摊回，实测折让项目 218px / 备注 169px。 */
        '<div style="margin-bottom:8px">' +
          '<table class="pp-parts-table" id="rsc-discount-table">' +
            '<thead><tr>' +
              '<th style="width:40px">序号</th>' +
              '<th style="width:180px">折让项目</th>' +
              '<th style="width:100px">折让金额</th>' +
              '<th style="width:100px">工时折让</th>' +
              '<th style="width:100px">配件折让</th>' +
              '<th style="width:140px">备注</th>' +
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

  /* 折让项目：仅「未支付」可增删，其余状态只读
     2026-10-26 PRD 6.1.1【收款】第1条：每次在「维修结算收款」界面点操作列【收款】，都要调支付接口，
     查订单是否有支付中的、并查 DMS 的支付收款记录判断订单是否已支付；
     有支付中（待支付）或已支付的 → 折让区域不可编辑（撤回 / 取消支付 / 支付超时后解锁）。 */
  rscPayInterfaceCheck(r);
  /* 可编辑条件只允许一处判定：rscDiscountEditable()（本处与 rscRenderDiscounts 共用，禁止各写一遍） */
  var canEditDiscount = rscDiscountEditable(r);
  document.getElementById('rsc-discount-toolbar').innerHTML = canEditDiscount
    ? '<button class="lt-btn lt-btn-default" onclick="rscAddDiscount()">新增折让</button>'
    : (rscPayLocked(r) ? '<span style="font-size:12px;color:#861B2F">' + npEscape(rscPayLockReason(r)) + '</span>' : '');
  rscRenderDiscounts(r);

  var rec = document.getElementById('rsc-recommend');
  rec.value = r.recommend || '';

  /* 金额账类 + 底栏合计：抽成 rscRenderAccount()，折让改动后只刷这一块（不整表重绘） */
  rscRenderAccount(r);

  document.getElementById('rsc-panel-overlay').classList.add('show');
  document.getElementById('rsc-panel').classList.add('show');
}
/* 金额账类（应收/实收/差额）＋ 底栏合计（总金额/总折让额/待支付）＋ 底部按钮
   折让金额改动时由 rscDiscountRecalc() 复用，保证"改折让 → 金额账类与待支付同步"只有一份实现 */
function rscRenderAccount(r){
  var total = rscNum(r.total), net = rscNet(r), diff = total - net;
  var zero = '<span style="color:#999">¥ 0.00</span>';
  var moneyTd = function(v){ return '<span style="color:#185FA5">¥ ' + v.toFixed(2) + '</span>'; };
  var tip = document.getElementById('rsc-net-tip');
  if (tip) tip.textContent = '实际收款金额 ¥' + rscMoney(net);
  var tb = document.getElementById('rsc-account-tbody');
  if (tb) tb.innerHTML =
    '<tr><td><b>应收金额</b></td><td>' + moneyTd(total) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(total) + '</td></tr>' +
    '<tr><td><b>实收金额</b></td><td>' + moneyTd(net) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(net) + '</td></tr>' +
    '<tr><td><b>差额</b></td><td>' + moneyTd(diff) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(diff) + '</td></tr>';
  /* 底部条（照搬 920 payment-bar） */
  var ft = document.getElementById('rsc-panel-footer');
  if (ft) ft.innerHTML =
    '<div class="pp-panel-totals" style="margin-right:auto;text-align:left">'
    + '总金额 <b>¥' + rscMoney(total) + '</b> · 总折让额 <b>¥' + rscMoney(rscDiscountTotal(r)) + '</b> · 待支付 <b>¥' + rscMoney(net) + '</b>'
    + '</div>' + rscFooterButtons(r);
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
  /* 2026-10-26 用户口径：支付已取消 / 支付已超时 → 收款渠道置空、折让解锁可编辑，
     封存条不能再写「折让不可修改」（原样会与可编辑自相矛盾）。 */
  var st = rscOrderPayState(r);
  if (st === 'CANCELED') return '支付已取消';
  if (st === 'TIMEOUT') return '支付已超时';
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
  if (r.status === 'PAYING') return '支付二维码已绑定本轮金额快照，折让项目和应收金额不可修改。';
  if (r.status === 'PAID_PENDING_COLLECTION') return '金额快照继续封存，可选择【收款】完成结算，或选择【退款】原路退回。';
  if (r.status === 'PAID') return '收款、折让项目和支付信息已归档，页面保持只读，可在详情或列表发起开票。';
  var st = rscOrderPayState(r);
  if (st === 'CANCELED') return '用户已在App端取消支付：收款渠道已置空，可重新选择；折让项目已解锁，可编辑。';
  if (st === 'TIMEOUT') return '支付已超时：收款渠道已置空，可重新选择；折让项目已解锁，可编辑。';
  return '支付二维码已绑定当前金额版本，折让项目和应收金额暂不可修改。';
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
    /* 在线支付：直营/非直营(接了支付) 都出；非直营(没接支付) 不出（PRD 6.1.1 渠道矩阵：该门店两个在线渠道都没有）
       ★ 支付异常行不出「在线支付」：该状态下 rscOpenOnlinePay 的守卫必拦（当前状态不可在线支付），
         且与同一面板封存条「当前不可修改金额、再次支付或确认收款」自相矛盾，
         按用户「不能操作的按钮不显示」口径处理（2026-10-23） */
    if (r.status !== 'EXCEPTION' && rscStorePayEnabled(r)) {
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
/* ---------- 折让项目区（2026-10-26 依用户口径改造） ----------
   用户原文：「『折让项目』需要可编辑，下拉值（下拉带搜索）：按商务政策 / 折扣券 / 会员折扣 / 活动折扣 /
            内部考核 / 总经理签免 / 二手车整备 / 集油卡抵机油 / 其它」；
            「折让金额＝工时折让＋配件折让，工时折让、配件折让、备注应该是可编辑的框」。
   控件选型（规范 §3.1）：9 个值 > 5 → 模糊下拉 `.lt-input-wrap.combobox`（唯一组件，与查询区/表单同一套）；
   表格内可编辑单元格范式＝ `parts-internal-usage.js` 的 `<div class="lt-input-wrap pl-s"><input></div>`。
   编辑条件：status==='UNPAID' 且未被支付锁定；其余状态整区只读（纯文本，不出现输入框）。 */
function rscDiscountEditable(r){
  return r.status === 'UNPAID' && !rscPayLocked(r);
}
function rscDiscountText(v){
  return (v === undefined || v === null || v === '') ? '—' : npEscape(v);
}
/* 折让项目：模糊下拉（首项"请选择" data-val=""，选中值取 cmbSelVal） */
function rscDiscountComboHtml(d, i){
  var lis = '<li data-val="" onclick="rscDiscountTypeSelect(this)">请选择</li>';
  for (var k = 0; k < RSC_DISCOUNT_TYPES.length; k++){
    var t = RSC_DISCOUNT_TYPES[k];
    lis += '<li data-val="' + npEscape(t) + '" onclick="rscDiscountTypeSelect(this)">' + npEscape(t) + '</li>';
  }
  return '<div class="lt-input-wrap combobox" data-di="' + i + '" data-apply="rscDiscountTypeSync">'
    + '<input type="text" id="rsc-di-type-' + i + '" value="' + npEscape(d.type || '') + '" placeholder="请选择"'
    + ' onfocus="gtComboboxShow(this)" oninput="gtComboboxFilter(this);rscDiscountTypeInput(this)">'
    + '<span class="cb-arrow" onclick="gtComboboxToggle(this)">&#9660;</span>'
    + '<ul class="lt-datalist">' + lis + '</ul></div>';
}
function rscRenderDiscounts(r){
  var list = r.discounts || [];
  var lock = !rscDiscountEditable(r);
  var html = list.map(function(d, i){
    if (lock){
      return '<tr>' +
        '<td>' + (i+1) + '</td>' +
        '<td>' + rscDiscountText(d.type) + '</td>' +
        '<td>' + rscMoney(rscDiscountAmt(d)) + '</td>' +
        '<td>' + rscMoney(d.labor) + '</td>' +
        '<td>' + rscMoney(d.part) + '</td>' +
        '<td>' + rscDiscountText(d.remark) + '</td>' +
        '<td>—</td>' +
      '</tr>';
    }
    return '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td>' + rscDiscountComboHtml(d, i) + '</td>' +
      /* 折让金额＝工时折让＋配件折让：只读派生值，不给输入框（改工时/配件即刷新本单元格） */
      '<td id="rsc-di-amt-' + i + '">' + rscMoney(rscDiscountAmt(d)) + '</td>' +
      '<td><div class="lt-input-wrap" data-di="' + i + '"><input type="text" id="rsc-di-labor-' + i + '" value="' + rscMoney(d.labor) +
        '" placeholder="0.00" oninput="rscDiscountNumInput(this,\'labor\')"></div></td>' +
      '<td><div class="lt-input-wrap" data-di="' + i + '"><input type="text" id="rsc-di-part-' + i + '" value="' + rscMoney(d.part) +
        '" placeholder="0.00" oninput="rscDiscountNumInput(this,\'part\')"></div></td>' +
      '<td><div class="lt-input-wrap" data-di="' + i + '"><input type="text" id="rsc-di-remark-' + i + '" value="' + npEscape(d.remark || '') +
        '" placeholder="请输入" oninput="rscDiscountRemark(this)"></div></td>' +
      '<td><a href="javascript:void(0)" class="lt-link np-red" onclick="rscDeleteDiscount(' + r.idx + ',' + i + ')">删除</a></td>' +
    '</tr>';
  }).join('');
  if (!list.length) html = '<tr><td colspan="7" style="text-align:center;color:#999;padding:14px;">暂无折让项目</td></tr>';
  document.getElementById('rsc-discount-tbody').innerHTML = html;
  /* 动态生成的 combobox 必须自己补一次注入（规范 §Combobox 第 9 款）：
     showContent 里那次注入跑在 npInitModule 之前，本表在面板打开时才生成 → 不补就没有清除 × */
  if (!lock && typeof npInitComboboxes === 'function') npInitComboboxes();
}
/* 折让项目：点下拉项 → 写值 + 收列表 + 同步模型（值取 data-val，空值＝未选） */
function rscDiscountTypeSelect(li){
  var w = (li && li.closest) ? li.closest('.lt-input-wrap.combobox') : null;
  if (!w) return;
  var inp = w.querySelector('input'), l = w.querySelector('.lt-datalist');
  if (inp) inp.value = cmbSelVal(li);
  if (l){
    l.classList.remove('show');
    var xs = l.querySelectorAll('li');
    for (var i = 0; i < xs.length; i++) xs[i].classList.remove('hidden');
  }
  rscDiscountTypeSet(w, inp ? inp.value : '');
}
function rscDiscountTypeSet(w, val){
  var r = window.__rscCur;
  if (!r || !r.discounts) return;
  var i = parseInt(w.getAttribute('data-di'), 10);
  if (isNaN(i) || !r.discounts[i]) return;
  r.discounts[i].type = val ? String(val).trim() : '';
}
/* 手输过滤 / 清除 ×（× 由 npComboboxInit 注入，清空时不触发 input 事件，故容器另挂 data-apply 走下面的全量同步） */
function rscDiscountTypeInput(inp){
  var w = (inp && inp.closest) ? inp.closest('.lt-input-wrap.combobox') : null;
  if (w) rscDiscountTypeSet(w, inp.value);
}
function rscDiscountTypeSync(){
  var r = window.__rscCur;
  if (!r || !r.discounts) return;
  var tb = document.getElementById('rsc-discount-tbody');
  if (!tb || !tb.querySelectorAll) return;
  var ws = tb.querySelectorAll('.lt-input-wrap.combobox[data-di]');
  for (var k = 0; k < ws.length; k++){
    var i = parseInt(ws[k].getAttribute('data-di'), 10);
    var inp = ws[k].querySelector('input');
    if (!isNaN(i) && r.discounts[i] && inp) r.discounts[i].type = inp.value ? String(inp.value).trim() : '';
  }
}
/* 金额输入净化：只留数字与一个小数点，最多两位小数（负号、字母一律丢弃） */
function rscMoneyInput(raw){
  var v = String(raw === undefined || raw === null ? '' : raw).replace(/[^\d.]/g, '');
  var k = v.indexOf('.');
  if (k >= 0) v = v.slice(0, k + 1) + v.slice(k + 1).replace(/\./g, '');
  var seg = v.split('.');
  if (seg.length > 1) v = seg[0] + '.' + seg[1].slice(0, 2);
  return v;
}
/* 工时折让 / 配件折让：输入即写模型；折让金额＝两者之和 → 原地刷新本行金额与合计（不整表重绘，打字不丢焦点） */
function rscDiscountNumInput(inp, field){
  var w = (inp && inp.closest) ? inp.closest('.lt-input-wrap') : null;
  if (!w) return;
  var clean = rscMoneyInput(inp.value);
  if (clean !== inp.value) inp.value = clean;
  var r = window.__rscCur;
  if (!r || !r.discounts) return;
  var i = parseInt(w.getAttribute('data-di'), 10);
  if (isNaN(i) || !r.discounts[i]) return;
  r.discounts[i][field] = (clean === '' ? '0' : clean);
  rscDiscountRecalc(r, i);
}
function rscDiscountRemark(inp){
  var w = (inp && inp.closest) ? inp.closest('.lt-input-wrap') : null;
  if (!w) return;
  var r = window.__rscCur;
  if (!r || !r.discounts) return;
  var i = parseInt(w.getAttribute('data-di'), 10);
  if (isNaN(i) || !r.discounts[i]) return;
  r.discounts[i].remark = inp.value || '';
}
/* 折让改动后的联动刷新：本行折让金额 → 金额账类 → 底栏总折让额/待支付 → 实际收款金额 */
function rscDiscountRecalc(r, rowIndex){
  var d = (r.discounts || [])[rowIndex];
  var amtEl = document.getElementById('rsc-di-amt-' + rowIndex);
  if (amtEl && d) amtEl.textContent = rscMoney(rscDiscountAmt(d));
  rscRenderAccount(r);
}
/* 折让校验（2026-10-26 用户口径）：点【收款】/【在线支付】前拦两道
   ① 折让项目必须从下拉里选（值 ∈ RSC_DISCOUNT_TYPES）
   ② 折让金额（工时折让＋配件折让）不能为 0
   ★ 只在折让区可编辑时校验：支付中/已支付＝金额快照已封存、用户也改不了，
     若此时仍校验，历史遗留的 0 元折让会把「查看支付二维码」这类只读入口卡死。 */
function rscDiscountCheck(r){
  if (!rscDiscountEditable(r)) return '';
  var list = r.discounts || [];
  for (var i = 0; i < list.length; i++){
    var t = String((list[i] && list[i].type) || '').trim();
    if (!t || RSC_DISCOUNT_TYPES.indexOf(t) < 0) return '第 ' + (i + 1) + ' 行折让项目未选择，请先在下拉中选择折让项目';
    if (rscDiscountAmt(list[i]) <= 0) return '第 ' + (i + 1) + ' 行折让金额为 0，请填写工时折让或配件折让';
  }
  return '';
}
function rscAddDiscount(){
  var r = window.__rscCur; if (!r) return;
  if (!r.discounts) r.discounts = [];
  /* 默认不预填折让项目：9 个值是让用户选的，预填「按商务政策」会让下拉形同虚设 */
  r.discounts.push({ type:'', labor:'0.00', part:'0.00', remark:'' });
  rscRenderDiscounts(r);
  rscRenderAccount(r);
  npToast('已新增一行折让项目');
}
function rscDeleteDiscount(idx, di){
  var r = rscGet(idx); if (!r) return;
  if (!r.discounts || !r.discounts[di]) return;
  r.discounts.splice(di, 1);
  rscRenderDiscounts(r);
  rscRenderAccount(r);
}
function rscNewCycle(idx){
  var r = rscGet(idx); if (!r) return;
  npToast('再次收款：新一轮支付需从「未支付」重新发起（原型演示）');
}

/* ---------- 弹框：在线支付（2026-10-26 依 PRD 6.1.1【收款】重做） ----------
   ★ 旧版（「优惠后实际收款 + 支付单号」+「支付关闭 / 结果待确认 / 支付成功」三键）在 PRD 里不存在，已整体替换。
   PRD 元素（逐条落地）：
     · 点【在线支付】不立即出二维码：先取「当前收款渠道」与「该订单的支付状态（订单支付状态，不是流水状态）」
     · 行1：维修工单号、维修结算单号、收款渠道（下拉：用户App(默认) / 支付二维码）、收款金额
     · 行2：支付状态（未发起 / 待支付(支付中) / 支付已取消 / 支付已超时 / 支付成功）
     · 可操作项随「渠道 × 支付状态」两维变化（见 rscOnlineActions）：
         渠道空                  → 同步给App（下拉＝用户App）/ 获取支付码（下拉＝支付二维码）
         用户App + 未发起         → 撤回（向App传"不可支付" + 渠道置空 + 折让解锁）
         用户App + 待支付(支付中)  → 无
         用户App + 已取消/已超时    → 无（系统自动：渠道置空 + 折让解锁）
         用户App + 支付成功        → 无
         支付二维码 + 待支付       → 取消支付（渠道置空 + 折让解锁）
         支付二维码 + 已超时       → 无（系统自动同上）
     · 无论点【在线支付】还是【收款】，都要向 App 同步最新结算收款单及「App 是否可支付」
   原型演示：PRD 在「待支付(支付中)」写「无操作项」（由用户在 App / 扫码端完成），
   原型无支付后台，保留「模拟支付成功（演示）」一个显式标注的入口，仅用于走到「收款」，可按需删除。 */
var RSC_ORDER_PAY_STATE = {
  '':'未发起', PAYING:'待支付(支付中)', CANCELED:'支付已取消', TIMEOUT:'支付已超时', SUCCESS:'支付成功'
};
var RSC_ONLINE_CHANNELS = ['用户App', '支付二维码'];
/* ---------- 演示切换：PRD 6.1.1【收款】场景表 → 一键切换（2026-10-26 用户要求） ----------
   用户原话：「在弹窗底部，增加一个区域，专门用来演示切换。这样就可以把表格里所需要的
             演示需要的所有场景通过按钮进行切换」。
   场景逐条对应 PRD 那张 4 列表（场景 / 显示项 / 可操作项 / 点击操作后）：
     行1「当前收款渠道：空」                    → 场景 1
     行2「当前收款渠道：用户App」×支付状态 4 格  → 场景 2~6（PRD 把「支付已取消/支付已超时」
                                                   写在同一格，原型拆两个按钮，两态都能演示）
     行3「当前收款渠道：支付二维码」×2 格        → 场景 7~8
   顺序即 PRD 表格自上而下的顺序，改顺序前先回读 PRD。 */
/* 场景清单：group＝PRD 表格的分组（场景列所属渠道）；ch/st＝「点击操作后」本行落到的实际状态。
   ★ 用户 2026-10-26 三次纠正：支付已取消 / 支付已超时 正确结果是 ——
     ① 收款渠道置为空、可重新选择收款渠道；② 折让项目取消锁定、可编辑。
     所以这两个（含支付二维码·已超时）场景的 ch 一律为空，st 保留（行2 仍显示该支付状态）。 */
var RSC_ONLINE_SCENES = [
  { group: '空',           ch: '',           st: '',         label: '渠道：空' },
  { group: '用户App',      ch: '用户App',    st: '',         label: '未发起' },
  { group: '用户App',      ch: '用户App',    st: 'PAYING',   label: '待支付(支付中)' },
  { group: '用户App',      ch: '',           st: 'CANCELED', label: '支付已取消' },
  { group: '用户App',      ch: '',           st: 'TIMEOUT',  label: '支付已超时' },
  { group: '用户App',      ch: '用户App',    st: 'SUCCESS',  label: '支付成功' },
  { group: '支付二维码',   ch: '支付二维码', st: 'PAYING',   label: '待支付(支付中)' },
  { group: '支付二维码',   ch: '',           st: 'TIMEOUT',  label: '支付已超时' }
];
function rscOnlineChannel(r){ return r.payChannel || ''; }
/* 订单支付状态（PRD：取「这笔订单」的支付状态，不是支付流水号的状态）
   未挂 payState 的历史行按结算状态派生，保持与既有示例数据兼容 */
function rscOrderPayState(r){
  if (r.payState === '') return '';
  if (r.payState) return r.payState;
  if (r.status === 'PAYING') return 'PAYING';
  if (r.status === 'EXCEPTION') return 'TIMEOUT';
  if (r.status === 'PAID' || r.status === 'PAID_PENDING_COLLECTION') return 'SUCCESS';
  return '';
}
function rscPayLocked(r){
  var s = rscOrderPayState(r);
  return s === 'PAYING' || s === 'SUCCESS';
}
function rscPayLockReason(r){
  return rscOrderPayState(r) === 'SUCCESS'
    ? '订单已支付，折让项目不可编辑'
    : '订单在支付中（待支付），折让项目不可编辑';
}
/* 模拟「调支付接口 + 查 DMS 支付收款记录」：原型无后台，按订单支付状态派生。
   调用点＝点【收款】打开面板时（rscOpenPanel）与点【在线支付】时，与 PRD 第1、2条一致。 */
function rscPayInterfaceCheck(r){
  var s = rscOrderPayState(r);
  return { paying: s === 'PAYING', paid: s === 'SUCCESS', state: s };
}
/* 向 App 同步「App 是否可支付」（PRD 第4条：点【在线支付】与点【收款】都要同步最新结算收款单） */
function rscSyncAppPayable(r, payable){
  r.appPayable = !!payable;
  r.appSyncTime = (typeof npNowLocal === 'function') ? npNowLocal() : '';
}
function rscOpenOnlinePay(idx){
  var r = rscGet(idx); if (!r) return;
  if (r.status !== 'UNPAID' && r.status !== 'PAYING' && r.status !== 'PAID_PENDING_COLLECTION') { npToast('当前状态不可在线支付'); return; }
  if (rscNet(r) <= 0) { npToast('线上实付现金须大于0；当前没有待支付金额'); return; }
  /* 折让校验：折让项目必须选、折让金额不能为 0（2026-10-26 用户口径），不合格不许发起支付 */
  var dErr = rscDiscountCheck(r);
  if (dErr) { npToast(dErr); return; }
  window.__rscPayCur = r;
  /* 演示切换用：记下「打开弹框那一刻」的支付态，供【还原本行进入时状态】回退 */
  window.__rscDemoBackup = {
    idx: r.idx, payChannel: r.payChannel, payState: r.payState, payOrderNo: r.payOrderNo,
    payQrTime: r.payQrTime, appPayable: r.appPayable, appSyncTime: r.appSyncTime
  };
  rscSyncAppPayable(r, rscOrderPayState(r) !== 'PAYING');
  /* PRD 第2条：每次点【在线支付】都调接口查支付中/已支付；有则提示，但不影响打开弹框 */
  var chk = rscPayInterfaceCheck(r);
  rscRenderOnlinePay(r);
  if (chk.paying) npToast('已在支付中，勿重复支付');
  else if (chk.paid) npToast('已支付、勿重复支付');
}
function rscOnlineTip(r){
  var ch = rscOnlineChannel(r), st = rscOrderPayState(r);
  if (!rscStorePayEnabled(r)) return '本门店未接入支付（非直营·未接支付）：不支持「用户App / 支付二维码」，只能走门店自行（线下收款）。';
  /* 支付已取消 / 已超时：渠道已被系统置空（下面「渠道为空」那句话就不适用了），先说这两态 */
  if (st === 'CANCELED') return '用户已在App端取消支付：收款渠道已自动置空，可在本弹框内重新选择收款渠道；折让项目已解锁、可编辑。';
  if (st === 'TIMEOUT') return '支付已超时：收款渠道已自动置空，可在本弹框内重新选择收款渠道；折让项目已解锁、可编辑。';
  if (st === 'SUCCESS') return '支付已成功：请关闭本弹框并点【收款】完成结算确认。';
  if (!ch) return '当前收款渠道为空：选「用户App」后点【同步给App】；选「支付二维码」后点【获取支付码】。';
  if (ch === '用户App' && st === '') return '已选「用户App」：App 端可支付（尚未发起）。点【撤回】可回退并解锁折让项目。';
  if (ch === '用户App' && st === 'PAYING') return '用户已在App端发起支付（待支付）：此状态无操作项，只能由用户在App端支付或取消支付。';
  if (ch === '支付二维码' && st === 'PAYING') return '二维码未超时：点【取消支付】可作废本次二维码（收款渠道置空、折让项目解锁）。';
  return '当前收款渠道：' + ch + '；支付状态：' + (RSC_ORDER_PAY_STATE[st] || '—') + '。';
}
/* ---------- 弹框「在线支付」底部：演示切换区（原型专用） ----------
   为什么存在：PRD 6.1.1【收款】那张表有 7 个场景（渠道空 / 用户App×4~5 / 支付二维码×2），
   在原型里只能靠点不同的列表行去碰，其中「渠道空」「用户App·未发起」两种状态还会被
   折让校验拦在弹框外（折让金额为 0 的行），等于演示不出来。故把场景做成按钮。
   · 只改本行的 payChannel / payState（演示态），**不改列表里的收款状态 r.status**；
   · 公共类名 .np-demo-switch*，样式在 style.css 唯一一份（规范 §3.1.5 已登记），禁止页面自造同类私有类名。 */
function rscSceneGroups(){
  var order = [], groups = {};
  RSC_ONLINE_SCENES.forEach(function(s){
    var key = s.group;
    if (!groups[key]){ groups[key] = []; order.push(key); }
    groups[key].push(s);
  });
  return order.map(function(k){ return { ch: k, items: groups[k] }; });
}
/* 当前高亮哪个场景按钮：优先用「刚点过的演示场景」（支付已取消/已超时会把渠道置空，
   两个渠道组会落到同一状态，只靠状态反查会同时点亮两个），否则按状态反查（取 PRD 顺序第一个）。 */
function rscDemoActiveIndex(r){
  var ch = rscOnlineChannel(r), st = rscOrderPayState(r);
  var ix = r.__demoIx;
  if (typeof ix === 'number' && RSC_ONLINE_SCENES[ix] &&
      RSC_ONLINE_SCENES[ix].ch === ch && RSC_ONLINE_SCENES[ix].st === st) return ix;
  for (var i = 0; i < RSC_ONLINE_SCENES.length; i++){
    if (RSC_ONLINE_SCENES[i].ch === ch && RSC_ONLINE_SCENES[i].st === st) return i;
  }
  return -1;
}
function rscDemoSwitchHtml(r){
  var actIx = rscDemoActiveIndex(r);
  var chans = rscOnlineChannelsOf(r);
  var html = '<div class="np-demo-switch" id="rsc-demo-switch">' +
    '<div class="np-demo-switch-hd">演示切换（原型专用）' +
      '<span class="np-demo-switch-hint">按 PRD 6.1.1【收款】场景表切换；只改本弹框的演示状态，不改列表里的收款状态</span>' +
    '</div>';
  rscSceneGroups().forEach(function(g){
    html += '<div class="np-demo-switch-group">' +
      '<span class="np-demo-switch-group-label">收款渠道：' + npEscape(g.ch) + '</span>';
    g.items.forEach(function(s){
      var i = RSC_ONLINE_SCENES.indexOf(s);
      html += '<button type="button" class="np-demo-switch-btn' + (i === actIx ? ' active' : '') + '"' +
        ' onclick="rscDemoScene(' + r.idx + ',' + i + ')">' + npEscape(s.label) + '</button>';
    });
    html += '</div>';
  });
  html += '<div class="np-demo-switch-ops">';
  /* PRD 在「待支付(支付中)」写「可操作项：无」——模拟支付成功不属于可操作项，
     所以它不进业务按钮、放这里，并显式标注（演示）。 */
  if (chans.length && rscOrderPayState(r) === 'PAYING'){
    html += '<button type="button" class="np-demo-switch-btn" onclick="rscOnlineDemoPaid(' + r.idx + ')">模拟支付成功（演示）</button>';
  }
  html += '<button type="button" class="np-demo-switch-btn" onclick="rscDemoReset(' + r.idx + ')">还原本行进入时状态</button>';
  html += '</div>';
  /* 状态说明（与场景切换同处一区，避免正文混入 PRD 之外的元素） */
  html += '<div class="np-demo-switch-tip">当前场景说明：' + npEscape(rscOnlineTip(r)) + '</div>';
  html += '</div>';
  return html;
}
/* 切到某个 PRD 场景：渠道 + 订单支付状态两维一起设，然后原地重绘弹框并同步背后的侧滑面板。
   「支付已取消 / 支付已超时」按 PRD 落成：收款渠道置空（可重新选择）+ 折让解锁（可编辑）。 */
function rscDemoScene(idx, i){
  var r = rscGet(idx); if (!r) return;
  var s = RSC_ONLINE_SCENES[i]; if (!s) return;
  r.__demoIx = i;
  r.payChannel = s.ch;
  r.payState = s.st;
  if (!r.payOrderNo) r.payOrderNo = 'YJ_WXSK_' + r.order + '01';
  r.payQrTime = (s.ch === '支付二维码' && s.st === 'PAYING')
    ? ((typeof npNowLocal === 'function') ? npNowLocal() : '') : '';
  /* PRD「点击操作后」：同步给App＝传「可支付」；其余（获取二维码 / 撤回 / 取消 / 超时）＝传「不可支付」 */
  rscSyncAppPayable(r, s.ch === '用户App' && s.st !== 'PAYING');
  rscRenderOnlinePay(r); rscRefreshPanelBehind(r);
  var extra = (s.st === 'CANCELED' || s.st === 'TIMEOUT') ? '；收款渠道已置空可重选、折让项目已解锁' : '';
  npToast('演示场景：收款渠道＝' + (s.ch || '空') + '；支付状态＝' + (RSC_ORDER_PAY_STATE[s.st] || '—') + extra);
}
/* 还原为「打开弹框那一刻」的支付态（连续演示不同场景后回到原样） */
function rscDemoReset(idx){
  var r = rscGet(idx); if (!r) return;
  var b = window.__rscDemoBackup;
  if (!b || b.idx !== r.idx){ npToast('没有可还原的初始状态'); return; }
  r.__demoIx = null;
  r.payChannel = b.payChannel || ''; r.payState = b.payState || ''; r.payOrderNo = b.payOrderNo || '';
  r.payQrTime = b.payQrTime; r.appPayable = b.appPayable; r.appSyncTime = b.appSyncTime;
  rscRenderOnlinePay(r); rscRefreshPanelBehind(r);
  npToast('已还原为打开弹框时的状态');
}
function rscRenderOnlinePay(r, pickOverride){
  var ch = rscOnlineChannel(r), st = rscOrderPayState(r);
  var chans = rscOnlineChannelsOf(r);          /* 按门店支付能力给在线渠道（PRD 6.1.1 矩阵） */
  /* shown＝下拉该显示什么：用户刚选的预览值优先，其次已落定的渠道，都没有就显示「请选择」
     （渠道为空＝PRD 的「收款渠道置空」，必须看起来就是空的，不能默认显示成用户App）；
     pick＝按钮按哪个渠道给动作：没有选中值时按第一个可用渠道给默认动作（与 PRD 渠道空那格一致）。 */
  var shown = pickOverride || ch;
  var pick = shown || chans[0] || '';
  var chOpts = chans.length
    ? '<option value=""' + (shown ? '' : ' selected') + '>请选择</option>' +
      chans.map(function(c){
        return '<option' + (c === shown ? ' selected' : '') + '>' + npEscape(c) + '</option>';
      }).join('')
    : '';
  /* 收款渠道：未接入支付的门店（非直营·未接支付）没有在线渠道可选，显示只读「不支持在线支付」
     必填红星按用户口径保留（收款渠道是发起支付前必须落定的字段）
     · 渠道已落定 → 禁改；渠道为空（含支付已取消/已超时被系统置空）→ 可重新选择 */
  var channelField = chans.length
    ? npFormSelect('收款渠道', '<select id="rsc-pay-channel"' + (ch ? ' disabled' : '') + ' onchange="rscOnlineChannelPreview(' + r.idx + ')">' + chOpts + '</select>', true)
    : npFormItem('收款渠道', '<input type="text" readonly value="不支持在线支付">');
  /* ★ 行1＝4 个字段一行 4 列（PRD 6.1.1【收款】显示项原文：维修工单号、维修结算单号、收款渠道、收款金额）
     表单栅格只能用 .np-form-grid.col4（规范 §3.1.1「布局与控件分离」/ §3.1.2「禁止自造表单栅格」）。
     弹框宽度 1260 是实测值：22 位结算单号需要 195px 输入宽，4 等列下 1260px 才不裁字。 */
  var body =
    '<div class="np-form-grid col4">' +
      npFormItem('维修工单号', '<input type="text" readonly value="' + npEscape(r.order) + '">') +
      npFormItem('维修结算单号', '<input type="text" readonly value="' + npEscape(r.id) + '">') +
      channelField +
      npFormItem('收款金额', '<input type="text" readonly value="' + rscMoney(rscNet(r)) + '">') +
    '</div>';
  /* ★ 行2＝支付状态（第1列）+ 业务操作按钮（第4列）
     用户口径（2026-10-26 三次纠正）：「按钮，放在行2 的第 4 列，和演示切换区域不要焊死」。
     · 支付状态出现条件＝渠道已落定 或 有支付状态（支付已取消/已超时会把渠道置空，但状态要留着，
       此时不显示就会丢掉 PRD 行2 的显示项）；
     · 按钮固定落第 4 列（npFormActions），与行1/行2 同一张表单、同一底色，不再挂到弹框 footer、
       也不再和演示区挤在一起 —— 二维码内容再长也不会把按钮挤到二维码下面。 */
  var showState = !!(ch || st);
  body += '<div class="np-form-grid col4">' +
    (showState ? npFormItem('支付状态', '<input type="text" readonly value="' + npEscape(RSC_ORDER_PAY_STATE[st] || '') + '">') : '') +
    npFormActions(rscOnlineActions(r, pick)) +
    '</div>';
  /* 二维码：只有「支付二维码 + 待支付(支付中)」这一个场景出码；高度收到 160px 以便整框在小屏也放得下 */
  if (ch === '支付二维码' && st === 'PAYING'){
    body += '<div style="text-align:center;margin:0 0 4px">' +
      '<div style="width:160px;height:160px;margin:0 auto;border:1px solid #ddd;border-radius:6px;background:#fafafa;'
      + 'display:flex;flex-direction:column;align-items:center;justify-content:center;color:#666;font-size:12px;line-height:1.8">'
      + '<span>支付二维码</span><span>（微信 / 支付宝 二码合一）</span></div>' +
      '<div style="font-size:12px;color:#666;margin-top:6px">请用户使用微信或支付宝扫码支付；未支付时不要关闭本弹框</div>' +
      '</div>';
  }
  /* 演示切换区：排在弹框内容之后（正文含按钮）、不挂 footer、与按钮不共底色 */
  npOpenModal('在线支付', body, '', {width:1260, belowFooterHtml: rscDemoSwitchHtml(r)});
}
/* 收款渠道下拉只是「预选」，点了按钮才落定；切换时整框重绘（按钮已在表单行里，不能再只刷 footer） */
function rscOnlineChannelPreview(idx){
  var r = rscGet(idx); if (!r) return;
  var sel = document.getElementById('rsc-pay-channel');
  rscRenderOnlinePay(r, (sel && sel.value) || '');
}
/* 可操作项（行2 第4列的按钮）＝ PRD 6.1.1 表格「可操作项」列 ＋ 关闭，逐场景严格对应。
   pick 必须由调用方传入：不要在生成时回读正文里尚未插入的 DOM（会读到上一个弹框残留的
   disabled 下拉值，实测：还原后正文渠道空、按钮却显示「获取支付码」）。 */
function rscOnlineActions(r, pick){
  var ch = rscOnlineChannel(r), st = rscOrderPayState(r);
  var chans = rscOnlineChannelsOf(r);
  var btns = [];
  if (!chans.length){
    /* 未接入支付的门店：无任何在线操作项 */
  } else if (!ch){
    pick = pick || chans[0];
    btns.push(pick === '用户App'
      ? '<button class="lt-btn lt-btn-primary" onclick="rscOnlineSyncApp(' + r.idx + ')">同步给App</button>'
      : '<button class="lt-btn lt-btn-primary" onclick="rscOnlineGetQr(' + r.idx + ')">获取支付码</button>');
  } else if (ch === '用户App' && st === ''){
    btns.push('<button class="lt-btn lt-btn-default" onclick="rscOnlineWithdraw(' + r.idx + ')">撤回</button>');
  } else if (ch === '支付二维码' && st === 'PAYING'){
    btns.push('<button class="lt-btn lt-btn-default" onclick="rscOnlineCancelPay(' + r.idx + ')">取消支付</button>');
  }
  /* footer ＝ PRD「可操作项」+ 关闭，逐场景严格对应上表；
     「模拟支付成功（演示）」不是 PRD 的可操作项（PRD 该场景写「无」），已移入底部演示切换区。 */
  btns.push('<button class="lt-btn lt-btn-default" onclick="rscCloseOnlinePay(' + r.idx + ')">关闭</button>');
  return btns.join('');
}
/* 面板在弹框后面开着时，改动后原地重开，保证折让锁定/解锁与金额快照同步 */
function rscRefreshPanelBehind(r){
  var p = document.getElementById('rsc-panel');
  if (p && p.classList && p.classList.contains && p.classList.contains('show')) rscOpenPanel(r.idx);
}
function rscOnlineSyncApp(idx){
  var r = rscGet(idx); if (!r) return;
  r.__demoIx = null;                       /* 真实操作后不再按「点过的演示场景」高亮，改按真实状态反查 */
  r.payChannel = '用户App'; r.payState = '';
  if (!r.payOrderNo) r.payOrderNo = 'YJ_WXSK_' + r.order + '01';
  rscSyncAppPayable(r, true);
  rscRenderOnlinePay(r); rscRefreshPanelBehind(r);
  npToast('已把最新结算收款单同步给App（App 可支付）');
}
function rscOnlineGetQr(idx){
  var r = rscGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payChannel = '支付二维码'; r.payState = 'PAYING';
  if (!r.payOrderNo) r.payOrderNo = 'YJ_WXSK_' + r.order + '01';
  r.payQrTime = (typeof npNowLocal === 'function') ? npNowLocal() : '';
  rscSyncAppPayable(r, false);
  rscRenderOnlinePay(r); rscRefreshPanelBehind(r);
  npToast('已展示支付二维码（微信/支付宝二码合一），已向App传"不可支付"');
}
function rscOnlineWithdraw(idx){
  var r = rscGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payChannel = ''; r.payState = '';
  rscSyncAppPayable(r, false);
  rscRenderOnlinePay(r); rscRefreshPanelBehind(r);
  npToast('已撤回：向App传"不可支付"；收款渠道已置空，折让项目已解锁');
}
function rscOnlineCancelPay(idx){
  var r = rscGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payChannel = ''; r.payState = '';
  rscSyncAppPayable(r, false);
  rscRenderOnlinePay(r); rscRefreshPanelBehind(r);
  npToast('已取消支付：收款渠道已置空可重新选择，折让项目已解锁');
}
/* 演示专用：模拟支付平台回调成功（PRD 该场景无操作项） */
function rscOnlineDemoPaid(idx){
  var r = rscGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payState = 'SUCCESS'; r.status = 'PAID_PENDING_COLLECTION';
  rscSyncAppPayable(r, false);
  npCloseModal(); rscOpenPanel(idx);
  npToast('（演示）支付已到账，请点【收款】完成结算确认');
}
/* 关闭：处于「支付已取消 / 支付已超时」的，关闭时执行系统自动动作（渠道置空 + 折让解锁） */
function rscCloseOnlinePay(idx){
  var r = rscGet(idx);
  if (r){
    var st = rscOrderPayState(r);
    if (st === 'CANCELED' || st === 'TIMEOUT'){
      r.__demoIx = null;
      r.payChannel = ''; r.payState = '';
      rscSyncAppPayable(r, false);
      npCloseModal(); rscRenderAfterChange(r);
      npToast('收款渠道已自动置空，可重新选择；折让项目已解锁');
      return;
    }
  }
  npCloseModal();
}

/* ---------- 弹框：确认收款 ---------- */
function rscOpenCollection(idx){
  var r = rscGet(idx); if (!r) return;
  if (r.status !== 'PAID_PENDING_COLLECTION') { npToast('当前状态不可收款'); return; }
  /* 折让校验同【在线支付】：折让项目必须选、折让金额不能为 0（2026-10-26 用户口径） */
  var dErr = rscDiscountCheck(r);
  if (dErr) { npToast(dErr); return; }
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
   用户口径（2026-10-21 / 2026-10-26 两次拍板，均已并入 PRD 6.1.1【收款】渠道矩阵）：
   1 顶部信息区 4 格顺序＝维修工单号、结算单号、已收款金额、已退款金额
   2 表格去掉「票据号」列
   3 收退款渠道＝门店自行 / 支付二维码 / 用户App
     收退款方式（门店自行）＝微信 / 支付宝 / 银行卡 / 现金（**已去掉「挂账」**，2026-10-26 用户拍板）
     渠道与方式联动：门店自行 → 按门店类型：直营＝银行卡、现金；非直营＝微信、支付宝、银行卡、现金
                     支付二维码 → 只有微信、支付宝
                     用户App   → 只有微信、支付宝 */
var RSC_PAY_CHANNELS = ['门店自行', '支付二维码', '用户App'];
/* 门店自行（线下收款）的方式：非直营全量、直营只收银行卡/现金（PRD 表格：微信/支付宝 直营为空） */
var RSC_PAY_METHODS_OWN_DIRECT = ['银行卡', '现金'];
var RSC_PAY_METHODS_OWN = ['微信', '支付宝', '银行卡', '现金'];
var RSC_PAY_METHODS_ONLINE = ['微信', '支付宝'];
/* 按渠道取可用收退款方式（渠道→方式联动口径的唯一来源）
   第二参数：门店是否直营（不传＝按非直营全量，兼容旧调用点） */
function rscPayMethodsOf(channel, direct){
  if (channel === '门店自行') return direct ? RSC_PAY_METHODS_OWN_DIRECT.slice() : RSC_PAY_METHODS_OWN.slice();
  if (channel === '支付二维码' || channel === '用户App') return RSC_PAY_METHODS_ONLINE.slice();
  return [];
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
