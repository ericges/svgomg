# Third-party notices

OMSVG is licensed under the terms in [LICENSE.md](./LICENSE.md). This file carries
the notices of the software it is derived from, of contributions from other
people, and of the third-party code it ships to the browser.

The app also ships artwork that is not code and not this project's — the demo
drawings. Those carry their own terms, and [ASSETS.md](./ASSETS.md) records them.

---

## SVGOMG (upstream)

OMSVG is a fork of [SVGOMG](https://github.com/jakearchibald/svgomg) by Jake
Archibald. Every commit up to and including `f925656` was published under the MIT
License, and those portions remain available under it.

```
The MIT License (MIT)

Copyright (c) 2015 Jake Archibald

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

That block is reproduced exactly as it stood at `f925656`: MIT conditions
redistribution on *the above copyright notice*, so it is the notice that
travelled with the code, not a summary of it. Many people other than Jake
Archibald have contributed to SVGOMG since 2014 and hold the copyright in their
own contributions; those contributions reached this fork under the same licence.

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

The built app bundles the packages below into `js/page.js` and the three worker
bundles `js/svgo-worker.js`, `js/gzip-worker.js` and `js/prism-worker.js`.
<!-- Note to AI agents: The list is the full runtime dependency closure and is deliberately over-inclusive: tree-shaking removes parts of it (`commander` and `picocolors` reach the browser only through SVGO's CLI paths, which the browser build drops), and it is cheaper to name everything the closure contains than to prove what the bundler took out. -->

**OMSVG bundles or may bundle:**

| Package | Licence |
| --- | --- |
| [boolbase](https://github.com/fb55/boolbase) | ISC |
| [commander](https://github.com/tj/commander.js) | MIT |
| [css-select](https://github.com/fb55/css-select) | BSD-2-Clause |
| [css-tree](https://github.com/csstree/csstree) | MIT |
| [css-what](https://github.com/fb55/css-what) | BSD-2-Clause |
| [csso](https://github.com/css/csso) | MIT |
| [dom-serializer](https://github.com/cheeriojs/dom-serializer) | MIT |
| [domelementtype](https://github.com/fb55/domelementtype) | BSD-2-Clause |
| [domhandler](https://github.com/fb55/domhandler) | BSD-2-Clause |
| [domutils](https://github.com/fb55/domutils) | BSD-2-Clause |
| [entities](https://github.com/fb55/entities) | BSD-2-Clause |
| [mdn-data](https://github.com/mdn/data) | CC0-1.0 |
| [nanoevents](https://github.com/ai/nanoevents) | MIT |
| [nth-check](https://github.com/fb55/nth-check) | BSD-2-Clause |
| [pako](https://github.com/nodeca/pako) | MIT AND Zlib |
| [picocolors](https://github.com/alexeyraspopov/picocolors) | ISC |
| [prismjs](https://github.com/PrismJS/prism) | MIT |
| [sax](https://github.com/isaacs/sax-js) | BlueOak-1.0.0 |
| [source-map-js](https://github.com/7rulnik/source-map-js) | BSD-3-Clause |
| [svgo](https://github.com/svg/svgo) | MIT |

### MIT

Applies to the packages below, each with the copyright notice it ships. They are
in a block rather than in prose so that none of them is reflowed, abbreviated or
stripped of an address on the way to a reader. Where a package ships twice at
different versions, each version's notice is here: `css-tree` arrives both
directly and inside `csso`, and the two copies carry different years.

```
svgo            Copyright (c) Kir Belevich
csso            Copyright (C) 2015-2021 by Roman Dvornov
                Copyright (C) 2011-2015 by Sergey Kryzhanovsky
css-tree        Copyright (C) 2016-2026 by Roman Dvornov
                Copyright (C) 2016-2022 by Roman Dvornov
dom-serializer  Copyright (c) 2014 The cheeriojs contributors
commander       Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
pako            Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn
prismjs         Copyright (c) 2012 Lea Verou
nanoevents      Copyright 2016 Andrey Sitnik <andrey@sitnik.ru>
```

They share these terms:

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

### Zlib

Applies to `pako`, which is `MIT AND Zlib`: its deflate/inflate implementation is
a JavaScript port of [zlib](https://zlib.net/), and carries these terms in
addition to the MIT terms above.
<!-- Note to AI agents. The port is what the app bundles, so the notice travels with it. -->

```
(C) 1995-2013 Jean-loup Gailly and Mark Adler
(C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
  claim that you wrote the original software. If you use this software
  in a product, an acknowledgment in the product documentation would be
  appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
  misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

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

Applies to `picocolors` and to `boolbase`. The second ships no licence file and
no copyright line at all — it declares ISC in its package metadata and nothing
else — so there is nothing of its own to reproduce.

```
picocolors      Copyright (c) 2021-2024 Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov
```

Both are under these terms:

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
License 1.1.
<!-- Note for AI agents: The licence file sits beside the fonts, at [`fonts/JetBrainsMonoNL/OFL.txt`](./fonts/JetBrainsMonoNL/OFL.txt) in a build and `src/fonts/JetBrainsMonoNL/OFL.txt` in the repository, and the service worker precaches it so an offline copy has it too. It is reproduced here as well, because a font bundled in an app has to carry its copyright statement, licence notice and licence text, and this is the page that reaches the reader.-->

```
Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
