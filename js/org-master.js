// =====================================================================
// 组织 / 角色 / 人员 主数据（权威唯一）
// 角色在「角色权限」菜单查看/配置；人员在「用户管理」配置；技术公告发布对象从本数据取。
// 依赖：app.js 先加载（NP['store-manage'].allData = 34 家门店主数据）。
// 门店字典不在此重复定义——直接引用门店主数据（避免 B1 双源不一致）。
// =====================================================================
(function () {
  // 角色（2026-08-31 用户指定清单：总部 4 + 门店 8，共 12）
  var ROLES = [
    { id: 'R01', name: '总部管理员', scope: '总部', desc: '总部整体运营与系统管理', status: '启用' },
    { id: 'R02', name: '总部配件业务', scope: '总部', desc: '总部配件业务管理', status: '启用' },
    { id: 'R03', name: '总部配件财务', scope: '总部', desc: '总部配件财务核算', status: '启用' },
    { id: 'R04', name: '总部技术专家', scope: '总部', desc: '疑难故障支持与方案制定', status: '启用' },
    { id: 'R05', name: '门店管理员', scope: '门店', desc: '门店系统与账号管理', status: '启用' },
    { id: 'R06', name: '门店服务顾问', scope: '门店', desc: '客户接待与工单跟进', status: '启用' },
    { id: 'R07', name: '门店服务经理', scope: '门店', desc: '门店售后业务管理', status: '启用' },
    { id: 'R08', name: '门店配件计划员', scope: '门店', desc: '配件需求计划与申领', status: '启用' },
    { id: 'R09', name: '门店备件主管', scope: '门店', desc: '备件库存与供应管理', status: '启用' },
    { id: 'R10', name: '门店仓管员', scope: '门店', desc: '配件出入库与仓位管理', status: '启用' },
    { id: 'R11', name: '门店总经理', scope: '门店', desc: '门店全面经营管理', status: '启用' },
    { id: 'R12', name: '门店财务经理', scope: '门店', desc: '门店财务与结算管理', status: '启用' }
  ];

  var HQ_ROLES = ['R01', 'R02', 'R03', 'R04'];
  var STORE_ROLES = ['R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12'];

  // 确定性姓名池（避免刷新跳变）
  var SURNAMES = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'];
  var GIVEN = ['伟', '芳', '娜', '敏', '静', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀', '英', '华', '平', '刚', '丽'];

  function storeList() {
    return (window.NP && NP['store-manage'] && NP['store-manage'].allData) || [];
  }

  function personName(gi) {
    return SURNAMES[gi % SURNAMES.length] + GIVEN[Math.floor(gi / SURNAMES.length) % GIVEN.length];
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // 人员（总部 8 人 + 34 家门店每家 8 人 = 280）
  var PERSONS = [];
  var gi = 0;

  // 总部：每个总部角色 2 人
  for (var h = 0; h < HQ_ROLES.length * 2; h++) {
    PERSONS.push({
      personId: 'HQ-' + pad2(h + 1),
      name: personName(gi++),
      roleId: HQ_ROLES[Math.floor(h / 2)],
      orgType: '总部',
      storeCode: '',
      status: '启用'
    });
  }

  // 门店：每家 8 个门店角色各 1 人
  var stores = storeList();
  for (var s = 0; s < stores.length; s++) {
    var st = stores[s];
    for (var r = 0; r < STORE_ROLES.length; r++) {
      PERSONS.push({
        personId: st.code + '-' + pad2(r + 1),
        name: personName(gi++),
        roleId: STORE_ROLES[r],
        orgType: '门店',
        storeCode: st.code,
        status: '启用'
      });
    }
  }

  function roleById(id) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i].id === id) return ROLES[i]; return null; }
  function storeByCode(code) { var a = storeList(); for (var i = 0; i < a.length; i++) if (a[i].code === code) return a[i]; return null; }
  function personById(id) { for (var i = 0; i < PERSONS.length; i++) if (PERSONS[i].personId === id) return PERSONS[i]; return null; }
  function personsByRole(roleId) { return PERSONS.filter(function (p) { return p.roleId === roleId; }); }
  function personsByStore(code) { return PERSONS.filter(function (p) { return p.storeCode === code; }); }
  function roleLabel(roleId) { var r = roleById(roleId); return r ? (r.name + '(' + r.id + ')') : (roleId || ''); }

  window.ORG_MASTER = {
    roles: ROLES,
    stores: stores,
    persons: PERSONS,
    roleById: roleById,
    storeByCode: storeByCode,
    personById: personById,
    personsByRole: personsByRole,
    personsByStore: personsByStore,
    roleLabel: roleLabel,
    personName: personName
  };
})();
