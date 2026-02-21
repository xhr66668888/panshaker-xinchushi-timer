# Panshaker Work Record - Azure App Service 部署指南

这是一份专为将 **Panshaker 工时记录系统** 部署到微软云 (Azure Web App) 服务而编写的“保姆级”图文教程。
部署完成后，您的所有国内员工无论用手机还是电脑，只要有网络就能随时随地打卡，且数据完全由贵公司自己掌控。

## 第一步：准备好发布包
我已经为您打包好了一个名为 `PanshakerWorkRecord-AzureReady.zip` 的压缩包。
**注意：请不要解压它！直接将这个 ZIP 文件保存在您的桌面上即可。**

## 第二步：在 Azure 创建一个 Web App
1. 使用您的微软账号登录 [Azure 门户 (https://portal.azure.com)](https://portal.azure.com)。
2. 在顶部搜索栏输入 **App Services (应用服务)** 并点击进入。
3. 点击左上角的 **+ Create (创建)** -> **Web App (Web 应用)**。
4. 填写基本参数（非常重要）：
   - **Subscription (订阅)**: 选择您可用的付款订阅。
   - **Resource Group (资源组)**: 点击新建，可以叫 `Panshaker-RG`。
   - **Name (应用名称)**: 起一个独一无二的名字，例如 `panshaker-work-timer`。（这将成为您未来的域名：`https://panshaker-work-timer.azurewebsites.net`）
   - **Publish (发布方式)**: 选择 **Code (代码)**。
   - **Runtime Stack (运行时堆栈)**: **务必选择 `Node 20 LTS` 或 `Node 22 LTS`**。
   - **Operating System (操作系统)**: 选择 `Linux`（推荐，性价比高）或 `Windows`。
   - **Region (区域)**: 挑选一个离您国内员工物理距离最近的可用区（如 `East Asia` 香港 或 `Japan East` 日本）。
   - **Pricing Plan (定价计划)**: 根据需要选择，初创测试可以选择免费的 `F1` 或最便宜的 `B1`。
5. 一路点击下一步，最后点击 **Review + create (查看并创建)**，最后点击 **Create (创建)**。
6. 等待 2-3 分钟，Azure 部署资源完成后，点击 **Go to resource (转到资源)**。

## 第三步：一键上传 ZIP 发布
最简单、最不易出错的方式就是使用 Azure 的 **Kudu ZipDeploy** 功能：

1. 打开浏览器的新标签页。
2. 输入您的应用专属管理后台网址（在您刚才起的应用名称后面加上 `.scm`）：
   如果是 `panshaker-work-timer`，网址就是：
   `https://panshaker-work-timer.scm.azurewebsites.net/ZipDeployUI`
3. 系统可能会要求您再次用微软账号登录。
4. 进去后，您会看到一个极其简单的带有文字 "Drag here to upload and deploy" 的拖拽框。
5. **直接将桌面上为您准备的 `PanshakerWorkRecord-AzureReady.zip` 文件拖进去！**
6. 列表会开始显示进度。它会自动解压、下载所需要的类库 (`npm install`)，并启动服务。在此期间请**耐心等待**直到状态显示为 "Successful" 或者它处理完毕。

## 第四步：验收并提供给员工
部署完毕后，一切就绪！
1. 直接用手机或电脑访问您的公网网址：`https://[您的应用名称].azurewebsites.net`
2. 它是**强制 HTTPS 安全加密的**，不需要额外配置证书。
3. 测试访问并输入密码：
   - 员工密码：`8888`
   - 老板密码：`9999`
4. 将您的这个漂亮网址和密码通过微信发给您的员工吧！

## 数据安全提示 (SQLite)
由于我们使用了本地文件型数据库 `work_records.db`，Azure App Service 内部为每个纯代码部署的实例分配了持久化的存储空间（在 `/home/site/wwwroot` 目录下）。因此只要您不销毁这个 Web App，每次通过 ZipDeploy 覆盖上传新代码**都不会**清空您的原始打卡数据（只要您新上传的压缩包里不包含一个空的 `work_records.db` 进行强行覆盖）。
