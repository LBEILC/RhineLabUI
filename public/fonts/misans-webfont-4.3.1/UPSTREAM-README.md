# Misans Webfont <br> Misans 网页字体

本仓库旨在对 Misans 字体进行分包，方便字体在网页中加载。仅供学习交流使用。

[![NPM Version](https://img.shields.io/npm/v/misans-webfont)](https://www.npmjs.com/package/misans-webfont)
[![JsDelivr Hits](https://data.jsdelivr.com/v1/package/npm/misans-webfont/badge?style=rounded)](https://www.jsdelivr.com/package/npm/misans-webfont)

本仓库使用 Github Action，利用[中文网字计划](https://chinese-font.netlify.app/)开发的[字体分包工具](https://github.com/KonghaYao/cn-font-split)对原字体分包，网页加载时只需获取所使用的文字所在的分包，大幅降低所需加载的大小，提升网页加载速度。

本仓库使用 Apache License 2.0 开源许可证，欢迎 PR, Star.

## 使用
直接下面提供的代码以 `<link>` 的形式添加到网页的 `<head>` 内即可：

```html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/misans-webfont/misans-style.css" />
  <style>
    body {
      font-family: "MiSans Bold";
      font-weight: bold;
    }
  </style>
</head>
```


你也可以只引用单一的字体：

```html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/misans-webfont/misans/misans-bold/result.min.css" />
  <style>
    body {
      font-family: "MiSans Bold";
      font-weight: bold;
    }
  </style>
</head>
```

具体可以引用的字体请查看：[fonts 分支](https://github.com/mobeicanyue/misans-webfont/tree/fonts)，找到具体字体中的 `result.css`.

---

以下信息摘录自小米官网，使用字体请遵守下文的许可协议。

## MiSans 简介

![MiSans](https://github.com/mobeicanyue/misans-webfont/blob/main/misans.png?raw=true)

MiSans Global 是由小米主导，联合蒙纳字库、汉仪字库共同打造的全球语言字体定制项目。这是一个庞大的字体家族，涵盖 20 多种书写系统，支持 600 多种语言，字符数量超过 10 万个。作为 Xiaomi HyperOS 系统默认字体，我们以简约/清晰，人文/易读，统一的视觉风格为基本原则出发，构建多语言信息体验一致性，旨在帮助为 Xiaomi HyperOS 提供互联的通用体验。

## Misans 许可协议

> 本《MiSans 字体知识产权许可协议》（以下简称“协议”）是您与小米科技有限责任公司（以下简称“小米”或“许可方”）之间有关安装、使用 MiSans 字体（以下简称“MiSans”或“MiSans 字体”）的法律协议。您在使用 MiSans 的所有或任何部分前，应接受本协议中规定的所有条款和条件。安装、使用 MiSans 的行为表示您同意接受本协议所有条款的约束。否则，请不要安装或使用 MiSans，并应立即销毁和删除所有 MiSans 字体包。
>
> 根据本协议的条款和条件，许可方在此授予您一份不可转让的、非独占的、免版税的、可撤销的、全球性的版权许可，使您依照本协议约定使用 MiSans 字体，前提是符合下列条件：
> 1. 您应在软件中特别注明使用了 MiSans 字体。
> 2. 您不得对 MiSans 字体或其任何单独组件进行改编或二次开发。
> 3. 您不得单独将 MiSans 字体或其组件对外租赁、再许可、给予、出借或进一步分发字体软件或其任何副本以及重新分发或售卖。此限制不适用于您使用 MiSans 字体创作的任何其他作品。如您使用 MiSans 字体创作宣传素材、logo、应用 App 等，您有权分发或出售该作品。

## Misans FAQ

#### MiSans Global 需要付费吗？
不需要。MiSans Global 所有的字体都是供全球免费商用，您可以在任何平台、任何商业项目中使用所有字体。

#### 是否可以用作嵌入式字体？
可以。但您应在软件中特别注明使用了 MiSans 字体。

#### 我可以在软件中修改编辑、二次创作字体吗？
您可以自由调节字体的粗细、间距等。但您不得单独将 MiSans 字体或其组件进行外观上的更改。

#### 什么是可变字体？
可变字体是 OpenType 在 1.8 版规范中引入的扩展规范，简单说明就是一个字体文件同时支持多个字体形态，可以将多个字体文件合在单个字体文件中，通过定义字体内的变化来实现单轴或多轴设计空间。

#### 是否所有字体都支持可变？
MiSans L3 生僻字字库（GB18030-2022 级别 3）仅支持 Regular 字重。其他所有字体均支持可变。

#### MiSans Global 的制作分工
由小米主导，联合蒙纳、汉仪共同制作完成。
其中蒙纳负责泰语、老挝及印度的所有地区语言。
汉仪负责繁体中文、阿拉伯语、藏文、缅甸、高棉。
