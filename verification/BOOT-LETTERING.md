# 开场中央文字 · Novecento

2026-09-11，按用户要求将适合的中央开场文案统一替换，不仅限于 START PROCESSING。

- Normal：访问权限、身份确认、请求接收、开始处理、权限通过，以及处理中的留白故障帧。
- Bold：WELCOME TO、RHINE LAB.LLC.、INTERNAL DATABASE；公司名称的黑底与灰闪层使用相同图形。
- 保留原逐字时间轴、声音触发、授权字距收束、欢迎黑底扫过及 HUD 投影。左上 RHINE LAB 后续改为 DemiBold，下方两行保留 MiSans。

## 来源与制作

在原片 18 秒的 START PROCESSING 裁切上，以实际 OTF 对比 Light、Normal、DemiBold、Bold 和 Arial。Normal 在本次统一字号／字距搜索中最贴合。该比较用于选型，不代表获得了原工程的字体记录。

Normal 与 DemiBold 来自作者的 DaFont 免费包；用户已明确同意其许可。Bold 来自用户既有 MyFonts 桌面字体包。源文件版本与 SHA-256 见 `boot-lettering/sources.json`。本地比较材料位于 `.tools/font-comparison/`，字体不纳入 Git 或发行包。

根据两个来源许可中将字母作为轮廓图形导入的条款，项目仅发行十段预先制作的固定文字图形，不嵌入 OTF 或 Webfont。`scripts/make-boot-lettering.py` 需要使用者自行提供获许可的本地字体，并安装 Pillow、fonttools 4.59.2。执行示例：

```powershell
python scripts/make-boot-lettering.py --fonts .tools/font-comparison/fonts
```

生成 `src/boot-lettering-art.json`（29,698 字节），保留逐字显现所需的图形分段，不提供任意文字排版或通用字库。来源声明随发行包保存在 `assets/boot-lettering-notice.txt`。

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

## 左上标题后续修订

用户指出 Bold 偏重后，同一裁切拟合的 DemiBold 像素 MSE 为 0.03689，Bold 为 0.06343，支持采用 DemiBold。对照图 `boot-lettering/brand-demibold-fit.png` 从上到下为原片、DemiBold、叠加；不代表原工程字体鉴定。原始品牌外层及三行节点不变，第一行固定 48px 高，避免推动下方内容。复核页新增标题文字、DemiBold 图形和行高检查。

此修订实际浏览器共 14 项检查全部通过，含原有 83 个文字变化；两种发行构建再次通过。

## MyFonts 正式 Webfont（2026-09-11 后续）

用户明确授权接受 MyFonts 条款并领取字体。Normal、DemiBold、Bold 的年度 Webfont 订单已成功，当前每种每月 10,000 次页面浏览，合计 $0；自动续期未开启。订单与个人账单信息不写入仓库。MyFonts 的单域名网页许可范围不应等同于允许分发 Wallpaper Engine 字体包；用户获知区别后仍要求本机直接替换，此轮完成本机构建，未上传创意工坊。

官方 Kit Builder 下载的原始 WOFF2 总计 119,732 字节。每种所用 27 个字符的字形与之前桌面 OTF 一致，来源版本与哈希见 `boot-lettering/webfont-sources.json`。字体未经转换、子集化或修改。原包保存于本机 `.tools/myfonts-webfont/`；字体包和版权声明安装到 `public/fonts/novecento/`，该目录已加入 Git 忽略。

其他获许可的维护者可将官方 Kit Builder 的包解压，将其顶层内容放到上述目录，保持 `webFonts/NovecentoSansWideNormal/font.woff2`、`NovecentoSansWideDemiBold/font.woff2`、`NovecentoSansWideBold/font.woff2` 三个相对路径，并保留原 CSS 的版权声明。重启开发服务器或重新构建后生效。字体权利不随项目 MIT 许可转让。

Vite 检查本地三种字体是否齐备；齐备时开场准备阶段加载三种原生 FontFace，成功后用真实文字替换 SVG 字形。保留原有逐字容器宽度和字距，以避免位置、声音触发和动画变化。官方字体行度量为 1021/-179，1em 行高下基线为 0.921em；字形上移 0.121em 对齐既有 0.8em 基线。缺少字体包或网络失败时保留原图形，8 秒超时不阻断启动。

浏览器实际通过 15 项检查：原有文字／品牌／扫描／欢迎回归通过，确认三种 WOFF2 均已加载、所有文字改用真实字体且不保留文字 SVG 路径。网页与壁纸构建均通过；PWA 资源表包含三种 WOFF2。公开 Git 仅提交接入逻辑和声明，不包含授权字体。新环境未安装字体包时仍使用此前图形。
