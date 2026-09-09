# 主屏幕安装与离线使用

正式地址：[rhine.lubeiluchen.cc](https://rhine.lubeiluchen.cc/)。

## iPhone / iPad

1. 用 Safari 打开正式地址。
2. 轻点“分享”，选择“添加到主屏幕”；如果出现“作为网页 App 打开”，保持开启。
3. 从主屏幕的莱茵生命图标打开，即可使用没有 Safari 地址栏的独立窗口。系统状态栏和底部手势区域会保留安全间距。

首次保持联网，在终端设置的“主屏幕与离线”区域看到“离线资源已就绪”后，即可断网重新打开。离线资源约 28 MiB，包含模型、字体、音乐与 40 份档案。Safari 标签页和主屏幕 App 的存储可能各自独立，请以主屏幕 App 内显示的状态为准。

如果浏览器清除了网站数据或系统回收了缓存，需要联网重新准备离线资源。声音仍需要一次用户操作才能开始播放，音效与音乐开关沿用终端偏好设置。

## 桌面与其他手机

支持安装的浏览器会在终端设置中提供“安装到设备”，也可使用浏览器菜单安装。不同浏览器的菜单名称可能不同；普通浏览器标签页同样支持在线使用。

阵列上左右滑动切列，上下滑动切档；也可轻点方向按钮。详情中的正文独立滚动。360° 查看器支持单指旋转、双指缩放和平移，以及拆解、重组和复位。横竖屏切换保留当前档案和查看器状态。

## 更新

新版本会在后台下载完整资源，准备好后在页面底部提供“更新并重启”，也可从右上角“设置”中更新。更新不会清除收藏与偏好。下载失败时继续使用上一个完整离线版本，联网后重试即可。

如果旧版只有提示、找不到更新入口，请打开[更新终端](https://rhine.lubeiluchen.cc/update.html)，点击“更新并返回”。这个入口从网络获取，不经过旧版本的页面缓存；应用完整新版后返回终端。普通“清除缓存”不一定清除 Service Worker 的离线副本，无需清空网站数据或收藏。

## 开机动画与选档动效

首次进入时，本站遵循系统的减少动画偏好。Win11 的“设置 → 辅助功能 → 视觉效果 → 动画效果”关闭时，Chrome / Edge 可能请求减少动画，本站会跳过开机动画并简化选档等动效。终端之后会保存本地偏好，资源更新不会重置它。

需要完整动效时，打开右上角圆形图标下标有“设置”的按钮，选择“启用完整动效并重播”。这只调整本站，无需修改系统设置。减少动态效果开关也可随时重新开启。

## 开发与 Vercel

`npm run build` 生成静态站点和带内容版本号的 Service Worker，输出在 `dist`。现有 Vercel 项目沿用 GitHub 自动部署，配置见 `vercel.json`。Service Worker、manifest 与构建清单使用重新验证缓存头。离线功能只在正式构建的 HTTPS 或 localhost 环境注册，`npm run dev` 不注册。

本地验证：运行 `npm run build`，再运行 `npm run preview`。浏览器测试见 `scripts/check-pwa.mjs`，需要本机可用的 Playwright 与 Chrome；可通过 `PLAYWRIGHT_MODULE` 指定已有 Playwright 模块路径。

`scripts/check-startup-motion.mjs` 验证系统偏好与本站覆盖、重播和正文解密；`scripts/check-pwa-recovery.mjs` 验证旧版迁移，需要以 `PWA_PREVIOUS_DIST` 指定保留的旧生产构建。两个脚本可设 `REVIEW_CHANNEL=msedge` 验证 Edge。更新恢复页保持网络获取，未加入离线资源清单。

图标源自项目共享莱茵生命 SVG 路径，生成脚本为 `scripts/build-icons.mjs`，通过 `SHARP_MODULE` 可指定本地 Sharp 模块。修改资源后重新构建即可生成新的离线版本，无需手动修改缓存编号。

平台说明参考：[WebKit 主屏幕 Web App](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)、[Safari 26 主屏幕安装行为](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)、[Service Worker 生命周期](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)。
