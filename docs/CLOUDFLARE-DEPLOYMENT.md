# Cloudflare Pages 部署

## Git 自动部署

生产仓库为 `LBEILC/RhineLabUI`，分支 `main`，构建命令 `npm run build:cloudflare`，输出目录 `release/cloudflare/site`，根目录为仓库根目录。Pages 注入 `CF_PAGES=1` 时打包到固定输出目录；本机构建继续使用版本号目录。

Pages 官方项目 URL 为 `rhine-lab-ui.pages.dev` 或其预览子域时，构建脚本从当前正式网站恢复三份授权 WOFF2 和原 CSS，逐个校验 SHA-256。恢复失败中止构建，保留正在服务的上一版本。授权字体不提交到 Git；其他 Pages 项目不自动恢复该字体。首次建站仍使用本机授权 kit 引导部署。

当前控制台支持为已有直接上传项目连接 Git 仓库，无需新建项目或更改 DNS；此流程以控制台实际提供的功能为准。

2026-09-15 已在控制台连接仓库，确认生产分支 `main`、自动部署启用、构建系统版本 3、命令和目录与上述一致。空目录恢复测试成功校验四个授权资源，模拟 Pages 环境构建输出 828 个文件。连接后的本次文档提交用于验证 Git 推送触发的首次托管构建。

### 自动部署验证结果

- 2026-09-15 20:19（UTC+8）：Git 提交 `4c8f62d` 自动触发部署 `8e956e3b-3dd1-4a8a-ae65-7b948b4e0d42`，状态 success，耗时 52 秒。部署地址 `https://8e956e3b.rhine-lab-ui.pages.dev/`，生产别名继续为 `rhine.lubeiluchen.cc`。
- 构建环境 Node.js 22.16.0、npm 10.9.2；执行 npm clean-install 后构建成功，日志确认恢复并验证四个授权资源、生成 828 个发行文件、解析 9 条标头规则。
- 生产 PWA 版本 `f3ab483c8b364c9e`。825 个应用文件验证通过；12 个文本文件仅存在 Windows／Linux 换行差异，其他内容与本地构建一致。按远程文件内容重新计算 PWA 版本哈希通过，Service Worker 代码及清单匹配，更新入口 no-store、模型 immutable 和缺失文件 404 均通过。
- 本地直接上传包的版本号可能因换行差异而不同。下面的逐字节校验命令适用于本地包和该包的直接上传部署；Git 构建应以托管构建日志中的版本及跨平台内容校验为依据，不能把换行造成的版本变化视为资源丢失。
- 后续正常推送 main 会自动发布。仅记录验证结果、不涉及产品内容的提交可按需使用 `[CF-Pages-Skip]` 前缀跳过冗余部署。

## 构建

从正式 main 版本构建，安装项目依赖及本机已授权的 Novecento Webfont kit 后执行：

```powershell
npm run build:cloudflare
```

`release/cloudflare/latest.json` 指向本次版本目录。打包脚本从 PWA 资源清单生成静态发行包，验证三个字体的 SHA-256、单文件 25 MiB 与 20,000 文件限制；缺少授权字体直接停止。源码仓库继续排除字体 kit。

Cloudflare Pages 项目名为 `rhine-lab-ui`，默认地址为 `https://rhine-lab-ui.pages.dev/`。首次迁移通过上传版本目录内容生成的 ZIP 完成；连接 Git 后日常发布由推送自动触发。需要手动恢复时，可使用 `wrangler pages deploy <版本目录> --project-name rhine-lab-ui --branch main`，不依赖暂停中的 Vercel 来恢复字体。

本次发行包共 828 个文件，浏览器上传成功。浏览器直接上传上限为 1,000 文件；资源增长后改用 Wrangler 上传（免费项目上限 20,000 文件）。

上传后执行以下命令，对比版本清单、全部应用文件字节、关键缓存头和缺失资源响应：

```powershell
node scripts/check-cloudflare-deployment.mjs https://rhine-lab-ui.pages.dev/
node scripts/check-cloudflare-deployment.mjs https://rhine.lubeiluchen.cc/
```

## 缓存与 PWA

发行包生成 `_headers`，保留 MiSans 分包和带内容哈希模型的一年不可变缓存；首页、Service Worker、更新入口与版本清单使用重新验证策略。`404.html` 防止不存在的模型或字体被首页 HTML 代替。PWA 缓存内容与版本规则保持原样。

## 域名切换记录

目标域名：`rhine.lubeiluchen.cc`。DNS 由阿里云管理，先在 Pages 中绑定该自定义域名，再更新阿里云的 `rhine` CNAME。无需更改 NS。

2026-09-15 浏览器读取的原记录：

- 类型：CNAME；主机记录：`rhine`；线路：默认。
- 原值：`cfbe4759f8473c27.vercel-dns-017.com`。
- TTL：10 分钟；权重：1；状态：启用。
- 原备注：`Rhine Lab UI · Vercel`。

2026-09-15 已通过浏览器将 `rhine` CNAME 提交为 `rhine-lab-ui.pages.dev`，保持默认线路、10 分钟 TTL、权重 1 和启用状态，备注改为 `Rhine Lab UI · Cloudflare Pages`。

首版 PWA 版本为 `c4ceb4fc0bf3994d`。Pages 地址与正式域名各校验 825 个文件，字节全部匹配；检查了更新文件不存储、模型不可变缓存和缺失资源 404。2026-09-15 20:05（UTC+8）正式域名返回 HTTP 200、`Server: cloudflare`，控制台显示“活动、SSL 已启用”。Edge 实际打开原域名，完成开场、阵列、档案详情和 360° 模型加载与画面检查。

切换期间内置浏览器仍短暂命中旧 Vercel DNS 缓存，Edge 与公开 DNS 已使用新记录。短时间仍见暂停提示的访客可等待原 10 分钟 TTL 到期后重开页面；这不需要清除收藏或网站数据。

首次迁移使用直接上传，之后用户授权接入 Git 自动部署。自动构建配置及验证结果以本文“Git 自动部署”部分为准。

回退 DNS 可恢复原记录，但原 Vercel 服务因额度超限暂停，回退本身不会解除暂停。
