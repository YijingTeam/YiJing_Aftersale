    // 侧边栏展开/收起
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');

      // 关闭所有子菜单
      document.querySelectorAll('.submenu').forEach(sub => {
        sub.classList.remove('open');
      });
      
      // 旋转箭头
      document.querySelectorAll('.nav-arrow').forEach(arrow => {
        arrow.style.transform = sidebar.classList.contains('collapsed') 
          ? 'rotate(-90deg)' : 'rotate(0deg)';
      });
    }

    // 点击菜单项时切换子菜单
    document.querySelectorAll('.nav-item > .nav-link').forEach(link => {
      link.addEventListener('click', function(e) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('collapsed')) {
          return; // 收起状态不展开子菜单
        }
        
        const submenu = this.nextElementSibling;
        if (submenu && submenu.classList.contains('submenu')) {
          e.stopPropagation();
          submenu.classList.toggle('open');
          
          // 旋转箭头
          const arrow = this.querySelector('.nav-arrow');
          if (arrow) {
            arrow.style.transform = submenu.classList.contains('open') 
              ? 'rotate(180deg)' : 'rotate(0deg)';
          }
        }
      });
    });

    // 处理嵌套子菜单的展开/收起
    document.querySelectorAll('.submenu-item').forEach(item => {
      // 检查是否有嵌套子菜单
      if (item.nextElementSibling && item.nextElementSibling.classList.contains('submenu-nested')) {
        // 给有嵌套子菜单的项添加展开/收起功能
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          const nestedSubmenu = this.nextElementSibling;
          if (nestedSubmenu && nestedSubmenu.classList.contains('submenu-nested')) {
            nestedSubmenu.classList.toggle('open');
          }
        });
      }
    });

    // 显示内容
    function showContent(module) {
      // 隐藏所有页面
      document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));

      // 显示对应页面
      const pageId = 'page-' + module;
      const page = document.getElementById(pageId);
      if (page) {
        page.classList.add('active');
        // 动态更新面包屑
        updateTopbar(module);
        // 动态更新侧边栏高亮
        updateMenuHighlight(module);
        // 如果是维修日报，初始化图表
        if (module === 'repair-daily-report') {
          initRepairReport();
        }
        // 如果是用户线索跟踪，初始化表格
        if (module === 'lead-tracking') {
          if (!ltInitialized) {
            ltInitialized = true;
            // 默认日期：上个月的今天 ~ 今天
            var now = new Date();
            var ltStartDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            if (ltStartDate.getMonth() !== ((now.getMonth() - 1 + 12) % 12)) {
              ltStartDate = new Date(now.getFullYear(), now.getMonth(), 0);
            }
            var ltds = ltStartDate.toISOString().split('T')[0];
            var ltde = now.toISOString().split('T')[0];
            var ltStartEl = document.getElementById('lt-date-start');
            var ltEndEl = document.getElementById('lt-date-end');
            if (ltStartEl) ltStartEl.value = ltds;
            if (ltEndEl) ltEndEl.value = ltde;
            var ltTextEl = document.querySelector('#page-lead-tracking .lt-date-range-text');
            if (ltTextEl) ltTextEl.value = ltds + '-' + ltde;
          }
          renderLeadTable();
        }
        // 如果是配件库存台账，初始化
        if (module === 'parts-inventory-ledger') {
          initPin();
        }
        // 如果是维修领用明细，初始化
        if (module === 'repair-requisition-detail') {
          initRrd();
        }
        // 如果是配件销售明细，初始化
        if (module === 'parts-sales-detail') {
          initPsd();
        }
        // 如果是采购退货明细，初始化
        if (module === 'purchase-return-detail') {
          initPrd();
        }
        // 如果是内部领用明细，初始化
        if (module === 'internal-usage-detail') {
          initInt();
        }
        if (module === 'inventory-check-detail') {
          initIcd();
        }
        // 技术支持
        if (module === 'tech-support') {
          initTs();
        }
        // 总部技术支持处理
        if (module === 'tech-support-hq') {
          initThq();
        }
        // 总部质量报告处理
        if (module === 'quality-report-hq') {
          initQrhq();
        }
        // 技术支持模板
        if (module === 'quality-report-template') {
          initQrt();
        }
        // 质量报告
        if (module === 'quality-report') {
          initQr();
        }
      }
    }

    // 更新顶部栏面包屑（动态 DOM 遍历，不硬编码）
    function updateTopbar(module) {
      const bc = document.getElementById('topbar-breadcrumb');
      if (!bc) return;
      const level1 = bc.querySelector('[data-level="1"]');
      const level2 = bc.querySelector('[data-level="2"]');
      const level3 = bc.querySelector('[data-level="3"]');
      const sep3 = bc.querySelector('.bc-sep-3');

      // 重置
      level2.textContent = '—';
      level2.style.display = '';
      level3.style.display = 'none';
      sep3.style.display = 'none';

      // 根据 module 找到目标菜单项
      const target = document.querySelector('[data-module="' + module + '"]');
      if (!target) return;

      // 一级菜单文字（从 .nav-item > .nav-link > .nav-text 获取）
      const navItem = target.closest('.nav-item');
      level1.textContent = navItem.querySelector('.nav-link .nav-text').textContent.trim();

      // 判断是几级菜单
      if (target.classList.contains('submenu-item-nested')) {
        // 三级菜单：level1 > level2 > level3
        const l3Text = target.textContent.trim();
        const nested = target.closest('.submenu-nested');
        const l2El = nested.previousElementSibling; // 二级菜单项
        level2.textContent = l2El ? l2El.textContent.trim() : '—';
        level3.textContent = l3Text;
        level3.style.display = '';
        sep3.style.display = '';
      } else if (target.classList.contains('submenu-item')) {
        // 二级菜单：level1 > level2
        level2.textContent = target.textContent.trim();
      }
    }

    // 更新侧边栏高亮
    function updateMenuHighlight(module) {
      // 1. 清除所有 .current
      document.querySelectorAll('.nav-item.current').forEach(function(el) { el.classList.remove('current'); });
      document.querySelectorAll('.submenu-item.current').forEach(function(el) { el.classList.remove('current'); });
      document.querySelectorAll('.submenu-item-nested.current').forEach(function(el) { el.classList.remove('current'); });

      // 2. 找到对应 module 的菜单项
      var target = document.querySelector('[data-module="' + module + '"]');
      if (!target) return;

      // 3. 给该菜单项加 .current
      target.classList.add('current');

      // 4. 如果是三级或二级菜单，给一级菜单加 .current
      var parentNavItem = target.closest('.nav-item');
      if (parentNavItem) {
        parentNavItem.classList.add('current');
      }
    }

    // 维修营业日报初始化
    function initRepairReport() {
      var today = new Date();
      var y = today.getFullYear();
      var m = String(today.getMonth() + 1).padStart(2, '0');
      var day = String(today.getDate()).padStart(2, '0');
      var todayStr = y + '-' + m + '-' + day;
      document.getElementById('dateInput').value = todayStr;
      refresh(todayStr);
    }

    // 种子随机函数
    function seededRand(dateStr, idx) {
      var h = 0;
      for (var i = 0; i < dateStr.length; i++) h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
      h = ((h ^ idx) * 1597334677) >>> 0;
      return h / 4294967296;
    }
    function rand(dateStr, idx, min, max) {
      return Math.round(min + (max - min) * seededRand(dateStr, idx));
    }

    // 日期导航
    function changeDate(delta) {
      var input = document.getElementById('dateInput');
      var d = new Date(input.value + 'T00:00:00');
      d.setDate(d.getDate() + delta);
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var newDate = y + '-' + m + '-' + day;
      input.value = newDate;
      refresh(newDate);
    }

    // 刷新数据
    function refresh(dateStr) {
      // 更新日期显示
      var d = new Date(dateStr + 'T00:00:00');
      var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      var dateStrCn = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
      document.getElementById('dateMeta').textContent = dateStrCn + '（' + weekdays[d.getDay()] + '）截至 11:00 更新';

      // KPI数据 - 基于日期种子随机
      var carsIn = rand(dateStr, 1, 25, 45);
      var carsOut = rand(dateStr, 2, 20, 38);
      var revenue = rand(dateStr, 3, 15000, 35000);
      var waitTime = rand(dateStr, 4, 30, 90);
      var totalOrders = rand(dateStr, 5, 30, 55);
      var laborFee = rand(dateStr, 6, 5000, 12000);
      var partsFee = rand(dateStr, 7, 8000, 20000);
      var satisfaction = (rand(dateStr, 8, 45, 50) / 10).toFixed(1);
      var completeRate = Math.round(carsOut / carsIn * 100);
      var laborPct = Math.round(laborFee / revenue * 100);
      var partsPct = Math.round(partsFee / revenue * 100);
      var evalCount = rand(dateStr, 9, 8, 20);

      document.getElementById('kpi-cars-in').textContent = carsIn;
      document.getElementById('kpi-cars-in-sub').className = 'kpi-sub up';
      document.getElementById('kpi-cars-in-sub').textContent = '▲ ' + rand(dateStr, 20, 3, 10) + ' vs 昨日';

      document.getElementById('kpi-cars-out').textContent = carsOut;
      document.getElementById('kpi-cars-out-sub').className = 'kpi-sub neu';
      document.getElementById('kpi-cars-out-sub').textContent = '完工率 ' + completeRate + '%';

      document.getElementById('kpi-revenue').textContent = '¥' + revenue.toLocaleString();
      document.getElementById('kpi-revenue-sub').className = 'kpi-sub up';
      var revChange = rand(dateStr, 21, 5, 20);
      document.getElementById('kpi-revenue-sub').textContent = '▲ ' + revChange + '% vs 昨日';

      document.getElementById('kpi-wait').textContent = waitTime + ' min';
      document.getElementById('kpi-wait-sub').className = 'kpi-sub dn';
      document.getElementById('kpi-wait-sub').textContent = '▼ ' + rand(dateStr, 22, 3, 10) + 'min vs 昨日';

      document.getElementById('kpi-orders').textContent = totalOrders;
      document.getElementById('kpi-orders-sub').className = 'kpi-sub neu';
      document.getElementById('kpi-orders-sub').textContent = '含续修 ' + rand(dateStr, 23, 3, 10) + ' 单';

      document.getElementById('kpi-labor').textContent = '¥' + laborFee.toLocaleString();
      document.getElementById('kpi-labor-sub').className = 'kpi-sub up';
      document.getElementById('kpi-labor-sub').textContent = '占比 ' + laborPct + '%';

      document.getElementById('kpi-parts').textContent = '¥' + partsFee.toLocaleString();
      document.getElementById('kpi-parts-sub').className = 'kpi-sub up';
      document.getElementById('kpi-parts-sub').textContent = '占比 ' + partsPct + '%';

      document.getElementById('kpi-score').textContent = satisfaction;
      document.getElementById('kpi-score-sub').className = 'kpi-sub up';
      document.getElementById('kpi-score-sub').textContent = '今日 ' + evalCount + ' 份评价';

      // 维修项目类型百分比
      var type1 = rand(dateStr, 40, 15, 25);
      var type2 = rand(dateStr, 41, 20, 35);
      var type3 = rand(dateStr, 42, 10, 20);
      var type4 = rand(dateStr, 43, 5, 12);
      var type5 = rand(dateStr, 44, 3, 8);
      var type6 = rand(dateStr, 45, 2, 6);
      var type7 = 100 - type1 - type2 - type3 - type4 - type5 - type6;
      document.getElementById('pct1').textContent = type1;
      document.getElementById('pct2').textContent = type2;
      document.getElementById('pct3').textContent = type3;
      document.getElementById('pct4').textContent = type4;
      document.getElementById('pct5').textContent = type5;
      document.getElementById('pct6').textContent = type6;
      document.getElementById('pct7').textContent = type7;

      // 销毁旧图表
      if (window.chart1) { window.chart1.destroy(); }
      if (window.chart2) { window.chart2.destroy(); }
      if (window.chart3) { window.chart3.destroy(); }
      if (window.chart4) { window.chart4.destroy(); }

      // 趋势图
      var el1 = document.getElementById('c1');
      el1.width = el1.parentElement.offsetWidth;
      el1.height = 200;
      var hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
      var carsInArr = hours.map(function(_, i) { return rand(dateStr, 10 + i, 1, 8); });
      var carsOutArr = hours.map(function(_, i) { return rand(dateStr, 30 + i, 0, 6); });
      window.chart1 = new Chart(el1, {
        type: 'line',
        data: {
          labels: hours,
          datasets: [
            {label: '接车', data: carsInArr, borderColor: '#185FA5', backgroundColor: 'rgba(24,95,165,0.08)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2},
            {label: '交车', data: carsOutArr, borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.06)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2}
          ]
        },
        options: {
          responsive: false,
          plugins: {legend: {display: false}},
          scales: {
            x: {grid: {display: false}, ticks: {font: {size: 10}, autoSkip: false, maxRotation: 45}},
            y: {grid: {color: 'rgba(0,0,0,0.06)'}, ticks: {font: {size: 10}}, beginAtZero: true}
          }
        }
      });

      // 环形图
      var el2 = document.getElementById('c2');
      el2.width = el2.parentElement.offsetWidth;
      el2.height = 160;
      window.chart2 = new Chart(el2, {
        type: 'doughnut',
        data: {
          labels: ['钣金', '机修', '喷漆', '选装', '外包', '加装', '其他'],
          datasets: [{data: [type1, type2, type3, type4, type5, type6, type7], backgroundColor: ['#185FA5', '#1D9E75', '#BA7517', '#534AB7', '#D85A30', '#FAC775', '#85B7EB'], borderWidth: 0, hoverOffset: 4}]
        },
        options: {
          responsive: false,
          cutout: '62%',
          plugins: {legend: {display: false}, tooltip: {callbacks: {label: function(c) {return c.label + ': ' + c.parsed + '%'}}}}
        }
      });

      // 车型分布
      var el3 = document.getElementById('c3');
      el3.width = el3.parentElement.offsetWidth;
      el3.height = 200;
      var carCounts = ['车型1', '车型2', '车型3', '车型4', '车型5'].map(function(_, i) { return rand(dateStr, 60 + i, 3, 15); });
      window.chart3 = new Chart(el3, {
        type: 'bar',
        data: {
          labels: ['车型1', '车型2', '车型3', '车型4', '车型5'],
          datasets: [{data: carCounts, backgroundColor: ['#185FA5', '#378ADD', '#85B7EB', '#B5D4F4', '#E6F1FB'], borderWidth: 0, borderRadius: 3}]
        },
        options: {
          responsive: false,
          indexAxis: 'y',
          plugins: {legend: {display: false}},
          scales: {
            x: {grid: {color: 'rgba(0,0,0,0.06)'}, ticks: {font: {size: 10}}, beginAtZero: true},
            y: {grid: {display: false}, ticks: {font: {size: 10}}}
          }
        }
      });

      // 维修项目类型
      var projectTypes = ['普通维修', '定保', '保险', '保修', '专案', '召回', '服务活动', '免费保养', 'PDI'];
      var projectCounts = projectTypes.map(function(_, i) { return rand(dateStr, 70 + i, 2, 12); });
      var el4 = document.getElementById('c4');
      el4.width = el4.parentElement.offsetWidth;
      el4.height = 220;
      window.chart4 = new Chart(el4, {
        type: 'bar',
        data: {
          labels: projectTypes,
          datasets: [{data: projectCounts, backgroundColor: ['#185FA5', '#1D9E75', '#BA7517', '#534AB7', '#D85A30', '#FAC775', '#85B7EB', '#B5D4F4', '#EEEDFE'], borderWidth: 0, borderRadius: 3}]
        },
        options: {
          responsive: false,
          indexAxis: 'y',
          plugins: {legend: {display: false}},
          scales: {
            x: {grid: {color: 'rgba(0,0,0,0.06)'}, ticks: {font: {size: 9}}, beginAtZero: true},
            y: {grid: {display: false}, ticks: {font: {size: 9}}}
          }
        }
      });

      // 技师排行
      var techNames = ['张磊', '王刚', '陈明', '李华', '刘涛', '赵强', '周伟', '吴洋'];
      var techColors = [
        {bg: '#E6F1FB', color: '#185FA5'},
        {bg: '#C0DD97', color: '#173404'},
        {bg: '#EEEDFE', color: '#26215C'},
        {bg: '#FAECE7', color: '#4A1B0C'},
        {bg: '#FAEEDA', color: '#412402'},
        {bg: '#FAC775', color: '#412402'},
        {bg: '#B5D4F4', color: '#042C53'},
        {bg: '#D5E8D4', color: '#1B3D0E'}
      ];
      var techs = techNames.map(function(name, i) { return {name: name, bg: techColors[i].bg, color: techColors[i].color}; });
      var techCounts = techs.map(function(t, i) { 
        if (i === 7) return 0;
        return rand(dateStr, 50 + i, 3, 10); 
      });
      var maxTech = Math.max.apply(null, techCounts);
      var techHtml = '';
      var barColors = ['#185FA5', '#1D9E75', '#534AB7', '#D85A30', '#BA7517', '#FAC775', '#B5D4F4', '#85B7EB'];
      techs.forEach(function(t, i) {
        var pct = techCounts[i] > 0 ? Math.round(techCounts[i] / maxTech * 100) : 0;
        var barColor = barColors[i % barColors.length];
        var countText = techCounts[i] > 0 ? techCounts[i] + '单' : '请假';
        techHtml += '<div class="tech-row"><div class="av" style="background:' + t.bg + ';color:' + t.color + '">' + t.name + '</div><div class="bar-bg"><div class="bar-f" style="width:' + pct + '%;background:' + barColor + '"></div></div><div style="font-size:12px;color:#666;width:36px;text-align:right">' + countText + '</div></div>';
      });
      document.getElementById('techList').innerHTML = techHtml;

      // 工单状态
      var orderStatuses = ['接待完毕', '维修进行中', '追加', '结算进行中', '质检完毕', '维修进行中', '接待完毕', '结算进行中'];
      var orderStatusTags = ['sw', 'sr', 'sq', 'sw', 'sq', 'sr', 'sw', 'sw'];
      var orderStatusInfos = ['等待开工', '预计 12:30 完工', '追加项目中', '结算审核中', '质检中', '预计 14:00 完工', '等待开工', '结算审核中'];
      var orderTypes = ['常规保养', '故障维修', '钣金喷漆', '常规保养', '故障维修', '机修', '喷漆', '选装'];
      var orderHtml = '';
      for (var i = 0; i < 8; i++) {
        var num = 'A-' + String(1001 + i);
        orderHtml += '<div class="s-row"><div style="min-width:0;flex:1;margin-right:8px"><div style="font-size:12px;font-weight:500">工单 ' + num + ' / ' + orderTypes[i] + '</div><div style="font-size:11px;color:#666">' + techs[i % 8].name + ' · ' + orderStatusInfos[i] + '</div></div><span class="s-tag ' + orderStatusTags[i] + '">' + orderStatuses[i] + '</span></div>';
      }
      document.getElementById('orderList').innerHTML = orderHtml;
    }

    // 默认显示维修营业日报
    showContent('repair-daily-report');

    // ===== 用户线索跟踪情况 JS =====
    var ltAllData = [
      {storeCode:'DL001',storeName:'上海奕境汽车服务',dq:'华东',xq:'上海',total:320,exec:91.3,alloc:298,unalloc:22,allocRate:93.1,pending:45,following:187,timeout:12.5,defeat:38,defeatRate:11.9,reserving:92,reserveNum:89,reserveRate:28.8,done:204,doneRate:63.8,nleadDone:152,nleadDoneRate:47.5,apptReturn:78,apptReturnRate:87.6,returned:72,returnRate:22.5,recallReturnRate:32.1},
      {storeCode:'DL002',storeName:'广州奕境汽车有限公司',dq:'华南',xq:'广州',total:275,exec:88.0,alloc:242,unalloc:33,allocRate:88.0,pending:51,following:156,timeout:15.2,defeat:42,defeatRate:15.3,reserving:78,reserveNum:74,reserveRate:28.4,done:172,doneRate:62.5,nleadDone:128,nleadDoneRate:46.5,apptReturn:64,apptReturnRate:86.5,returned:58,returnRate:21.1,recallReturnRate:29.8},
      {storeCode:'DL003',storeName:'北京奕境汽车销售',dq:'华北',xq:'北京',total:410,exec:93.7,alloc:384,unalloc:26,allocRate:93.7,pending:62,following:231,timeout:9.8,defeat:51,defeatRate:12.4,reserving:118,reserveNum:115,reserveRate:28.0,done:268,doneRate:65.4,nleadDone:198,nleadDoneRate:48.3,apptReturn:102,apptReturnRate:88.7,returned:96,returnRate:23.4,recallReturnRate:35.2},
      {storeCode:'DL004',storeName:'成都奕境汽车服务',dq:'西南',xq:'成都',total:198,exec:85.4,alloc:169,unalloc:29,allocRate:85.4,pending:38,following:112,timeout:18.7,defeat:35,defeatRate:17.7,reserving:54,reserveNum:51,reserveRate:27.3,done:122,doneRate:61.6,nleadDone:89,nleadDoneRate:44.9,apptReturn:44,apptReturnRate:86.3,returned:38,returnRate:19.2,recallReturnRate:26.5},
      {storeCode:'DL005',storeName:'沈阳奕境汽车有限公司',dq:'东北',xq:'沈阳',total:156,exec:82.1,alloc:128,unalloc:28,allocRate:82.1,pending:29,following:85,timeout:21.3,defeat:28,defeatRate:17.9,reserving:43,reserveNum:40,reserveRate:27.6,done:95,doneRate:60.9,nleadDone:68,nleadDoneRate:43.6,apptReturn:34,apptReturnRate:85.0,returned:28,returnRate:17.9,recallReturnRate:23.1},
      {storeCode:'DL006',storeName:'杭州奕境汽车服务',dq:'华东',xq:'杭州',total:234,exec:89.3,alloc:209,unalloc:25,allocRate:89.3,pending:41,following:131,timeout:13.7,defeat:33,defeatRate:14.1,reserving:67,reserveNum:64,reserveRate:27.4,done:148,doneRate:63.2,nleadDone:108,nleadDoneRate:46.2,apptReturn:56,apptReturnRate:87.5,returned:50,returnRate:21.4,recallReturnRate:30.8},
      {storeCode:'DL007',storeName:'深圳奕境汽车销售',dq:'华南',xq:'深圳',total:302,exec:90.7,alloc:274,unalloc:28,allocRate:90.7,pending:55,following:174,timeout:11.2,defeat:40,defeatRate:13.2,reserving:88,reserveNum:85,reserveRate:29.1,done:189,doneRate:62.6,nleadDone:139,nleadDoneRate:46.0,apptReturn:74,apptReturnRate:87.1,returned:66,returnRate:21.9,recallReturnRate:32.4},
      {storeCode:'DL008',storeName:'武汉奕境汽车有限公司',dq:'华中',xq:'武汉',total:188,exec:86.2,alloc:162,unalloc:26,allocRate:86.2,pending:34,following:105,timeout:16.4,defeat:29,defeatRate:15.4,reserving:52,reserveNum:49,reserveRate:27.7,done:116,doneRate:61.7,nleadDone:84,nleadDoneRate:44.7,apptReturn:42,apptReturnRate:85.7,returned:36,returnRate:19.1,recallReturnRate:25.3}
    ];

    var ltTasktypeSelected = '';
    var ltStoreSelected = '';
    var ltRegionSelected = '';
    var ltDistrictSelected = '';
    var ltFilteredData = [];
    var ltCurrentPage = 1;
    var ltPageSize = 20;
    var ltInitialized = false;

    // 任务类型 combobox
    function ltShowTasktypeDropdown() {
      var list = document.getElementById('lt-tasktype-list');
      var items = list.querySelectorAll('li');
      items.forEach(function(item) { item.classList.remove('hidden', 'selected'); });
      items.forEach(function(item) { if (item.getAttribute('data-val') === ltTasktypeSelected) item.classList.add('selected'); });
      list.classList.add('show');
    }
    function ltToggleTasktypeDropdown() {
      var list = document.getElementById('lt-tasktype-list');
      if (list.classList.contains('show')) {
        list.classList.remove('show');
      } else {
        ltShowTasktypeDropdown();
        document.getElementById('lt-tasktype-text').focus();
      }
    }
    function ltFilterTasktype(val) {
      val = (val || '').trim();
      var list = document.getElementById('lt-tasktype-list');
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var txt = item.textContent;
        if (!val || txt === '请选择' || txt.indexOf(val) !== -1) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
      list.classList.add('show');
    }
    document.addEventListener('click', function(e) {
      var ttInput = document.getElementById('lt-tasktype-text');
      if (ttInput) {
        var wrap = ttInput.closest('.lt-input-wrap');
        if (wrap && !wrap.contains(e.target)) {
          document.getElementById('lt-tasktype-list').classList.remove('show');
        }
      }
      var storeInput = document.getElementById('lt-store-text');
      if (storeInput) {
        var storeWrap = storeInput.closest('.lt-input-wrap');
        if (storeWrap && !storeWrap.contains(e.target)) {
          var storeList = document.getElementById('lt-store-list');
          if (storeList) storeList.classList.remove('show');
        }
      }
    });

    // 门店 combobox
    function ltShowStoreDropdown() {
      var list = document.getElementById('lt-store-list');
      var items = list.querySelectorAll('li');
      items.forEach(function(item) { item.classList.remove('hidden', 'selected'); });
      items.forEach(function(item) { if (item.getAttribute('data-val') === ltStoreSelected) item.classList.add('selected'); });
      list.classList.add('show');
    }
    function ltToggleStoreDropdown() {
      var list = document.getElementById('lt-store-list');
      if (list.classList.contains('show')) {
        list.classList.remove('show');
      } else {
        ltShowStoreDropdown();
        document.getElementById('lt-store-text').focus();
      }
    }
    function ltFilterStore(val) {
      val = (val || '').trim();
      var list = document.getElementById('lt-store-list');
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var txt = item.textContent;
        if (!val || txt === '请选择' || txt.indexOf(val) !== -1) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
      list.classList.add('show');
    }

    // 绑定 datalist 点击（在 DOMContentLoaded 后执行）
    document.addEventListener('DOMContentLoaded', function() {
      var tasktypeList = document.getElementById('lt-tasktype-list');
      if (tasktypeList) {
        tasktypeList.addEventListener('click', function(e) {
          var li = e.target;
          if (li.tagName !== 'LI') return;
          var val = li.getAttribute('data-val');
          var txt = li.textContent;
          ltTasktypeSelected = val;
          document.getElementById('lt-tasktype-text').value = txt === '请选择' ? '' : txt;
          tasktypeList.classList.remove('show');
          renderLeadTable();
        });
      }
      var storeList = document.getElementById('lt-store-list');
      if (storeList) {
        storeList.addEventListener('click', function(e) {
          var li = e.target;
          if (li.tagName !== 'LI') return;
          var val = li.getAttribute('data-val');
          var txt = li.textContent;
          ltStoreSelected = val;
          document.getElementById('lt-store-text').value = txt === '请选择' ? '' : txt;
          storeList.classList.remove('show');
          renderLeadTable();
        });
      }
    });

    function ltFmt(n) { return n.toFixed(1) + '%'; }

    function ltGetFilteredData() {
      var taskName = document.getElementById('lt-taskname') ? document.getElementById('lt-taskname').value.trim() : '';
      return ltAllData.filter(function(r) {
        if (ltRegionSelected && ltRegionSelected !== r.dq) return false;
        if (ltDistrictSelected && ltDistrictSelected !== r.xq) return false;
        if (ltStoreSelected && ltStoreSelected !== r.storeCode) return false;
        if (ltTasktypeSelected && ltTasktypeSelected !== r.taskType) return false;
        if (taskName && r.storeName.toLowerCase().indexOf(taskName.toLowerCase()) === -1) return false;
        return true;
      });
    }

    function renderLeadTable() {
      ltFilteredData = ltGetFilteredData();
      ltCurrentPage = 1;
      ltRenderPage();
    }

    function ltRenderPage() {
      var tbody = document.getElementById('lt-tbody');
      if (!tbody) return;
      var total = ltFilteredData.length;
      var totalPages = Math.max(1, Math.ceil(total / ltPageSize));
      if (ltCurrentPage > totalPages) ltCurrentPage = totalPages;
      if (ltCurrentPage < 1) ltCurrentPage = 1;

      var start = (ltCurrentPage - 1) * ltPageSize;
      var pageData = ltFilteredData.slice(start, start + ltPageSize);

      if (!total) {
        tbody.innerHTML = '<tr><td colspan="26" style="padding:30px;color:#999;">暂无数据</td></tr>';
        ltRenderPager(0, 1);
        return;
      }

      var html = '';
      pageData.forEach(function(r, i) {
        var idx = start + i + 1;
        html += '<tr>' +
          '<td class="sticky col-seq">' + idx + '</td>' +
          '<td class="sticky col-store-code">' + r.storeCode + '</td>' +
          '<td class="sticky col-store-name" style="text-align:left">' + r.storeName + '</td>' +
          '<td class="col-region">' + r.dq + '</td>' +
          '<td class="col-district">' + r.xq + '</td>' +
          '<td class="lt-bold col-lead-total">' + r.total + '</td>' +
          '<td class="lt-green col-exec-rate">' + ltFmt(r.exec) + '</td>' +
          '<td class="col-assigned">' + r.alloc + '</td>' +
          '<td class="col-unassigned">' + r.unalloc + '</td>' +
          '<td class="col-assign-rate">' + ltFmt(r.allocRate) + '</td>' +
          '<td class="col-pending-follow">' + r.pending + '</td>' +
          '<td class="col-following">' + r.following + '</td>' +
          '<td class="col-timeout-rate ' + (r.timeout > 15 ? 'lt-red' : 'lt-green') + '">' + ltFmt(r.timeout) + '</td>' +
          '<td class="col-defeated">' + r.defeat + '</td>' +
          '<td class="col-defeat-rate ' + (r.defeatRate > 15 ? 'lt-red' : '') + '">' + ltFmt(r.defeatRate) + '</td>' +
          '<td class="col-booking">' + r.reserving + '</td>' +
          '<td class="col-booking-count">' + r.reserveNum + '</td>' +
          '<td class="col-booking-rate">' + ltFmt(r.reserveRate) + '</td>' +
          '<td class="lt-bold col-complete-count">' + r.done + '</td>' +
          '<td class="lt-green col-complete-rate">' + ltFmt(r.doneRate) + '</td>' +
          '<td class="col-non-work-complete">' + r.nleadDone + '</td>' +
          '<td class="col-non-work-rate">' + ltFmt(r.nleadDoneRate) + '</td>' +
          '<td class="col-book-return">' + r.apptReturn + '</td>' +
          '<td class="col-book-return-rate">' + ltFmt(r.apptReturnRate) + '</td>' +
          '<td class="col-return">' + r.returned + '</td>' +
          '<td class="col-return-rate">' + ltFmt(r.returnRate) + '</td>' +
          '<td class="col-solicit-return-rate">' + ltFmt(r.recallReturnRate) + '</td>' +
        '</tr>';
      });
      tbody.innerHTML = html;
      ltRenderPager(total, totalPages);
    }

    function ltRenderPager(total, totalPages) {
      var pgTotal = document.getElementById('lt-pg-total');
      var pgPrev = document.getElementById('lt-pg-prev');
      var pgNext = document.getElementById('lt-pg-next');
      var pgPages = document.getElementById('lt-pg-pages');
      if (!pgTotal) return;
      pgTotal.textContent = '共 ' + total + ' 条';
      pgPrev.disabled = ltCurrentPage <= 1;
      pgNext.disabled = ltCurrentPage >= totalPages;

      var html = '';
      if (totalPages <= 7) {
        for (var i = 1; i <= totalPages; i++) {
          html += '<button class="' + (i === ltCurrentPage ? 'active' : '') + '" onclick="ltGoPage(' + i + ')">' + i + '</button>';
        }
      } else {
        if (ltCurrentPage <= 4) {
          for (var i = 1; i <= 6; i++) {
            html += '<button class="' + (i === ltCurrentPage ? 'active' : '') + '" onclick="ltGoPage(' + i + ')">' + i + '</button>';
          }
          html += '<span class="pager-ellipsis">...</span>';
          html += '<button onclick="ltGoPage(' + totalPages + ')">' + totalPages + '</button>';
        } else if (ltCurrentPage >= totalPages - 3) {
          html += '<button onclick="ltGoPage(1)">1</button>';
          html += '<span class="pager-ellipsis">...</span>';
          for (var i = totalPages - 5; i <= totalPages; i++) {
            html += '<button class="' + (i === ltCurrentPage ? 'active' : '') + '" onclick="ltGoPage(' + i + ')">' + i + '</button>';
          }
        } else {
          html += '<button onclick="ltGoPage(1)">1</button>';
          html += '<span class="pager-ellipsis">...</span>';
          for (var i = ltCurrentPage - 2; i <= ltCurrentPage + 2; i++) {
            html += '<button class="' + (i === ltCurrentPage ? 'active' : '') + '" onclick="ltGoPage(' + i + ')">' + i + '</button>';
          }
          html += '<span class="pager-ellipsis">...</span>';
          html += '<button onclick="ltGoPage(' + totalPages + ')">' + totalPages + '</button>';
        }
      }
      pgPages.innerHTML = html;
    }

    function ltGoPage(p) { ltCurrentPage = p; ltRenderPage(); }
    function ltChangePage(delta) { ltCurrentPage += delta; ltRenderPage(); }
    function ltGotoPage(val) {
      var p = parseInt(val, 10);
      if (!isNaN(p) && p > 0) { ltCurrentPage = p; ltRenderPage(); }
    }
    function ltChangePageSize(val) {
      ltPageSize = parseInt(val, 10);
      ltCurrentPage = 1;
      ltRenderPage();
    }

    function ltResetFilter() {
      ltRegionSelected = '';
      if (document.getElementById('lt-region-text')) document.getElementById('lt-region-text').value = '';
      ltDistrictSelected = '';
      if (document.getElementById('lt-district-text')) document.getElementById('lt-district-text').value = '';
      ltStoreSelected = '';
      if (document.getElementById('lt-store-text')) document.getElementById('lt-store-text').value = '';
      ltTasktypeSelected = '';
      if (document.getElementById('lt-tasktype-text')) document.getElementById('lt-tasktype-text').value = '';
      if (document.getElementById('lt-taskname')) document.getElementById('lt-taskname').value = '';
      ltCurrentPage = 1;
      renderLeadTable();
    }

    // 报表说明弹框
    function ltOpenDescModal() {
      document.getElementById('lt-descModal').classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function ltCloseDescModal() {
      document.getElementById('lt-descModal').classList.remove('show');
      document.body.style.overflow = '';
    }
    function ltCloseDescOnBg(e) {
      if (e.target === e.currentTarget) ltCloseDescModal();
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') ltCloseDescModal();
    });

    // ========== 筛选器展开/收起通用逻辑 ==========
    // showCount: 默认显示的筛选器数量（索引 0 ~ showCount-1 显示，showCount 及以后隐藏）
    // ⚠ 修改默认显示数量时，只需改调用处的 showCount 参数，init 和 toggle 两处需保持一致
    function initFilterGrid(gridId, showCount) {
      var grid = document.getElementById(gridId);
      if (!grid) return;
      var items = grid.querySelectorAll('.lt-filter-item');
      for (var i = showCount; i < items.length; i++) { if (items[i]) items[i].style.display = 'none'; }
      // 查询项 ≤ 默认显示数，不需要"展开/收起"，隐藏它
      var toggleEl = grid.querySelector('.lt-filter-toggle,.lt-filter-more-toggle');
      if (toggleEl) toggleEl.style.display = items.length > showCount ? '' : 'none';
    }
    function toggleFilterGrid(gridId, isExpanded, showCount, toggleSelector) {
      var grid = document.getElementById(gridId);
      if (!grid) return;
      var items = grid.querySelectorAll('.lt-filter-item');
      var needToggle = items.length > showCount;
      if (needToggle) {
        for (var i = showCount; i < items.length; i++) { if (items[i]) items[i].style.display = isExpanded ? '' : 'none'; }
      }
      var toggleEl = grid.querySelector(toggleSelector || '.lt-filter-toggle,.lt-filter-more-toggle');
      if (toggleEl) {
        if (needToggle) {
          toggleEl.style.display = '';
          toggleEl.innerHTML = isExpanded ? '︿ 收起' : '﹀ 展开';
        } else {
          toggleEl.style.display = 'none';
        }
      }
    }
    // ========= 各模块筛选器默认显示数量 =========
    // ⚠ 修改此处即可统一控制所有模块的默认显示数量
    var TS_SHOW_COUNT  = 7; // 技术支持
    var PIN_SHOW_COUNT = 7; // 维修领用明细
    var RRD_SHOW_COUNT = 7; // 配件销售明细
    var PSD_SHOW_COUNT  = 7; // 采购建议单
    var PRD_SHOW_COUNT = 7; // 采购入库单
    var INT_SHOW_COUNT = 7; // 库存初始化
    var ICD_SHOW_COUNT = 7; // 盘点差异
    var THQ_SHOW_COUNT = 7; // 总部技术支持
    // ===== 日期范围选择器 =====
    function toggleDateRangePicker(textInput) {
      var drop = textInput.parentElement.querySelector('.lt-date-range-drop');
      if (!drop) return;
      var isOpen = drop.classList.contains('open');
      document.querySelectorAll('.lt-date-range-drop.open').forEach(function(d) {
        if (d !== drop) d.classList.remove('open');
      });
      drop.classList.toggle('open', !isOpen);
    }

    function updateDateRangeDisplay(dateInput) {
      var drop = dateInput.closest('.lt-date-range-drop');
      var textInput = drop.parentElement.querySelector('.lt-date-range-text');
      var dates = drop.querySelectorAll('input[type=date]');
      if (textInput && dates.length === 2) {
        var s = dates[0].value || '';
        var e = dates[1].value || '';
        // 缩短日期格式：2026-05-02 → 26-5-2（溢出时从左边/年开始截断）
        if (s) s = s.replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/, function(m,y,mo,d){ return y.slice(2)+'-'+Number(mo)+'-'+Number(d); });
        if (e) e = e.replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/, function(m,y,mo,d){ return y.slice(2)+'-'+Number(mo)+'-'+Number(d); });
        textInput.value = s + '-' + e;
      }
      var cbName = textInput.getAttribute('data-callback');
      if (cbName && typeof window[cbName] === 'function') {
        window[cbName]();
      }
    }

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.lt-date-range')) {
        document.querySelectorAll('.lt-date-range-drop.open').forEach(function(d) { d.classList.remove('open'); });
      }
    });

    // 大区 combobox
    function ltFilterRegion(val) {
      val = (val || '').trim();
      var list = document.getElementById('lt-region-list');
      if (!list) return;
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var txt = item.textContent;
        if (!val || txt === '请选择' || txt.indexOf(val) !== -1) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
      list.classList.add('show');
    }
    function ltShowRegionDropdown() {
      var list = document.getElementById('lt-region-list');
      if (!list) return;
      var items = list.querySelectorAll('li');
      items.forEach(function(item) { item.classList.remove('hidden', 'selected'); });
      items.forEach(function(item) { if (item.getAttribute('data-val') === ltRegionSelected) item.classList.add('selected'); });
      list.classList.add('show');
    }
    function ltToggleRegionDropdown() {
      var list = document.getElementById('lt-region-list');
      if (!list) return;
      if (list.classList.contains('show')) {
        list.classList.remove('show');
      } else {
        ltShowRegionDropdown();
        var inp = document.getElementById('lt-region-text');
        if (inp) inp.focus();
      }
    }
    function ltSelectRegion(li) {
      var val = li.getAttribute('data-val') || '';
      ltRegionSelected = val;
      document.getElementById('lt-region-text').value = val ? li.textContent : '';
      var list = document.getElementById('lt-region-list');
      if (list) list.classList.remove('show');
      renderLeadTable();
    }

    // 小区 combobox
    function ltFilterDistrict(val) {
      val = (val || '').trim();
      var list = document.getElementById('lt-district-list');
      if (!list) return;
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var txt = item.textContent;
        if (!val || txt === '请选择' || txt.indexOf(val) !== -1) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
      list.classList.add('show');
    }
    function ltShowDistrictDropdown() {
      var list = document.getElementById('lt-district-list');
      if (!list) return;
      var items = list.querySelectorAll('li');
      items.forEach(function(item) { item.classList.remove('hidden', 'selected'); });
      items.forEach(function(item) { if (item.getAttribute('data-val') === ltDistrictSelected) item.classList.add('selected'); });
      list.classList.add('show');
    }
    function ltToggleDistrictDropdown() {
      var list = document.getElementById('lt-district-list');
      if (!list) return;
      if (list.classList.contains('show')) {
        list.classList.remove('show');
      } else {
        ltShowDistrictDropdown();
        var inp = document.getElementById('lt-district-text');
        if (inp) inp.focus();
      }
    }
    function ltSelectDistrict(li) {
      var val = li.getAttribute('data-val') || '';
      ltDistrictSelected = val;
      document.getElementById('lt-district-text').value = val ? li.textContent : '';
      var list = document.getElementById('lt-district-list');
      if (list) list.classList.remove('show');
      renderLeadTable();
    }

    // 点击外部关闭大区/小区下拉
    document.addEventListener('click', function(e) {
      var regionInput = document.getElementById('lt-region-text');
      if (regionInput) {
        var wrap = regionInput.closest('.lt-input-wrap');
        if (wrap && !wrap.contains(e.target)) {
          var rl = document.getElementById('lt-region-list');
          if (rl) rl.classList.remove('show');
        }
      }
      var districtInput = document.getElementById('lt-district-text');
      if (districtInput) {
        var wrap2 = districtInput.closest('.lt-input-wrap');
        if (wrap2 && !wrap2.contains(e.target)) {
          var dl = document.getElementById('lt-district-list');
          if (dl) dl.classList.remove('show');
        }
      }
    });

    // ===== 配件库存台账(新) JS =====
    var pinAllData = [
      {id:1, code:'P001001', name:'机油滤清器', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'消耗件', storeName:'北京朝阳店', storeCode:'BJ001', price:35.00, stock:120, inCount:200, outCount:80, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:2, code:'P001002', name:'空气滤清器', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'消耗件', storeName:'北京朝阳店', storeCode:'BJ001', price:45.00, stock:85, inCount:150, outCount:65, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:3, code:'P001003', name:'刹车片', unit:'副', series:'奕境S', model:'奕境S 2024款', category:'易损件', storeName:'上海浦东店', storeCode:'SH001', price:128.00, stock:60, inCount:100, outCount:40, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:4, code:'P001004', name:'火花塞', unit:'支', series:'奕境S', model:'奕境S 2024款', category:'易损件', storeName:'上海浦东店', storeCode:'SH001', price:25.00, stock:200, inCount:300, outCount:100, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:5, code:'P001005', name:'雨刮器', unit:'副', series:'奕境S', model:'奕境S 2024款', category:'易损件', storeName:'广州天河店', storeCode:'GZ001', price:68.00, stock:45, inCount:80, outCount:35, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:6, code:'P001006', name:'机油', unit:'升', series:'奕境S', model:'奕境S 2024款', category:'保养件', storeName:'广州天河店', storeCode:'GZ001', price:85.00, stock:300, inCount:500, outCount:200, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:7, code:'P001007', name:'变速箱油', unit:'升', series:'奕境S', model:'奕境S 2024款', category:'保养件', storeName:'北京朝阳店', storeCode:'BJ001', price:120.00, stock:50, inCount:80, outCount:30, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:8, code:'P001008', name:'减震器', unit:'支', series:'奕境S', model:'奕境S 2024款', category:'维修件', storeName:'上海浦东店', storeCode:'SH001', price:280.00, stock:30, inCount:50, outCount:20, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:9, code:'P001009', name:'轮胎', unit:'条', series:'奕境S', model:'奕境S 2024款', category:'易损件', storeName:'广州天河店', storeCode:'GZ001', price:450.00, stock:40, inCount:60, outCount:20, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:10, code:'P001010', name:'电瓶', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'维修件', storeName:'北京朝阳店', storeCode:'BJ001', price:580.00, stock:25, inCount:40, outCount:15, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:11, code:'P001011', name:'空调滤芯', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'消耗件', storeName:'上海浦东店', storeCode:'SH001', price:55.00, stock:90, inCount:120, outCount:30, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:12, code:'P001012', name:'刹车盘', unit:'片', series:'奕境S', model:'奕境S 2024款', category:'易损件', storeName:'广州天河店', storeCode:'GZ001', price:180.00, stock:35, inCount:50, outCount:15, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:13, code:'P001013', name:'转向助力油', unit:'升', series:'奕境S', model:'奕境S 2024款', category:'保养件', storeName:'北京朝阳店', storeCode:'BJ001', price:65.00, stock:70, inCount:100, outCount:30, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:14, code:'P001014', name:'离合器片', unit:'片', series:'奕境S', model:'奕境S 2024款', category:'维修件', storeName:'上海浦东店', storeCode:'SH001', price:320.00, stock:20, inCount:30, outCount:10, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:15, code:'P001015', name:'防冻液', unit:'升', series:'奕境S', model:'奕境S 2024款', category:'保养件', storeName:'广州天河店', storeCode:'GZ001', price:48.00, stock:150, inCount:200, outCount:50, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:16, code:'P001016', name:'传动皮带', unit:'条', series:'奕境S', model:'奕境S 2024款', category:'维修件', storeName:'北京朝阳店', storeCode:'BJ001', price:95.00, stock:40, inCount:60, outCount:20, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:17, code:'P001017', name:'燃油滤清器', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'消耗件', storeName:'上海浦东店', storeCode:'SH001', price:38.00, stock:110, inCount:150, outCount:40, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:18, code:'P001018', name:'氧传感器', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'维修件', storeName:'广州天河店', storeCode:'GZ001', price:220.00, stock:15, inCount:25, outCount:10, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:19, code:'P001019', name:'正时皮带', unit:'条', series:'奕境S', model:'奕境S 2024款', category:'维修件', storeName:'北京朝阳店', storeCode:'BJ001', price:180.00, stock:22, inCount:35, outCount:13, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:20, code:'P001020', name:'玻璃水', unit:'瓶', series:'奕境S', model:'奕境S 2024款', category:'通用件', storeName:'上海浦东店', storeCode:'SH001', price:15.00, stock:500, inCount:800, outCount:300, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:21, code:'P001021', name:'灯泡', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'通用件', storeName:'广州天河店', storeCode:'GZ001', price:28.00, stock:200, inCount:300, outCount:100, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:22, code:'P001022', name:'刹车油', unit:'升', series:'奕境S', model:'奕境S 2024款', category:'保养件', storeName:'北京朝阳店', storeCode:'BJ001', price:75.00, stock:60, inCount:90, outCount:30, warehouse:'中心仓', region:'华北区', district:'北京区'},
      {id:23, code:'P001023', name:'轮毂轴承', unit:'个', series:'奕境S', model:'奕境S 2024款', category:'维修件', storeName:'上海浦东店', storeCode:'SH001', price:150.00, stock:18, inCount:25, outCount:7, warehouse:'上海仓', region:'华东区', district:'上海区'},
      {id:24, code:'P001024', name:'密封垫', unit:'片', series:'奕境S', model:'奕境S 2024款', category:'通用件', storeName:'广州天河店', storeCode:'GZ001', price:12.00, stock:300, inCount:500, outCount:200, warehouse:'广州仓', region:'华南区', district:'广州区'},
      {id:25, code:'P001025', name:'冷却液', unit:'升', series:'奕境S', model:'奕境S 2024款', category:'保养件', storeName:'北京朝阳店', storeCode:'BJ001', price:55.00, stock:80, inCount:120, outCount:40, warehouse:'中心仓', region:'华北区', district:'北京区'}
    ];
    var pinFilteredData = [];
    var pinCurrentPage = 1;
    var pinPageSize = 20;
    var pinFilterExpanded = false;
    var pinInitialized = false;

    function pinRenderTable() {
      var start = (pinCurrentPage - 1) * pinPageSize;
      var pageData = pinFilteredData.slice(start, start + pinPageSize);
      var tbody = document.getElementById('pin-tbody');
      tbody.innerHTML = pageData.map(function(row) {
        return '<tr>' +
          '<td class="sticky col-seq">' + row.id + '</td>' +
          '<td class="sticky col-code">' + row.code + '</td>' +
          '<td class="sticky col-name">' + row.name + '</td>' +
          '<td class="col-unit">' + row.unit + '</td>' +
          '<td class="col-series">' + row.series + '</td>' +
          '<td class="col-model">' + row.model + '</td>' +
          '<td class="col-category">' + row.category + '</td>' +
          '<td class="col-store-name">' + row.storeName + '</td>' +
          '<td class="col-store-code">' + row.storeCode + '</td>' +
          '<td class="col-price">' + row.price.toFixed(2) + '</td>' +
          '<td class="col-stock">' + row.stock + '</td>' +
          '<td class="col-in-count">' + row.inCount + '</td>' +
          '<td class="col-out-count">' + row.outCount + '</td>' +
          '</tr>';
      }).join('');
      var total = pinFilteredData.length;
      document.getElementById('pin-pg-total').textContent = '共 ' + total + ' 条';
      pinRenderPages();
    }

    function pinRenderPages() {
      var totalPages = Math.ceil(pinFilteredData.length / pinPageSize) || 1;
      var pages = document.getElementById('pin-pg-pages');
      var html = '';
      for (var i = 1; i <= totalPages; i++) {
        html += i === pinCurrentPage
          ? '<button class="active" onclick="pinGoPage(' + i + ')">' + i + '</button>'
          : '<button onclick="pinGoPage(' + i + ')">' + i + '</button>';
      }
      pages.innerHTML = html;
      document.getElementById('pin-pg-prev').disabled = pinCurrentPage === 1;
      document.getElementById('pin-pg-next').disabled = pinCurrentPage >= totalPages;
    }

    function pinGoPage(p) { pinCurrentPage = p; pinRenderTable(); }
    function pinChangePage(delta) { pinGoPage(Math.max(1, Math.min(pinCurrentPage + delta, Math.ceil(pinFilteredData.length / pinPageSize) || 1))); }
    function pinChangePageSize(size) { pinPageSize = parseInt(size); pinCurrentPage = 1; pinRenderTable(); }
    function pinGotoPage(v) { var p = parseInt(v); if (p) pinGoPage(p); }

    function pinApplyFilter() {
      var code = document.getElementById('pin-flt-code').value.trim().toLowerCase();
      var name = document.getElementById('pin-flt-name').value.trim().toLowerCase();
      var category = document.getElementById('pin-flt-category').value;
      var dateStart = document.getElementById('pin-flt-date-start').value;
      var dateEnd = document.getElementById('pin-flt-date-end').value;
      var series = document.getElementById('pin-flt-series').value.trim().toLowerCase();
      var model = document.getElementById('pin-flt-model').value.trim().toLowerCase();
      var warehouse = document.getElementById('pin-flt-warehouse').value;
      var record = document.getElementById('pin-flt-record').value;
      var region = document.getElementById('pin-flt-region').value.trim().toLowerCase();
      var district = document.getElementById('pin-flt-district').value.trim().toLowerCase();
      var store = document.getElementById('pin-flt-store').value.trim().toLowerCase();

      pinFilteredData = pinAllData.filter(function(row) {
        if (code && !row.code.toLowerCase().includes(code)) return false;
        if (name && !row.name.toLowerCase().includes(name)) return false;
        if (category && row.category !== category) return false;
        if (series && !row.series.toLowerCase().includes(series)) return false;
        if (model && !row.model.toLowerCase().includes(model)) return false;
        if (warehouse && row.warehouse !== warehouse) return false;
        if (record && row.record !== record) return false;
        if (region && !row.region.toLowerCase().includes(region)) return false;
        if (district && !row.district.toLowerCase().includes(district)) return false;
        if (store && !row.storeName.toLowerCase().includes(store)) return false;
        return true;
      });
      pinCurrentPage = 1;
      pinRenderTable();
    }

    function pinResetFilter() {
      document.getElementById('pin-flt-code').value = '';
      document.getElementById('pin-flt-name').value = '';
      document.getElementById('pin-flt-category').value = '';
      document.getElementById('pin-flt-date-start').value = '';
      document.getElementById('pin-flt-date-end').value = '';
      document.getElementById('pin-flt-series').value = '';
      document.getElementById('pin-flt-model').value = '';
      document.getElementById('pin-flt-warehouse').value = '';
      document.getElementById('pin-flt-record').value = '';
      document.getElementById('pin-flt-region').value = '';
      document.getElementById('pin-flt-district').value = '';
      document.getElementById('pin-flt-store').value = '';
      var textEl = document.querySelector('#page-parts-inventory-ledger .lt-date-range-text');
      if (textEl) textEl.value = '';
      pinFilteredData = [...pinAllData];
      pinCurrentPage = 1;
      pinRenderTable();
    }

    function pinExportData() { alert('导出功能 - 将导出当前查询结果的 ' + pinFilteredData.length + ' 条数据'); }

    function pinToggleFilter() { pinFilterExpanded = !pinFilterExpanded; toggleFilterGrid('pin-filterGrid', pinFilterExpanded, PIN_SHOW_COUNT); }

    // Combobox 通用辅助函数
    function pinFilterCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      var val = input.value.toLowerCase();
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var match = item.textContent.toLowerCase().includes(val);
        item.classList.toggle('hidden', !match);
      });
    }
    function pinShowCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (list) list.classList.add('show');
    }
    function pinToggleCombobox(arrow) {
      var wrap = arrow.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      list.classList.toggle('show');
      if (list.classList.contains('show')) {
        var input = wrap.querySelector('input');
        if (input) input.focus();
      }
    }
    function pinSelectCombobox(li) {
      var wrap = li.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var input = wrap.querySelector('input');
      var list = wrap.querySelector('.lt-datalist');
      if (input) input.value = li.textContent;
      if (list) list.classList.remove('show');
      pinApplyFilter();
    }
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.lt-input-wrap.combobox')) {
        document.querySelectorAll('#page-parts-inventory-ledger .lt-datalist.show').forEach(function(l) { l.classList.remove('show'); });
      }
    });

    // 初始化函数
    function initPin() {
      if (!pinInitialized) {
        pinInitialized = true;
        var now = new Date();
        var startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (startDate.getMonth() !== ((now.getMonth() - 1 + 12) % 12)) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        var ds = startDate.toISOString().split('T')[0];
        var de = now.toISOString().split('T')[0];
        var startEl = document.getElementById('pin-flt-date-start');
        var endEl = document.getElementById('pin-flt-date-end');
        if (startEl) startEl.value = ds;
        if (endEl) endEl.value = de;
        var textEl = document.querySelector('#page-parts-inventory-ledger .lt-date-range-text');
        if (textEl) textEl.value = ds + '-' + de;
      }
      pinFilteredData = [...pinAllData];
      pinRenderTable();
      initFilterGrid('pin-filterGrid', PIN_SHOW_COUNT);
    }

    // ===== 维修领用明细 JS =====
    var rrdAllData = [];
    var rrdFilteredData = [];
    var rrdCurrentPage = 1;
    var rrdPageSize = 20;
    var rrdFilterExpanded = false;
    var rrdInitialized = false;

    // 生成示例数据
    (function() {
      var partCodes = ['P10001','P10002','P10003','P10004','P10005','P10006','P10007','P10008','P10009','P10010'];
      var partNames = ['前刹车片','机油滤清器','空气滤芯','后刹车盘','火花塞','空调滤芯','前雨刮片','蓄电池','转向助力油','变速箱油'];
      var ioTypes = ['维修出库','维修退料入库'];
      var orderNos = ['WX20250401001','WX20250401002','WX20250402001','WX20250402002','WX20250403001','WX20250403002','WX20250404001','WX20250404002','WX20250405001','WX20250405002'];
      var advisors = ['张顾问','李顾问','王顾问','赵顾问'];
      var custCodes = ['C1001','C1002','C1003','C1004','C1005'];
      var owners = ['刘先生','陈女士','周先生','吴女士','郑先生'];
      var plates = ['京A12345','京B67890','沪C11111','粤D22222','浙E33333'];
      var vins = ['LSVAU2180N2012345','LSVAU2180N2023456','LSVAU2180N2034567','LSVAU2180N2045678','LSVAU2180N2056789'];
      var repairTypes = ['普通维修','定保','保险','保修','免费保养','PDI'];
      var repairCats = ['钣金','机修','喷漆','选装','外包','加装','其他'];
      var payTypes = ['客户','索赔（免保）','索赔（保修）','保险','内部','协议'];
      var pickers = ['张师傅','李师傅','王师傅','赵师傅'];
      var warehouses = ['主仓库','辅料仓','油漆仓'];
      var positions = ['A-01-01','A-01-02','B-02-01','B-02-02','C-03-01'];
      var stores = [
        {code:'BJ001',name:'北京朝阳店'},{code:'SH001',name:'上海浦东店'},
        {code:'GZ001',name:'广州天河店'},{code:'WH001',name:'武汉洪山店'},
        {code:'SZ001',name:'深圳南山店'},{code:'HZ001',name:'杭州西湖店'}
      ];

      for (var i = 0; i < 25; i++) {
        var idx = i % 10;
        var ioType = ioTypes[i % 2];
        var qty = ioType === '维修出库' ? (1 + Math.floor(Math.random() * 5)) : -(1 + Math.floor(Math.random() * 2));
        var unitPrice = (50 + Math.random() * 500).toFixed(2);
        var amount = (Math.abs(qty) * parseFloat(unitPrice)).toFixed(2);
        var costPrice = (parseFloat(unitPrice) * (0.6 + Math.random() * 0.3)).toFixed(2);
        var costTotal = (Math.abs(qty) * parseFloat(costPrice)).toFixed(2);
        var month = (4 + Math.floor(i / 10));
        var day = (1 + (i * 3) % 28);
        var ioTime = '2026-0' + month + '-' + (day < 10 ? '0' + day : day) + ' ' + (8 + i % 10) + ':' + (10 + i * 3 % 50) + ':00';
        var settleTime = i % 3 === 0 ? '' : '2026-0' + month + '-' + (day < 10 ? '0' + day : day) + ' 16:30:00';
        rrdAllData.push({
          id: i + 1,
          code: partCodes[idx],
          name: partNames[idx],
          orderNo: orderNos[i % 10],
          storeName: stores[i % 6].name,
          storeCode: stores[i % 6].code,
          advisor: advisors[i % 4],
          custCode: custCodes[i % 5],
          owner: owners[i % 5],
          plate: plates[i % 5],
          vin: vins[i % 5],
          ioNo: 'IO' + (2026040100 + i),
          ioType: ioType,
          ioQty: qty,
          unitPrice: unitPrice,
          amount: amount,
          costPrice: costPrice,
          costTotal: costTotal,
          ioTime: ioTime,
          repairType: repairTypes[i % 6],
          repairCat: repairCats[i % 7],
          payType: payTypes[i % 6],
          settleTime: settleTime,
          picker: pickers[i % 4],
          warehouse: warehouses[i % 3],
          position: positions[i % 5],
          remark: i % 3 === 0 ? '加急' : ''
        });
      }
    })();

    function rrdRenderTable() {
      var start = (rrdCurrentPage - 1) * rrdPageSize;
      var pageData = rrdFilteredData.slice(start, start + rrdPageSize);
      var tbody = document.getElementById('rrd-tbody');
      tbody.innerHTML = pageData.map(function(row) {
        var qtyClass = row.ioQty < 0 ? 'lt-green' : '';
        return '<tr>' +
          '<td class="sticky col-seq">' + row.id + '</td>' +
          '<td class="sticky col-order-no">' + row.orderNo + '</td>' +
          '<td class="col-store-name">' + row.storeName + '</td>' +
          '<td class="col-store-code">' + row.storeCode + '</td>' +
          '<td class="col-advisor">' + row.advisor + '</td>' +
          '<td class="col-cust-code">' + row.custCode + '</td>' +
          '<td class="col-owner">' + row.owner + '</td>' +
          '<td class="col-plate">' + row.plate + '</td>' +
          '<td class="col-vin">' + row.vin + '</td>' +
          '<td class="col-io-no">' + row.ioNo + '</td>' +
          '<td class="col-io-type">' + row.ioType + '</td>' +
          '<td class="col-code">' + row.code + '</td>' +
          '<td class="col-name">' + row.name + '</td>' +
          '<td class="col-io-qty ' + qtyClass + '">' + row.ioQty + '</td>' +
          '<td class="col-unit-price">' + row.unitPrice + '</td>' +
          '<td class="col-amount">' + row.amount + '</td>' +
          '<td class="col-cost-price">' + row.costPrice + '</td>' +
          '<td class="col-cost-total">' + row.costTotal + '</td>' +
          '<td class="col-io-time">' + row.ioTime + '</td>' +
          '<td class="col-repair-type">' + row.repairType + '</td>' +
          '<td class="col-repair-cat">' + row.repairCat + '</td>' +
          '<td class="col-pay-type">' + row.payType + '</td>' +
          '<td class="col-settle-time">' + row.settleTime + '</td>' +
          '<td class="col-picker">' + row.picker + '</td>' +
          '<td class="col-warehouse">' + row.warehouse + '</td>' +
          '<td class="col-position">' + row.position + '</td>' +
          '<td class="col-remark">' + row.remark + '</td>' +
          '</tr>';
      }).join('');
      var total = rrdFilteredData.length;
      document.getElementById('rrd-pg-total').textContent = '共 ' + total + ' 条';
      rrdRenderPages();
    }

    function rrdRenderPages() {
      var totalPages = Math.ceil(rrdFilteredData.length / rrdPageSize) || 1;
      var pages = document.getElementById('rrd-pg-pages');
      var html = '';
      if (totalPages <= 7) {
        for (var i = 1; i <= totalPages; i++) {
          html += i === rrdCurrentPage
            ? '<button class="active" onclick="rrdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="rrdGoPage(' + i + ')">' + i + '</button>';
        }
      } else if (rrdCurrentPage <= 4) {
        for (var i = 1; i <= 6; i++) {
          html += i === rrdCurrentPage
            ? '<button class="active" onclick="rrdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="rrdGoPage(' + i + ')">' + i + '</button>';
        }
        html += '<span style="padding:0 4px">…</span><button onclick="rrdGoPage(' + totalPages + ')">' + totalPages + '</button>';
      } else if (rrdCurrentPage >= totalPages - 3) {
        html += '<button onclick="rrdGoPage(1)">1</button><span style="padding:0 4px">…</span>';
        for (var i = totalPages - 5; i <= totalPages; i++) {
          html += i === rrdCurrentPage
            ? '<button class="active" onclick="rrdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="rrdGoPage(' + i + ')">' + i + '</button>';
        }
      } else {
        html += '<button onclick="rrdGoPage(1)">1</button><span style="padding:0 4px">…</span>';
        for (var i = rrdCurrentPage - 2; i <= rrdCurrentPage + 2; i++) {
          html += i === rrdCurrentPage
            ? '<button class="active" onclick="rrdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="rrdGoPage(' + i + ')">' + i + '</button>';
        }
        html += '<span style="padding:0 4px">…</span><button onclick="rrdGoPage(' + totalPages + ')">' + totalPages + '</button>';
      }
      pages.innerHTML = html;
      document.getElementById('rrd-pg-prev').disabled = rrdCurrentPage === 1;
      document.getElementById('rrd-pg-next').disabled = rrdCurrentPage >= totalPages;
    }

    function rrdGoPage(p) { rrdCurrentPage = p; rrdRenderTable(); }
    function rrdChangePage(delta) { rrdGoPage(Math.max(1, Math.min(rrdCurrentPage + delta, Math.ceil(rrdFilteredData.length / rrdPageSize) || 1))); }
    function rrdChangePageSize(size) { rrdPageSize = parseInt(size); rrdCurrentPage = 1; rrdRenderTable(); }
    function rrdGotoPage(v) { var p = parseInt(v); if (p) rrdGoPage(p); }

    function rrdApplyFilter() {
      var partCode = (document.getElementById('rrd-flt-part-code').value || '').toLowerCase();
      var partName = (document.getElementById('rrd-flt-part-name').value || '').toLowerCase();
      var ioType = document.getElementById('rrd-flt-io-type').value || '';
      var orderNo = (document.getElementById('rrd-flt-order-no').value || '').toLowerCase();
      var repairType = (document.getElementById('rrd-flt-repair-type').value || '').toLowerCase();
      var repairCat = (document.getElementById('rrd-flt-repair-cat').value || '').toLowerCase();
      var payType = (document.getElementById('rrd-flt-pay-type').value || '').toLowerCase();
      var custCode = (document.getElementById('rrd-flt-cust-code').value || '').toLowerCase();
      var owner = (document.getElementById('rrd-flt-owner').value || '').toLowerCase();
      var plate = (document.getElementById('rrd-flt-plate').value || '').toLowerCase();
      var vin = (document.getElementById('rrd-flt-vin').value || '').toLowerCase();
      var advisor = (document.getElementById('rrd-flt-advisor').value || '').toLowerCase();
      var series = (document.getElementById('rrd-flt-series').value || '').toLowerCase();
      var picker = (document.getElementById('rrd-flt-picker').value || '').toLowerCase();
      var ioNo = (document.getElementById('rrd-flt-io-no').value || '').toLowerCase();
      var settleStatus = document.getElementById('rrd-flt-settle-status').value || '';

      rrdFilteredData = rrdAllData.filter(function(row) {
        if (partCode && row.code.toLowerCase().indexOf(partCode) < 0) return false;
        if (partName && row.name.toLowerCase().indexOf(partName) < 0) return false;
        if (ioType && row.ioType !== ioType) return false;
        if (orderNo && row.orderNo.toLowerCase().indexOf(orderNo) < 0) return false;
        if (repairType && row.repairType.toLowerCase().indexOf(repairType) < 0) return false;
        if (repairCat && row.repairCat.toLowerCase().indexOf(repairCat) < 0) return false;
        if (payType && row.payType.toLowerCase().indexOf(payType) < 0) return false;
        if (custCode && row.custCode.toLowerCase().indexOf(custCode) < 0) return false;
        if (owner && row.owner.toLowerCase().indexOf(owner) < 0) return false;
        if (plate && row.plate.toLowerCase().indexOf(plate) < 0) return false;
        if (vin && row.vin.toLowerCase().indexOf(vin) < 0) return false;
        if (advisor && row.advisor.toLowerCase().indexOf(advisor) < 0) return false;
        if (picker && row.picker.toLowerCase().indexOf(picker) < 0) return false;
        if (ioNo && row.ioNo.toLowerCase().indexOf(ioNo) < 0) return false;
        if (settleStatus === '已结算' && !row.settleTime) return false;
        if (settleStatus === '未结算' && row.settleTime) return false;
        return true;
      });
      rrdCurrentPage = 1;
      rrdRenderTable();
    }

    function rrdResetFilter() {
      document.getElementById('rrd-flt-part-code').value = '';
      document.getElementById('rrd-flt-part-name').value = '';
      document.getElementById('rrd-flt-io-type').value = '';
      document.getElementById('rrd-flt-order-no').value = '';
      document.getElementById('rrd-flt-repair-type').value = '';
      document.getElementById('rrd-flt-repair-cat').value = '';
      document.getElementById('rrd-flt-pay-type').value = '';
      document.getElementById('rrd-flt-cust-code').value = '';
      document.getElementById('rrd-flt-owner').value = '';
      document.getElementById('rrd-flt-plate').value = '';
      document.getElementById('rrd-flt-vin').value = '';
      document.getElementById('rrd-flt-advisor').value = '';
      document.getElementById('rrd-flt-series').value = '';
      document.getElementById('rrd-flt-picker').value = '';
      document.getElementById('rrd-flt-io-no').value = '';
      document.getElementById('rrd-flt-settle-status').value = '';
      var startEl = document.getElementById('rrd-flt-date-start');
      var endEl = document.getElementById('rrd-flt-date-end');
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
      var settleStartEl = document.getElementById('rrd-flt-settle-start');
      var settleEndEl = document.getElementById('rrd-flt-settle-end');
      if (settleStartEl) settleStartEl.value = '';
      if (settleEndEl) settleEndEl.value = '';
      var submitStartEl = document.getElementById('rrd-flt-submit-start');
      var submitEndEl = document.getElementById('rrd-flt-submit-end');
      if (submitStartEl) submitStartEl.value = '';
      if (submitEndEl) submitEndEl.value = '';
      // 重置日期范围显示
      document.querySelectorAll('#page-repair-requisition-detail .lt-date-range-text').forEach(function(el) { el.value = ''; });
      rrdFilteredData = [...rrdAllData];
      rrdCurrentPage = 1;
      rrdRenderTable();
    }

    function rrdExportData() { alert('导出功能 - 将导出当前查询结果的 ' + rrdFilteredData.length + ' 条数据'); }

    // Combobox 通用辅助函数
    function rrdFilterCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      var val = input.value.toLowerCase();
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var match = item.textContent.toLowerCase().includes(val);
        item.classList.toggle('hidden', !match);
      });
    }
    function rrdShowCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (list) list.classList.add('show');
    }
    function rrdToggleCombobox(arrow) {
      var wrap = arrow.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      list.classList.toggle('show');
      if (list.classList.contains('show')) {
        var input = wrap.querySelector('input');
        if (input) input.focus();
      }
    }
    function rrdSelectCombobox(li) {
      var wrap = li.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var input = wrap.querySelector('input');
      var list = wrap.querySelector('.lt-datalist');
      if (input) input.value = li.textContent;
      if (list) list.classList.remove('show');
      rrdApplyFilter();
    }
    // 点击外部关闭所有 combobox 下拉
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.lt-input-wrap.combobox')) {
        document.querySelectorAll('#page-repair-requisition-detail .lt-datalist.show').forEach(function(l) { l.classList.remove('show'); });
      }
    });

    // 展开/收起
    function rrdToggleFilter() { rrdFilterExpanded = !rrdFilterExpanded; toggleFilterGrid('rrd-filterGrid', rrdFilterExpanded, RRD_SHOW_COUNT); }

    // 初始化函数
    function initRrd() {
      if (!rrdInitialized) {
        rrdInitialized = true;
        // 出入库日期默认：上个月的今天 ~ 今天
        var now = new Date();
        var startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (startDate.getMonth() !== ((now.getMonth() - 1 + 12) % 12)) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        var ds = startDate.toISOString().split('T')[0];
        var de = now.toISOString().split('T')[0];
        var startEl = document.getElementById('rrd-flt-date-start');
        var endEl = document.getElementById('rrd-flt-date-end');
        if (startEl) startEl.value = ds;
        if (endEl) endEl.value = de;
        var textEl = document.querySelector('#page-repair-requisition-detail .lt-date-range-text');
        if (textEl) textEl.value = ds + '-' + de;
      }
      rrdFilteredData = [...rrdAllData];
      rrdRenderTable();
      initFilterGrid('rrd-filterGrid', RRD_SHOW_COUNT);
    }

    // ===== 配件销售明细 JS =====
    var psdAllData = [
      {saleNo:'XJ202505001', id:1, storeName:'北京朝阳店', storeCode:'BJ001', custCategory:'个人客户', custCode:'C1001', custName:'张先生', plate:'京A12345', vin:'LSVAA4180E2000001', ioNo:'RK202505001', ioType:'配件销售', code:'P001', name:'机油滤清器', ioQty:1, unitPrice:35.0, amount:35.0, costPrice:25.0, costTotal:25.0, ioTime:'2025-05-20 10:00', picker:'张三', warehouse:'中心仓', position:'A01-01', remark:''},
      {saleNo:'XJ202505002', id:2, storeName:'上海浦东店', storeCode:'SH001', custCategory:'企业客户', custCode:'C1002', custName:'李女士', plate:'沪B67890', vin:'LSVAA4180E2000002', ioNo:'RK202505002', ioType:'配件退货', code:'P002', name:'空气滤清器', ioQty:-2, unitPrice:45.0, amount:90.0, costPrice:32.0, costTotal:64.0, ioTime:'2025-05-21 11:15', picker:'李四', warehouse:'上海仓', position:'A02-02', remark:''},
      {saleNo:'XJ202505003', id:3, storeName:'广州天河店', storeCode:'GZ001', custCategory:'保险公司', custCode:'C1003', custName:'王先生', plate:'粤C11111', vin:'LSVAA4180E2000003', ioNo:'RK202505003', ioType:'配件销售', code:'P003', name:'刹车片', ioQty:3, unitPrice:150.0, amount:450.0, costPrice:110.0, costTotal:330.0, ioTime:'2025-05-22 12:30', picker:'王五', warehouse:'广州仓', position:'A03-03', remark:''},
      {saleNo:'XJ202505004', id:4, storeName:'武汉洪山店', storeCode:'WH001', custCategory:'维修厂', custCode:'C1004', custName:'赵女士', plate:'鄂A22222', vin:'LSVAA4180E2000004', ioNo:'RK202505004', ioType:'配件退货', code:'P004', name:'火花塞', ioQty:-4, unitPrice:50.0, amount:200.0, costPrice:35.0, costTotal:140.0, ioTime:'2025-05-23 13:45', picker:'赵六', warehouse:'武汉仓', position:'A04-04', remark:''},
      {saleNo:'XJ202505005', id:5, storeName:'深圳南山店', storeCode:'SZ001', custCategory:'个人客户', custCode:'C1005', custName:'刘先生', plate:'粤B33333', vin:'LSVAA4180E2000005', ioNo:'RK202505005', ioType:'配件销售', code:'P005', name:'雨刮器', ioQty:5, unitPrice:68.0, amount:340.0, costPrice:48.0, costTotal:240.0, ioTime:'2025-05-24 14:00', picker:'钱七', warehouse:'深圳仓', position:'A05-05', remark:''},
      {saleNo:'XJ202505006', id:6, storeName:'杭州西湖店', storeCode:'HZ001', custCategory:'企业客户', custCode:'C1006', custName:'陈女士', plate:'浙A44444', vin:'LSVAA4180E2000006', ioNo:'RK202505006', ioType:'配件退货', code:'P006', name:'机油', ioQty:-1, unitPrice:85.0, amount:85.0, costPrice:60.0, costTotal:60.0, ioTime:'2025-05-25 15:15', picker:'孙八', warehouse:'杭州仓', position:'A06-06', remark:''},
      {saleNo:'XJ202505007', id:7, storeName:'北京朝阳店', storeCode:'BJ001', custCategory:'保险公司', custCode:'C1001', custName:'张先生', plate:'京A12345', vin:'LSVAA4180E2000001', ioNo:'RK202505007', ioType:'配件销售', code:'P007', name:'变速箱油', ioQty:2, unitPrice:120.0, amount:240.0, costPrice:85.0, costTotal:170.0, ioTime:'2025-05-20 16:30', picker:'张三', warehouse:'中心仓', position:'A01-07', remark:''},
      {saleNo:'XJ202505008', id:8, storeName:'上海浦东店', storeCode:'SH001', custCategory:'维修厂', custCode:'C1002', custName:'李女士', plate:'沪B67890', vin:'LSVAA4180E2000002', ioNo:'RK202505008', ioType:'配件退货', code:'P008', name:'轮胎', ioQty:-3, unitPrice:450.0, amount:1350.0, costPrice:350.0, costTotal:1050.0, ioTime:'2025-05-21 17:45', picker:'李四', warehouse:'上海仓', position:'A02-08', remark:''},
      {saleNo:'XJ202505009', id:9, storeName:'广州天河店', storeCode:'GZ001', custCategory:'个人客户', custCode:'C1003', custName:'王先生', plate:'粤C11111', vin:'LSVAA4180E2000003', ioNo:'RK202505009', ioType:'配件销售', code:'P009', name:'减震器', ioQty:4, unitPrice:280.0, amount:1120.0, costPrice:200.0, costTotal:800.0, ioTime:'2025-05-22 18:00', picker:'王五', warehouse:'广州仓', position:'A03-09', remark:''},
      {saleNo:'XJ202505010', id:10, storeName:'武汉洪山店', storeCode:'WH001', custCategory:'企业客户', custCode:'C1004', custName:'赵女士', plate:'鄂A22222', vin:'LSVAA4180E2000004', ioNo:'RK202505010', ioType:'配件退货', code:'P010', name:'空调滤清器', ioQty:-5, unitPrice:120.0, amount:600.0, costPrice:80.0, costTotal:400.0, ioTime:'2025-05-23 19:15', picker:'赵六', warehouse:'武汉仓', position:'A04-10', remark:''},
      {saleNo:'XJ202505011', id:11, storeName:'深圳南山店', storeCode:'SZ001', custCategory:'保险公司', custCode:'C1005', custName:'刘先生', plate:'粤B33333', vin:'LSVAA4180E2000005', ioNo:'RK202505011', ioType:'配件销售', code:'P001', name:'机油滤清器', ioQty:1, unitPrice:35.0, amount:35.0, costPrice:25.0, costTotal:25.0, ioTime:'2025-05-24 10:30', picker:'钱七', warehouse:'深圳仓', position:'A05-01', remark:''},
      {saleNo:'XJ202505012', id:12, storeName:'杭州西湖店', storeCode:'HZ001', custCategory:'维修厂', custCode:'C1006', custName:'陈女士', plate:'浙A44444', vin:'LSVAA4180E2000006', ioNo:'RK202505012', ioType:'配件退货', code:'P002', name:'空气滤清器', ioQty:-2, unitPrice:45.0, amount:90.0, costPrice:32.0, costTotal:64.0, ioTime:'2025-05-25 11:45', picker:'孙八', warehouse:'杭州仓', position:'A06-02', remark:''},
      {saleNo:'XJ202505013', id:13, storeName:'北京朝阳店', storeCode:'BJ001', custCategory:'个人客户', custCode:'C1001', custName:'张先生', plate:'京A12345', vin:'LSVAA4180E2000001', ioNo:'RK202505013', ioType:'配件销售', code:'P003', name:'刹车片', ioQty:3, unitPrice:150.0, amount:450.0, costPrice:110.0, costTotal:330.0, ioTime:'2025-05-20 12:00', picker:'张三', warehouse:'中心仓', position:'A01-03', remark:''},
      {saleNo:'XJ202505014', id:14, storeName:'上海浦东店', storeCode:'SH001', custCategory:'企业客户', custCode:'C1002', custName:'李女士', plate:'沪B67890', vin:'LSVAA4180E2000002', ioNo:'RK202505014', ioType:'配件退货', code:'P004', name:'火花塞', ioQty:-4, unitPrice:50.0, amount:200.0, costPrice:35.0, costTotal:140.0, ioTime:'2025-05-21 13:15', picker:'李四', warehouse:'上海仓', position:'A02-04', remark:''},
      {saleNo:'XJ202505015', id:15, storeName:'广州天河店', storeCode:'GZ001', custCategory:'保险公司', custCode:'C1003', custName:'王先生', plate:'粤C11111', vin:'LSVAA4180E2000003', ioNo:'RK202505015', ioType:'配件销售', code:'P005', name:'雨刮器', ioQty:5, unitPrice:68.0, amount:340.0, costPrice:48.0, costTotal:240.0, ioTime:'2025-05-22 14:30', picker:'王五', warehouse:'广州仓', position:'A03-05', remark:''},
      {saleNo:'XJ202505016', id:16, storeName:'武汉洪山店', storeCode:'WH001', custCategory:'维修厂', custCode:'C1004', custName:'赵女士', plate:'鄂A22222', vin:'LSVAA4180E2000004', ioNo:'RK202505016', ioType:'配件退货', code:'P006', name:'机油', ioQty:-1, unitPrice:85.0, amount:85.0, costPrice:60.0, costTotal:60.0, ioTime:'2025-05-23 15:45', picker:'赵六', warehouse:'武汉仓', position:'A04-06', remark:''},
      {saleNo:'XJ202505017', id:17, storeName:'深圳南山店', storeCode:'SZ001', custCategory:'个人客户', custCode:'C1005', custName:'刘先生', plate:'粤B33333', vin:'LSVAA4180E2000005', ioNo:'RK202505017', ioType:'配件销售', code:'P007', name:'变速箱油', ioQty:2, unitPrice:120.0, amount:240.0, costPrice:85.0, costTotal:170.0, ioTime:'2025-05-24 16:00', picker:'钱七', warehouse:'深圳仓', position:'A05-07', remark:''},
      {saleNo:'XJ202505018', id:18, storeName:'杭州西湖店', storeCode:'HZ001', custCategory:'企业客户', custCode:'C1006', custName:'陈女士', plate:'浙A44444', vin:'LSVAA4180E2000006', ioNo:'RK202505018', ioType:'配件退货', code:'P008', name:'轮胎', ioQty:-3, unitPrice:450.0, amount:1350.0, costPrice:350.0, costTotal:1050.0, ioTime:'2025-05-25 17:15', picker:'孙八', warehouse:'杭州仓', position:'A06-08', remark:''},
      {saleNo:'XJ202505019', id:19, storeName:'北京朝阳店', storeCode:'BJ001', custCategory:'保险公司', custCode:'C1001', custName:'张先生', plate:'京A12345', vin:'LSVAA4180E2000001', ioNo:'RK202505019', ioType:'配件销售', code:'P009', name:'减震器', ioQty:4, unitPrice:280.0, amount:1120.0, costPrice:200.0, costTotal:800.0, ioTime:'2025-05-20 18:30', picker:'张三', warehouse:'中心仓', position:'A01-09', remark:''},
      {saleNo:'XJ202505020', id:20, storeName:'上海浦东店', storeCode:'SH001', custCategory:'维修厂', custCode:'C1002', custName:'李女士', plate:'沪B67890', vin:'LSVAA4180E2000002', ioNo:'RK202505020', ioType:'配件退货', code:'P010', name:'空调滤清器', ioQty:-5, unitPrice:120.0, amount:600.0, costPrice:80.0, costTotal:400.0, ioTime:'2025-05-21 19:45', picker:'李四', warehouse:'上海仓', position:'A02-10', remark:''}
    ];
    var psdFilteredData = [];
    var psdCurrentPage = 1;
    var psdPageSize = 20;
    var psdFilterExpanded = false;
    var psdInitialized = false;

    // 生成示例数据
    (function() {
      var partCodes = ['HN089083','HN089084','HN089085','HN089086','HN089087','HN089088','HN089089','HN089090','HN089091','HN089092'];
      var partNames = ['减速器加油口密封垫','制动摩擦片','空调滤芯','机油滤清器','火花塞总成','前大灯总成','雨刮片','蓄电池','冷却液','正时皮带'];
      var ioTypes = ['销售出库','销售退货入库'];
      var saleNos = ['H2901220826C0A','H2901220811C03','H2901220804C09','H2901220804C08','H2901220804C07','H2901220804C06','H2901220804C05','H2901220804C04','H2901220804C03','H2901220804C02'];
      var custCategories = ['个人','企业','内部'];
      var custCodes = ['C1001','C1002','C1003','C1004','C1005'];
      var custNames = ['李*云','王*明','张*华','刘*芳','陈*强'];
      var plates = ['鄂A***B9','京B67890','沪C11111','粤D22222','浙E33333'];
      var vins = ['LG****7919','LSVAU2180N2023456','LSVAU2180N2034567','LSVAU2180N2045678','LSVAU2180N2056789'];
      var pickers = ['张三','李四','王五','赵六'];
      var warehouses = ['维修专用仓','主仓库','辅料仓'];
      var positions = ['56-6-18','A-01-01','B-02-01','C-03-01','D-04-01'];
      var storeNames = ['门店名称'];
      var storeCodes = ['门店编码'];

      for (var i = 0; i < 25; i++) {
        var idx = i % 10;
        var ioType = ioTypes[i % 2];
        var qty = ioType === '销售出库' ? (1 + Math.floor(Math.random() * 12)) : -(1 + Math.floor(Math.random() * 3));
        var unitPrice = 120.00;
        var amount = (Math.abs(qty) * unitPrice).toFixed(2);
        var costPrice = 100.00;
        var costTotal = (Math.abs(qty) * costPrice).toFixed(2);
        var month = (1 + Math.floor(i / 10));
        var day = (1 + (i * 3) % 28);
        var ioTime = '2025-0' + month + '-' + (day < 10 ? '0' + day : day) + ' 13:00:00';
        psdAllData.push({
          id: i + 1,
          saleNo: saleNos[idx],
          storeName: storeNames[0],
          storeCode: storeCodes[0],
          custCategory: custCategories[i % 3],
          custCode: custCodes[i % 5],
          custName: custNames[i % 5],
          plate: plates[i % 5],
          vin: vins[i % 5],
          ioNo: 'H290122080' + (i < 10 ? '0' + i : i),
          ioType: ioType,
          code: partCodes[idx],
          name: partNames[idx],
          ioQty: qty,
          unitPrice: unitPrice.toFixed(2),
          amount: amount,
          costPrice: costPrice.toFixed(2),
          costTotal: costTotal,
          ioTime: ioTime,
          picker: pickers[i % 4],
          warehouse: warehouses[i % 3],
          position: positions[i % 5],
          remark: ''
        });
      }
    })();

    function psdRenderTable() {
      var start = (psdCurrentPage - 1) * psdPageSize;
      var pageData = psdFilteredData.slice(start, start + psdPageSize);
      var tbody = document.getElementById('psd-tbody');
      tbody.innerHTML = pageData.map(function(row) {
        var qtyClass = row.ioQty < 0 ? 'lt-green' : '';
        return '<tr>' +
          '<td class="sticky col-seq">' + row.id + '</td>' +
          '<td class="sticky col-sale-no">' + row.saleNo + '</td>' +
          '<td class="col-store-name">' + row.storeName + '</td>' +
          '<td class="col-store-code">' + row.storeCode + '</td>' +
          '<td class="col-cust-category">' + row.custCategory + '</td>' +
          '<td class="col-cust-code">' + row.custCode + '</td>' +
          '<td class="col-cust-name">' + row.custName + '</td>' +
          '<td class="col-plate">' + row.plate + '</td>' +
          '<td class="col-vin">' + row.vin + '</td>' +
          '<td class="col-io-no">' + row.ioNo + '</td>' +
          '<td class="col-io-type">' + row.ioType + '</td>' +
          '<td class="col-part-code">' + row.code + '</td>' +
          '<td class="col-part-name">' + row.name + '</td>' +
          '<td class="col-io-qty ' + qtyClass + '">' + row.ioQty + '</td>' +
          '<td class="col-unit-price">' + row.unitPrice + '</td>' +
          '<td class="col-amount">' + row.amount + '</td>' +
          '<td class="col-cost-price">' + row.costPrice + '</td>' +
          '<td class="col-cost-total">' + row.costTotal + '</td>' +
          '<td class="col-io-time">' + row.ioTime + '</td>' +
          '<td class="col-picker">' + row.picker + '</td>' +
          '<td class="col-warehouse">' + row.warehouse + '</td>' +
          '<td class="col-position">' + row.position + '</td>' +
          '<td class="col-remark">' + row.remark + '</td>' +
          '</tr>';
      }).join('');
      var total = psdFilteredData.length;
      document.getElementById('psd-pg-total').textContent = '共 ' + total + ' 条';
      psdRenderPages();
    }

    function psdRenderPages() {
      var totalPages = Math.ceil(psdFilteredData.length / psdPageSize) || 1;
      var pages = document.getElementById('psd-pg-pages');
      var html = '';
      if (totalPages <= 7) {
        for (var i = 1; i <= totalPages; i++) {
          html += i === psdCurrentPage
            ? '<button class="active" onclick="psdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="psdGoPage(' + i + ')">' + i + '</button>';
        }
      } else if (psdCurrentPage <= 4) {
        for (var i = 1; i <= 6; i++) {
          html += i === psdCurrentPage
            ? '<button class="active" onclick="psdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="psdGoPage(' + i + ')">' + i + '</button>';
        }
        html += '<span style="padding:0 4px">…</span><button onclick="psdGoPage(' + totalPages + ')">' + totalPages + '</button>';
      } else if (psdCurrentPage >= totalPages - 3) {
        html += '<button onclick="psdGoPage(1)">1</button><span style="padding:0 4px">…</span>';
        for (var i = totalPages - 5; i <= totalPages; i++) {
          html += i === psdCurrentPage
            ? '<button class="active" onclick="psdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="psdGoPage(' + i + ')">' + i + '</button>';
        }
      } else {
        html += '<button onclick="psdGoPage(1)">1</button><span style="padding:0 4px">…</span>';
        for (var i = psdCurrentPage - 2; i <= psdCurrentPage + 2; i++) {
          html += i === psdCurrentPage
            ? '<button class="active" onclick="psdGoPage(' + i + ')">' + i + '</button>'
            : '<button onclick="psdGoPage(' + i + ')">' + i + '</button>';
        }
        html += '<span style="padding:0 4px">…</span><button onclick="psdGoPage(' + totalPages + ')">' + totalPages + '</button>';
      }
      pages.innerHTML = html;
      document.getElementById('psd-pg-prev').disabled = psdCurrentPage === 1;
      document.getElementById('psd-pg-next').disabled = psdCurrentPage >= totalPages;
    }

    function psdGoPage(p) { psdCurrentPage = p; psdRenderTable(); }
    function psdChangePage(delta) { psdGoPage(Math.max(1, Math.min(psdCurrentPage + delta, Math.ceil(psdFilteredData.length / psdPageSize) || 1))); }
    function psdChangePageSize(size) { psdPageSize = parseInt(size); psdCurrentPage = 1; psdRenderTable(); }
    function psdGotoPage(v) { var p = parseInt(v); if (p) psdGoPage(p); }

    function psdApplyFilter() {
      var code = (document.getElementById('psd-flt-code').value || '').toLowerCase();
      var name = (document.getElementById('psd-flt-name').value || '').toLowerCase();
      var ioType = document.getElementById('psd-flt-io-type').value || '';
      var saleNo = (document.getElementById('psd-flt-sale-no').value || '').toLowerCase();
      var custCategory = document.getElementById('psd-flt-cust-category').value || '';
      var picker = (document.getElementById('psd-flt-picker').value || '').toLowerCase();
      var ioNo = (document.getElementById('psd-flt-io-no').value || '').toLowerCase();
      var custCode = (document.getElementById('psd-flt-cust-code').value || '').toLowerCase();
      var custName = (document.getElementById('psd-flt-cust-name').value || '').toLowerCase();
      var plate = (document.getElementById('psd-flt-plate').value || '').toLowerCase();
      var vin = (document.getElementById('psd-flt-vin').value || '').toLowerCase();
      var region = (document.getElementById('psd-flt-region').value || '').toLowerCase();
      var district = (document.getElementById('psd-flt-district').value || '').toLowerCase();
      var store = (document.getElementById('psd-flt-store').value || '').toLowerCase();

      psdFilteredData = psdAllData.filter(function(row) {
        if (code && row.code.toLowerCase().indexOf(code) < 0) return false;
        if (name && row.name.toLowerCase().indexOf(name) < 0) return false;
        if (ioType && row.ioType !== ioType) return false;
        if (saleNo && row.saleNo.toLowerCase().indexOf(saleNo) < 0) return false;
        if (custCategory && row.custCategory !== custCategory) return false;
        if (picker && row.picker.toLowerCase().indexOf(picker) < 0) return false;
        if (ioNo && row.ioNo.toLowerCase().indexOf(ioNo) < 0) return false;
        if (custCode && row.custCode.toLowerCase().indexOf(custCode) < 0) return false;
        if (custName && row.custName.toLowerCase().indexOf(custName) < 0) return false;
        if (plate && row.plate.toLowerCase().indexOf(plate) < 0) return false;
        if (vin && row.vin.toLowerCase().indexOf(vin) < 0) return false;
        if (store && row.storeName.toLowerCase().indexOf(store) < 0) return false;
        return true;
      });
      psdCurrentPage = 1;
      psdRenderTable();
    }

    function psdResetFilter() {
      document.getElementById('psd-flt-code').value = '';
      document.getElementById('psd-flt-name').value = '';
      document.getElementById('psd-flt-io-type').value = '';
      document.getElementById('psd-flt-sale-no').value = '';
      document.getElementById('psd-flt-cust-category').value = '';
      document.getElementById('psd-flt-picker').value = '';
      document.getElementById('psd-flt-io-no').value = '';
      document.getElementById('psd-flt-cust-code').value = '';
      document.getElementById('psd-flt-cust-name').value = '';
      document.getElementById('psd-flt-plate').value = '';
      document.getElementById('psd-flt-vin').value = '';
      document.getElementById('psd-flt-region').value = '';
      document.getElementById('psd-flt-district').value = '';
      document.getElementById('psd-flt-store').value = '';
      var startEl = document.getElementById('psd-flt-date-start');
      var endEl = document.getElementById('psd-flt-date-end');
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
      document.querySelectorAll('#page-parts-sales-detail .lt-date-range-text').forEach(function(el) { el.value = ''; });
      psdFilteredData = [...psdAllData];
      psdCurrentPage = 1;
      psdRenderTable();
    }

    function psdExportData() { alert('导出功能 - 将导出当前查询结果的 ' + psdFilteredData.length + ' 条数据'); }

    // Combobox 通用辅助函数
    function psdFilterCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      var val = input.value.toLowerCase();
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var match = item.textContent.toLowerCase().includes(val);
        item.classList.toggle('hidden', !match);
      });
    }
    function psdShowCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (list) list.classList.add('show');
    }
    function psdToggleCombobox(arrow) {
      var wrap = arrow.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      list.classList.toggle('show');
      if (list.classList.contains('show')) {
        var input = wrap.querySelector('input');
        if (input) input.focus();
      }
    }
    function psdSelectCombobox(li) {
      var wrap = li.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var input = wrap.querySelector('input');
      var list = wrap.querySelector('.lt-datalist');
      if (input) input.value = li.textContent;
      if (list) list.classList.remove('show');
      psdApplyFilter();
    }
    // 点击外部关闭所有 combobox 下拉
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.lt-input-wrap.combobox')) {
        document.querySelectorAll('#page-parts-sales-detail .lt-datalist.show').forEach(function(l) { l.classList.remove('show'); });
      }
    });

    // 展开/收起
    function psdToggleFilter() { psdFilterExpanded = !psdFilterExpanded; toggleFilterGrid('psd-filterGrid', psdFilterExpanded, PSD_SHOW_COUNT); }

    // 初始化函数
    function initPsd() {
      if (!psdInitialized) {
        psdInitialized = true;
        // 出入库日期默认：上个月的今天 ~ 今天
        var now = new Date();
        var startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (startDate.getMonth() !== ((now.getMonth() - 1 + 12) % 12)) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        var ds = startDate.toISOString().split('T')[0];
        var de = now.toISOString().split('T')[0];
        var startEl = document.getElementById('psd-flt-date-start');
        var endEl = document.getElementById('psd-flt-date-end');
        if (startEl) startEl.value = ds;
        if (endEl) endEl.value = de;
        var textEl = document.querySelector('#page-parts-sales-detail .lt-date-range-text');
        if (textEl) textEl.value = ds + '-' + de;
      }
      psdFilteredData = [...psdAllData];
      psdRenderTable();
      initFilterGrid('psd-filterGrid', PSD_SHOW_COUNT);
    }

    // ===== 采购退货明细 JS =====
    var prdAllData = [
      {returnNo:'CG202505001', storeCode:'BJ001', storeName:'北京朝阳店', purchaseNo:'CG202505001A', supplier:'配件供应商A', returnDate:'2025-05-20', partCode:'P001', partName:'机油滤清器', qty:10, price:150.00, amount:1500.00, reason:'质量不合格', status:'已审核', handler:'张三', remark:'外观破损', costUnit:'个', costTotal:1500.00, warehouse:'配件仓库A', location:'A-01'},
      {returnNo:'CG202505002', storeCode:'SH001', storeName:'上海浦东店', purchaseNo:'CG202505001B', supplier:'配件供应商A', returnDate:'2025-05-20', partCode:'P002', partName:'刹车片', qty:8, price:150.00, amount:1200.00, reason:'型号错误', status:'已审核', handler:'李四', remark:'装错型号', costUnit:'个', costTotal:1200.00, warehouse:'配件仓库B', location:'B-02'},
      {returnNo:'CG202505003', storeCode:'GZ001', storeName:'广州天河店', purchaseNo:'CG202505002A', supplier:'配件供应商B', returnDate:'2025-05-21', partCode:'P003', partName:'空气滤清器', qty:15, price:80.00, amount:1200.00, reason:'质量不合格', status:'已审核', handler:'王五', remark:'过滤效果差', costUnit:'个', costTotal:1200.00, warehouse:'配件仓库C', location:'C-03'},
      {returnNo:'CG202505004', storeCode:'WH001', storeName:'武汉洪山店', purchaseNo:'CG202505002B', supplier:'配件供应商B', returnDate:'2025-05-21', partCode:'P004', partName:'火花塞', qty:20, price:45.00, amount:900.00, reason:'数量错误', status:'已审核', handler:'张三', remark:'多发5个', costUnit:'个', costTotal:900.00, warehouse:'配件仓库A', location:'A-04'},
      {returnNo:'CG202505005', storeCode:'SZ001', storeName:'深圳南山店', purchaseNo:'CG202505003A', supplier:'配件供应商C', returnDate:'2025-05-22', partCode:'P005', partName:'雨刷片', qty:12, price:60.00, amount:720.00, reason:'质量不合格', status:'已审核', handler:'李四', remark:'刮水效果差', costUnit:'个', costTotal:720.00, warehouse:'配件仓库B', location:'B-05'},
      {returnNo:'CG202505006', storeCode:'HZ001', storeName:'杭州西湖店', purchaseNo:'CG202505003B', supplier:'配件供应商C', returnDate:'2025-05-22', partCode:'P006', partName:'灯泡', qty:25, price:25.00, amount:625.00, reason:'型号错误', status:'已审核', handler:'王五', remark:'功率不匹配', costUnit:'个', costTotal:625.00, warehouse:'配件仓库C', location:'C-06'},
      {returnNo:'CG202505007', storeCode:'BJ001', storeName:'北京朝阳店', purchaseNo:'CG202505004A', supplier:'配件供应商A', returnDate:'2025-05-23', partCode:'P007', partName:'机油', qty:6, price:180.00, amount:1080.00, reason:'质量问题', status:'已审核', handler:'张三', remark:'粘度异常', costUnit:'升', costTotal:1080.00, warehouse:'润滑油仓库A', location:'A-07'},
      {returnNo:'CG202505008', storeCode:'SH001', storeName:'上海浦东店', purchaseNo:'CG202505004B', supplier:'配件供应商A', returnDate:'2025-05-23', partCode:'P008', partName:'空调滤清器', qty:8, price:120.00, amount:960.00, reason:'外观破损', status:'已审核', handler:'李四', remark:'包装损坏', costUnit:'个', costTotal:960.00, warehouse:'配件仓库B', location:'B-08'},
      {returnNo:'CG202505009', storeCode:'GZ001', storeName:'广州天河店', purchaseNo:'CG202505005A', supplier:'配件供应商B', returnDate:'2025-05-24', partCode:'P009', partName:'刹车油', qty:4, price:120.00, amount:480.00, reason:'数量错误', status:'已审核', handler:'王五', remark:'少发2瓶', costUnit:'升', costTotal:480.00, warehouse:'润滑油仓库C', location:'C-09'},
      {returnNo:'CG202505010', storeCode:'WH001', storeName:'武汉洪山店', purchaseNo:'CG202505005B', supplier:'配件供应商B', returnDate:'2025-05-24', partCode:'P010', partName:'电池', qty:3, price:380.00, amount:1140.00, reason:'质量问题', status:'已审核', handler:'张三', remark:'无法充电', costUnit:'个', costTotal:1140.00, warehouse:'电池仓库A', location:'A-10'},
      {returnNo:'CG202505011', storeCode:'SZ001', storeName:'深圳南山店', purchaseNo:'CG202505006A', supplier:'配件供应商C', returnDate:'2025-05-25', partCode:'P011', partName:'皮带', qty:5, price:90.00, amount:450.00, reason:'型号错误', status:'已审核', handler:'李四', remark:'长度不匹配', costUnit:'条', costTotal:450.00, warehouse:'传动系统仓库B', location:'B-11'},
      {returnNo:'CG202505012', storeCode:'HZ001', storeName:'杭州西湖店', purchaseNo:'CG202505006B', supplier:'配件供应商C', returnDate:'2025-05-25', partCode:'P012', partName:'离合器片', qty:2, price:350.00, amount:700.00, reason:'质量问题', status:'已审核', handler:'王五', remark:'材质不符', costUnit:'个', costTotal:700.00, warehouse:'传动系统仓库C', location:'C-12'},
      {returnNo:'CG202505013', storeCode:'BJ001', storeName:'北京朝阳店', purchaseNo:'CG202505007A', supplier:'配件供应商A', returnDate:'2025-05-25', partCode:'P013', partName:'变速箱油', qty:3, price:280.00, amount:840.00, reason:'外观破损', status:'已审核', handler:'张三', remark:'包装泄漏', costUnit:'升', costTotal:840.00, warehouse:'润滑油仓库A', location:'A-13'},
      {returnNo:'CG202505014', storeCode:'SH001', storeName:'上海浦东店', purchaseNo:'CG202505007B', supplier:'配件供应商A', returnDate:'2025-05-25', partCode:'P014', partName:'火花塞', qty:10, price:50.00, amount:500.00, reason:'数量错误', status:'已审核', handler:'李四', remark:'多发3个', costUnit:'个', costTotal:500.00, warehouse:'配件仓库B', location:'B-14'},
      {returnNo:'CG202505015', storeCode:'GZ001', storeName:'广州天河店', purchaseNo:'CG202505008A', supplier:'配件供应商B', returnDate:'2025-05-25', partCode:'P015', partName:'雨刷片', qty:6, price:80.00, amount:480.00, reason:'质量问题', status:'已审核', handler:'王五', remark:'刮水效果差', costUnit:'个', costTotal:480.00, warehouse:'配件仓库C', location:'C-15'},
      {returnNo:'CG202505016', storeCode:'WH001', storeName:'武汉洪山店', purchaseNo:'CG202505008B', supplier:'配件供应商B', returnDate:'2025-05-25', partCode:'P016', partName:'灯泡', qty:12, price:25.00, amount:300.00, reason:'型号错误', status:'已审核', handler:'张三', remark:'色温不符', costUnit:'个', costTotal:300.00, warehouse:'照明仓库A', location:'A-16'},
      {returnNo:'CG202505017', storeCode:'SZ001', storeName:'深圳南山店', purchaseNo:'CG202505009A', supplier:'配件供应商C', returnDate:'2025-05-25', partCode:'P017', partName:'刹车片', qty:4, price:150.00, amount:600.00, reason:'质量问题', status:'已审核', handler:'李四', remark:'材质问题', costUnit:'个', costTotal:600.00, warehouse:'制动系统仓库B', location:'B-17'},
      {returnNo:'CG202505018', storeCode:'HZ001', storeName:'杭州西湖店', purchaseNo:'CG202505009B', supplier:'配件供应商C', returnDate:'2025-05-25', partCode:'P018', partName:'机油滤清器', qty:5, price:150.00, amount:750.00, reason:'外观破损', status:'已审核', handler:'王五', remark:'外壳破裂', costUnit:'个', costTotal:750.00, warehouse:'配件仓库C', location:'C-18'},
      {returnNo:'CG202505019', storeCode:'BJ001', storeName:'北京朝阳店', purchaseNo:'CG202505010A', supplier:'配件供应商A', returnDate:'2025-05-25', partCode:'P019', partName:'空调滤清器', qty:3, price:120.00, amount:360.00, reason:'数量错误', status:'已审核', handler:'张三', remark:'少发1个', costUnit:'个', costTotal:360.00, warehouse:'空调仓库A', location:'A-19'},
      {returnNo:'CG202505020', storeCode:'SH001', storeName:'上海浦东店', purchaseNo:'CG202505010B', supplier:'配件供应商A', returnDate:'2025-05-25', partCode:'P020', partName:'雨刷片', qty:8, price:60.00, amount:480.00, reason:'质量问题', status:'已审核', handler:'李四', remark:'刮水效果差', costUnit:'个', costTotal:480.00, warehouse:'配件仓库B', location:'B-20'},
      {returnNo:'CG202505021', storeCode:'GZ001', storeName:'广州天河店', purchaseNo:'CG202505011A', supplier:'配件供应商B', returnDate:'2025-05-25', partCode:'P021', partName:'蓄电池', qty:2, price:380.00, amount:760.00, reason:'型号错误', status:'已审核', handler:'王五', remark:'容量不符', costUnit:'个', costTotal:760.00, warehouse:'电池仓库C', location:'C-21'},
      {returnNo:'CG202505022', storeCode:'WH001', storeName:'武汉洪山店', purchaseNo:'CG202505011B', supplier:'配件供应商B', returnDate:'2025-05-25', partCode:'P022', partName:'空滤', qty:4, price:60.00, amount:240.00, reason:'质量问题', status:'已审核', handler:'张三', remark:'过滤效果差', costUnit:'个', costTotal:240.00, warehouse:'空气滤清器仓库A', location:'A-22'},
      {returnNo:'CG202505023', storeCode:'SZ001', storeName:'深圳南山店', purchaseNo:'CG202505012A', supplier:'配件供应商C', returnDate:'2025-05-25', partCode:'P023', partName:'刹车油', qty:2, price:120.00, amount:240.00, reason:'外观破损', status:'已审核', handler:'李四', remark:'包装泄漏', costUnit:'升', costTotal:240.00, warehouse:'润滑油仓库B', location:'B-23'},
      {returnNo:'CG202505024', storeCode:'HZ001', storeName:'杭州西湖店', purchaseNo:'CG202505012B', supplier:'配件供应商C', returnDate:'2025-05-25', partCode:'P024', partName:'灯泡', qty:6, price:25.00, amount:150.00, reason:'数量错误', status:'已审核', handler:'王五', remark:'多发1个', costUnit:'个', costTotal:150.00, warehouse:'照明仓库C', location:'C-24'},
      {returnNo:'CG202505025', storeCode:'BJ001', storeName:'北京朝阳店', purchaseNo:'CG202505013A', supplier:'配件供应商A', returnDate:'2025-05-25', partCode:'P025', partName:'皮带', qty:1, price:90.00, amount:90.00, reason:'质量问题', status:'已审核', handler:'张三', remark:'老化开裂', costUnit:'条', costTotal:90.00, warehouse:'传动系统仓库A', location:'A-25'}
    ];
    var prdFilteredData = [];
    var prdCurrentPage = 1;
    var prdPageSize = 20;
    var prdFilterExpanded = false;
    var prdInitialized = false;

    // 初始化函数
    function initPrd() {
      if (!prdInitialized) {
        prdInitialized = true;
        // 出库日期默认：上个月的今天 ~ 今天
        var now = new Date();
        var startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (startDate.getMonth() !== ((now.getMonth() - 1 + 12) % 12)) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        var ds = startDate.toISOString().split('T')[0];
        var de = now.toISOString().split('T')[0];
        var startEl = document.getElementById('prd-flt-date-start');
        var endEl = document.getElementById('prd-flt-date-end');
        if (startEl) startEl.value = ds;
        if (endEl) endEl.value = de;
        var textEl = document.querySelector('#page-purchase-return-detail .lt-date-range-text');
        if (textEl) textEl.value = ds + '-' + de;
      }
      prdFilteredData = [...prdAllData];
      prdRenderTable();
    }

    function prdRenderTable() {
      var start = (prdCurrentPage - 1) * prdPageSize;
      var pageData = prdFilteredData.slice(start, start + prdPageSize);
      var tbody = document.getElementById('prd-tbody');
      tbody.innerHTML = pageData.map(function(r, idx) {
        return '<tr>' +
          '<td class="sticky col-seq">' + (start + idx + 1) + '</td>' +
          '<td class="sticky col-return-no">' + r.returnNo + '</td>' +
          '<td class="col-store-name">' + r.storeName + '</td>' +
          '<td class="col-store-code">' + r.storeCode + '</td>' +
          '<td class="col-purchase-no">' + r.purchaseNo + '</td>' +
          '<td class="col-part-code">' + r.partCode + '</td>' +
          '<td class="col-part-name">' + r.partName + '</td>' +
          '<td class="col-return-qty">' + r.qty + '</td>' +
          '<td class="col-price">' + r.price + '</td>' +
          '<td class="col-amount">' + r.amount + '</td>' +
          '<td class="col-cost-unit">' + r.costUnit + '</td>' +
          '<td class="col-cost-total">' + r.costTotal + '</td>' +
          '<td class="col-out-status">' + r.status + '</td>' +
          '<td class="col-out-no">' + r.purchaseNo + '</td>' +
          '<td class="col-out-time">' + r.returnDate + '</td>' +
          '<td class="col-warehouse">' + (r.warehouse || '') + '</td>' +
          '<td class="col-location">' + (r.location || '') + '</td>' +
          '<td class="col-remark">' + r.remark + '</td>' +
          '</tr>';
      }).join('');
      var total = prdFilteredData.length;
      document.getElementById('prd-pg-total').textContent = '共 ' + total + ' 条';
      prdRenderPages();
    }

    function prdRenderPages() {
      var totalPages = Math.ceil(prdFilteredData.length / prdPageSize) || 1;
      var pages = document.getElementById('prd-pg-pages');
      var html = '';
      for (var i = 1; i <= totalPages; i++) {
        html += i === prdCurrentPage
          ? '<button class="active" onclick="prdGoPage(' + i + ')">' + i + '</button>'
          : '<button onclick="prdGoPage(' + i + ')">' + i + '</button>';
      }
      pages.innerHTML = html;
      document.getElementById('prd-pg-prev').disabled = prdCurrentPage === 1;
      document.getElementById('prd-pg-next').disabled = prdCurrentPage >= totalPages;
    }

    function prdGoPage(p) { prdCurrentPage = p; prdRenderTable(); }
    function prdChangePage(delta) { prdGoPage(Math.max(1, Math.min(prdCurrentPage + delta, Math.ceil(prdFilteredData.length / prdPageSize) || 1))); }
    function prdChangePageSize(size) { prdPageSize = parseInt(size); prdCurrentPage = 1; prdRenderTable(); }
    function prdGotoPage(v) { var p = parseInt(v); if (p) prdGoPage(p); }

    function prdApplyFilter() {
      var partCode = (document.getElementById('prd-flt-part-code').value || '').toLowerCase();
      var partName = (document.getElementById('prd-flt-part-name').value || '').toLowerCase();
      var outStatus = document.getElementById('prd-flt-out-status').value || '';
      var returnNo = (document.getElementById('prd-flt-return-no').value || '').toLowerCase();
      var purchaseNo = (document.getElementById('prd-flt-purchase-no').value || '').toLowerCase();
      var outNo = (document.getElementById('prd-flt-out-no').value || '').toLowerCase();
      var store = (document.getElementById('prd-flt-store').value || '').toLowerCase();
      var region = (document.getElementById('prd-flt-region').value || '').toLowerCase();
      var district = (document.getElementById('prd-flt-district').value || '').toLowerCase();

      prdFilteredData = prdAllData.filter(function(row) {
        if (partCode && row.partCode.toLowerCase().indexOf(partCode) < 0) return false;
        if (partName && row.partName.toLowerCase().indexOf(partName) < 0) return false;
        if (outStatus && row.outStatus !== outStatus) return false;
        if (returnNo && row.returnNo.toLowerCase().indexOf(returnNo) < 0) return false;
        if (purchaseNo && row.purchaseNo.toLowerCase().indexOf(purchaseNo) < 0) return false;
        if (outNo && row.outNo.toLowerCase().indexOf(outNo) < 0) return false;
        if (store && row.storeName.toLowerCase().indexOf(store) < 0) return false;
        return true;
      });
      prdCurrentPage = 1;
      prdRenderTable();
    }

    function prdResetFilter() {
      document.getElementById('prd-flt-part-code').value = '';
      document.getElementById('prd-flt-part-name').value = '';
      document.getElementById('prd-flt-out-status').value = '';
      document.getElementById('prd-flt-return-no').value = '';
      document.getElementById('prd-flt-purchase-no').value = '';
      document.getElementById('prd-flt-out-no').value = '';
      document.getElementById('prd-flt-store').value = '';
      document.getElementById('prd-flt-region').value = '';
      document.getElementById('prd-flt-district').value = '';
      var startEl = document.getElementById('prd-flt-date-start');
      var endEl = document.getElementById('prd-flt-date-end');
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
      document.querySelectorAll('#page-purchase-return-detail .lt-date-range-text').forEach(function(el) { el.value = ''; });
      prdFilteredData = [...prdAllData];
      prdCurrentPage = 1;
      prdRenderTable();
    }

    function prdExportData() { alert('导出功能 - 将导出当前查询结果的 ' + prdFilteredData.length + ' 条数据'); }

    // Combobox 通用辅助函数
    function prdFilterCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      var val = input.value.toLowerCase();
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        var match = item.textContent.toLowerCase().includes(val);
        item.classList.toggle('hidden', !match);
      });
    }
    function prdShowCombobox(input) {
      var wrap = input.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (list) list.classList.add('show');
    }
    function prdToggleCombobox(arrow) {
      var wrap = arrow.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      list.classList.toggle('show');
      if (list.classList.contains('show')) {
        var input = wrap.querySelector('input');
        if (input) input.focus();
      }
    }
    function prdSelectCombobox(li) {
      var wrap = li.closest('.lt-input-wrap.combobox');
      if (!wrap) return;
      var input = wrap.querySelector('input');
      var list = wrap.querySelector('.lt-datalist');
      if (input) input.value = li.textContent;
      if (list) list.classList.remove('show');
      prdApplyFilter();
    }
    // 点击外部关闭所有 combobox 下拉
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.lt-input-wrap.combobox')) {
        document.querySelectorAll('#page-purchase-return-detail .lt-datalist.show').forEach(function(l) { l.classList.remove('show'); });
      }
    });

    // 展开/收起功能
    function prdToggleFilterMore() { prdFilterExpanded = !prdFilterExpanded; toggleFilterGrid('prd-filterGrid', prdFilterExpanded, PRD_SHOW_COUNT, '.lt-filter-more-toggle'); }

    // ===== 内部领用明细 JS =====
    var intAllData = [
      {usageNo:'LY202505001', storeName:'北京朝阳店', storeCode:'BJ001', dept:'维修部', applyPerson:'张三', reason:'维修更换', refNo:'RK202505001', type:'内部领用', partCode:'P001', partName:'机油滤清器', qty:2, price:150.00, amount:300.00, costPrice:85.00, costTotal:170.00, time:'2025-05-20 10:30', picker:'张三', warehouse:'配件仓库A', location:'A01-02', remark:''},
      {usageNo:'LY202505002', storeName:'上海浦东店', storeCode:'SH001', dept:'保养部', applyPerson:'李四', reason:'定期保养', refNo:'RK202505002', type:'内部领用', partCode:'P002', partName:'刹车片', qty:4, price:150.00, amount:600.00, costPrice:120.00, costTotal:480.00, time:'2025-05-21 14:20', picker:'李四', warehouse:'配件仓库B', location:'B02-01', remark:'急件'},
      {usageNo:'LY202505003', storeName:'广州天河店', storeCode:'GZ001', dept:'维修部', applyPerson:'王五', reason:'维修更换', refNo:'RK202505003', type:'内部退回', partCode:'P003', partName:'空气滤清器', qty:1, price:0.00, amount:0.00, costPrice:45.00, costTotal:45.00, time:'2025-05-22 09:15', picker:'王五', warehouse:'主仓库', location:'C01-03', remark:'退回入库'},
      {usageNo:'LY202505004', storeName:'武汉洪山店', storeCode:'WH001', dept:'保养部', applyPerson:'张三', reason:'保养服务', refNo:'RK202505004', type:'内部领用', partCode:'P001', partName:'机油滤清器', qty:3, price:150.00, amount:450.00, costPrice:85.00, costTotal:255.00, time:'2025-05-23 11:40', picker:'张三', warehouse:'主仓库', location:'A01-01', remark:''},
      {usageNo:'LY202505005', storeName:'深圳南山店', storeCode:'SZ001', dept:'配件部', applyPerson:'李四', reason:'配件领用', refNo:'RK202505005', type:'内部领用', partCode:'P004', partName:'火花塞', qty:8, price:50.00, amount:400.00, costPrice:35.00, costTotal:280.00, time:'2025-05-24 16:30', picker:'李四', warehouse:'配件仓库B', location:'B03-02', remark:'配件领用'},
      {usageNo:'LY202505006', storeName:'杭州西湖店', storeCode:'HZ001', dept:'维修部', applyPerson:'赵六', reason:'维修更换', refNo:'RK202505006', type:'内部领用', partCode:'P005', partName:'火花塞', qty:5, price:45.00, amount:225.00, costPrice:30.00, costTotal:150.00, time:'2025-05-25 09:15', picker:'赵六', warehouse:'配件仓库C', location:'C02-01', remark:'普通领用'},
      {usageNo:'LY202505007', storeName:'北京朝阳店', storeCode:'BJ001', dept:'保养部', applyPerson:'钱七', reason:'定期保养', refNo:'RK202505007', type:'内部领用', partCode:'P006', partName:'空调滤清器', qty:2, price:200.00, amount:400.00, costPrice:140.00, costTotal:280.00, time:'2025-05-25 10:45', picker:'钱七', warehouse:'配件仓库A', location:'A01-03', remark:'保养使用'},
      {usageNo:'LY202505008', storeName:'上海浦东店', storeCode:'SH001', dept:'维修部', applyPerson:'孙八', reason:'维修更换', refNo:'RK202505008', type:'内部领用', partCode:'P007', partName:'机油', qty:4, price:180.00, amount:720.00, costPrice:120.00, costTotal:480.00, time:'2025-05-25 11:20', picker:'孙八', warehouse:'配件仓库B', location:'B01-05', remark:'急件'},
      {usageNo:'LY202505009', storeName:'广州天河店', storeCode:'GZ001', dept:'配件部', applyPerson:'周九', reason:'配件领用', refNo:'RK202505009', type:'内部领用', partCode:'P008', partName:'雨刷片', qty:6, price:80.00, amount:480.00, costPrice:55.00, costTotal:330.00, time:'2025-05-25 13:30', picker:'周九', warehouse:'配件仓库C', location:'C03-02', remark:'普通领用'},
      {usageNo:'LY202505010', storeName:'武汉洪山店', storeCode:'WH001', dept:'维修部', applyPerson:'吴十', reason:'维修更换', refNo:'RK202505010', type:'内部领用', partCode:'P009', partName:'电池', qty:1, price:450.00, amount:450.00, costPrice:320.00, costTotal:320.00, time:'2025-05-25 14:15', picker:'吴十', warehouse:'配件仓库A', location:'A02-01', remark:'维修使用'},
      {usageNo:'LY202505011', storeName:'深圳南山店', storeCode:'SZ001', dept:'保养部', applyPerson:'郑一', reason:'定期保养', refNo:'RK202505011', type:'内部领用', partCode:'P010', partName:'空滤', qty:3, price:60.00, amount:180.00, costPrice:40.00, costTotal:120.00, time:'2025-05-25 15:20', picker:'郑一', warehouse:'配件仓库B', location:'B02-03', remark:'保养更换'},
      {usageNo:'LY202505012', storeName:'杭州西湖店', storeCode:'HZ001', dept:'维修部', applyPerson:'王二', reason:'维修更换', refNo:'RK202505012', type:'内部领用', partCode:'P011', partName:'刹车油', qty:2, price:120.00, amount:240.00, costPrice:85.00, costTotal:170.00, time:'2025-05-25 16:05', picker:'王二', warehouse:'配件仓库C', location:'C01-05', remark:'维修使用'},
      {usageNo:'LY202505013', storeName:'北京朝阳店', storeCode:'BJ001', dept:'配件部', applyPerson:'李三', reason:'配件领用', refNo:'RK202505013', type:'内部领用', partCode:'P012', partName:'灯泡', qty:10, price:25.00, amount:250.00, costPrice:18.00, costTotal:180.00, time:'2025-05-25 16:50', picker:'李三', warehouse:'配件仓库A', location:'A03-01', remark:'照明设备'},
      {usageNo:'LY202505014', storeName:'上海浦东店', storeCode:'SH001', dept:'维修部', applyPerson:'张四', reason:'维修更换', refNo:'RK202505014', type:'内部领用', partCode:'P013', partName:'皮带', qty:2, price:90.00, amount:180.00, costPrice:65.00, costTotal:130.00, time:'2025-05-25 17:25', picker:'张四', warehouse:'配件仓库B', location:'B01-08', remark:'发动机维修'},
      {usageNo:'LY202505015', storeName:'广州天河店', storeCode:'GZ001', dept:'保养部', applyPerson:'王五', reason:'定期保养', refNo:'RK202505015', type:'内部领用', partCode:'P014', partName:'变速箱油', qty:1, price:280.00, amount:280.00, costPrice:200.00, costTotal:200.00, time:'2025-05-25 18:00', picker:'王五', warehouse:'配件仓库C', location:'C02-05', remark:'保养使用'},
      {usageNo:'LY202505016', storeName:'武汉洪山店', storeCode:'WH001', dept:'维修部', applyPerson:'赵六', reason:'维修更换', refNo:'RK202505016', type:'内部领用', partCode:'P015', partName:'离合器片', qty:1, price:350.00, amount:350.00, costPrice:250.00, costTotal:250.00, time:'2025-05-25 18:30', picker:'赵六', warehouse:'配件仓库A', location:'A04-02', remark:'变速箱维修'},
      {usageNo:'LY202505017', storeName:'深圳南山店', storeCode:'SZ001', dept:'配件部', applyPerson:'钱七', reason:'配件领用', refNo:'RK202505017', type:'内部领用', partCode:'P016', partName:'火花塞', qty:4, price:50.00, amount:200.00, costPrice:35.00, costTotal:140.00, time:'2025-05-25 19:15', picker:'钱七', warehouse:'配件仓库B', location:'B03-04', remark:'发动机维修'},
      {usageNo:'LY202505018', storeName:'杭州西湖店', storeCode:'HZ001', dept:'维修部', applyPerson:'孙八', reason:'维修更换', refNo:'RK202505018', type:'内部领用', partCode:'P017', partName:'刹车片', qty:2, price:150.00, amount:300.00, costPrice:110.00, costTotal:220.00, time:'2025-05-25 20:00', picker:'孙八', warehouse:'配件仓库C', location:'C02-08', remark:'底盘维修'},
      {usageNo:'LY202505019', storeName:'北京朝阳店', storeCode:'BJ001', dept:'保养部', applyPerson:'周九', reason:'定期保养', refNo:'RK202505019', type:'内部领用', partCode:'P018', partName:'机油滤清器', qty:2, price:150.00, amount:300.00, costPrice:85.00, costTotal:170.00, time:'2025-05-25 20:45', picker:'周九', warehouse:'配件仓库A', location:'A01-04', remark:'保养更换'},
      {usageNo:'LY202505020', storeName:'上海浦东店', storeCode:'SH001', dept:'配件部', applyPerson:'吴十', reason:'配件领用', refNo:'RK202505020', type:'内部领用', partCode:'P019', partName:'雨刷片', qty:8, price:80.00, amount:640.00, costPrice:55.00, costTotal:440.00, time:'2025-05-25 21:30', picker:'吴十', warehouse:'配件仓库B', location:'B03-06', remark:'外观美容'},
      {usageNo:'LY202505021', storeName:'广州天河店', storeCode:'GZ001', dept:'维修部', applyPerson:'郑一', reason:'维修更换', refNo:'RK202505021', type:'内部领用', partCode:'P020', partName:'蓄电池', qty:1, price:380.00, amount:380.00, costPrice:270.00, costTotal:270.00, time:'2025-05-25 22:15', picker:'郑一', warehouse:'配件仓库C', location:'C04-01', remark:'电路维修'},
      {usageNo:'LY202505022', storeName:'武汉洪山店', storeCode:'WH001', dept:'保养部', applyPerson:'李三', reason:'定期保养', refNo:'RK202505022', type:'内部领用', partCode:'P021', partName:'空滤', qty:1, price:60.00, amount:60.00, costPrice:40.00, costTotal:40.00, time:'2025-05-25 23:00', picker:'李三', warehouse:'配件仓库A', location:'A02-03', remark:'保养更换'},
      {usageNo:'LY202505023', storeName:'深圳南山店', storeCode:'SZ001', dept:'维修部', applyPerson:'张四', reason:'维修更换', refNo:'RK202505023', type:'内部领用', partCode:'P022', partName:'刹车油', qty:3, price:120.00, amount:360.00, costPrice:85.00, costTotal:255.00, time:'2025-05-25 23:45', picker:'张四', warehouse:'配件仓库B', location:'B02-07', remark:'制动系统'},
      {usageNo:'LY202505024', storeName:'杭州西湖店', storeCode:'HZ001', dept:'配件部', applyPerson:'王五', reason:'配件领用', refNo:'RK202505024', type:'内部领用', partCode:'P023', partName:'灯泡', qty:5, price:25.00, amount:125.00, costPrice:18.00, costTotal:90.00, time:'2025-05-26 00:30', picker:'王五', warehouse:'配件仓库C', location:'C03-05', remark:'照明设备'},
      {usageNo:'LY202505025', storeName:'北京朝阳店', storeCode:'BJ001', dept:'维修部', applyPerson:'赵六', reason:'维修更换', refNo:'RK202505025', type:'内部领用', partCode:'P024', partName:'皮带', qty:1, price:90.00, amount:90.00, costPrice:65.00, costTotal:65.00, time:'2025-05-26 01:15', picker:'赵六', warehouse:'配件仓库A', location:'A04-04', remark:'发动机维修'},
      {usageNo:'LY202505026', storeName:'上海浦东店', storeCode:'SH001', dept:'保养部', applyPerson:'钱七', reason:'定期保养', refNo:'RK202505026', type:'内部领用', partCode:'P025', partName:'变速箱油', qty:2, price:280.00, amount:560.00, costPrice:200.00, costTotal:400.00, time:'2025-05-26 02:00', picker:'钱七', warehouse:'配件仓库B', location:'B02-09', remark:'保养使用'}
    ];
    var intFilteredData = [];
    var intCurrentPage = 1;
    var intPageSize = 20;
    var intFilterExpanded = false; // 仅筛选项 > 7 时需要
    var intInitialized = false;

    function intToggleFilter() { intFilterExpanded = !intFilterExpanded; toggleFilterGrid('int-filterGrid', intFilterExpanded, INT_SHOW_COUNT); }

    function intFilterCombobox(input) {
      // 模拟输入框搜索
      if (input.value) {
        input.classList.add('active');
      } else {
        input.classList.remove('active');
      }
    }

    function intShowCombobox(input) {
      var datalist = input.nextElementSibling.nextElementSibling;
      if (datalist) {
        datalist.style.display = 'block';
      }
    }

    function intToggleCombobox(span) {
      var input = span.previousElementSibling;
      var datalist = span.nextElementSibling;
      if (datalist.style.display === 'block') {
        datalist.style.display = 'none';
      } else {
        datalist.style.display = 'block';
        intShowCombobox(input);
      }
    }

    function intSelectCombobox(li) {
      var input = li.parentElement.previousElementSibling.previousElementSibling;
      input.value = li.textContent;
      input.classList.add('active');
      input.nextElementSibling.nextElementSibling.style.display = 'none';
    }

    function intRenderTable() {
      var start = (intCurrentPage - 1) * intPageSize;
      var pageData = intFilteredData.slice(start, start + intPageSize);
      var tbody = document.getElementById('int-tbody');
      if (!tbody) return;

      if (!pageData.length) {
        tbody.innerHTML = '<tr><td colspan="21" style="padding:30px;color:#999;">暂无数据</td></tr>';
        document.getElementById('int-pg-total').textContent = '共 0 条';
        document.getElementById('int-pg-pages').innerHTML = '';
        return;
      }

      tbody.innerHTML = pageData.map(function(row, i) {
        return '<tr>' +
          '<td class="sticky col-seq">' + (start + i + 1) + '</td>' +
          '<td class="sticky col-usage-no">' + row.usageNo + '</td>' +
          '<td class="col-store-name">' + row.storeName + '</td>' +
          '<td class="col-store-code">' + row.storeCode + '</td>' +
          '<td class="col-dept">' + row.dept + '</td>' +
          '<td class="col-apply-person">' + row.applyPerson + '</td>' +
          '<td class="col-reason">' + row.reason + '</td>' +
          '<td class="col-ref-no">' + row.refNo + '</td>' +
          '<td class="col-type">' + row.type + '</td>' +
          '<td class="col-part-code">' + row.partCode + '</td>' +
          '<td class="col-part-name">' + row.partName + '</td>' +
          '<td class="col-qty">' + row.qty + '</td>' +
          '<td class="col-price">' + row.price.toFixed(2) + '</td>' +
          '<td class="col-amount">' + row.amount.toFixed(2) + '</td>' +
          '<td class="col-cost-price">' + row.costPrice.toFixed(2) + '</td>' +
          '<td class="col-cost-total">' + row.costTotal.toFixed(2) + '</td>' +
          '<td class="col-time">' + row.time + '</td>' +
          '<td class="col-picker">' + row.picker + '</td>' +
          '<td class="col-warehouse">' + row.warehouse + '</td>' +
          '<td class="col-location">' + (row.location || '-') + '</td>' +
          '<td class="col-remark">' + (row.remark || '-') + '</td>' +
          '</tr>';
      }).join('');

      var total = intFilteredData.length;
      document.getElementById('int-pg-total').textContent = '共 ' + total + ' 条';
      intRenderPages();
    }

    function intRenderPages() {
      var totalPages = Math.ceil(intFilteredData.length / intPageSize) || 1;
      var pages = document.getElementById('int-pg-pages');
      var html = '';
      for (var i = 1; i <= totalPages; i++) {
        html += i === intCurrentPage
          ? '<button class="active" onclick="intGoPage(' + i + ')">' + i + '</button>'
          : '<button onclick="intGoPage(' + i + ')">' + i + '</button>';
      }
      pages.innerHTML = html;
      document.getElementById('int-pg-prev').disabled = intCurrentPage === 1;
      document.getElementById('int-pg-next').disabled = intCurrentPage >= totalPages;
    }

    function intGoPage(p) { intCurrentPage = p; intRenderTable(); }
    function intChangePage(delta) { intGoPage(Math.max(1, Math.min(intCurrentPage + delta, Math.ceil(intFilteredData.length / intPageSize) || 1))); }
    function intChangePageSize(size) { intPageSize = parseInt(size); intCurrentPage = 1; intRenderTable(); }
    function intGotoPage(v) { var p = parseInt(v); if (p) intGoPage(p); }

    function intApplyFilter() {
      var usageNo = (document.getElementById('int-flt-usage-no').value || '').toLowerCase();
      var storeName = (document.getElementById('int-flt-store').value || '').toLowerCase();
      var partCode = (document.getElementById('int-flt-part-code').value || '').toLowerCase();
      var partName = (document.getElementById('int-flt-part-name').value || '').toLowerCase();
      var picker = (document.getElementById('int-flt-picker').value || '').toLowerCase();
      var warehouse = document.getElementById('int-flt-warehouse').value || '';
      var reason = (document.getElementById('int-flt-reason').value || '').toLowerCase();
      var dept = (document.getElementById('int-flt-dept').value || '').toLowerCase();
      var type = document.getElementById('int-flt-type').value || '';

      intFilteredData = intAllData.filter(function(row) {
        if (usageNo && row.usageNo.toLowerCase().indexOf(usageNo) < 0) return false;
        if (storeName && row.storeName.toLowerCase().indexOf(storeName) < 0) return false;
        if (partCode && row.partCode.toLowerCase().indexOf(partCode) < 0) return false;
        if (partName && row.partName.toLowerCase().indexOf(partName) < 0) return false;
        if (picker && row.picker.toLowerCase().indexOf(picker) < 0) return false;
        if (warehouse && row.warehouse !== warehouse) return false;
        if (reason && row.reason.toLowerCase().indexOf(reason) < 0) return false;
        if (dept && row.dept.toLowerCase().indexOf(dept) < 0) return false;
        if (type && row.type !== type) return false;
        return true;
      });

      intCurrentPage = 1;
      intRenderTable();
    }

    function intResetFilter() {
      document.getElementById('int-flt-usage-no').value = '';
      document.getElementById('int-flt-store').value = '';
      document.getElementById('int-flt-part-code').value = '';
      document.getElementById('int-flt-part-name').value = '';
      document.getElementById('int-flt-picker').value = '';
      document.getElementById('int-flt-warehouse').value = '';
      document.getElementById('int-flt-reason').value = '';
      document.getElementById('int-flt-dept').value = '';
      document.getElementById('int-flt-type').value = '';
      var startEl = document.getElementById('int-flt-date-start');
      var endEl = document.getElementById('int-flt-date-end');
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
      document.querySelectorAll('#page-internal-usage-detail .lt-date-range-text').forEach(function(el) { el.value = ''; });
      intFilteredData = [...intAllData];
      intCurrentPage = 1;
      intRenderTable();
    }

    function intExportData() { alert('导出功能 - 将导出当前查询结果的 ' + intFilteredData.length + ' 条数据'); }

    function initInt() {
      if (!intInitialized) {
        intInitialized = true;
        // 默认日期：上个月的今天 ~ 今天
        var now = new Date();
        var startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (startDate.getMonth() !== ((now.getMonth() - 1 + 12) % 12)) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        var ds = startDate.toISOString().split('T')[0];
        var de = now.toISOString().split('T')[0];
        var startEl = document.getElementById('int-flt-date-start');
        var endEl = document.getElementById('int-flt-date-end');
        if (startEl) startEl.value = ds;
        if (endEl) endEl.value = de;
        var textEl = document.querySelector('#page-internal-usage-detail .lt-date-range-text');
        if (textEl) textEl.value = ds + '-' + de;
      }
      intFilteredData = [...intAllData];
      intRenderTable();
      initFilterGrid('int-filterGrid', INT_SHOW_COUNT);
    }

    // ===== 页面说明 抽屉 =====
    function togglePageDesc() {
      var d = document.getElementById('page-desc-drawer');
      var t = document.getElementById('page-desc-trigger');
      var isOpen = d.classList.contains('open');
      if (isOpen) {
        d.classList.remove('open');
        t.classList.remove('open');
      } else {
        d.classList.add('open');
        t.classList.add('open');
      }
    }
    function closePageDesc() {
      document.getElementById('page-desc-drawer').classList.remove('open');
      document.getElementById('page-desc-trigger').classList.remove('open');
    }
  
    // ===== 盘盈盘亏明细 JS =====
    var icdStores = [{code:'BJ001',name:'北京朝阳店'},{code:'SH001',name:'上海浦东店'},{code:'GZ001',name:'广州天河店'},{code:'WH001',name:'武汉洪山店'},{code:'SZ001',name:'深圳南山店'},{code:'HZ001',name:'杭州西湖店'}];
    var icdAllData = [];
    for (var ii = 0; ii < 20; ii++) {
      var idx = ii % 10;
      var st = icdStores[ii % 6];
      var statuses = ['盘盈','盘亏'];
      var status = statuses[ii % 2];
      var qty = status === '盘盈' ? (1 + ii % 8) : -(1 + ii % 5);
      var prices = [35,45,150,50,68,85,120,450,280,120];
      var price = prices[idx];
      var day = 20 + (ii % 6);
      var ioTime = '2025-05-' + (day < 10 ? '0' + day : day) + ' ' + (8 + ii % 10) + ':00:00';
      var warehouses = ['中心仓','上海仓','广州仓','武汉仓','深圳仓','杭州仓'];
      var positions = ['A-01-01','A-01-02','B-02-01','B-02-02','C-03-01'];
      icdAllData.push({id:ii+1,checkNo:'PD20250'+(1001+ii),storeName:st.name,storeCode:st.code,code:'P'+(101+idx).toString().substr(1),name:['机油滤清器','空气滤清器','刹车片','火花塞','雨刮器','机油','变速箱油','轮胎','减震器','空调滤清器'][idx],diffQty:qty,price:price,amount:Math.abs(qty)*price,ioTime:ioTime,warehouse:warehouses[ii%6],position:positions[ii%5],remark:'',status:status,ioNo:'IO20250'+(1001+ii),region:['华北区','华东区','华南区','华中区','华南区','华东区'][ii%6],district:['北京区','上海区','广州区','武汉区','深圳区','杭州区'][ii%6]});
    }
    var icdFilteredData = [];
    var icdCurrentPage = 1;
    var icdPageSize = 20;
    var icdFilterExpanded = false;
    var icdInitialized = false;

    function initIcd() {
      if (!icdInitialized) {
        icdInitialized = true;
        var now = new Date();
        var startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (startDate.getMonth() !== ((now.getMonth() - 1 + 12) % 12)) { startDate = new Date(now.getFullYear(), now.getMonth(), 0); }
        var ds = startDate.toISOString().split('T')[0];
        var de = now.toISOString().split('T')[0];
        var startEl = document.getElementById('icd-flt-date-start');
        var endEl = document.getElementById('icd-flt-date-end');
        if (startEl) startEl.value = ds;
        if (endEl) endEl.value = de;
        var textEl = document.querySelector('#page-inventory-check-detail .lt-date-range-text');
        if (textEl) textEl.value = ds + '-' + de;
      }
      icdFilteredData = icdAllData.slice();
      icdRenderTable();
      initFilterGrid('icd-filterGrid', ICD_SHOW_COUNT);
    }

    function icdRenderTable() {
      var start = (icdCurrentPage - 1) * icdPageSize;
      var pageData = icdFilteredData.slice(start, start + icdPageSize);
      var tbody = document.getElementById('icd-tbody');
      var rows = [];
      for (var k = 0; k < pageData.length; k++) {
        var r = pageData[k];
        var rIdx = start + k + 1;
        rows.push('<tr><td class="sticky col-seq">' + rIdx + '</td><td class="sticky col-check-no">' + r.checkNo + '</td><td class="col-store-name">' + r.storeName + '</td><td class="col-store-code">' + r.storeCode + '</td><td class="col-code">' + r.code + '</td><td class="col-name">' + r.name + '</td><td class="col-diff-qty">' + r.diffQty + '</td><td class="col-price">' + r.price + '</td><td class="col-amount">' + r.amount + '</td><td class="col-io-time">' + r.ioTime + '</td><td class="col-warehouse">' + r.warehouse + '</td><td class="col-position">' + r.position + '</td><td class="col-remark">' + r.remark + '</td></tr>');
      }
      tbody.innerHTML = rows.join('');
      document.getElementById('icd-pg-total').textContent = '共 ' + icdFilteredData.length + ' 条';
      icdRenderPages();
    }

    function icdRenderPages() {
      var totalPages = Math.ceil(icdFilteredData.length / icdPageSize) || 1;
      var pages = document.getElementById('icd-pg-pages');
      var html = '';
      for (var i = 1; i <= totalPages; i++) {
        html += i === icdCurrentPage ? '<button class="active" onclick="icdGoPage(' + i + ')">' + i + '</button>' : '<button onclick="icdGoPage(' + i + ')">' + i + '</button>';
      }
      pages.innerHTML = html;
      document.getElementById('icd-pg-prev').disabled = icdCurrentPage === 1;
      document.getElementById('icd-pg-next').disabled = icdCurrentPage >= totalPages;
    }

    function icdGoPage(p) { icdCurrentPage = p; icdRenderTable(); }
    function icdChangePage(delta) { icdGoPage(Math.max(1, Math.min(icdCurrentPage + delta, Math.ceil(icdFilteredData.length / icdPageSize) || 1))); }
    function icdChangePageSize(size) { icdPageSize = parseInt(size); icdCurrentPage = 1; icdRenderTable(); }
    function icdGotoPage(v) { var p = parseInt(v); if (p) icdGoPage(p); }

    function icdApplyFilter() {
      icdFilteredData = icdAllData.filter(function(r) {
        var partCode = document.getElementById('icd-flt-part-code').value.trim().toLowerCase();
        var partName = document.getElementById('icd-flt-part-name').value.trim().toLowerCase();
        var status = document.getElementById('icd-flt-status').value;
        var checkNo = document.getElementById('icd-flt-check-no').value.trim().toLowerCase();
        var ioNo = document.getElementById('icd-flt-io-no').value.trim().toLowerCase();
        var ds = document.getElementById('icd-flt-date-start').value;
        var de = document.getElementById('icd-flt-date-end').value;
        var region = document.getElementById('icd-flt-region').value.trim();
        var district = document.getElementById('icd-flt-district').value.trim();
        var store = document.getElementById('icd-flt-store').value.trim().toLowerCase();
        if (partCode && r.code.toLowerCase().indexOf(partCode) < 0) return false;
        if (partName && r.name.toLowerCase().indexOf(partName) < 0) return false;
        if (status && r.status !== status) return false;
        if (checkNo && r.checkNo.toLowerCase().indexOf(checkNo) < 0) return false;
        if (ioNo && r.ioNo.toLowerCase().indexOf(ioNo) < 0) return false;
        if (ds && r.ioTime < ds) return false;
        if (de && r.ioTime > de + ' 23:59:59') return false;
        if (region && r.region !== region) return false;
        if (district && r.district !== district) return false;
        if (store && r.storeName.toLowerCase().indexOf(store) < 0 && r.storeCode.toLowerCase().indexOf(store) < 0) return false;
        return true;
      });
      icdCurrentPage = 1;
      icdRenderTable();
    }

    function icdResetFilter() {
      document.getElementById('icd-flt-part-code').value = '';
      document.getElementById('icd-flt-part-name').value = '';
      document.getElementById('icd-flt-status').value = '';
      document.getElementById('icd-flt-check-no').value = '';
      document.getElementById('icd-flt-io-no').value = '';
      document.getElementById('icd-flt-region').value = '';
      document.getElementById('icd-flt-district').value = '';
      document.getElementById('icd-flt-store').value = '';
      icdFilteredData = icdAllData.slice();
      icdCurrentPage = 1;
      icdRenderTable();
    }

    function icdExportData() { alert('导出'); }

    function icdFilterCombobox(input) { var wrap = input.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (!list) return; var val = input.value.toLowerCase(); var its = list.querySelectorAll('li'); for (var m = 0; m < its.length; m++) { its[m].classList.toggle('hidden', !its[m].textContent.toLowerCase().includes(val)); } }
    function icdShowCombobox(input) { var wrap = input.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (list) list.classList.add('show'); }
    function icdToggleCombobox(arrow) { var wrap = arrow.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (!list) return; list.classList.toggle('show'); if (list.classList.contains('show')) { var inp = wrap.querySelector('input'); if (inp) inp.focus(); } }
    function icdSelectCombobox(li) { var wrap = li.closest('.lt-input-wrap.combobox'); if (!wrap) return; var inp = wrap.querySelector('input'); var list = wrap.querySelector('.lt-datalist'); if (inp) inp.value = li.textContent; if (list) list.classList.remove('show'); icdApplyFilter(); }
    document.addEventListener('click', function(e) { if (!e.target.closest('.lt-input-wrap.combobox')) { var shows = document.querySelectorAll('#page-inventory-check-detail .lt-datalist.show'); for (var n = 0; n < shows.length; n++) { shows[n].classList.remove('show'); } } });

    function icdToggleFilter() { icdFilterExpanded = !icdFilterExpanded; toggleFilterGrid('icd-filterGrid', icdFilterExpanded, ICD_SHOW_COUNT); }

    // ==================== 技术支持 模块 ====================
    var tsAllData = [];
    var tsFilteredData = [];
    var tsCurrentPage = 1;
    var tsRepairPartsMap = {};  // 维修工单号 -> 配件列表
    var tsPageSize = 20;
    var tsFilterExpanded = false;
    var tsPanelMode = 'add'; // add / edit / detail
    var tsPanelRole = 'store'; // store / hq
    var tsStatuses = ['待提交', '待技术援助答复', '已关单', '已作废'];
    var tsCurrentItem = null;
    var tsArchiveData = {
      '专项': {
        '异响专项': ['空调异响（出风口蒸发器）', '电机异响（前驱电机）', '减速器异响'],
        '漏液专项': ['冷却液泄漏', '制动液泄漏'],
        '抖动专项': ['怠速抖动', '高速抖动']
      },
      '一般维修': {
        '保养类': ['首保', '二保', '常规保养'],
        '维修类': ['一般维修', '事故维修']
      },
      '质量反馈': {
        '批量问题': ['批量异响', '批量漏液'],
        '个例问题': ['个例异响', '个例漏液']
      }
    };

    (function initTsMockData() {
      // '已退回' 已废弃，不再使用
      var statuses = ['待提交','待提交','待技术援助答复','待技术援助答复','已关单','已关单','已作废'/*,'已退废弃'*/];
      var stores = ['深圳福田店','广州天河店','上海浦东店','北京朝阳店','成都武侯店','武汉洪山店','杭州西湖店','南京鼓楼店'];
      var storeCodes = ['SZFT001','GZTH002','SHPD003','BJCH004','CDWH005','WHHS006','HZXH007','NJGL008'];
      var provinces = ['广东','广东','上海','北京','四川','湖北','浙江','江苏'];
      var cities = ['深圳','广州','上海','北京','成都','武汉','杭州','南京'];
      var carSeries = ['秦PLUS','宋Pro','汉EV','唐DM-i','海豹','元PLUS','驱逐舰05','海豚'];
      var carModels = ['2024款 DM-i','2025款 EV','2024款 四驱','2025款 尊贵型'];
      var faultSystems = ['发动机系统','变速箱系统','制动系统','转向系统','电气系统','空调系统','底盘系统'];
      var faultNatures = ['产品质量','使用问题','维修导致'];
      var archiveCategories = ['发动机','变速箱','电气','底盘','车身'];
      var subjects = ['发动机异响严重','变速箱换挡顿挫','刹车时有尖锐异响','方向盘转向发沉','中控屏幕黑屏','空调制冷效果差','底盘有异响','高速行驶车身抖动'];
      var vins = ['LC0C76C4XM0001234','LGXC16DF8M0002567','LBEKBGKA0MZ003890','LLV3B2A15M0004456','LGWEE7A5XM0006721','LMGA425B1M0008891','LHGCR2650M0009903','LJ12FKS24M0011230'];
      for (var i = 0; i < 42; i++) {
        var idx = i % 8;
        var d = new Date();
        d.setDate(d.getDate() - i * 3);
        var ds = d.toISOString().split('T')[0];
        tsAllData.push({
          id:i+1, orderNo:'TS2026' + String(i+1).padStart(4,'0'), status:statuses[i%statuses.length],
          province:provinces[idx], city:cities[idx], storeName:stores[idx], storeCode:storeCodes[idx],
          submitDate:ds, carSeries:carSeries[idx], subject:subjects[idx],
          archiveCategory:archiveCategories[i%5], vin:vins[idx],
          faultDate:ds, faultSystem:faultSystems[i%7], faultNature:faultNatures[i%3],
          prodDate:'2024-0'+(i%9+1)+'-'+String((i%28)+1).padStart(2,'0'),
          carModel:carModels[i%4], applyType:'故障诊断', needAssist:i%3===0?'是':'否',
          importance:['A','B','C','D'][i%4],
          repairOrder: i%3!==0 ? 'RO2026'+String(i+1).padStart(4,'0') : '',
          repairParts: tsGenerateRepairParts(i%3!==0 ? 'RO2026'+String(i+1).padStart(4,'0') : ''),
          complaintOrder: i%5!==0 ? 'CO2026'+String(i+1).padStart(4,'0') : '',
          warningOrder: i%4!==0 ? 'WO2026'+String(i+1).padStart(4,'0') : '',
          // 已关单的数据加关单信息
          closeUser: (statuses[i%statuses.length] === '已关单') ? ['张三','李四','王五'][i%3] : '',
          closeTime: (statuses[i%statuses.length] === '已关单') ? '2026-06-' + String((i%28)+1).padStart(2,'0') + ' 14:30:00' : '',
          archiveCat1: (statuses[i%statuses.length] === '已关单') ? ['专项','一般维修','质量反馈'][i%3] : '',
          archiveCat2: (statuses[i%statuses.length] === '已关单') ? ['异响专项','保养类','批量问题'][i%3] : '',
          archiveCat3: (statuses[i%statuses.length] === '已关单') ? ['空调异响（出风口蒸发器）','首保','批量异响'][i%3] : '',
          conclusion: (statuses[i%statuses.length] === '已关单') ? '已处理完成，故障已排除。' : '',
          pdiOrder: i%6!==0 ? 'PDI2026'+String(i+1).padStart(4,'0') : '',
          isPdi: i%7===0 ? '是' : '否',
          vehicleVersion: 'V'+(i%3+1)+'.0.'+(i%10)+'.'+(i*17%1000).toString().padStart(3,'0'),
          latestOtaTime: (function(){ var ota=new Date(d); ota.setDate(ota.getDate()-i*5); return ota.toISOString().split('T')[0]; })(),
          faultPartCode: 'FP'+String(1000+i*7).padStart(6,'0'),
          faultPartName: ['连杆总成','刹车片','空调压缩机','转向器','中控屏','电池模组','传感器','减震器'][i%8],
          faultDescription: ['P001-大屏无显示','P002-大屏偶发无网络','P003-音响无声音','P004-空调不制冷','P005-转向异响','P006-刹车偏软','P007-电机抖动','P008-充电缓慢'][i%8],
          customerComplaint: '客户反映'+subjects[idx]+'，多次出现，影响日常使用，已到店检查。',
          faultCondition: '故障发生在车辆行驶/启动/怠速等条件下，现象：'+subjects[idx]+'，经初步检查发现异常，需进一步检测确认。',
          repairSolution: '1. 拆卸相关部件进行专项检测；2. 更换故障件并测试；3. 复检确认问题是否解决；4. 跟踪3天确认稳定性。',
          causeAnalysis: '根据故障码和检查结果，初步判断为相关部件老化或异常磨损导致，需拆解后进一步确认具体损伤程度。',
          suggestion: '建议更换故障件后跟踪观察至少1周，确认故障不再复现。如批次性问题，建议汇总后反馈供应商。',
          hasFaultCode: i%3===0?'是':'否',
          faultCode: i%3===0?'P00'+String(i+1).padStart(2,'0') : '',
          hasRepairCase: i%4===0?'是':'否',
          repairCaseNo: i%4===0?'RC2026'+String(i+1).padStart(4,'0') : ''
        });
      }
      tsFilteredData = tsAllData.slice();
    })();

    // ⚠ 修改注意事项：TS_SHOW_COUNT = 默认显示的筛选器数量（索引0~N-1显示，N及以后隐藏）
    // for (var i = TS_SHOW_COUNT; ...) 表示隐藏第 TS_SHOW_COUNT 个及以后的筛选器
    var TS_SHOW_COUNT = 7;
    function initTs() { tsFilteredData = tsAllData.slice(); tsCurrentPage = 1; tsRenderTable(); initFilterGrid('ts-filterGrid', TS_SHOW_COUNT); var sel = document.getElementById('ts-flt-status'); if (sel) { sel.innerHTML = '<option value="">全部</option>'; tsStatuses.forEach(function(s) { sel.innerHTML += '<option>' + s + '</option>'; }); } }
    function tsGetFiltered() {
      var orderNo = (document.getElementById('ts-flt-order-no')||{}).value || '';
      var carSeriesV = (document.getElementById('ts-flt-car-series')||{}).value || '';
      var carModel = (document.getElementById('ts-flt-car-model')||{}).value || '';
      var vin = (document.getElementById('ts-flt-vin')||{}).value || '';
      var subject = (document.getElementById('ts-flt-subject')||{}).value || '';
      var faultStart = (document.getElementById('ts-flt-fault-start')||{}).value || '';
      var faultEnd = (document.getElementById('ts-flt-fault-end')||{}).value || '';
      var faultSystem = (document.getElementById('ts-flt-fault-system')||{}).value || '';
      var faultNature = (document.getElementById('ts-flt-fault-nature')||{}).value || '';
      var prodStart = (document.getElementById('ts-flt-prod-start')||{}).value || '';
      var prodEnd = (document.getElementById('ts-flt-prod-end')||{}).value || '';
      var submitStart = (document.getElementById('ts-flt-submit-start')||{}).value || '';
      var submitEnd = (document.getElementById('ts-flt-submit-end')||{}).value || '';
      var status = (document.getElementById('ts-flt-status')||{}).value || '';
      var archiveCategory = (document.getElementById('ts-flt-archive-category')||{}).value || '';
      var importance = (document.getElementById('ts-flt-importance')||{}).value || '';
      var repairOrder = (document.getElementById('ts-flt-repair-order')||{}).value || '';
      var complaintOrder = (document.getElementById('ts-flt-complaint-order')||{}).value || '';
      var isPdi = (document.getElementById('ts-flt-is-pdi')||{}).value || '';
      var pdiOrder = (document.getElementById('ts-flt-pdi-order')||{}).value || '';
      var alarmOrder = (document.getElementById('ts-flt-alarm-order')||{}).value || '';
      return tsAllData.filter(function(r) {
        if (orderNo && r.orderNo.toLowerCase().indexOf(orderNo.toLowerCase()) < 0) return false;
        if (carSeriesV && r.carSeries.toLowerCase().indexOf(carSeriesV.toLowerCase()) < 0) return false;
        if (carModel && r.carModel.toLowerCase().indexOf(carModel.toLowerCase()) < 0) return false;
        if (vin && r.vin.toLowerCase().indexOf(vin.toLowerCase()) < 0) return false;
        if (subject && r.subject.toLowerCase().indexOf(subject.toLowerCase()) < 0) return false;
        if (faultStart && r.faultDate < faultStart) return false;
        if (faultEnd && r.faultDate > faultEnd) return false;
        if (faultSystem && r.faultSystem !== faultSystem) return false;
        if (faultNature && r.faultNature !== faultNature) return false;
        if (prodStart && r.prodDate < prodStart) return false;
        if (prodEnd && r.prodDate > prodEnd) return false;
        if (submitStart && r.submitDate < submitStart) return false;
        if (submitEnd && r.submitDate > submitEnd) return false;
        if (status && r.status !== status) return false;
        if (archiveCategory && r.archiveCategory !== archiveCategory) return false;
        if (importance && r.importance !== importance) return false;
        if (repairOrder && r.repairOrder.toLowerCase().indexOf(repairOrder.toLowerCase()) < 0) return false;
        if (complaintOrder && r.complaintOrder.toLowerCase().indexOf(complaintOrder.toLowerCase()) < 0) return false;
        if (isPdi && r.isPdi !== isPdi) return false;
        if (pdiOrder && r.pdiOrder.toLowerCase().indexOf(pdiOrder.toLowerCase()) < 0) return false;
        if (alarmOrder && r.alarmOrder.toLowerCase().indexOf(alarmOrder.toLowerCase()) < 0) return false;
        return true;
      });
    }
    function tsApplyFilter() { tsFilteredData = tsGetFiltered(); tsCurrentPage = 1; tsRenderTable(); }
    function tsResetFilter() {
      var ids = ['ts-flt-order-no','ts-flt-car-series','ts-flt-car-model','ts-flt-vin','ts-flt-subject','ts-flt-fault-start','ts-flt-fault-end','ts-flt-fault-system','ts-flt-fault-nature','ts-flt-prod-start','ts-flt-prod-end','ts-flt-submit-start','ts-flt-submit-end','ts-flt-status','ts-flt-archive-category','ts-flt-importance','ts-flt-repair-order','ts-flt-complaint-order','ts-flt-is-pdi','ts-flt-pdi-order','ts-flt-alarm-order'];
      ids.forEach(function(id) { var el = document.getElementById(id); if (el) { if (el.tagName==='SELECT') el.value=''; else el.value=''; } });
      tsFilteredData = tsAllData.slice(); tsCurrentPage = 1; tsRenderTable();
    }
    function tsRenderTable() {
      var tbody = document.getElementById('ts-tbody'); if (!tbody) return;
      var start = (tsCurrentPage - 1) * tsPageSize, end = start + tsPageSize;
      var page = tsFilteredData.slice(start, end);
      var h = '';
      for (var i = 0; i < page.length; i++) {
        var r = page[i], idx = start + i + 1;
        var ops = '';
        if (r.status === '待提交') ops = '<a href="javascript:void(0)" onclick="tsOpenEdit('+r.id+')">修改</a><span class="sep">|</span><a href="javascript:void(0)" onclick="tsCancelOrder('+r.id+')">作废</a><span class="sep">|</span><a href="javascript:void(0)" onclick="tsSubmitOrder('+r.id+')">提交</a><span class="sep">|</span><a href="javascript:void(0)" onclick="tsOpenDetail('+r.id+')">详情</a>';
        else ops = '<a href="javascript:void(0)" onclick="tsOpenDetail('+r.id+')">详情</a>';
        h += '<tr><td class="sticky col-seq">'+idx+'</td><td class="sticky col-order-no">'+(r.orderNo||'')+'</td><td class="sticky col-status">'+(r.status||'')+'</td><td class="col-province">'+(r.province||'')+'</td><td class="col-city">'+(r.city||'')+'</td><td class="col-store-name">'+(r.storeName||'')+'</td><td class="col-store-code">'+(r.storeCode||'')+'</td><td class="col-submit-date">'+(r.submitDate||'')+'</td><td class="col-car-series">'+(r.carSeries||'')+'</td><td class="col-subject">'+(r.subject||'')+'</td><td class="col-importance">'+(r.importance||'')+'</td><td class="col-repair-order">'+(r.repairOrder||'')+'</td><td class="col-complaint-order">'+(r.complaintOrder||'')+'</td><td class="col-pdi-order">'+(r.pdiOrder||'')+'</td><td class="col-alarm-order">'+(r.alarmOrder||'')+'</td><td class="col-archive-category">'+(r.archiveCategory||'')+'</td><td class="col-vin">'+(r.vin||'')+'</td><td class="col-fault-date">'+(r.faultDate||'')+'</td><td class="col-fault-system">'+(r.faultSystem||'')+'</td><td class="col-fault-nature">'+(r.faultNature||'')+'</td><td class="col-prod-date">'+(r.prodDate||'')+'</td><td class="sticky col-actions"><div class="op-links">'+ops+'</div></td></tr>';
      }
      tbody.innerHTML = h;
      tsRenderPager();
    }
    function tsRenderPager() {
      var total = tsFilteredData.length, pages = Math.ceil(total / tsPageSize);
      document.getElementById('ts-pg-total').textContent = '共 ' + total + ' 条';
      document.getElementById('ts-pg-prev').disabled = tsCurrentPage <= 1;
      document.getElementById('ts-pg-next').disabled = tsCurrentPage >= pages;
      var pgH = '';
      for (var i = 1; i <= pages; i++) { pgH += '<span class="pg-num'+(i===tsCurrentPage?' active':'')+'" onclick="tsGotoPage('+i+')">'+i+'</span>'; }
      document.getElementById('ts-pg-pages').innerHTML = pgH;
    }
    function tsChangePage(delta) { var pages = Math.ceil(tsFilteredData.length / tsPageSize); tsCurrentPage = Math.max(1, Math.min(pages, tsCurrentPage + delta)); tsRenderTable(); }
    function tsGotoPage(p) { var pages = Math.ceil(tsFilteredData.length / tsPageSize); tsCurrentPage = Math.max(1, Math.min(pages, parseInt(p)||1)); tsRenderTable(); }
    function tsChangePageSize(sz) { tsPageSize = parseInt(sz); tsCurrentPage = 1; tsRenderTable(); }
    function tsExportData() { alert('导出'); }
    function tsToggleFilter() { tsFilterExpanded = !tsFilterExpanded; toggleFilterGrid('ts-filterGrid', tsFilterExpanded, TS_SHOW_COUNT); }

    function tsSubmitOrder(id) {
      var item = tsAllData.find(function(r){return r.id===id;});
      if (item) { item.status = '待技术援助答复'; }
      tsFilteredData = tsGetFiltered(); tsRenderTable(); alert('提交成功，已转为待技术援助答复');
    }
    function tsCancelOrder(id) {
      if (!confirm('确认作废该工单？')) return;
      var item = tsAllData.find(function(r){return r.id===id;});
      if (item) { item.status = '已作废'; }
      tsFilteredData = tsGetFiltered(); tsRenderTable();
    }

    // 侧滑面板
    function tsPopulateTemplateSelect() {
      var sel = document.getElementById('ts-form-template');
      if (!sel) return;
      // 清除"不选择"之外的所有选项
      while (sel.options.length > 1) sel.remove(1);
      // 收集已启用模板的标题（去重）
      var names = [];
      (qrtAllData || []).forEach(function(r) {
        if (r.status === '启用' && r.name && names.indexOf(r.name) === -1) {
          names.push(r.name);
        }
      });
      names.forEach(function(name) {
        var opt = document.createElement('option');
        opt.textContent = name;
        opt.value = name;
        sel.appendChild(opt);
      });
    }
    function tsOpenAdd() {
      tsPanelMode = 'add'; tsPanelRole = 'store'; tsCurrentItem = null;
      tsClearPanelForm();
      // 固定字段自动带入
      var now = new Date();
      document.getElementById('ts-form-submit-date').value = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      document.getElementById('ts-form-store-name').value = '武汉龙阳大道店';
      document.getElementById('ts-form-store-code').value = '420101';
      document.getElementById('ts-form-city').value = '武汉';
      document.getElementById('ts-form-submitter').value = '张伟';
      document.getElementById('ts-form-contact-phone').value = '13800138000';
      tsPopulateTemplateSelect();
      document.getElementById('ts-panel-title').textContent = '技术支持';
      var badge = document.getElementById('ts-panel-badge');
      badge.textContent = '新增'; badge.className = 'ts-panel-mode-badge add';
      tsSetPanelReadonly(false);
      tsInitUploadDrag();
      tsUpdatePanelButtons();
      document.getElementById('ts-panel').classList.add('show');
      document.getElementById('ts-panel-overlay').classList.add('show');
    }
    function tsOpenEdit(id) {
      tsPanelMode = 'edit'; tsPanelRole = 'store';
      var item = tsAllData.find(function(r){return r.id===id;});
      tsCurrentItem = item;
      // 缓存维修配件数据
      if (item.repairStatusOrder) tsRepairPartsMap[item.repairStatusOrder] = item.repairParts || [];
      if (item.repairOrder) tsRepairPartsMap[item.repairOrder] = item.repairParts || [];
      tsFillPanelForm(item);
      tsInitUploadDrag();
      tsPopulateTemplateSelect();
      document.getElementById('ts-panel-title').textContent = '技术支持';
      var badge = document.getElementById('ts-panel-badge');
      badge.textContent = '编辑'; badge.className = 'ts-panel-mode-badge edit';
      tsSetPanelReadonly(false);
      tsUpdatePanelButtons();
      document.getElementById('ts-panel').classList.add('show');
      document.getElementById('ts-panel-overlay').classList.add('show');
    }
    function tsOpenDetail(id, role) {
      tsPanelMode = 'detail'; tsPanelRole = role || 'store';
      var src = role === 'hq' ? tsAllData : tsAllData;
      var item = src.find(function(r){return r.id===id;});
      tsCurrentItem = item;
      // 缓存维修配件数据
      if (item.repairStatusOrder) tsRepairPartsMap[item.repairStatusOrder] = item.repairParts || [];
      if (item.repairOrder) tsRepairPartsMap[item.repairOrder] = item.repairParts || [];
      tsFillPanelForm(item);
      tsInitUploadDrag();
      var prefix = role === 'hq' ? '总部技术支持处理' : '技术支持';
      document.getElementById('ts-panel-title').textContent = prefix;
      var badge = document.getElementById('ts-panel-badge');
      badge.textContent = '详情'; badge.className = 'ts-panel-mode-badge detail';
      tsSetPanelReadonly(true);
      tsUpdatePanelButtons();
      document.getElementById('ts-panel').classList.add('show');
      document.getElementById('ts-panel-overlay').classList.add('show');
    }
    function tsClosePanel() {
      document.getElementById('ts-panel').classList.remove('show');
      document.getElementById('ts-panel-overlay').classList.remove('show');
    }
    function tsClearPanelForm() {
      // 清空处理结论区块
      var closeUser = document.getElementById('ts-form-close-user');
      var closeTime = document.getElementById('ts-form-close-time');
      var conc = document.getElementById('ts-form-conclusion');
      if (closeUser) closeUser.value = '';
      if (closeTime) closeTime.value = '';
      if (conc) conc.value = '';
      var ac1 = document.getElementById('ts-form-archive-cat1');
      var ac2 = document.getElementById('ts-form-archive-cat2');
      var ac3 = document.getElementById('ts-form-archive-cat3');
      if (ac1) { ac1.innerHTML = '<option value="">请选择</option>'; }
      if (ac2) { ac2.innerHTML = '<option value="">请选择</option>'; }
      if (ac3) { ac3.innerHTML = '<option value="">请选择</option>'; }
      var ids = ['ts-form-order-no','ts-form-submit-date','ts-form-store-name','ts-form-store-code','ts-form-city','ts-form-submitter','ts-form-contact-phone','ts-form-repair-order','ts-form-complaint-order','ts-form-warning-order','ts-form-pdi-order','ts-form-vin','ts-form-car-series','ts-form-car-model','ts-form-body-color','ts-form-engine-no','ts-form-front-motor-no','ts-form-rear-motor-no','ts-form-front-motor-sn','ts-form-rear-motor-sn','ts-form-battery-model','ts-form-battery-sn','ts-form-vehicle-version','ts-form-latest-ota-time','ts-form-customer-name','ts-form-customer-phone','ts-form-prod-date','ts-form-delivery-date','ts-form-fault-date','ts-form-fault-mileage','ts-form-fault-part-code','ts-form-fault-part-reason','ts-form-subject','ts-form-fault-description','ts-form-fault-system','ts-form-customer-complaint','ts-form-fault-condition-full','ts-form-repair-solution','ts-form-cause-analysis','ts-form-suggestion','ts-form-fault-code','ts-form-repair-case-no','ts-form-image-desc','ts-form-repair-status-order','ts-form-quality-check-time'];
      ids.forEach(function(id){ var el=document.getElementById(id); if(el){if(el.tagName==='SELECT')el.value='';else el.value='';} });
      var selIds = ['ts-form-importance','ts-form-part-info','ts-form-is-pdi','ts-form-repair-status-state','ts-form-has-fault-code','ts-form-has-repair-case'];
      // 清空图片和附件
      tsUploadedImages = [];
      tsUploadedFiles = [];
      var imgPreview = document.getElementById('ts-image-preview');
      if (imgPreview) imgPreview.innerHTML = '';
      var fileList = document.getElementById('ts-file-list');
      if (fileList) fileList.innerHTML = '';
      // 清空维修配件表格
      var rpBody = document.getElementById('ts-repair-parts-body');
      if (rpBody) rpBody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
      selIds.forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
    }
    function tsFillPanelForm(item) {
      if (!item) return;
      document.getElementById('ts-form-order-no').value = item.orderNo || '';
      document.getElementById('ts-form-submit-date').value = item.submitDate || '';
      document.getElementById('ts-form-store-name').value = item.storeName || '';
      document.getElementById('ts-form-store-code').value = item.storeCode || '';
      document.getElementById('ts-form-city').value = item.city || '';
      document.getElementById('ts-form-vin').value = item.vin || '';
      document.getElementById('ts-form-car-series').value = item.carSeries || '';
      document.getElementById('ts-form-car-model').value = item.carModel || '';
      document.getElementById('ts-form-prod-date').value = item.prodDate || '';
      document.getElementById('ts-form-fault-date').value = item.faultDate || '';
      document.getElementById('ts-form-subject').value = item.subject || '';
      document.getElementById('ts-form-repair-order').value = item.repairOrder || '';
      document.getElementById('ts-form-complaint-order').value = item.complaintOrder || '';
      document.getElementById('ts-form-warning-order').value = item.warningOrder || '';
      document.getElementById('ts-form-pdi-order').value = item.pdiOrder || '';
      if (document.getElementById('ts-form-is-pdi')) document.getElementById('ts-form-is-pdi').value = item.isPdi || '';
      document.getElementById('ts-form-vehicle-version').value = item.vehicleVersion || '';
      document.getElementById('ts-form-latest-ota-time').value = item.latestOtaTime || '';
      if (document.getElementById('ts-form-fault-system')) document.getElementById('ts-form-fault-system').value = item.faultSystem || '';
      if (document.getElementById('ts-form-fault-description')) document.getElementById('ts-form-fault-description').value = item.faultDescription || '';
      document.getElementById('ts-form-repair-status-order').value = item.repairStatusOrder || '';
      tsRenderRepairParts(item.repairStatusOrder || item.repairOrder || '');
      document.getElementById('ts-form-repair-status-state').value = item.repairStatusState || '';
      document.getElementById('ts-form-quality-check-time').value = item.qualityCheckTime || '';
      if (document.getElementById('ts-form-cause-analysis')) document.getElementById('ts-form-cause-analysis').value = item.causeAnalysis || '';
      if (document.getElementById('ts-form-suggestion')) document.getElementById('ts-form-suggestion').value = item.suggestion || '';
      if (document.getElementById('ts-form-has-fault-code')) document.getElementById('ts-form-has-fault-code').value = item.hasFaultCode || '';
      if (document.getElementById('ts-form-fault-code')) document.getElementById('ts-form-fault-code').value = item.faultCode || '';
      if (document.getElementById('ts-form-has-repair-case')) document.getElementById('ts-form-has-repair-case').value = item.hasRepairCase || '';
      if (document.getElementById('ts-form-repair-case-no')) document.getElementById('ts-form-repair-case-no').value = item.repairCaseNo || '';
      // 回填图片（详情模式）
      if (item.images && item.images.length) {
        tsUploadedImages = item.images.slice();
        tsRenderImagePreview();
      }
      // 回填附件（详情模式）
      if (item.files && item.files.length) {
        tsUploadedFiles = item.files.slice();
        tsRenderFileList();
      }
      // 回填处理结论及技术方案区块
      var closeUser = document.getElementById('ts-form-close-user');
      var closeTime = document.getElementById('ts-form-close-time');
      var conc = document.getElementById('ts-form-conclusion');
      if (closeUser) closeUser.value = item.closeUser || '';
      if (closeTime) closeTime.value = item.closeTime || '';
      if (conc) conc.value = item.conclusion || '';
      // 回填归档分类三级
      var ac1 = document.getElementById('ts-form-archive-cat1');
      var ac2 = document.getElementById('ts-form-archive-cat2');
      var ac3 = document.getElementById('ts-form-archive-cat3');
      if (ac1) {
        ac1.innerHTML = '<option value="">请选择</option>';
        for (var k in tsArchiveData) { ac1.innerHTML += '<option>' + k + '</option>'; }
        if (item.archiveCat1) {
          ac1.value = item.archiveCat1;
          ac2.innerHTML = '<option value="">请选择</option>';
          for (var k2 in tsArchiveData[item.archiveCat1]) { ac2.innerHTML += '<option>' + k2 + '</option>'; }
          if (item.archiveCat2) {
            ac2.value = item.archiveCat2;
            ac3.innerHTML = '<option value="">请选择</option>';
            tsArchiveData[item.archiveCat1][item.archiveCat2].forEach(function(v) { ac3.innerHTML += '<option>' + v + '</option>'; });
            if (item.archiveCat3) ac3.value = item.archiveCat3;
          }
        }
      }
      tsToggleFaultCode();
    }
    function tsSetPanelReadonly(readonly) {
      var panel = document.getElementById('ts-panel');
      var inputs = panel.querySelectorAll('input:not([type="button"]), select, textarea');
      var fixedReadonlyIds = ['ts-form-order-no','ts-form-submit-date','ts-form-store-name','ts-form-store-code','ts-form-city','ts-form-submitter','ts-form-car-series','ts-form-car-model','ts-form-body-color','ts-form-engine-no','ts-form-battery-model','ts-form-battery-sn','ts-form-front-motor-no','ts-form-rear-motor-no','ts-form-front-motor-sn','ts-form-rear-motor-sn','ts-form-vehicle-version','ts-form-latest-ota-time','ts-form-customer-name','ts-form-customer-phone','ts-form-prod-date','ts-form-delivery-date'];
      for (var i = 0; i < inputs.length; i++) {
        if (!readonly) {
          if (inputs[i].id === 'ts-form-contact-phone' && tsPanelMode==='detail') continue;
          if (fixedReadonlyIds.indexOf(inputs[i].id) !== -1) continue;
        }
        inputs[i].disabled = readonly;
        if (inputs[i].tagName==='INPUT' && inputs[i].type==='text') inputs[i].readOnly = readonly;
      }
      // 详情模式隐藏"选择模版"行；新增/编辑保留
      var hideItems = panel.querySelectorAll('[data-ts-hide-on="detail"]');
      hideItems.forEach(function(el){ el.style.display = (tsPanelMode === 'detail') ? 'none' : ''; });
      // "故障件维修情况"仅 HQ 详情显示；其他 5 种模式隐藏
      var repairSec = document.getElementById('ts-section-repair-status');
      if (repairSec) {
        repairSec.style.display = (tsPanelRole === 'hq' && tsPanelMode === 'detail') ? '' : 'none';
      }
    }
    function tsUpdatePanelButtons() {
      var topDiv = document.getElementById('ts-panel-actions');
      var bottomDiv = document.getElementById('ts-panel-bottom-actions');
      if (!topDiv || !bottomDiv) return;

      var status = (tsCurrentItem && tsCurrentItem.status) || '';
      var isHq = tsPanelRole === 'hq';

      var topBtns = '', bottomBtns = '';

      if (tsPanelMode === 'add') {
        topBtns = '<button class="lt-btn lt-btn-primary" onclick="tsSaveAndSubmit()">提交</button><button class="lt-btn lt-btn-default" onclick="tsSavePanel()">保存</button><button class="lt-btn lt-btn-default" onclick="alert(\'维修历史\')">维修历史</button>';
        bottomBtns = '';
      } else if (tsPanelMode === 'edit') {
        topBtns = '<button class="lt-btn lt-btn-primary" onclick="tsSaveAndSubmit()">提交</button><button class="lt-btn lt-btn-default" onclick="tsSavePanel()">保存</button><button class="lt-btn lt-btn-default" onclick="alert(\'维修历史\')">维修历史</button>';
        bottomBtns = '';
      } else if (tsPanelMode === 'detail') {
        if (isHq) {
          if (status === '待技术援助答复') {
            topBtns = '<button class="lt-btn" style="background:#185FA5;color:#fff" onclick="tsHqReply()">答复</button><button class="lt-btn" style="background:#c97a0a;color:#fff" onclick="tsHqReject()">退回修改</button><button class="lt-btn" style="background:#861B2F;color:#fff" onclick="tsHqClose()">关单</button>';
          }
        } else {
          if (status === '待提交') {
            topBtns = '<button class="lt-btn lt-btn-primary" onclick="tsSaveAndSubmit()">提交</button><button class="lt-btn lt-btn-default" onclick="tsOpenEdit(tsCurrentItem.id);tsClosePanel()">修改</button><button class="lt-btn lt-btn-default" onclick="tsCancelOrder(tsCurrentItem.id);tsClosePanel()">作废</button><button class="lt-btn lt-btn-default" onclick="alert(\'维修历史\')">维修历史</button>';
          } else if (status === '待技术援助答复') {
            topBtns = '<button class="lt-btn lt-btn-default" onclick="alert(\'维修开单\')">维修开单</button><button class="lt-btn lt-btn-default" onclick="alert(\'维修历史\')">维修历史</button>';
          } else if (status === '已关单') {
            topBtns = '<button class="lt-btn lt-btn-default" onclick="alert(\'维修开单\')">维修开单</button><button class="lt-btn lt-btn-default" onclick="alert(\'维修历史\')">维修历史</button><button class="lt-btn lt-btn-primary" onclick="tsConvertToReport()">转质量报告</button>';
            bottomBtns = '';
          } else if (status === '已作废' /* || status === '已退废弃' */) {
            topBtns = '<button class="lt-btn lt-btn-default" onclick="alert(\'维修历史\')">维修历史</button>';
          }
        }
      }
      topDiv.innerHTML = topBtns;
      bottomDiv.innerHTML = bottomBtns;
    }
    function tsSavePanel() {
      if (!tsCheckFaultCode()) return;
      alert('保存成功'); tsClosePanel();
    }
    function tsSaveAndSubmit() {
      if (!tsCheckFaultCode()) return;
      if (tsCurrentItem) { tsCurrentItem.status = '待技术援助答复'; }
      alert('提交成功'); tsClosePanel(); tsFilteredData = tsGetFiltered(); tsRenderTable();
    }
    // 故障代码必填校验
    function tsCheckFaultCode() {
      var hasCode = document.getElementById('ts-form-has-fault-code');
      var code = document.getElementById('ts-form-fault-code');
      if (hasCode && hasCode.value === '是' && code && !code.value.trim()) {
        alert('"有无显示故障码"为"是"时，故障代码为必填项');
        code.focus();
        return false;
      }
      return true;
    }
    function tsHqReply() { alert('答复已发送'); tsClosePanel(); }
    function tsHqReject() { alert('已退回修改'); tsClosePanel(); }
    // 处理结论区块内：归档分类三级联动
    function tsOnArchiveChange(level) {
      var sel1 = document.getElementById('ts-form-archive-cat1');
      var sel2 = document.getElementById('ts-form-archive-cat2');
      var sel3 = document.getElementById('ts-form-archive-cat3');
      if (level === 1) {
        sel2.innerHTML = '<option value="">请选择</option>';
        sel3.innerHTML = '<option value="">请选择</option>';
        if (sel1.value && tsArchiveData[sel1.value]) {
          for (var k in tsArchiveData[sel1.value]) { sel2.innerHTML += '<option>' + k + '</option>'; }
        }
      } else if (level === 2) {
        sel3.innerHTML = '<option value="">请选择</option>';
        if (sel1.value && sel2.value && tsArchiveData[sel1.value] && tsArchiveData[sel1.value][sel2.value]) {
          tsArchiveData[sel1.value][sel2.value].forEach(function(v) { sel3.innerHTML += '<option>' + v + '</option>'; });
        }
      }
    }
    function tsHqClose() {
      // 打开关单归档弹窗
      var overlay = document.getElementById('ts-close-modal-overlay');
      if (!overlay) { alert('关单弹窗未找到'); return; }
      // 初始化弹窗内归档分类一级下拉框
      var sel1 = document.getElementById('ts-close-archive1');
      if (sel1) {
        sel1.innerHTML = '<option value="">请选择</option>';
        for (var k in tsArchiveData) { sel1.innerHTML += '<option>' + k + '</option>'; }
        sel1.onchange = function() {
          var s1 = this.value, s2 = document.getElementById('ts-close-archive2');
          s2.innerHTML = '<option value="">请选择</option>';
          document.getElementById('ts-close-archive3').innerHTML = '<option value="">请选择</option>';
          if (s1 && tsArchiveData[s1]) {
            for (var k2 in tsArchiveData[s1]) { s2.innerHTML += '<option>' + k2 + '</option>'; }
          }
        };
      }
      var sel2 = document.getElementById('ts-close-archive2');
      if (sel2) {
        sel2.onchange = function() {
          var s1 = document.getElementById('ts-close-archive1').value;
          var s2v = this.value;
          var s3 = document.getElementById('ts-close-archive3');
          s3.innerHTML = '<option value="">请选择</option>';
          if (s1 && s2v && tsArchiveData[s1] && tsArchiveData[s1][s2v]) {
            tsArchiveData[s1][s2v].forEach(function(v) { s3.innerHTML += '<option>' + v + '</option>'; });
          }
        };
      }
      var conc = document.getElementById('ts-close-conclusion');
      if (conc) conc.value = '';
      overlay.style.display = 'flex';
    }
    function tsCloseCloseModal() {
      var overlay = document.getElementById('ts-close-modal-overlay');
      if (overlay) overlay.style.display = 'none';
    }
    function tsConfirmCloseOrder() {
      var s1 = document.getElementById('ts-close-archive1');
      var s2 = document.getElementById('ts-close-archive2');
      var s3 = document.getElementById('ts-close-archive3');
      var conc = document.getElementById('ts-close-conclusion');
      if (!s3 || !s3.value) { alert('请选择完整的归档分类（三级）'); return; }
      if (!conc || !conc.value.trim()) { alert('请输入处理结论及技术方案'); return; }
      if (tsCurrentItem) {
        tsCurrentItem.status = '已关单';
        tsCurrentItem.closeUser = '张三';  // 原型固定值
        var now = new Date();
        tsCurrentItem.closeTime = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
        tsCurrentItem.archiveCat1 = s1 ? s1.value : '';
        tsCurrentItem.archiveCat2 = s2 ? s2.value : '';
        tsCurrentItem.archiveCat3 = s3 ? s3.value : '';
        tsCurrentItem.conclusion = conc ? conc.value : '';
      }
      tsCloseCloseModal();
      tsClosePanel();
      tsFilteredData = tsGetFiltered();
      tsRenderTable();
    }
    // 转质量报告：关闭侧滑面板 → 跳转质量报告页 → 打开新增弹窗并预填字段
    function tsConvertToReport() {
      if (!tsCurrentItem) { alert('当前无数据可转'); return; }
      var src = tsCurrentItem;
      window.__qrPrefill = {
        orderNo: src.orderNo || '',
        carSeries: src.carSeries || '',
        carModel: src.carModel || '',
        vin: src.vin || '',
        faultSystem: src.faultSystem || '',
        faultNature: src.faultNature || '',
        subject: src.subject || '',
        archiveCategory: src.archiveCategory || '',
        faultPartCode: src.faultPartCode || '',
        faultPartName: src.faultPartName || '',
        importance: src.importance || '',
        problemDesc: src.customerComplaint || '',
        causeAnalysis: src.faultCondition || '',
        suggestion: src.repairSolution || ''
      };
      tsClosePanel();
      showContent('quality-report');
      setTimeout(function() {
        qrOpenAddWithPrefill(window.__qrPrefill);
      }, 50);
    }
    function tsOnFaultSystemChange() { /* 故障系统联动故障现象 */ }
    // 区块展开/收起
    function tsToggleSection(name) {
      var sec = document.getElementById('ts-section-' + name);
      if (!sec) return;
      sec.classList.toggle('collapsed');
    }

    // 故障件维修情况 - 工单状态联动质检时间
    function tsOnRepairStatusChange() {
      var st = document.getElementById('ts-form-repair-status-state');
      var qc = document.getElementById('ts-form-quality-check-time');
      if (!st || !qc) return;
      var v = st.value;
      if ((v === '质检完毕' || v === '结算进行中' || v === '已结算') && !qc.value) {
        var d = new Date();
        var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
        qc.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
                 + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      }
    }
    // ========== 图片/附件上传相关 ==========
    var tsUploadedImages = [];  // [{name, dataUrl}]
    var tsUploadedFiles = [];   // [{name, size}]

    function tsHandleImageUpload(files) {
      if (!files || !files.length) return;
      var maxCount = 5, maxSize = 10 * 1024 * 1024;
      for (var i = 0; i < files.length; i++) {
        if (tsUploadedImages.length >= maxCount) { alert('最多上传' + maxCount + '张图片'); break; }
        var f = files[i];
        var ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
        var extOk = ['.jpg','.jpeg','.png','.bmp'];
        if (extOk.indexOf(ext) === -1) { alert('图片格式不支持：' + f.name); continue; }
        if (f.size > maxSize) { alert('图片超大：' + f.name + '，单张≤10M'); continue; }
        (function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            tsUploadedImages.push({ name: file.name, dataUrl: e.target.result });
            tsRenderImagePreview();
          };
          reader.readAsDataURL(file);
        })(f);
      }
      var inp = document.getElementById('ts-image-input');
      if (inp) inp.value = '';
    }

    function tsHandleFileUpload(files) {
      if (!files || !files.length) return;
      var maxCount = 5, maxSize = 50 * 1024 * 1024;
      for (var i = 0; i < files.length; i++) {
        if (tsUploadedFiles.length >= maxCount) { alert('最多上传' + maxCount + '个附件'); break; }
        var f = files[i];
        if (f.size > maxSize) { alert('附件超大：' + f.name + '，单文件<50M'); continue; }
        tsUploadedFiles.push({ name: f.name, size: f.size });
      }
      tsRenderFileList();
      var inp = document.getElementById('ts-file-input');
      if (inp) inp.value = '';
    }

    function tsRenderImagePreview() {
      var wrap = document.getElementById('ts-image-preview');
      if (!wrap) return;
      wrap.innerHTML = '';
      tsUploadedImages.forEach(function(img, idx) {
        var div = document.createElement('div');
        div.className = 'thumb-wrap';
        div.innerHTML = '<img src="' + img.dataUrl + '" alt="' + img.name + '">'
          + '<button class="remove-btn" onclick="tsRemoveImage(' + idx + ')">×</button>';
        wrap.appendChild(div);
      });
    }

    function tsRenderFileList() {
      var wrap = document.getElementById('ts-file-list');
      if (!wrap) return;
      wrap.innerHTML = '';
      tsUploadedFiles.forEach(function(f, idx) {
        var div = document.createElement('div');
        div.className = 'file-item';
        var sizeStr = f.size > 1024*1024 ? (f.size/(1024*1024)).toFixed(1) + 'M' : Math.round(f.size/1024) + 'K';
        div.innerHTML = '<span class="file-name">' + f.name + '（' + sizeStr + '）</span>'
          + '<button class="remove-btn" onclick="tsRemoveFile(' + idx + ')">×</button>';
        wrap.appendChild(div);
      });
    }

    function tsRemoveImage(idx) {
      tsUploadedImages.splice(idx, 1);
      tsRenderImagePreview();
    }

    function tsRemoveFile(idx) {
      tsUploadedFiles.splice(idx, 1);
      tsRenderFileList();
    }

    var tsUploadDragInited = false;
    function tsInitUploadDrag() {
      if (tsUploadDragInited) return;
      tsUploadDragInited = true;
      var imgArea = document.getElementById('ts-image-upload');
      var fileArea = document.getElementById('ts-file-upload');
      if (imgArea) {
        imgArea.addEventListener('dragover', function(e) { e.preventDefault(); imgArea.classList.add('dragover'); });
        imgArea.addEventListener('dragleave', function() { imgArea.classList.remove('dragover'); });
        imgArea.addEventListener('drop', function(e) {
          e.preventDefault(); imgArea.classList.remove('dragover');
          tsHandleImageUpload(e.dataTransfer.files);
        });
      }
      if (fileArea) {
        fileArea.addEventListener('dragover', function(e) { e.preventDefault(); fileArea.classList.add('dragover'); });
        fileArea.addEventListener('dragleave', function() { fileArea.classList.remove('dragover'); });
        fileArea.addEventListener('drop', function(e) {
          e.preventDefault(); fileArea.classList.remove('dragover');
          tsHandleFileUpload(e.dataTransfer.files);
        });
      }
    }



    // ========== 维修配件相关 ==========
    // 根据维修工单号生成配件数据（mock）
    function tsGenerateRepairParts(orderNo) {
      if (!orderNo) return [];
      var parts = [];
      var names = ['机油滤清器','刹车片','空调压缩机','转向器','中控屏','电池模组','传感器','减震器'];
      var codes = ['P001','P002','P003','P004','P005','P006','P007','P008'];
      var faultCodes = ['FP1001','FP1002','FP1003','FP1004','FP1005','FP1006','FP1007','FP1008'];
      var accountCats = ['保修','自费','索赔'];
      var itemTypes = ['一般维修','事故维修','保养'];
      var categories = ['机电','钣金','喷涂'];
      var seed = orderNo.charCodeAt(orderNo.length - 1) || 0;
      var count = (seed % 3) + 1;
      for (var i = 0; i < count; i++) {
        var idx = (seed + i) % 8;
        parts.push({
          seq: i + 1,
          partCode: codes[idx] + String(i + 1).padStart(3,'0'),
          partName: names[idx],
          faultPartCode: faultCodes[idx],
          accountCategory: accountCats[(seed + i) % 3],
          qty: (seed + i) % 3 + 1,
          repairItemType: itemTypes[(seed + i) % 3],
          repairCategory: categories[(seed + i) % 3]
        });
      }
      return parts;
    }

    // 渲染维修配件表格
    function tsRenderRepairParts(orderNo) {
      var tbody = document.getElementById('ts-repair-parts-body');
      if (!tbody) return;
      tbody.innerHTML = '';
      var parts = tsRepairPartsMap[orderNo];
      if (!parts || !parts.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
        return;
      }
      parts.forEach(function(p) {
        tbody.innerHTML +=
          '<tr>' +
            '<td>' + p.seq + '</td>' +
            '<td>' + p.partCode + '</td>' +
            '<td>' + p.partName + '</td>' +
            '<td>' + p.faultPartCode + '</td>' +
            '<td>' + p.accountCategory + '</td>' +
            '<td>' + p.qty + '</td>' +
            '<td>' + p.repairItemType + '</td>' +
            '<td>' + p.repairCategory + '</td>' +
          '</tr>';
      });
    }

    // 故障描述/故障系统 - 模糊搜索下拉
    // ---- 故障描述/故障系统 - 标准combobox（同任务线索跟踪样式）----
    function tsShowCombobox(input, listId) {
      var list = document.getElementById(listId);
      if (list) list.classList.add('show');
    }
    function tsFilterCombobox(input) {
      var wrap = input.closest('.ts-combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      var val = input.value.toLowerCase();
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        item.classList.toggle('hidden', !item.textContent.toLowerCase().includes(val));
      });
    }
    function tsToggleComboboxArrow(listId) {
      var list = document.getElementById(listId);
      if (!list) return;
      list.classList.toggle('show');
      if (list.classList.contains('show')) {
        var inp = list.closest('.ts-combobox').querySelector('input');
        if (inp) inp.focus();
      }
    }
    function tsSelectCombobox(li, inputId, listId) {
      var input = document.getElementById(inputId);
      var list = document.getElementById(listId);
      if (input) input.value = li.textContent;
      if (list) list.classList.remove('show');
    }
    // 点击外部关闭combobox
    document.addEventListener('click', function(e){
      if (!e.target.closest('.ts-combobox')) {
        document.querySelectorAll('.ts-combobox .lt-datalist.show').forEach(function(l){ l.classList.remove('show'); });
      }
    });

    // 主故障件编码 - 参照选择（原型模拟）
    function tsOpenPartCodeLookup() {
      var mock = [
        {code:'PJ-00128', name:'高压线束总成', importance:'A', faultSystem:'电气系统', customer:'客户反映车辆偶尔无法启动，仪表显示"请检查高压系统"', condition:'车辆在电量30%以下、低温环境（<5℃）时出现，频率约每周1次', solution:'更换高压线束总成，检查接插件扭矩，更新BMS软件至V2.3.1', causeAnalysis:'高压线束接插件松动或氧化导致接触不良，BMS早期版本在低温下存在电压采样偏差', suggestion:'建议对该批次高压线束进行全面扭矩复检，并将BMS软件版本纳入定期升级计划'},
        {code:'PJ-00245', name:'电子水泵', importance:'B', faultSystem:'电气系统', customer:'水温偏高报警，空调制热效果差', condition:'车辆长时间上坡或高速行驶（>100km/h）时出现', solution:'更换电子水泵，检查冷却液管路，补充冷却液', causeAnalysis:'电子水泵内部叶轮磨损导致冷却液循环效率下降，高温工况下散热不足', suggestion:'建议在定期保养中增加冷却液循环效率检测，对使用超过3万公里的车辆主动排查水泵工况'},
        {code:'PJ-00371', name:'电机控制器', importance:'A', faultSystem:'电气系统', customer:'车辆行驶中突然失去动力，仪表多个故障灯亮', condition:'车辆在急加速（油门开度>80%）时出现，可复现', solution:'更换电机控制器，检查低压线束，刷新MCU软件', causeAnalysis:'电机控制器IGBT模块瞬时过流保护触发，低压线束存在信号干扰导致MCU误判', suggestion:'建议对同批次车辆推送MCU软件更新，并将低压线束抗干扰检测纳入出厂检测项'},
      ];
      var msg = '【原型模拟】请选择主故障件（输入序号）：\n';
      mock.forEach(function(item, idx){ msg += (idx+1) + '. ' + item.code + ' - ' + item.name + '\n'; });
      var choice = prompt(msg, '1');
      if (!choice) return;
      var idx = parseInt(choice) - 1;
      if (isNaN(idx) || idx < 0 || idx >= mock.length) { alert('无效选择'); return; }
      var sel = mock[idx];
      document.getElementById('ts-form-fault-part-code').value = sel.code;
      document.getElementById('ts-form-fault-part-reason').value = sel.name;
      document.getElementById('ts-form-importance').value = sel.importance;
      document.getElementById('ts-form-fault-system').value = sel.faultSystem;
      document.getElementById('ts-form-customer-complaint').value = sel.customer;
      document.getElementById('ts-form-fault-condition-full').value = sel.condition;
      document.getElementById('ts-form-repair-solution').value = sel.solution;
      if (document.getElementById('ts-form-cause-analysis')) document.getElementById('ts-form-cause-analysis').value = sel.causeAnalysis;
      if (document.getElementById('ts-form-suggestion')) document.getElementById('ts-form-suggestion').value = sel.suggestion;
      alert('已自动带出关联信息，内容可手动修改');
    }

    // 故障代码联动：有无显示故障码=是时，故障代码必填；=否时清空并禁用
    function tsToggleFaultCode() {
      var sel = document.getElementById('ts-form-has-fault-code');
      var input = document.getElementById('ts-form-fault-code');
      if (!sel || !input) return;
      var isYes = sel.value === '是';
      if (isYes) {
        input.removeAttribute('disabled');
        input.setAttribute('required','');
        input.style.cursor = 'pointer';
        input.title = '点击搜索故障代码';
      } else {
        input.setAttribute('disabled','');
        input.removeAttribute('required');
        input.value = '';
        input.style.cursor = 'not-allowed';
        input.title = '';
        fcSelectedCodes = [];
      }
    }

    // ========== 故障码查询弹窗 ==========
    var fcAllData = [];
    var fcFilteredData = [];
    var fcSelectedCodes = [];

    function fcInitMockData() {
      fcAllData = [
        {ecu:'BLE', dtc:'A18055', displayCode:'B218055', dtcName:'CF00配置字值未写过', description:'CF00配置字值未写过，导致控制器初始化异常，需重新写入配置字并校验'},
        {ecu:'BLE', dtc:'A18155', displayCode:'B218155', dtcName:'CF01控制器内部故障', description:'CF01控制器内部故障，BMS主控芯片自检异常，需更换控制器总成'},
        {ecu:'VCU', dtc:'A21055', displayCode:'U2F0C88', dtcName:'D130高压互锁断开', description:'D130高压互锁断开，高压回路安全检测异常，需检查高压接插件及互锁线路'},
        {ecu:'MCU', dtc:'A30120', displayCode:'U3A1120', dtcName:'P0A09 DC/DC转换器故障', description:'P0A09 DC/DC转换器故障，低压供电异常导致12V电池亏电'},
        {ecu:'MCU', dtc:'A30200', displayCode:'U3A1200', dtcName:'P0A78 电机控制器过温', description:'P0A78 电机控制器过温，IGBT模块温度超过限值，需检查冷却系统'},
        {ecu:'BMS', dtc:'A40011', displayCode:'U4B0011', dtcName:'P1E00 高压电池异常', description:'P1E00 高压电池异常，单体电压偏差过大，需进行电芯均衡或更换'},
        {ecu:'BMS', dtc:'A40022', displayCode:'U4B0022', dtcName:'P1E01 电池温度异常', description:'P1E01 电池温度异常，充电或放电过程中温度超出正常范围'},
        {ecu:'TCU', dtc:'A50088', displayCode:'U5C0088', dtcName:'P0700 变速箱控制系统', description:'P0700 变速箱控制系统故障，换挡执行异常，需检查TCU及执行器'},
        {ecu:'ABS', dtc:'A60001', displayCode:'C110001', dtcName:'C1100 轮速传感器信号丢失', description:'C1100 轮速传感器信号丢失，ABS/ESC功能受限，需检查传感器及线束'},
        {ecu:'EPS', dtc:'A70055', displayCode:'C120055', dtcName:'C1200 转向角传感器故障', description:'C1200 转向角传感器故障，方向盘转角信号异常，需标定或更换传感器'},
        {ecu:'BLE', dtc:'A18200', displayCode:'B218200', dtcName:'CF02 CAN通信超时', description:'CF02 CAN通信超时，BLE模块与VCU通信异常，需检查CAN总线及终端电阻'},
        {ecu:'VCU', dtc:'A21200', displayCode:'U2F1200', dtcName:'D131 高压绝缘故障', description:'D131 高压绝缘故障，绝缘电阻低于安全阈值，需逐段排查高压部件'}
      ];
      fcFilteredData = fcAllData.slice();
      fcRenderFCTable();
      fcRenderECUOptions();
      fcRenderSelected();
    }

    function fcRenderECUOptions() {
      var ecus = []; var seen = {};
      fcAllData.forEach(function(d){ if(!seen[d.ecu]){ seen[d.ecu]=true; ecus.push(d.ecu); } });
      var sel = document.getElementById('fc-search-ecu');
      if (!sel) return;
      sel.innerHTML = '<option value="">全部</option>';
      ecus.forEach(function(e){ sel.innerHTML += '<option value="'+e+'">'+e+'</option>'; });
    }

    function fcRenderFCTable() {
      var b = document.getElementById('fc-table-body');
      var cnt = document.getElementById('fc-total-count');
      if (!b) return;
      b.innerHTML = '';
      if (!fcFilteredData) fcFilteredData = [];
      for (var i = 0; i < fcFilteredData.length; i++) {
        var d = fcFilteredData[i];
        var checked = fcSelectedCodes.some(function(s){ return s.displayCode === d.displayCode; }) ? 'checked' : '';
        b.innerHTML += '<tr class="'+(checked?'selected':'')+'">'+
          '<td style="text-align:center"><input type="checkbox" '+checked+' onchange="tsFaultCodeToggle('+i+',this.checked)"></td>'+
          '<td>'+(i+1)+'</td>'+
          '<td>'+d.ecu+'</td>'+
          '<td>'+d.dtc+'</td>'+
          '<td>'+d.displayCode+'</td>'+
          '<td>'+d.dtcName+'</td>'+
          '<td>'+d.description+'</td>'+
          '</tr>';
      }
      if (cnt) cnt.textContent = fcFilteredData.length;
      var allChecked = fcFilteredData.length > 0 && fcFilteredData.every(function(d){
        return fcSelectedCodes.some(function(s){ return s.displayCode === d.displayCode; });
      });
      var checkAll = document.getElementById('fc-check-all');
      if (checkAll) checkAll.checked = allChecked;
    }

    function fcRenderSelected() {
      var b = document.getElementById('fc-selected-body');
      if (!b) return;
      if (fcSelectedCodes.length === 0) {
        b.innerHTML = '<tr><td colspan="3" class="fc-selected-empty">暂无选中数据</td></tr>';
        return;
      }
      b.innerHTML = '';
      for (var i = 0; i < fcSelectedCodes.length; i++) {
        var s = fcSelectedCodes[i];
        b.innerHTML += '<tr><td>'+s.ecu+'</td><td>'+s.displayCode+'</td><td style="text-align:center"><span class="fc-del-btn" onclick="tsFaultCodeRemove('+i+')">✕</span></td></tr>';
      }
    }

    function tsFaultCodeCheckAll() {
      var checkAll = document.getElementById('fc-check-all');
      if (!checkAll) return;
      var checked = checkAll.checked;
      for (var i = 0; i < fcFilteredData.length; i++) {
        var d = fcFilteredData[i];
        var exists = fcSelectedCodes.some(function(s){ return s.displayCode === d.displayCode; });
        if (checked && !exists) {
          fcSelectedCodes.push({ecu:d.ecu, displayCode:d.displayCode});
        } else if (!checked && exists) {
          fcSelectedCodes = fcSelectedCodes.filter(function(s){ return s.displayCode !== d.displayCode; });
        }
      }
      fcRenderFCTable();
      fcRenderSelected();
    }

    function tsFaultCodeToggle(idx, checked) {
      var d = fcFilteredData[idx];
      if (checked) {
        var exists = fcSelectedCodes.some(function(s){ return s.displayCode === d.displayCode; });
        if (!exists) fcSelectedCodes.push({ecu:d.ecu, displayCode:d.displayCode});
      } else {
        fcSelectedCodes = fcSelectedCodes.filter(function(s){ return s.displayCode !== d.displayCode; });
      }
      fcRenderFCTable();
      fcRenderSelected();
    }

    function tsFaultCodeRemove(idx) {
      fcSelectedCodes.splice(idx, 1);
      fcRenderFCTable();
      fcRenderSelected();
    }

    function tsFaultCodeSearch() {
      var ecu = document.getElementById('fc-search-ecu');
      var dtc = document.getElementById('fc-search-dtc');
      var display = document.getElementById('fc-search-display');
      var eVal = (ecu && ecu.value || '').toUpperCase();
      var dVal = (dtc && dtc.value || '').toUpperCase();
      var pVal = (display && display.value || '').toUpperCase();
      fcFilteredData = fcAllData.filter(function(d){
        if (eVal && d.ecu.toUpperCase().indexOf(eVal)===-1) return false;
        if (dVal && d.dtc.toUpperCase().indexOf(dVal)===-1) return false;
        if (pVal && d.displayCode.toUpperCase().indexOf(pVal)===-1) return false;
        return true;
      });
      fcRenderFCTable();
    }

    function tsFaultCodeReset() {
      var ecu = document.getElementById('fc-search-ecu');
      var dtc = document.getElementById('fc-search-dtc');
      var display = document.getElementById('fc-search-display');
      if (ecu) ecu.value = '';
      if (dtc) dtc.value = '';
      if (display) display.value = '';
      fcFilteredData = fcAllData.slice();
      fcRenderFCTable();
    }

    function tsOpenFaultCodeModal() {
      fcInitMockData();
      document.getElementById('fc-modal-overlay').style.display = 'flex';
    }

    function tsCloseFaultCodeModal() {
      document.getElementById('fc-modal-overlay').style.display = 'none';
    }

    function tsFaultCodeConfirm() {
      if (fcSelectedCodes.length === 0) {
        alert('请至少选择一条故障代码');
        return;
      }
      var codes = fcSelectedCodes.map(function(s){ return s.displayCode; });
      document.getElementById('ts-form-fault-code').value = codes.join(', ');
      tsCloseFaultCodeModal();
    }

    // ==================== 质量报告 模块 ====================
    var qrAllData = [];
    var qrFilteredData = [];
    var qrCurrentPage = 1;
    var qrPageSize = 20;
    var qrFilterExpanded = false;

    (function initQrMockData() {
      // 质量报告状态：待提交 / 审核中 / 已退回 / 已驳回 / 审核通过
      var statuses = ['待提交','待提交','审核中','审核中','审核中','已退回','已驳回','审核通过','审核通过'];
      var stores = ['深圳福田店','广州天河店','上海浦东店','北京朝阳店','成都武侯店','武汉洪山店','杭州西湖店','南京鼓楼店'];
      var storeCodes = ['SZFT001','GZTH002','SHPD003','BJCH004','CDWH005','WHHS006','HZXH007','NJGL008'];
      var provinces = ['广东','广东','上海','北京','四川','湖北','浙江','江苏'];
      var cities = ['深圳','广州','上海','北京','成都','武汉','杭州','南京'];
      var carSeries = ['秦PLUS','宋Pro','汉EV','唐DM-i','海豹','元PLUS','驱逐舰05','海豚'];
      var carModels = ['2024款 DM-i','2025款 EV','2024款 四驱','2025款 尊贵型'];
      var faultSystems = ['发动机系统','变速箱系统','制动系统','转向系统','电气系统','空调系统','底盘系统'];
      var faultNatures = ['产品质量','使用问题','维修导致'];
      var archiveCategories = ['发动机','变速箱','电气','底盘','车身'];
      var subjects = ['发动机异响严重','变速箱换挡顿挫','刹车时有尖锐异响','方向盘转向发沉','中控屏幕黑屏','空调制冷效果差','底盘有异响','高速行驶车身抖动'];
      var vins = ['LC0C76C4XM0001234','LGXC16DF8M0002567','LBEKBGKA0MZ003890','LLV3B2A15M0004456','LGWEE7A5XM0006721','LMGA425B1M0008891','LHGCR2650M0009903','LJ12FKS24M0011230'];
      for (var i = 0; i < 42; i++) {
        var idx = i % 8;
        var d = new Date();
        d.setDate(d.getDate() - i * 3);
        var ds = d.toISOString().split('T')[0];
        qrAllData.push({
          id:i+1, orderNo:'QR2026' + String(i+1).padStart(4,'0'), status:statuses[i%statuses.length],
          province:provinces[idx], city:cities[idx], storeName:stores[idx], storeCode:storeCodes[idx],
          submitDate:ds, carSeries:carSeries[idx], subject:subjects[idx],
          archiveCategory:archiveCategories[i%5], vin:vins[idx],
          faultDate:ds, faultSystem:faultSystems[i%7], faultNature:faultNatures[i%3],
          prodDate:'2024-0'+(i%9+1)+'-'+String((i%28)+1).padStart(2,'0'),
          carModel:carModels[i%4], applyType:'质量报告', needAssist:i%3===0?'是':'否',
          importance:['A','B','C','D'][i%4],
          faultPartCode: 'FP'+String(2000+i*7).padStart(6,'0'),
          faultPartName: ['连杆总成','刹车片','空调压缩机','转向器','中控屏','电池模组','传感器','减震器'][i%8],
          customerComplaint: '客户反映'+subjects[idx]+'，多次出现，影响日常使用，已到店检查。',
          faultCondition: '故障发生在车辆行驶/启动/怠速等条件下，现象：'+subjects[idx]+'，经初步检查发现异常，需进一步检测确认。',
          repairSolution: '1. 拆卸相关部件进行专项检测；2. 更换故障件并测试；3. 复检确认问题是否解决；4. 跟踪3天确认稳定性。',
          causeAnalysis: '根据故障码和检查结果，初步判断为相关部件老化或异常磨损导致，需拆解后进一步确认具体损伤程度。',
          suggestion: '建议更换故障件后跟踪观察至少1周，确认故障不再复现。如批次性问题，建议汇总后反馈供应商。',
          hasFaultCode: i%3===0?'是':'否',
          faultCode: i%3===0?'P00'+String(i+1).padStart(2,'0') : '',
          hasRepairCase: i%4===0?'是':'否',
          repairCaseNo: i%4===0?'RC2026'+String(i+1).padStart(4,'0') : '',
          repairOrder: i%3!==0 ? 'RO2026'+String(i+1).padStart(4,'0') : '',
          complaintOrder: i%5!==0 ? 'CO2026'+String(i+1).padStart(4,'0') : '',
          bodyColor: ['白色','黑色','灰色','蓝色','红色'][i%5],
          engineNo: 'EN' + String(100000+i).padStart(6,'0'),
          batteryModel: i%3===0 ? 'LFP-磷酸铁锂-82kWh' : '',
          batterySn: i%3===0 ? 'BAT' + String(50000+i).padStart(6,'0') : '',
          rearMotorNo: i%2===0 ? 'RM' + String(80000+i).padStart(5,'0') : '',
          rearMotorSn: i%2===0 ? 'RMSN' + String(90000+i).padStart(5,'0') : '',
          customerName: ['张先生','李女士','王先生','赵先生','刘女士'][i%5],
          customerPhone: '1' + String(30000000000+i).slice(1),
          submitter: ['张三','李四','王五','赵六','钱七'][i%5],
          contactPhone: '1' + String(50000000000+i).slice(1),
          deliveryDate: '2024-' + String((i%12)+1).padStart(2,'0') + '-' + String((i%28)+1).padStart(2,'0'),
          faultMileage: (i*1234) % 50000
        });
      }
      qrFilteredData = qrAllData.slice();
    })();

    // ⚠ 修改注意事项：QR_SHOW_COUNT = 默认显示的筛选器数量（索引0~N-1显示，N及以后隐藏）
    var QR_SHOW_COUNT = 7;
    function initQr() { qrFilteredData = qrAllData.slice(); qrCurrentPage = 1; qrRenderTable(); initFilterGrid('qr-filterGrid', QR_SHOW_COUNT); }
    function qrGetFiltered() {
      var orderNo = (document.getElementById('qr-flt-order-no')||{}).value || '';
      var carSeriesV = (document.getElementById('qr-flt-car-series')||{}).value || '';
      var carModel = (document.getElementById('qr-flt-car-model')||{}).value || '';
      var vin = (document.getElementById('qr-flt-vin')||{}).value || '';
      var subject = (document.getElementById('qr-flt-subject')||{}).value || '';
      var faultStart = (document.getElementById('qr-flt-fault-start')||{}).value || '';
      var faultEnd = (document.getElementById('qr-flt-fault-end')||{}).value || '';
      var faultSystem = (document.getElementById('qr-flt-fault-system')||{}).value || '';
      var faultNature = (document.getElementById('qr-flt-fault-nature')||{}).value || '';
      var prodStart = (document.getElementById('qr-flt-prod-start')||{}).value || '';
      var prodEnd = (document.getElementById('qr-flt-prod-end')||{}).value || '';
      var submitStart = (document.getElementById('qr-flt-submit-start')||{}).value || '';
      var submitEnd = (document.getElementById('qr-flt-submit-end')||{}).value || '';
      var status = (document.getElementById('qr-flt-status')||{}).value || '';
      var archiveCategory = (document.getElementById('qr-flt-archive-category')||{}).value || '';
      var importance = (document.getElementById('qr-flt-importance')||{}).value || '';
      var repairOrder = (document.getElementById('qr-flt-repair-order')||{}).value || '';
      var complaintOrder = (document.getElementById('qr-flt-complaint-order')||{}).value || '';
      return qrAllData.filter(function(r) {
        if (orderNo && r.orderNo.toLowerCase().indexOf(orderNo.toLowerCase()) < 0) return false;
        if (carSeriesV && r.carSeries.toLowerCase().indexOf(carSeriesV.toLowerCase()) < 0) return false;
        if (carModel && r.carModel.toLowerCase().indexOf(carModel.toLowerCase()) < 0) return false;
        if (vin && r.vin.toLowerCase().indexOf(vin.toLowerCase()) < 0) return false;
        if (subject && r.subject.toLowerCase().indexOf(subject.toLowerCase()) < 0) return false;
        if (faultStart && r.faultDate < faultStart) return false;
        if (faultEnd && r.faultDate > faultEnd) return false;
        if (faultSystem && r.faultSystem !== faultSystem) return false;
        if (faultNature && r.faultNature !== faultNature) return false;
        if (prodStart && r.prodDate < prodStart) return false;
        if (prodEnd && r.prodDate > prodEnd) return false;
        if (submitStart && r.submitDate < submitStart) return false;
        if (submitEnd && r.submitDate > submitEnd) return false;
        if (status && r.status !== status) return false;
        if (archiveCategory && r.archiveCategory !== archiveCategory) return false;
        if (importance && r.importance !== importance) return false;
        if (repairOrder && r.repairOrder.toLowerCase().indexOf(repairOrder.toLowerCase()) < 0) return false;
        if (complaintOrder && r.complaintOrder.toLowerCase().indexOf(complaintOrder.toLowerCase()) < 0) return false;
        if (isPdi && r.isPdi !== isPdi) return false;
        if (pdiOrder && r.pdiOrder.toLowerCase().indexOf(pdiOrder.toLowerCase()) < 0) return false;
        if (alarmOrder && r.alarmOrder.toLowerCase().indexOf(alarmOrder.toLowerCase()) < 0) return false;
        return true;
      });
    }
    function qrApplyFilter() { qrFilteredData = qrGetFiltered(); qrCurrentPage = 1; qrRenderTable(); }
    function qrResetFilter() {
      var ids = ['qr-flt-order-no','qr-flt-car-series','qr-flt-car-model','qr-flt-vin','qr-flt-subject','qr-flt-fault-start','qr-flt-fault-end','qr-flt-fault-system','qr-flt-fault-nature','qr-flt-prod-start','qr-flt-prod-end','qr-flt-submit-start','qr-flt-submit-end','qr-flt-status','qr-flt-importance','qr-flt-repair-order','qr-flt-complaint-order','qr-flt-is-pdi','qr-flt-pdi-order','qr-flt-alarm-order'];
      ids.forEach(function(id) { var el = document.getElementById(id); if (el) { if (el.tagName==='SELECT') el.value=''; else el.value=''; } });
      qrFilteredData = qrAllData.slice(); qrCurrentPage = 1; qrRenderTable();
    }
    function qrRenderTable() {
      var tbody = document.getElementById('qr-tbody'); if (!tbody) return;
      var start = (qrCurrentPage - 1) * qrPageSize, end = start + qrPageSize;
      var page = qrFilteredData.slice(start, end);
      var h = '';
      for (var i = 0; i < page.length; i++) {
        var r = page[i], idx = start + i + 1;
        var ops = '';
        if (r.status === '待提交') ops = '<a href="javascript:void(0)" onclick="qrOpenEdit('+r.id+')">修改</a><span class="sep">|</span><a href="javascript:void(0)" onclick="qrCancelOrder('+r.id+')">作废</a><span class="sep">|</span><a href="javascript:void(0)" onclick="qrOpenDetail('+r.id+')">详情</a>';
        else if (r.status === '已退回') ops = '<a href="javascript:void(0)" onclick="qrOpenEdit('+r.id+')">修改</a><span class="sep">|</span><a href="javascript:void(0)" onclick="qrCancelOrder('+r.id+')">作废</a><span class="sep">|</span><a href="javascript:void(0)" onclick="qrOpenDetail('+r.id+')">详情</a>';
        else ops = '<a href="javascript:void(0)" onclick="qrOpenDetail('+r.id+')">详情</a>';
        h += '<tr><td class="sticky col-seq">'+idx+'</td><td class="sticky col-order-no">'+(r.orderNo||'')+'</td><td class="sticky col-status">'+(r.status||'')+'</td><td class="col-province">'+(r.province||'')+'</td><td class="col-city">'+(r.city||'')+'</td><td class="col-store-name">'+(r.storeName||'')+'</td><td class="col-store-code">'+(r.storeCode||'')+'</td><td class="col-submit-date">'+(r.submitDate||'')+'</td><td class="col-car-series">'+(r.carSeries||'')+'</td><td class="col-subject">'+(r.subject||'')+'</td><td class="col-importance">'+(r.importance||'')+'</td><td class="col-repair-order">'+(r.repairOrder||'')+'</td><td class="col-complaint-order">'+(r.complaintOrder||'')+'</td><td class="col-pdi-order">'+(r.pdiOrder||'')+'</td><td class="col-alarm-order">'+(r.alarmOrder||'')+'</td><td class="col-archive-category">'+(r.archiveCategory||'')+'</td><td class="col-vin">'+(r.vin||'')+'</td><td class="col-fault-date">'+(r.faultDate||'')+'</td><td class="col-fault-system">'+(r.faultSystem||'')+'</td><td class="col-fault-nature">'+(r.faultNature||'')+'</td><td class="col-prod-date">'+(r.prodDate||'')+'</td><td class="sticky col-actions"><div class="op-links">'+ops+'</div></td></tr>';
      }
      tbody.innerHTML = h;
      qrRenderPager();
    }
    function qrRenderPager() {
      var total = qrFilteredData.length, pages = Math.ceil(total / qrPageSize);
      document.getElementById('qr-pg-total').textContent = '共 ' + total + ' 条';
      document.getElementById('qr-pg-prev').disabled = qrCurrentPage <= 1;
      document.getElementById('qr-pg-next').disabled = qrCurrentPage >= pages;
      var pgH = '';
      for (var i = 1; i <= pages; i++) { pgH += '<span class="pg-num'+(i===qrCurrentPage?' active':'')+'" onclick="qrGotoPage('+i+')">'+i+'</span>'; }
      document.getElementById('qr-pg-pages').innerHTML = pgH;
    }
    function qrChangePage(delta) { var pages = Math.ceil(qrFilteredData.length / qrPageSize); qrCurrentPage = Math.max(1, Math.min(pages, qrCurrentPage + delta)); qrRenderTable(); }
    function qrGotoPage(p) { var pages = Math.ceil(qrFilteredData.length / qrPageSize); qrCurrentPage = Math.max(1, Math.min(pages, parseInt(p)||1)); qrRenderTable(); }
    function qrChangePageSize(sz) { qrPageSize = parseInt(sz); qrCurrentPage = 1; qrRenderTable(); }
    function qrExportData() { alert('导出'); }
    function qrToggleFilter() { qrFilterExpanded = !qrFilterExpanded; toggleFilterGrid('qr-filterGrid', qrFilterExpanded, QR_SHOW_COUNT); }

    function qrSubmitFromList(id) {
      if (!confirm('确认提交该质量报告？提交后状态将变为【审核中】，且不能再修改。')) return;
      var item = qrAllData.find(function(r){return r.id===id;});
      if (item) { item.status = '审核中'; }
      qrFilteredData = qrGetFiltered(); qrRenderTable();
    }
    function qrCancelOrder(id) {
      if (!confirm('确认作废该质量报告？')) return;
      var item = qrAllData.find(function(r){return r.id===id;});
      if (item) { item.status = '已作废'; }
      qrFilteredData = qrGetFiltered(); qrRenderTable();
    }

    // 侧滑面板（共用给质量报告 / 总部质量报告处理）
    var qrPanelMode = 'add';   // add | edit | detail
    var qrPanelRole = 'store'; // store | hq
    var qrCurrentItem = null;

    function qrOpenAdd(prefill) {
      qrPanelMode = 'add'; qrPanelRole = 'store'; qrCurrentItem = null;
      qrClearPanelForm();
      document.getElementById('qr-panel-title').textContent = '质量报告';
      var badge = document.getElementById('qr-panel-badge');
      badge.textContent = '新增'; badge.className = 'qr-panel-mode-badge add';
      qrSetPanelReadonly(false);
      // 预填字段
      if (prefill && typeof prefill === 'object') {
        var fields = ['orderNo','submitDate','storeName','storeCode','city','submitter','vin','carSeries','carModel','prodDate','subject','archiveCategory','faultSystem','faultNature','problemDesc','causeAnalysis','suggestion','severity','qty','batchNo','faultDate'];
        fields.forEach(function(k) {
          if (prefill[k] === undefined) return;
          var el = document.getElementById('qr-form-' + k);
          if (el) el.value = prefill[k];
        });
        // 来源申请单号 写进备注提示（可选）
        if (prefill.sourceOrderNo) {
          var remark = document.getElementById('qr-form-problem-desc');
          if (remark && !remark.value) remark.value = '来源技术支持单：' + prefill.sourceOrderNo + '\n';
        }
      }
      qrUpdatePanelButtons();
      document.getElementById('qr-panel').classList.add('show');
      document.getElementById('qr-panel-overlay').classList.add('show');
    }
    function qrOpenAddWithPrefill(prefill) {
      qrOpenAdd(prefill || window.__qrPrefill || null);
      window.__qrPrefill = null;
    }
    function qrOpenEdit(id) {
      qrPanelMode = 'edit'; qrPanelRole = 'store';
      var item = qrAllData.find(function(r){return r.id===id;});
      qrCurrentItem = item;
      // 生成并缓存维修配件数据
      if (item.repairStatusOrder || item.repairOrder) {
        var oNo = item.repairStatusOrder || item.repairOrder;
        qrRepairPartsMap[oNo] = qrGenerateRepairParts(oNo);
      }
      qrFillPanelForm(item);
      document.getElementById('qr-panel-title').textContent = '质量报告';
      var badge = document.getElementById('qr-panel-badge');
      badge.textContent = '编辑'; badge.className = 'qr-panel-mode-badge edit';
      qrSetPanelReadonly(false);
      qrUpdatePanelButtons();
      document.getElementById('qr-panel').classList.add('show');
      document.getElementById('qr-panel-overlay').classList.add('show');
    }
    function qrOpenDetail(id, role) {
      qrPanelMode = 'detail'; qrPanelRole = role || 'store';
      var src = role === 'hq' ? (window.qrhqAllData || qrAllData) : qrAllData;
      var item = src.find(function(r){return r.id===id;});
      qrCurrentItem = item;
      // 生成并缓存维修配件数据
      if (item.repairStatusOrder || item.repairOrder) {
        var oNo = item.repairStatusOrder || item.repairOrder;
        qrRepairPartsMap[oNo] = qrGenerateRepairParts(oNo);
      }
      qrFillPanelForm(item);
      var prefix = role === 'hq' ? '总部质量报告处理' : '质量报告';
      document.getElementById('qr-panel-title').textContent = prefix;
      var badge = document.getElementById('qr-panel-badge');
      badge.textContent = '详情'; badge.className = 'qr-panel-mode-badge detail';
      qrSetPanelReadonly(true);
      qrUpdatePanelButtons();
      // 渲染审核记录
      qrRenderAuditLog();
      // 显示/隐藏故障维修情况区块
      var repairSec = document.getElementById('qr-section-repair-status');
      if (repairSec) {
        repairSec.style.display = (role === 'hq' && qrPanelMode === 'detail') ? '' : 'none';
      }
      var auditSec = document.getElementById('qr-section-audit-log');
      if (auditSec) {
        auditSec.style.display = (qrPanelMode === 'detail') ? '' : 'none';
      }
      document.getElementById('qr-panel').classList.add('show');
      document.getElementById('qr-panel-overlay').classList.add('show');
    }
    function qrClosePanel() {
      document.getElementById('qr-panel').classList.remove('show');
      document.getElementById('qr-panel-overlay').classList.remove('show');
    }
    function qrClearPanelForm() {
      // 清空处理结论区块
      var closeUser = document.getElementById('qr-form-close-user');
      var closeTime = document.getElementById('qr-form-close-time');
      var conc = document.getElementById('qr-form-conclusion');
      if (closeUser) closeUser.value = '';
      if (closeTime) closeTime.value = '';
      if (conc) conc.value = '';
      var ac1 = document.getElementById('qr-form-archive-cat1');
      var ac2 = document.getElementById('qr-form-archive-cat2');
      var ac3 = document.getElementById('qr-form-archive-cat3');
      if (ac1) { ac1.innerHTML = '<option value="">请选择</option>'; }
      if (ac2) { ac2.innerHTML = '<option value="">请选择</option>'; }
      if (ac3) { ac3.innerHTML = '<option value="">请选择</option>'; }
      var ids = ['qr-form-order-no','qr-form-submit-date','qr-form-store-name','qr-form-store-code','qr-form-city','qr-form-submitter','qr-form-contact-phone','qr-form-repair-order','qr-form-complaint-order','qr-form-warning-order','qr-form-pdi-order','qr-form-vin','qr-form-car-series','qr-form-car-model','qr-form-body-color','qr-form-engine-no','qr-form-front-motor-no','qr-form-rear-motor-no','qr-form-front-motor-sn','qr-form-rear-motor-sn','qr-form-battery-model','qr-form-battery-sn','qr-form-vehicle-version','qr-form-latest-ota-time','qr-form-customer-name','qr-form-customer-phone','qr-form-prod-date','qr-form-delivery-date','qr-form-fault-date','qr-form-fault-mileage','qr-form-fault-part-code','qr-form-fault-part-reason','qr-form-subject','qr-form-fault-description','qr-form-fault-system','qr-form-customer-complaint','qr-form-fault-condition-full','qr-form-repair-solution','qr-form-fault-code','qr-form-repair-case-no','qr-form-image-desc','qr-form-repair-status-order','qr-form-quality-check-time'];
      ids.forEach(function(id){ var el=document.getElementById(id); if(el){if(el.tagName==='SELECT')el.value='';else el.value='';} });
      var selIds = ['qr-form-importance','qr-form-is-pdi','qr-form-repair-status-state','qr-form-has-fault-code','qr-form-has-repair-case'];
      // 清空图片和附件
      qrUploadedImages = [];
      qrUploadedFiles = [];
      var imgPreview = document.getElementById('qr-image-preview');
      if (imgPreview) imgPreview.innerHTML = '';
      var fileList = document.getElementById('qr-file-list');
      if (fileList) fileList.innerHTML = '';
      // 清空维修配件表格
      var rpBody = document.getElementById('qr-repair-parts-body');
      if (rpBody) rpBody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
      selIds.forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
    }
    function qrSetPanelReadonly(readonly) {
      var panel = document.getElementById('qr-panel');
      var inputs = panel.querySelectorAll('input:not([type="button"]), select, textarea');
      var fixedReadonlyIds = ['qr-form-order-no','qr-form-submit-date','qr-form-store-name','qr-form-store-code','qr-form-city','qr-form-submitter','qr-form-car-series','qr-form-car-model','qr-form-body-color','qr-form-engine-no','qr-form-battery-model','qr-form-battery-sn','qr-form-front-motor-no','qr-form-rear-motor-no','qr-form-front-motor-sn','qr-form-rear-motor-sn','qr-form-vehicle-version','qr-form-latest-ota-time','qr-form-customer-name','qr-form-customer-phone','qr-form-prod-date','qr-form-delivery-date'];
      for (var i = 0; i < inputs.length; i++) {
        if (!readonly) {
          if (inputs[i].id === 'qr-form-contact-phone' && qrPanelMode==='detail') continue;
          if (fixedReadonlyIds.indexOf(inputs[i].id) !== -1) continue;
        }
        inputs[i].disabled = readonly;
        if (inputs[i].tagName==='INPUT' && inputs[i].type==='text') inputs[i].readOnly = readonly;
      }
      // 详情模式隐藏"选择模版"行；新增/编辑保留
      var hideItems = panel.querySelectorAll('[data-qr-hide-on="detail"]');
      hideItems.forEach(function(el){ el.style.display = (qrPanelMode === 'detail') ? 'none' : ''; });
      // "故障件维修情况"仅 HQ 详情显示；其他 5 种模式隐藏
      var repairSec = document.getElementById('qr-section-repair-status');
      if (repairSec) {
        repairSec.style.display = '';
      }
    }
    function qrUpdatePanelButtons() {
      var topDiv = document.getElementById('qr-panel-actions');
      var bottomDiv = document.getElementById('qr-panel-bottom-actions');
      if (!topDiv || !bottomDiv) return;

      var status = (qrCurrentItem && qrCurrentItem.status) || '';
      var isHq = qrPanelRole === 'hq';
      var topBtns = '', bottomBtns = '';

      if (qrPanelMode === 'add') {
        topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrSaveAndSubmit()">提交</button><button class="lt-btn lt-btn-default" onclick="qrSavePanel()">保存</button>';
        bottomBtns = '';
      } else if (qrPanelMode === 'edit') {
        topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrSaveAndSubmit()">提交</button><button class="lt-btn lt-btn-default" onclick="qrSavePanel()">保存</button>';
        bottomBtns = '';
      } else if (qrPanelMode === 'detail') {
        if (isHq) {
          // 总部审核端
          if (status === '审核中') {
            topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrOpenAuditModal()">审核</button>';
          } else if (status === '已退回') {
            topBtns = '';
          } else if (status === '审核通过') {
            topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrConvertToTemplate()">转质量报告模版</button>';
          } else if (status === '待提交') {
            topBtns = '<span style="color:#999;font-size:12px;align-self:center">门店尚未提交，无法审核</span>';
          } else {
            topBtns = '';
          }
          bottomBtns = '';
        } else {
          // 门店端
          if (status === '待提交') {
            topBtns = '<button class="lt-btn lt-btn-default" onclick="qrSavePanelOnly()">保存</button><button class="lt-btn lt-btn-primary" onclick="qrSaveAndSubmit()">提交</button><button class="lt-btn" style="background:#861B2F;color:#fff" onclick="qrCancelOrder(qrCurrentItem.id);qrClosePanel()">作废</button>';
          } else if (status === '已退回') {
            topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrReSubmit()">重新提交</button><button class="lt-btn" style="background:#861B2F;color:#fff" onclick="qrCancelOrder(qrCurrentItem.id);qrClosePanel()">作废</button>';
          } else if (status === '审核通过') {
            topBtns = '';
          } else {
            topBtns = '';
          }
          bottomBtns = '';
        }
      }
      topDiv.innerHTML = topBtns;
      bottomDiv.innerHTML = bottomBtns;
    }
    function qrSavePanel() {
      var faultPartCode = document.getElementById('qr-form-fault-part-code');
      if (!faultPartCode || !faultPartCode.value.trim()) { alert('请填写主故障件编码'); if (faultPartCode) faultPartCode.focus(); return; }
      alert('保存成功'); qrClosePanel();
    }
    function qrSaveAndSubmit() {
      var faultPartCode = document.getElementById('qr-form-fault-part-code');
      if (!faultPartCode || !faultPartCode.value.trim()) { alert('请填写主故障件编码'); if (faultPartCode) faultPartCode.focus(); return; }
      if (qrCurrentItem) qrCurrentItem.status = '审核中';
      alert('提交成功');
      qrClosePanel();
      qrFilteredData = qrGetFiltered();
      qrRenderTable();
    }
    // 审核弹窗
    function qrOpenAuditModal() {
      document.getElementById('audit-modal-overlay').style.display = 'flex';
      document.getElementById('audit-modal').style.display = 'block';
      // 重置表单，默认选中"通过"
      var radios = document.getElementsByName('audit-result');
      for (var i = 0; i < radios.length; i++) {
        radios[i].checked = (radios[i].value === '通过');
      }
      document.getElementById('audit-opinion').value = '';
      // 隐藏审核意见的必填*
      var req = document.getElementById('audit-opinion-req');
      if (req) req.style.display = 'none';
    }
    function qrCloseAuditModal() {
      document.getElementById('audit-modal-overlay').style.display = 'none';
      document.getElementById('audit-modal').style.display = 'none';
    }
    function qrOnAuditResultChange() {
      var req = document.getElementById('audit-opinion-req');
      if (!req) return;
      var selected = document.querySelector('input[name="audit-result"]:checked');
      // 只有"驳回"时才显示必填*
      req.style.display = (selected && selected.value === '驳回') ? 'inline' : 'none';
    }
    function qrConfirmAudit() {
      var selected = document.querySelector('input[name="audit-result"]:checked');
      if (!selected) { alert('请选择审核结果'); return; }
      var result = selected.value;
      var opinion = document.getElementById('audit-opinion').value;
      // 驳回时必填原因
      if (result === '驳回' && !opinion.trim()) { alert('驳回时请填写审核意见'); return; }
      // 更新状态
      if (result === '通过') {
        qrCurrentItem.status = '审核通过';
      } else if (result === '退回') {
        qrCurrentItem.status = '已退回';
      } else if (result === '驳回') {
        qrCurrentItem.status = '已驳回';
      }
      // 记录审核日志
      if (!qrCurrentItem.auditLog) qrCurrentItem.auditLog = [];
      qrCurrentItem.auditLog.push({
        step: '总部审核',
        reviewer: '张审核员',
        time: new Date().toISOString().split('T')[0],
        result: result,
        opinion: opinion
      });
      alert('审核完成');
      qrCloseAuditModal();
      qrClosePanel();
      qrhqFilteredData = qrhqGetFiltered();
      qrhqRenderTable();
    }
    // 渲染审核记录
    function qrRenderAuditLog() {
      var tbody = document.getElementById('qr-audit-log-body');
      if (!tbody) return;
      var log = (qrCurrentItem && qrCurrentItem.auditLog) || [];
      if (log.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">暂无数据</td></tr>';
        return;
      }
      var h = '';
      for (var i = 0; i < log.length; i++) {
        var r = log[i];
        h += '<tr><td>' + (i+1) + '</td><td>' + (r.step||'') + '</td><td>' + (r.reviewer||'') + '</td><td>' + (r.time||'') + '</td><td>' + (r.result||'') + '</td><td>' + (r.opinion||'') + '</td></tr>';
      }
      tbody.innerHTML = h;
    }
    // 仅保存（不改变状态）
    function qrSavePanelOnly() {
      var faultPartCode = document.getElementById('qr-form-fault-part-code');
      if (!faultPartCode || !faultPartCode.value.trim()) { alert('请填写主故障件编码'); if (faultPartCode) faultPartCode.focus(); return; }
      alert('保存成功');
    }
    // 重新提交（已退回 → 审核中）
    function qrReSubmit() {
      if (!qrCurrentItem) return;
      qrCurrentItem.status = '审核中';
      alert('重新提交成功');
      qrClosePanel();
      qrFilteredData = qrGetFiltered();
      qrRenderTable();
    }
    // 转质量报告模版：关闭侧滑面板 → 跳转模板页 → 打开新增弹窗并预填字段
    function qrConvertToTemplate() {
      if (!qrCurrentItem) { alert('当前无数据可转'); return; }
      var src = qrCurrentItem;
      // 暂存要带入模板的数据
      window.__qrtPrefill = {
        faultPartCode: src.faultPartCode || '',
        faultPartName: src.faultPartName || '',
        importance: src.importance || '',
        faultSystem: src.faultSystem || '',
        customerComplaint: src.customerComplaint || '',
        faultCondition: src.faultCondition || '',
        repairSolution: src.repairSolution || '',
        conclusion: src.conclusion || ''
      };
      qrClosePanel();
      showContent('quality-report-template');
      // 页面切换后再开面板并预填
      setTimeout(function() {
        qrtOpenAddPanel();
        // 预填数据
        var pf = window.__qrtPrefill;
        if (!pf) return;
        if (pf.faultPartCode) document.getElementById('qrt-form-fault-part-code').value = pf.faultPartCode;
        if (pf.faultPartName) document.getElementById('qrt-form-fault-part-name').value = pf.faultPartName;
        if (pf.importance) document.getElementById('qrt-form-importance').value = pf.importance;
        if (pf.faultSystem) document.getElementById('qrt-form-fault-system').value = pf.faultSystem;
        if (pf.customerComplaint) document.getElementById('qrt-form-customer-complaint').value = pf.customerComplaint;
        if (pf.faultCondition) document.getElementById('qrt-form-fault-condition-full').value = pf.faultCondition;
        if (pf.repairSolution) document.getElementById('qrt-form-repair-solution').value = pf.repairSolution;
        if (pf.conclusion) document.getElementById('qrt-form-conclusion').value = pf.conclusion;
        // 模板名称建议
        var suggested = '';
        if (pf.faultPartName) suggested += pf.faultPartName;
        if (pf.faultSystem) suggested += (suggested ? '-' : '') + pf.faultSystem;
        if (suggested) suggested += '模板';
        if (suggested) document.getElementById('qrt-form-name').value = suggested;
        window.__qrtPrefill = null;
      }, 50);
    }
    function qrToggleSection(name) {
      var sec = document.getElementById('qr-section-' + name);
      if (sec) sec.classList.toggle('collapsed');
    }

    var qrUploadedImages = [];
    var qrUploadedFiles = [];
    var qrRepairPartsMap = {};
    var qrUploadDragInited = false;
    var qrSectionStates = {};
    var qrArchiveData = {
      "发动机": {"发动机本体": ["缸体异常","缸盖异常","活塞连杆异常"],"燃油系统": ["喷油器故障","高压油泵异常","燃油管路泄漏"],"进气系统": ["涡轮增压异常","EGR阀故障","进气歧管漏气"]},
      "变速箱": {"AT变速箱": ["换挡冲击","异响","漏油"],"DCT变速箱": ["顿挫","过热报警","离合器打滑"],"CVT变速箱": ["钢带打滑","加速无力"]},
      "电气": {"高压系统": ["绝缘故障","互锁断开","DC/DC故障"],"低压系统": ["12V亏电","线束短路","保险熔断"],"智驾系统": ["雷达失明","摄像头模糊","域控报错"]},
      "底盘": {"制动系统": ["刹车异响","制动力不足","ABS报错"],"转向系统": ["转向沉重","异响","跑偏"],"悬挂系统": ["减震漏油","异响","弹簧断裂"]},
      "车身": {"车身钣金": ["车门异响","锈蚀","缝隙不均"],"内外饰": ["仪表台开裂","座椅异响","顶棚脱落"],"空调系统": ["不制冷","不制热","出风异味"]}
    };


    // ===== qr- 独立函数（从 ts- 原样复制，ts-→qr-） =====
    function qrFillPanelForm(item) {
      if (!item) return;
      document.getElementById('qr-form-order-no').value = item.orderNo || '';
      document.getElementById('qr-form-submit-date').value = item.submitDate || '';
      document.getElementById('qr-form-store-name').value = item.storeName || '';
      document.getElementById('qr-form-store-code').value = item.storeCode || '';
      document.getElementById('qr-form-city').value = item.city || '';
      document.getElementById('qr-form-vin').value = item.vin || '';
      document.getElementById('qr-form-car-series').value = item.carSeries || '';
      document.getElementById('qr-form-car-model').value = item.carModel || '';
      document.getElementById('qr-form-prod-date').value = item.prodDate || '';
      document.getElementById('qr-form-fault-date').value = item.faultDate || '';
      document.getElementById('qr-form-subject').value = item.subject || '';
      document.getElementById('qr-form-repair-order').value = item.repairOrder || '';
      document.getElementById('qr-form-complaint-order').value = item.complaintOrder || '';
      document.getElementById('qr-form-warning-order').value = item.warningOrder || '';
      document.getElementById('qr-form-pdi-order').value = item.pdiOrder || '';
      if (document.getElementById('qr-form-is-pdi')) document.getElementById('qr-form-is-pdi').value = item.isPdi || '';
      document.getElementById('qr-form-vehicle-version').value = item.vehicleVersion || '';
      document.getElementById('qr-form-latest-ota-time').value = item.latestOtaTime || '';
      if (document.getElementById('qr-form-fault-system')) document.getElementById('qr-form-fault-system').value = item.faultSystem || '';
      if (document.getElementById('qr-form-fault-description')) document.getElementById('qr-form-fault-description').value = item.faultDescription || '';
      document.getElementById('qr-form-repair-status-order').value = item.repairStatusOrder || '';
      qrRenderRepairParts(item.repairStatusOrder || item.repairOrder || '');
      document.getElementById('qr-form-repair-status-state').value = item.repairStatusState || '';
      document.getElementById('qr-form-quality-check-time').value = item.qualityCheckTime || '';
      // 回填故障现象描述、故障发生条件、排查内容及结果
      if (document.getElementById('qr-form-customer-complaint')) document.getElementById('qr-form-customer-complaint').value = item.customerComplaint || '';
      if (document.getElementById('qr-form-fault-condition-full')) document.getElementById('qr-form-fault-condition-full').value = item.faultCondition || '';
      if (document.getElementById('qr-form-repair-solution')) document.getElementById('qr-form-repair-solution').value = item.repairSolution || '';
      // 回填主故障件名称
      if (document.getElementById('qr-form-fault-part-reason')) document.getElementById('qr-form-fault-part-reason').value = item.faultPartName || '';
      // 回填主故障件编码 + 重要程度
      if (document.getElementById('qr-form-fault-part-code')) document.getElementById('qr-form-fault-part-code').value = item.faultPartCode || '';
      if (document.getElementById('qr-form-importance')) document.getElementById('qr-form-importance').value = item.importance || '';
      // 回填基本信息 - 自动带入字段
      if (document.getElementById('qr-form-body-color')) document.getElementById('qr-form-body-color').value = item.bodyColor || '';
      if (document.getElementById('qr-form-engine-no')) document.getElementById('qr-form-engine-no').value = item.engineNo || '';
      if (document.getElementById('qr-form-battery-model')) document.getElementById('qr-form-battery-model').value = item.batteryModel || '';
      if (document.getElementById('qr-form-battery-sn')) document.getElementById('qr-form-battery-sn').value = item.batterySn || '';
      if (document.getElementById('qr-form-rear-motor-no')) document.getElementById('qr-form-rear-motor-no').value = item.rearMotorNo || '';
      if (document.getElementById('qr-form-rear-motor-sn')) document.getElementById('qr-form-rear-motor-sn').value = item.rearMotorSn || '';
      if (document.getElementById('qr-form-customer-name')) document.getElementById('qr-form-customer-name').value = item.customerName || '';
      if (document.getElementById('qr-form-customer-phone')) document.getElementById('qr-form-customer-phone').value = item.customerPhone || '';
      if (document.getElementById('qr-form-delivery-date')) document.getElementById('qr-form-delivery-date').value = item.deliveryDate || '';
      if (document.getElementById('qr-form-fault-mileage')) document.getElementById('qr-form-fault-mileage').value = item.faultMileage || '';
      // 回填提交人、联系电话
      if (document.getElementById('qr-form-submitter')) document.getElementById('qr-form-submitter').value = item.submitter || '';
      if (document.getElementById('qr-form-contact-phone')) document.getElementById('qr-form-contact-phone').value = item.contactPhone || '';
      
      if (document.getElementById('qr-form-has-fault-code')) document.getElementById('qr-form-has-fault-code').value = item.hasFaultCode || '';
      if (document.getElementById('qr-form-fault-code')) document.getElementById('qr-form-fault-code').value = item.faultCode || '';
      if (document.getElementById('qr-form-has-repair-case')) document.getElementById('qr-form-has-repair-case').value = item.hasRepairCase || '';
      if (document.getElementById('qr-form-repair-case-no')) document.getElementById('qr-form-repair-case-no').value = item.repairCaseNo || '';
      // 回填图片（详情模式）
      if (item.images && item.images.length) {
        qrUploadedImages = item.images.slice();
        qrRenderImagePreview();
      }
      // 回填附件（详情模式）
      if (item.files && item.files.length) {
        qrUploadedFiles = item.files.slice();
        qrRenderFileList();
      }
      // 回填处理结论及技术方案区块
      var closeUser = document.getElementById('qr-form-close-user');
      var closeTime = document.getElementById('qr-form-close-time');
      var conc = document.getElementById('qr-form-conclusion');
      if (closeUser) closeUser.value = item.closeUser || '';
      if (closeTime) closeTime.value = item.closeTime || '';
      if (conc) conc.value = item.conclusion || '';
      // 回填归档分类三级
      var ac1 = document.getElementById('qr-form-archive-cat1');
      var ac2 = document.getElementById('qr-form-archive-cat2');
      var ac3 = document.getElementById('qr-form-archive-cat3');
      if (ac1) {
        ac1.innerHTML = '<option value="">请选择</option>';
        for (var k in qrArchiveData) { ac1.innerHTML += '<option>' + k + '</option>'; }
        if (item.archiveCat1) {
          ac1.value = item.archiveCat1;
          ac2.innerHTML = '<option value="">请选择</option>';
          for (var k2 in qrArchiveData[item.archiveCat1]) { ac2.innerHTML += '<option>' + k2 + '</option>'; }
          if (item.archiveCat2) {
            ac2.value = item.archiveCat2;
            ac3.innerHTML = '<option value="">请选择</option>';
            qrArchiveData[item.archiveCat1][item.archiveCat2].forEach(function(v) { ac3.innerHTML += '<option>' + v + '</option>'; });
            if (item.archiveCat3) ac3.value = item.archiveCat3;
          }
        }
      }
      qrToggleFaultCode();
    }
    function qrClearPanelForm() {
      // 清空处理结论区块
      var closeUser = document.getElementById('qr-form-close-user');
      var closeTime = document.getElementById('qr-form-close-time');
      var conc = document.getElementById('qr-form-conclusion');
      if (closeUser) closeUser.value = '';
      if (closeTime) closeTime.value = '';
      if (conc) conc.value = '';
      var ac1 = document.getElementById('qr-form-archive-cat1');
      var ac2 = document.getElementById('qr-form-archive-cat2');
      var ac3 = document.getElementById('qr-form-archive-cat3');
      if (ac1) { ac1.innerHTML = '<option value="">请选择</option>'; }
      if (ac2) { ac2.innerHTML = '<option value="">请选择</option>'; }
      if (ac3) { ac3.innerHTML = '<option value="">请选择</option>'; }
      var ids = ['qr-form-order-no','qr-form-submit-date','qr-form-store-name','qr-form-store-code','qr-form-city','qr-form-submitter','qr-form-contact-phone','qr-form-repair-order','qr-form-complaint-order','qr-form-warning-order','qr-form-pdi-order','qr-form-vin','qr-form-car-series','qr-form-car-model','qr-form-body-color','qr-form-engine-no','qr-form-front-motor-no','qr-form-rear-motor-no','qr-form-front-motor-sn','qr-form-rear-motor-sn','qr-form-battery-model','qr-form-battery-sn','qr-form-vehicle-version','qr-form-latest-ota-time','qr-form-customer-name','qr-form-customer-phone','qr-form-prod-date','qr-form-delivery-date','qr-form-fault-date','qr-form-fault-mileage','qr-form-fault-part-code','qr-form-fault-part-reason','qr-form-subject','qr-form-fault-description','qr-form-fault-system','qr-form-customer-complaint','qr-form-fault-condition-full','qr-form-repair-solution','qr-form-fault-code','qr-form-repair-case-no','qr-form-image-desc','qr-form-repair-status-order','qr-form-quality-check-time'];
      ids.forEach(function(id){ var el=document.getElementById(id); if(el){if(el.tagName==='SELECT')el.value='';else el.value='';} });
      var selIds = ['qr-form-importance','qr-form-is-pdi','qr-form-repair-status-state','qr-form-has-fault-code','qr-form-has-repair-case'];
      // 清空图片和附件
      qrUploadedImages = [];
      qrUploadedFiles = [];
      var imgPreview = document.getElementById('qr-image-preview');
      if (imgPreview) imgPreview.innerHTML = '';
      var fileList = document.getElementById('qr-file-list');
      if (fileList) fileList.innerHTML = '';
      // 清空维修配件表格
      var rpBody = document.getElementById('qr-repair-parts-body');
      if (rpBody) rpBody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
      selIds.forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
    }
    function qrSetPanelReadonly(readonly) {
      var panel = document.getElementById('qr-panel');
      var inputs = panel.querySelectorAll('input:not([type="button"]), select, textarea');
      var fixedReadonlyIds = ['qr-form-order-no','qr-form-submit-date','qr-form-store-name','qr-form-store-code','qr-form-city','qr-form-submitter','qr-form-car-series','qr-form-car-model','qr-form-body-color','qr-form-engine-no','qr-form-battery-model','qr-form-battery-sn','qr-form-front-motor-no','qr-form-rear-motor-no','qr-form-front-motor-sn','qr-form-rear-motor-sn','qr-form-vehicle-version','qr-form-latest-ota-time','qr-form-customer-name','qr-form-customer-phone','qr-form-prod-date','qr-form-delivery-date'];
      for (var i = 0; i < inputs.length; i++) {
        if (!readonly) {
          if (inputs[i].id === 'qr-form-contact-phone' && qrPanelMode==='detail') continue;
          if (fixedReadonlyIds.indexOf(inputs[i].id) !== -1) continue;
        }
        inputs[i].disabled = readonly;
        if (inputs[i].tagName==='INPUT' && inputs[i].type==='text') inputs[i].readOnly = readonly;
      }
      // 详情模式隐藏"选择模版"行；新增/编辑保留
      var hideItems = panel.querySelectorAll('[data-qr-hide-on="detail"]');
      hideItems.forEach(function(el){ el.style.display = (qrPanelMode === 'detail') ? 'none' : ''; });
      // "故障件维修情况"仅 HQ 详情显示；其他 5 种模式隐藏
      var repairSec = document.getElementById('qr-section-repair-status');
      if (repairSec) {
        repairSec.style.display = '';
      }
    }
    function qrToggleSection(name) {
      var sec = document.getElementById('qr-section-' + name);
      if (!sec) return;
      sec.classList.toggle('collapsed');
    }
    function qrOnArchiveChange(level) {
      var sel1 = document.getElementById('qr-form-archive-cat1');
      var sel2 = document.getElementById('qr-form-archive-cat2');
      var sel3 = document.getElementById('qr-form-archive-cat3');
      if (level === 1) {
        sel2.innerHTML = '<option value="">请选择</option>';
        sel3.innerHTML = '<option value="">请选择</option>';
        if (sel1.value && qrArchiveData[sel1.value]) {
          for (var k in qrArchiveData[sel1.value]) { sel2.innerHTML += '<option>' + k + '</option>'; }
        }
      } else if (level === 2) {
        sel3.innerHTML = '<option value="">请选择</option>';
        if (sel1.value && sel2.value && qrArchiveData[sel1.value] && qrArchiveData[sel1.value][sel2.value]) {
          qrArchiveData[sel1.value][sel2.value].forEach(function(v) { sel3.innerHTML += '<option>' + v + '</option>'; });
        }
      }
    }
    function qrOnRepairStatusChange() {
      var st = document.getElementById('qr-form-repair-status-state');
      var qc = document.getElementById('qr-form-quality-check-time');
      if (!st || !qc) return;
      var v = st.value;
      if ((v === '质检完毕' || v === '结算进行中' || v === '已结算') && !qc.value) {
        var d = new Date();
        var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
        qc.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
                 + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      }
    }
    function qrToggleFaultCode() {
      var sel = document.getElementById('qr-form-has-fault-code');
      var input = document.getElementById('qr-form-fault-code');
      if (!sel || !input) return;
      var isYes = sel.value === '是';
      if (isYes) {
        input.removeAttribute('disabled');
        input.setAttribute('required','');
        input.style.cursor = 'pointer';
        input.title = '点击搜索故障代码';
      } else {
        input.setAttribute('disabled','');
        input.removeAttribute('required');
        input.value = '';
        input.style.cursor = 'not-allowed';
        input.title = '';
        fcSelectedCodes = [];
      }
    }
    function qrShowCombobox(input, listId) {
      var list = document.getElementById(listId);
      if (list) list.classList.add('show');
    }
    function qrFilterCombobox(input) {
      var wrap = input.closest('.qr-combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      var val = input.value.toLowerCase();
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        item.classList.toggle('hidden', !item.textContent.toLowerCase().includes(val));
      });
    }
    function qrToggleComboboxArrow(listId) {
      var list = document.getElementById(listId);
      if (!list) return;
      list.classList.toggle('show');
      if (list.classList.contains('show')) {
        var inp = list.closest('.qr-combobox').querySelector('input');
        if (inp) inp.focus();
      }
    }
    function qrSelectCombobox(li, inputId, listId) {
      var input = document.getElementById(inputId);
      var list = document.getElementById(listId);
      if (input) input.value = li.textContent;
      if (list) list.classList.remove('show');
    }
    function qrOpenPartCodeLookup() {
      var mock = [
        {code:'PJ-00128', name:'高压线束总成', importance:'A', faultSystem:'电气系统', customer:'客户反映车辆偶尔无法启动，仪表显示"请检查高压系统"', condition:'车辆在电量30%以下、低温环境（<5℃）时出现，频率约每周1次', solution:'更换高压线束总成，检查接插件扭矩，更新BMS软件至V2.3.1', causeAnalysis:'高压线束接插件松动或氧化导致接触不良，BMS早期版本在低温下存在电压采样偏差', suggestion:'建议对该批次高压线束进行全面扭矩复检，并将BMS软件版本纳入定期升级计划'},
        {code:'PJ-00245', name:'电子水泵', importance:'B', faultSystem:'电气系统', customer:'水温偏高报警，空调制热效果差', condition:'车辆长时间上坡或高速行驶（>100km/h）时出现', solution:'更换电子水泵，检查冷却液管路，补充冷却液', causeAnalysis:'电子水泵内部叶轮磨损导致冷却液循环效率下降，高温工况下散热不足', suggestion:'建议在定期保养中增加冷却液循环效率检测，对使用超过3万公里的车辆主动排查水泵工况'},
        {code:'PJ-00371', name:'电机控制器', importance:'A', faultSystem:'电气系统', customer:'车辆行驶中突然失去动力，仪表多个故障灯亮', condition:'车辆在急加速（油门开度>80%）时出现，可复现', solution:'更换电机控制器，检查低压线束，刷新MCU软件', causeAnalysis:'电机控制器IGBT模块瞬时过流保护触发，低压线束存在信号干扰导致MCU误判', suggestion:'建议对同批次车辆推送MCU软件更新，并将低压线束抗干扰检测纳入出厂检测项'},
      ];
      var msg = '【原型模拟】请选择主故障件（输入序号）：\n';
      mock.forEach(function(item, idx){ msg += (idx+1) + '. ' + item.code + ' - ' + item.name + '\n'; });
      var choice = prompt(msg, '1');
      if (!choice) return;
      var idx = parseInt(choice) - 1;
      if (isNaN(idx) || idx < 0 || idx >= mock.length) { alert('无效选择'); return; }
      var sel = mock[idx];
      document.getElementById('qr-form-fault-part-code').value = sel.code;
      document.getElementById('qr-form-fault-part-reason').value = sel.name;
      document.getElementById('qr-form-importance').value = sel.importance;
      document.getElementById('qr-form-fault-system').value = sel.faultSystem;
      document.getElementById('qr-form-customer-complaint').value = sel.customer;
      document.getElementById('qr-form-fault-condition-full').value = sel.condition;
      document.getElementById('qr-form-repair-solution').value = sel.solution;


      alert('已自动带出关联信息，内容可手动修改');
    }
    function qrOpenFaultCodeModal() {
      fcInitMockData();
      document.getElementById('fc-modal-overlay').style.display = 'flex';
    }
    function qrCloseFaultCodeModal() {
      document.getElementById('fc-modal-overlay').style.display = 'none';
    }
    function qrFaultCodeConfirm() {
      if (fcSelectedCodes.length === 0) {
        alert('请至少选择一条故障代码');
        return;
      }
      var codes = fcSelectedCodes.map(function(s){ return s.displayCode; });
      document.getElementById('qr-form-fault-code').value = codes.join(', ');
      qrCloseFaultCodeModal();
    }
    function qrHandleImageUpload(files) {
      if (!files || !files.length) return;
      var maxCount = 5, maxSize = 10 * 1024 * 1024;
      for (var i = 0; i < files.length; i++) {
        if (qrUploadedImages.length >= maxCount) { alert('最多上传' + maxCount + '张图片'); break; }
        var f = files[i];
        var ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
        var extOk = ['.jpg','.jpeg','.png','.bmp'];
        if (extOk.indexOf(ext) === -1) { alert('图片格式不支持：' + f.name); continue; }
        if (f.size > maxSize) { alert('图片超大：' + f.name + '，单张≤10M'); continue; }
        (function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            qrUploadedImages.push({ name: file.name, dataUrl: e.target.result });
            qrRenderImagePreview();
          };
          reader.readAsDataURL(file);
        })(f);
      }
      var inp = document.getElementById('qr-image-input');
      if (inp) inp.value = '';
    }
    function qrHandleFileUpload(files) {
      if (!files || !files.length) return;
      var maxCount = 5, maxSize = 50 * 1024 * 1024;
      for (var i = 0; i < files.length; i++) {
        if (qrUploadedFiles.length >= maxCount) { alert('最多上传' + maxCount + '个附件'); break; }
        var f = files[i];
        if (f.size > maxSize) { alert('附件超大：' + f.name + '，单文件<50M'); continue; }
        qrUploadedFiles.push({ name: f.name, size: f.size });
      }
      qrRenderFileList();
      var inp = document.getElementById('qr-file-input');
      if (inp) inp.value = '';
    }
    function qrRenderImagePreview() {
      var wrap = document.getElementById('qr-image-preview');
      if (!wrap) return;
      wrap.innerHTML = '';
      qrUploadedImages.forEach(function(img, idx) {
        var div = document.createElement('div');
        div.className = 'thumb-wrap';
        div.innerHTML = '<img src="' + img.dataUrl + '" alt="' + img.name + '">'
          + '<button class="remove-btn" onclick="qrRemoveImage(' + idx + ')">×</button>';
        wrap.appendChild(div);
      });
    }
    function qrRenderFileList() {
      var wrap = document.getElementById('qr-file-list');
      if (!wrap) return;
      wrap.innerHTML = '';
      qrUploadedFiles.forEach(function(f, idx) {
        var div = document.createElement('div');
        div.className = 'file-item';
        var sizeStr = f.size > 1024*1024 ? (f.size/(1024*1024)).toFixed(1) + 'M' : Math.round(f.size/1024) + 'K';
        div.innerHTML = '<span class="file-name">' + f.name + '（' + sizeStr + '）</span>'
          + '<button class="remove-btn" onclick="qrRemoveFile(' + idx + ')">×</button>';
        wrap.appendChild(div);
      });
    }
    function qrRemoveImage(idx) {
      qrUploadedImages.splice(idx, 1);
      qrRenderImagePreview();
    }
    function qrRemoveFile(idx) {
      qrUploadedFiles.splice(idx, 1);
      qrRenderFileList();
    }
    function qrInitUploadDrag() {
      if (qrUploadDragInited) return;
      qrUploadDragInited = true;
      var imgArea = document.getElementById('qr-image-upload');
      var fileArea = document.getElementById('qr-file-upload');
      if (imgArea) {
        imgArea.addEventListener('dragover', function(e) { e.preventDefault(); imgArea.classList.add('dragover'); });
        imgArea.addEventListener('dragleave', function() { imgArea.classList.remove('dragover'); });
        imgArea.addEventListener('drop', function(e) {
          e.preventDefault(); imgArea.classList.remove('dragover');
          qrHandleImageUpload(e.dataTransfer.files);
        });
      }
      if (fileArea) {
        fileArea.addEventListener('dragover', function(e) { e.preventDefault(); fileArea.classList.add('dragover'); });
        fileArea.addEventListener('dragleave', function() { fileArea.classList.remove('dragover'); });
        fileArea.addEventListener('drop', function(e) {
          e.preventDefault(); fileArea.classList.remove('dragover');
          qrHandleFileUpload(e.dataTransfer.files);
        });
      }
    }
    function qrGenerateRepairParts(orderNo) {
      if (!orderNo) return [];
      var parts = [];
      var names = ['机油滤清器','刹车片','空调压缩机','转向器','中控屏','电池模组','传感器','减震器'];
      var codes = ['P001','P002','P003','P004','P005','P006','P007','P008'];
      var faultCodes = ['FP1001','FP1002','FP1003','FP1004','FP1005','FP1006','FP1007','FP1008'];
      var accountCats = ['保修','自费','索赔'];
      var itemTypes = ['一般维修','事故维修','保养'];
      var categories = ['机电','钣金','喷涂'];
      var seed = orderNo.charCodeAt(orderNo.length - 1) || 0;
      var count = (seed % 3) + 1;
      for (var i = 0; i < count; i++) {
        var idx = (seed + i) % 8;
        parts.push({
          seq: i + 1,
          partCode: codes[idx] + String(i + 1).padStart(3,'0'),
          partName: names[idx],
          faultPartCode: faultCodes[idx],
          accountCategory: accountCats[(seed + i) % 3],
          qty: (seed + i) % 3 + 1,
          repairItemType: itemTypes[(seed + i) % 3],
          repairCategory: categories[(seed + i) % 3]
        });
      }
      return parts;
    }
    function qrRenderRepairParts(orderNo) {
      var tbody = document.getElementById('qr-repair-parts-body');
      if (!tbody) return;
      tbody.innerHTML = '';
      var parts = qrRepairPartsMap[orderNo];
      if (!parts || !parts.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
        return;
      }
      parts.forEach(function(p) {
        tbody.innerHTML +=
          '<tr>' +
            '<td>' + p.seq + '</td>' +
            '<td>' + p.partCode + '</td>' +
            '<td>' + p.partName + '</td>' +
            '<td>' + p.faultPartCode + '</td>' +
            '<td>' + p.accountCategory + '</td>' +
            '<td>' + p.qty + '</td>' +
            '<td>' + p.repairItemType + '</td>' +
            '<td>' + p.repairCategory + '</td>' +
          '</tr>';
      });
    }

    // qr-combobox 点击外部关闭
    document.addEventListener('click', function(e){
      if (!e.target.closest('.qr-combobox')) {
        document.querySelectorAll('.qr-combobox .lt-datalist.show').forEach(function(l){ l.classList.remove('show'); });
      }
    });

    // ==================== 总部技术支持处理 模块 ====================
    // 注意：总部和门店共用 tsAllData，不单独维护 thqAllData
    var thqFilteredData = [];
    var thqCurrentPage = 1;
    var thqPageSize = 20;
    var thqFilterExpanded = false;

    function initThq() { thqFilteredData = tsAllData.slice(); thqCurrentPage = 1; thqRenderTable(); initFilterGrid('thq-filterGrid', THQ_SHOW_COUNT); var sel = document.getElementById('thq-flt-status'); if (sel) { sel.innerHTML = '<option value="">全部</option>'; tsStatuses.forEach(function(s) { sel.innerHTML += '<option>' + s + '</option>'; }); sel.value = '待技术援助答复'; } }
    function thqGetFiltered() {
      var orderNo = (document.getElementById('thq-flt-order-no')||{}).value || '';
      var carSeriesV = (document.getElementById('thq-flt-car-series')||{}).value || '';
      var carModel = (document.getElementById('thq-flt-car-model')||{}).value || '';
      var applyType = (document.getElementById('thq-flt-apply-type')||{}).value || '';
      var status = (document.getElementById('thq-flt-status')||{}).value || '';
      var vin = (document.getElementById('thq-flt-vin')||{}).value || '';
      var subject = (document.getElementById('thq-flt-subject')||{}).value || '';
      var faultStart = (document.getElementById('thq-flt-fault-start')||{}).value || '';
      var faultEnd = (document.getElementById('thq-flt-fault-end')||{}).value || '';
      var faultSystem = (document.getElementById('thq-flt-fault-system')||{}).value || '';
      var faultNature = (document.getElementById('thq-flt-fault-nature')||{}).value || '';
      var prodStart = (document.getElementById('thq-flt-prod-start')||{}).value || '';
      var prodEnd = (document.getElementById('thq-flt-prod-end')||{}).value || '';
      var submitStart = (document.getElementById('thq-flt-submit-start')||{}).value || '';
      var submitEnd = (document.getElementById('thq-flt-submit-end')||{}).value || '';
      var store = (document.getElementById('thq-flt-store')||{}).value || '';
      var province = (document.getElementById('thq-flt-province')||{}).value || '';
      var city = (document.getElementById('thq-flt-city')||{}).value || '';
      var archiveCategory = (document.getElementById('thq-flt-archive-category')||{}).value || '';
      var repairOrder = (document.getElementById('thq-flt-repair-order')||{}).value || '';
      var complaintOrder = (document.getElementById('thq-flt-complaint-order')||{}).value || '';
      var isPdi = (document.getElementById('thq-flt-is-pdi')||{}).value || '';
      var pdiOrder = (document.getElementById('thq-flt-pdi-order')||{}).value || '';
      var alarmOrder = (document.getElementById('thq-flt-alarm-order')||{}).value || '';
      return tsAllData.filter(function(r) {
        if (orderNo && r.orderNo.toLowerCase().indexOf(orderNo.toLowerCase()) < 0) return false;
        if (carSeriesV && r.carSeries.toLowerCase().indexOf(carSeriesV.toLowerCase()) < 0) return false;
        if (carModel && r.carModel.toLowerCase().indexOf(carModel.toLowerCase()) < 0) return false;
        if (status && r.status !== status) return false;
        if (vin && r.vin.toLowerCase().indexOf(vin.toLowerCase()) < 0) return false;
        if (subject && r.subject.toLowerCase().indexOf(subject.toLowerCase()) < 0) return false;
        if (faultStart && r.faultDate < faultStart) return false;
        if (faultEnd && r.faultDate > faultEnd) return false;
        if (faultSystem && r.faultSystem !== faultSystem) return false;
        if (faultNature && r.faultNature !== faultNature) return false;
        if (prodStart && r.prodDate < prodStart) return false;
        if (prodEnd && r.prodDate > prodEnd) return false;
        if (submitStart && r.submitDate < submitStart) return false;
        if (submitEnd && r.submitDate > submitEnd) return false;
        if (store && r.storeName.toLowerCase().indexOf(store.toLowerCase()) < 0) return false;
        if (province && r.province !== province) return false;
        if (city && r.city !== city) return false;
        if (archiveCategory && r.archiveCategory !== archiveCategory) return false;
        if (repairOrder && r.repairOrder.toLowerCase().indexOf(repairOrder.toLowerCase()) < 0) return false;
        if (complaintOrder && r.complaintOrder.toLowerCase().indexOf(complaintOrder.toLowerCase()) < 0) return false;
        if (isPdi && r.isPdi !== isPdi) return false;
        if (pdiOrder && r.pdiOrder.toLowerCase().indexOf(pdiOrder.toLowerCase()) < 0) return false;
        if (alarmOrder && r.alarmOrder.toLowerCase().indexOf(alarmOrder.toLowerCase()) < 0) return false;
        return true;
      });
    }
    function thqApplyFilter() { thqFilteredData = thqGetFiltered(); thqCurrentPage = 1; thqRenderTable(); }
    function thqResetFilter() {
      var ids = ['thq-flt-order-no','thq-flt-car-series','thq-flt-car-model','thq-flt-status','thq-flt-vin','thq-flt-subject','thq-flt-fault-start','thq-flt-fault-end','thq-flt-fault-system','thq-flt-fault-nature','thq-flt-prod-start','thq-flt-prod-end','thq-flt-submit-start','thq-flt-submit-end','thq-flt-store','thq-flt-province','thq-flt-city','thq-flt-archive-category','thq-flt-repair-order','thq-flt-complaint-order','thq-flt-is-pdi','thq-flt-pdi-order','thq-flt-alarm-order'];
      ids.forEach(function(id) { var el = document.getElementById(id); if (el) { if (el.tagName==='SELECT') el.value=''; else el.value=''; } });
      thqFilteredData = tsAllData.slice(); thqCurrentPage = 1; thqRenderTable();
    }
    function thqRenderTable() {
      var tbody = document.getElementById('thq-tbody'); if (!tbody) return;
      var start = (thqCurrentPage - 1) * thqPageSize, end = start + thqPageSize;
      var page = thqFilteredData.slice(start, end);
      var h = '';
      for (var i = 0; i < page.length; i++) {
        var r = page[i], idx = start + i + 1;
        h += '<tr><td class="sticky col-seq">'+idx+'</td><td class="sticky col-order-no">'+(r.orderNo||'')+'</td><td class="sticky col-status">'+(r.status||'')+'</td><td class="col-province">'+(r.province||'')+'</td><td class="col-city">'+(r.city||'')+'</td><td class="col-store-name">'+(r.storeName||'')+'</td><td class="col-store-code">'+(r.storeCode||'')+'</td><td class="col-submit-date">'+(r.submitDate||'')+'</td><td class="col-car-series">'+(r.carSeries||'')+'</td><td class="col-subject">'+(r.subject||'')+'</td><td class="col-importance">'+(r.importance||'')+'</td><td class="col-repair-order">'+(r.repairOrder||'')+'</td><td class="col-complaint-order">'+(r.complaintOrder||'')+'</td><td class="col-pdi-order">'+(r.pdiOrder||'')+'</td><td class="col-alarm-order">'+(r.alarmOrder||'')+'</td><td class="col-archive-category">'+(r.archiveCategory||'')+'</td><td class="col-vin">'+(r.vin||'')+'</td><td class="col-fault-date">'+(r.faultDate||'')+'</td><td class="col-fault-system">'+(r.faultSystem||'')+'</td><td class="col-fault-nature">'+(r.faultNature||'')+'</td><td class="col-prod-date">'+(r.prodDate||'')+'</td><td class="sticky col-actions"><div class="op-links"><a href="javascript:void(0)" onclick="tsOpenDetail('+r.id+',\'hq\')">详情</a></div></td></tr>';
      }
      tbody.innerHTML = h;
      thqRenderPager();
    }
    function thqRenderPager() {
      var total = thqFilteredData.length, pages = Math.ceil(total / thqPageSize);
      document.getElementById('thq-pg-total').textContent = '共 ' + total + ' 条';
      document.getElementById('thq-pg-prev').disabled = thqCurrentPage <= 1;
      document.getElementById('thq-pg-next').disabled = thqCurrentPage >= pages;
      var pgH = '';
      for (var i = 1; i <= pages; i++) { pgH += '<span class="pg-num'+(i===thqCurrentPage?' active':'')+'" onclick="thqGotoPage('+i+')">'+i+'</span>'; }
      document.getElementById('thq-pg-pages').innerHTML = pgH;
    }
    function thqChangePage(delta) { var pages = Math.ceil(thqFilteredData.length / thqPageSize); thqCurrentPage = Math.max(1, Math.min(pages, thqCurrentPage + delta)); thqRenderTable(); }
    function thqGotoPage(p) { var pages = Math.ceil(thqFilteredData.length / thqPageSize); thqCurrentPage = Math.max(1, Math.min(pages, parseInt(p)||1)); thqRenderTable(); }
    function thqChangePageSize(sz) { thqPageSize = parseInt(sz); thqCurrentPage = 1; thqRenderTable(); }
    function thqExportData() { alert('导出'); }
    function thqToggleFilter() { thqFilterExpanded = !thqFilterExpanded; toggleFilterGrid('thq-filterGrid', thqFilterExpanded, THQ_SHOW_COUNT); }
    function thqFilterCombobox(input) { var wrap = input.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (!list) return; var val = input.value.toLowerCase(); var its = list.querySelectorAll('li'); for (var m = 0; m < its.length; m++) { its[m].classList.toggle('hidden', !its[m].textContent.toLowerCase().includes(val)); } }
    function thqShowCombobox(input) { var wrap = input.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (list) list.classList.add('show'); }
    function thqToggleCombobox(arrow) { var wrap = arrow.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (!list) return; list.classList.toggle('show'); }
    function thqSelectCombobox(li) { var wrap = li.closest('.lt-input-wrap.combobox'); if (!wrap) return; var inp = wrap.querySelector('input'); var list = wrap.querySelector('.lt-datalist'); if (inp) inp.value = li.textContent; if (list) list.classList.remove('show'); thqApplyFilter(); }

    // ==================== 总部质量报告处理 模块 ====================
    var QRHQ_SHOW_COUNT = 7; // 总部质量报告处理
    var qrhqAllData = [];
    var qrhqFilteredData = [];
    var qrhqCurrentPage = 1;
    var qrhqPageSize = 20;
    var qrhqFilterExpanded = false;

    (function initQrhqMockData() {
      var statuses = ['待提交','审核中','审核中','已退回','已驳回','审核通过'];
      var stores = ['深圳福田店','广州天河店','上海浦东店','北京朝阳店','成都武侯店'];
      var storeCodes = ['SZFT001','GZTH002','SHPD003','BJCH004','CDWH005'];
      var provinces = ['广东','广东','上海','北京','四川'];
      var cities = ['深圳','广州','上海','北京','成都'];
      var carSeries = ['秦PLUS','宋Pro','汉EV','唐DM-i','海豹'];
      var faultSystems = ['发动机系统','变速箱系统','制动系统','电气系统','空调系统'];
      var faultNatures = ['产品质量','使用问题','维修导致'];
      var archiveCategories = ['发动机','变速箱','电气','底盘','车身'];
      var subjects = ['质量缺陷分析报告','零部件可靠性评估','焊接工艺异常','漆面质量问题','装配精度偏差','材料批次不合格'];
      var vins = ['LC0C76C4XM0001234','LGXC16DF8M0002567','LBEKBGKA0MZ003890','LLV3B2A15M0004456','LGWEE7A5XM0006721'];
      var importances = ['A','B','A','C','B'];
      var partCodes = ['EP-1001','GB-2002','BR-3003','ST-4004','AC-6006'];
      var partNames = ['发动机总成','变速箱总成','制动卡钳','转向器总成','压缩机总成'];
      var customerComplaints = [
        '客户反馈车辆在冷启动时发动机有明显异响，怠速时更明显，热车后异响减弱但仍存在，影响驾驶感受。',
        '客户在2挡升3挡时出现明显顿挫，伴随轻微抖动，已经过4S店常规检查未解决。',
        '客户反馈轻踩刹车时有"吱吱"异响，速度越快异响越明显，紧急制动时正常。',
        '客户反映低速打方向时方向盘有明显卡顿，高速行驶时方向稳定，担心存在安全隐患。',
        '客户开空调10分钟后出风口温度仍偏高，制冷效果差，4S店已加氟但未解决。'
      ];
      var faultConditions = [
        '冷启动后2分钟内、怠速状态下发动机前端出现"嗒嗒"金属敲击声，热车10分钟后减弱。',
        '车速30-50km/h、2挡升3挡瞬间出现明显冲击感，伴随转速表轻微波动。',
        '低速5-20km/h、轻踩刹车时前轮位置出现尖锐"吱吱"声，连续制动后消失。',
        '车速0-15km/h、原地打方向时方向盘有明显阻滞感，超过20km/h后方向恢复正常。',
        '环境温度30℃以上、车辆暴晒后开空调，10分钟内出风口温度仍偏高。'
      ];
      var repairSolutions = [
        '1. 使用听诊器定位异响源；2. 检查正时链条张紧度；3. 必要时更换张紧器或链条。',
        '1. 用诊断仪读取变速箱数据流；2. 检查变速箱油液位及品质；3. 必要时升级TCU程序。',
        '1. 举升车辆检查刹车片厚度；2. 检查刹车盘表面平整度；3. 必要时更换刹车片。',
        '1. 检查转向助力油液位；2. 用诊断仪读取EPS数据流；3. 必要时更换转向器。',
        '1. 检查冷凝器散热情况；2. 检漏并补充制冷剂；3. 检查压缩机工作状态。'
      ];
      for (var i = 0; i < 30; i++) {
        var idx = i % 5;
        var d = new Date();
        d.setDate(d.getDate() - i * 2);
        var ds = d.toISOString().split('T')[0];
        qrhqAllData.push({
          id:i+1, orderNo:'QR2026' + String(i+1).padStart(4,'0'), status:statuses[i%6],
          province:provinces[idx], city:cities[idx], storeName:stores[idx], storeCode:storeCodes[idx],
          submitDate:ds, carSeries:carSeries[idx], subject:subjects[i%6],
          archiveCategory:archiveCategories[i%5], vin:vins[idx],
          faultDate:ds, faultSystem:faultSystems[i%5], faultNature:faultNatures[i%3],
          prodDate:'2024-0'+(i%9+1)+'-'+String((i%28)+1).padStart(2,'0'),
          carModel:'2024款', applyType:'故障诊断',
          importance:importances[idx],
          faultPartCode:partCodes[idx], faultPartName:partNames[idx],
          customerComplaint:customerComplaints[idx],
          faultCondition:faultConditions[idx],
          repairSolution:repairSolutions[idx],
          causeAnalysis:'根据故障码和检查结果，初步判断为相关部件老化或异常磨损导致，需拆解后进一步确认具体损伤程度。',
          suggestion:'建议更换故障件后跟踪观察至少1周，确认故障不再复现。如批次性问题，建议汇总后反馈供应商。',
          hasFaultCode: i%3===0?'是':'否',
          faultCode: i%3===0?'P00'+String(i+1).padStart(2,'0') : '',
          hasRepairCase: i%4===0?'是':'否',
          repairCaseNo: i%4===0?'RC2026'+String(i+1).padStart(4,'0') : '',
          submitter: ['张三','李四','王五','赵六','钱七'][i%5],
          contactPhone: '1' + String(60000000000+i).slice(1)
        });
      }
      qrhqFilteredData = qrhqAllData.slice();
    })();

    function initQrhq() { qrhqFilteredData = qrhqAllData.slice(); qrhqCurrentPage = 1; qrhqRenderTable(); initFilterGrid('qrhq-filterGrid', QRHQ_SHOW_COUNT); var st = document.getElementById('qrhq-flt-status'); if (st) st.value = '审核中'; }
    function qrhqGetFiltered() {
      var orderNo = (document.getElementById('qrhq-flt-order-no')||{}).value || '';
      var carSeriesV = (document.getElementById('qrhq-flt-car-series')||{}).value || '';
      var carModel = (document.getElementById('qrhq-flt-car-model')||{}).value || '';
      var status = (document.getElementById('qrhq-flt-status')||{}).value || '';
      var vin = (document.getElementById('qrhq-flt-vin')||{}).value || '';
      var subject = (document.getElementById('qrhq-flt-subject')||{}).value || '';
      var faultStart = (document.getElementById('qrhq-flt-fault-start')||{}).value || '';
      var faultEnd = (document.getElementById('qrhq-flt-fault-end')||{}).value || '';
      var faultSystem = (document.getElementById('qrhq-flt-fault-system')||{}).value || '';
      var faultNature = (document.getElementById('qrhq-flt-fault-nature')||{}).value || '';
      var prodStart = (document.getElementById('qrhq-flt-prod-start')||{}).value || '';
      var prodEnd = (document.getElementById('qrhq-flt-prod-end')||{}).value || '';
      var submitStart = (document.getElementById('qrhq-flt-submit-start')||{}).value || '';
      var submitEnd = (document.getElementById('qrhq-flt-submit-end')||{}).value || '';
      var store = (document.getElementById('qrhq-flt-store')||{}).value || '';
      var province = (document.getElementById('qrhq-flt-province')||{}).value || '';
      var city = (document.getElementById('qrhq-flt-city')||{}).value || '';
      var repairOrder = (document.getElementById('qrhq-flt-repair-order')||{}).value || '';
      var complaintOrder = (document.getElementById('qrhq-flt-complaint-order')||{}).value || '';
      var isPdi = (document.getElementById('qrhq-flt-is-pdi')||{}).value || '';
      var pdiOrder = (document.getElementById('qrhq-flt-pdi-order')||{}).value || '';
      var alarmOrder = (document.getElementById('qrhq-flt-alarm-order')||{}).value || '';
      return qrhqAllData.filter(function(r) {
        if (orderNo && r.orderNo.toLowerCase().indexOf(orderNo.toLowerCase()) < 0) return false;
        if (carSeriesV && r.carSeries.toLowerCase().indexOf(carSeriesV.toLowerCase()) < 0) return false;
        if (carModel && r.carModel.toLowerCase().indexOf(carModel.toLowerCase()) < 0) return false;
        if (status && r.status !== status) return false;
        if (vin && r.vin.toLowerCase().indexOf(vin.toLowerCase()) < 0) return false;
        if (subject && r.subject.toLowerCase().indexOf(subject.toLowerCase()) < 0) return false;
        if (faultStart && r.faultDate < faultStart) return false;
        if (faultEnd && r.faultDate > faultEnd) return false;
        if (faultSystem && r.faultSystem !== faultSystem) return false;
        if (faultNature && r.faultNature !== faultNature) return false;
        if (prodStart && r.prodDate < prodStart) return false;
        if (prodEnd && r.prodDate > prodEnd) return false;
        if (submitStart && r.submitDate < submitStart) return false;
        if (submitEnd && r.submitDate > submitEnd) return false;
        if (store && r.storeName.toLowerCase().indexOf(store.toLowerCase()) < 0) return false;
        if (province && r.province !== province) return false;
        if (city && r.city !== city) return false;
        if (archiveCategory && r.archiveCategory !== archiveCategory) return false;
        if (repairOrder && r.repairOrder.toLowerCase().indexOf(repairOrder.toLowerCase()) < 0) return false;
        if (complaintOrder && r.complaintOrder.toLowerCase().indexOf(complaintOrder.toLowerCase()) < 0) return false;
        if (isPdi && r.isPdi !== isPdi) return false;
        if (pdiOrder && r.pdiOrder.toLowerCase().indexOf(pdiOrder.toLowerCase()) < 0) return false;
        if (alarmOrder && r.alarmOrder.toLowerCase().indexOf(alarmOrder.toLowerCase()) < 0) return false;
        return true;
      });
    }
    function qrhqApplyFilter() { qrhqFilteredData = qrhqGetFiltered(); qrhqCurrentPage = 1; qrhqRenderTable(); }
    function qrhqResetFilter() {
      var ids = ['qrhq-flt-order-no','qrhq-flt-car-series','qrhq-flt-car-model','qrhq-flt-status','qrhq-flt-vin','qrhq-flt-subject','qrhq-flt-fault-start','qrhq-flt-fault-end','qrhq-flt-fault-system','qrhq-flt-fault-nature','qrhq-flt-prod-start','qrhq-flt-prod-end','qrhq-flt-submit-start','qrhq-flt-submit-end','qrhq-flt-store','qrhq-flt-province','qrhq-flt-city','qrhq-flt-repair-order','qrhq-flt-complaint-order','qrhq-flt-is-pdi','qrhq-flt-pdi-order','qrhq-flt-alarm-order'];
      ids.forEach(function(id) { var el = document.getElementById(id); if (el) { if (el.tagName==='SELECT') el.value=''; else el.value=''; } });
      qrhqFilteredData = qrhqAllData.slice(); qrhqCurrentPage = 1; qrhqRenderTable();
    }
    function qrhqRenderTable() {
      var tbody = document.getElementById('qrhq-tbody'); if (!tbody) return;
      var start = (qrhqCurrentPage - 1) * qrhqPageSize, end = start + qrhqPageSize;
      var page = qrhqFilteredData.slice(start, end);
      var h = '';
      for (var i = 0; i < page.length; i++) {
        var r = page[i], idx = start + i + 1;
        h += '<tr><td class="sticky col-seq">'+idx+'</td><td class="sticky col-order-no">'+(r.orderNo||'')+'</td><td class="sticky col-status">'+(r.status||'')+'</td><td class="col-province">'+(r.province||'')+'</td><td class="col-city">'+(r.city||'')+'</td><td class="col-store-name">'+(r.storeName||'')+'</td><td class="col-store-code">'+(r.storeCode||'')+'</td><td class="col-submit-date">'+(r.submitDate||'')+'</td><td class="col-car-series">'+(r.carSeries||'')+'</td><td class="col-subject">'+(r.subject||'')+'</td><td class="col-importance">'+(r.importance||'')+'</td><td class="col-repair-order">'+(r.repairOrder||'')+'</td><td class="col-complaint-order">'+(r.complaintOrder||'')+'</td><td class="col-pdi-order">'+(r.pdiOrder||'')+'</td><td class="col-alarm-order">'+(r.alarmOrder||'')+'</td><td class="col-vin">'+(r.vin||'')+'</td><td class="col-fault-date">'+(r.faultDate||'')+'</td><td class="col-fault-system">'+(r.faultSystem||'')+'</td><td class="col-fault-nature">'+(r.faultNature||'')+'</td><td class="col-prod-date">'+(r.prodDate||'')+'</td><td class="sticky col-actions"><div class="op-links"><a href="javascript:void(0)" onclick="qrOpenDetail('+r.id+',\'hq\')">详情</a></div></td></tr>';
      }
      tbody.innerHTML = h;
      qrhqRenderPager();
    }
    function qrhqRenderPager() {
      var total = qrhqFilteredData.length, pages = Math.ceil(total / qrhqPageSize);
      document.getElementById('qrhq-pg-total').textContent = '共 ' + total + ' 条';
      document.getElementById('qrhq-pg-prev').disabled = qrhqCurrentPage <= 1;
      document.getElementById('qrhq-pg-next').disabled = qrhqCurrentPage >= pages;
      var pgH = '';
      for (var i = 1; i <= pages; i++) { pgH += '<span class="pg-num'+(i===qrhqCurrentPage?' active':'')+'" onclick="qrhqGotoPage('+i+')">'+i+'</span>'; }
      document.getElementById('qrhq-pg-pages').innerHTML = pgH;
    }
    function qrhqChangePage(delta) { var pages = Math.ceil(qrhqFilteredData.length / qrhqPageSize); qrhqCurrentPage = Math.max(1, Math.min(pages, qrhqCurrentPage + delta)); qrhqRenderTable(); }
    function qrhqGotoPage(p) { var pages = Math.ceil(qrhqFilteredData.length / qrhqPageSize); qrhqCurrentPage = Math.max(1, Math.min(pages, parseInt(p)||1)); qrhqRenderTable(); }
    function qrhqChangePageSize(sz) { qrhqPageSize = parseInt(sz); qrhqCurrentPage = 1; qrhqRenderTable(); }
    function qrhqExportData() { alert('导出'); }
    function qrhqToggleFilter() { qrhqFilterExpanded = !qrhqFilterExpanded; toggleFilterGrid('qrhq-filterGrid', qrhqFilterExpanded, QRHQ_SHOW_COUNT); }
    function qrhqFilterCombobox(input) { var wrap = input.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (!list) return; var val = input.value.toLowerCase(); var its = list.querySelectorAll('li'); for (var m = 0; m < its.length; m++) { its[m].classList.toggle('hidden', !its[m].textContent.toLowerCase().includes(val)); } }
    function qrhqShowCombobox(input) { var wrap = input.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (list) list.classList.add('show'); }
    function qrhqToggleCombobox(arrow) { var wrap = arrow.closest('.lt-input-wrap.combobox'); if (!wrap) return; var list = wrap.querySelector('.lt-datalist'); if (!list) return; list.classList.toggle('show'); }
    function qrhqSelectCombobox(li) { var wrap = li.closest('.lt-input-wrap.combobox'); if (!wrap) return; var inp = wrap.querySelector('input'); var list = wrap.querySelector('.lt-datalist'); if (inp) inp.value = li.textContent; if (list) list.classList.remove('show'); qrhqApplyFilter(); }

    // ==================== 技术支持模板 模块 ====================
    var qrtAllData = [];
    var qrtFilteredData = [];
    var qrtCurrentPage = 1;
    var qrtPageSize = 20;
    var qrtEditMode = 'add';
    var qrtEditId = null;

    (function initQrtMockData() {
      var names = ['发动机异响诊断模板','变速箱换挡顿挫诊断','刹车异响检测流程','转向系统检测模板','电气系统综合诊断','空调制冷故障检测','底盘异响排查模板','车身共振检测流程'];
      var statuses = ['启用','启用','启用','启用','启用','停用','启用','停用'];
      var faultSystems = ['发动机系统','变速箱系统','制动系统','转向系统','电气系统','空调系统','底盘系统','车身系统'];
      var importances = ['A','B','A','C','B','D','B','C'];
      var partCodes = ['EP-1001','GB-2002','BR-3003','ST-4004','EL-5005','AC-6006','CH-7007','BD-8008'];
      var partNames = ['发动机总成','变速箱总成','制动卡钳','转向器总成','电控模块','压缩机总成','悬挂弹簧','车身冲压件'];
      var updaters = ['张三','李四','王五','赵六','陈七','刘八','周九','吴十'];
      var customerComplaints = [
        '客户反馈车辆在冷启动时发动机有明显异响，怠速时更明显，热车后异响减弱但仍存在，影响驾驶感受。',
        '客户在2挡升3挡时出现明显顿挫，伴随轻微抖动，已经过4S店常规检查未解决。',
        '客户反馈轻踩刹车时有"吱吱"异响，速度越快异响越明显，紧急制动时正常。',
        '客户反映低速打方向时方向盘有明显卡顿，高速行驶时方向稳定，担心存在安全隐患。',
        '客户反馈大屏偶发黑屏、倒车影像不显示，已经影响正常用车，希望尽快维修。',
        '客户开空调10分钟后出风口温度仍偏高，制冷效果差，4S店已加氟但未解决。',
        '客户在过减速带时底盘出现"咚咚"异响，怀疑悬挂或稳定杆问题。',
        '客户反馈高速行驶时车身有共振现象，后视镜有明显抖动，已经做了四轮定位未解决。'
      ];
      var faultConditions = [
        '冷启动后2分钟内、怠速状态下发动机前端出现"嗒嗒"金属敲击声，热车10分钟后减弱。',
        '车速30-50km/h、2挡升3挡瞬间出现明显冲击感，伴随转速表轻微波动。',
        '低速5-20km/h、轻踩刹车时前轮位置出现尖锐"吱吱"声，连续制动后消失。',
        '车速0-15km/h、原地打方向时方向盘有明显阻滞感，超过20km/h后方向恢复正常。',
        '车辆启动后5-15分钟内大屏偶发黑屏1-3秒，倒车时影像偶发不显示。',
        '环境温度30℃以上、车辆暴晒后开空调，10分钟内出风口温度仍偏高。',
        '车速10km/h以下、过减速带或坑洼时底盘出现"咚咚"低频声，平路行驶无异响。',
        '车速80-120km/h、匀速行驶时车身出现低频共振，后视镜明显抖动。'
      ];
      var repairSolutions = [
        '1. 使用听诊器定位异响源；2. 检查正时链条张紧度；3. 必要时更换张紧器或链条。',
        '1. 用诊断仪读取变速箱数据流；2. 检查变速箱油液位及品质；3. 必要时升级TCU程序。',
        '1. 举升车辆检查刹车片厚度；2. 检查刹车盘表面平整度；3. 必要时更换刹车片。',
        '1. 检查转向助力油液位；2. 用诊断仪读取EPS数据流；3. 必要时更换转向器。',
        '1. 检查大屏电源及CAN线连接；2. 升级车机系统至最新版本；3. 必要时更换大屏总成。',
        '1. 检查冷凝器散热情况；2. 检漏并补充制冷剂；3. 检查压缩机工作状态。',
        '1. 举升车辆目视检查悬挂件；2. 逐一拆检稳定杆胶套、平衡杆；3. 必要时更换。',
        '1. 高速试车确认共振点；2. 检查发动机舱及底盘隔振垫；3. 必要时追加隔振措施。'
      ];
      for (var i = 0; i < 16; i++) {
        var idx = i % 8;
        var d = new Date();
        d.setDate(d.getDate() - i * 5);
        var ds = d.toISOString().split('T')[0];
        var timeStr = ' ' + String(Math.floor(Math.random()*24)).padStart(2,'0') + ':' + String(Math.floor(Math.random()*60)).padStart(2,'0');
        qrtAllData.push({
          id:i+1, name:names[idx]+(i>7?'（副本）':''), status:statuses[idx],
          updateTime:ds+timeStr, updater:updaters[idx],
          faultPartCode:partCodes[idx], faultPartName:partNames[idx],
          importance:importances[idx], faultSystem:faultSystems[idx],
          customerComplaint:customerComplaints[idx],
          faultCondition:faultConditions[idx],
          repairSolution:repairSolutions[idx]
        });
      }
      qrtFilteredData = qrtAllData.slice();
    })();

    function initQrt() { qrtFilteredData = qrtAllData.slice(); qrtCurrentPage = 1; qrtRenderTable(); }
    function qrtGetFiltered() {
      var name = (document.getElementById('qrt-flt-name')||{}).value || '';
      var status = (document.getElementById('qrt-flt-status')||{}).value || '';
      return qrtAllData.filter(function(r) {
        if (name && r.name.toLowerCase().indexOf(name.toLowerCase()) < 0) return false;
        if (status && r.status !== status) return false;
        return true;
      });
    }
    function qrtApplyFilter() { qrtFilteredData = qrtGetFiltered(); qrtCurrentPage = 1; qrtRenderTable(); }
    function qrtResetFilter() {
      document.getElementById('qrt-flt-name').value = '';
      document.getElementById('qrt-flt-status').value = '';
      qrtFilteredData = qrtAllData.slice(); qrtCurrentPage = 1; qrtRenderTable();
    }
    function qrtRenderTable() {
      var tbody = document.getElementById('qrt-tbody'); if (!tbody) return;
      var start = (qrtCurrentPage - 1) * qrtPageSize, end = start + qrtPageSize;
      var page = qrtFilteredData.slice(start, end);
      var h = '';
      for (var i = 0; i < page.length; i++) {
        var r = page[i], idx = start + i + 1;
        h += '<tr><td class="sticky col-seq">'+idx+'</td><td class="col-template-name">'+r.name+'</td><td class="col-fault-name">'+(r.faultPartName||'')+'</td><td class="col-fault-code">'+(r.faultPartCode||'')+'</td><td class="col-importance">'+(r.importance||'')+'</td><td class="col-fault-system">'+(r.faultSystem||'')+'</td><td class="col-status">'+r.status+'</td><td class="col-operator">'+r.updater+'</td><td class="col-time">'+r.updateTime+'</td><td class="sticky col-actions"><div class="op-links"><a href="javascript:void(0)" onclick="qrtOpenDetail('+r.id+')">详情</a><a href="javascript:void(0)" onclick="qrtOpenEditPanel('+r.id+')">编辑</a></div></td></tr>';
      }
      tbody.innerHTML = h;
      qrtRenderPager();
    }
    function qrtRenderPager() {
      var total = qrtFilteredData.length, pages = Math.ceil(total / qrtPageSize);
      document.getElementById('qrt-pg-total').textContent = '共 ' + total + ' 条';
      document.getElementById('qrt-pg-prev').disabled = qrtCurrentPage <= 1;
      document.getElementById('qrt-pg-next').disabled = qrtCurrentPage >= pages;
      var pgH = '';
      for (var i = 1; i <= pages; i++) { pgH += '<span class="pg-num'+(i===qrtCurrentPage?' active':'')+'" onclick="qrtGotoPage('+i+')">'+i+'</span>'; }
      document.getElementById('qrt-pg-pages').innerHTML = pgH;
    }
    function qrtChangePage(delta) { var pages = Math.ceil(qrtFilteredData.length / qrtPageSize); qrtCurrentPage = Math.max(1, Math.min(pages, qrtCurrentPage + delta)); qrtRenderTable(); }
    function qrtGotoPage(p) { var pages = Math.ceil(qrtFilteredData.length / qrtPageSize); qrtCurrentPage = Math.max(1, Math.min(pages, parseInt(p)||1)); qrtRenderTable(); }
    function qrtChangePageSize(sz) { qrtPageSize = parseInt(sz); qrtCurrentPage = 1; qrtRenderTable(); }
    function qrtExportData() { alert('导出'); }

    // 模板弹窗
    // ==================== 质量报告模板详情/编辑面板 ====================
    var qrtPanelMode = 'detail'; // detail / edit / add
    var qrtCurrentItem = null;

    function qrtOpenDetail(id) {
      var item = qrtAllData.find(function(r){return r.id===id;});
      if (!item) return;
      qrtPanelMode = 'detail';
      qrtCurrentItem = item;
      document.getElementById('qrt-panel-title').textContent = '质量报告模板';
      document.getElementById('qrt-panel-badge').textContent = '详情';
      document.getElementById('qrt-panel-badge').className = 'qrt-panel-mode-badge detail';
      qrtFillPanelForm(item);
      qrtSetPanelReadonly(true);
      document.getElementById('qrt-panel').classList.add('show');
      document.getElementById('qrt-panel-overlay').classList.add('show');
      qrtUpdatePanelButtons();
    }
    function qrtOpenEditPanel(id) {
      var item = qrtAllData.find(function(r){return r.id===id;});
      if (!item) return;
      qrtPanelMode = 'edit';
      qrtCurrentItem = item;
      document.getElementById('qrt-panel-title').textContent = '质量报告模板';
      document.getElementById('qrt-panel-badge').textContent = '编辑';
      document.getElementById('qrt-panel-badge').className = 'qrt-panel-mode-badge edit';
      qrtFillPanelForm(item);
      qrtSetPanelReadonly(false);
      document.getElementById('qrt-panel').classList.add('show');
      document.getElementById('qrt-panel-overlay').classList.add('show');
      qrtUpdatePanelButtons();
    }
    function qrtOpenAddPanel() {
      qrtPanelMode = 'add';
      qrtCurrentItem = null;
      document.getElementById('qrt-panel-title').textContent = '质量报告模板';
      document.getElementById('qrt-panel-badge').textContent = '新增';
      document.getElementById('qrt-panel-badge').className = 'qrt-panel-mode-badge add';
      qrtClearPanelForm();
      qrtSetPanelReadonly(false);
      document.getElementById('qrt-panel').classList.add('show');
      document.getElementById('qrt-panel-overlay').classList.add('show');
    }
    function qrtClosePanel() {
      document.getElementById('qrt-panel').classList.remove('show');
      document.getElementById('qrt-panel-overlay').classList.remove('show');
    }
    function qrtSetPanelReadonly(ro) {
      var ids = ['qrt-form-name','qrt-form-status','qrt-form-customer-complaint','qrt-form-fault-condition-full','qrt-form-repair-solution','qrt-form-fault-part-code','qrt-form-fault-part-name','qrt-form-importance','qrt-form-fault-system','qrt-form-conclusion'];
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'SELECT') {
          el.disabled = ro;
        } else {
          el.readOnly = ro;
        }
      });
    }
    function qrtFillPanelForm(item) {
      if (!item) return;
      document.getElementById('qrt-form-name').value = item.name || '';
      document.getElementById('qrt-form-status').value = item.status || '启用';
      document.getElementById('qrt-form-customer-complaint').value = item.customerComplaint || '';
      document.getElementById('qrt-form-fault-condition-full').value = item.faultCondition || '';
      document.getElementById('qrt-form-repair-solution').value = item.repairSolution || '';
      document.getElementById('qrt-form-fault-part-code').value = item.faultPartCode || '';
      document.getElementById('qrt-form-fault-part-name').value = item.faultPartName || '';
      document.getElementById('qrt-form-importance').value = item.importance || '';
      document.getElementById('qrt-form-fault-system').value = item.faultSystem || '';
      document.getElementById('qrt-form-conclusion').value = item.conclusion || '';
      // 回填故障系统、故障描述、故障码、维修案例
      if (document.getElementById('qrt-form-fault-description')) document.getElementById('qrt-form-fault-description').value = item.faultDescription || '';
      document.getElementById('qrt-form-subject').value = item.subject || '';
      if (document.getElementById('qrt-form-has-fault-code')) document.getElementById('qrt-form-has-fault-code').value = item.hasFaultCode || '';
      if (document.getElementById('qrt-form-fault-code')) document.getElementById('qrt-form-fault-code').value = item.faultCode || '';
      if (document.getElementById('qrt-form-has-repair-case')) document.getElementById('qrt-form-has-repair-case').value = item.hasRepairCase || '';
      if (document.getElementById('qrt-form-repair-case-no')) document.getElementById('qrt-form-repair-case-no').value = item.repairCaseNo || '';
      // 回填关单人、关单时间
      if (document.getElementById('qrt-form-close-user')) document.getElementById('qrt-form-close-user').value = item.closeUser || '';
      if (document.getElementById('qrt-form-close-time')) document.getElementById('qrt-form-close-time').value = item.closeTime || '';
    }
    function qrtClearPanelForm() {
      var ids = ['qrt-form-name','qrt-form-customer-complaint','qrt-form-fault-condition-full','qrt-form-repair-solution','qrt-form-fault-part-code','qrt-form-fault-part-name','qrt-form-conclusion','qrt-form-fault-description','qrt-form-subject','qrt-form-fault-code','qrt-form-repair-case-no','qrt-form-close-user','qrt-form-close-time'];
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('qrt-form-status').value = '启用';
      document.getElementById('qrt-form-importance').value = '';
      document.getElementById('qrt-form-fault-system').value = '';
      if (document.getElementById('qrt-form-has-fault-code')) document.getElementById('qrt-form-has-fault-code').value = '';
      if (document.getElementById('qrt-form-has-repair-case')) document.getElementById('qrt-form-has-repair-case').value = '';
    }
    function qrtUpdatePanelButtons() {
      var topDiv = document.getElementById('qrt-panel-actions');
      var bottomDiv = document.getElementById('qrt-panel-bottom-actions');
      if (!topDiv || !bottomDiv) return;
      var topBtns = '', bottomBtns = '';
      if (qrtPanelMode === 'add') {
        topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrtSavePanel()">保存</button>';
        bottomBtns = '';
      } else if (qrtPanelMode === 'edit') {
        topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrtSavePanel()">保存</button>';
        bottomBtns = '';
      } else if (qrtPanelMode === 'detail') {
        topBtns = '<button class="lt-btn lt-btn-primary" onclick="qrtOpenEditPanel(qrtCurrentItem.id)">编辑</button>';
        bottomBtns = '';
      }
      topDiv.innerHTML = topBtns;
      bottomDiv.innerHTML = bottomBtns;
    }
    function qrtSavePanel() {
      if (!qrtCurrentItem && qrtPanelMode !== 'add') return;
      var name = document.getElementById('qrt-form-name').value.trim();
      if (!name) { alert('请输入模板名称'); document.getElementById('qrt-form-name').focus(); return; }
      var now = new Date();
      var nowStr = now.toISOString().split('T')[0] + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
      var dataObj = {
        name: name,
        status: document.getElementById('qrt-form-status').value,
        faultPartCode: document.getElementById('qrt-form-fault-part-code').value.trim(),
        faultPartName: document.getElementById('qrt-form-fault-part-name').value.trim(),
        importance: document.getElementById('qrt-form-importance').value,
        faultSystem: document.getElementById('qrt-form-fault-system').value,
        customerComplaint: document.getElementById('qrt-form-customer-complaint').value,
        faultCondition: document.getElementById('qrt-form-fault-condition-full').value,
        repairSolution: document.getElementById('qrt-form-repair-solution').value,
        conclusion: document.getElementById('qrt-form-conclusion').value
      };
      if (qrtPanelMode === 'add') {
        qrtAllData.push(Object.assign({
          id: qrtAllData.length + 1,
          updateTime: nowStr,
          updater: '当前用户'
        }, dataObj));
      } else {
        var item = qrtAllData.find(function(r){return r.id === qrtCurrentItem.id;});
        if (item) {
          Object.assign(item, dataObj);
          item.updateTime = nowStr;
        }
      }
      qrtClosePanel();
      qrtFilteredData = qrtGetFiltered();
      qrtRenderTable();
      alert('保存成功');
    }
    function qrtToggleSection(name) {
      var body = document.getElementById('qrt-section-' + name + ' .qr-section-body');
      if (body) {
        body.style.display = body.style.display === 'none' ? '' : 'none';
      }
    }


    // ========== 菜单快速搜索 ==========
    (function() {
      var searchInput = document.getElementById('menuSearchInput');
      var searchDropdown = document.getElementById('menuSearchDropdown');
      if (!searchInput || !searchDropdown) return;

      // 1. 构建菜单索引
      var menuIndex = [];
      var allMenuItemEls = document.querySelectorAll('[data-module]');
      allMenuItemEls.forEach(function(el) {
        var module = el.getAttribute('data-module');
        var text = el.textContent.trim();
        if (!text) return;
        // 一级菜单
        var navItem = el.closest('.nav-item');
        var l1 = '';
        if (navItem) {
          var l1El = navItem.querySelector('.nav-link .nav-text');
          if (l1El) l1 = l1El.textContent.trim();
        }
        // 二级菜单（如果有嵌套子菜单）
        var l2 = '';
        var nested = el.closest('.submenu-nested');
        if (nested) {
          var l2El = nested.previousElementSibling;
          if (l2El && l2El.classList.contains('submenu-item') && !l2El.hasAttribute('data-module')) {
            l2 = l2El.textContent.trim();
          }
        }
        var path = l2 ? (l1 + ' > ' + l2) : l1;
        var fullText = l2 ? (l1 + ' > ' + l2 + ' > ' + text) : (l1 + ' > ' + text);
        menuIndex.push({
          el: el,
          module: module,
          text: text,
          l1: l1,
          l2: l2,
          path: path,
          fullText: fullText.toLowerCase()
        });
      });

      // 2. 模糊搜索 + 高亮匹配字符
      function fuzzyMatch(item, query) {
        if (query.length === 0) return false;
        return item.fullText.indexOf(query) !== -1;
      }

      function highlightText(text, query) {
        if (!query) return escapeHtml(text);
        var lower = text.toLowerCase();
        var idx = lower.indexOf(query);
        if (idx === -1) return escapeHtml(text);
        var before = escapeHtml(text.substring(0, idx));
        var match = escapeHtml(text.substring(idx, idx + query.length));
        var after = escapeHtml(text.substring(idx + query.length));
        return before + '<span class="menu-search-highlight">' + match + '</span>' + after;
      }

      function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
      }

      // 3. 渲染下拉列表
      function renderDropdown(results, query) {
        searchDropdown.innerHTML = '';
        if (results.length === 0) {
          searchDropdown.innerHTML = '<div class="menu-search-empty">未找到匹配的菜单</div>';
        } else {
          results.forEach(function(item, idx) {
            var div = document.createElement('div');
            div.className = 'menu-search-item';
            div.setAttribute('data-module', item.module);
            div.setAttribute('data-idx', idx);
            var shortPath = item.path.length > 18 ? item.path.substring(0, 17) + '...' : item.path;
            div.innerHTML =
              '<span class="search-text">' + highlightText(item.text, query) + '</span>' +
              '<span class="search-path">' + escapeHtml(shortPath) + '</span>';
            searchDropdown.appendChild(div);
          });
        }
        // 重置键盘选中索引
        keyActiveIdx = -1;
      }

      // 4. 导航到目标菜单
      function navigateToModule(module, item) {
        // 展开所有父级菜单
        var submenuNested = item.el.closest('.submenu-nested');
        if (submenuNested) {
          submenuNested.classList.add('open');
          // 展开二级
          var parentSubmenu = submenuNested.closest('.submenu');
          if (parentSubmenu) {
            parentSubmenu.classList.add('open');
          }
        } else {
          // 二级菜单
          var submenu = item.el.closest('.submenu');
          if (submenu) {
            submenu.classList.add('open');
          }
        }
        // 切换页面
        showContent(module);
        // 关闭搜索下拉
        searchDropdown.classList.remove('show');
        searchInput.value = '';
        searchInput.blur();
      }

      // 5. 搜索入口
      function doSearch() {
        var query = searchInput.value.trim().toLowerCase();
        if (query.length === 0) {
          searchDropdown.classList.remove('show');
          return;
        }
        var results = [];
        for (var i = 0; i < menuIndex.length; i++) {
          if (fuzzyMatch(menuIndex[i], query)) {
            results.push(menuIndex[i]);
          }
        }
        // 按匹配位置排序（文本开头匹配优先）
        results.sort(function(a, b) {
          var ai = a.fullText.indexOf(query);
          var bi = b.fullText.indexOf(query);
          if (ai !== bi) return ai - bi;
          return a.fullText.length - b.fullText.length;
        });
        renderDropdown(results, query);
        searchDropdown.classList.add('show');
      }

      // 6. 键盘导航
      var keyActiveIdx = -1;
      function updateKeyActive() {
        var items = searchDropdown.querySelectorAll('.menu-search-item');
        items.forEach(function(el, idx) {
          if (idx === keyActiveIdx) {
            el.classList.add('key-active');
          } else {
            el.classList.remove('key-active');
          }
        });
        // 滚动到可见区域
        var activeEl = searchDropdown.querySelector('.key-active');
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }
      }

      searchInput.addEventListener('keydown', function(e) {
        var items = searchDropdown.querySelectorAll('.menu-search-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (searchDropdown.classList.contains('show') && items.length > 0) {
            keyActiveIdx = Math.min(keyActiveIdx + 1, items.length - 1);
            updateKeyActive();
          } else {
            doSearch();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (searchDropdown.classList.contains('show') && items.length > 0) {
            keyActiveIdx = Math.max(keyActiveIdx - 1, 0);
            updateKeyActive();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (searchDropdown.classList.contains('show') && keyActiveIdx >= 0 && items[keyActiveIdx]) {
            var itemEl = items[keyActiveIdx];
            var module = itemEl.getAttribute('data-module');
            var idx = parseInt(itemEl.getAttribute('data-idx'), 10);
            var found = null;
            for (var i = 0; i < menuIndex.length; i++) {
              if (menuIndex[i].module === module) { found = menuIndex[i]; break; }
            }
            if (found) navigateToModule(module, found);
          }
        } else if (e.key === 'Escape') {
          searchDropdown.classList.remove('show');
          searchInput.value = '';
          keyActiveIdx = -1;
        }
      });

      searchInput.addEventListener('input', function() {
        keyActiveIdx = -1;
        doSearch();
      });

      searchInput.addEventListener('focus', function() {
        if (searchInput.value.trim().length > 0) {
          doSearch();
        }
      });

      // 点击搜索结果
      searchDropdown.addEventListener('click', function(e) {
        var itemEl = e.target.closest('.menu-search-item');
        if (!itemEl) return;
        var module = itemEl.getAttribute('data-module');
        var found = null;
        for (var i = 0; i < menuIndex.length; i++) {
          if (menuIndex[i].module === module) { found = menuIndex[i]; break; }
        }
        if (found) navigateToModule(module, found);
      });

      // 点击外部关闭下拉
      document.addEventListener('click', function(e) {
        var wrap = document.getElementById('menuSearchWrap');
        if (wrap && !wrap.contains(e.target)) {
          searchDropdown.classList.remove('show');
          keyActiveIdx = -1;
        }
      });

      // 点击搜索框内部时阻止冒泡
      searchInput.addEventListener('click', function(e) {
        e.stopPropagation();
        if (searchInput.value.trim().length > 0) {
          doSearch();
        }
      });
    })();
    // ========== 菜单快速搜索 结束 ==========

    // ===== qrt- 函数（从 qr- 原样复制，qr-→qrt-） =====
    var qrtUploadedImages = [];
    var qrtUploadedFiles = [];

    function qrtToggleSection(name) {
      var sec = document.getElementById('qrt-section-' + name);
      if (!sec) return;
      sec.classList.toggle('collapsed');
    }

    function qrtOnArchiveChange(level) {
      var sel1 = document.getElementById('qrt-form-archive-cat1');
      var sel2 = document.getElementById('qrt-form-archive-cat2');
      var sel3 = document.getElementById('qrt-form-archive-cat3');
      if (level === 1) {
        sel2.innerHTML = '<option value="">请选择</option>';
        sel3.innerHTML = '<option value="">请选择</option>';
        if (sel1.value && qrArchiveData[sel1.value]) {
          for (var k in qrArchiveData[sel1.value]) { sel2.innerHTML += '<option>' + k + '</option>'; }
        }
      } else if (level === 2) {
        sel3.innerHTML = '<option value="">请选择</option>';
        if (sel1.value && sel2.value && qrArchiveData[sel1.value] && qrArchiveData[sel1.value][sel2.value]) {
          qrArchiveData[sel1.value][sel2.value].forEach(function(v) { sel3.innerHTML += '<option>' + v + '</option>'; });
        }
      }
    }

    function qrtToggleFaultCode() {
      var sel = document.getElementById('qrt-form-has-fault-code');
      var input = document.getElementById('qrt-form-fault-code');
      if (!sel || !input) return;
      var isYes = sel.value === '是';
      if (isYes) {
        input.removeAttribute('disabled');
        input.setAttribute('required','');
        input.style.cursor = 'pointer';
        input.title = '点击搜索故障代码';
      } else {
        input.setAttribute('disabled','');
        input.removeAttribute('required');
        input.value = '';
        input.style.cursor = 'not-allowed';
        input.title = '';
        fcSelectedCodes = [];
      }
    }

    function qrtShowCombobox(input, listId) {
      var list = document.getElementById(listId);
      if (list) list.classList.add('show');
    }

    function qrtFilterCombobox(input) {
      var wrap = input.closest('.qr-combobox');
      if (!wrap) return;
      var list = wrap.querySelector('.lt-datalist');
      if (!list) return;
      var val = input.value.toLowerCase();
      var items = list.querySelectorAll('li');
      items.forEach(function(item) {
        item.classList.toggle('hidden', !item.textContent.toLowerCase().includes(val));
      });
    }

    function qrtToggleComboboxArrow(listId) {
      var list = document.getElementById(listId);
      if (!list) return;
      list.classList.toggle('show');
      if (list.classList.contains('show')) {
        var inp = list.closest('.qr-combobox').querySelector('input');
        if (inp) inp.focus();
      }
    }

    function qrtSelectCombobox(li, inputId, listId) {
      var input = document.getElementById(inputId);
      var list = document.getElementById(listId);
      if (input) input.value = li.textContent;
      if (list) list.classList.remove('show');
    }

    function qrtOpenPartCodeLookup() {
      var mock = [
        {code:'PJ-00128', name:'高压线束总成', importance:'A', faultSystem:'电气系统', customer:'客户反映车辆偶尔无法启动，仪表显示"请检查高压系统"', condition:'车辆在电量30%以下、低温环境（<5℃）时出现，频率约每周1次', solution:'更换高压线束总成，检查接插件扭矩，更新BMS软件至V2.3.1', causeAnalysis:'高压线束接插件松动或氧化导致接触不良，BMS早期版本在低温下存在电压采样偏差', suggestion:'建议对该批次高压线束进行全面扭矩复检，并将BMS软件版本纳入定期升级计划'},
        {code:'PJ-00245', name:'电子水泵', importance:'B', faultSystem:'电气系统', customer:'水温偏高报警，空调制热效果差', condition:'车辆长时间上坡或高速行驶（>100km/h）时出现', solution:'更换电子水泵，检查冷却液管路，补充冷却液', causeAnalysis:'电子水泵内部叶轮磨损导致冷却液循环效率下降，高温工况下散热不足', suggestion:'建议在定期保养中增加冷却液循环效率检测，对使用超过3万公里的车辆主动排查水泵工况'},
      ];
      var msg = '【原型模拟】请选择主故障件（输入序号）：\n';
      mock.forEach(function(item, idx){ msg += (idx+1) + '. ' + item.code + ' - ' + item.name + '\n'; });
      var choice = prompt(msg, '1');
      if (!choice) return;
      var idx = parseInt(choice) - 1;
      if (isNaN(idx) || idx < 0 || idx >= mock.length) { alert('无效选择'); return; }
      var sel = mock[idx];
      document.getElementById('qrt-form-fault-part-code').value = sel.code;
      document.getElementById('qrt-form-fault-part-name').value = sel.name;
      var imp = document.getElementById('qrt-form-importance');
      if (imp) imp.value = sel.importance;
      var fs = document.getElementById('qrt-form-fault-system');
      if (fs) fs.value = sel.faultSystem;
      var cc = document.getElementById('qrt-form-customer-complaint');
      if (cc) cc.value = sel.customer;
      var fc = document.getElementById('qrt-form-fault-condition-full');
      if (fc) fc.value = sel.condition;
      var rs = document.getElementById('qrt-form-repair-solution');
      if (rs) rs.value = sel.solution;
      alert('已自动带出关联信息，内容可手动修改');
    }

    function qrtOpenFaultCodeModal() {
      fcInitMockData();
      document.getElementById('fc-modal-overlay').style.display = 'flex';
    }

    function qrtHandleImageUpload(files) {
      if (!files || !files.length) return;
      var maxCount = 5, maxSize = 10 * 1024 * 1024;
      for (var i = 0; i < files.length; i++) {
        if (qrtUploadedImages.length >= maxCount) { alert('最多上传' + maxCount + '张图片'); break; }
        var f = files[i];
        var ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
        var extOk = ['.jpg','.jpeg','.png','.bmp'];
        if (extOk.indexOf(ext) === -1) { alert('图片格式不支持：' + f.name); continue; }
        if (f.size > maxSize) { alert('图片超大：' + f.name + '，单张≤10M'); continue; }
        (function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            qrtUploadedImages.push({ name: file.name, dataUrl: e.target.result });
            qrtRenderImagePreview();
          };
          reader.readAsDataURL(file);
        })(f);
      }
      var inp = document.getElementById('qrt-image-input');
      if (inp) inp.value = '';
    }

    function qrtHandleFileUpload(files) {
      if (!files || !files.length) return;
      var maxCount = 5, maxSize = 50 * 1024 * 1024;
      for (var i = 0; i < files.length; i++) {
        if (qrtUploadedFiles.length >= maxCount) { alert('最多上传' + maxCount + '个附件'); break; }
        var f = files[i];
        if (f.size > maxSize) { alert('附件超大：' + f.name + '，单文件<50M'); continue; }
        qrtUploadedFiles.push({ name: f.name, size: f.size });
      }
      qrtRenderFileList();
      var inp = document.getElementById('qrt-file-input');
      if (inp) inp.value = '';
    }

    function qrtRenderImagePreview() {
      var wrap = document.getElementById('qrt-image-preview');
      if (!wrap) return;
      wrap.innerHTML = '';
      qrtUploadedImages.forEach(function(img, idx) {
        var div = document.createElement('div');
        div.className = 'thumb-wrap';
        div.innerHTML = '<img src="' + img.dataUrl + '" alt="' + img.name + '">'
          + '<button class="remove-btn" onclick="qrtRemoveImage(' + idx + ')">×</button>';
        wrap.appendChild(div);
      });
    }

    function qrtRenderFileList() {
      var wrap = document.getElementById('qrt-file-list');
      if (!wrap) return;
      wrap.innerHTML = '';
      qrtUploadedFiles.forEach(function(f, idx) {
        var div = document.createElement('div');
        div.className = 'file-item';
        var sizeStr = f.size > 1024*1024 ? (f.size/(1024*1024)).toFixed(1) + 'M' : Math.round(f.size/1024) + 'K';
        div.innerHTML = '<span class="file-name">' + f.name + '（' + sizeStr + '）</span>'
          + '<button class="remove-btn" onclick="qrtRemoveFile(' + idx + ')">×</button>';
        wrap.appendChild(div);
      });
    }

    function qrtRemoveImage(idx) {
      qrtUploadedImages.splice(idx, 1);
      qrtRenderImagePreview();
    }

    function qrtRemoveFile(idx) {
      qrtUploadedFiles.splice(idx, 1);
      qrtRenderFileList();
    }
