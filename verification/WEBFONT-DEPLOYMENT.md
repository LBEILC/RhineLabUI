# 官网 Novecento 字体部署

2026-09-11：之前的字体提交仅在 Wallpaper Engine 分支，且授权字体文件不进入 Git，因此正式网页仍是原版。将开场字体相关提交独立集成到 main，保留网页原有功能。

- 本机通过 MyFonts 正式 Webfont kit 构建，三份 WOFF2 共 119,732 字节；文件哈希见 `boot-lettering/webfont-sources.json`。
- 首次使用 `npm run build`、`node scripts/package-vercel.mjs` 和 Vercel `deploy --prebuilt --prod` 部署静态输出，不读取生产环境变量。
- 后续仅本项目 Vercel 构建从当前正式域名恢复同一份字体及原 CSS，逐文件验证 SHA-256。恢复失败中止构建，保留原部署；其他项目没有本地字体时沿用固定文字图形。
- 正式域名 `https://rhine.lubeiluchen.cc/` 的 PWA 版本为 `0aa8a1c41186b335`。从空目录执行恢复脚本，成功下载并验证全部四个资源，线上 PWA 清单包含三份字体。
- 本地正式构建通过；原生浏览器字体回归 15 项通过，三种字重用于开场的 27 个字形分别与源文件一致。线上完成资源及版本校验，未将这些 HTTP 检查称作线上视觉验收。

已安装旧 PWA 的用户可从设置更新并重启，或打开 `/update.html` 恢复入口。授权原文件与订单不提交到公共仓库；官网 Webfont 授权不等同于 Wallpaper Engine 内容包分发许可。
