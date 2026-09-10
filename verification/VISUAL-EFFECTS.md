# 壁纸 UI 视差与画面质感

2026-09-10。用户指定参考本机创意工坊 3088099655，并明确仅 UI 随鼠标移动。只读查看配置与包内镜头畸变、CRT、色差实现；交付采用原创 CSS / GLSL，没有复制参考图片、字体或着色器。

WE 新增「HUD 与画面质感」原生分组。HUD 视差、屏幕质感、界面磨砂底均默认关闭，强度分别可调。颗粒、边缘色差、暗角各自可调。开场不启用这些效果。

UI 使用独立 translate / rotate 叠加原过渡。开启时停用已有鼠标镜头偏移。离开、失焦与弹窗开启时回正，减少动态效果直接回正。原卡片拖动、抽取和归位规则继续沿用。

局部磨砂底采用 backdrop-filter 和主题底色，随 UI 运动，关闭清除滤镜。原创 ShaderPass 位于 OutputPass 后，使用静态空间颗粒，无时间闪烁；色差、颗粒和暗角处理三维画面，DOM 文字保持清晰，关闭跳过 pass。

验证通过：check-visual-effects.mjs（默认值、非法值、边界、部分回调、UI 指针、弹窗、减少动态效果、开场隔离），check-wallpaper.mjs、check-workbench.mjs、check-playground.mjs（含七个原生分组），npm run build:wallpaper、npm run build。构建保留既有大块体积提示。

Edge 实际查看 reference/visual-effects-review.html 的明暗完成态。75% 视差右上测试测得 UI 平移约 8.58 / -6.06px、倾斜约 1.29°，canvas translate 为 none；65% 磨砂计算值 blur(15.6px)。背景局部模糊，文字清晰。浏览器检查不等于 Wallpaper Engine 宿主性能测试，本次未测宿主 GPU 开销。
