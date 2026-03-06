const api = require('../../utils/api');

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function getNow() {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

function getOneHourAgo() {
  const d = new Date();
  d.setHours(d.getHours() - 1);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

Page({
  data: {
    name: '',
    department: '',
    taskDesc: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    msg: '',
    msgType: '',
    records: []
  },

  onLoad() {
    const role = wx.getStorageSync('ps_role');
    const name = wx.getStorageSync('ps_name');
    if (role !== 'employee' || !name) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    const now = getNow();
    const ago = getOneHourAgo();

    this.setData({
      name: name,
      department: wx.getStorageSync('ps_department') || '',
      startDate: ago.date,
      startTime: ago.time,
      endDate: now.date,
      endTime: now.time
    });

    this.loadRecords();
  },

  onShow() {
    if (this.data.name) {
      this.loadRecords();
    }
  },

  onTaskInput(e) { this.setData({ taskDesc: e.detail.value, msg: '' }); },
  onStartDateChange(e) { this.setData({ startDate: e.detail.value }); },
  onStartTimeChange(e) { this.setData({ startTime: e.detail.value }); },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }); },
  onEndTimeChange(e) { this.setData({ endTime: e.detail.value }); },

  resetForm() {
    const now = getNow();
    const ago = getOneHourAgo();
    this.setData({
      taskDesc: '',
      startDate: ago.date,
      startTime: ago.time,
      endDate: now.date,
      endTime: now.time,
      msg: ''
    });
  },

  async doSubmit() {
    const { name, department, taskDesc, startDate, startTime, endDate, endTime } = this.data;

    if (!taskDesc) {
      this.setData({ msg: '请填写工作内容', msgType: 'error' });
      return;
    }

    const startDT = new Date(`${startDate}T${startTime}:00`);
    const endDT = new Date(`${endDate}T${endTime}:00`);

    if (endDT <= startDT) {
      this.setData({ msg: '结束时间必须晚于开始时间', msgType: 'error' });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    try {
      await api.submitRecord({
        EmployeeName: name,
        Department: department,
        TaskDescription: taskDesc,
        StartTime: startDT.toISOString(),
        EndTime: endDT.toISOString()
      });
      wx.hideLoading();

      this.setData({
        msg: '提交成功！',
        msgType: 'success',
        taskDesc: ''
      });
      setTimeout(() => this.setData({ msg: '' }), 3000);
      this.loadRecords();
    } catch (err) {
      wx.hideLoading();
      this.setData({ msg: '提交失败: ' + (err.message || '未知错误'), msgType: 'error' });
    }
  },

  async loadRecords() {
    try {
      const records = await api.getRecentRecords(this.data.name);
      const formatted = records.map(r => ({
        ...r,
        hours: r.DurationHours.toFixed(2)
      }));
      this.setData({ records: formatted });
    } catch (err) {
      // Silently fail for record loading
    }
  },

  doDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认',
      content: '确定删除该记录？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteRecord(id);
          this.loadRecords();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  doLogout() {
    wx.clearStorageSync();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
