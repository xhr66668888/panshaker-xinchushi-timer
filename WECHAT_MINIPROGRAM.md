# 微信小程序最佳落地方案（适配已上线 Azure Web App）

## 结论（推荐方案）

对于你当前项目，**最优解不是重写小程序页面**，而是：

- 使用微信小程序 `web-view` 全屏承载现有 Web App
- 保持后端与核心前端逻辑不变（降低风险、最快上线）
- 对 H5 做少量“微信小程序场景”兼容增强（本仓库已落地）

该方案在“开发成本、上线速度、稳定性、后续维护”之间最均衡，适合你的现状：**网站已部署在 Azure，小程序仅作为访问入口**。

---

## 为什么这是最优解

1. **改动最小**
   现有 API、数据库、页面逻辑全部可复用，不需要重构业务。

2. **上线最快**
   新增一个小程序壳即可进入提审流程，交付速度最快。

3. **维护成本低**
   Web 与小程序不分叉，功能迭代仍以 Web 为主，小程序自动受益。

4. **移动端可用性可控**
   通过小程序壳参数、错误兜底页、H5 端轻适配，可覆盖微信手机端主要场景。

---

## 已完成的代码落地

仓库内已创建并提交以下目录结构：

```text
wechat-miniprogram/
├── project.config.json
├── app.json
├── app.js
├── app.wxss
├── sitemap.json
└── pages/
    ├── webview/
    │   ├── webview.wxml
    │   ├── webview.js
    │   └── webview.json
    └── error/
        ├── error.wxml
        ├── error.js
        ├── error.json
        └── error.wxss
```

### 关键增强点

- `webview.js` 增加了：
  - 仅允许 `https://panshaker-timer.azurewebsites.net` 同源地址
  - 仅允许白名单页面路径（`/login.html`、`/index.html`、`/stats.html`）
  - 自动注入 `from=wxmini&entry=miniprogram` 参数
  - 加载失败自动跳转错误兜底页

- 新增 `error` 页面：
  - 引导排查业务域名配置
  - 提供重试、回首页、复制失败链接能力

- Web 页面轻适配（`public/`）：
  - `login.html`、`index.html`、`stats.html` 添加 `viewport-fit=cover`
  - 语言切换按钮适配刘海屏安全区（`env(safe-area-inset-bottom)`）
  - `stats.html` 在小程序环境阻止 Excel 导出并提示“请在浏览器导出”

- `.gitignore` 已新增：
  - `wechat-miniprogram/project.private.config.json`

---

## 你现在需要在微信后台做的配置

1. 登录 <https://mp.weixin.qq.com/>
2. 进入 **开发管理 -> 开发设置 -> 业务域名**
3. 下载并放置微信校验文件到 `public/`（根路径可访问）
4. 发布到 Azure 后，确认可访问：
   - `https://panshaker-timer.azurewebsites.net/<校验文件名>`
5. 回到微信后台提交域名：
   - `panshaker-timer.azurewebsites.net`（不带 `https://`）

注意：本项目只需配置**业务域名**。

---

## 微信开发者工具导入与调试

1. 打开微信开发者工具
2. 导入目录：`wechat-miniprogram/`
3. AppID 使用：`wx8e51282f8fdab0a7`
4. 默认入口页：`pages/webview/webview`
5. 真机预览验证登录、录入、查询流程

可选测试路径（在工具中加启动参数）：

- 登录页：`path=/login.html`
- 录入页：`path=/index.html`
- 统计页：`path=/stats.html`

---

## 线上发布建议

1. 小程序先发“体验版”给内部核心用户
2. 收集 1~2 天反馈后再提审正式版
3. 提审备注建议写：
   - “企业内部工时管理工具，基于已备案 HTTPS 网站通过 web-view 接入”

---

## 已知限制与处理策略

1. **Excel 导出在小程序内体验不佳**
   已在 `stats.html` 中提示改用浏览器导出。

2. **第三方 CDN（`unpkg.com`）在部分网络可能不稳定**
   建议下一步把 `98.css` 改为本地静态资源（`public/vendor/`），进一步提高稳定性。

3. **纯 web-view 审核沟通风险**
   在提审说明中明确“内部业务工具”可降低风险。

---

## 后续可选优化（不影响当前上线）

1. 将 `98.css` 本地化，避免外链波动。
2. 给 H5 增加 `from=wxmini` 专属 UI（例如隐藏不必要按钮）。
3. 增加小程序内埋点（页面打开失败率、加载耗时）。

