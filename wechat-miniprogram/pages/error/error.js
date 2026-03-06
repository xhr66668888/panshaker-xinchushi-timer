Page({
  data: {
    failedUrl: ''
  },

  onLoad(options) {
    const failedUrl = options.url ? decodeURIComponent(options.url) : '';
    this.setData({ failedUrl });
  },

  retry() {
    const failedUrl = this.data.failedUrl;

    if (failedUrl) {
      wx.redirectTo({
        url: `/pages/webview/webview?path=${encodeURIComponent(failedUrl)}`
      });
      return;
    }

    wx.redirectTo({
      url: '/pages/webview/webview'
    });
  },

  goHome() {
    wx.redirectTo({
      url: '/pages/webview/webview'
    });
  },

  copyFailedUrl() {
    const failedUrl = this.data.failedUrl;
    if (!failedUrl) {
      wx.showToast({
        title: '暂无链接',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({ data: failedUrl });
  }
});
