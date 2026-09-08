# RHINE LAB · ANALYSIS OS

**把莱茵生命的终端，做成可以操作的三维界面。**

![莱茵生命终端：由透明档案盒构成的三维阵列](docs/media/archive.jpg)

这是对《明日方舟》特别映像「莱茵生命：访问」终端界面的非官方复刻。项目参考原 PV 的 **5–40 秒**，重建开场、档案阵列和抽取特写，并扩展了检索、收藏、档案阅读与独立的 360° 模型查看器。

代码由 GPT-6 Astra 协助完成，模型通过 Blender MCP 制作。界面采用 **TypeScript + Three.js + Vite**，运行时实时渲染三维模型，开场由 DOM / SVG 与场景时间轴驱动。

[快速运行](#快速运行) · [界面与动效](#界面与动效) · [操作说明](#操作说明) · [用演示文档构建站点](#用演示文档构建站点) · [源码与 Blender 工程下载](https://pan.quark.cn/s/762d9ee9dfc3) · [参考原 PV](https://www.bilibili.com/video/BV1rr4y1b7sz/)

## 可以体验什么

- **终端开场**：从白色画面进入，依次呈现逐字输入、标志绘制、身份接入、权限扫描、欢迎转场与档案阵列展开。
- **持续循环的档案阵列**：分类和档案来自 Markdown 目录，支持不同分类数量与不等长内容。上下翻阅、左右切列均可循环，切回某列时保留上次选择。
- **连续的抽取与归位**：档案从阵列中竖直升起，镜头衔接到详情视角；获得净空后可拖动观察，返回时先转正再下降。
- **快速翻阅反馈**：编号连续滚动；快速切换时，标题闪动并收成黑色横条，停下后恢复最终标题。
- **可阅读的档案**：概述、研究记录与访问日志，支持关键词检索、分类筛选、收藏，以及导出 UTF-8 文本。
- **独立模型查看器**：360° 环绕、滚轮缩放、方向键平移、视角复位，支持六组结构拆解与一键重组。

## 界面与动效

以下画面均来自项目的实际运行录制，展示示例档案；当前运行时的标题、分类与正文由数据目录决定。静态图可点击查看大图；动图经过降帧与压缩，便于在 README 中浏览。

### 阅读与检索

| 档案详情 · 研究记录与收藏 | 档案索引 · 编号检索与分类筛选 |
| --- | --- |
| [![档案详情：左侧为透明档案盒，右侧为研究记录与收藏操作](docs/media/detail.jpg)](docs/media/detail.jpg) | [![档案检索：输入 X-001，找到莱茵生命机构档案](docs/media/search.jpg)](docs/media/search.jpg) |

### 360° 模型查看与拆解

透明盖板、折射环组、光学核心、信息基板等部件按层展开。拆解后仍可旋转观察，重组完成后可返回原来的档案。

[![独立模型查看器：六组档案盒结构拆解展示](docs/media/assembly.jpg)](docs/media/assembly.jpg)

<details>
<summary><strong>查看动图：循环切列与翻阅</strong></summary>

![操作动图：档案阵列连续移动，编号与选择状态同步更新](docs/media/browse.gif)

</details>

<details>
<summary><strong>查看动图：模型拆解、旋转与重组</strong></summary>

![操作动图：档案盒从完整状态拆开，旋转观察后连续重组](docs/media/assembly-motion.gif)

</details>

## 快速运行

需要 **Node.js 22.12 或更高版本**（可使用 Node.js 24），以及支持 WebGL 2 的现代桌面浏览器。首次安装依赖需要网络；应用不需要 API Key，也不需要启动后端服务。

### 获取项目

```sh
git clone https://github.com/LBEILC/RhineLabUI.git
cd RhineLabUI
```

也可以从 GitHub 的 **Code → Download ZIP** 下载当前源码，或获取[夸克项目包](https://pan.quark.cn/s/762d9ee9dfc3)。夸克包是 **2026-09-08 的打包快照**，包含源码、运行模型与 Blender 源工程；后续更新以本仓库为准。

### 安装并启动

```sh
npm ci
npm run dev
```

打开终端显示的地址，通常为 `http://127.0.0.1:5173/`。如果端口被占用，以终端实际输出为准。

Windows 用户安装 Node.js 并解压项目后，也可以双击 [`启动终端.cmd`](启动终端.cmd)：首次运行会安装依赖，然后启动本地服务并打开浏览器。

### 构建与预览

```sh
npm run build
npm run preview
```

生产文件输出到 `dist/`，可以交给静态 HTTP 服务托管。请通过服务地址访问，不要直接双击 `dist/index.html`。

## 用演示文档构建站点

站点数据作为独立构建输入，与三维渲染配置分开维护。

UI 代码与站点数据分开维护：本仓库负责界面、模型、字体、阅读器和构建工具；数据目录只需要 Markdown、图片与可选的 `site.json`。新增文章、移动目录或修改站点信息不需要改 UI 代码。

### 直接运行演示文档

默认输入为 [`examples/rhine-lab/`](examples/rhine-lab/)，包含五类、四十份示例档案。`archives/` 提供 UTF-8 文本下载；对应 Markdown 页面包含正文、相关人物与设定参考。上面的 `npm run dev`、`npm run build` 即可使用它：

```sh
RHINELAB_CONTENT_DIR=examples/rhine-lab npm run build
npm run preview
```

[`examples/minimal/`](examples/minimal/) 保留为包含三篇文档的入门模板；可用 `RHINELAB_CONTENT_DIR=examples/minimal npm run build` 构建。下文从这个精简模板创建新站点。

打开预览地址查看三维档案；`/?view=list` 为阅读目录，适合移动端与不支持 WebGL 的环境。构建输出在 `dist/`，中间文件在本仓库的 `.generated/`，不会改写输入文档。

### 从演示文档建立独立数据目录

在 RhineLabUI 仓库中执行（目标 `../site-content` 应尚不存在）：

```sh
cp -R examples/minimal ../site-content
RHINELAB_CONTENT_DIR=../site-content npm run dev
```

PowerShell 对应命令：

```powershell
Copy-Item -Recurse examples/minimal ../site-content
$env:RHINELAB_CONTENT_DIR = '../site-content'
npm run dev
```

随后只需修改 `../site-content` 中的数据。例如在 `notes/` 下增加 `first-note.md`：

```markdown
---
title: 第一篇笔记
date: 2026-09-09
tags: [demo]
---

# 第一篇笔记

这是一篇演示文档。支持 **Markdown**、[同目录链接](welcome.md) 和公式 $E=mc^2$。
```

目录会自动形成分类与索引。Front matter 可省略；支持 `title`、`order`、`date`、`description`、`category`、`tags`、`permalink`、`draft` 和 `published`。图片可以放在文章旁或 `static/` 中；相对 Markdown 链接会解析到实际页面，设置 `permalink` 可让移动后的文章保持固定地址。

可在文章 front matter 中设置 `order: 1` 调整显示顺序：数值越小越靠前；未设置的文章随后按日期降序、标题升序排列，无需维护标题列表。

复制后的 `site.json` 控制标题、作者、品牌、网址和首页介绍。完整字段与构建约定见 [站点数据说明](docs/SITE-CONTENT.md)。正式构建和预览：

```sh
npm run check
RHINELAB_CONTENT_DIR=../site-content npm run build
npm run preview
```

PowerShell 保持上面设置的环境变量，然后运行同样的 npm 命令。相对数据路径以执行命令时的工作目录为基准。数据目录可以独立初始化为 Git 仓库；部署时检出数据与固定版本的 UI，在 UI 目录构建并发布其 `dist/` 即可。

## 操作说明

### 终端与档案

| 操作 | 效果 |
| --- | --- |
| 开场中按 `Enter` / `Esc`，或点击 `ENTER SYSTEM` | 资源就绪后进入交互阵列 |
| `←` / `→` | 切换档案类别，首尾循环 |
| `↑` / `↓` | 翻阅同类档案，首尾循环 |
| `Enter`、`ACCESS FILE` 或文件编号 | 读取当前档案 |
| 在详情模型上拖动 | 档案获得净空后，旋转观察 |
| `/` 或 `ARCHIVE INDEX` | 打开检索，可搜索编号、标题、英文名、科室、负责人和分类 |
| `SAVE ARCHIVE` / `SAVED` | 收藏当前档案 / 查看收藏 |
| `EXPORT` | 下载当前档案的文本文件 |
| `Esc` | 关闭当前弹窗，或从详情返回阵列 |

### 独立模型查看器

在详情页点击 **「360° 查看文档模型」** 进入。

| 操作 | 效果 |
| --- | --- |
| 鼠标拖动 | 环绕旋转模型 |
| 滚轮 | 缩放 |
| 方向键 | 平移观察位置 |
| 「复位视角」 | 恢复初始观察位置 |
| 「拆解档案」 / 「一键重组」 | 展开六组部件 / 连续收回 |
| `Esc` 或「返回档案」 | 关闭查看器，返回原档案 |

### 显示与偏好

布局以 **1920 × 1080** 为基准等比例适应窗口，主要面向桌面与横向屏幕。设置页提供界面音效、减少动态效果、画质、全屏及重新播放开场等选项。收藏和偏好保存在当前浏览器中。

首次载入需要下载字体与 GLB 模型。项目保留了四份官方 MiSans WOFF2，合计约 19.7 MB，按实际使用加载。若三维交互不够流畅，可在设置中关闭高质量渲染；需要简化镜头运动时，可启用减少动态效果。

## 工程结构

| 目录或文件 | 内容 |
| --- | --- |
| [`src/main.ts`](src/main.ts) | 页面状态、档案阅读、检索、收藏与快捷键 |
| [`src/boot.ts`](src/boot.ts)、[`src/boot-motion.ts`](src/boot-motion.ts) | 开场界面与逐帧时间轴 |
| [`src/scene.ts`](src/scene.ts)、[`src/archive-loop.ts`](src/archive-loop.ts) | Three.js 场景、循环阵列、抽取与归位 |
| [`src/model-viewer.ts`](src/model-viewer.ts) | 独立模型查看器与拆解动画 |
| [`src/data.ts`](src/data.ts) | 读取生成的档案数据，提供分类与导航接口 |
| [`public/assets/`](public/assets/) | 运行所需的 GLB 模型 |
| [`examples/rhine-lab/`](examples/rhine-lab/) | 默认示例站点：四十份档案、Markdown 页面与文本下载 |
| [`examples/minimal/`](examples/minimal/) | 三篇文档的精简站点模板 |
| `.generated/` | 自动生成的档案数据、阅读页面与目录；不写入内容仓库 |
| [`art/`](art/) | Blender 源文件、建模与审阅脚本 |
| [`scripts/`](scripts/) | Markdown 构建与自动化检查 |
| [`reference/`](reference/)、[`verification/`](verification/) | 开发对照工具与分阶段验证记录 |
| [`docs/media/`](docs/media/) | README 截图与动图 |
| [`DESIGN.md`](DESIGN.md) | 视觉、相机、材质与运动约束 |

原片时间轴使用 160 个阵列位置；交互模式使用 288 个位置（9 × 32）的可见窗口与外围卡片补位，让有限的档案内容可以持续循环。分类数量与每类档案数来自数据，不改变原有几何、折射配置、相机或动效。

### 修改与复核

修改档案内容只需管理数据目录中的 Markdown、图片与 `site.json`，不需要编辑 `src/data.ts`。`npm run dev` 与 `npm run build` 会自动发现内容并生成页面；开发模式也会监听内容增删、移动与设置变化。

```sh
node scripts/check-motion.mjs
npm run check
node scripts/check-appearance.mjs
node scripts/check-assembly.mjs
```

这些脚本检查运动、循环位置、外观配置与装配结构。视觉效果仍需在浏览器中实际查看，尤其是快速切换、模型归位及查看器进出过渡。

| 本地调试路径 | 用途 |
| --- | --- |
| `/?scene=archive` | 直接进入档案阵列 |
| `/?scene=detail` | 直接进入档案详情 |
| `/?time=28&freeze=1` | 固定在参考时间轴的指定时刻 |
| `/reference/review.html`、`/reference/boot-review.html` | 原片与复刻对照工具 |

原 PV 不随仓库分发。使用视频对照工具时，需要自行准备对应参考视频；正常运行应用不依赖它。

### Blender 源工程

| 文件 | 用途 |
| --- | --- |
| [`art/rhine-archive.blend`](art/rhine-archive.blend) | 档案盒基础模型与审阅灯光 |
| [`art/archive-assembly.blend`](art/archive-assembly.blend) | 可按六组结构拆解的模型 |
| [`art/build_archive.py`](art/build_archive.py) | 生成基础模型与 GLB |
| [`art/build_assembly.py`](art/build_assembly.py) | 生成拆解模型与 GLB |
| [`art/setup_studio.py`](art/setup_studio.py) | 配置资产审阅灯光与相机 |

普通运行直接使用现有 GLB 即可，无需安装 Blender。重新建模时，可在 Blender 的脚本环境中通过 `runpy.run_path()` 执行对应脚本，或通过 Blender MCP 调用。脚本根据自身位置确定项目目录，重新生成会更新对应模型输出。

## 参考与资源说明

参考作品为《明日方舟》特别映像「莱茵生命：访问」：[BV1rr4y1b7sz](https://www.bilibili.com/video/BV1rr4y1b7sz/)。本项目与官方制作方无隶属关系，原 PV、相关名称、标志与设定的权利归各自权利人所有。原片未展示的档案摘要、日期、研究记录等属于本项目的扩展演示内容。

模型为重新制作；实时折射、景深、灯光与局部细节和原 PV 仍有差异。身份验证画面是演示状态机，不连接真实身份或业务服务。

- **MiSans**：使用小米官方字体文件，保留[字体许可](public/fonts/MiSans-license.pdf)及字体目录内的版权说明，设置页也提供署名与许可入口。
- **Rolling Number**：用于编号滚动，许可见 [`public/licenses/rolling-number.txt`](public/licenses/rolling-number.txt)。
- **其他依赖**：各自遵循其原有许可。源码公开不改变第三方资源的权利。

源码包包含运行代码、模型、Blender 工程、说明与验证脚本，不包含依赖目录、本机缓存、原 PV 或完整录制素材。

## 开源许可

本项目自行编写且有权授权的程序代码、建模脚本及配套技术文档采用 [MIT License](LICENSE)，版权署名为 **Copyright (c) 2026 LBEILC**。你可以使用、修改、分发这些内容，也可以将其用于商业或闭源项目；分发代码或其重要部分时，须保留版权声明和许可证。软件按原样提供，不作担保，具体以许可证全文为准。

MIT 授权不覆盖第三方权利或自动覆盖仓库内全部素材：

- 《明日方舟》及莱茵生命相关名称、标志、设定、原 PV 和原作视觉设计，以及它们在模型、界面、截图或演示文本中的呈现，不因本项目公开而获得额外授权。本项目无法代替相应权利人授予这些权利。
- Blender / GLB 模型、图像、动图等非代码资产未另行声明为 MIT；建模脚本采用 MIT 不表示脚本生成的原作相关视觉内容也已获授权。
- MiSans、Rolling Number 及其他第三方依赖继续遵循各自的许可证和版权声明，见上方「参考与资源说明」。

复用代码时，请根据用途处理涉及的第三方素材与标志。GitHub 当前源码包已包含本许可证；上方夸克链接为早期打包快照，未包含本次新增的项目许可证文件，最新许可说明以本仓库为准。
