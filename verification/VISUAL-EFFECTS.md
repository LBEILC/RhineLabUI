# 壁纸 UI 曲面与全局画面质感

2026-09-10。用户提供三张标注截图，要求重新查看本机创意工坊 3088099655；UI 单独产生空间视差，色散、颗粒、暗角处理全局。

## 参考结构与本次修正

只读查看指定项目的 project.json 与 scene.pkg。场景禁用了 camera parallax；前后两个 Full Composition Layer 使用正负 0.02 的径向镜头畸变，UI 位于中间，背景经过相反方向处理。cursortracking 控制两层相反的切向中心偏移，归一化鼠标乘正负 0.005，关闭时回到中心。另一个合成层使用 CRT 与色散；颗粒还受 resolution 影响，中心附近色散较弱。参考文件没有复制到交付包。

此前同方向 translate / rotate 与仅三维的 ShaderPass 已撤换。本版 UI 各区块以共同径向曲面四角计算 matrix3d，左上／右上、左下／右下的斜率不同。为保留原生 DOM 控件、磨砂底和正确命中范围，区块内部采用四角投影近似，没有声称逐像素复用参考项目的光学 shader。曲率为纵深 × 0.08，指针改变切向项。屏幕角落归一化避免把边缘内容推离画面。关闭鼠标追踪保留静态曲面；关闭视差返回原布局。WE 被动指针不再移动三维相机，显式拖动卡片规则沿用。

全局效果现在使用浏览器 SVG SourceGraphic 合成，涵盖三维画布、DOM 文字、按钮、磨砂与模态查看器。径向色散分别偏移红／蓝通道；边界淡出并校正位移图中性值，避免彩色边框。颗粒为单色 soft-light 合成，有强度和尺寸，12Hz 更新；暗角同样在全局合成后衰减。关闭时移除滤镜，单项为零时不创建对应处理节点。保留 sRGB 避免不必要的色调变化。技术依据：[SVG 位移滤镜](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)、[SVG 混合滤镜](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feBlend)。

三项主开关默认关闭。鼠标追踪默认开启，依赖 UI 视差显示。减少动态效果时停止追踪、冻结颗粒，但不取消用户选中的静态曲面。开场没有 UI 曲面，仍经过用户启用的全局屏幕效果。局部磨砂继续独立配置。

## 验证

- check-visual-effects.mjs：三种宽高比零纵深恒等、曲面左右对称、两侧斜率相反、投影矩阵四角精确匹配、部分属性回调、追踪关闭保留曲面、弹窗停止追踪、减少动态效果、开场全局滤镜范围。
- check-workbench.mjs、check-wallpaper.mjs、check-playground.mjs：工作台、宿主回调、原生七分组与条件显示通过。
- Edge 实际打开 reference/visual-effects-review.html，逐项检查曲面、色散、颗粒、暗角。70% 纵深、追踪关闭时，左上品牌顶边斜率约 +0.098，canvas transform 为 none；右侧与底部方向相应反转。
- 60% 色散清楚覆盖品牌字体、时钟与三维卡片边缘；修正后的边缘无越界彩框。80% 颗粒 / 60% 尺寸在浅色背景可见；70% 暗角同时压暗暗色主题的文字与背景。
- 曲面与磨砂开启时，实际点击底部「专注计时」成功切换，再点击变形后的设置入口成功打开弹窗。20% 色散、30% 颗粒、35% 暗角同时覆盖设置弹窗，弹窗内容和按钮仍可使用。
- 浏览器检查不等于 Wallpaper Engine 宿主 GPU 性能测量。本次不宣称宿主帧率；整体合成滤镜的实际负载取决于壁纸分辨率和硬件。
`npm run build:wallpaper` 与 `npm run build` 均通过；保留既有大块体积提示。
