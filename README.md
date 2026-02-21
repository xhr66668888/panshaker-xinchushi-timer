# Panshaker 海外工时记录系统 (Cloud Native)

这是一个为 Panshaker 研发和市场部设计的轻量级、Win98 复古风格的工时记录平台。
目前已被重构为 **云原生 Node.js 架构**，并且已配置为使用 GitHub Actions 全自动部署到云端服务器。

## 最新特性 (V5)
- **极简架构**：脱离了传统的桌面端打包束缚，全线上云。
- **双角色鉴权**：
  - 员工入口 (`8888`)：全响应式填报界面，完美适配微信内置浏览器，支持随时撤销报错。
  - 管理入口 (`9999`)：支持按月汇总部门工时，并带有“员工明细透视表”功能。
- **全端适配**：深度优化了微信、手机 Safari、PC 端网页的渲染，自动折行与自适应宽度。

## 🌐 线上使用地址
这套系统已经通过 GitHub 部署于 Azure/云平台。
**访问链接**: *由贵司 IT 提供的公网网址 (如 `https://panshaker-timer.azurewebsites.net`)*

## 💻 本地开发指南
如果您需要在这份代码上继续二次开发（如增加 Excel 导出功能）：

1. **安装环境**: 确保您的电脑上安装了 [Node.js](https://nodejs.org/)。
2. **下载依赖**: 在根目录执行：
   ```bash
   npm install
   ```
3. **启动服务**:
   ```bash
   npm start
   ```
   随后在浏览器打开 `http://localhost:5000/login.html` 即可开始调试。

## 📂 项目结构
- `/public`: 所有的网页静态资源 (HTML/CSS/JS)。
- `index.js`: Node.js + Express + SQLite 的核心后端入口。
- `work_records.db`: 自动生成的本地 SQLite 数据库文件（生产环境会持久化在此处存留数据）。
