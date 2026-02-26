# 微信小程序开发指南

## 方案概述

使用微信小程序的 `web-view` 组件全屏嵌入现有 Azure 网页应用。后端和前端代码完全不变，只需创建一个极简的小程序壳。

- **AppID:** `wx8e51282f8fdab0a7`
- **Web 应用地址:** `https://panshaker-timer.azurewebsites.net`

---

## 第一步：创建小程序项目文件

在仓库根目录创建 `wechat-miniprogram/` 目录，包含以下文件：

```
wechat-miniprogram/
├── project.config.json
├── app.json
├── app.js
├── app.wxss
└── pages/
    └── webview/
        ├── webview.wxml
        ├── webview.js
        └── webview.json
```

### project.config.json

```json
{
  "description": "Panshaker Timer 微信小程序",
  "setting": {
    "urlCheck": true,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true,
    "newFeature": false,
    "coverView": true,
    "autoAudits": false,
    "checkSiteMap": true,
    "uploadWithSourceMap": true,
    "compileHotReLoad": false,
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    }
  },
  "compileType": "miniprogram",
  "libVersion": "3.3.4",
  "appid": "wx8e51282f8fdab0a7",
  "projectname": "panshaker-timer",
  "condition": {},
  "editorSetting": {
    "tabIndent": "insertSpaces",
    "tabSize": 2
  }
}
```

### app.json

```json
{
  "pages": [
    "pages/webview/webview"
  ],
  "window": {
    "navigationBarTitleText": "Panshaker 工时系统",
    "navigationBarBackgroundColor": "#008080",
    "navigationBarTextStyle": "white"
  }
}
```

### app.js

```javascript
App({
  onLaunch() {}
})
```

### app.wxss

```css
/* 全局样式 - web-view 全屏，无需额外样式 */
```

### pages/webview/webview.wxml

```html
<web-view src="https://panshaker-timer.azurewebsites.net/login.html"></web-view>
```

### pages/webview/webview.js

```javascript
Page({
  data: {},
  onLoad() {}
})
```

### pages/webview/webview.json

```json
{
  "navigationStyle": "custom"
}
```

> `"navigationStyle": "custom"` 隐藏小程序原生导航栏，让 web-view 全屏。如果想保留顶部标题栏，去掉这个设置。

---

## 第二步：配置微信业务域名

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发管理** → **开发设置** → **业务域名**
3. 点击 **开始配置**，扫码验证身份
4. 下载微信提供的校验文件（如 `Rl1bnlUxxxxxx.txt`）
5. 将校验文件放入项目 `public/` 目录
6. 推送到 `main` 分支（GitHub Actions 自动部署到 Azure）
7. 浏览器验证 `https://panshaker-timer.azurewebsites.net/<校验文件名>` 可访问
8. 回到微信后台，输入域名：`panshaker-timer.azurewebsites.net`（不含 `https://`）
9. 点击 **保存并提交**

**注意：**
- 只需配置"业务域名"，不需要配置"服务器域名"
- 服务端不需要任何代码改动，`express.static('public')` 已经可以提供校验文件
- 域名必须是 HTTPS（Azure 已自动提供）

---

## 第三步：测试和发布

### 本地测试

1. 下载安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开开发者工具，导入 `wechat-miniprogram/` 目录
3. 确认 AppID 为 `wx8e51282f8fdab0a7`
4. 在模拟器中确认网页正常加载
5. 点击 **预览** 生成二维码，用微信扫码在真机测试

### 上传发布

1. 在开发者工具中点击 **上传**
2. 设置版本号（如 `1.0.0`）和描述
3. 登录 `mp.weixin.qq.com` → **版本管理**
4. 在"开发版本"中找到上传的版本
5. 点击 **提交审核**
6. 审核通过后点击 **发布**

---

## 第四步：更新 .gitignore

添加以下内容：

```
wechat-miniprogram/project.private.config.json
```

（微信开发工具自动生成的本地配置文件，不应提交）

---

## 已知限制

| 问题 | 说明 | 解决方案 |
|------|------|----------|
| Excel 导出 | web-view 中文件下载可能不正常 | 管理员用普通浏览器导出 |
| 审核风险 | 纯 web-view 小程序可能被质疑 | 提交时说明"内部工时管理工具" |
| CDN 依赖 | 98.css 从 unpkg.com 加载 | 如有问题，下载到 `public/` 本地提供 |

---

## 工作原理

- `web-view` 组件在小程序中嵌入一个全屏浏览器
- 网页的 origin 是 `https://panshaker-timer.azurewebsites.net`
- 所有 API 调用使用相对路径（`/api/login` 等），自动解析到 Azure 服务器
- 页面跳转（`login.html` → `index.html`）也是相对路径，在 web-view 中正常工作
- `localStorage` 在 web-view 中可用，登录状态正常保持
- 现有的响应式 CSS（`@media max-width: 600px`）适配手机屏幕
