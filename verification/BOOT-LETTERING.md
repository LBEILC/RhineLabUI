# 开场中央文字 · Novecento

2026-09-11，按用户要求将适合的中央开场文案统一替换，不仅限于 START PROCESSING。

- Normal：访问权限、身份确认、请求接收、开始处理、权限通过，以及处理中的留白故障帧。
- Bold：WELCOME TO、RHINE LAB.LLC.、INTERNAL DATABASE；公司名称的黑底与灰闪层使用相同图形。
- 保留原逐字时间轴、声音触发、授权字距收束、欢迎黑底扫过及 HUD 投影。左上品牌继续使用已校准的 MiSans。

## 来源与制作

在原片 18 秒的 START PROCESSING 裁切上，以实际 OTF 对比 Light、Normal、DemiBold、Bold 和 Arial。Normal 在本次统一字号／字距搜索中最贴合。该比较用于选型，不代表获得了原工程的字体记录。

Normal 来自作者的 DaFont 免费包；用户已明确同意其许可。Bold 来自用户既有 MyFonts 桌面字体包。源文件版本与 SHA-256 见 `boot-lettering/sources.json`。本地比较材料位于 `.tools/font-comparison/`，字体不纳入 Git 或发行包。

根据两个来源许可中将字母作为轮廓图形导入的条款，项目仅发行九段预先制作的固定文字图形，不嵌入 OTF 或 Webfont。`scripts/make-boot-lettering.py` 需要使用者自行提供获许可的本地字体，并安装 Pillow、fonttools 4.59.2。执行示例：

```powershell
python scripts/make-boot-lettering.py --fonts .tools/font-comparison/fonts
```

生成 `src/boot-lettering-art.json`（28,430 字节），保留逐字显现所需的图形分段，不提供任意文字排版或通用字库。来源声明随发行包保存在 `assets/boot-lettering-notice.txt`。

## 实现与验证

`BootLettering` 预建图形节点，仅在文字变化时更新可见段；可访问文本单独保留。未知新文案回退为普通文字，维护时需重新制作图形。授权扫描圆环在文字绑定前收集路径，避免把字形路径作为圆弧修改。

浏览器复核入口：`reference/boot-lettering-review.html`。本机 Chromium 实际运行通过 12 项回归：

- 169–487 帧共 83 个实际文字变化，文本、图形段数与时间轴一致，覆盖标点、空白和故障帧。
- 静止 450ms 内无文字 DOM 修改；前后跳帧复用原节点并恢复相同可见图形。
- 授权图形宽度随字距收束；扫描圆环仍为六条动画弧，跳帧结果一致。
- 欢迎灰闪及恢复符合原透明度，四个显示层全部使用 Bold。
- 无意外文案回退、无 Novecento 字体文件请求；开场结束正常隐藏文字进入阵列。

处理提示与欢迎画面已在浏览器检查。此轮不声称真实 iPhone 验收或所有 HUD 参数组合均已重测。

`npm run build` 与 `npm run build:wallpaper` 均通过，包含 TypeScript 检查；只出现既有的大体积 JavaScript 分块提示。壁纸产物位于 `release/wallpaper`，此轮未上传创意工坊。
