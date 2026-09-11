# 手动发布到 Wallpaper Engine 创意工坊

正式名称：**Rhine Lab · 莱茵生命交互桌面**。

正式本地工程已关联创意工坊条目 `3799142774`，后续使用「发布更新」。

工程目录：

```text
D:\Game\Steam\steamapps\common\wallpaper_engine\projects\myprojects\rhine-lab-workshop
```

## 第一次发布

1. 确保 Steam 在线，打开 Wallpaper Engine。如果已经打开过，重新打开壁纸选择界面，让它刷新本地工程。
2. 在「已安装」里搜索 `Rhine Lab`，选择 **Rhine Lab · 莱茵生命交互桌面**。另一个带「本地测试」的条目是之前的试用工程，本次使用新名称的条目。
3. 点击右侧详情里的 **在编辑器中打开**。
4. 在编辑器顶部打开 **创意工坊** 菜单，选择分享／发布壁纸的选项，进入 **发布到创意工坊** 表单。不同版本的菜单可能称为「准备发布」或「在创意工坊上分享壁纸」。这是发布完整壁纸，不是发布组件或属性预设。[官方网页壁纸发布流程](https://docs.wallpaperengine.io/en/web/first/gettingstarted.html)
5. 核对标题为 **Rhine Lab · 莱茵生命交互桌面**。描述已写入工程；如果界面未带出，可从本文末尾复制。
6. 设置 **可见性：公开**、**年龄分级：大众级（Everyone）**；样式可选 **科技（Technology）**。
7. 在 **预览图片 → 导入文件** 中选择下面的 GIF。即使已经出现封面，也可以重新导入这一版。

```text
D:\Game\Steam\steamapps\common\wallpaper_engine\projects\myprojects\rhine-lab-workshop\preview.gif
```

8. 第一次上传选择 **创建新项目**，点击 **发布**，等待提示上传成功。
9. 点击 **在创意工坊中显示壁纸**，检查正式名称、动画封面和可见性。如果 Steam 要求接受创意工坊协议，由你在 Steam 页面完成。若页面提示审核中，等待审核即可，不要重复创建条目。
10. 保存工坊页面链接，并备份整个 `rhine-lab-workshop` 工程目录，尤其是发布后更新的 `project.json`。

## GIF 说明

工坊封面为 256×256、13.2 秒、约 940 KB，包含工作台全景、时钟与事项特写、专注计时特写、暗色全景与暗色特写，再回到亮色全景。它从真实浏览器画面剪辑并裁切放大，使用演示事项及演示频谱；演示事项没有写入壁纸的默认值。

GIF 是无声的。预览封面不能完整表现所有细节，订阅后的壁纸按实际屏幕尺寸渲染。官方规定 GIF 预览不超过 256×256、文件不超过 1 MB；当前文件符合该限制。[官方预览说明](https://docs.wallpaperengine.io/en/scene/first/publishing.html#animated-preview-images)

## 以后如何更新

可以持续更新同一个工坊条目，原订阅者会收到更新，无需重新订阅。[官方更新说明](https://docs.wallpaperengine.io/en/scene/first/publishing.html#publishing-updates)

1. 更新这个原工程的壁纸资源，保留 `project.json` 中的 **workshopid**，以及原发布关联。
2. 从同一条目选择 **在编辑器中打开**，再次进入发布窗口。
3. 「上传为」应为 **更新现有项目**，按钮应显示 **发布更新**；填写本次更新说明并发布。
4. 如果变成「创建新项目」，先检查是否打开了其他工程或丢失工坊 ID，不要直接发布一个重复条目。

源码仓库的 `npm run build:wallpaper` 只生成构建包，不会自动读取 Steam 刚生成的工坊 ID。首次发布后，不要用尚未包含该 ID 的构建版 `project.json` 直接覆盖已发布工程的同名文件。后续交给代理更新时，提供这个工程目录或工坊链接，让代理先保留发布关联再同步资源。

工坊上传不等于源码备份。保留源码仓库和发布工程，两者都有用途。

## 可复制的发布描述

完整简介保存在 [WORKSHOP-DESCRIPTION.txt](WORKSHOP-DESCRIPTION.txt)，并同步到正式工程的 description。更新日志放在最前面，按日期从新到旧，同一天按更新顺序从新到旧排列，后接功能介绍。日期依据开发记录整理，不代表当天每一项都单独发布过工坊版本。以后完成更新时，在简介顶部追加面向用户的变化。

若发布窗口未自动带出新简介，将该文本文件的完整内容粘贴到描述栏，再发布更新。
