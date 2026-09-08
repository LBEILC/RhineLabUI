# Rhine Lab 示例站点

这是 RhineLabUI 的默认示例站点，档案作为独立数据目录提供。

- archives/ 包含四十份 UTF-8 文本（包括 BOM），构建时发布至 /archives/ 路径。
- 五个分类目录包含对应 Markdown 阅读页面，保留标题、正文、元数据和设定参考。
- site.json 提供身份和首页信息；各 Markdown 的 order 指定档案顺序与 X-001 至 X-040 编号。
- 未设置 RHINELAB_CONTENT_DIR 时默认构建此目录；复制到任意数据目录也可独立构建。

在 UI 仓库中运行：

```sh
RHINELAB_CONTENT_DIR=examples/rhine-lab npm run build
npm run preview
```

档案基于公开世界观资料改写，不冒充游戏原文。每份均附有设定参考。
项目许可见仓库根目录的
LICENSE；明日方舟名称、标志、设定和其他第三方内容仍归各自权利人所有。
示例网址 example.com 仅供演示，部署前应在 site.json 中设置实际域名。
