const api = require('../../utils/api');

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function formatRecords(records) {
  return records.map(r => {
    const s = new Date(r.StartTime);
    const e = new Date(r.EndTime);
    return {
      ...r,
      dateStr: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`,
      timeRange: `${pad(s.getHours())}:${pad(s.getMinutes())} - ${pad(e.getHours())}:${pad(e.getMinutes())}`,
      hoursStr: r.DurationHours.toFixed(2)
    };
  });
}

Page({
  data: {
    month: '',
    stats: [],
    grandTotal: '0.00',
    users: [],

    // Detail modal
    showDetailModal: false,
    detailTitle: '',
    detailRecords: [],

    // User records modal
    showUserRecordsModal: false,
    userRecordsTitle: '',
    userMonth: '',
    userRecords: [],
    currentViewUser: '',

    // Edit modal
    showEditModal: false,
    editAccount: '',
    editName: '',
    editPassword: ''
  },

  onLoad() {
    if (wx.getStorageSync('ps_role') !== 'admin') {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    this.setData({ month: currentMonth(), userMonth: currentMonth() });
    this.loadStats();
    this.loadUsers();
  },

  onMonthChange(e) {
    this.setData({ month: e.detail.value });
  },

  async loadStats() {
    wx.showLoading({ title: '查询中...' });
    try {
      const data = await api.getStats(this.data.month);
      let total = 0;
      const stats = data.map(s => {
        total += s.totalHours;
        return { ...s, totalHoursStr: s.totalHours.toFixed(2) };
      });
      this.setData({ stats, grandTotal: total.toFixed(2) });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    wx.hideLoading();
  },

  async showDetail(e) {
    const name = e.currentTarget.dataset.name;
    const month = this.data.month;

    this.setData({
      showDetailModal: true,
      detailTitle: `${name} - ${month}`,
      detailRecords: []
    });

    try {
      const records = await api.getEmployeeRecords(name, month);
      this.setData({ detailRecords: formatRecords(records) });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  closeDetail() {
    this.setData({ showDetailModal: false });
  },

  // ── Account Management ──

  async loadUsers() {
    try {
      const users = await api.getUsers();
      const formatted = users.map(u => ({
        ...u,
        hoursStr: u.TotalHours.toFixed(2),
        deptShort: u.Department.length > 8 ? u.Department.slice(0, 8) + '…' : u.Department
      }));
      this.setData({ users: formatted });
    } catch (err) {
      // silent
    }
  },

  viewUserRecords(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({
      showUserRecordsModal: true,
      userRecordsTitle: name,
      currentViewUser: name,
      userMonth: this.data.month,
      userRecords: []
    });
    this.loadUserRecords();
  },

  onUserMonthChange(e) {
    this.setData({ userMonth: e.detail.value });
  },

  async loadUserRecords() {
    const { currentViewUser, userMonth } = this.data;
    if (!currentViewUser || !userMonth) return;

    try {
      const records = await api.getEmployeeRecords(currentViewUser, userMonth);
      this.setData({ userRecords: formatRecords(records) });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  closeUserRecords() {
    this.setData({ showUserRecordsModal: false, currentViewUser: '' });
  },

  async editUser(e) {
    const account = e.currentTarget.dataset.account;
    wx.showLoading({ title: '加载中...' });
    try {
      const user = await api.getUser(account);
      wx.hideLoading();
      this.setData({
        showEditModal: true,
        editAccount: user.Account,
        editName: user.Name,
        editPassword: user.Password
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onEditPasswordInput(e) {
    this.setData({ editPassword: e.detail.value });
  },

  async saveUser() {
    const { editAccount, editPassword } = this.data;
    if (!editPassword) {
      wx.showToast({ title: '密码不能为空', icon: 'none' });
      return;
    }
    try {
      await api.updateUser(editAccount, editPassword);
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.closeEdit();
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  closeEdit() {
    this.setData({ showEditModal: false });
  },

  deleteUser(e) {
    const account = e.currentTarget.dataset.account;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: '确认删除',
      content: `确定删除账户 ${name}(${account})？\n\n将同时删除该用户所有工时记录。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteUser(account, true);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadUsers();
          this.loadStats();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  doLogout() {
    wx.clearStorageSync();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
