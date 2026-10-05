# Third-party resources

## RhineLabUI

Source: https://github.com/LBEILC/RhineLabUI (HEAD observed: ee5779741c6c0c916e416705fa634c7abf905c73).

The optical assembly in `assets/optical-archive.glb` is the upstream runtime asset `https://rhine.lubeiluchen.cc/assets/archive-assembly.d411170676f55a32.glb`. Geometry is unchanged. The archive cassette asset in `assets/archive-cassette.glb` also comes from the reference project. This theme adapts the upstream scene, lighting, materials and motion modules, with local DSH data/UI integration and rendering optimizations. `src/client/rhine/UPSTREAM.json` records retrieved module URLs and original hashes; those hashes describe the retrieved sources, not the subsequently adapted files. The source is an unofficial fan interpretation of the Rhine Lab visual world from Arknights; this theme does not claim affiliation with the original IP owner.

Upstream license: MIT, Copyright (c) 2026 LBEILC. The complete notice is included below.

The refinement also includes the upstream `boot-tracks.ts`, `boot-orbit-tracks.ts`, `boot-logo-tracks.ts` measured motion data, and `boot-lettering-art.json` authored phrase graphics. The graphics are reused only for their actual phrases, not as a general-purpose font. Source hashes are recorded in `UPSTREAM.json`. The optical assembly is activated for focus/settings inspection without altering its geometry.

`assets/atmosphere.ogg`, `assets/motif.ogg`, and `assets/pulse.ogg` are the reference project's original programmatically composed Observatory stems, governed by its MIT license. They are used only by the optional, default-off soundscape. The reference's sampled Arknights typing clips, fictional identity phrase, unrelated PWA icons, and standalone preview recordings are not included in the interface.

## Typography

This software uses MiSans fonts, Copyright Xiaomi Inc. Chinese text and body copy embed the unchanged `MiSans-Regular.woff2` and `MiSans-Bold.woff2` reference-site assets, with system font fallbacks. MiSans is governed by its own license, not this project's MIT license. The complete upstream-supplied agreement is included in `licenses/MiSans-license.pdf`, with a text extraction in `licenses/MiSans-license.txt`. Section 2 permits distribution of works such as applications using the fonts, requires attribution and preservation of the agreement, and prohibits standalone font redistribution and modification. The release embeds the fonts in the theme application rather than shipping standalone font assets. No OS font files are distributed.

## Three.js

Three.js 0.183.x, https://github.com/mrdoob/three.js, MIT, Copyright © 2010–2026 three.js authors. It is bundled into the client with GLTFLoader and RoomEnvironment. Its original license notice is appended to this file at build delivery.

## RhineLabUI MIT license

Copyright (c) 2026 LBEILC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Three.js MIT license

The bundled meshoptimizer decoder and the build-time lossless encoder are
Copyright (C) 2016–2025 Arseny Kapoulkine and are distributed under the same MIT
permission and warranty terms reproduced below. No quantization or simplification
is applied to the original model assets.

The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


## Startup sequence integration (2026-10-04)

The startup DOM/SVG controller, phrase renderer, calibrated opening timeline, scoped styles and markup adapt RhineLabUI commit 129553bce3496f3826ef343b539ca46d25b94852, specifically src/boot.ts, src/boot-motion.ts, src/boot-lettering.ts, src/boot-lettering.css, src/style.css and the opening fragment of src/main.ts. MIT attribution above applies; original-file hashes are recorded in UPSTREAM.json. The original motion paths and phrase artwork are retained. Fictional personal authentication is not rendered; local workspace copy replaces it. Rapid large-area welcome flashes are attenuated. No upstream sampled audio or video is added.
