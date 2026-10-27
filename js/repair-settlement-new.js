/* ============================================================
   售后管理 / 维保服务 / 维修结算收款(新)   ——  2026-10-26 新建
   ★ 本文件是 js/repair-settlement.js 的【变体副本】（用户口径：先复制「维修结算收款」的内容，再做改造）：
     · 全部标识符已整体换前缀：模块键 repair-settlement-new / 函数 rsc*→rsn* / 常量 RSC_*→RSN_* /
       发票页 rsi*→rsni* / 全部 DOM id 与 data-apply 同步换前缀（原页一字未动，两页互不干扰）。
     · 与老页的差异（只此三点，其余完全一致）：
       ① 收款详情面板底部【在线支付】+【收款】→ 合并为【确认并收款】（列表操作列的「收款」不变，它只是打开面板）；
       ② 弹框按新口径重排：行1＝维修工单号/维修结算单号/实际应收金额/预收款余额，
          行2＝预收款抵扣/收款渠道/收款方式（仅门店自行）/收款金额（收款金额＝实际应收−预收款抵扣，只读自动算）；
       ③ 收退款详情增加「预收款账户」渠道（预收款抵扣与预收款退回都记该渠道）。
     · 维护口径：本页仅用于「新老收款流程对比演示」。凡改动涉及收款流程规则（折让、金额口径、渠道方式联动、
       预收款余额派生），两页必须同步——改一处漏另一处就是口径漂移。若新页最终取代老页，
       直接删除老页与本文件头这段说明即可（退出条件）。
   ============================================================ */

NP['repair-settlement-new'] = { page:1, pageSize:20, allData:[], filtered:[], render:null, query:null, reset:null };

/* ---------- 状态枚举（照搬 920 invoice-management.js labels） ---------- */
var RSN_LABELS = {
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
var RSN_BADGE = {
  UNPAID:'warn', PAYING:'warn', PAID_PENDING_COLLECTION:'warn', PAID:'ok',
  REFUNDING:'warn', REFUNDED:'ok', REFUND_FAIL:'off', EXCEPTION:'off',
  WAITING_PAYMENT:'warn', SETTLED:'ok', REVERSED:'off', UNSETTLED:'warn',
  NOT_READY:'warn', PROCESSING:'warn', ISSUED:'ok', FAILED:'off',
  CREDITING:'warn', CREDITED:'off', CREDIT_FAIL:'off'
};
var RSN_REFUND_REASONS = ['重复收款','收款金额错误','维修项目取消或未实施','客户协商终止服务'];
/* ---------- 折让项目字典（2026-10-26 用户口径，规范 §4.9.2 登记） ----------
   顺序即下拉顺序，「其它」为兜底值。页面内禁止再写折让类型字面量（规范 §4.9 末条）。 */
var RSN_DISCOUNT_TYPES = ['按商务政策','折扣券','会员折扣','活动折扣','内部考核','总经理签免','二手车整备','集油卡抵机油','其它'];

/* ---------- 示例数据（9 行，字段与 920 结算单一一对应）
   门店按已拍板口径分布：直营（SCZ01/HBZ01）与非直营（上海浦东店/北京朝阳店/武汉光谷店）都有，
   用于验证「门店类型」取门店管理主数据，且「收款」与渠道模式无关
   2026-10-20 调整：日期平移到 2026-09-20 ~ 2026-10-19（规范默认区间＝上月今天~今天，
   否则进页面 0 条）；补报修人/报修人电话/报修日期（截图新增查询项需要）；
   服务顾问由人员主数据「门店服务顾问」在初始化时按门店回填（见 rsnApplyAdvisors） ---------- */
(function(){
  var a = [
    { id:'WXJSDYJ-HBZ05261019001', order:'Z05RO261019001', storeCode:'HBZ01', plate:'鄂A·E9201', vin:'LAB00R12635092001',
      date:'2026-10-19 15:20', reporter:'张伟', reporterPhone:'13800138001', reportDate:'2026-10-17',
      labor:'325.63', part:'351.62', total:'677.25',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'按商务政策', labor:'20.00', part:'0.00', remark:''}],
      /* 收退款流水（渠道→方式按联动规则：门店自行全量；支付二维码/用户App 只有微信、支付宝；
         预收款账户＝预收款抵扣 / 退回预收款账户，没有线下·线上方式，method 留空、明细里显示「—」） */
      payRecords:[
        { type:'收款', channel:'预收款账户', method:'', amount:'200.00', time:'2026-10-19 15:21', payState:'OK' },
        { type:'收款', channel:'门店自行', method:'现金', amount:'300.00', time:'2026-10-19 15:22', payState:'OK' },
        { type:'收款', channel:'门店自行', method:'现金', amount:'177.25', time:'2026-10-19 15:26', payState:'OK' }
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
        { type:'收款', channel:'预收款账户', method:'', amount:'100.00', time:'2026-10-12 10:19', payState:'OK' },
        { type:'收款', channel:'用户App', method:'支付宝', amount:'420.00', time:'2026-10-12 10:20', payState:'OK' },
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
      /* 预收款全额抵扣 + 预收款退回：收退款详情两笔都以「预收款账户」渠道展示 */
      payRecords:[
        { type:'收款', channel:'预收款账户', method:'', amount:'300.00', time:'2026-10-05 14:32', payState:'OK' },
        { type:'退款', channel:'预收款账户', method:'', amount:'300.00', time:'2026-10-05 14:40', payState:'OK' }
      ] },
    { id:'SK2026100200000001', order:'WX2026100200000001', storeCode:'WH001', plate:'鄂A·R9202', vin:'LAB00R12635092022',
      date:'2026-10-02 11:10', reporter:'黄军', reporterPhone:'13300133007', reportDate:'2026-09-30',
      labor:'180.00', part:'120.00', total:'300.00',
      status:'REFUNDED', settlement:'REVERSED', invoice:'CREDITED',
      discounts:[], refundRoute:'AFTER_COLLECTION', refundHadInvoice:true,
      refundReason:'维修项目取消或未实施', refundRequestNo:'RF-920-0022-1',
      payOrderNo:'YJ_WXSK_WX202610020000000101',
      /* 混合收款：预收款抵扣 100 + 支付二维码 200；退款按原路分别退回预收款账户与支付二维码 */
      payRecords:[
        { type:'收款', channel:'预收款账户', method:'', amount:'100.00', time:'2026-10-02 11:11', payState:'OK' },
        { type:'收款', channel:'支付二维码', method:'微信', amount:'200.00', time:'2026-10-02 11:12', payState:'OK' },
        { type:'退款', channel:'支付二维码', method:'微信', amount:'200.00', time:'2026-10-02 16:26', payState:'OK' },
        { type:'退款', channel:'预收款账户', method:'', amount:'100.00', time:'2026-10-02 16:27', payState:'OK' }
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
       ★ 折让金额必须非 0：rsnDiscountCheck 规定「折让金额为 0」不许进【收款】/【在线支付】，
         写成 0.00 会让这两个场景（以及第 1 行「渠道空」）压根打不开弹框，等于演示不出 PRD 场景。 ---------- */
    /* 非直营(接了支付) + 未支付 + 渠道已选「用户App」但 App 端还没调支付平台 → 支付状态＝未发起，可【撤回】 */
    { id:'WXJSDYJ-SH001261023015', order:'Z05RO261023015', storeCode:'SH001', plate:'沪A·M2315', vin:'LAP31CZ60SG920015',
      date:'2026-10-23 09:40', reporter:'周婕', reporterPhone:'13700137015', reportDate:'2026-10-21',
      labor:'300.00', part:'160.00', total:'460.00',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[{type:'按商务政策', labor:'10.00', part:'0.00', remark:''}],
      payChannel:'用户App', payState:'',
      payRecords:[] },
    /* 非直营(接了支付) + 未支付 + 用户App 支付已取消 → 无在线操作项（系统自动置空渠道、解锁折让）
       ★ 渠道必须为空：PRD/用户口径「支付已取消 → 收款渠道置空、可重选」，数据里若留着 用户App
         就会出现「提示说已置空、下拉却显示 用户App」的自相矛盾。 */
    { id:'WXJSDYJ-WH001261024016', order:'Z05RO261024016', storeCode:'WH001', plate:'鄂A·R9216', vin:'LAB00R12635092026',
      date:'2026-10-24 10:12', reporter:'马涛', reporterPhone:'13600136016', reportDate:'2026-10-22',
      labor:'360.00', part:'160.00', total:'520.00',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[], payChannel:'', payState:'CANCELED',
      payRecords:[] },
    /* 非直营(没接支付) + 未支付：验证「未接支付的门店只有门店自行（线下收款）」——
       收款渠道下拉里没有 用户App / 支付二维码（PRD 6.1.1 渠道矩阵）；
       车主孙丽华没有预收款记录 → 预收款余额 0.00，用来演示「无预收款」的行 */
    { id:'WXJSDYJ-CS001261025017', order:'Z05RO261025017', storeCode:'CS001', plate:'湘A·R9217', vin:'LAB00R12635092027',
      date:'2026-10-25 15:20', reporter:'谭磊', reporterPhone:'13500135017', reportDate:'2026-10-23',
      labor:'150.00', part:'88.00', total:'238.00',
      status:'UNPAID', settlement:'WAITING_PAYMENT', invoice:'NOT_READY',
      discounts:[],
      payRecords:[] }
  ];
  /* ★ 2026-10-26「维修结算收款(新)」：预收款余额按「车主 + 门店」现算（唯一来源＝预收款模块
     yskLedgerOf），所以结算单必须挂「车主」。车主取「系统设置 › 车主管理」客档主数据，
     并按门店挑**在该门店真正有预收款余额**的车主（上海浦东店/北京朝阳店/武汉光谷店/成都锦江店/
     武汉龙阳店都有充值记录），CS001 那两行故意挂没有预收款记录的车主 → 余额 0.00，
     用来演示「无预收款余额」的行。 */
  var RSN_OWNER_OF = {
    'WXJSDYJ-HBZ05261019001':'刘婉如',
    'WXJSDYJ-SCZ01261015011':'王雅静',
    'WXJSDYJ-SH001261012007':'沐云汐',
    'WXJSDYJ-HBZ05261010003':'刘婉如',
    'WXJSDYJ-BJ001261008006':'张建国',
    'SK2026100500000001':'王雅静',
    'SK2026100200000001':'陈志明',
    'SK2026092800000001':'王雅静',
    'SK2026092500000001':'张建国',
    'WXJSDYJ-SCZ01261007005':'王雅静',
    'WXJSDYJ-SH001261009009':'沐云汐',
    'WXJSDYJ-HBZ05261020013':'刘婉如',
    'WXJSDYJ-SH001261021014':'赵文博',
    'WXJSDYJ-SH001261023015':'沐云汐',
    'WXJSDYJ-WH001261024016':'陈志明',
    'WXJSDYJ-CS001261025017':'孙丽华'
  };
  a.forEach(function(r){ r.owner = RSN_OWNER_OF[r.id] || ''; });
  a.forEach(function(r, i){ r.idx = i; });
  NP['repair-settlement-new'].allData = a;
})();

/* ---------- 门店主数据取「门店类型」（唯一来源：门店管理） ---------- */
function rsnStore(code){
  var all = (NP['store-manage'] && NP['store-manage'].allData) || [];
  for (var i = 0; i < all.length; i++){ if (all[i].code === code) return all[i]; }
  return null;
}
/* 门店简称（新增「门店」列取值，与门店选择器回填口径一致） */
function rsnStoreShort(code){
  var s = rsnStore(code);
  return s ? (s.shortName || s.name) : '—';
}
/* 920 的 DIRECT 口径 → 取门店主数据的渠道模式：直营显示「直营店」，非直营显示「非直营店」 */
function rsnStoreType(r){
  var s = rsnStore(r.storeCode);
  if (!s) return '—';
  return s.channelMode === '直营' ? '直营店' : '非直营店';
}
/* 该结算单所属门店是否接入支付（在线渠道开关）
   直营店一律接入；非直营店看门店主数据 payEnabled（门店管理维护）——公共函数 storePayEnabled 唯一来源 */
function rsnStorePayEnabled(r){
  var s = rsnStore(r.storeCode);
  if (typeof storePayEnabled === 'function') return storePayEnabled(s);
  return s ? s.channelMode === '直营' : false;
}
/* 该门店可用的在线收退款渠道（PRD 6.1.1 渠道矩阵：非直营(没接支付) → 两个在线渠道都没有） */
function rsnOnlineChannelsOf(r){
  return rsnStorePayEnabled(r) ? RSN_ONLINE_CHANNELS.slice() : [];
}
/* ---------- 人员主数据：门店服务顾问（R06） ----------
   「服务顾问」查询项与列表列的唯一来源；示例数据的 advisor 也按门店回填，
   保证下拉选了能筛出数据（口径同原型规范：大区/小区/人员均以主数据为准） */
function rsnAdvisors(){
  var o = window.ORG_MASTER;
  if (!o || !o.personsByRole) return [];
  return o.personsByRole('R06');
}
function rsnAdvisorNames(){
  var seen = {}, out = [];
  rsnAdvisors().forEach(function(p){
    if (p && p.name && !seen[p.name]){ seen[p.name] = 1; out.push(p.name); }
  });
  return out;
}
function rsnApplyAdvisors(){
  var o = window.ORG_MASTER;
  if (!o || !o.personsByStore) return;
  var all = (NP['repair-settlement-new'] && NP['repair-settlement-new'].allData) || [];
  all.forEach(function(r){
    var ps = o.personsByStore(r.storeCode) || [];
    for (var i = 0; i < ps.length; i++){
      if (ps[i].roleId === 'R06'){ r.advisor = ps[i].name; break; }
    }
  });
}

/* ---------- 金额/状态派生 ---------- */
function rsnNum(v){ var n = parseFloat(String(v || '0').replace(/,/g,'')); return isNaN(n) ? 0 : n; }
function rsnMoney(v){ return rsnNum(v).toFixed(2); }
/* 折让金额＝工时折让＋配件折让（2026-10-26 用户口径）。
   ★ 唯一出口：数据里不再存 amount 字段，行金额一律由本函数派生——
     两处各存一份（amount 与 labor/part）必然漂移，改完一处漏另一处就是对不上账。 */
function rsnDiscountAmt(d){ return rsnNum(d && d.labor) + rsnNum(d && d.part); }
function rsnDiscountTotal(r){
  return (r.discounts || []).reduce(function(s, d){ return s + rsnDiscountAmt(d); }, 0);
}
/* 实际收款金额 = 应收总额 - 折让合计 */
function rsnNet(r){ return Math.max(0, Math.round((rsnNum(r.total) - rsnDiscountTotal(r)) * 100) / 100); }
function rsnInvoiceAmount(r){ return rsnNet(r); }
/* ---------- 预收款（2026-10-26「维修结算收款(新)」新增口径） ----------
   · 预收款余额唯一来源＝「售后管理 › 维保服务 › 预收款」页的派生函数 yskLedgerOf(车主, 门店)
     （余额＝累计充值 − 累计使用，任何时候现算）。**禁止**在本页另存一份余额，
       两处各存一份必然漂移，改完一处漏另一处就是对不上账。
   · 预收款抵扣＝向「预收款」写一条「使用」流水（业务＝维修结算），余额与明细立即跟随；
     刷新页面（重新加载演示数据）即恢复种子值——这是原型口径，不是后台落库。
   · 预收款账户作为「收退款详情」的一个收退款渠道：预收款抵扣记「收款」、
     退回预收款账户记「退款」，渠道一律显示「预收款账户」，收退款方式为空（显示「—」）。 */
function rsnPrepaidBalance(r){
  if (typeof yskLedgerOf !== 'function') return 0;
  var it = yskLedgerOf(r.owner || '', r.storeCode);
  return it ? Math.max(0, rsnNum(it.balance)) : 0;
}
/* 弹框里展示的「预收款余额」：演示场景可临时覆盖（__demoBal），不覆盖时用真实余额 */
function rsnShownBalance(r){
  var d = r.__demoBal;
  return (typeof d === 'number') ? Math.max(0, d) : rsnPrepaidBalance(r);
}
/* 预收款抵扣落库：写「预收款」使用流水（唯一权威：余额＝充值−使用） */
function rsnWritePrepaidUsage(r, amount, time){
  if (!r.owner || rsnNum(amount) <= 0) return false;
  if (!Array.isArray(window.YSK_USAGE)) return false;
  window.YSK_USAGE.push({
    owner: r.owner,
    storeCode: r.storeCode,
    biz: '维修结算',
    amount: rsnMoney(amount),
    time: time || ((typeof npNowLocal === 'function') ? npNowLocal() : '')
  });
  return true;
}
function rsnBadge(key, label){
  return '<span class="lt-badge ' + (RSN_BADGE[key] || 'warn') + '">' + npEscape(label) + '</span>';
}
/* 发票卡片状态 → 结算单发票状态码（列表发票状态列与发票整页卡片保持同一口径） */
var RSN_CARD_CODE = { '开票中':'PROCESSING', '开票成功':'ISSUED', '作废冲红中':'CREDITING', '已冲红':'CREDITED',
  '开票失败':'FAILED', '作废失败':'CREDIT_FAIL' };
/* 发票状态显示文案（照搬 920 invoiceLabel 逻辑） */
function rsnInvoiceLabel(r){
  /* 已挂发票卡片时：以最新一张卡片为准（发票整页与列表列同一口径） */
  var cards = rsnInvoices(r);
  if (cards.length){
    var code = RSN_CARD_CODE[cards[0].state];
    if (code) return RSN_LABELS.invoice[code];
  }
  if (r.invoice === 'ISSUED') return RSN_LABELS.invoice.ISSUED;
  if (r.invoice !== 'NOT_READY') return RSN_LABELS.invoice[r.invoice];
  if (r.status === 'REFUNDING' || r.status === 'REFUNDED' || r.status === 'REFUND_FAIL') return '未开票';
  if (r.status !== 'PAID' || r.settlement !== 'SETTLED') return '待完成收款';
  return '待开票';
}
/* 列表发票状态列的 badge key（跟随卡片口径） */
function rsnInvoiceBadgeKey(r){
  var cards = rsnInvoices(r);
  if (cards.length){
    var code = RSN_CARD_CODE[cards[0].state];
    if (code) return code;
  }
  return r.invoice;
}
/* 是否可开票（照搬 920 canInvoice） */
function rsnCanInvoice(r){ return r.status === 'PAID' && r.settlement === 'SETTLED'; }
/* 是否处于退款流程（照搬 920） */
function rsnInRefund(r){ return r.status === 'REFUNDING' || r.status === 'REFUNDED' || r.status === 'REFUND_FAIL'; }

/* ---------- 列表页 ---------- */
/* ★ 2026-10-26 事故修复：本函数原与 js/repair-settlement.js 的 initRepairSettlement() 同名。
   本文件在 index.html 里后加载，同名顶层函数声明会覆盖老页的同名全局 —— 于是点老菜单
   「维修结算收款」时跑的是本文件的实现（root 取 #page-repair-settlement-new，而那一页是 display:none），
   老页 #page-repair-settlement 永远拿不到内容，表现为「菜单内容被清空」。
   结论：两页各用各的入口名，禁止跨文件同名顶层函数（自检 tests/modules/global-name-collision.js 兜底）。 */
function initRepairSettlementNew(){
  var K = 'repair-settlement-new'; var st = NP[K];

  /* 日期区间：label 随「日期类型」联动（提交结算日期 / 报修日期） */
  var dateRangeHtml = '<div class="lt-filter-item"><div class="lt-date-range"><span class="lt-filter-prefix" id="rsn-f-date-label">提交结算日期</span>'
    + '<input type="text" readonly class="lt-date-range-text" value="" placeholder="开始日期-结束日期" onclick="toggleDateRangePicker(this)" data-callback="rsnApplyFilter">'
    + '<div class="lt-date-range-drop">'
    + '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="rsn-flt-date-start" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">'
    + '<span>—</span>'
    + '<input type="text" placeholder="yyyy-mm-dd" onfocus="this.type=\'date\';this.classList.add(\'date-shim\')" onblur="if(!this.value){this.type=\'text\';this.classList.remove(\'date-shim\')}" id="rsn-flt-date-end" value="" onchange="updateDateRangeDisplay(this);this.classList.remove(\'date-shim\')">'
    + '</div></div></div>';

  /* 门店：系统全局统一门店选择器（穿梭框），数据源＝门店管理主数据 */
  var storePickHtml = '<div class="lt-filter-item"><div class="lt-input-wrap search store-pick">'
    + '<span class="lt-filter-prefix">门店</span>'
    + '<input type="text" id="rsn-f-store" placeholder="请选择" readonly onclick="msOpenStorePicker(\'rsn-f-store\')">'
    + '<svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#999" stroke-width="1.2"/><path d="M11 11L14.5 14.5" stroke="#999" stroke-width="1.2" stroke-linecap="round"/></svg>'
    + '</div></div>';

  /* 服务顾问：选项取人员主数据「门店服务顾问」(R06) */
  var advisorOpts = rsnAdvisorNames().map(function(n){
    return '<option value="' + npEscape(n) + '">' + npEscape(n) + '</option>';
  }).join('');

  /* 结算状态：2 个独立单选（已结算 / 已提交结算申请），无框无标签，单独占 1 格；默认都不选＝不过滤 */
  var settleRadioHtml = '<div class="lt-filter-item"><span class="lt-radio-group">'
    + '<label class="lt-radio"><input type="radio" name="rsn-f-settle" value="SETTLED"><span>已结算</span></label>'
    + '<label class="lt-radio"><input type="radio" name="rsn-f-settle" value="UNSETTLED"><span>已提交结算申请</span></label>'
    + '</span></div>';

  var filter =
    npSelect('品牌','<select id="rsn-f-brand"><option value="">请选择</option><option>奕境汽车</option></select>') +
    storePickHtml +
    npSelect('日期类型','<select id="rsn-f-datetype" onchange="rsnDateTypeChange()"><option value="提交结算日期">提交结算日期</option><option value="报修日期">报修日期</option></select>') +
    dateRangeHtml +
    npFItem('VIN','<input type="text" id="rsn-f-vin" placeholder="请输入">') +
    npFItem('维修工单号','<input type="text" id="rsn-f-order" placeholder="请输入">') +
    npFItem('车牌号','<input type="text" id="rsn-f-plate" placeholder="请输入">') +
    npFItem('报修人','<input type="text" id="rsn-f-reporter" placeholder="请输入">') +
    npFItem('报修人电话','<input type="text" id="rsn-f-reporter-phone" placeholder="请输入">') +
    npSelect('服务顾问','<select id="rsn-f-advisor"><option value="">请选择</option>' + advisorOpts + '</select>') +
    settleRadioHtml;

  var toolbar = '<button class="lt-btn lt-btn-default" onclick="rsnRefreshStatus()">刷新状态</button>'
    + '<button class="lt-btn lt-btn-default" onclick="rsnExport()">导出</button>';

  function money(v){ return '<span style="color:#185FA5">¥' + rsnMoney(v) + '</span>'; }

  var cols = [
    {t:'序号', w:60, cls:'col-seq sticky', f:function(r,i){ return i+1; }},
    {t:'维修工单号', w:150, cls:'col-order sticky', f:function(r){
      return '<a href="javascript:void(0)" class="lt-btn-link" onclick="rsnOpenPanel(' + r.idx + ')">' + npEscape(r.order) + '</a>';
    }},
    {t:'结算单号', w:210, f:function(r){ return npEscape(r.id); }},
    {t:'门店', w:110, f:function(r){ return npEscape(rsnStoreShort(r.storeCode)); }},
    {t:'门店类型', w:100, f:function(r){ return rsnStoreType(r); }},
    {t:'车牌号', w:110, f:function(r){ return npEscape(r.plate); }},
    {t:'VIN码', w:200, f:function(r){ return npEscape(r.vin); }},
    {t:'服务顾问', w:100, f:function(r){ return npEscape(r.advisor); }},
    {t:'提交结算日期', w:150, f:function(r){ return npEscape(r.date); }},
    {t:'工时应收', w:110, f:function(r){ return money(r.labor); }},
    {t:'配件应收', w:110, f:function(r){ return money(r.part); }},
    {t:'应收总额', w:120, f:function(r){ return money(r.total); }},
    {t:'支付状态', w:170, f:function(r){ return rsnBadge(r.status, RSN_LABELS.status[r.status]); }},
    {t:'结算状态', w:110, f:function(r){ return rsnBadge(rsnSettleState(r), rsnSettleLabel(r)); }},
    {t:'发票状态', w:150, f:function(r){ return rsnBadge(rsnInvoiceBadgeKey(r), rsnInvoiceLabel(r)); }},
    {t:'操作', w:150, cls:'col-actions sticky', f:function(r){ return rsnActions(r); }}
  ];

  var root = document.getElementById('page-repair-settlement-new');
  if (!root) return;
  root.innerHTML = npShell(K, {l2:'售后管理', l3:'维修结算收款'}, filter, toolbar, npTH(cols), 'rsn-tbody', 'rsn-pager');
  initFilterGrid(K + '-filterGrid', 7); NP[K]._fShow = 7; NP[K]._fExp = false;
  /* 服务顾问按门店从人员主数据回填（保证下拉选了能筛出数据） */
  rsnApplyAdvisors();
  /* 日期默认值：规范「上月今天~今天」 */
  rsnSetDefaultRange();

  st.query = function(){
    function val(id){ var v = (document.getElementById(id) || {}).value || ''; return v === '请选择' ? '' : v; }
    var brand = val('rsn-f-brand');
    var store = val('rsn-f-store');
    var dateType = val('rsn-f-datetype') || '提交结算日期';
    var vin = val('rsn-f-vin').toUpperCase();
    var order = val('rsn-f-order').toUpperCase();
    var plate = val('rsn-f-plate');
    var reporter = val('rsn-f-reporter');
    var reporterPhone = val('rsn-f-reporter-phone');
    var advisor = val('rsn-f-advisor');
    var settle = '';
    var sr = document.querySelector('input[name="rsn-f-settle"]:checked');
    if (sr) settle = sr.value;
    var ds = (document.getElementById('rsn-flt-date-start') || {}).value || '';
    var de = (document.getElementById('rsn-flt-date-end') || {}).value || '';
    var storeNames = store.split(/[,，、]/).map(function(s){ return s.trim(); }).filter(Boolean);
    st.filtered = st.allData.filter(function(r){
      var d = (dateType === '报修日期' ? (r.reportDate || '') : r.date.slice(0, 10));
      return (brand === '' || brand === '奕境汽车') &&
        (storeNames.length === 0 || storeNames.indexOf(rsnStoreShort(r.storeCode)) >= 0) &&
        (vin === '' || r.vin.indexOf(vin) >= 0) &&
        (order === '' || r.order.indexOf(order) >= 0 || r.id.indexOf(order) >= 0) &&
        (plate === '' || r.plate.indexOf(plate) >= 0) &&
        (reporter === '' || (r.reporter || '').indexOf(reporter) >= 0) &&
        (reporterPhone === '' || (r.reporterPhone || '').indexOf(reporterPhone) >= 0) &&
        (advisor === '' || r.advisor === advisor) &&
        (settle === '' || rsnSettleState(r) === settle) &&
        (ds === '' || d >= ds) && (de === '' || d <= de);
    });
    st.page = 1; st.render();
  };
  st.reset = function(){
    ['rsn-f-brand','rsn-f-store','rsn-f-vin','rsn-f-order','rsn-f-plate',
     'rsn-f-reporter','rsn-f-reporter-phone','rsn-f-advisor']
      .forEach(function(id){ var e = document.getElementById(id); if (e) e.value = ''; });
    var dt = document.getElementById('rsn-f-datetype');
    if (dt) dt.value = '提交结算日期';
    var lb = document.getElementById('rsn-f-date-label');
    if (lb) lb.textContent = '提交结算日期';
    var rs = document.querySelectorAll('input[name="rsn-f-settle"]');
    for (var i = 0; i < rs.length; i++) rs[i].checked = false;
    /* 日期恢复规范默认值（上月今天~今天） */
    rsnSetDefaultRange();
    st.filtered = st.allData.slice(); st.page = 1; st.render();
  };
  st.render = function(){ npRenderTable(K, 'rsn-tbody', 'rsn-pager', cols, st.filtered, st); };
  st.filtered = st.allData.slice(); st.page = 1; st.render();
}
/* 默认日期区间：规范「上月今天~今天」（npDefaultDateRange 统一口径，禁止手写） */
function rsnSetDefaultRange(){
  if (!document.getElementById('rsn-flt-date-start')) return;
  npDefaultDateRange('rsn-flt-date-start', 'rsn-flt-date-end');
}
/* 「日期类型」切换：日期区间 label 联动 */
function rsnDateTypeChange(){
  var dt = document.getElementById('rsn-f-datetype');
  var lb = document.getElementById('rsn-f-date-label');
  if (dt && lb) lb.textContent = dt.value;
}
/* 结算状态两态：已结算 / 未结算
   —— 反结算（REVERSED）不单独显示在「结算状态」列里，只在数据层保留标记 */
function rsnSettleState(r){
  return (r.settlement === 'SETTLED') ? 'SETTLED' : 'UNSETTLED';
}
function rsnSettleLabel(r){
  return rsnSettleState(r) === 'SETTLED' ? '已结算' : '未结算';
}
function rsnApplyFilter(){ var st = NP['repair-settlement-new']; if (st && st.query) st.query(); }

/* ---------- 操作列按钮规则（唯一依据＝工单结算状态，2026-10-23 用户纠正后确立）----------
   未结算：收款、收退款详情、发票
   已结算：查看、打印、收退款详情、发票
   ★ 支付状态不参与判定：任何状态（含支付异常）都只能落在上面两档里，不设例外。
     原「支付异常行独占查看异常」是我自造的例外，已于 2026-10-23 删除。
   「收退款详情」取代原「查看退款」（后者是它的子集）
   「发票」每行都出：反结算行可能留有历史发票
   点击效果：收退款详情 / 查看 / 打印 暂做占位提示，待补 */
function rsnActions(r){
  var ops = [];
  if (rsnSettleState(r) === 'SETTLED') {
    /* 已结算：查看、打印 */
    ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="npToast(\'查看结算单（原型演示）\')">查看</a>');
    ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="npToast(\'打印结算单（原型演示）\')">打印</a>');
  } else {
    /* 未结算：收款（与门店渠道模式无关，直营/非直营都出）
       退款流程行（退款中/已退款/退款失败）也出「收款」——否则这些行点不开收款详情面板，
       面板底部的「本轮已结束/本轮不可收款/再次收款」永远看不到，成为死路 */
    ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="rsnOpenPanel(' + r.idx + ')">收款</a>');
  }
  ops.push('<a href="javascript:void(0)" class="lt-btn-link" onclick="rsnOpenPayRefundDetail(' + r.idx + ')">收退款详情</a>');
  ops.push(rsnInvoiceEntry(r));
  return npRenderActions(ops, 4);
}
/* 注：「收退款详情」弹框实现见下方 rsnOpenPayRefundDetail（函数声明提升，可直接调用） */
function rsnInvoiceButton(r){
  /* 收款详情面板底部的「发票」按钮：仅可开票 / 已开票时出（面板口径，不随列表规则变） */
  if (r.invoice === 'CREDITING' || r.invoice === 'CREDITED' || r.invoice === 'CREDIT_FAIL') return '';
  if (!rsnCanInvoice(r) && r.invoice !== 'ISSUED') return '';
  return '<a href="javascript:void(0)" class="lt-btn-link" onclick="rsnOpenInvoicePage(' + r.idx + ')">发票</a>';
}
/* 列表操作列的「发票」入口：每行都出（反结算行可能留有历史发票，可进去查看） */
function rsnInvoiceEntry(r){
  return '<a href="javascript:void(0)" class="lt-btn-link" onclick="rsnOpenInvoicePage(' + r.idx + ')">发票</a>';
}

/* ---------- 工具栏 ---------- */
function rsnRefreshStatus(){
  NP['repair-settlement-new'].render();
  npToast('状态、结算状态和发票状态已刷新');
}
function rsnExport(){
  var st = NP['repair-settlement-new'];
  var data = (st && st.filtered) ? st.filtered : [];
  if (!data.length) { npToast('当前没有可导出的数据'); return; }
  var headers = ['维修工单号','结算单号','门店','门店类型','车牌号','VIN码','服务顾问','提交结算日期',
    '工时应收','配件应收','应收总额','支付状态','结算状态','发票状态'];
  var rows = data.map(function(r){
    return [r.order, r.id, rsnStoreShort(r.storeCode), rsnStoreType(r), r.plate, r.vin, r.advisor, r.date,
      rsnMoney(r.labor), rsnMoney(r.part), rsnMoney(r.total),
      RSN_LABELS.status[r.status], rsnSettleLabel(r), rsnInvoiceLabel(r)];
  });
  npExportExcelRowsRaw('维修结算收款清单', headers, rows);
}

/* ============================================================
   收款详情侧滑面板（pm-panel 范式）
   ============================================================ */
function rsnEnsurePanel(){
  if (document.getElementById('rsn-panel-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML =
    '<div class="pm-panel-overlay" id="rsn-panel-overlay" onclick="rsnClosePanel()"></div>' +
    '<div class="pm-panel" id="rsn-panel" style="width:1000px">' +
      '<div class="pm-panel-header">' +
        '<div style="display:flex;align-items:center">' +
          '<span class="pm-panel-title" id="rsn-panel-title">维修结算收款</span>' +
          '<span class="pm-panel-badge" id="rsn-panel-badge">详情</span>' +
        '</div>' +
        '<button class="pm-panel-close" onclick="rsnClosePanel()">&#10005;</button>' +
      '</div>' +
      '<div class="pm-panel-body">' +
        '<div class="pm-tip-warn" id="rsn-lock-tip"></div>' +
        '<div class="pm-section-title">结算单信息</div>' +
        '<div class="pso-info-grid" id="rsn-order-info"></div>' +
        '<div class="pm-section-title">折让项目 <span id="rsn-discount-toolbar" class="pp-parts-toolbar"></span></div>' +
        /* 2026-10-26：这里不能再包 overflow-x:auto —— 表格内「折让项目」是模糊下拉，
           overflow-x:auto 会把 overflow-y 一并变成 auto，最后一行下拉列表被裁掉。
           列宽（2026-10-26 用户反馈「折让项目里的项目挤到换行、备注太宽」后按实测调）：
           折让项目 120→180（模糊下拉要放得下最长字典值「集油卡抵机油」，实测 120 时该选项折成两行 46px），
           备注由自动列（实测 353px）改为声明 140px 收窄；表格仍 width:100% 撑满面板，
           余量按列宽比例摊回，实测折让项目 218px / 备注 169px。 */
        '<div style="margin-bottom:8px">' +
          '<table class="pp-parts-table" id="rsn-discount-table">' +
            '<thead><tr>' +
              '<th style="width:40px">序号</th>' +
              '<th style="width:180px">折让项目</th>' +
              '<th style="width:100px">折让金额</th>' +
              '<th style="width:100px">工时折让</th>' +
              '<th style="width:100px">配件折让</th>' +
              '<th style="width:140px">备注</th>' +
              '<th style="width:70px">操作</th>' +
            '</tr></thead>' +
            '<tbody id="rsn-discount-tbody"></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="lt-form-item full" style="margin-bottom:16px"><span class="lt-form-label">推荐项目</span>' +
          '<textarea id="rsn-recommend" rows="2" readonly></textarea>' +
        '</div>' +
        '<div class="pm-section-title">金额账类 <span id="rsn-net-tip" style="float:right;font-weight:400;color:#333"></span></div>' +
        '<div style="overflow-x:auto;margin-bottom:8px">' +
          '<table class="lt-table" id="rsn-account-table">' +
            '<thead><tr>' +
              '<th style="width:110px">项目</th><th>用户</th><th>免保</th><th>保修</th><th>保险</th><th>内部</th><th>协议</th><th>合计</th>' +
            '</tr></thead>' +
            '<tbody id="rsn-account-tbody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="pm-panel-footer" id="rsn-panel-footer"></div>' +
    '</div>';
  while (d.firstChild) document.body.appendChild(d.firstChild);
}
function rsnClosePanel(){
  var o = document.getElementById('rsn-panel-overlay');
  var p = document.getElementById('rsn-panel');
  if (o) o.classList.remove('show');
  if (p) p.classList.remove('show');
}
function rsnGet(idx){
  var all = (NP['repair-settlement-new'] && NP['repair-settlement-new'].allData) || [];
  return npFindByIdx(all, idx);
}
/* 状态变更后：列表与面板同步（面板开着就原地重开） */
function rsnRenderAfterChange(r){
  var st = NP['repair-settlement-new'];
  if (st) st.render();
  var p = document.getElementById('rsn-panel');
  if (p && p.classList.contains('show')) rsnOpenPanel(r.idx);
}
/* 只读信息项（文字在框里，复用 .pso-info-grid / .pso-info-item 既有结构） */
function rsnInfoItem(label, value){
  return '<div class="pso-info-item"><span class="pso-info-label">' + npEscape(label) + '</span>'
    + '<span class="pso-info-value">' + npEscape(value === undefined || value === null || value === '' ? '—' : value) + '</span></div>';
}
function rsnOpenPanel(idx){
  rsnEnsurePanel();
  var r = rsnGet(idx);
  if (!r) { npToast('未找到该结算单'); return; }
  window.__rsnCur = r;
  document.getElementById('rsn-panel-title').textContent = '维修结算收款';
  var badge = document.getElementById('rsn-panel-badge');
  badge.textContent = RSN_LABELS.status[r.status];
  badge.className = 'pm-panel-badge ' + (r.status === 'PAID' ? 'pass' : (r.status === 'EXCEPTION' || r.status === 'REFUND_FAIL' ? 'reject' : ''));

  /* 封存条文案（照搬 920 setMode 的 lockTitle / lockText） */
  document.getElementById('rsn-lock-tip').innerHTML =
    '<b>' + npEscape(rsnLockTitle(r)) + '</b><br>' + npEscape(rsnLockText(r));

  var store = rsnStore(r.storeCode);
  document.getElementById('rsn-order-info').innerHTML =
    rsnInfoItem('维修工单号', r.order) +
    rsnInfoItem('结算单号', r.id) +
    rsnInfoItem('车主', r.owner) +
    rsnInfoItem('预收款余额', rsnMoney(rsnPrepaidBalance(r))) +
    rsnInfoItem('车牌号', r.plate) +
    rsnInfoItem('VIN', r.vin) +
    rsnInfoItem('服务顾问', r.advisor) +
    rsnInfoItem('门店', store ? store.name : '—') +
    rsnInfoItem('门店编码', r.storeCode) +
    rsnInfoItem('渠道模式', store ? store.channelMode : '—') +
    rsnInfoItem('纳税人识别号', store && store.taxNo ? store.taxNo : '—') +
    rsnInfoItem('支付商户号', rsnMerchantNo(r)) +
    rsnInfoItem('结算状态', rsnSettleLabel(r)) +
    rsnInfoItem('提交结算日期', r.date);

  /* 折让项目：仅「未支付」可增删，其余状态只读
     2026-10-26 PRD 6.1.1【收款】第1条：每次在「维修结算收款」界面点操作列【收款】，都要调支付接口，
     查订单是否有支付中的、并查 DMS 的支付收款记录判断订单是否已支付；
     有支付中（待支付）或已支付的 → 折让区域不可编辑（撤回 / 取消支付 / 支付超时后解锁）。 */
  rsnPayInterfaceCheck(r);
  /* 可编辑条件只允许一处判定：rsnDiscountEditable()（本处与 rsnRenderDiscounts 共用，禁止各写一遍） */
  var canEditDiscount = rsnDiscountEditable(r);
  document.getElementById('rsn-discount-toolbar').innerHTML = canEditDiscount
    ? '<button class="lt-btn lt-btn-default" onclick="rsnAddDiscount()">新增折让</button>'
    : (rsnPayLocked(r) ? '<span style="font-size:12px;color:#861B2F">' + npEscape(rsnPayLockReason(r)) + '</span>' : '');
  rsnRenderDiscounts(r);

  var rec = document.getElementById('rsn-recommend');
  rec.value = r.recommend || '';

  /* 金额账类 + 底栏合计：抽成 rsnRenderAccount()，折让改动后只刷这一块（不整表重绘） */
  rsnRenderAccount(r);

  document.getElementById('rsn-panel-overlay').classList.add('show');
  document.getElementById('rsn-panel').classList.add('show');
}
/* 金额账类（应收/实收/差额）＋ 底栏合计（总金额/总折让额/待支付）＋ 底部按钮
   折让金额改动时由 rsnDiscountRecalc() 复用，保证"改折让 → 金额账类与待支付同步"只有一份实现 */
function rsnRenderAccount(r){
  var total = rsnNum(r.total), net = rsnNet(r), diff = total - net;
  var zero = '<span style="color:#999">¥ 0.00</span>';
  var moneyTd = function(v){ return '<span style="color:#185FA5">¥ ' + v.toFixed(2) + '</span>'; };
  var tip = document.getElementById('rsn-net-tip');
  if (tip) tip.textContent = '实际收款金额 ¥' + rsnMoney(net);
  var tb = document.getElementById('rsn-account-tbody');
  if (tb) tb.innerHTML =
    '<tr><td><b>应收金额</b></td><td>' + moneyTd(total) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(total) + '</td></tr>' +
    '<tr><td><b>实收金额</b></td><td>' + moneyTd(net) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(net) + '</td></tr>' +
    '<tr><td><b>差额</b></td><td>' + moneyTd(diff) + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + zero + '</td><td>' + moneyTd(diff) + '</td></tr>';
  /* 底部条（照搬 920 payment-bar） */
  var ft = document.getElementById('rsn-panel-footer');
  if (ft) ft.innerHTML =
    '<div class="pp-panel-totals" style="margin-right:auto;text-align:left">'
    + '总金额 <b>¥' + rsnMoney(total) + '</b> · 总折让额 <b>¥' + rsnMoney(rsnDiscountTotal(r)) + '</b> · 待支付 <b>¥' + rsnMoney(net) + '</b>'
    + '</div>' + rsnFooterButtons(r);
}
function rsnMerchantNo(r){
  var s = rsnStore(r.storeCode);
  if (!s) return '—';
  return 'MER-YJ-' + s.code;
}
function rsnLockTitle(r){
  if (r.settlement === 'REVERSED' || r.status === 'REFUNDED') return '本轮支付与优惠保持归档';
  if (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL') return RSN_LABELS.status[r.status];
  if (r.status === 'EXCEPTION') return '支付结果待核对';
  if (r.status === 'PAYING') return '当前页面已封存';
  if (r.status === 'PAID_PENDING_COLLECTION') return '已收到支付成功回调';
  if (r.status === 'PAID') return '服务中心已写入结算单';
  /* 2026-10-26 用户口径：支付已取消 / 支付已超时 → 收款渠道置空、折让解锁可编辑，
     封存条不能再写「折让不可修改」（原样会与可编辑自相矛盾）。 */
  var st = rsnOrderPayState(r);
  if (st === 'CANCELED') return '支付已取消';
  if (st === 'TIMEOUT') return '支付已超时';
  /* 2026-10-27：订单在支付中也要说清楚，否则底栏【确认并收款】点了只会被拦下来（用户报「点不动」） */
  if (st === 'PAYING') return '订单支付中（待支付）';
  return '当前页面已封存';
}
function rsnLockText(r){
  if (r.settlement === 'REVERSED' || r.status === 'REFUNDED') {
    return r.refundRoute === 'BEFORE_COLLECTION'
      ? '退款已完成，可点击【再次收款】开始新一轮支付。'
      : '反结算、发票红冲和退款均已完成，可点击【再次收款】开始新一轮支付。';
  }
  if (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL') return '请核对本次退款结果，当前不可收款或再次支付。';
  if (r.status === 'EXCEPTION') return '请联系财务核对原支付单，当前不可修改金额、再次支付或确认收款。';
  if (r.status === 'PAYING') return '支付二维码已绑定本轮金额快照，折让项目和应收金额不可修改。';
  if (r.status === 'PAID_PENDING_COLLECTION') return '金额快照继续封存，可选择【确认并收款】完成结算，或选择【退款】原路退回。';
  if (r.status === 'PAID') return '收款、折让项目和支付信息已归档，页面保持只读，可在详情或列表发起开票。';
  var st = rsnOrderPayState(r);
  if (st === 'CANCELED') return '用户已在App端取消支付：收款渠道已置空，可重新选择；折让项目已解锁，可编辑。';
  if (st === 'TIMEOUT') return '支付已超时：收款渠道已置空，可重新选择；折让项目已解锁，可编辑。';
  if (st === 'PAYING') return '用户正在支付（待支付）：等支付回调到账后再点【确认并收款】完成结算；此期间不要重复收款。';
  return '支付二维码已绑定当前金额版本，折让项目和应收金额暂不可修改。';
}
function rsnFooterButtons(r){
  var btns = [];
  if (r.settlement === 'REVERSED' || r.status === 'REFUNDED') {
    btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'本轮已结束\')">本轮已结束</button>');
    btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'本轮不可收款\')">本轮不可收款</button>');
    btns.push('<button class="lt-btn lt-btn-default" onclick="rsnNewCycle(' + r.idx + ')">再次收款</button>');
  } else if (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL') {
    btns.push('<button class="lt-btn lt-btn-default" onclick="npToast(\'本轮已支付\')">本轮已支付</button>');
    btns.push('<button class="lt-btn lt-btn-default" onclick="rsnOpenRefund(' + r.idx + ')">' + (r.status === 'REFUND_FAIL' ? '退款待核对' : '退款中') + '</button>');
  } else {
    /* ★ 2026-10-26「维修结算收款(新)」口径：【在线支付】+【收款】合二为一 → 【确认并收款】
       （用户原话：「『在线支付』和『收款』合二为一，叫：确认并收款」——
        合并点在**收款详情侧滑面板的底部按钮**，列表操作列的「收款」不变，它只是打开本面板）
       · 一个入口同时覆盖线下（门店自行）与在线（用户App / 支付二维码）收款，
         收款渠道在弹框行2 里选：门店自行永远可选；在线渠道按门店支付能力给（非直营·未接支付没有）。
         因此本按钮不再按「门店是否接入支付」显隐——没接支付的门店照样要收线下款。
       · 支付异常行不出该按钮：封存条已写「不可修改金额、再次支付或确认收款」，出个点不动的按钮自相矛盾
         （沿用 2026-10-23 已拍板的「不能操作的按钮不显示」口径）。
       · 已收款行显示「已收款」并置灰：本页确认收款后仍停在面板上，不能让用户以为还能再收一次。
    ★★ 2026-10-27 用户报「确认并收款有时候点不动，尤其是选了支付方式、关掉弹窗再点」——
       根因：这里原先把「净额 0」「订单支付中」两档也加了 `disabled`，而全站**没有 `.lt-btn:disabled`
       的置灰样式**（style.css 里只有分页按钮与表单输入框的 `:disabled`），
       于是按钮长得跟正常按钮一模一样、却点不出任何反应，也没有任何提示 = 「点不动」。
       弹框里点【获取二维码】、或演示区点「待支付(支付中)」「模拟支付成功（演示）」都会把订单推成
       PAYING / 已回调（rsnRefreshPanelBehind 会重算底栏），所以关上弹窗再点就点不动了。
       现在的规矩：**除「已收款」这一档（文案已经说明不可再收）外，一律不加 disabled**，
       能不能收、为什么不能收，统一由 rsnOpenConfirmCollect / rsnSubmitCollect 弹明确提示。 */
    if (r.status !== 'EXCEPTION') {
      var collectText = '确认并收款', collectDisabled = '';
      if (r.status === 'PAID') { collectText = '已收款'; collectDisabled = ' disabled'; }
      btns.push('<button class="lt-btn lt-btn-primary"' + collectDisabled
        + ' onclick="rsnOpenConfirmCollect(' + r.idx + ')">' + collectText + '</button>');
    }
  }
  if (rsnInvoiceButton(r)) btns.push('<button class="lt-btn lt-btn-default" onclick="rsnOpenInvoicePage(' + r.idx + ')">发票</button>');
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
function rsnDiscountEditable(r){
  return r.status === 'UNPAID' && !rsnPayLocked(r);
}
function rsnDiscountText(v){
  return (v === undefined || v === null || v === '') ? '—' : npEscape(v);
}
/* 折让项目：模糊下拉（首项"请选择" data-val=""，选中值取 cmbSelVal） */
function rsnDiscountComboHtml(d, i){
  var lis = '<li data-val="" onclick="rsnDiscountTypeSelect(this)">请选择</li>';
  for (var k = 0; k < RSN_DISCOUNT_TYPES.length; k++){
    var t = RSN_DISCOUNT_TYPES[k];
    lis += '<li data-val="' + npEscape(t) + '" onclick="rsnDiscountTypeSelect(this)">' + npEscape(t) + '</li>';
  }
  return '<div class="lt-input-wrap combobox" data-di="' + i + '" data-apply="rsnDiscountTypeSync">'
    + '<input type="text" id="rsn-di-type-' + i + '" value="' + npEscape(d.type || '') + '" placeholder="请选择"'
    + ' onfocus="gtComboboxShow(this)" oninput="gtComboboxFilter(this);rsnDiscountTypeInput(this)">'
    + '<span class="cb-arrow" onclick="gtComboboxToggle(this)">&#9660;</span>'
    + '<ul class="lt-datalist">' + lis + '</ul></div>';
}
function rsnRenderDiscounts(r){
  var list = r.discounts || [];
  var lock = !rsnDiscountEditable(r);
  var html = list.map(function(d, i){
    if (lock){
      return '<tr>' +
        '<td>' + (i+1) + '</td>' +
        '<td>' + rsnDiscountText(d.type) + '</td>' +
        '<td>' + rsnMoney(rsnDiscountAmt(d)) + '</td>' +
        '<td>' + rsnMoney(d.labor) + '</td>' +
        '<td>' + rsnMoney(d.part) + '</td>' +
        '<td>' + rsnDiscountText(d.remark) + '</td>' +
        '<td>—</td>' +
      '</tr>';
    }
    return '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td>' + rsnDiscountComboHtml(d, i) + '</td>' +
      /* 折让金额＝工时折让＋配件折让：只读派生值，不给输入框（改工时/配件即刷新本单元格） */
      '<td id="rsn-di-amt-' + i + '">' + rsnMoney(rsnDiscountAmt(d)) + '</td>' +
      '<td><div class="lt-input-wrap" data-di="' + i + '"><input type="text" id="rsn-di-labor-' + i + '" value="' + rsnMoney(d.labor) +
        '" placeholder="0.00" oninput="rsnDiscountNumInput(this,\'labor\')"></div></td>' +
      '<td><div class="lt-input-wrap" data-di="' + i + '"><input type="text" id="rsn-di-part-' + i + '" value="' + rsnMoney(d.part) +
        '" placeholder="0.00" oninput="rsnDiscountNumInput(this,\'part\')"></div></td>' +
      '<td><div class="lt-input-wrap" data-di="' + i + '"><input type="text" id="rsn-di-remark-' + i + '" value="' + npEscape(d.remark || '') +
        '" placeholder="请输入" oninput="rsnDiscountRemark(this)"></div></td>' +
      '<td><a href="javascript:void(0)" class="lt-link np-red" onclick="rsnDeleteDiscount(' + r.idx + ',' + i + ')">删除</a></td>' +
    '</tr>';
  }).join('');
  if (!list.length) html = '<tr><td colspan="7" style="text-align:center;color:#999;padding:14px;">暂无折让项目</td></tr>';
  document.getElementById('rsn-discount-tbody').innerHTML = html;
  /* 动态生成的 combobox 必须自己补一次注入（规范 §Combobox 第 9 款）：
     showContent 里那次注入跑在 npInitModule 之前，本表在面板打开时才生成 → 不补就没有清除 × */
  if (!lock && typeof npInitComboboxes === 'function') npInitComboboxes();
}
/* 折让项目：点下拉项 → 写值 + 收列表 + 同步模型（值取 data-val，空值＝未选） */
function rsnDiscountTypeSelect(li){
  var w = (li && li.closest) ? li.closest('.lt-input-wrap.combobox') : null;
  if (!w) return;
  var inp = w.querySelector('input'), l = w.querySelector('.lt-datalist');
  if (inp) inp.value = cmbSelVal(li);
  if (l){
    l.classList.remove('show');
    var xs = l.querySelectorAll('li');
    for (var i = 0; i < xs.length; i++) xs[i].classList.remove('hidden');
  }
  rsnDiscountTypeSet(w, inp ? inp.value : '');
}
function rsnDiscountTypeSet(w, val){
  var r = window.__rsnCur;
  if (!r || !r.discounts) return;
  var i = parseInt(w.getAttribute('data-di'), 10);
  if (isNaN(i) || !r.discounts[i]) return;
  r.discounts[i].type = val ? String(val).trim() : '';
}
/* 手输过滤 / 清除 ×（× 由 npComboboxInit 注入，清空时不触发 input 事件，故容器另挂 data-apply 走下面的全量同步） */
function rsnDiscountTypeInput(inp){
  var w = (inp && inp.closest) ? inp.closest('.lt-input-wrap.combobox') : null;
  if (w) rsnDiscountTypeSet(w, inp.value);
}
function rsnDiscountTypeSync(){
  var r = window.__rsnCur;
  if (!r || !r.discounts) return;
  var tb = document.getElementById('rsn-discount-tbody');
  if (!tb || !tb.querySelectorAll) return;
  var ws = tb.querySelectorAll('.lt-input-wrap.combobox[data-di]');
  for (var k = 0; k < ws.length; k++){
    var i = parseInt(ws[k].getAttribute('data-di'), 10);
    var inp = ws[k].querySelector('input');
    if (!isNaN(i) && r.discounts[i] && inp) r.discounts[i].type = inp.value ? String(inp.value).trim() : '';
  }
}
/* 金额输入净化：只留数字与一个小数点，最多两位小数（负号、字母一律丢弃） */
function rsnMoneyInput(raw){
  var v = String(raw === undefined || raw === null ? '' : raw).replace(/[^\d.]/g, '');
  var k = v.indexOf('.');
  if (k >= 0) v = v.slice(0, k + 1) + v.slice(k + 1).replace(/\./g, '');
  var seg = v.split('.');
  if (seg.length > 1) v = seg[0] + '.' + seg[1].slice(0, 2);
  return v;
}
/* 工时折让 / 配件折让：输入即写模型；折让金额＝两者之和 → 原地刷新本行金额与合计（不整表重绘，打字不丢焦点） */
function rsnDiscountNumInput(inp, field){
  var w = (inp && inp.closest) ? inp.closest('.lt-input-wrap') : null;
  if (!w) return;
  var clean = rsnMoneyInput(inp.value);
  if (clean !== inp.value) inp.value = clean;
  var r = window.__rsnCur;
  if (!r || !r.discounts) return;
  var i = parseInt(w.getAttribute('data-di'), 10);
  if (isNaN(i) || !r.discounts[i]) return;
  r.discounts[i][field] = (clean === '' ? '0' : clean);
  rsnDiscountRecalc(r, i);
}
function rsnDiscountRemark(inp){
  var w = (inp && inp.closest) ? inp.closest('.lt-input-wrap') : null;
  if (!w) return;
  var r = window.__rsnCur;
  if (!r || !r.discounts) return;
  var i = parseInt(w.getAttribute('data-di'), 10);
  if (isNaN(i) || !r.discounts[i]) return;
  r.discounts[i].remark = inp.value || '';
}
/* 折让改动后的联动刷新：本行折让金额 → 金额账类 → 底栏总折让额/待支付 → 实际收款金额 */
function rsnDiscountRecalc(r, rowIndex){
  var d = (r.discounts || [])[rowIndex];
  var amtEl = document.getElementById('rsn-di-amt-' + rowIndex);
  if (amtEl && d) amtEl.textContent = rsnMoney(rsnDiscountAmt(d));
  rsnRenderAccount(r);
}
/* 折让校验（2026-10-26 用户口径）：点【收款】/【在线支付】前拦两道
   ① 折让项目必须从下拉里选（值 ∈ RSN_DISCOUNT_TYPES）
   ② 折让金额（工时折让＋配件折让）不能为 0
   ★ 只在折让区可编辑时校验：支付中/已支付＝金额快照已封存、用户也改不了，
     若此时仍校验，历史遗留的 0 元折让会把「查看支付二维码」这类只读入口卡死。 */
function rsnDiscountCheck(r){
  if (!rsnDiscountEditable(r)) return '';
  var list = r.discounts || [];
  for (var i = 0; i < list.length; i++){
    var t = String((list[i] && list[i].type) || '').trim();
    if (!t || RSN_DISCOUNT_TYPES.indexOf(t) < 0) return '第 ' + (i + 1) + ' 行折让项目未选择，请先在下拉中选择折让项目';
    if (rsnDiscountAmt(list[i]) <= 0) return '第 ' + (i + 1) + ' 行折让金额为 0，请填写工时折让或配件折让';
  }
  return '';
}
function rsnAddDiscount(){
  var r = window.__rsnCur; if (!r) return;
  if (!r.discounts) r.discounts = [];
  /* 默认不预填折让项目：9 个值是让用户选的，预填「按商务政策」会让下拉形同虚设 */
  r.discounts.push({ type:'', labor:'0.00', part:'0.00', remark:'' });
  rsnRenderDiscounts(r);
  rsnRenderAccount(r);
  npToast('已新增一行折让项目');
}
function rsnDeleteDiscount(idx, di){
  var r = rsnGet(idx); if (!r) return;
  if (!r.discounts || !r.discounts[di]) return;
  r.discounts.splice(di, 1);
  rsnRenderDiscounts(r);
  rsnRenderAccount(r);
}
function rsnNewCycle(idx){
  var r = rsnGet(idx); if (!r) return;
  npToast('再次收款：新一轮支付需从「未支付」重新发起（原型演示）');
}

/* ---------- 支付渠道 × 支付状态 的公共口径（2026-10-26 依 PRD 6.1.1【收款】确立，新页保持不变） ----------
   ★ 本段是「在线支付」时代留下的机制，新页「确认并收款」**继续全量沿用**：
     · 点【确认并收款】不立即出二维码：先取「当前收款渠道」与「该订单的支付状态（订单支付状态，不是流水状态）」
     · 行3：支付状态（未发起 / 待支付(支付中) / 支付已取消 / 支付已超时 / 支付成功）
     · 在线可操作项随「渠道 × 支付状态」两维变化（见 rsnOnlineOps）：
         渠道空                  → 同步给App（下拉＝用户App）/ 获取二维码（下拉＝支付二维码）
         用户App + 未发起         → 撤回（向App传"不可支付" + 渠道置空 + 折让解锁）
         用户App + 待支付(支付中)  → 无
         用户App + 已取消/已超时    → 无（系统自动：渠道置空 + 折让解锁）
         用户App + 支付成功        → 无
         支付二维码 + 待支付       → 取消支付（渠道置空 + 折让解锁）
         支付二维码 + 已超时       → 无（系统自动同上）
     · 点【收款】打开面板、点【确认并收款】都要向 App 同步最新结算收款单及「App 是否可支付」
   原型演示：PRD 在「待支付(支付中)」写「无操作项」（由用户在 App / 扫码端完成），
   原型无支付后台，保留「模拟支付成功（演示）」一个显式标注的入口，仅用于走到「确认并收款」。 */
var RSN_ORDER_PAY_STATE = {
  '':'未发起', PAYING:'待支付(支付中)', CANCELED:'支付已取消', TIMEOUT:'支付已超时', SUCCESS:'支付成功'
};
var RSN_ONLINE_CHANNELS = ['用户App', '支付二维码'];
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
var RSN_ONLINE_SCENES = [
  { group: '空',           ch: '',           st: '',         label: '渠道：空' },
  { group: '用户App',      ch: '用户App',    st: '',         label: '未发起' },
  { group: '用户App',      ch: '用户App',    st: 'PAYING',   label: '待支付(支付中)' },
  { group: '用户App',      ch: '',           st: 'CANCELED', label: '支付已取消' },
  { group: '用户App',      ch: '',           st: 'TIMEOUT',  label: '支付已超时' },
  { group: '用户App',      ch: '用户App',    st: 'SUCCESS',  label: '支付成功' },
  { group: '支付二维码',   ch: '支付二维码', st: 'PAYING',   label: '待支付(支付中)' },
  { group: '支付二维码',   ch: '',           st: 'TIMEOUT',  label: '支付已超时' }
];
function rsnOnlineChannel(r){ return r.payChannel || ''; }
/* 订单支付状态（PRD：取「这笔订单」的支付状态，不是支付流水号的状态）
   未挂 payState 的历史行按结算状态派生，保持与既有示例数据兼容 */
function rsnOrderPayState(r){
  if (r.payState === '') return '';
  if (r.payState) return r.payState;
  if (r.status === 'PAYING') return 'PAYING';
  if (r.status === 'EXCEPTION') return 'TIMEOUT';
  if (r.status === 'PAID' || r.status === 'PAID_PENDING_COLLECTION') return 'SUCCESS';
  return '';
}
function rsnPayLocked(r){
  var s = rsnOrderPayState(r);
  return s === 'PAYING' || s === 'SUCCESS';
}
function rsnPayLockReason(r){
  return rsnOrderPayState(r) === 'SUCCESS'
    ? '订单已支付，折让项目不可编辑'
    : '订单在支付中（待支付），折让项目不可编辑';
}
/* 模拟「调支付接口 + 查 DMS 支付收款记录」：原型无后台，按订单支付状态派生。
   调用点＝点【收款】打开面板时（rsnOpenPanel）与点【在线支付】时，与 PRD 第1、2条一致。 */
function rsnPayInterfaceCheck(r){
  var s = rsnOrderPayState(r);
  return { paying: s === 'PAYING', paid: s === 'SUCCESS', state: s };
}
/* 向 App 同步「App 是否可支付」（PRD 第4条：点【在线支付】与点【收款】都要同步最新结算收款单） */
function rsnSyncAppPayable(r, payable){
  r.appPayable = !!payable;
  r.appSyncTime = (typeof npNowLocal === 'function') ? npNowLocal() : '';
}
/* ★ 2026-10-26 新口径：原【在线支付】与【收款】两个入口合并为【确认并收款】一个弹框。
   打开时做的事与老页一致（调支付接口查支付中/已支付、向 App 同步「是否可支付」、折让校验），
   差别只是弹框内容：行1 加「实际应收金额 / 预收款余额」，行2 加「预收款抵扣 / 收款渠道 /（门店自行才有）收款方式」，
   收款金额由「实际应收 − 预收款抵扣」自动算出。 */
function rsnOpenConfirmCollect(idx){
  var r = rsnGet(idx); if (!r) return;
  if (r.status !== 'UNPAID' && r.status !== 'PAYING' && r.status !== 'PAID_PENDING_COLLECTION') { npToast('当前状态不可收款'); return; }
  if (rsnNet(r) <= 0) { npToast('实际应收金额为 0，无需收款'); return; }
  /* 折让校验：折让项目必须选、折让金额不能为 0（2026-10-26 用户口径），不合格不许收款 */
  var dErr = rsnDiscountCheck(r);
  if (dErr) { npToast(dErr); return; }
  window.__rsnPayCur = r;
  /* 演示切换用：记下「打开弹框那一刻」的支付态与预收款表单值，供【还原本行进入时状态】回退 */
  window.__rsnDemoBackup = {
    idx: r.idx, payChannel: r.payChannel, payState: r.payState, payOrderNo: r.payOrderNo,
    payQrTime: r.payQrTime, appPayable: r.appPayable, appSyncTime: r.appSyncTime,
    demoBal: r.__demoBal, prepaidIx: r.__prepaidIx,
    form: { channel: '', method: '', prepaid: '0.00' }
  };
  /* 表单初值：
     · 预收款抵扣默认＝min(实际应收金额, 预收款余额)（有预收款就默认先用满，跟渠道无关）；
     · 收款渠道：**全额抵扣时留空（请选择）**——这笔钱全在预收款账户里，不经过任何渠道，
       留空还有一个用处：只有渠道为空时预收款抵扣才可编辑（用户 2026-10-26 口径）；
       需要收钱（收款金额 > 0）时按 `rsnDefaultChannel` 预选（用户 2026-10-26：「需要使用收款渠道的时候，
       默认应该是『用户App』」——门店接了支付就用「用户App」，没接支付才只能是「门店自行」；
       订单上已落定过在线渠道的就显示那个渠道）。 */
  var dftPrepaid = rsnDefaultPrepaid(r);
  var dftChannel = (rsnNum(dftPrepaid) >= rsnNet(r)) ? '' : rsnDefaultChannel(r);
  window.__rsnForm = { channel: dftChannel, method: '', prepaid: dftPrepaid };
  window.__rsnDemoBackup.form = { channel: dftChannel, method: '', prepaid: dftPrepaid };
  r.__demoBal = null; r.__prepaidIx = null;
  rsnSyncAppPayable(r, rsnOrderPayState(r) !== 'PAYING');
  /* PRD 第2条：每次点【收款】都调接口查支付中/已支付；有则提示，但不影响打开弹框 */
  var chk = rsnPayInterfaceCheck(r);
  rsnRenderConfirmCollect(r);
  if (chk.paying) npToast('已在支付中，勿重复收款');
  else if (chk.paid) npToast('已支付、勿重复收款');
}
/* 场景说明条：与「渠道下拉 + 该渠道真实状态」严格同源（按钮出什么，说明就讲什么，
   不许出现「说明里有撤回、按钮里没有」这种自相矛盾） */
function rsnCollectTip(r){
  var f = window.__rsnForm || { prepaid: rsnDefaultPrepaid(r), channel: '' };
  var prepaid = rsnNum(f.prepaid), net = rsnNet(r);
  var cash = Math.max(0, Math.round((net - prepaid) * 100) / 100);
  /* 全额抵扣：本单不再有渠道/方式/收款金额/支付状态，也不出在线操作项 → 说明只讲这一件事 */
  if (cash <= 0){
    return '预收款余额充足：实际应收 ¥' + rsnMoney(net) + ' 全部由预收款抵扣 ¥' + rsnMoney(prepaid)
      + '（记「预收款账户」渠道），收款金额 ¥0.00，所以不需要收款渠道、收款方式与支付状态；点【确认】即完成收款。'
      + ((rsnOrderPayState(r) === 'PAYING') ? '（本单在线支付仍在进行中，为避免重复收款，【确认】暂不可点。）' : '');
  }
  var sel = f.channel || '';
  var prepaidTxt = prepaid > 0 ? '预收款抵扣 ¥' + rsnMoney(prepaid) + '（记「预收款账户」渠道），' : '';
  var tail = '剩余 ¥' + rsnMoney(cash) + ' 按所选渠道/方式收取。';
  if (!rsnStorePayEnabled(r)){
    return '本门店未接入支付（非直营·未接支付）：收款渠道只能是「门店自行」（线下收款）；' + prepaidTxt + tail;
  }
  if (!sel){
    return '收款渠道还没选：预收款抵扣现在可以改（改小到要收钱时会按默认渠道预选）；'
      + '选了收款渠道之后预收款抵扣就锁定了，要再改先把渠道清空回「请选择」。' + prepaidTxt;
  }
  if (sel !== '用户App' && sel !== '支付二维码'){
    return '收款渠道＝「门店自行」（线下收款）：选好收款方式即可收钱；' + prepaidTxt + tail
      + '（门店自行不产生支付状态，也没有在线支付操作项。）';
  }
  var stSel = rsnStateForSel(r, sel), engaged = rsnSelEngaged(r, sel);
  /* 支付已取消 / 已超时：系统已把收款渠道置空、折让解锁；重新选了渠道就等于「未落定」，
     按 PRD「收款渠道：空」那一格出【同步给App】/【获取二维码】让门店重新发起（2026-10-26 用户纠正：
     「支付超时、支付失败，那你选收款渠道后，难道没有按钮么？」）。 */
  if (stSel === 'CANCELED' || stSel === 'TIMEOUT'){
    return '该单的在线支付' + (stSel === 'CANCELED' ? '已被用户在App端取消' : '已超时')
      + '：收款渠道已由系统置空、折让项目已解锁；支付状态保留显示。'
      + '重新选好收款渠道后点【' + (sel === '用户App' ? '同步给App' : '获取二维码') + '】即可重新发起收款。'
      + prepaidTxt + tail;
  }
  if (!engaged){
    return '已选「' + sel + '」但还没落定：点【' + (sel === '用户App' ? '同步给App' : '获取二维码')
      + '】把这个收款单推给用户（落定后才会出现支付状态与后续操作项）；' + prepaidTxt + tail;
  }
  if (sel === '用户App' && stSel === ''){
    return '已向App同步（支付状态＝未发起）：用户还没付款。点【撤回】可退回上一步（收款渠道置空、折让项目解锁）；'
      + '用户在App里付成功后，支付状态变「支付成功」，本弹框即可关闭。' + prepaidTxt + tail;
  }
  if (sel === '用户App' && stSel === 'PAYING'){
    return '用户已在App端发起支付（待支付）：等待支付回调，此时不可重复收款；' + prepaidTxt + tail;
  }
  if (sel === '支付二维码' && stSel === 'PAYING'){
    return '二维码未超时：点【取消支付】可作废本次二维码（收款渠道置空、折让项目解锁）；'
      + '用户扫码付成功后，支付状态变「支付成功」，本弹框即可关闭。' + prepaidTxt + tail;
  }
  if (stSel === 'SUCCESS'){
    return '在线支付已成功：本单已收到钱，点【关闭】退出即可（线下收款那档才用【确认】入账）。' + prepaidTxt + tail;
  }
  return '当前收款渠道：' + sel + '；支付状态：' + (RSN_ORDER_PAY_STATE[stSel] || '—') + '。' + prepaidTxt + tail;
}
/* ---------- 弹框「在线支付」底部：演示切换区（原型专用） ----------
   为什么存在：PRD 6.1.1【收款】那张表有 7 个场景（渠道空 / 用户App×4~5 / 支付二维码×2），
   在原型里只能靠点不同的列表行去碰，其中「渠道空」「用户App·未发起」两种状态还会被
   折让校验拦在弹框外（折让金额为 0 的行），等于演示不出来。故把场景做成按钮。
   · 只改本行的 payChannel / payState（演示态），**不改列表里的收款状态 r.status**；
   · 公共类名 .np-demo-switch*，样式在 style.css 唯一一份（规范 §3.1.5 已登记），禁止页面自造同类私有类名。 */
function rsnSceneGroups(){
  var order = [], groups = {};
  RSN_ONLINE_SCENES.forEach(function(s){
    var key = s.group;
    if (!groups[key]){ groups[key] = []; order.push(key); }
    groups[key].push(s);
  });
  return order.map(function(k){ return { ch: k, items: groups[k] }; });
}
/* 当前高亮哪个场景按钮：优先用「刚点过的演示场景」（支付已取消/已超时会把渠道置空，
   两个渠道组会落到同一状态，只靠状态反查会同时点亮两个），否则按状态反查（取 PRD 顺序第一个）。 */
function rsnDemoActiveIndex(r){
  var ch = rsnOnlineChannel(r), st = rsnOrderPayState(r);
  var ix = r.__demoIx;
  if (typeof ix === 'number' && RSN_ONLINE_SCENES[ix] &&
      RSN_ONLINE_SCENES[ix].ch === ch && RSN_ONLINE_SCENES[ix].st === st) return ix;
  for (var i = 0; i < RSN_ONLINE_SCENES.length; i++){
    if (RSN_ONLINE_SCENES[i].ch === ch && RSN_ONLINE_SCENES[i].st === st) return i;
  }
  return -1;
}
/* ---------- 预收款场景（2026-10-26 用户口径：演示区「原有按钮保留，并新增预收款场景按钮」） ----------
   为什么加：预收款抵扣的三种组合（全额抵扣 / 部分抵扣 / 没余额）在真实数据里
   只能靠碰运气遇到，其中「余额充足」在很多行根本不存在 → 演示不出来。故做成按钮。
   ★ 2026-10-27 用户口径：「不用预收款，不需要单独出来吧？自己把预收款抵扣改成 0 就行了吧？」
     —— 故删掉原第 4 个按钮「不用预收款」：它做的事（预收款抵扣填 0）用户在下拉为「请选择」时
     直接改「预收款抵扣」输入框就能做到，多一个按钮纯属重复。想置 0 请手动改输入框，
     程序内等价入口是 rsnPrepaidSetZero()（与手动输入同一套逻辑，供演示/自检调用）。
   · 只改本弹框的演示余额 r.__demoBal 与表单里的预收款抵扣，**不动 r.status、不动预收款模块数据**；
   · 余额充足/不足用的是演示余额，点【确认并收款】时按表单值真实回写预收款使用流水
     （演示余额大于真实余额时，预收款页余额会变成负数——这是演示态，还原本行即可恢复）。 */
var RSN_PREPAID_SCENES = [
  { key:'FULL', label:'余额充足' },
  { key:'PART', label:'余额不足' },
  { key:'NONE', label:'无预收款' }
];
/* 切到某个预收款场景：设演示余额 + 表单预收款抵扣，然后原地重绘 */
function rsnDemoPrepaid(idx, k){
  var r = rsnGet(idx); if (!r) return;
  var s = RSN_PREPAID_SCENES[k]; if (!s) return;
  var f = window.__rsnForm || (window.__rsnForm = {
    channel: rsnDefaultChannel(r), method: '', prepaid: rsnDefaultPrepaid(r) });
  var net = rsnNet(r), real = rsnPrepaidBalance(r);
  r.__prepaidIx = k;
  /* 场景决定渠道该不该有值：全额抵扣＝不经过任何渠道（渠道清空、预收款抵扣可改）；
     要收钱＝按默认渠道预选（用户 2026-10-26：需要收款渠道时默认「用户App」） */
  if (s.key === 'FULL'){
    r.__demoBal = Math.max(real, net);
    f.prepaid = rsnMoney(net);
  } else if (s.key === 'PART'){
    var half = Math.round(net / 2 * 100) / 100;
    r.__demoBal = half;
    f.prepaid = rsnMoney(half);
  } else if (s.key === 'NONE'){
    r.__demoBal = 0;
    f.prepaid = '0.00';
  }
  /* 渠道跟着场景走：全额抵扣＝空渠道（预收款抵扣可编辑）；要收钱＝按默认渠道预选（预收款抵扣锁死） */
  if (rsnNum(f.prepaid) >= net) f.channel = '';
  else if (!f.channel) f.channel = rsnDefaultChannel(r);
  rsnRenderConfirmCollect(r);
  var cash = Math.max(0, Math.round((net - rsnNum(f.prepaid)) * 100) / 100);
  npToast('演示场景：预收款余额 ¥' + rsnMoney(rsnShownBalance(r)) + '；预收款抵扣 ¥' + rsnMoney(rsnNum(f.prepaid))
    + '；收款金额 ¥' + rsnMoney(cash));
}
/* 把预收款抵扣改成 0（＝用户在下拉为「请选择」时，直接把「预收款抵扣」输入框改成 0 并失焦）。
   2026-10-27 用户口径：这才是「不用预收款」的正规做法，不需要演示区再出一个按钮。
   演示与自检都调这个函数，逻辑与手动输入完全一致：余额按真实值显示，不覆盖演示余额。 */
function rsnPrepaidSetZero(idx){
  var r = rsnGet(idx); if (!r) return;
  var f = window.__rsnForm || (window.__rsnForm = {
    channel: '', method: '', prepaid: rsnDefaultPrepaid(r) });
  /* 手动改抵扣＝退出演示场景：余额回到真实值（覆盖的演示余额要清掉，否则会显示成上一个场景的 0.00） */
  r.__demoBal = null;
  r.__prepaidIx = null;
  /* 只有渠道为空时预收款抵扣才可编辑（渠道非空＝金额已推给该渠道，按口径锁死） */
  if (rsnNum(f.prepaid) >= rsnNet(r)) f.channel = '';
  f.prepaid = '0.00';
  if (!f.channel) f.channel = rsnDefaultChannel(r);
  rsnRenderConfirmCollect(r);
}
function rsnDemoSwitchHtml(r){
  var actIx = rsnDemoActiveIndex(r);
  var chans = rsnOnlineChannelsOf(r);
  var curK = r.__prepaidIx;
  var html = '<div class="np-demo-switch" id="rsn-demo-switch">' +
    '<div class="np-demo-switch-hd">演示切换（原型专用）' +
      '<span class="np-demo-switch-hint">上半区按 PRD 6.1.1【收款】场景表切换收款渠道 × 支付状态；下半区切换预收款场景。只改本弹框的演示状态，不改列表里的收款状态、不改折让数据</span>' +
    '</div>';
  rsnSceneGroups().forEach(function(g){
    html += '<div class="np-demo-switch-group">' +
      '<span class="np-demo-switch-group-label">收款渠道：' + npEscape(g.ch) + '</span>';
    g.items.forEach(function(s){
      var i = RSN_ONLINE_SCENES.indexOf(s);
      html += '<button type="button" class="np-demo-switch-btn' + (i === actIx ? ' active' : '') + '"' +
        ' onclick="rsnDemoScene(' + r.idx + ',' + i + ')">' + npEscape(s.label) + '</button>';
    });
    html += '</div>';
  });
  /* 预收款场景组（2026-10-26 新增；原有收款渠道场景按钮全部保留）
     注：预收款抵扣的默认值本身就是 min(实际应收金额, 预收款余额)，
     所以「余额充足」＝打开时的样子；「不用预收款」按钮已按用户 2026-10-27 口径删除
     （把「预收款抵扣」输入框改成 0 即可，不必再单独出一个按钮）。 */
  html += '<div class="np-demo-switch-group">' +
    '<span class="np-demo-switch-group-label">预收款（默认＝较少的一边）：</span>';
  RSN_PREPAID_SCENES.forEach(function(s, k){
    html += '<button type="button" class="np-demo-switch-btn' + (k === curK ? ' active' : '') + '"' +
      ' onclick="rsnDemoPrepaid(' + r.idx + ',' + k + ')">' + npEscape(s.label) + '</button>';
  });
  html += '</div>';
  html += '<div class="np-demo-switch-ops">';
  /* PRD 在「待支付(支付中)」写「可操作项：无」——模拟支付成功不属于可操作项，
     所以它不进业务按钮、放这里，并显式标注（演示）。 */
  if (chans.length && rsnOrderPayState(r) === 'PAYING'){
    html += '<button type="button" class="np-demo-switch-btn" onclick="rsnOnlineDemoPaid(' + r.idx + ')">模拟支付成功（演示）</button>';
  }
  html += '<button type="button" class="np-demo-switch-btn" onclick="rsnDemoReset(' + r.idx + ')">还原本行进入时状态</button>';
  html += '</div>';
  /* 状态说明（与场景切换同处一区，避免正文混入 PRD 之外的元素） */
  html += '<div class="np-demo-switch-tip" id="rsn-cc-tip">当前场景说明：' + npEscape(rsnCollectTip(r)) + '</div>';
  html += '</div>';
  return html;
}
/* 切到某个 PRD 场景：渠道 + 订单支付状态两维一起设，然后原地重绘弹框并同步背后的侧滑面板。
   「支付已取消 / 支付已超时」按 PRD 落成：收款渠道置空（可重新选择）+ 折让解锁（可编辑）。 */
function rsnDemoScene(idx, i){
  var r = rsnGet(idx); if (!r) return;
  var s = RSN_ONLINE_SCENES[i]; if (!s) return;
  r.__demoIx = i;
  r.payChannel = s.ch;
  r.payState = s.st;
  /* 表单里的「收款渠道」跟随演示场景（场景渠道为空＝下拉回到默认「用户App」，
     但订单侧仍是「未落定」→ 支付状态不显示、按钮只有【同步给App】，与 PRD 渠道空那一格一致） */
  if (window.__rsnForm) { window.__rsnForm.channel = s.ch || rsnDefaultChannel(r); window.__rsnForm.method = ''; }
  if (!r.payOrderNo) r.payOrderNo = 'YJ_WXSK_' + r.order + '01';
  r.payQrTime = (s.ch === '支付二维码' && s.st === 'PAYING')
    ? ((typeof npNowLocal === 'function') ? npNowLocal() : '') : '';
  /* PRD「点击操作后」：同步给App＝传「可支付」；其余（获取二维码 / 撤回 / 取消 / 超时）＝传「不可支付」 */
  rsnSyncAppPayable(r, s.ch === '用户App' && s.st !== 'PAYING');
  rsnRenderConfirmCollect(r); rsnRefreshPanelBehind(r);
  var extra = (s.st === 'CANCELED' || s.st === 'TIMEOUT') ? '；收款渠道已置空可重选、折让项目已解锁' : '';
  npToast('演示场景：收款渠道＝' + (s.ch || '空') + '；支付状态＝' + (RSN_ORDER_PAY_STATE[s.st] || '—') + extra);
}
/* 还原为「打开弹框那一刻」的支付态与预收款表单值（连续演示不同场景后回到原样） */
function rsnDemoReset(idx){
  var r = rsnGet(idx); if (!r) return;
  var b = window.__rsnDemoBackup;
  if (!b || b.idx !== r.idx){ npToast('没有可还原的初始状态'); return; }
  r.__demoIx = null;
  r.payChannel = b.payChannel || ''; r.payState = b.payState || ''; r.payOrderNo = b.payOrderNo || '';
  r.payQrTime = b.payQrTime; r.appPayable = b.appPayable; r.appSyncTime = b.appSyncTime;
  /* 预收款演示态一并还原（余额覆盖、场景高亮、表单预收款抵扣/渠道/方式） */
  r.__demoBal = (typeof b.demoBal === 'number') ? b.demoBal : null;
  r.__prepaidIx = (typeof b.prepaidIx === 'number') ? b.prepaidIx : null;
  window.__rsnForm = {
    channel: (b.form && typeof b.form.channel === 'string') ? b.form.channel : rsnDefaultChannel(r),
    method: (b.form && b.form.method) || '',
    prepaid: (b.form && b.form.prepaid) || rsnDefaultPrepaid(r)
  };
  rsnRenderConfirmCollect(r); rsnRefreshPanelBehind(r);
  npToast('已还原为打开弹框时的状态');
}
/* ============ 弹框：确认并收款（2026-10-26 新口径：原「在线支付」+「确认收款」合并） ============
   用户原文（元素清单，一个字都不许改）：
     「1，『在线支付』和『收款』合二为一，叫：确认并收款
       2，点开后的弹框，进行如下修改：
          行1：维修工单号、维修结算单号、实际应收金额、预收款余额
          行2：预收款抵扣、收款渠道、收款方式、收款金额」
   落法：
   · 行1 四个字段全部只读；行2 前三个可填（预收款抵扣/收款渠道/收款方式），
     「收款金额」＝实际应收金额 − 预收款抵扣，只读自动算（用户拍板：只读自动算，避免两边填不一致）；
   · 行3：支付状态（有支付状态时出现，保留 PRD 6.1.1 的支付状态显示项）+ 第4列业务按钮
     （在线可操作项 + 取消 + 确认并收款）——行2 已被四字段占满，按钮只能落在下一行第4列；
   · 栅格只用 .np-form-grid.col4（规范 §3.1.1/§3.1.2 行内同框，禁止自造表单栅格）；
   · 弹框宽 1260px＝实测值（22 位结算单号在 4 等列下需要 195px 输入宽才不裁字）；
   · 演示区走 npOpenModal 的 belowFooterHtml（规范 §3.1.5：正文 → 按钮条 → 演示区）。
   ★ 收款渠道＝门店自行 / 支付二维码 / 用户App（门店自行永远可选；在线两个按门店支付能力给）。
   ★ 预收款抵扣默认＝min(实际应收金额, 预收款余额)（用户 2026-10-26 口径：有预收款就默认先用满，
     与收款渠道无关；收款金额＝实际应收−预收款抵扣，所以默认状态下余额够就是全额抵扣、
     余额不够就是「余额全部抵扣＋剩余走渠道」）。手改后以手填值为准，切渠道不重置。 */
function rsnCollectChannelsOf(r){
  return ['门店自行'].concat(rsnOnlineChannelsOf(r));
}
/* 预收款抵扣的默认值（唯一算法）：min(实际应收金额, 预收款余额)，两位小数 */
function rsnDefaultPrepaid(r){
  return rsnMoney(Math.min(rsnNet(r), rsnShownBalance(r)));
}
/* 收款渠道的默认值（唯一算法，2026-10-26 用户口径：「需要使用收款渠道的时候，默认应该是『用户App』」）：
   ① 订单上已经落定过在线渠道 → 就用它；
   ② 否则门店接了支付 → 「用户App」；
   ③ 门店没接支付（非直营·未接）→ 只有「门店自行」（线下收款永远可用）。 */
function rsnDefaultChannel(r){
  var ch = rsnOnlineChannel(r);
  if (ch) return ch;
  return rsnOnlineChannelsOf(r).length ? '用户App' : '门店自行';
}
/* 所选渠道此刻「算得上」的支付状态（唯一算法）：
   · 门店自行＝线下收款，没有支付状态可言 → 一律不显示；
   · 订单渠道 === 所选渠道 → 用订单真实状态（''＝未发起）；
   · 订单渠道已被系统置空（支付已取消/已超时）→ 状态保留显示（PRD：渠道置空、状态仍在）；
   · 其余（刚在下拉里换了个渠道、还没落定）→ 视为没有状态，
     不许凭空冒出「支付状态」「撤回」。 */
function rsnStateForSel(r, sel){
  if (sel !== '用户App' && sel !== '支付二维码') return '';
  var ch = rsnOnlineChannel(r), st = rsnOrderPayState(r);
  if (ch === sel) return st;
  if (st === 'CANCELED' || st === 'TIMEOUT') return st;
  return '';
}
function rsnSelEngaged(r, sel){
  return !!sel && rsnOnlineChannel(r) === sel;
}
function rsnRenderConfirmCollect(r){
  var f = window.__rsnForm;
  /* 渠道为空是合法状态（全额抵扣时就是空）：不要在这里回填默认渠道，否则「空渠道才可改预收款」永远走不到 */
  if (!f) f = window.__rsnForm = { channel: '', method: '', prepaid: rsnDefaultPrepaid(r) };

  var net = rsnNet(r), bal = rsnShownBalance(r), prepaid = rsnNum(f.prepaid);
  var cash = Math.max(0, Math.round((net - prepaid) * 100) / 100);
  /* ★ 预收款余额充足＝本单被预收款全额抵扣（收款金额 0.00）→ 这笔收款全在「预收款账户」里完成，
     线下线上渠道、方式、收款金额、支付状态、以及全部在线支付可操作项（含撤回）都没有意义，
     按用户 2026-10-26 口径一律不展示：行2 只留「预收款抵扣」，行3 只留按钮（取消 + 确认）。
     ★ 实现方式（用户 2026-10-26 第四次纠正，三条感叹号）：
       这些字段照常生成、但带 `style="display:none"` 隐藏；**绝不因为「改预收款抵扣跨线」整框重绘**
       —— 重绘会把输入框换成新节点、焦点丢掉，用户接着敲字没反应，看起来就是「不能改」。
       跨线时只切这些节点的 display（`rsnApplyCovered`），输入框自始至终是同一个 DOM 节点。 */
  var covered = cash <= 0;
  r.__ccCovered = covered;
  /* ★ 渠道下拉＝唯一真源（用户 2026-10-26 三次纠正）：
     支付状态与在线操作项都按「下拉当前选了哪个渠道」算，不按订单上残留的渠道算，
     否则会出现「收款渠道还没选，却已经有支付状态 / 撤回」。 */
  var sel = f.channel;
  var onlineSel = (sel === '用户App' || sel === '支付二维码');
  var stSel = rsnStateForSel(r, sel);            /* 所选渠道此刻算得上支付状态 */
  var engaged = rsnSelEngaged(r, sel);           /* 订单是否已经在这个渠道上落定 */

  /* 渠道已落定且支付中/已成功 → 不许改（PRD：渠道一旦发起支付就锁定） */
  var chLocked = !!rsnOnlineChannel(r) && rsnPayLocked(r);
  /* 首项留空＝「请选择」（只有空值时预收款抵扣才可编辑，用户 2026-10-26：「渠道不是空的时候，预收款的金额应不能编辑」） */
  var chOpts = '<option value=""' + (sel === '' ? ' selected' : '') + '>请选择</option>' +
    rsnCollectChannelsOf(r).map(function(c){
      return '<option value="' + npEscape(c) + '"' + (c === sel ? ' selected' : '') + '>' + npEscape(c) + '</option>';
    }).join('');

  var direct = rsnStoreType(r) === '直营店';
  /* 方式下拉的内容固定按「门店自行」那一套生成（用户App/支付二维码 不出现这一格），
     这样从「全额抵扣」改到「要收钱」时只切显隐、不用重绘 */
  var methods = rsnPayMethodsOf('门店自行', direct);
  var mOpts = '<option value=""' + (f.method ? '' : ' selected') + '>请选择</option>' + methods.map(function(m){
    return '<option value="' + npEscape(m) + '"' + (m === f.method ? ' selected' : '') + '>' + npEscape(m) + '</option>';
  }).join('');

  /* 行1（4 列，全只读） */
  var body =
    '<div class="np-form-grid col4">' +
      npFormItem('维修工单号', '<input type="text" readonly value="' + npEscape(r.order) + '">') +
      npFormItem('维修结算单号', '<input type="text" readonly value="' + npEscape(r.id) + '">') +
      npFormItem('实际应收金额', '<input type="text" readonly id="rsn-cc-net" value="' + rsnMoney(net) + '">') +
      npFormItem('预收款余额', '<input type="text" readonly id="rsn-cc-balance" value="' + rsnMoney(bal) + '">') +
    '</div>';
  /* 预收款抵扣：收款渠道为空时可改；渠道一旦有值就锁死（金额已经推给那个渠道了） */
  var prepaidLocked = !!sel;
  var prepaidTip = prepaidLocked ? ' title="收款渠道已选定，预收款抵扣不可修改；如需调整请先把收款渠道清空"' : '';
  var prepaidField = npFormItem('预收款抵扣', '<input type="text" id="rsn-cc-prepaid" value="' + rsnMoney(prepaid) +
    '" placeholder="0.00"' + (prepaidLocked ? ' readonly' : '') + prepaidTip +
    ' oninput="rsnPrepaidInput(' + r.idx + ')" onblur="rsnPrepaidBlur(' + r.idx + ')">');
  /* 行2：预收款抵扣 ＋ 收款渠道 ＋ 收款方式（仅门店自行）＋ 收款金额 */
  body += '<div class="np-form-grid col4">' + prepaidField +
    rsnToggleItem(npFormSelect('收款渠道',
      '<select id="rsn-cc-channel"' + (chLocked ? ' disabled' : '') +
      ' onchange="rsnCollectChannelChange(' + r.idx + ')">' + chOpts + '</select>', true), 'rsn-cc-row-channel', covered) +
    /* 收款方式只有「门店自行（线下收款）」才有：用户App 的钱在 App 里付，
       支付二维码 走用户自己扫码（微信/支付宝 由用户那边定），这两种门店都不选方式
       —— 与「维修结算收款」原页一致（用户 2026-10-26：「这个原菜单是对的，是你复制后才不对的」） */
    rsnToggleItem(npFormSelect('收款方式',
      '<select id="rsn-cc-method" onchange="rsnCollectMethodChange()">' + mOpts + '</select>', true),
      'rsn-cc-row-method', covered || sel !== '门店自行') +
    rsnToggleItem(npFormItem('收款金额', '<input type="text" readonly id="rsn-cc-cash" value="' + rsnMoney(cash) + '">'),
      'rsn-cc-row-cash', covered) +
    '</div>';
  /* 行3：支付状态（第1列）+ 按钮（第4列）——按钮永远是**最后一排的最后侧**（.form-actions 自带右对齐＋底对齐）。
     二维码**不进这一排**：不许插在按钮和上面几行字段之间（用户 2026-10-26 第七次纠正）。
     整行挂在固定 id `rsn-cc-row3` 上：改预收款抵扣跨线时由 rsnApplyCovered 就地重生成这一行
     （支付状态/按钮是按渠道"有选择地渲染"的，光切 display 会出现「按钮那格空白」——见 rsnRow3Html 注释）。 */
  var showQr = (sel === '支付二维码' && engaged && stSel === 'PAYING');
  r.__ccSel = sel;
  r.__ccPaid = (stSel === 'SUCCESS');
  body += '<div class="np-form-grid col4" id="rsn-cc-row3">' + rsnRow3Html(r, f.channel, covered) + '</div>';
  /* 二维码自成一块，排在所有字段行之后（不占表单行列，也就不会把按钮挤离「最后一排的最右」）。
     同样挂在固定 id 的容器里、由 rsnApplyCovered 就地重生成 —— 它也是"按状态才渲染"的块，
     只切 display 会出现「按钮有了、码没了」的同类空白（2026-10-27 第二个坑）。 */
  body += '<div id="rsn-cc-qr-wrap">' + rsnQrWrapHtml(r, f.channel, covered) + '</div>';
  npOpenModal('确认并收款', body, '', {width:1260, belowFooterHtml: rsnDemoSwitchHtml(r)});
  /* 这个弹框比常规弹框高（4 行字段 + 二维码块 + 底部演示切换区），把可用高度从默认 82vh 提到 92vh，
     否则在 1366×768 这类屏上，最后那块正好卡在演示切换区上沿，看起来就是「二维码又被挡住了」。 */
  var ov = document.getElementById('np-modal-root');
  if (ov && ov.firstChild && ov.firstChild.style) ov.firstChild.style.maxHeight = '92vh';
  /* 渲染完按当前是否全额抵扣同步一次显隐（节点上的 inline style 与这份状态必须一致，
     后面用户改预收款抵扣时只切 display，不重绘） */
  rsnApplyCovered(covered, r);
}
/* 二维码块：**独立一块，排在所有字段行（含按钮那一排）之后**，不占表单的行列网格
   （用户 2026-10-26 第七次纠正：「你不能把二维码放在按钮和上面几行元素之间」「按钮一直是最后一行的最后侧」）。
   块内：左边 120×120 二维码、右边三行文字；**整块水平居中、再略往左偏一点点**
   （用户 2026-10-26 第九次纠正：「居中，往左一点点」，三番五次被我做成贴左，这次用 justify-content:center
    ＋右侧 96px 内边距把整组从正中左移约 48px，绝不会再贴到左边）。
   ★ 教训：flex 必须写在**内层**这个不参与显隐切换的 div 上。
     之前写在外层 `#rsn-cc-qr` 上，而 `rsnApplyCovered` 会把它的 `style.display` 置空 →
     `display:flex` 被一起清掉 → 退化成 display:block → 二维码和文字**上下堆叠**、二维码贴到最左边。
     外层只负责 `display:none / ''`（+ 上下边距），内层负责排布，两者互不干扰。 */
/* 二维码容器内容：按当前渠道决定要不要出这一块（`支付二维码` ＋ 订单在该渠道上待支付时才出）。
   与 rsnRow3Html 同理——它是"渲染与否取决于状态"的块，跨线切换必须重生成，不能只切 display。 */
function rsnQrWrapHtml(r, sel, covered){
  var showQr = (sel === '支付二维码' && rsnSelEngaged(r, sel) && rsnStateForSel(r, sel) === 'PAYING');
  return showQr ? rsnQrBlockHtml(r, covered) : '';
}
function rsnQrBlockHtml(r, covered){
  return '<div id="rsn-cc-qr" style="margin:2px 0 4px;' + (covered ? 'display:none' : '') + '">' +
    '<div style="display:flex;align-items:center;justify-content:center;gap:16px;padding-right:96px">' +
    '<div style="width:120px;height:120px;flex:0 0 auto;border:1px solid #ddd;border-radius:6px;background:#fafafa;'
    + 'display:flex;flex-direction:column;align-items:center;justify-content:center;color:#666;font-size:12px;line-height:1.7;'
    + 'text-align:center">'
    + '<span>支付二维码</span><span>（微信 / 支付宝<br>二码合一）</span></div>' +
    '<div style="font-size:12px;color:#666;line-height:1.9">' +
    '<div>请用户使用微信或支付宝扫码支付；</div>' +
    '<div>有效期：30min</div>' +
    '<div><a href="javascript:;" style="color:#185FA5;text-decoration:underline" onclick="rsnDownloadQr(' + r.idx + ')">下载图片</a></div>' +
    '</div></div>';
}
function rsnDownloadQr(idx){
  npToast('（演示）二维码图片已下载，可直接发给用户扫码支付');
}
/* 把「预收款余额充足时要隐藏」的字段包一层稳定 id，并按当前是否隐藏写好 inline display。
   为什么不用整框重绘：见 rsnRenderConfirmCollect 里 covered 那段注释（重绘＝输入框重建＝焦点丢失＝「改不动」）。 */
function rsnToggleItem(html, id, hidden){
  return String(html).replace('<div class="lt-filter-item"',
    '<div class="lt-filter-item" id="' + id + '"' + (hidden ? ' style="display:none"' : ''));
}
/* 行3（支付状态 ＋ 按钮格）的 HTML —— **唯一来源**，整框渲染与「跨线只切显隐」都走它。
   ★ 2026-10-27 用户报「余额充足时把预收款抵扣改小，收款渠道默认成用户App，后面啥按钮都没有；
     非要先选别的渠道、再选回用户App，按钮才出来」——
     根因＝这两样东西**是按当时的渠道/抵扣状态"有选择地渲染"的**：
     全额抵扣 ＋ 渠道为空时，判定是「线下那一档」，于是 支付状态 这一格根本不渲染、
     在线操作项（【同步给App】/【获取二维码】/【撤回】/【取消支付】）也压根没生成；
     而改预收款抵扣走的是"只切 display、不重绘"的路径，`rsnApplyCovered` 想去把
     `rsn-btn-op`/`rsn-btn-close` 显示出来时，**这些节点在 DOM 里不存在** → 那一格空白。
     修法不是补 display，而是把行3 整块**按当前渠道重新生成**：行3 是独立节点，
     与预收款抵扣输入框不是同一个 DOM 节点，重画它不影响输入焦点/光标，仍然满足
     「改数过程中不整框重绘」的口径。 */
function rsnRow3Html(r, sel, covered){
  var onlineSel = (sel === '用户App' || sel === '支付二维码');
  var stSel = rsnStateForSel(r, sel);            /* 所选渠道此刻算得上支付状态 */
  var engaged = rsnSelEngaged(r, sel);           /* 订单是否已经在这个渠道上落定 */
  var showState = onlineSel && (engaged || !!stSel);
  var stateText = RSN_ORDER_PAY_STATE[stSel] || '';
  return (showState ? rsnToggleItem(npFormItem('支付状态',
      '<input type="text" readonly value="' + npEscape(stateText) + '">'), 'rsn-cc-state', covered) : '') +
    npFormActions(rsnCollectActions(r, sel, covered));
}
/* 全额抵扣 ↔ 部分抵扣 之间切换：切字段显隐 + 按当前渠道重生成行3（支付状态＋按钮），DOM 不重建整框 */
function rsnApplyCovered(covered, r){
  ['rsn-cc-row-channel', 'rsn-cc-row-cash', 'rsn-cc-state', 'rsn-cc-qr']
    .forEach(function(id){
      var el = document.getElementById(id);
      if (el && el.style) el.style.display = covered ? 'none' : '';
    });
  /* 收款方式只在「门店自行」出现；预收款抵扣只在渠道为空时可编辑 */
  var sel = (window.__rsnForm && window.__rsnForm.channel) || '';
  var mEl = document.getElementById('rsn-cc-row-method');
  if (mEl && mEl.style) mEl.style.display = (covered || sel !== '门店自行') ? 'none' : '';
  var pEl = document.getElementById('rsn-cc-prepaid');
  if (pEl && typeof pEl.readOnly === 'boolean') pEl.readOnly = !!sel;
  /* 支付状态 ＋ 按钮：整块按当前渠道重生成（原因见 rsnRow3Html 上面那段注释） */
  var row3 = document.getElementById('rsn-cc-row3');
  if (row3 && r) row3.innerHTML = rsnRow3Html(r, sel, covered);
  /* 二维码块同理：它也是"按状态才渲染"的，跨线时要重生成，否则会出现「按钮有了、码没了」 */
  var qrWrap = document.getElementById('rsn-cc-qr-wrap');
  if (qrWrap && r) qrWrap.innerHTML = rsnQrWrapHtml(r, sel, covered);
}
/* 收款渠道切换：**只是「预选」**，不写订单（2026-10-26 用户第三次纠正；口径同老页 §4.9.3：
   「收款渠道下拉只是预选，点了按钮才落定」）。落定只发生在【同步给App】/【获取二维码】/【取消支付】/【撤回】
   这些真实动作上，所以「刚选了渠道就冒出【撤回】」这种错位不会再出现。
   切换后整框重绘（方式下拉要按新渠道重画；支付状态与按钮格也在表单里，不能只刷 footer）。 */
function rsnCollectChannelChange(idx){
  var r = rsnGet(idx); if (!r) return;
  var sel = document.getElementById('rsn-cc-channel');
  /* 允许清空回「请选择」：清空后预收款抵扣重新可编辑（用户 2026-10-26 口径） */
  var v = (sel && sel.value) || '';
  /* 预收款抵扣不随渠道变（默认值不分渠道，手填值更不该被渠道冲掉） */
  var f = window.__rsnForm || (window.__rsnForm = { channel: v, method: '', prepaid: rsnDefaultPrepaid(r) });
  f.channel = v; f.method = '';
  r.__demoIx = null;
  rsnRenderConfirmCollect(r); rsnRefreshPanelBehind(r);
}
/* 收款方式切换：只记表单值，不重绘（重绘会把用户正在选的下拉状态清掉） */
function rsnCollectMethodChange(){
  var sel = document.getElementById('rsn-cc-method');
  var f = window.__rsnForm || (window.__rsnForm = { channel: '', method: '', prepaid: '0.00' });
  f.method = (sel && sel.value) || '';
}
/* 预收款抵扣输入：只收非负两位小数；超过 min(实际应收, 预收款余额) 才夹回，
   并把「收款金额」同步刷成 实际应收 − 预收款抵扣（唯一算法，页面不另算一遍）。
   ★ 2026-10-26 用户两次纠正（第二次是三条感叹号）：「余额充足时预收款抵扣还是可以改的，你现在是不能改？」
     根因不是 readonly，而是**跨过「全额抵扣」这条线就整框重绘**：输入框被换成新节点，焦点/光标丢掉，
     用户接着敲字没反应，看起来就是「改不动」。
     现在改成：**输入过程中一律不重绘**，只在跨线时把这些字段的 display 切一下（`rsnApplyCovered`），
     输入框自始至终是同一个 DOM 节点；也不再每次敲键就把值重写成两位小数（只在超上限夹回、失焦时才规整化）。 */
function rsnPrepaidInput(idx){
  var r = rsnGet(idx); if (!r) return;
  var inp = document.getElementById('rsn-cc-prepaid'); if (!inp) return;
  if (inp.readOnly) return;             /* 收款渠道有值时预收款抵扣锁死（有值即视为金额已推给该渠道） */
  var f = window.__rsnForm || (window.__rsnForm = { channel: rsnDefaultChannel(r), method: '', prepaid: rsnDefaultPrepaid(r) });
  /* 只留数字和一个小数点（输入过程中不强改成两位小数，否则会「边打边被改」） */
  var raw = String(inp.value == null ? '' : inp.value).replace(/[^\d.]/g, '');
  var dot = raw.indexOf('.');
  if (dot >= 0) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '');
  if (raw !== inp.value) inp.value = raw;
  var val = rsnNum(raw);
  var cap = Math.min(rsnNet(r), rsnShownBalance(r));
  if (val > cap){                       /* 超过 min(实际应收, 预收款余额) 才夹回，并把框里的值改成夹回值 */
    val = cap;
    inp.value = rsnMoney(val);
  }
  f.prepaid = rsnMoney(val);
  /* 越过「全额抵扣」这条线（收款金额 0 ↔ 正数）时，只切 渠道/方式/收款金额/支付状态/在线操作项/二维码 的显隐，
     **不重绘**：输入框不重建，用户能连续改数。
     ★ 这里**不**自动预选渠道：一预选渠道，预收款抵扣就按口径锁死（渠道非空不可编辑），
       用户正在连着敲数字就会突然打不进去。渠道留空让他先把数改完，失焦时再按默认渠道预选（见 rsnPrepaidBlur）。 */
  var coveredNow = (val >= rsnNet(r));
  if (coveredNow !== !!r.__ccCovered){
    r.__ccCovered = coveredNow;
    rsnApplyCovered(coveredNow, r);
  }
  var cashEl = document.getElementById('rsn-cc-cash');
  if (cashEl) cashEl.value = rsnMoney(Math.max(0, Math.round((rsnNet(r) - val) * 100) / 100));
  /* 场景说明条跟着变（金额改了，说明里的「剩余」也要对）；只改文字，不重绘整框 */
  var tipEl = document.getElementById('rsn-cc-tip');
  if (tipEl) tipEl.textContent = '当前场景说明：' + rsnCollectTip(r);
}
/* 失焦时才把框里的值规整成两位小数（输入过程中不动它，避免「边打边被改」的感觉） */
function rsnPrepaidBlur(idx){
  var r = rsnGet(idx); if (!r) return;
  var inp = document.getElementById('rsn-cc-prepaid'); if (!inp) return;
  var f = window.__rsnForm;
  var val = rsnNum(rsnMoneyInput(inp.value));
  var cap = Math.min(rsnNet(r), rsnShownBalance(r));
  if (val > cap) val = cap;
  inp.value = rsnMoney(val);
  if (f) f.prepaid = rsnMoney(val);
  var coveredNow = (val >= rsnNet(r));
  if (coveredNow !== !!r.__ccCovered){
    r.__ccCovered = coveredNow;
    rsnApplyCovered(coveredNow, r);
  }
  /* 改完数、离开输入框时才按默认渠道预选（用户 2026-10-26：需要使用收款渠道时默认「用户App」）。
     预选之后预收款抵扣按口径锁死；要再改就先把渠道清空回「请选择」。 */
  if (!coveredNow && f && !f.channel){
    f.channel = rsnDefaultChannel(r);
    var chSel = document.getElementById('rsn-cc-channel');
    if (chSel) chSel.value = f.channel;
    rsnApplyCovered(false, r);
  }
  var cashEl = document.getElementById('rsn-cc-cash');
  if (cashEl) cashEl.value = rsnMoney(Math.max(0, Math.round((rsnNet(r) - val) * 100) / 100));
}
/* 按钮格：照「维修结算收款」原页逐条复制，只有一处是新页合并带来的（线下收款那档）：
   · 收款渠道＝用户App    → 【同步给App】＋【关闭】（订单已在该渠道落定且未发起时换成【撤回】＋【关闭】）
   · 收款渠道＝支付二维码 → 【获取二维码】＋【关闭】（已落定且待支付时换成【取消支付】＋【关闭】）
   · 收款渠道＝门店自行（线下收款）/ 预收款全额抵扣 → 【确认】＋【取消】
   原页 在线支付 弹框里没有【确认】【取消】，只有【关闭】；线下收款那份是原页的【收款】弹框
   （确认收款 + 取消），两页合并后按渠道分档保留各自那一对，不再统一成「取消 + 确认」。 */
function rsnCollectActions(r, pick, covered){
  var online = (pick === '用户App' || pick === '支付二维码');
  /* 「确认 + 取消」这一对的适用面：线下收款 / 全额抵扣 / 在线支付已成功（该入账了）。
     在线支付成功这一档，原页是「关闭弹框 → 点【收款】确认」，两页合并后【收款】这一下就落在本弹框，
     所以这里必须给【确认】，否则一次在线收款永远收不了尾。 */
  var paid = (rsnStateForSel(r, pick) === 'SUCCESS');
  var useLocal = covered || !online || paid;
  /* ★ 2026-10-27：本按钮**不再加 disabled**（同样因为全站没有 `.lt-btn:disabled` 样式，
     加了只是「看起来能点、点了没反应」）。订单在支付中时点【确认】由 rsnSubmitCollect
     统一提示「订单在支付中（待支付），勿重复收款」。 */
  /* ★ 按钮必须是按钮格的**直接子元素**：间距靠 `.np-form-grid .form-actions{display:flex;gap:8px}`，
     包一层 <span> 就等于把整组变成一个 flex item，按钮会挤在一起、一点空隙都没有（2026-10-26 用户指出）。
     所以显隐改成「逐个按钮切 display」，靠 id 定位（浏览器与自检桩都能取到）。 */
  var btns = [
    '<button id="rsn-btn-cancel" class="lt-btn lt-btn-default"' + (useLocal ? '' : ' style="display:none"') +
      ' onclick="rsnCloseConfirmCollect(' + r.idx + ')">取消</button>',
    '<button id="rsn-btn-confirm" class="lt-btn lt-btn-primary"' + (useLocal ? '' : ' style="display:none"') +
      ' onclick="rsnSubmitCollect(' + r.idx + ')">确认</button>'
  ];
  if (online){
    /* 在线渠道那一对（原页口径）：同步给App/获取二维码 或 撤回/取消支付 ＋ 关闭 */
    rsnOnlineOps(r, pick).forEach(function (b) {
      btns.push(rsnTagBtn(b, 'rsn-btn-op', useLocal));
    });
    btns.push('<button id="rsn-btn-close" class="lt-btn lt-btn-default"' + (useLocal ? ' style="display:none"' : '') +
      ' onclick="rsnCloseConfirmCollect(' + r.idx + ')">关闭</button>');
  }
  return btns.join('');
}
/* 给在线操作项按钮补一个固定 id（并必要时隐藏），好让显隐切换能定位到它 */
function rsnTagBtn(html, id, hidden){
  var s = String(html).replace('<button class="lt-btn', '<button id="' + id + '" class="lt-btn');
  if (hidden) s = s.replace('<button ', '<button style="display:none" ');
  return s;
}
/* 在线操作项（原页 rscOnlineActions 的同一套口径），只按「收款渠道下拉当前选了什么」算：
   未落定该渠道 → 同步给App / 获取二维码；已落定 → 撤回 / 取消支付。
   ★ 2026-10-26 用户第九次纠正（真逻辑漏洞）：之前这里对「支付已取消 / 支付已超时」直接 `return []`，
     结果那两态下重新选了收款渠道，界面上只剩【关闭】，发起不了支付 —— 而「取消/超时＝系统把渠道置空、
     可重新选择」是 PRD 6.1.1 明写的，渠道既然能重选，按「收款渠道：空」那一格就该出【同步给App】/【获取二维码】。
     所以判据统一成「**下拉所选渠道是否与订单已落定的渠道一致**」：取消/超时时订单渠道为空 → 必然不一致 → 未落定 → 出发起按钮。
     真正「无操作项」的是 PRD 另两格：用户App·待支付(支付中)、用户App·支付成功（只能关闭）。 */
function rsnOnlineOps(r, pick){
  var chans = rsnOnlineChannelsOf(r);
  if (!chans.length) return [];                            /* 未接入支付的门店：无在线操作项 */
  var sel = pick || '';
  if (sel !== '用户App' && sel !== '支付二维码') return [];  /* 门店自行＝线下收款，没有在线操作项 */
  var ch = rsnOnlineChannel(r), st = rsnOrderPayState(r);
  /* 未落定（含「取消/超时后渠道已被系统置空再重选」）→ 发起支付 */
  if (ch !== sel){
    return [sel === '用户App'
      ? '<button class="lt-btn lt-btn-primary" onclick="rsnOnlineSyncApp(' + r.idx + ')">同步给App</button>'
      : '<button class="lt-btn lt-btn-primary" onclick="rsnOnlineGetQr(' + r.idx + ')">获取二维码</button>'];
  }
  if (sel === '用户App' && st === ''){
    return ['<button class="lt-btn lt-btn-default" onclick="rsnOnlineWithdraw(' + r.idx + ')">撤回</button>'];
  }
  if (sel === '支付二维码' && (st === 'PAYING' || st === '')){
    return [st === 'PAYING'
      ? '<button class="lt-btn lt-btn-default" onclick="rsnOnlineCancelPay(' + r.idx + ')">取消支付</button>'
      : '<button class="lt-btn lt-btn-primary" onclick="rsnOnlineGetQr(' + r.idx + ')">获取二维码</button>'];
  }
  return [];
}
/* 确认并收款：校验 → 写两条收退款流水（预收款账户 + 渠道/方式）→ 回写预收款使用流水 → 状态置已支付/已结算 */
function rsnSubmitCollect(idx){
  var r = rsnGet(idx); if (!r) return;
  if (r.status !== 'UNPAID' && r.status !== 'PAYING' && r.status !== 'PAID_PENDING_COLLECTION'){ npToast('当前状态不可收款'); return; }
  if (rsnOrderPayState(r) === 'PAYING'){ npToast('订单在支付中（待支付），勿重复收款'); return; }
  var f = window.__rsnForm || {};
  var net = rsnNet(r), bal = rsnShownBalance(r);
  var prepaid = Math.round(rsnNum(f.prepaid) * 100) / 100;
  var cash = Math.max(0, Math.round((net - prepaid) * 100) / 100);
  var dErr = rsnDiscountCheck(r);
  if (dErr){ npToast(dErr); return; }
  if (prepaid < 0){ npToast('预收款抵扣不能为负数'); return; }
  if (prepaid > net + 0.001){ npToast('预收款抵扣不能大于实际应收金额 ¥' + rsnMoney(net)); return; }
  if (prepaid > bal + 0.001){ npToast('预收款抵扣不能大于预收款余额 ¥' + rsnMoney(bal)); return; }
  if (prepaid <= 0 && cash <= 0){ npToast('请填写预收款抵扣或收一个大于 0 的收款金额'); return; }
  if (cash > 0 && !f.channel){ npToast('收款金额大于 0，请选择收款渠道'); return; }
  if (cash > 0 && f.channel === '门店自行' && !f.method){ npToast('收款金额大于 0，请选择收款方式'); return; }
  var time = (typeof npNowLocal === 'function') ? npNowLocal() : '';
  if (!r.payRecords) r.payRecords = [];
  if (prepaid > 0){
    r.payRecords.push({ type:'收款', channel:'预收款账户', method:'', amount: rsnMoney(prepaid), time: time, payState:'OK' });
  }
  if (cash > 0){
    r.payRecords.push({ type:'收款', channel: f.channel, method: f.method, amount: rsnMoney(cash), time: time, payState:'OK' });
  }
  /* 预收款抵扣必须回写「预收款」使用流水（余额＝充值−使用，唯一权威） */
  var wrote = prepaid > 0 ? rsnWritePrepaidUsage(r, prepaid, time) : false;
  /* 在线渠道收款 → 订单支付状态置成功；门店自行＝线下、以及全额抵扣（cash=0，根本没有在线上收钱）
     → 都不挂支付状态（否则会把「在线支付成功」记成发生过） */
  if (cash > 0 && (f.channel === '用户App' || f.channel === '支付二维码')){
    r.payChannel = f.channel; r.payState = 'SUCCESS';
  } else {
    r.payChannel = ''; r.payState = '';
  }
  r.status = 'PAID'; r.settlement = 'SETTLED';
  rsnSyncAppPayable(r, false);
  window.__rsnDemoBackup = null;
  r.__demoBal = null; r.__prepaidIx = null; r.__ccCovered = null;
  npCloseModal();
  rsnOpenPanel(idx);
  var st = NP['repair-settlement-new']; if (st && st.render) st.render();
  npToast('已确认收款：预收款 ¥' + rsnMoney(prepaid)
    + (cash > 0 ? ' + 本次收款 ¥' + rsnMoney(cash) + '（' + f.channel + '·' + f.method + '）' : '')
    + (wrote ? '；已在「预收款」登记一条使用流水（业务＝维修结算）' : ''));
}
/* 面板在弹框后面开着时，改动后原地重开，保证折让锁定/解锁与金额快照同步 */
function rsnRefreshPanelBehind(r){
  var p = document.getElementById('rsn-panel');
  if (p && p.classList && p.classList.contains && p.classList.contains('show')) rsnOpenPanel(r.idx);
}
function rsnOnlineSyncApp(idx){
  var r = rsnGet(idx); if (!r) return;
  r.__demoIx = null;                       /* 真实操作后不再按「点过的演示场景」高亮，改按真实状态反查 */
  r.payChannel = '用户App'; r.payState = '';
  if (!r.payOrderNo) r.payOrderNo = 'YJ_WXSK_' + r.order + '01';
  if (window.__rsnForm) window.__rsnForm.channel = '用户App';
  rsnSyncAppPayable(r, true);
  rsnRenderConfirmCollect(r); rsnRefreshPanelBehind(r);
  npToast('已把最新结算收款单同步给App（App 可支付）');
}
function rsnOnlineGetQr(idx){
  var r = rsnGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payChannel = '支付二维码'; r.payState = 'PAYING';
  if (!r.payOrderNo) r.payOrderNo = 'YJ_WXSK_' + r.order + '01';
  r.payQrTime = (typeof npNowLocal === 'function') ? npNowLocal() : '';
  if (window.__rsnForm) window.__rsnForm.channel = '支付二维码';
  rsnSyncAppPayable(r, false);
  rsnRenderConfirmCollect(r); rsnRefreshPanelBehind(r);
  npToast('已展示支付二维码（微信/支付宝二码合一），已向App传"不可支付"');
}
function rsnOnlineWithdraw(idx){
  var r = rsnGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payChannel = ''; r.payState = '';
  /* 撤回后渠道回到默认（默认即「用户App」，门店没接支付才是「门店自行」）；
     要再落定得点【同步给App】—— 这样按钮就不会在「还没落定」时冒出【撤回】。 */
  if (window.__rsnForm){ window.__rsnForm.channel = rsnDefaultChannel(r); window.__rsnForm.method = ''; }
  rsnSyncAppPayable(r, false);
  rsnRenderConfirmCollect(r); rsnRefreshPanelBehind(r);
  npToast('已撤回：向App传"不可支付"；收款渠道已置空，折让项目已解锁');
}
function rsnOnlineCancelPay(idx){
  var r = rsnGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payChannel = ''; r.payState = '';
  if (window.__rsnForm){ window.__rsnForm.channel = rsnDefaultChannel(r); window.__rsnForm.method = ''; }
  rsnSyncAppPayable(r, false);
  rsnRenderConfirmCollect(r); rsnRefreshPanelBehind(r);
  npToast('已取消支付：收款渠道已置空可重新选择，折让项目已解锁');
}
/* 演示专用：模拟支付平台回调成功（PRD 该场景无操作项） */
function rsnOnlineDemoPaid(idx){
  var r = rsnGet(idx); if (!r) return;
  r.__demoIx = null;
  r.payState = 'SUCCESS'; r.status = 'PAID_PENDING_COLLECTION';
  rsnSyncAppPayable(r, false);
  npCloseModal(); rsnOpenPanel(idx);
  npToast('（演示）支付已到账，请点【确认并收款】完成结算确认');
}
/* 取消/关闭：只关弹框，**不改任何数据**
   ★ 2026-10-27 用户报「选了支付方式、关掉弹窗再点就点不动」，排查中发现这里原本还会在
     「支付已取消 / 已超时」时顺手把 payChannel/payState 清空并重绘面板 —— 关一次弹窗就改一次数据，
     按钮状态也跟着变，用户完全无法预期。系统自动置空那套动作已经由演示场景 rsnDemoScene
     （ch='' + st 保留）与真实操作（撤回 / 取消支付）落地，关闭弹框不该有副作用。 */
function rsnCloseConfirmCollect(idx){
  npCloseModal();
}

/* ---------- 弹框：收退款详情 ----------
   用户口径（2026-10-21 / 2026-10-26 两次拍板，均已并入 PRD 6.1.1【收款】渠道矩阵）：
   1 顶部信息区 4 格顺序＝维修工单号、结算单号、已收款金额、已退款金额
   2 表格去掉「票据号」列
   3 收退款渠道＝门店自行 / 支付二维码 / 用户App
      ※ 2026-10-26「维修结算收款(新)」新增第 4 个渠道「预收款账户」：
        预收款抵扣记「收款」、退回预收款账户记「退款」，**收款/退款列不变**（仍是收款/退款），
        只把「收退款渠道」显示成「预收款账户」；该渠道没有线下·线上方式，方式列显示「—」。
     收退款方式（门店自行）＝微信 / 支付宝 / 银行卡 / 现金（**已去掉「挂账」**，2026-10-26 用户拍板）
     渠道与方式联动：门店自行 → 按门店类型：直营＝银行卡、现金；非直营＝微信、支付宝、银行卡、现金
                     支付二维码 → 只有微信、支付宝
                     用户App   → 只有微信、支付宝 */
var RSN_PAY_CHANNELS = ['门店自行', '支付二维码', '用户App', '预收款账户'];
/* 预收款账户＝预收款抵扣/退回，没有收退款方式（明细里显示「—」） */
var RSN_PAY_CHANNEL_PREPAID = '预收款账户';
/* 门店自行（线下收款）的方式：非直营全量、直营只收银行卡/现金（PRD 表格：微信/支付宝 直营为空） */
var RSN_PAY_METHODS_OWN_DIRECT = ['银行卡', '现金'];
var RSN_PAY_METHODS_OWN = ['微信', '支付宝', '银行卡', '现金'];
var RSN_PAY_METHODS_ONLINE = ['微信', '支付宝'];
/* 按渠道取可用收退款方式（渠道→方式联动口径的唯一来源）
   第二参数：门店是否直营（不传＝按非直营全量，兼容旧调用点） */
function rsnPayMethodsOf(channel, direct){
  if (channel === '门店自行') return direct ? RSN_PAY_METHODS_OWN_DIRECT.slice() : RSN_PAY_METHODS_OWN.slice();
  if (channel === '支付二维码' || channel === '用户App') return RSN_PAY_METHODS_ONLINE.slice();
  return [];
}
/* 渠道切换 → 方式下拉重画（仅保留该渠道允许的方式） */
function rsnPayChannelChange(channel, selId){
  var sel = document.getElementById(selId);
  if (!sel) return;
  var opts = rsnPayMethodsOf(channel);
  sel.innerHTML = '<option value="">请选择</option>'
    + opts.map(function(m){ return '<option value="' + npEscape(m) + '">' + npEscape(m) + '</option>'; }).join('');
}
/* 收退款流水每笔的支付状态（用户 2026-10-22 口径：成功 / 失败 / 待支付 / 支付超时 / 支付失败）
   收款行用：成功、待支付、支付超时、支付失败；退款行用：成功、失败（退款失败，无"支付超时/待支付"） */
var RSN_PAY_STATE = {
  OK:'成功', FAIL:'失败', WAIT:'待支付', TIMEOUT:'支付超时', PAY_FAIL:'支付失败'
};
/* lt-badge 只有 ok/off/warn 三个修饰类，按语义收敛（不自造类） */
var RSN_PAY_STATE_BADGE = {
  OK:'ok', FAIL:'off', WAIT:'warn', TIMEOUT:'off', PAY_FAIL:'off'
};
/* 支付状态标签（复用全站 .lt-badge 三档修饰类，不自造样式） */
function rsnPayStateBadge(state){
  var label = RSN_PAY_STATE[state] || '';
  return '<span class="lt-badge ' + (RSN_PAY_STATE_BADGE[state] || 'warn') + '">' + npEscape(label) + '</span>';
}
/* 收退款流水示例数据：挂在结算单上 r.payRecords（payState＝支付状态，见RSN_PAY_STATE） */
function rsnPayRecords(r){
  return r.payRecords || [];
}
/* 明细行按时间倒序（最新在上）；时间格式固定 YYYY-MM-DD HH:mm，字符串比较即可，
   同秒再按原顺序稳定（Array.prototype.sort 在各引擎均为稳定排序） */
function rsnPayRecordsByTimeDesc(r){
  return rsnPayRecords(r).slice().sort(function(a, b){
    return (b.time || '').localeCompare(a.time || '');
  });
}
/* 已收/已退款金额只累计「支付状态＝成功」的流水；待支付、支付超时、支付失败、失败均不计入 */
function rsnPayIsOk(x){
  return x.payState === 'OK';
}
function rsnOpenPayRefundDetail(idx){
  var r = rsnGet(idx); if (!r) return;
  var recs = rsnPayRecordsByTimeDesc(r);
  var received = 0, refunded = 0;
  recs.forEach(function(x){
    if (!rsnPayIsOk(x)) return;
    if (x.type === '退款') refunded += rsnNum(x.amount); else received += rsnNum(x.amount);
  });
  /* 顶部信息区：维修工单号、结算单号、已收款金额、已退款金额（4 格一行，只读框内标签） */
  var head =
    '<div class="lt-filter-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));">' +
      npFItem('维修工单号', '<input type="text" readonly value="' + npEscape(r.order) + '">') +
      npFItem('结算单号', '<input type="text" readonly value="' + npEscape(r.id) + '">') +
      npFItem('已收款金额', '<input type="text" readonly value="' + rsnMoney(received) + '">') +
      npFItem('已退款金额', '<input type="text" readonly value="' + rsnMoney(refunded) + '">') +
    '</div>';
  /* 明细表：序号、收款/退款、收退款渠道、收退款方式、支付状态、金额、时间 */
  var cols = [
    {t:'序号', w:60}, {t:'收款/退款', w:90}, {t:'收退款渠道', w:130}, {t:'收退款方式', w:100},
    {t:'支付状态', w:110}, {t:'金额', w:110}, {t:'时间', w:170}
  ];
  var rows = recs.length ? recs.map(function(x, i){
    /* 预收款账户渠道没有「收退款方式」，按全站空值口径显示「—」（不留空单元格） */
    var method = x.method ? x.method : '—';
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + npEscape(x.type) + '</td>'
      + '<td>' + npEscape(x.channel) + '</td>'
      + '<td>' + npEscape(method) + '</td>'
      + '<td>' + rsnPayStateBadge(x.payState) + '</td>'
      + '<td>' + npEscape(rsnMoney(x.amount)) + '</td>'
      + '<td>' + npEscape(x.time) + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#999;padding:20px">暂无收退款记录</td></tr>';
  var body = head
    + '<div class="lt-table-wrap" style="box-shadow:none;margin-top:12px">'
    + '<table class="lt-table"><thead><tr>' + npTH(cols) + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  npOpenModal('收退款详情', body, '', {width:1040});
}
/* ---------- 弹框：查看退款 / 查看异常 ---------- */
function rsnRefundSteps(r){
  var before = r.refundRoute === 'BEFORE_COLLECTION';
  var labels = before ? ['发起退款','退款完成']
    : ['反结算', r.refundHadInvoice ? '红冲发票' : '无票跳过红冲', '发起退款', '退款完成'];
  var done = (r.status === 'REFUNDED') ? labels.length : labels.length - 1;
  return labels.map(function(t, i){
    return '<span style="display:inline-block;margin-right:16px;color:' + (i < done ? '#185FA5' : '#999') + '">'
      + (i < done ? '✓ ' : (i+1) + '. ') + npEscape(t) + '</span>';
  }).join('');
}
function rsnOpenRefund(idx){
  var r = rsnGet(idx); if (!r) return;
  if (!rsnInRefund(r)) { npToast('当前状态不可查看退款'); return; }
  var body =
    '<div class="pso-info-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      rsnInfoItem('结算单号', r.id) +
      rsnInfoItem('门店', (rsnStore(r.storeCode) || {}).name) +
      rsnInfoItem('车辆', r.plate + ' / ' + r.vin.slice(0, 8) + '****') +
      rsnInfoItem('退款状态', RSN_LABELS.status[r.status]) +
      rsnInfoItem('退款原因', r.refundReason) +
      rsnInfoItem('退款单号', r.refundRequestNo) +
      rsnInfoItem('退款金额', '¥' + rsnMoney(rsnNet(r))) +
      rsnInfoItem('结算状态', rsnSettleLabel(r)) +
    '</div>' +
    '<div class="pm-section-title">退款流程</div><div style="font-size:13px;margin-bottom:12px">' + rsnRefundSteps(r) + '</div>' +
    (r.refundRoute === 'BEFORE_COLLECTION'
      ? '<div class="pm-tip-warn" style="margin-top:0">本单收款前发起退款，退款成功后不反结算、不红冲发票。</div>'
      : '<div class="pm-tip-warn" style="margin-top:0">本单收款后发起退款，系统已依次反结算'
        + (r.refundHadInvoice ? '、红冲已开具发票' : '（无票跳过红冲）') + '并发起原路退款。</div>');
  var pending = (r.status === 'REFUNDING' || r.status === 'REFUND_FAIL');
  npOpenModal('退款详情', body,
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">关闭</button>' +
    (pending ? '<button class="lt-btn lt-btn-default" onclick="rsnRefundResult(' + idx + ',0)">退款失败</button>' +
               '<button class="lt-btn lt-btn-primary" onclick="rsnRefundResult(' + idx + ',1)">退款成功</button>' : ''),
    {width:780});
}
function rsnRefundResult(idx, ok){
  var r = rsnGet(idx); if (!r) return;
  if (!rsnInRefund(r) || r.status === 'REFUNDED') { npCloseModal(); npToast('状态已变化，请关闭后刷新'); return; }
  r.status = ok ? 'REFUNDED' : 'REFUND_FAIL';
  npCloseModal(); rsnRenderAfterChange(r);
  rsnOpenRefund(idx);
}
/* ★ 2026-10-23：「查看异常」已从列表操作列移除（操作列只按工单结算状态分两档，用户口径），
   本弹框当前无任何页面入口（rsnOpenException 全站仅此定义、无调用）。
   保留定义不删的理由：弹框内容（结算单号/门店/车辆/结算状态/应收可退金额/支付单号）是现成的，
   后续若要从收款详情面板或收退款详情复用可直接接；是否彻底清除待用户定。 */
function rsnOpenException(idx){
  var r = rsnGet(idx); if (!r) return;
  var body =
    '<div class="pso-info-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      rsnInfoItem('结算单号', r.id) +
      rsnInfoItem('门店', (rsnStore(r.storeCode) || {}).name) +
      rsnInfoItem('车辆', r.plate + ' / ' + r.vin.slice(0, 8) + '****') +
      rsnInfoItem('结算状态', rsnSettleLabel(r)) +
      rsnInfoItem('应收/可退金额', '¥' + rsnMoney(r.total)) +
      rsnInfoItem('支付单号', r.payOrderNo) +
    '</div>' +
    '<div class="pm-tip-warn" style="margin-top:0">金额或门店信息待核对，支付及开票入口已关闭。请联系财务人员处理。</div>';
  npOpenModal('支付异常', body,
    '<button class="lt-btn lt-btn-primary" onclick="npCloseModal()">知道了</button>', {width:720});
}

/* ---------- 发票整页（psi 范式：顶部信息区 + 卡片列表 + 底部通栏申请开票） ---------- */

/* 发票记录：挂在结算单上（r.invoices），未挂时按发票状态派生一张
   2026-10-21：新增申请来源 source（App / DMS）、发票类型 invType + 对应抬头
   source 示例数据混合分布（按用户拍板，不按渠道模式区分） */
function rsnInvoices(r){
  if (r.invoices && r.invoices.length) return r.invoices;
  var list = [];
  var net = rsnNet(r);
  /* 已开票 */
  if (r.invoice === 'ISSUED' || r.invoice === 'CREDITING' || r.invoice === 'CREDITED' || r.invoice === 'CREDIT_FAIL'){
    list.push({
      state: r.invoice === 'ISSUED' ? '开票成功'
        : (r.invoice === 'CREDITING' ? '作废冲红中'
          : (r.invoice === 'CREDIT_FAIL' ? '作废失败' : '已冲红')),
      invType: '001数电专用发票',
      invoiceNo: r.invoiceNo || rsnHash32(),
      applyNo: rsnHash32(),
      applyTime: (r.invoiceDate || r.date || '').slice(0, 16),
      source: 'DMS',
      amount: rsnMoney(net),
      buyer: rsnInvoiceBuyer(r),
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
      applyNo: rsnHash32(),
      applyTime: r.date,
      source: 'App',
      amount: rsnMoney(net),
      buyer: null,
      title: rsnFeeObjectName(r),
      failReason: r.invoice === 'FAILED' ? (r.failReason || '开票平台返回：购买方信息校验未通过，请核对后重新申请开票') : ''
    });
  }
  return list;
}
/* 001 数电专用发票的购买方 6 项（购买方名称 = 门店名，其余取结算单示例值） */
function rsnInvoiceBuyer(r){
  var s = rsnStore(r.storeCode);
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
function rsnFeeObjectText(r){
  var name = r.reporter || '—';
  var own = (window.CAR_OWNERS || []).filter(function(o){ return o.name === name; })[0];
  var code = own ? own.code : ('KH' + (9001 + r.idx));
  return name + '(' + code + ')';
}
/* 收费对象姓名（不含客户ID）—— 申请开票的「客户名称」用这个 */
function rsnFeeObjectName(r){
  return r.reporter || '—';
}
/* 门店纳税识别号：直营取门店主数据税号，非直营留空 */
function rsnStoreTaxText(r){
  var s = rsnStore(r.storeCode);
  if (!s) return '';
  return s.channelMode === '直营' ? (s.taxNo || '') : '';
}
/* 顶部信息区数据（9 项，3 列 × 3 行） */
function rsnInvTopInfo(r){
  var received = rsnNet(r);
  var refunded = rsnInRefund(r) && r.refundRoute === 'AFTER_COLLECTION' ? received : 0;
  var invoiced = 0;
  rsnInvoices(r).forEach(function(iv){
    var amt = iv.amount ? rsnNum(iv.amount) : received;
    if (iv.state === '开票成功' || iv.state === '开票中' || iv.state === '作废冲红中' || iv.state === '作废失败') invoiced += amt;
    if (iv.state === '已冲红') invoiced -= amt;
  });
  invoiced = Math.max(0, invoiced);
  return {
    received: received, refunded: refunded, invoiced: invoiced,
    payable: rsnNum(r.total) - rsnDiscountTotal(r)
  };
}
/* 顶部信息区一行（3 格，与配件销售 psi-info-row 同构） */
function rsnInvInfoLine(pairs){
  var cells = pairs.map(function(p){
    var val = (p[1] === undefined || p[1] === null) ? '' : p[1];
    return '<span class="psi-info-cell"><span class="psi-info-k">' + npEscape(p[0]) + '：</span>'
      + '<span class="psi-info-v' + (p[2] ? ' money' : '') + '">' + npEscape(val) + '</span></span>';
  });
  return '<div class="psi-info-row">' + cells.join('') + '</div>';
}
function rsnInvTopInfoHtml(r){
  var s = rsnStore(r.storeCode);
  var t = rsnInvTopInfo(r);
  return '<div class="psi-info">'
    + rsnInvInfoLine([
        ['门店', rsnStoreShort(r.storeCode) + '(' + r.storeCode + ')'],
        ['门店纳税识别号', rsnStoreTaxText(r)],
        ['收费对象', rsnFeeObjectText(r)]
      ])
    + rsnInvInfoLine([
        ['维修工单号', r.order],
        ['结算单号', r.id],
        ['用户自费金额', rsnMoney(t.payable), true]
      ])
    + rsnInvInfoLine([
        ['已收金额', rsnMoney(t.received), true],
        ['已退金额', rsnMoney(t.refunded), true],
        ['发票已开金额', rsnMoney(t.invoiced), true]
      ])
    + '</div>';
}
/* 发票类型 + 该类型下开票申请时填的内容
   用户口径：「001数电专用发票」本身就是标签（带冒号），冒号后面才是内容；
   内容 = 001 的购买方名称/纳税人识别号/地址/电话/开户行/账号，或 002 的客户名称。
   内容之间逗号分隔挤一行，且不带任何子标签；空值不占位（过滤掉，避免「，，」） */
function rsnInvTypeLine(iv){
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
function rsniRenderInvoicePage(){
  var root = document.getElementById('page-repair-settlement-new-invoice');
  if (!root) return;
  var r = rsniCurSettle();
  if (!r) { root.innerHTML = '<div class="psi-page">未找到该结算单</div>'; return; }

  var isDirect = rsnStoreType(r) === '直营店';
  var list = rsnInvoices(r);
  var cards = '';
  for (var i = 0; i < list.length; i++){
    var iv = list[i];

    /* 卡片左侧：每项单独一行。申请来源并入「开票申请编号」一行；发票类型 + 抬头单独一行 */
    var left = '';
    if (iv.invoiceNo) left += '<div class="psi-inv-line"><span class="psi-inv-k">发票号：</span>' + npEscape(iv.invoiceNo) + '</div>';
    left += '<div class="psi-inv-line"><span class="psi-inv-k">申请时间：</span>' + npEscape(iv.applyTime) + '</div>';
    left += '<div class="psi-inv-line"><span class="psi-inv-k">开票申请编号：</span>' + npEscape(iv.applyNo)
      + '，来源：' + npEscape(iv.source || '') + '</div>';
    left += '<div class="psi-inv-line">' + npEscape(rsnInvTypeLine(iv)) + '</div>';
    /* 失败原因：开票失败 / 作废失败 —— 左侧卡片最后一行，红色字体 */
    if (iv.state === '开票失败' && iv.failReason){
      left += '<div class="psi-inv-line psi-inv-reason">开票失败原因：' + npEscape(iv.failReason) + '</div>';
    } else if (iv.state === '作废失败' && iv.failReason){
      left += '<div class="psi-inv-line psi-inv-reason">作废失败原因：' + npEscape(iv.failReason) + '</div>';
    }

    /* 卡片右上：状态标签（复用全站 .lt-badge）+ 右侧按钮 */
    var badge = '', right = '';
    right += '<button class="lt-btn lt-btn-default" onclick="rsniCopyInvoiceInfo(' + i + ')">复制开票信息</button>';
    if (iv.state === '开票中') {
      badge = '<span class="lt-badge warn">开票中</span>';
    } else if (iv.state === '开票成功') {
      badge = '<span class="lt-badge ok">开票成功</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsniDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
      right += '<button class="lt-btn lt-btn-primary" onclick="rsniVoidInvoice(' + i + ')">作废冲红</button>';
    } else if (iv.state === '作废冲红中') {
      badge = '<span class="lt-badge warn">作废冲红中</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsniDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
    } else if (iv.state === '已冲红') {
      badge = '<span class="lt-badge off">已冲红</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsniDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
    } else if (iv.state === '开票失败') {
      /* 开票失败：右侧只有「复制开票信息」（重新发起开票用），不出下载发票/作废冲红 */
      badge = '<span class="lt-badge off">开票失败</span>';
    } else if (iv.state === '作废失败') {
      /* 作废失败：发票仍有效，可下载、可再次发起作废冲红 */
      badge = '<span class="lt-badge off">作废失败</span>';
      right += '<button class="lt-btn lt-btn-default" onclick="rsniDownloadInvoice(\'' + iv.state + '\')">下载发票</button>';
      right += '<button class="lt-btn lt-btn-primary" onclick="rsniVoidInvoice(' + i + ')">作废冲红</button>';
    } else {
      badge = '<span class="lt-badge off">' + npEscape(iv.state) + '</span>';
    }
    /* 上传发票：仅非直营门店，与其它操作按钮同排同款（用户口径：按钮旁多一个按钮，不要提示文字） */
    if (!isDirect && (iv.state === '开票中' || iv.state === '作废冲红中')){
      right += '<button class="lt-btn lt-btn-default" onclick="rsniUploadInvoice()">上传发票</button>';
    }
    /* 标记失败：仅非直营门店 —— 开票中 → 开票失败；作废冲红中 → 作废失败
       （直营由总部统一开票，门店不自行标失败） */
    if (!isDirect && iv.state === '开票中'){
      right += '<button class="lt-btn lt-btn-default" onclick="rsniOpenFailPanel(' + i + ')">开票失败</button>';
    }
    if (!isDirect && iv.state === '作废冲红中'){
      right += '<button class="lt-btn lt-btn-default" onclick="rsniOpenFailPanel(' + i + ')">作废失败</button>';
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
      + '<button class="psi-back" onclick="rsniBackToList()" title="返回">&#10094;</button>'
      + '<span class="psi-page-title">发票</span>'
    + '</div>'
    + rsnInvTopInfoHtml(r)
    + '<div class="psi-inv-list">' + (cards || '<div class="psi-inv-empty">暂无发票记录</div>') + '</div>'
    + '<div class="psi-page-foot"><button class="psi-full-btn" onclick="rsniOpenApplyPanel()">+申请开票</button></div>'
    + '</div>';
}
/* 当前结算单（从列表行 / 详情面板跳进来时带上 idx） */
function rsniCurSettle(){
  var idx = window.__RSN_INVOICE_IDX;
  if (idx === undefined || idx === null) return null;
  return rsnGet(idx);
}
/* 从列表行 / 详情面板进入发票整页 */
function rsnOpenInvoicePage(idx){
  window.__RSN_INVOICE_IDX = idx;
  rsnClosePanel();
  showContent('repair-settlement-new-invoice');
}
/* 返回：统一回「维修结算收款」列表 */
function rsniBackToList(){
  window.__RSN_INVOICE_IDX = undefined;
  showContent('repair-settlement-new');
}
/* 复制开票信息：跳申请开票侧滑面板，并按被点的这张发票类型带出抬头 */
function rsniCopyInvoiceInfo(i){
  var r = rsniCurSettle(); if (!r) return;
  var iv = rsnInvoices(r)[i];
  if (!iv) { npToast('未找到该发票记录'); return; }
  window.__RSN_PREFILL = {
    type: iv.invType,
    buyer: iv.invType === '001数电专用发票' ? iv.buyer : null,
    title: iv.invType === '001数电专用发票' ? '' : (iv.title || rsnFeeObjectName(r))
  };
  rsniOpenApplyPanel();
}
/* 下载发票：已冲红状态下下载的是冲红的那张发票 */
function rsniDownloadInvoice(state){
  npToast(state === '已冲红'
    ? '发票下载（演示）：下载冲红发票文件'
    : '发票下载（演示）：文件流待对接集团电子发票平台后开放');
}
/* 上传发票（复用全站 .np-upload / .np-hint，写法同「配件退货索赔」） */
function rsniUploadInvoice(){
  npToast('上传文件（演示）');
}
/* ---------- 标记失败弹框：开票中 → 开票失败 / 作废冲红中 → 作废失败 ----------
   用户 2026-10-22 口径：非直营门店的卡片点「开票失败」「作废失败」→ 弹框填失败原因 → 提交后才变成失败态。
   原因必填、≤50 字（与「退货原因」≤20 字同一套校验写法：提交时判空 + 判长）。 */
var RSN_FAIL_REASON_MAX = 50;
function rsniOpenFailPanel(i){
  var r = rsniCurSettle(); if (!r) { npToast('请先从结算单进入发票页'); return; }
  var iv = rsnInvoices(r)[i];
  if (!iv) { npToast('未找到该发票记录'); return; }
  if (iv.state !== '开票中' && iv.state !== '作废冲红中') { npToast('仅开票中、作废冲红中的发票可标记失败'); return; }
  var isDirect = rsnStoreType(r) === '直营店';
  if (isDirect) { npToast('直营门店不支持标记失败'); return; }
  var title = (iv.state === '开票中') ? '开票失败' : '作废失败';
  var body =
    '<div class="lt-input-wrap plain required" style="margin-bottom:10px"><span class="lt-filter-prefix required">' + title + '原因</span>' +
      '<input type="text" id="rsni-fail-reason" maxlength="' + RSN_FAIL_REASON_MAX + '" placeholder="请输入' + title + '原因（≤' + RSN_FAIL_REASON_MAX + '字）"></div>';
  var footer =
    '<button class="lt-btn lt-btn-default" onclick="npCloseModal()">取消</button>' +
    '<button class="lt-btn lt-btn-primary" onclick="rsniSubmitFail(' + i + ')">提交</button>';
  npOpenModal(title + ' - ' + r.id, body, footer, { width: 560 });
}
/* 提交失败原因 → 卡片转失败态、左侧末行红字显示原因 */
function rsniSubmitFail(i){
  var r = rsniCurSettle(); if (!r) return;
  var iv = rsnInvoices(r)[i];
  if (!iv) { npCloseModal(); npToast('未找到该发票记录'); return; }
  if (iv.state !== '开票中' && iv.state !== '作废冲红中') { npCloseModal(); npToast('该发票状态已变化，请重新操作'); return; }
  var el = document.getElementById('rsni-fail-reason');
  var reason = el ? el.value.trim() : '';
  if (!reason) { npToast('请填写失败原因'); return; }
  if (reason.length > RSN_FAIL_REASON_MAX) { npToast('失败原因不能超过 ' + RSN_FAIL_REASON_MAX + ' 字'); return; }
  iv.state = (iv.state === '开票中') ? '开票失败' : '作废失败';
  iv.failReason = reason;
  /* 派生卡片（r.invoices 为空、按 r.invoice 状态派生）没有可写的 invoices 数组，
     需把状态回写到结算单的 invoice 字段，否则重新渲染又变回原状态 */
  if (!r.invoices || !r.invoices.length){
    r.invoice = (iv.state === '开票失败') ? 'FAILED' : 'CREDIT_FAIL';
    r.failReason = reason;
  }
  npCloseModal();
  rsniRenderInvoicePage();
  /* 不弹 toast：失败原因已写在卡片最后一行（红字），再弹一次是重复信息 */
}
/* 作废冲红 */
function rsniVoidInvoice(i){
  var r = rsniCurSettle(); if (!r) return;
  var iv = rsnInvoices(r)[i];
  if (!iv) { npToast('未找到该发票记录'); return; }
  if (iv.state !== '开票成功' && iv.state !== '作废失败') { npToast('仅开票成功的发票可作废冲红'); return; }
  if (!window.confirm('确认对发票「' + iv.invoiceNo + '」作废冲红？')) return;
  var reason = window.prompt('请输入作废冲红原因（可留空）', '');
  if (reason === null) return;
  iv.state = '作废冲红中';
  iv.redReason = reason.trim();
  rsniRenderInvoicePage();
  npToast('已提交作废冲红申请' + (reason.trim() ? '，原因：' + reason.trim() : ''));
}
/* 生成 32 位哈希串（发票号 / 开票申请编号用，格式同配件销售） */
function rsnHash32(){
  var s = '', hex = '0123456789abcdef';
  for (var i = 0; i < 32; i++) s += hex.charAt(Math.floor(Math.random() * 16));
  return s;
}

/* ---------- 申请开票侧滑面板（pm-panel 范式） ---------- */
function rsniEnsureApplyPanel(){
  if (document.getElementById('rsn-inv-panel-overlay')) return;
  var d = document.createElement('div');
  d.innerHTML =
    '<div class="pm-panel-overlay" id="rsn-inv-panel-overlay" onclick="rsniCloseApplyPanel()"></div>'
    + '<div class="pm-panel" id="rsn-inv-panel" style="width:1000px">'
      + '<div class="pm-panel-header">'
        + '<span class="pm-panel-title">申请开票</span>'
        + '<button class="pm-panel-close" onclick="rsniCloseApplyPanel()">&#10005;</button>'
      + '</div>'
      + '<div class="pm-panel-body" id="rsn-inv-panel-body"></div>'
      + '<div class="pm-panel-footer" id="rsn-inv-panel-foot"></div>'
    + '</div>';
  while (d.firstChild) document.body.appendChild(d.firstChild);
}
function rsniOpenApplyPanel(){
  var r = rsniCurSettle();
  if (!r) { npToast('请先从结算单进入发票页'); return; }
  if (!rsnCanInvoice(r) && rsnInvoices(r).length){
    var has = rsnInvoices(r).some(function(iv){ return iv.state === '开票成功' || iv.state === '开票中' || iv.state === '作废冲红中' || iv.state === '作废失败'; });
    if (has) { npToast('已有开票请求，请勿重复提交'); return; }
  }
  rsniEnsureApplyPanel();
  rsniRenderApplyPanel();
  document.getElementById('rsn-inv-panel-overlay').classList.add('show');
  document.getElementById('rsn-inv-panel').classList.add('show');
}
function rsniCloseApplyPanel(){
  var o = document.getElementById('rsn-inv-panel-overlay');
  var p = document.getElementById('rsn-inv-panel');
  if (o) o.classList.remove('show');
  if (p) p.classList.remove('show');
  window.__RSN_PREFILL = undefined;
  rsniRenderInvoicePage();
}
function rsniRenderApplyPanel(){
  var body = document.getElementById('rsn-inv-panel-body');
  var r = rsniCurSettle();
  if (!body || !r) return;
  var t = rsnInvTopInfo(r);
  var remain = Math.max(0, t.received - t.invoiced);

  var pf = window.__RSN_PREFILL || null;
  var isSpecial = pf && pf.type === '001数电专用发票';
  var pfType = isSpecial ? '001数电专用发票' : '002数电普通发票';
  var pfBuyer = (pf && pf.buyer) ? pf.buyer : {};
  var pfTitle = (pf && pf.title) ? pf.title : rsnFeeObjectName(r);
  var v = function(x){ return (x === undefined || x === null) ? '' : String(x); };

  body.innerHTML = rsnInvTopInfoHtml(r)
    + '<div class="psi-form">'
      + '<div class="psi-field psi-field-side">'
        + rsniInvFItem('开票金额',
            '<input type="text" id="rsn-inv-amount" readonly value="' + rsnMoney(remain) + '">', true)
        + '<span class="psi-rule">开票已开金额+当前正在申请的应收金额；开票已开金额=已开票的+开票中的-冲红的</span>'
      + '</div>'
      + '<div class="psi-field">'
        + rsniInvFItem('明细要求',
            '<label class="psi-radio"><input type="radio" name="rsn-inv-detail" value="汇总一行" checked>汇总一行</label>'
            + '<label class="psi-radio"><input type="radio" name="rsn-inv-detail" value="明细">明细</label>', true)
      + '</div>'
      + '<div class="psi-field">'
        + rsniInvSelect('发票类型',
            '<select id="rsn-inv-type" onchange="rsniOnInvTypeChange()">'
            + '<option value="001数电专用发票"' + (isSpecial ? ' selected' : '') + '>001数电专用发票</option>'
            + '<option value="002数电普通发票"' + (isSpecial ? '' : ' selected') + '>002数电普通发票</option>'
            + '</select>', true)
      + '</div>'
      + '<div id="rsn-inv-buyer-box">'
        + '<div class="psi-field">' + rsniInvFItem('购买方名称',
            '<input type="text" id="rsn-inv-buyer" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer.name)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsniInvFItem('纳税人识别号',
            '<input type="text" id="rsn-inv-tax" maxlength="30" placeholder="最多30字符" value="' + npEscape(v(pfBuyer.tax)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsniInvFItem('地址',
            '<input type="text" id="rsn-inv-addr" maxlength="80" placeholder="最多80字符" value="' + npEscape(v(pfBuyer.addr)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsniInvFItem('电话',
            '<input type="text" id="rsn-inv-tel" maxlength="20" placeholder="最多20字符" value="' + npEscape(v(pfBuyer.tel)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsniInvFItem('开户行',
            '<input type="text" id="rsn-inv-bank" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer.bank)) + '">', true) + '</div>'
        + '<div class="psi-field">' + rsniInvFItem('账号',
            '<input type="text" id="rsn-inv-account" maxlength="50" placeholder="最多50字符" value="' + npEscape(v(pfBuyer.account)) + '">', true) + '</div>'
      + '</div>'
      + '<div class="psi-field" id="rsn-inv-cust-field">'
        + rsniInvFItem('客户名称',
            '<input type="text" id="rsn-inv-cust" maxlength="50" placeholder="默认填充报修人，可修改" value="' + npEscape(pfTitle) + '">', true)
      + '</div>'
      + '<div class="psi-field">' + rsniInvFItem('发票发送手机号',
          '<input type="text" id="rsn-inv-phone" maxlength="20" placeholder="默认填充报修人手机号，可修改" value="' + npEscape(r.reporterPhone || '') + '">') + '</div>'
      + '<div class="psi-field">' + rsniInvFItem('发票发送邮箱',
          '<input type="text" id="rsn-inv-email" maxlength="50" placeholder="请输入">') + '</div>'
      + '<div class="psi-field">' + rsniInvFItem('备注',
          '<input type="text" id="rsn-inv-remark" maxlength="100" placeholder="请输入">') + '</div>'
    + '</div>';

  var foot = document.getElementById('rsn-inv-panel-foot');
  if (foot) foot.innerHTML = '<button class="lt-btn lt-btn-primary" onclick="rsniSubmitApply()">提交开票信息</button>';

  rsniOnInvTypeChange();
}
/* 文本框字段：同配件销售 psiFItem —— lt-input-wrap plain（plain 不画 V 形箭头，文本框不能像下拉框）
   required 变体额外显示红星 */
function rsniInvFItem(label, inner, required){
  return '<div class="lt-filter-item"><div class="lt-input-wrap plain' + (required ? ' required' : '') + '">'
    + '<span class="lt-filter-prefix">' + npEscape(label) + '</span>' + inner + '</div></div>';
}
/* 下拉字段：同配件销售 psiSelect —— 非 plain（保留 V 形箭头），required 变体加红星 */
function rsniInvSelect(label, inner, required){
  return '<div class="lt-filter-item"><div class="lt-input-wrap' + (required ? ' required' : '') + '">'
    + '<span class="lt-filter-prefix">' + npEscape(label) + '</span>' + inner + '</div></div>';
}
/* 发票类型联动：001 → 展开购买方 6 项并隐藏「客户名称」；002 → 反之 */
function rsniOnInvTypeChange(){
  var box = document.getElementById('rsn-inv-buyer-box');
  var cust = document.getElementById('rsn-inv-cust-field');
  var sel = document.getElementById('rsn-inv-type');
  if (!sel) return;
  var sp = (sel.value === '001数电专用发票');
  if (box) box.style.display = sp ? 'block' : 'none';
  if (cust) cust.style.display = sp ? 'none' : 'block';
}
/* 提交开票信息：写入一张「开票中」发票记录 */
function rsniSubmitApply(){
  var g = function(id){ var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var r = rsniCurSettle(); if (!r) return;
  var amount = g('rsn-inv-amount');
  var type = g('rsn-inv-type');
  var cust = g('rsn-inv-cust');
  /* 开票金额虽不可编辑，但仍是必传字段：不能为空、不能为 0（与配件销售同口径） */
  if (!amount) { npToast('开票金额不能为空'); return; }
  if (!(parseFloat(amount) > 0)) { npToast('开票金额不能为 0'); return; }
  if (!type) { npToast('请选择发票类型'); return; }
  if (type === '002数电普通发票' && !cust) { npToast('请填写客户名称'); return; }
  if (type === '001数电专用发票'){
    var must = ['rsn-inv-buyer','rsn-inv-tax','rsn-inv-addr','rsn-inv-tel','rsn-inv-bank','rsn-inv-account'];
    var names = { 'rsn-inv-buyer':'购买方名称','rsn-inv-tax':'纳税人识别号','rsn-inv-addr':'地址',
      'rsn-inv-tel':'电话','rsn-inv-bank':'开户行','rsn-inv-account':'账号' };
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
    applyNo: rsnHash32(),
    applyTime: (r.date || '').slice(0, 16),
    /* 申请来源：直营店走 DMS，非直营走 App（示例数据两种都有） */
    source: rsnStoreType(r) === '直营店' ? 'DMS' : 'App',
    /* ★ 本页修掉的复制缺陷：老页这里写的是 rscMoney(remain)，而 remain 是 rsniRenderApplyPanel
       里的局部变量，在本函数作用域并不存在（老页提交开票信息会抛 ReferenceError）。
       开票金额本来就等于输入框里那个「剩余可开票额」（只读、上面已校验非空非 0），直接用 amount。 */
    amount: rsnMoney(amount),
    buyer: sp ? { name:g('rsn-inv-buyer'), tax:g('rsn-inv-tax'), addr:g('rsn-inv-addr'),
      tel:g('rsn-inv-tel'), bank:g('rsn-inv-bank'), account:g('rsn-inv-account') } : null,
    title: sp ? '' : cust,
    redReason: ''
  });
  /* 同步回结算单的发票状态（列表页发票状态列随之变化） */
  r.invoice = 'PROCESSING';
  var st = NP['repair-settlement-new']; if (st) st.render();
  rsniCloseApplyPanel();
  npToast('开票信息已提交');
}

/* ---------- 注册切页初始化 ---------- */
npRegisterModuleInit('repair-settlement-new', function(){ initRepairSettlementNew(); });
npRegisterModuleInit('repair-settlement-new-invoice', function(){ rsniRenderInvoicePage(); });
