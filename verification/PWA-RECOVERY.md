# Win11 桌面动效与 PWA 更新入口

日期：2026-09-09。反馈环境：Windows 11，Chrome 152.0.7977.83，Edge 同样出现症状。

## 复现与判断

在本机 Chrome 152.0.7977.83 和 Edge 152.0.4191.66 中使用新建浏览器上下文，对比 `prefers-reduced-motion` 的两种状态。正常状态进入开机动画；`reduce` 状态直接进入阵列，减少选档、镜头和文字动效。两种状态都可打开右上角圆形图标对应的设置窗口。默认继承系统偏好和跳过开机的代码在 PWA 之前的 c24afa5 中已存在。

这证明系统减少动画可以造成相同症状，不能证明反馈者的 Win11 开关一定关闭；未直接检查对方设备。原先设置只有图标，提示要求“在设置中更新”却没有可点操作，确实不易找到入口。

另用两个完整生产构建复现旧版本更新：先安装旧 Service Worker，再切换服务端新版，调用 Chromium `Network.clearBrowserCache` 后重新加载。页面仍由旧 Service Worker 提供，新版处于 waiting。只清理 HTTP 缓存不能保证替换离线副本。

## 修改

- 设置图标增加可见文字，新版就绪后在底部提供“更新并重启”，保留设置内的更新按钮。
- `update.html` / `update.js` 不进入离线清单，可通过网络加载恢复入口；用户点击后检查并下载新版，等待激活后返回。保留收藏与偏好。
- 设置中说明减少动效会跳过开机与简化选档，并提供“启用完整动效并重播”。选择保存在本站，系统辅助设置不变。
- 正文解密遮罩改为遵循 `.reduce-motion`，避免系统媒体查询覆盖用户在本站明确开启完整动效的选择。

## 回归方式

`scripts/check-startup-motion.mjs` 检查正常启动、减少动画启动、明确覆盖系统偏好、重播、选档脉冲、正文遮罩和刷新后保留偏好。

`scripts/check-pwa-recovery.mjs` 以 `PWA_PREVIOUS_DIST` 指向保留的旧构建，检查普通缓存清理后仍运行旧版、从网络恢复入口迁移、保留收藏与动效偏好、更新后离线重载，以及从未安装 Service Worker 的新访客。

两个脚本分别使用 Chrome 与 `REVIEW_CHANNEL=msedge`。另运行 `scripts/check-pwa.mjs`，覆盖直接更新按钮、完整离线资源、失败更新保留旧版及不清理其他应用缓存。截图和报告存放于 `.tools/responsive`。浏览器动效偏好通过自动化设置，未修改测试机的 Windows 全局辅助功能设置。

本次结果：Chrome 152.0.7977.83 与 Edge 152.0.4191.66 的动效和旧版恢复测试通过。Chrome 额外模拟恢复下载时一个图标返回 503，页面报告失败并继续保留上一完整版本；直接更新、离线查看、偏好保留和模态输入隔离也通过。

平台依据：[MDN 的系统减少动画映射](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)、[Chrome 的 Service Worker 更新生命周期](https://developer.chrome.com/docs/workbox/handling-service-worker-updates)。
