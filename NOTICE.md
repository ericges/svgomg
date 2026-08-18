# Third-party notices

OMSVG is licensed under the terms in [LICENSE.md](./LICENSE.md). This file carries
the notices of the software it is derived from, of contributions from other
people, and of the third-party code it ships to the browser.

---

## SVGOMG (upstream)

OMSVG is a fork of [SVGOMG](https://github.com/jakearchibald/svgomg) by Jake
Archibald. Every commit up to and including `f925656` was published under the MIT
License, and those portions remain available under it.

```
The MIT License (MIT)

Copyright (c) 2014-2025 Jake Archibald and SVGOMG contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Contributions to this fork

Contributions to OMSVG from anyone other than the copyright holder are licensed
under the MIT License, the text of which is reproduced above, and remain
available under it. OMSVG distributes them under the terms in
[LICENSE.md](./LICENSE.md), which is what that licence permits.

No such contributions have been merged yet. When one is, its copyright line
belongs here.

---

## Bundled software

The built app bundles the packages below into `js/page.js` and
`js/svgo-worker.js`. The list is the full runtime dependency closure and is
deliberately over-inclusive: tree-shaking removes parts of it (`commander` and
`picocolors` reach the browser only through SVGO's CLI paths, which the browser
build drops), and it is cheaper to name everything the closure contains than to
prove what the bundler took out. So OMSVG bundles or may bundle:

| Package | Licence |
| --- | --- |
| [svgo](https://github.com/svg/svgo) | MIT |
| [csso](https://github.com/css/csso) | MIT |
| [css-tree](https://github.com/csstree/csstree) | MIT |
| [mdn-data](https://github.com/mdn/data) | CC0-1.0 |
| [source-map-js](https://github.com/7rulnik/source-map-js) | BSD-3-Clause |
| [sax](https://github.com/isaacs/sax-js) | BlueOak-1.0.0 |
| [css-select](https://github.com/fb55/css-select) | BSD-2-Clause |
| [css-what](https://github.com/fb55/css-what) | BSD-2-Clause |
| [domelementtype](https://github.com/fb55/domelementtype) | BSD-2-Clause |
| [domhandler](https://github.com/fb55/domhandler) | BSD-2-Clause |
| [domutils](https://github.com/fb55/domutils) | BSD-2-Clause |
| [entities](https://github.com/fb55/entities) | BSD-2-Clause |
| [nth-check](https://github.com/fb55/nth-check) | BSD-2-Clause |
| [boolbase](https://github.com/fb55/boolbase) | ISC |
| [dom-serializer](https://github.com/cheeriojs/dom-serializer) | MIT |
| [commander](https://github.com/tj/commander.js) | MIT |
| [picocolors](https://github.com/alexeyraspopov/picocolors) | ISC |
| [pako](https://github.com/nodeca/pako) | MIT AND Zlib |
| [prismjs](https://github.com/PrismJS/prism) | MIT |
| [nanoevents](https://github.com/ai/nanoevents) | MIT |

### MIT

Applies to `svgo` (Copyright (c) Kir Belevich), `csso` (Copyright (C) 2015-2021
by Roman Dvornov, Copyright (C) 2011-2015 by Sergey Kryzhanovsky), `css-tree`
(Copyright (C) 2016-2026 by Roman Dvornov), `dom-serializer` (Copyright (c) 2014
The cheeriojs contributors), `commander` (Copyright (c) 2011 TJ Holowaychuk),
`pako` (Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn), `prismjs`
(Copyright (c) 2012 Lea Verou) and `nanoevents` (Copyright 2016 Andrey Sitnik).

```
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
```

`pako` is `MIT AND Zlib`: its deflate/inflate implementation is a JavaScript port
of [zlib](https://zlib.net/) by Jean-loup Gailly and Mark Adler, and carries the
zlib licence in addition to the MIT terms above.

### BSD-2-Clause

Applies to `css-select`, `css-what`, `domelementtype`, `domhandler`, `domutils`,
`entities` and `nth-check` — all Copyright (c) Felix Böhm, all rights reserved.

```
Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### BSD-3-Clause

Applies to `source-map-js`.

```
Copyright (c) 2009-2011, Mozilla Foundation and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### ISC

Applies to `boolbase` (Copyright (c) Felix Böhm) and `picocolors` (Copyright (c)
2021-2024 Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov).

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Blue Oak Model License 1.0.0

Applies to `sax`. The full text is reproduced here because the licence's own
Notices section requires it.

```
# Blue Oak Model License

Version 1.0.0

## Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

## Acceptance

In order to receive this license, you must agree to its
rules.  The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

## Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

## Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
<https://blueoakcouncil.org/license/1.0.0>.

## Excuse

If anyone notifies you in writing that you have not
complied with [Notices](#notices), you can keep your
license by taking all practical steps to comply within 30
days after the notice.  If you do not do so, your license
ends immediately.

## Patent

Each contributor licenses you to do everything with this
software that would otherwise infringe any patent claims
they can license or become able to license.

## Reliability

No contributor can revoke this license.

## No Liability

***As far as the law allows, this software comes as is,
without any warranty or condition, and no contributor
will be liable to anyone for any damages related to this
software or this license, under any kind of legal claim.***
```

### CC0-1.0

`mdn-data` is dedicated to the public domain under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). No
attribution is required; it is listed for completeness.

---

## Fonts

The app ships a subset of **JetBrains Mono**, licensed under the SIL Open Font
License 1.1. Its licence travels with the font files, at
[`fonts/JetBrainsMonoNL/OFL.txt`](./fonts/JetBrainsMonoNL/OFL.txt) in a build and
`src/fonts/JetBrainsMonoNL/OFL.txt` in the repository.
