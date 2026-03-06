const BASE_URL = 'https://panshaker-timer.azurewebsites.net';

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json'
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const errMsg = (res.data && res.data.error) || '请求失败';
          reject({ statusCode: res.statusCode, message: errMsg });
        }
      },
      fail(err) {
        reject({ statusCode: 0, message: '网络错误，请检查网络连接' });
      }
    });
  });
}

module.exports = {
  login(account, password) {
    return request({ url: '/api/login', method: 'POST', data: { account, password } });
  },

  register(data) {
    return request({ url: '/api/register', method: 'POST', data });
  },

  submitRecord(data) {
    return request({ url: '/api/records', method: 'POST', data });
  },

  deleteRecord(id) {
    return request({ url: `/api/records/${id}`, method: 'DELETE' });
  },

  getRecentRecords(name) {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return request({ url: `/api/records/recent${query}` });
  },

  getStats(month) {
    return request({ url: `/api/stats?month=${encodeURIComponent(month)}` });
  },

  getEmployeeRecords(name, month) {
    return request({
      url: `/api/records/employee/${encodeURIComponent(name)}?month=${encodeURIComponent(month)}`
    });
  },

  getUsers() {
    return request({ url: '/api/users' });
  },

  getUser(account) {
    return request({ url: `/api/users/${encodeURIComponent(account)}` });
  },

  updateUser(account, password) {
    return request({
      url: `/api/users/${encodeURIComponent(account)}`,
      method: 'PUT',
      data: { password }
    });
  },

  deleteUser(account, deleteRecords) {
    const query = deleteRecords ? '?deleteRecords=true' : '';
    return request({
      url: `/api/users/${encodeURIComponent(account)}${query}`,
      method: 'DELETE'
    });
  }
};
