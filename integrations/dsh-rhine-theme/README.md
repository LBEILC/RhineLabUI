# RHINE Observatory · DSH 主题

将 RhineLabUI 的三维档案阵列、玻璃材质和开场动画适配到 **DeepSeek Harness Desktop 0.2.0-rc.2（Windows）**，连接真实项目、会话、编辑器和设置。此目录是独立主题包，使用自己的依赖与构建流程。

原始视觉、场景、模型、动效与原创环境声来自 [LBEILC / RhineLabUI](https://github.com/LBEILC/RhineLabUI)。DSH 适配、性能优化和发布工具由贡献者与 **OpenAI Codex** 协作完成。第三方资源与上游版权保留于 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 功能

- 项目档案阵列、会话工作区、浅深色主题、中文与英文界面。
- 连续专注展开/收起、体素边缘跟随、可旋转和拆解的光学组件。
- 二维与三维开场、跳过与启动开关、可选环境声、减少动态效果支持。
- 通过宿主插槽接入会话、草稿和附件；主题设置由 DSH 保存。
- Windows 可选原生窗口适配，包含版本检查、原文件备份和卸载工具。

## 安装与试用

已构建的主题使用 `.tgz` 安装：在 DSH 的 **插件 → 添加插件** 中输入文件的绝对路径，安装、启用后完整退出并重启 DSH。内置插件管理器管理当前 Desktop profile；此版本的一些 CLI 会拒绝管理 `desktop`，请使用应用内入口。

完整步骤、原生适配和卸载方式见 [INSTALL.md](distribution/INSTALL.md)。PR 阶段可以从本分支构建；CI 运行成功且产物尚未过期时，也可下载 **DSH theme / windows-release** 工作流产物。GitHub 下载的产物外层 ZIP 解压后，使用其中的 `dsh-rhine-theme-1.0.0-windows.zip` 或 `.tgz`。

其他 Desktop 版本以及 macOS/Linux 未验证。普通主题安装不需要 Node.js；本地构建和可选原生适配需要 **Node.js 22.12+**。原生工具只支持 0.2.0-rc.2，安装前须正常退出 DSH。

## 从源码构建

在本目录运行，而不是仓库根目录：

```sh
cd integrations/dsh-rhine-theme
npm ci
npm test
npm run build
```

产物位于 `lib/`。模型、字体与音频嵌入客户端，运行时无需从演示网站加载资源；模型构建使用 Meshopt 无损压缩并逐字节验证还原结果。构建不需要 DSH 源码，也不需要 Blender。

在 Windows 上生成可安装发布包：

```powershell
npm run release
node scripts/verify-release.mjs releases/1.0.0/dsh-rhine-theme-1.0.0-windows.zip
```

`releases/1.0.0/` 包含 Windows ZIP、预构建 TGZ、安装说明、版本说明和 SHA-256 校验文件。发布脚本会构建主题，并在临时目录生成仅含运行文件的包清单；运行包没有构建脚本或开发依赖。生成的 ZIP 内有 `CONTENTS.sha256`，验证脚本检查每个文件，并在临时模拟安装目录验证原生安装/更新/卸载与不兼容版本拒绝。仅运行验证脚本不会更改已安装的 DSH。

此版本 ZIP 打包依赖 Windows PowerShell 的 `Compress-Archive`。普通源码构建使用 Node.js；未声称在其他平台运行过桌面主题。维护者可将上述文件上传到 GitHub Release；CI 只上传构建产物，不自动发布 Release。

## 与真实宿主检查

严格类型检查使用**匹配版本且已构建的 DSH 源码**中的声明文件。部分客户端类型仍引用宿主内部类型包，因此不以手写桩声明绕过检查：

```powershell
$env:DSH_SOURCE_ROOT = 'C:\src\DSH'
npm run typecheck
node scripts/verify-release.mjs releases/1.0.0/dsh-rhine-theme-1.0.0-windows.zip
```

设置 `DSH_SOURCE_ROOT` 后，发布验证额外通过真实 Desktop 插件管理器后端在临时 profile 安装、激活和卸载 TGZ。默认读取源码树内 `desktop/resources/runtime/pnpm/bin/pnpm.cjs`；不同布局可设置 `DSH_PNPM_CLI`。没有该环境变量时，脚本明确报告未运行宿主集成检查。CI 仅覆盖可独立运行的检查。

可选的实机专注动画检查：安装本次构建，正常退出 DSH，以 `--remote-debugging-port=9224 --remote-debugging-address=127.0.0.1` 启动，在主题中打开一个测试会话，再运行：

```sh
node scripts/verify-focus-desktop.mjs
```

可通过 `DSH_CDP_URL` 指定本机调试地址。脚本操作当前会话的专注按钮、Esc 和模拟减少动态效果，验证编辑器/草稿保持、动画中断、体素跟随和静止休眠，不发送消息。输出写入被 Git 忽略的 `verification/`。该检查会改变当前专注状态，适合专门的验收会话；它依赖 0.2.0-rc.2 的 DOM 和内部场景引用。

## 性能与验证范围

保留材质、几何和动效的优化包括：FLIP 专注动画、局部状态样式、静止休眠、波形缓存、保守的可见绘制裁剪与独立阴影覆盖、帧内悬停拾取合并、移除不使用的 AO 中间深度附件，以及无损模型压缩。

此前在 Ryzen 5 7600X / RX 7900 XT 上完成交互与性能验证：专注展开/收起各一次聊天布局；悬停密集事件测试中，12 个帧批次的拾取从 193 次降至 12 次；移除 AO 冗余深度附件的六组固定输入 RGBA 比较均无差异。上述证据针对具体测试，不代表所有画面、所有设备或整个程序同等提速。详情见 [验证记录](VALIDATION.md)。

**GTX 1060 / Ryzen 5 3600X / 1440p / 90 FPS 仍是待实测目标，不是性能保证。**

## 维护入口

| 目录或文件 | 用途 |
| --- | --- |
| `src/index.ts`、`src/preferences.ts` | 插件与持久化设置 |
| `src/client/index.tsx` | DSH 插槽、业务服务与主题注册 |
| `src/client/ArchiveFrame.tsx`、`archive.css` | 工作区和专注模式 |
| `src/client/rhine/` | 适配后的上游场景、材质、动效；`UPSTREAM.json` 记录来源 |
| `assets/` | 应用所用模型、MiSans 与原创环境声 |
| `desktop/` | Windows 原生窗口策略与 preload |
| `scripts/` | 构建、无损模型压缩、类型检查、发布与验收 |
| `tests/` | 行为和资源回归测试 |
| `distribution/` | 随发布包提供的安装说明与版本说明 |

上游场景在此保留独立适配副本；以后同步时需要保留 DSH 数据/视口接口、生命周期处理和性能改动。本目录不包含开发者 profile、会话、凭据或本机备份。MiSans 仅作为主题应用资源使用，须随软件保留字体协议；Novecento 字体文件未包含。主题代码采用 [MIT](LICENSE)，第三方资源遵循各自许可。
