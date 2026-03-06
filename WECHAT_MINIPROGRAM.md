# 微信小程序（原生版）

## 架构

```
手机微信 → 原生小程序页面 → wx.request → Azure 后端 API
```

- **小程序**：纯原生 WXML/WXSS/JS 页面（不使用 web-view）
- **后端**：现有 Azure Web App 完全不变，继续提供 REST API
- **Azure 不需要下线**，小程序和浏览器可以同时访问

## 项目结构

```
wechat-miniprogram/
├── project.config.json    # 微信开发工具配置
├── app.json               # 页面路由 & 全局窗口配置
├── app.js                 # 全局数据（baseUrl、登录状态）
├── app.wxss               # 全局样式（Win98 风格）
├── sitemap.json
├── utils/
│   └── api.js             # 封装所有 wx.request 调用
└── pages/
    ├── login/             # 登录 + 注册
    ├── index/             # 员工工时录入 + 最近记录
    └── stats/             # 管理员统计 + 账户管理
```

## 你需要做的配置

### 1. 配置服务器域名

在微信公众平台：**开发管理 → 开发设置 → 服务器域名 → 开始配置**

在 **request合法域名** 中填入：

```
https://panshaker-timer.azurewebsites.net
```

其他域名（socket/upload/download 等）留空不填。

> **注意**：微信要求域名必须有 ICP 备案。`.azurewebsites.net` 是微软的域名，
> 如果配置时提示"未备案"，有两种解决方案：
> 1. 开发阶段：在微信开发者工具中勾选「不校验合法域名」即可正常调试
> 2. 正式上线：给 Azure 绑定一个有 ICP 备案的自定义域名

### 2. 导入微信开发者工具

1. 打开微信开发者工具
2. 导入目录：`wechat-miniprogram/`
3. AppID：`wx8e51282f8fdab0a7`
4. 在「详情 → 本地设置」中勾选「不校验合法域名」（开发阶段）
5. 真机预览走一遍：登录 → 录入工时 → 管理员查看统计

### 3. 测试账号

- 员工：注册一个新账号即可
- 管理员：账号 `9999`，密码 `9999`

## 功能清单

| 页面 | 功能 | 对应 API |
|------|------|----------|
| 登录页 | 登录 / 注册 / 部门选择 | POST /api/login, /api/register |
| 录入页 | 提交工时 / 查看最近记录 / 删除记录 | POST /api/records, GET /api/records/recent, DELETE /api/records/:id |
| 统计页 | 月度统计 / 员工详情 / 账户管理(查看/编辑/删除) | GET /api/stats, /api/records/employee/:name, /api/users, PUT/DELETE /api/users/:account |

## 与 Web 版的差异

| 项目 | Web 版 | 小程序版 |
|------|--------|----------|
| 界面 | 98.css 风格 | 还原 Win98 风格（纯 WXSS） |
| 语言切换 | 中/英双语 | 仅中文 |
| Excel 导出 | 支持 | 不支持（管理员可用浏览器导出） |
| 登录状态 | localStorage | wx.getStorageSync |

## 发布流程

1. 微信开发者工具 → 上传
2. 微信公众平台 → 版本管理 → 提交审核
3. 审核备注：「企业内部工时管理工具」
4. 审核通过后点击发布
