# 站点数据说明

RhineLabUI 使用同一套 UI 和构建流程处理演示文档与独立站点。
快速上手见 [README：用演示文档构建站点](../README.md#用演示文档构建站点)。

## 输入与输出

- `RHINELAB_CONTENT_DIR` 指定内容目录；相对路径以命令工作目录为基准。
- 未设置时使用 `examples/rhine-lab/`，包含四十份示例档案与文本下载；`examples/minimal/` 是精简入门模板。工程文档不会作为文章发布。
- 输入目录包含 Markdown、内容图片和可选的 `site.json`、`CNAME`、`favicon.ico`。
- 构建中间文件只写入 UI 仓库的 `.generated/`，发布文件只写入其 `dist/`。
  不会向输入目录写入源码、生成注册表或构建产物。
- 开发模式监听内容、目录和设置变化，自动重新生成页面并刷新浏览器。

## 站点设置

`site.json` 可以省略；未指定的字段使用通用示例值。典型配置：

```json
{
  "title": "My archive",
  "brand": "ARCHIVE",
  "author": "Author",
  "lang": "zh-CN",
  "sessionName": "JOYCE MOORE",
  "sessionStatus": "SESSION AUTHORIZED",
  "welcomeName": "RHINE LAB.LLC.",
  "welcomeMessage": "欢迎访问莱茵生命内部资料档案",
  "label": "PERSONAL / LOG",
  "url": "https://example.com",
  "githubUrl": "https://github.com/example",
  "favicon": "/favicon.svg",
  "description": "Notes and projects.",
  "intro": "Welcome to my archive.",
  "headline": "A record of\nthings",
  "headlineEmphasis": "learned.",
  "projectLinkPrefixes": [],
  "projectTitleAliases": {}
}
```

`url` 必须是 HTTP(S) 源地址，不带子路径、查询或片段；当前部署支持域名根目录，
不支持 `/project/` 形式的站点基路径。发布前应替换演示网址，以生成正确的 canonical
链接和站点地图。默认图标是 UI 提供的 `/favicon.svg`；使用内容目录的
`favicon.ico` 时，把 `favicon` 设置为 `/favicon.ico`。

`projectLinkPrefixes` 用于从顶层 Markdown 中发现匹配前缀的项目链接；
`projectTitleAliases` 将链接标签映射为展示标题。
这些设置都属于站点数据，不需要修改 UI。

界面采用既定的中英混排、按钮与标签用语，不因数据分离自动翻译或改写。
`lang` 默认为 `zh-CN`，用于首页、阅读页与错误页的 HTML 语言标记，
不是自动翻译开关。可按内容设置为 `en` 等有效语言标签。
`sessionName` 同时用于页脚、设置、访问日志、启动身份文本与中文字幕；
`sessionStatus` 用于页脚和设置。`welcomeName` 控制欢迎画面的公司名称，
`welcomeMessage` 控制其字幕。未设置时使用上述默认值；这些是演示显示文字，
不代表真实身份验证。`title`、`brand`、`label` 分别控制网页标题、主品牌和模型标签。

## Markdown 与目录

递归发现 Markdown，文件夹自动形成集合和目录页面。Front matter 可省略；支持
`title`、`order`、`date`、`description`、`category`、`tags`、`permalink`、`draft` 和
`published`。分类与各分类文章数量不必相同，也不受三维场景位置池大小限制。

### 显示顺序

在 Markdown 的 front matter 中添加可选的 `order`，无需在 `site.json` 重复标题：

```yaml
---
title: 第一篇笔记
order: 1
date: 2026-09-09
---
```

`order` 必须是有限数值，数值越小越靠前；支持 `0`、负数与小数。未设置的文档排在
所有设置了 `order` 的文档之后。数值相同或均未设置时，按日期降序、标题升序排序，
未注明日期的文档排在有日期的文档之后；日期与标题均相同则按 URL 排序。
档案阵列、目录页和列表使用同一规则；分类名称仍按字母顺序排列。
修改标题不会丢失 `order`。档案编号按最终顺序生成；固定页面地址请使用 `permalink`。
目录的 `index.md` 也可以设置 `order`，控制该目录在导航中的顺序，不会传递给子文档。
从顶层 Markdown 提取的外部项目链接不继承该页面的 `order`。

### 档案元数据

要保留档案详情的原有信息，可以在 front matter 中设置 `en`（英文标题）、
`department`（科室）、`lead`（相关人物）、`clearance`（访问范围）、
`findings`（研究记录字符串数组）和 `reference`（HTTP(S) 设定参考链接）。
不设置时仍按普通 Markdown 文章生成默认信息；正文的发布地址独立于设定参考链接。
Rhine Lab 示例用这些数据字段保留原有双语标题与元数据，不在 UI 中硬编码示例内容。

Markdown 相对链接会解析到目标页面，包括自定义 permalink；相邻图片与 `static/`
资产会一同发布。公式由 KaTeX 渲染。兼容 `title_patch`、`gen_index` 和
`latex_support` include 写法，不需要 Jekyll。重复的页面 URL 会使构建失败，
避免静默覆盖文章。

## 独立部署

数据仓库只需管理文章、目录、资产、设置和薄部署工作流。自动化流程依次：

1. 检出数据仓库，并把 UI 检出到 `_engine/`，固定到已审阅的提交 SHA。
2. 设置 `RHINELAB_CONTENT_DIR` 为数据仓库绝对路径。
3. 在 `_engine/` 中运行 `npm ci`、`npm run check`、`npm run build`。
4. 将 `_engine/dist/` 发布到静态站点托管服务。

UI 检出不需要持有数据仓库凭据。内容目录中的 `_engine/` 不参与文章发现。
日常数据提交触发部署即可；升级 UI 固定版本是独立的依赖更新操作。
