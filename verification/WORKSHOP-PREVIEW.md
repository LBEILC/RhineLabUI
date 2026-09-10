# 工作台工坊预览

2026-09-10 用户改为自行发布，要求录制 GIF，并参照本地工坊项目 3088099655 的镜头方式。

参考预览分析：256×256，127 个编码帧，12.8 秒，帧延迟主要 100ms；全景与局部裁切交替，局部轻微移动。具体制作软件无法仅凭 GIF 确定。没有使用其人物图片、文字、4K 标记或任何画面作为本作品素材。

素材由 scripts/record-workshop-preview.mjs 在 1280×720 浏览器内录制，展示工作台、演示事项、音乐频谱、专注页与明暗切换。53 个截图素材按实际时间记录；随后 scripts/encode-workshop-preview.py 组织六个镜头并进行局部推近。素材受截图采样速度限制，导出 100ms 时间步不代表原三维渲染或录制达到稳定 10 FPS。

最终 wallpaper/preview.gif：256×256、13.2 秒、940017 字节、73 个编码帧（相同帧合并延长停留），小于 1 MB。全局 24 色调色板用于减少闪动与体积；主要损失为细渐变层次。reference/workshop-preview/workbench-preview.gif 是 640×640、96 色的本地审阅版，不能作为受 1 MB 限制的工坊封面直接上传。

镜头：亮色全景 1.8s → 时钟与事项 2.4s → 亮色专注 2.4s → 暗色全景 2.0s → 暗色专注 2.0s → 亮色全景 2.6s。storyboard.jpg 已逐镜检查；输入没有写入生产默认任务。封面预览路径和正式名称写入 wallpaper/project.json，构建脚本自动复制 GIF。

正式工程准备在 myprojects/rhine-lab-workshop，尚未上传。用户操作步骤与保持工坊 ID 的更新注意事项见 docs/WORKSHOP-PUBLISH.md。
