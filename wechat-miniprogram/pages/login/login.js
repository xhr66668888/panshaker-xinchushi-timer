const api = require('../../utils/api');

const DEPT_LIST = [
  '芯厨师-研发中心',
  '芯厨师-市场部',
  '芯厨师-设计部',
  '芯厨师-运营部',
  '芯厨师-其他',
  'Panshaker-销售部',
  'Panshaker-行政',
  'Panshaker-研发部',
  'Panshaker-市场部',
  'Panshaker-临时工时计算',
  'Panshaker-其他'
];

Page({
  data: {
    mode: 'login',
    account: '',
    password: '',
    errorMsg: '',
    regName: '',
    regDept: '',
    regAccount: '',
    regPassword: '',
    regMsg: '',
    regMsgType: '',
    deptList: DEPT_LIST
  },

  onLoad() {
    // If already logged in, redirect
    const role = wx.getStorageSync('ps_role');
    if (role === 'admin') {
      wx.reLaunch({ url: '/pages/stats/stats' });
    } else if (role === 'employee') {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  onAccountInput(e) { this.setData({ account: e.detail.value, errorMsg: '' }); },
  onPasswordInput(e) { this.setData({ password: e.detail.value, errorMsg: '' }); },
  onRegNameInput(e) { this.setData({ regName: e.detail.value, regMsg: '' }); },
  onRegAccountInput(e) { this.setData({ regAccount: e.detail.value, regMsg: '' }); },
  onRegPasswordInput(e) { this.setData({ regPassword: e.detail.value, regMsg: '' }); },

  onDeptChange(e) {
    this.setData({ regDept: DEPT_LIST[e.detail.value], regMsg: '' });
  },

  switchToRegister() {
    this.setData({ mode: 'register', errorMsg: '' });
  },

  switchToLogin() {
    this.setData({ mode: 'login', regMsg: '' });
  },

  async doLogin() {
    const { account, password } = this.data;
    if (!account || !password) {
      this.setData({ errorMsg: '请输入账号和密码' });
      return;
    }

    wx.showLoading({ title: '登录中...' });
    try {
      const data = await api.login(account, password);
      wx.hideLoading();

      if (data.role === 'admin') {
        wx.setStorageSync('ps_role', 'admin');
        wx.reLaunch({ url: '/pages/stats/stats' });
      } else {
        wx.setStorageSync('ps_role', 'employee');
        wx.setStorageSync('ps_name', data.name);
        wx.setStorageSync('ps_department', data.department);
        const app = getApp();
        app.globalData.role = 'employee';
        app.globalData.name = data.name;
        app.globalData.department = data.department;
        wx.reLaunch({ url: '/pages/index/index' });
      }
    } catch (err) {
      wx.hideLoading();
      if (err.statusCode === 404) {
        this.setData({ errorMsg: '账号未注册，请先注册' });
      } else {
        this.setData({ errorMsg: err.message || '登录失败' });
      }
    }
  },

  async doRegister() {
    const { regName, regDept, regAccount, regPassword } = this.data;
    if (!regName || !regDept || !regAccount || !regPassword) {
      this.setData({ regMsg: '请填写所有字段', regMsgType: 'error' });
      return;
    }

    wx.showLoading({ title: '注册中...' });
    try {
      await api.register({
        account: regAccount,
        name: regName,
        department: regDept,
        password: regPassword
      });
      wx.hideLoading();

      this.setData({
        regMsg: '注册成功！正在跳转登录...',
        regMsgType: 'success'
      });

      setTimeout(() => {
        this.setData({
          mode: 'login',
          account: regAccount,
          regMsg: ''
        });
      }, 1200);
    } catch (err) {
      wx.hideLoading();
      this.setData({ regMsg: err.message || '注册失败', regMsgType: 'error' });
    }
  }
});
