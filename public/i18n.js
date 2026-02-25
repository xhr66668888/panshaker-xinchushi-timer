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

    // Expose globally
    window.i18n = { t, tErr, getLang, toggleLang, applyLang, DEPT_GROUPS, T };
})();
