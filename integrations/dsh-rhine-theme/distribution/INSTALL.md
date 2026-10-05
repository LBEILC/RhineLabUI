# RHINE 1.0.0 安装说明

RHINE 是 Windows DeepSeek Harness Desktop 的三维档案室主题。本版验证的宿主版本为 **0.2.0-rc.2**；其他版本尚未验证，原生窗口适配工具会拒绝其他版本。

## 安装前

- 先打开 DSH 一次，让应用建立 `desktop` profile。
- 在插件管理中停用其他接管整个界面的主题，避免同时覆盖根布局。无需删除原主题。
- 普通主题安装通过 DSH 内置插件管理器完成，不需要另装 CLI 或编译工具。
- 下一节的可选原生适配工具需要 Node.js **22.12 或更新版本**；用 `node --version` 检查。

## 1. 安装主题

下载 GitHub Release 中的 `dsh-rhine-theme-1.0.0-windows.zip`，解压到固定目录，例如 `C:\Tools\RHINE-1.0.0`。不要只打开 ZIP 里的文件，也不要把整个目录复制进 DSH 的 `resources`。

打开 DSH 的“插件”管理页，选择“添加插件”，在安装来源输入框填入 `.tgz` 的**绝对路径**，例如：

```text
C:\Tools\RHINE-1.0.0\dsh-rhine-theme-1.0.0.tgz
```

不要在输入框里加引号或填 ZIP 文件。按“安装”，完成后确认 RHINE 已启用。该 `.tgz` 已包含编译好的客户端、三维模型、字体和音频，无需 `npm run build`，也无需授权运行构建脚本。首次解析插件依赖需要网络。

内置插件管理器会使用当前 Desktop profile，默认位于 `$HOME\.dsh\profiles\desktop`。不要覆盖自己的 profile `package.json` 或复制作者的配置。

仅下载 `.tgz` 的用户也可按同样方式安装；ZIP 额外附有下一节的原生工具。建议保留下载的 `.tgz` 于固定位置，供本地依赖重新安装或更新使用。

安装完成后，从 DSH 菜单或系统托盘选择“退出”。只关闭窗口可能仍留在后台。

## 2. 安装完整的 Windows 窗口适配

完整效果包括窗口按钮、F11 全屏切换、标题栏配色、退出全屏居中及最小窗口尺寸约束。它需要修改 **DSH 应用文件**，不属于普通插件安装。DSH 升级后可能需要重新适配；只想安装主题插件时可以跳过，但不要期待完整的原生窗口行为。

保持 DSH 完全退出，将下面的路径改成你实际的 EXE 路径：

```powershell
node ./native/rhine-native.cjs install "C:\Path\To\DeepSeek Harness.exe"
```

工具同时支持 `resources/app` 和标准的 `resources/app.asar` 安装布局，检查宿主版本和代码特征后才写入文件。它会：

1. 备份原有主进程和 preload 文件到 `resources/rhine-native-backup-*`。
2. 对 `app.asar` 安装先提取并验证，然后保留原文件为 `app.asar.rhine-original`，让 Electron 从解包后的 `resources/app` 加载。原 `app.asar.unpacked` 保留。
3. 安装 RHINE 的窗口适配，不修改会话、账号、模型或其他 profile 设置。

如果程序装在 `Program Files` 等受保护目录，出现拒绝访问时用管理员 PowerShell 重试。若检测到 DSH 仍在运行，先正常退出再重试；工具不会强制结束应用。若同时存在 `app` 与 `app.asar`，它会拒绝猜测实际加载位置。

可先运行 `check` 代替 `install` 检查兼容性。ASAR 检查会留下未激活的 `.rhine-staging-*` 检查副本，并打印路径。

## 3. 重启与设置

启动 DSH，确认出现 RHINE 档案首页。第一次开场可按 Esc 跳过。右上角主题设置可调整：

- 浅色/深色、三维场景、动态效果与画质。
- 最高帧率：默认 60，可选 90 或自定义。它是上限，不是帧率保证。
- 开场动画与可选环境声；环境声默认关闭。

更新后必须完整退出并重启 DSH，以清除旧客户端模块缓存。正常使用不需要打开调试端口。

## 更新

下载新版 `.tgz`，在 DSH 插件管理中按宿主的更新流程操作；这版若没有更新按钮，先卸载旧 RHINE 插件，再从新版绝对路径安装。不要删除整个 profile。若发布说明要求更新原生适配，退出 DSH 后运行新 ZIP 中的原生工具。主题偏好由 DSH 管理；重要设置可在操作前记下。

## 卸载与恢复

先在 DSH 插件管理中停用并卸载 `dsh-rhine-theme`，再完全退出 DSH。如果安装了原生适配，执行：

```powershell
node ./native/rhine-native.cjs uninstall "C:\Path\To\DeepSeek Harness.exe"
```

只安装过主题时，不需要运行原生卸载工具。重启后可重新启用原主题。

原生卸载只撤掉 RHINE 注入并恢复标题栏取色代码，保留其他本地补丁、备份和解包后的应用目录；不自动删除或覆盖整个 DSH 安装。若需要恢复发行版原有文件布局，优先重装相同版本 DSH 应用，不要删除 `.dsh` 用户数据目录。

## 常见问题

- **CLI 提示 desktop 由 Electron 独占管理**：使用上述内置插件管理器。这版部分 CLI 构建拒绝 `dsh plugin --profile desktop`，不能据当前源码文档假定所有已安装构建都支持它。
- **安装后仍是旧主题**：检查实际 profile，停用其他全界面主题，完整退出托盘进程后再启动。
- **窗口按钮或 F11 不生效**：检查原生工具是否成功执行，以及 EXE 是否对应正在启动的那份 DSH。
- **版本不支持或代码特征不匹配**：不要跳过检查强行注入；本包只验证 0.2.0-rc.2。
- **出现旧模块 404**：退出并重启；仅刷新界面可能仍请求旧哈希地址。
- **性能设置**：先使用高精度和适合显示器的帧率上限，再按实际流畅度调整。

## 校验与许可

可用 `Get-FileHash 文件名 -Algorithm SHA256` 对照 Release 的 `SHA256SUMS.txt`。不要混用不同版本的 `.tgz` 与原生工具。

主题代码及上游参考代码采用 MIT 许可；MiSans 使用单独许可，本文档与包内 `THIRD_PARTY_NOTICES.md`、`licenses/` 一并保留。此项目为非官方同人主题，与原 IP 所有者无隶属关系。
