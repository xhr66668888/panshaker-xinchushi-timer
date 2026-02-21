# Panshaker 海外工时记录系统



## 线上使用地址
**访问链接**: *https://panshaker-timer.azurewebsites.net*

## 本地开发指南
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

## 项目结构
- `/public`: 所有的网页静态资源 (HTML/CSS/JS)。
- `index.js`: Node.js + Express + SQLite 的核心后端入口。
- `work_records.db`: 自动生成的本地 SQLite 数据库文件（生产环境会持久化在此处存留数据）。
