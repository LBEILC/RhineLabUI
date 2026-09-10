# Wallpaper Engine 本地实验

分支：`codex/wallpaper-engine`。2026-09-10 已在本机 Wallpaper Engine 的独立窗口中运行，尚未发布创意工坊、尚未应用到桌面，不合并主分支。

## 本机入口

Wallpaper Engine 本地库名称：**Rhine Lab · 莱茵生命档案终端（本地测试）**。

安装目录：`D:\Game\Steam\steamapps\common\wallpaper_engine\projects\myprojects\rhine-lab-local`。

当前预览窗口：**Rhine Lab - Wallpaper Test**。重新打开独立预览：

```powershell
& 'D:\Game\Steam\steamapps\common\wallpaper_engine\wallpaper64.exe' -control openWallpaper -file 'D:\Game\Steam\steamapps\common\wallpaper_engine\projects\myprojects\rhine-lab-local\project.json' -playInWindow 'Rhine Lab - Wallpaper Test' -width 1600 -height 900
```

项目目录中的 `project.json` 带有本地标题、预览图片和可调属性。只有构建产物目录应导入编辑器，不能导入整个源码仓库。重新发布未来已有的工坊项目时，应保留该项目的工坊 ID 与元数据。

## 构建与行为

```sh
npm run build:wallpaper
node scripts/check-wallpaper.mjs
```

构建输出 `release/wallpaper`，约 34.1 MiB，823 个文件，包括完整字体分包、模型、音频、档案 TXT 和许可。字体和模型均本地读取，无需开发服务器或在线站点。源码、Blender 工程、参考视频、诊断服务不进入壁纸包。

- Vite 的 `wallpaper` 模式使用相对资源路径，HTML 中提前注册宿主回调，以免丢失模块载入前的初始属性。
- 自动启动；宿主可以关闭开场，直接进入阵列。减少动态效果继续遵循显式设置。
- 声音自动尝试解锁，等待最多 3 秒后继续画面；声音未能解锁时仍可通过后续点击触发。正常网页的点击启动流程保留。
- 壁纸版关闭 PWA 初始化、安装和更新界面。更新通过替换本地构建或未来的工坊更新完成。
- 宿主提供开场、音效、音乐、独立音量、减少动态效果和四档画质。宿主只推送变化的属性，页面保留其余设置。
- 页面设置也可使用；重载时宿主下发的值具有优先权，页面内更改不会反向写回 Wallpaper Engine 的属性面板。
- 三维渲染跟随宿主 FPS 上限（未收到时为 30），不会补渲染漏掉的帧。宿主暂停通知停止更新与音频；开场恢复时扣除暂停时间。
- 壁纸版不提供浏览器全屏按钮。画质参数以点击循环选项的按钮呈现，保留原有参数值和高级设置。

## 本机验证记录

环境：Windows、本机 Wallpaper Engine 窗口显示版本 2.8.36，独立窗口 1600×900，真实 CEF / WebGL 渲染。管理界面另提示 2.8.42 已下载、待重启，本次没有执行更新。

已验证：

- 自动开场、白底 Logo 与文字、中文字体、三维阵列本地加载。
- 鼠标点击切档（X-001 → X-006）、打开档案、磨砂揭示和正文解密。
- 360° 模型本地加载、分层拆解与鼠标拖动旋转。
- 初始宿主属性 `boot=false` 直接进入阵列，`musicvolume=15` 在页面显示 15%。
- 运行中经官方 `applyProperties` 指令将音乐音量改为 23%，收到 `{musicvolume:{value:23}}` 回调，已打开的页面控件同步至 23%。
- 画质按钮从“原始”切换为“高”，实际渲染从 1600×900 变为 2000×1125，并启用 SMAA。
- 实际音频状态为 `running`，三条音乐轨道已载入并播放，错误字段为空。声音主观听感仍由用户试听。
- 限帧、暂停恢复及部分属性回调通过脚本验证；新增回归检查确保壁纸不再生成原生 `<select>`。
- `npm run build:wallpaper` 与正常网页 `npm run build` 均通过，网页 PWA 构建成功。

运行数据有一次阵列采样为 22 FPS（宿主上限 30），不能把上限写成稳定实际帧率。本次未做长时间功耗测试、4K / 多屏压力测试或真实桌面图标遮挡下的完整输入验证。

![Wallpaper Engine 实际设置页，音量同步与画质切换](../reference/wallpaper-engine/settings.png)

### 本机 CEF 的下拉框崩溃

打开原设置页会稳定出现 `STATUS_ILLEGAL_INSTRUCTION`。诊断确认页面逻辑完成后、首次绘制前崩溃；最小弹窗和声音控件正常，单独画质区域可复现，去掉其中 `<select>` 后正常。最终只在壁纸模式将画质下拉框换为循环按钮，恢复原背景模糊、焦点处理和原生音量滑块后，全设置页正常。

此记录描述本机的复现与兼容处理，不断言所有 CEF 版本都存在此问题。没有修改 Wallpaper Engine 全局画质、硬件加速或安全设置。

### 当前交付边界

本地壁纸库和独立预览可用；自动审批拒绝了替换主显示器壁纸，需用户明确批准后才应用到桌面。本次未上传创意工坊。上传前还应完成桌面输入、长时间性能和发布素材的最终检查。

## 官方接口参考

- [创建与导入网页壁纸](https://docs.wallpaperengine.io/en/web/first/gettingstarted.html)
- [用户属性与暂停通知](https://docs.wallpaperengine.io/en/web/api/propertylistener.html)
- [FPS 限制](https://docs.wallpaperengine.io/en/web/performance/fps.html)
- [命令行预览与属性设置](https://help.wallpaperengine.io/en/functionality/cli.html)
