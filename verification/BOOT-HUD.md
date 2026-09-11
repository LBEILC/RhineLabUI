# 开场 HUD

2026-09-11：按用户要求，既有 HUD 开关覆盖开场 UI。

- 接入 ACCESS、Logo、验证文字、扫描圆环与欢迎画面；品牌及 Powered 共用既有投影。
- 先更新 BootSequence 当帧原始动作，再读取本帧布局并计算投影，避免缓存旧的 Logo 位移或欢迎缩放。仅开场逐帧测量相关七块内容，交互阶段保留原来的按需测量。
- 阶段切换不再将 HUD 深度归零。关闭追踪保留曲面，减少动态效果停止追踪，关闭 HUD 恢复原始 DOM 变换。三维镜头继续不响应被动指针。
- 磨砂底沿用仅交互阶段启用的范围，全局屏幕效果继续覆盖开场。

验证：`npm run build:wallpaper`、`node scripts/check-visual-effects.mjs`、`node scripts/check-boot-hud.mjs` 通过。Edge 实际运行覆盖开场五块投影、启停、静态追踪、减少动态效果、工作台衔接与 2560×1080 视口；无页面异常。截图与结果见 `verification/boot-hud/`。检查了圆环与欢迎画面截图；尚待用户试用最终观感。

复现脚本自带 5189 静态服务，读取壁纸构建；可通过 `PLAYWRIGHT_MODULE` 指定 Playwright 安装位置。
