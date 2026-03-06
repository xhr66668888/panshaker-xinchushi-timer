App({
  globalData: {
    baseUrl: 'https://panshaker-timer.azurewebsites.net',
    role: '',
    name: '',
    department: ''
  },

  onLaunch() {
    this.globalData.role = wx.getStorageSync('ps_role') || '';
    this.globalData.name = wx.getStorageSync('ps_name') || '';
    this.globalData.department = wx.getStorageSync('ps_department') || '';
  }
});
