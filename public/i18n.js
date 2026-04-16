// Panshaker i18n System
(function () {
    const T = {
        zh: {
            // Common
            loading: '加载中...',
            networkError: '网络错误',
            logout: '注销退出',
            deptPlaceholder: '请选择...',

            // Login page
            loginPageTitle: '系统登录 - Panshaker',
            loginWindowTitle: '系统登录',
            welcomeText: '欢迎使用 Panshaker 工时系统',
            accountLabel: '账号:',
            passwordLabel: '密码:',
            loginAccountPH: '输入数字账号',
            loginPasswordPH: '输入密码',
            registerLink: '注册新账号',
            loginBtn: '登录',
            registerWindowTitle: '注册新账号',
            nameLabel: '姓名:',
            deptLabel: '部门:',
            regAccountPH: '设置一个数字账号',
            regPasswordPH: '设置登录密码',
            regNamePH: '真实姓名',
            backToLogin: '返回登录',
            registerBtn: '注册',
            regSuccess: '注册成功！正在跳转登录...',
            fillAllFields: '请填写所有字段',
            accountNotReg: '账号未注册，请先注册',
            loginFailed: '登录失败',
            regFailed: '注册失败',

            // Index page
            indexPageTitle: 'Panshaker 工作记录系统',
            mainWindowTitle: '海外工时记录系统',
            basicInfoLegend: '基本信息',
            taskLabel: 'Panshaker 工作内容:',
            taskPH: '例如: 开发海外官网后台',
            workTimeLegend: '工作时间',
            startTimeLabel: '开始时间:',
            endTimeLabel: '结束时间:',
            resetBtn: '重置',
            submitBtn: '提交记录',
            recentTitle: '提交记录',
            thID: 'ID',
            thTask: '项目/内容',
            thDuration: '耗时',
            thAction: '操作',
            deleteBtn: '删除',
            noRecords: '暂无近期提交记录',
            submitSuccess: '提交成功！',
            submitFailed: '提交失败: ',
            endAfterStart: '错误: 结束时间必须晚于开始时间！',
            confirmDelete: '确定删除该记录？',
            deleteFailed: '删除失败',
            loadFailed: '加载失败',

            // Stats page
            statsPageTitle: '当月工时统计 - Panshaker',
            statsWindowTitle: '海外项目当月国内工时核算',
            selectMonthLabel: '选择月份:',
            queryBtn: '查询',
            exportBtn: '导出 Excel',
            exportDisabledInMiniProgram: '微信小程序内不支持直接下载 Excel，请在浏览器中导出。',
            thName: '姓名',
            thDept: '部门',
            thTotalHours: '累计投入工时 (小时)',
            grandTotalLabel: '总计:',
            noData: '该月无数据。',
            employeeDetailTitle: '员工详情',
            thDate: '日期',
            thTimeRange: '时间段',
            thTaskContent: '工作内容',
            thHours: '计入工时',
            noDetail: '无详细记录。',
            accountMgmtTitle: '账户管理',
            thAccount: '账号',
            thAccHours: '累计工时',
            thOps: '操作',
            viewBtn: '查看',
            deleteUserBtn: '删除',
            noUsers: '暂无注册账户',
            userRecordsTitle: '账户记录',
            monthLabel: '月份:',
            selectMonthFirst: '请选择月份查询',
            selectMonthPrompt: '请选择月份',
            noMonthRecords: '该月无记录',
            userDeleted: '账户已删除',
            selectMonthAlert: '请先选择月份',
            editBtn: '编辑',
            editUserTitle: '编辑账户',
            passwordFieldLabel: '密码:',
            saveBtn: '保存',
            saveSuccess: '保存成功',
            saveFailed: '保存失败',
            forgotPassword: '忘记密码?',
            forgotPasswordMsg: '请联系管理员重置密码',
            accountFieldLabel: '账号:',
            nameFieldLabel: '姓名:',

            // Finance module
            financeBtn: '财务测算',
            financePageTitle: '财务测算 - Panshaker',
            financeWindowTitle: 'Panshaker 美国分公司 财务测算',
            scenarioLabel: '场景:',
            saveAsBtn: '另存为',
            displayCurrencyLabel: '显示单位:',
            cashflowWindowLabel: '现金流:',
            refreshFxBtn: '刷新汇率',
            aiBtn: 'AI 建议售价',
            exportFinanceBtn: '导出 Excel',
            dashboardTitle: 'Dashboard - 关键杠杆与预警',
            kpiFirstPayMonths: '首期月数',
            kpiDepositMonths: '押金月数',
            kpiMinMonths: '最低租期(月)',
            kpiEtf: '提前退租费',
            kpiActivationFee: '激活费 (一次性不退)',
            kpiActivationFeeHint: '建议 $1000-3000 改善首月现金流',
            kpiUnitCost: '单台基础成本',
            kpiUnitCostHint: '未含海运/关税/美国内陆',
            kpiUsCommission: '美国成交方提成%',
            kpiCnCommission: '中国引流方提成%',
            kpiCnAttach: '中国引流占比',
            effCommissionLabel: '有效综合提成率:',
            priceSymbolHintLabel: '金额单位跟随上方',
            unitCostBannerTitle: '单台综合成本',
            tabForecast: '销量预测',
            tabEmployees: '员工',
            employeesTitle: '员工薪酬',
            addEmployeeBtn: '+ 添加员工',
            employeesHelp: '录入每个员工的月薪（税前 gross 或 税后 net），系统自动加上雇主薪酬税合并到月度固定成本。Net→Gross 默认按 28% 员工综合个税率换算。',
            empColName: '姓名',
            empColPosition: '职位',
            empColType: '税前/税后',
            empColAmount: '月薪',
            empColOps: '操作',
            taxHelp: '销售在 Delaware 不产生州销售税；各州 Sales Tax 表在下方「美国各州销售税」里。',
            taxEmployerPayroll: '雇主薪酬税合计',
            locationTitle: '公司所在地',
            locZip: 'ZIP:',
            detectState: '识别州',
            locState: '州:',
            locNotes: '备注:',
            useStateDefault: '用州默认值',
            estOceanBtn: '估算深圳→LA',
            estInlandBtn: '估算 LA→客户',
            estInlandTo: '→ ZIP:',
            estInlandHint: '默认从 ZIP 90001 (LA) 出发',
            dimensionsTitle: '设备尺寸/重量',
            dimCrated: '打木架后尺寸:',
            dimBare: '裸机尺寸:',
            dimCBM: '体积:',
            dimWeight: '毛重:',
            kpiBuyoutPrice: '买断售价',
            kpiLeaseFirstPay: '租赁首期',
            kpiLeaseRent: '月租金',
            kpiLeaseFirstPayMonths: '首期月数（租 N 月）',
            kpiLeaseDepositMonths: '押金月数（押 M 月）',
            kpiLeaseMinMonths: '最低租期（月）',
            kpiLeaseETF: '提前退租费',
            kpiLeaseRatio: '租售比 (0–1)',
            kpiUnitCost: '单台到岸前成本',
            kpiConversion: '线索成交率',
            kpiTotalLeads: '总线索数/期',
            kpiUsefulLife: '设备使用寿命（月）',
            alertBuyout: '买断盈利',
            alertLease: '租赁 LTV',
            alertCashflow: '月度现金流',
            kpiSummary: '关键数字',
            tabBuyout: '买断明细',
            tabLease: '租赁明细',
            tabOpex: '月度费用预算',
            tabCustom: '自定义成本项',
            tabSettings: '场景与设置',
            buyoutDetailTitle: '买断利润模型（根据 Excel 原表重构，输入即时联动）',
            leaseDetailTitle: '租赁利润模型（含押金/最低租期/提前退租/按月现金流）',
            leaseMonthlyTitle: '按月现金流',
            opexTitle: '月度固定费用预算（USD，可直接修改）',
            addOpexBtn: '+ 添加科目',
            customTitle: '自定义成本项（未来扩展）',
            addCustomBtn: '+ 添加成本项',
            customHelp: '单位 per_unit=每台一次性 / per_customer=每客户一次性 / per_month=每月固定 / once=一次性',
            customColName: '名称',
            customColUnit: '单位',
            customColValue: '金额 (USD)',
            customColApplies: '适用于',
            customColOps: '操作',
            customEmpty: '暂无自定义成本项。点击「+ 添加成本项」。',
            metaTitle: '元信息',
            metaCompanyState: '公司州',
            metaDestState: '目的州',
            metaFxRate: '汇率 USD→CNY',
            metaNotes: '备注',
            taxTitle: '税率（美国）',
            taxFederal: '联邦企业所得税',
            taxStateCorp: '州企业所得税',
            taxFranchise: 'Franchise Tax (年/USD)',
            taxFICA: 'FICA 雇主端',
            taxFUTA: 'FUTA',
            taxSUTA: 'SUTA',
            taxBenefits: '福利占工资比例',
            productTitle: '产品与到岸成本',
            productName: '产品名',
            productUnitCost: '单台基础成本 (USD)',
            productOcean: '海运 USD/台',
            productDuty: '进口关税率',
            productPort: '港口杂费 USD/台',
            productInland: '美国内陆 USD/台',
            productWarehouse: '仓储 USD/月',
            productInstall: '上门培训 USD/客户',
            productWarranty: '质保 USD/台',
            productShipping: '客户运输 USD/台',
            productAds: '广告 USD/台',
            commissionTitle: '中美跨境销售提成（US-CN TOB）',
            commissionHelp: '行业惯例：总提成池约 5%，按 40% 中国引流方 / 60% 美国成交方分成；中国引流占比指有多少美国成交的客户来自中国团队推荐，默认 30%。',
            commissionUs: '美国成交方提成率',
            commissionUsHint: '默认 0.03 (3%)',
            commissionCn: '中国引流方提成率',
            commissionCnHint: '默认 0.02 (2%)',
            commissionAttach: '中国引流占比 (attach rate)',
            commissionAttachHint: '默认 0.30',
            commissionOther: '其他提成/奖励',
            commissionOtherHint: '默认 0.01 (1%)',
            commissionEffective: '有效综合提成率：',
            commissionFormula: '= US + CN × Attach + Other',
            removeBtn: '删除',
            salesTaxTitle: '美国各州销售税（可编辑，保存覆盖默认）',
            saveTaxBtn: '保存税表',
            resetTaxBtn: '重置默认',
            forecastTitle: '月度销量预测（单位：台）',
            opexSubject: '科目',
            opexTotal: '合计',
            opexOps: '操作',
            opexSumLabel: '月度小计',
            thGroup: '类别',
            thItem: '项目',
            thValue: '数值',
            aiTitle: 'AI 建议售价 (GLM-4.5-Air)',
            aiIntro: '基于当前完整场景（成本/价格/税率/租赁政策/中美跨境提成/销量预测）与竞品信息，调用智谱 GLM-4.5-Air 生成推荐定价。',
            aiCallBtn: '调用 AI 生成建议',
            aiApplyBtn: '应用到当前场景',
            saveAsTitle: '另存为新场景',
            saveAsNameLabel: '场景名:',
            cancelBtn: '取消',
        },
        en: {
            // Common
            loading: 'Loading...',
            networkError: 'Network error',
            logout: 'Logout',
            deptPlaceholder: 'Select...',

            // Login page
            loginPageTitle: 'Login - Panshaker',
            loginWindowTitle: 'System Login',
            welcomeText: 'Welcome to Panshaker Time Tracking',
            accountLabel: 'Account:',
            passwordLabel: 'Password:',
            loginAccountPH: 'Enter account number',
            loginPasswordPH: 'Enter password',
            registerLink: 'Register',
            loginBtn: 'Login',
            registerWindowTitle: 'Register Account',
            nameLabel: 'Name:',
            deptLabel: 'Dept:',
            regAccountPH: 'Set account number',
            regPasswordPH: 'Set password',
            regNamePH: 'Real name',
            backToLogin: 'Back to Login',
            registerBtn: 'Register',
            regSuccess: 'Registered! Redirecting...',
            fillAllFields: 'Please fill in all fields',
            accountNotReg: 'Account not registered',
            loginFailed: 'Login failed',
            regFailed: 'Registration failed',

            // Index page
            indexPageTitle: 'Panshaker Work Records',
            mainWindowTitle: 'Work Time Recorder',
            basicInfoLegend: 'Basic Info',
            taskLabel: 'Panshaker Task:',
            taskPH: 'e.g. Develop overseas website',
            workTimeLegend: 'Work Time',
            startTimeLabel: 'Start:',
            endTimeLabel: 'End:',
            resetBtn: 'Reset',
            submitBtn: 'Submit',
            recentTitle: 'Recent Records',
            thID: 'ID',
            thTask: 'Task',
            thDuration: 'Duration',
            thAction: 'Action',
            deleteBtn: 'Delete',
            noRecords: 'No recent records',
            submitSuccess: 'Submitted!',
            submitFailed: 'Submit failed: ',
            endAfterStart: 'Error: End time must be after start!',
            confirmDelete: 'Delete this record?',
            deleteFailed: 'Delete failed',
            loadFailed: 'Load failed',

            // Stats page
            statsPageTitle: 'Monthly Stats - Panshaker',
            statsWindowTitle: 'Monthly Work Hours Summary',
            selectMonthLabel: 'Month:',
            queryBtn: 'Query',
            exportBtn: 'Export Excel',
            exportDisabledInMiniProgram: 'Excel download is not supported inside WeChat mini program. Please export in a browser.',
            thName: 'Name',
            thDept: 'Department',
            thTotalHours: 'Total Hours',
            grandTotalLabel: 'Total:',
            noData: 'No data for this month.',
            employeeDetailTitle: 'Employee Details',
            thDate: 'Date',
            thTimeRange: 'Time',
            thTaskContent: 'Task',
            thHours: 'Hours',
            noDetail: 'No records found.',
            accountMgmtTitle: 'Account Management',
            thAccount: 'Account',
            thAccHours: 'Total Hours',
            thOps: 'Actions',
            viewBtn: 'View',
            deleteUserBtn: 'Delete',
            noUsers: 'No registered accounts',
            userRecordsTitle: 'User Records',
            monthLabel: 'Month:',
            selectMonthFirst: 'Select a month',
            selectMonthPrompt: 'Select month',
            noMonthRecords: 'No records this month',
            userDeleted: 'Account deleted',
            selectMonthAlert: 'Please select a month',
            editBtn: 'Edit',
            editUserTitle: 'Edit Account',
            passwordFieldLabel: 'Password:',
            saveBtn: 'Save',
            saveSuccess: 'Saved',
            saveFailed: 'Save failed',
            forgotPassword: 'Forgot password?',
            forgotPasswordMsg: 'Please contact admin to reset password',
            accountFieldLabel: 'Account:',
            nameFieldLabel: 'Name:',

            // Finance module
            financeBtn: 'Finance',
            financePageTitle: 'Finance - Panshaker',
            financeWindowTitle: 'Panshaker US - Financial Modeling',
            scenarioLabel: 'Scenario:',
            saveAsBtn: 'Save As',
            displayCurrencyLabel: 'Display:',
            cashflowWindowLabel: 'Cashflow:',
            refreshFxBtn: 'Refresh FX',
            aiBtn: 'AI Pricing',
            exportFinanceBtn: 'Export Excel',
            dashboardTitle: 'Dashboard - Key Levers & Alerts',
            kpiFirstPayMonths: 'First-pay months',
            kpiDepositMonths: 'Deposit months',
            kpiMinMonths: 'Min lease (mo)',
            kpiEtf: 'Early term. fee',
            kpiActivationFee: 'Activation fee (non-refundable)',
            kpiActivationFeeHint: 'Recommend $1000-3000 to fix month-1 cashflow',
            kpiUnitCost: 'Unit base cost',
            kpiUnitCostHint: 'Excludes ocean/duty/US inland',
            kpiUsCommission: 'US closer %',
            kpiCnCommission: 'CN referrer %',
            kpiCnAttach: 'CN attach rate',
            effCommissionLabel: 'Effective commission:',
            priceSymbolHintLabel: 'Currency follows top toggle',
            unitCostBannerTitle: 'Total cost per unit',
            tabForecast: 'Forecast',
            tabEmployees: 'Employees',
            employeesTitle: 'Employee salaries',
            addEmployeeBtn: '+ Add employee',
            employeesHelp: 'Enter each employee monthly salary (gross pre-tax or net take-home). The system auto-adds employer payroll tax and rolls it into monthly fixed cost. Net→Gross uses 28% employee tax burden by default.',
            empColName: 'Name',
            empColPosition: 'Position',
            empColType: 'Gross/Net',
            empColAmount: 'Monthly',
            empColOps: 'Ops',
            taxHelp: 'Sales in Delaware avoid state sales tax; per-state tables are in the Sales Tax section below.',
            taxEmployerPayroll: 'Employer payroll tax',
            locationTitle: 'Company location',
            locZip: 'ZIP:',
            detectState: 'Detect state',
            locState: 'State:',
            locNotes: 'Notes:',
            useStateDefault: 'Use state default',
            estOceanBtn: 'Estimate SZ→LA',
            estInlandBtn: 'Estimate LA→customer',
            estInlandTo: '→ ZIP:',
            estInlandHint: 'From ZIP 90001 (LA) by default',
            dimensionsTitle: 'Dimensions / weight',
            dimCrated: 'Crated dims:',
            dimBare: 'Bare dims:',
            dimCBM: 'Volume:',
            dimWeight: 'Gross weight:',
            kpiBuyoutPrice: 'Outright price',
            kpiLeaseFirstPay: 'Lease first-pay',
            kpiLeaseRent: 'Monthly rent',
            kpiLeaseFirstPayMonths: 'First-pay months (N)',
            kpiLeaseDepositMonths: 'Deposit months (M)',
            kpiLeaseMinMonths: 'Min lease (months)',
            kpiLeaseETF: 'Early term. fee',
            kpiLeaseRatio: 'Lease ratio (0–1)',
            kpiUnitCost: 'Unit base cost',
            kpiConversion: 'Lead→customer rate',
            kpiTotalLeads: 'Leads / period',
            kpiUsefulLife: 'Useful life (months)',
            alertBuyout: 'Outright profit',
            alertLease: 'Lease LTV',
            alertCashflow: 'Monthly cashflow',
            kpiSummary: 'Key Numbers',
            tabBuyout: 'Outright Detail',
            tabLease: 'Lease Detail',
            tabOpex: 'Monthly Opex',
            tabCustom: 'Custom Cost Items',
            tabSettings: 'Scenario & Settings',
            buyoutDetailTitle: 'Outright profit model (reconstructed from Excel; live re-compute on edit)',
            leaseDetailTitle: 'Lease profit model (with deposit/min term/ETF + monthly cashflow)',
            leaseMonthlyTitle: 'Monthly cashflow',
            opexTitle: 'Monthly fixed opex budget (USD, editable)',
            addOpexBtn: '+ Add line',
            customTitle: 'Custom cost items (extensible)',
            addCustomBtn: '+ Add cost item',
            customHelp: 'Unit per_unit=per-device once / per_customer=per-customer once / per_month=monthly fixed / once=one-time',
            customColName: 'Name',
            customColUnit: 'Unit',
            customColValue: 'Amount (USD)',
            customColApplies: 'Applies to',
            customColOps: 'Ops',
            customEmpty: 'No custom cost items. Click "+ Add cost item".',
            metaTitle: 'Meta',
            metaCompanyState: 'Company state',
            metaDestState: 'Destination state',
            metaFxRate: 'FX USD→CNY',
            metaNotes: 'Notes',
            taxTitle: 'US Tax Rates',
            taxFederal: 'Federal corp tax',
            taxStateCorp: 'State corp tax',
            taxFranchise: 'Franchise tax (yr/USD)',
            taxFICA: 'FICA employer',
            taxFUTA: 'FUTA',
            taxSUTA: 'SUTA',
            taxBenefits: 'Benefits % of salary',
            productTitle: 'Product & Landed Cost',
            productName: 'Product name',
            productUnitCost: 'Unit base cost (USD)',
            productOcean: 'Ocean freight USD/unit',
            productDuty: 'Import duty %',
            productPort: 'Port fees USD/unit',
            productInland: 'US inland USD/unit',
            productWarehouse: 'Warehouse USD/month',
            productInstall: 'Install/training USD/customer',
            productWarranty: 'Warranty USD/unit',
            productShipping: 'Customer shipping USD/unit',
            productAds: 'Ads USD/unit',
            commissionTitle: 'US-CN cross-border sales commission',
            commissionHelp: 'Industry norm: total pool ~5%, split 40% CN referrer / 60% US closer; attach rate = share of US deals that came from a CN-sourced lead, default 30%.',
            commissionUs: 'US closer commission %',
            commissionUsHint: 'Default 0.03 (3%)',
            commissionCn: 'CN referrer commission %',
            commissionCnHint: 'Default 0.02 (2%)',
            commissionAttach: 'CN referral attach rate',
            commissionAttachHint: 'Default 0.30',
            commissionOther: 'Other bonus %',
            commissionOtherHint: 'Default 0.01 (1%)',
            commissionEffective: 'Effective commission rate:',
            commissionFormula: '= US + CN x Attach + Other',
            removeBtn: 'Remove',
            salesTaxTitle: 'US state sales tax (editable, saved overrides defaults)',
            saveTaxBtn: 'Save tax table',
            resetTaxBtn: 'Reset to default',
            forecastTitle: 'Monthly unit sales forecast (units)',
            opexSubject: 'Line item',
            opexTotal: 'Total',
            opexOps: 'Ops',
            opexSumLabel: 'Monthly subtotal',
            thGroup: 'Group',
            thItem: 'Item',
            thValue: 'Value',
            aiTitle: 'AI Pricing Suggestion (GLM-4.5-Air)',
            aiIntro: 'Calls Zhipu GLM-4.5-Air with the full scenario (costs/prices/tax/lease policy/cross-border commission/forecast) plus competitor info to produce pricing recommendations.',
            aiCallBtn: 'Generate suggestion',
            aiApplyBtn: 'Apply to current scenario',
            saveAsTitle: 'Save as new scenario',
            saveAsNameLabel: 'Scenario name:',
            cancelBtn: 'Cancel',
        }
    };

    // Backend error translation map (zh → en)
    const ERROR_MAP = {
        '密码错误': 'Wrong password',
        '账号未注册': 'Account not registered',
        '服务器错误': 'Server error',
        '请输入账号和密码': 'Enter account and password',
        '请填写所有字段': 'Fill in all fields',
        '该账号已被注册': 'Account already registered',
        '该账号为管理员专用': 'Admin-only account',
        '注册失败': 'Registration failed',
        '删除失败': 'Delete failed',
        '账号不存在': 'Account not found',
        '密码不能为空': 'Password cannot be empty',
        '保存失败': 'Save failed',
    };

    // Department groups with optgroup support
    const DEPT_GROUPS = [
        {
            zh: '芯厨师',
            en: 'CN (芯厨师)',
            items: [
                { value: '芯厨师-研发中心', zh: '芯厨师-研发中心', en: 'CN-R&D Center' },
                { value: '芯厨师-市场部', zh: '芯厨师-市场部', en: 'CN-Marketing' },
                { value: '芯厨师-设计部', zh: '芯厨师-设计部', en: 'CN-Design' },
                { value: '芯厨师-运营部', zh: '芯厨师-运营部', en: 'CN-Operations' },
                { value: '芯厨师-其他', zh: '芯厨师-其他', en: 'CN-Other' },
            ]
        },
        {
            zh: 'Panshaker',
            en: 'Panshaker',
            items: [
                { value: 'Panshaker-销售部', zh: 'Panshaker-销售部', en: 'Panshaker-Sales' },
                { value: 'Panshaker-行政', zh: 'Panshaker-行政', en: 'Panshaker-Admin' },
                { value: 'Panshaker-研发部', zh: 'Panshaker-研发部', en: 'Panshaker-R&D' },
                { value: 'Panshaker-市场部', zh: 'Panshaker-市场部', en: 'Panshaker-Marketing' },
                { value: 'Panshaker-临时工时计算', zh: 'Panshaker-临时工时计算', en: 'Panshaker-Temp Hours' },
                { value: 'Panshaker-其他', zh: 'Panshaker-其他', en: 'Panshaker-Other' },
            ]
        }
    ];

    function getLang() {
        return localStorage.getItem('ps_lang') || 'zh';
    }

    const CHANNEL_STORAGE_KEY = 'ps_channel';
    const MINI_PROGRAM_CHANNEL = 'wxmini';

    function isMiniProgramContext() {
        const query = new URLSearchParams(window.location.search);
        if (query.get('from') === MINI_PROGRAM_CHANNEL) {
            localStorage.setItem(CHANNEL_STORAGE_KEY, MINI_PROGRAM_CHANNEL);
            return true;
        }

        if (localStorage.getItem(CHANNEL_STORAGE_KEY) === MINI_PROGRAM_CHANNEL) {
            return true;
        }

        const ua = (navigator.userAgent || '').toLowerCase();
        return window.__wxjs_environment === 'miniprogram' || ua.includes('miniprogram');
    }

    function t(key) {
        const lang = getLang();
        return (T[lang] && T[lang][key]) || T.zh[key] || key;
    }

    function tErr(msg) {
        if (getLang() === 'en' && ERROR_MAP[msg]) return ERROR_MAP[msg];
        return msg;
    }

    function toggleLang() {
        localStorage.setItem('ps_lang', getLang() === 'zh' ? 'en' : 'zh');
        applyLang();
    }

    function populateDeptSelect(sel) {
        const lang = getLang();
        const cur = sel.value;
        sel.innerHTML = '';

        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = t('deptPlaceholder');
        sel.appendChild(defOpt);

        DEPT_GROUPS.forEach(group => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group[lang];
            group.items.forEach(d => {
                const o = document.createElement('option');
                o.value = d.value;
                o.textContent = d[lang];
                optgroup.appendChild(o);
            });
            sel.appendChild(optgroup);
        });

        // Restore previous value; add custom option for backward compat
        if (cur) {
            sel.value = cur;
            if (!sel.value) {
                const custom = document.createElement('option');
                custom.value = cur;
                custom.textContent = cur;
                sel.appendChild(custom);
                sel.value = cur;
            }
        }
    }

    function applyLang() {
        const lang = getLang();
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

        // Text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (T[lang][key]) el.textContent = T[lang][key];
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            const key = el.getAttribute('data-i18n-ph');
            if (T[lang][key]) el.placeholder = T[lang][key];
        });

        // Department selects
        document.querySelectorAll('select[data-dept]').forEach(sel => {
            populateDeptSelect(sel);
        });

        // Page title
        const titleKey = document.documentElement.getAttribute('data-title-i18n');
        if (titleKey && T[lang][titleKey]) document.title = T[lang][titleKey];

        // Toggle button text
        const btn = document.getElementById('langToggle');
        if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中文';
    }

    // Persist channel marker when a mini-program query flag is present.
    isMiniProgramContext();

    // Expose globally
    window.i18n = { t, tErr, getLang, toggleLang, applyLang, isMiniProgramContext, DEPT_GROUPS, T };
})();
