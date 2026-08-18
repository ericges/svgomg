# Asset notices

This is the declaration of the artwork distributed with OMSVG that came from
other people, in the source repository and in the built application alike — the
demo and test drawings, and the interface icons. Each record states the work, its
author, the source it was obtained from, the terms it is distributed under, where
those terms are reproduced, and any modification made to it here.

Nothing else the app ships needs a record here. The OMSVG logo —
`partials/icons/logo.svg`, and the app icons made from it — is Eric Gesemann's
own work, covered by [LICENSE.md](./LICENSE.md); the code the app bundles and the code font it ships
are covered by [NOTICE.md](./NOTICE.md). Neither document grants anything over
the works declared here: each is distributed under the terms stated with it, and
those terms govern it.

The two families are distributed differently, and some of the terms below turn
on it. No **drawing** declared here is incorporated into a script, a stylesheet
or any other part of the application: each is a separate file, distributed
alongside OMSVG rather than as a part of it, and fetched whole — `car-lite.svg`
when the service worker installs, so that the Demo button works offline, and
every other one when a user asks for it. The **icons** are the opposite. Each is
inlined into the application's markup, or into a script that builds markup from
it, so every copy of the application carries them whether or not their own files
travel with it. That is why the terms they are carried under are reproduced in
this document rather than pointed at: it ships with every build, is served as a
page, and is held in the offline cache.

---

## Summary

| File                            | Work                          | Rights holder                          | Terms                       |
|---------------------------------|-------------------------------|----------------------------------------|-----------------------------|
| `test-svgs/car-lite.svg`        | little red racing car         | Onsemeliot                             | CC Public Domain Dedication |
| `test-svgs/car-lite-green.svg`  | little green racing car       | Onsemeliot                             | CC Public Domain Dedication |
| `test-svgs/tiger.svg`           | Ghostscript Tiger             | the Ghostscript authors                | AGPL-3.0-or-later           |
| `test-svgs/flag.svg`            | Flag of Ecuador               | see the record below                   | Public domain, and CC0-1.0  |
| `test-svgs/svgo-logo.svg`       | SVGO project logo             | Kir Belevich and the SVGO contributors | MIT                         |
| `test-svgs/kitchen-sink.svg`    | OMSVG kitchen sink            | Eric Gesemann                          | CC0-1.0                     |
| `test-svgs/fail.svg`            | OMSVG parse-failure fixture   | Eric Gesemann                          | CC0-1.0                     |
| `partials/icons/`, 11 files     | Lucide icons                  | Lucide Icons and Contributors          | ISC                         |
| `partials/icons/info.svg`       | one of those 11, from Feather | Cole Bemis                             | MIT, in addition to the ISC |
| `partials/icons/bolt.svg`       | Tabler Icons `bolt`           | Paweł Kuna                             | MIT                         |
| `partials/icons/contribute.svg` | the GitHub logo               | GitHub, Inc.                           | see the record below        |

`src/config.json` determines which of the drawings are built and distributed
with the application. `fail.svg` is not among them; it is distributed only in the
source repository. Every icon is built into it, there being no drawing in
`src/partials/icons/` that the application does not display.

---

## test-svgs/car-lite.svg, test-svgs/car-lite-green.svg

**Work** — "little red racing car", dated 2013-05-02, and a recoloured variant
of it.

**Author** — Onsemeliot.

**Source** — the Open Clip Art Library. Obtained with upstream SVGOMG, before the
fork point.

**Terms** — the Creative Commons Public Domain Dedication, declared in each
file's own `<metadata>` element:

```
http://creativecommons.org/licenses/publicdomain/
```

**Required notices** — none. This record is provided for identification.

**Modifications** — both files are optimised. `car-lite-green.svg` is a recolour
of `car-lite.svg`; its `<metadata>` described the original until 2026-08-18, when
it was corrected to describe the recoloured work.

## test-svgs/tiger.svg

**Work** — the Ghostscript Tiger.

**Author** — the Ghostscript authors, as recorded by the source.

**Source** — Wikimedia Commons,
<https://commons.wikimedia.org/wiki/File:Ghostscript_Tiger.svg>, which records
the work as derived from `tiger.eps` in the GPL Ghostscript SVN repository and
its licence as stated in the file `COPYING` there.

**Terms** — the **GNU Affero General Public License, version 3 or any later
version** (`AGPL-3.0-or-later`), as declared by the source:

> This work is free software; you can redistribute it and/or modify it under the
> terms of the GNU Affero General Public License as published by the Free
> Software Foundation; either version 3 of the License, or any later version.

**Licence text** — reproduced in full at
[`licences/AGPL-3.0.txt`](./licences/AGPL-3.0.txt), and distributed with the
application at that path. Section 4 of that licence conditions the conveyance of
a copy on giving each recipient a copy of the licence with it; the file is
therefore also held in the application's offline cache.

**Required notices** — the work carries no copyright notice, and neither does the
copy held by the source. None is supplied here: what the source records is set
out above, and nothing is added to it.

**Modifications** — none. The copy distributed here is identical to the copy held
by the source but for a trailing newline, and is therefore conveyed as a verbatim
copy under section 4 rather than as a modified work under section 5.

## test-svgs/flag.svg

**Work** — the Flag of Ecuador.

**Author** — recorded by the source as "President of the Republic of Ecuador,
first uploaded by Denelson83 as Flag of Ecuador.svg, modifications by Husunqu,
Zscout370".

**Source** — Wikimedia Commons,
<https://commons.wikimedia.org/wiki/File:Flag_of_Ecuador.svg>, which records the
work's own source as
`http://www.presidencia.gob.ec/pdf/Simbolos-Patrios.pdf`.

**Terms** — public domain. The source declares three grounds: the Ecuadorian
Intellectual Property Law, which places the symbols of the state outside
copyright protection; a Creative Commons CC0 1.0 Universal Public Domain
Dedication; and an Open Clip Art Library release into the public domain.

**Required notices** — none.

**Other restrictions** — the source records the following, which does not concern
copyright and is reproduced here for the same reason it appears there:

> The use of such symbols is restricted in many countries. These restrictions are
> independent of the copyright status.

**Modifications** — none.

## test-svgs/svgo-logo.svg

**Work** — the earlier logo of the SVGO project, the optimiser this application
provides an interface to. SVGO's present logo is a different work by a different
author.

**Author** — Yegor Bolshakov, <http://xizzzy.ru/>.

**Source** — the SVGO repository, <https://github.com/svg/svgo>. Obtained with
upstream SVGOMG, before the fork point.

**Terms** — the MIT License under which the SVGO repository is published,
`Copyright (c) Kir Belevich`.

**Licence text** — reproduced in full in [NOTICE.md](./NOTICE.md), under `MIT`,
where SVGO's notice is already carried for the code.

**Required notices** — the attribution travels inside the file, in banner comments
that SVGO's own optimiser preserves:

```
<!--! https://github.com/svg/svgo-->
<!--! SVGO project logo by Yegor Bolshakov (http://xizzzy.ru/)-->
```

**Modifications** — optimised.

## test-svgs/kitchen-sink.svg, test-svgs/fail.svg

**Work** — `kitchen-sink.svg` is a labelled test card carrying every SVG
construct the application's exposed optimisations act on. `fail.svg` is that file
truncated within an attribute, so that the application's parse-failure path can
be exercised.

**Author** — Eric Gesemann.

**Source** — written for this project.

**Terms** — the **Creative Commons CC0 1.0 Universal Public Domain Dedication**
(`CC0-1.0`), declared in `kitchen-sink.svg`'s own `<metadata>` element:

```
Dedicated to the public domain by Eric Gesemann under CC0 1.0 Universal.
SPDX-License-Identifier: CC0-1.0
https://creativecommons.org/publicdomain/zero/1.0/
```

The dedication covers both files: `fail.svg` is a prefix of `kitchen-sink.svg`,
so it carries the same `<metadata>` element. A bare statement of public domain
stood here until 2026-08-18, which named an intention without an instrument — a
poor footing under German law, where § 29 UrhG leaves copyright itself
untransferable. CC0 is used because it waives what can be waived and, where the
waiver is ineffective, falls back on a licence that reaches the same result.

**Licence text** — reproduced in full at
[`licences/CC0-1.0.txt`](./licences/CC0-1.0.txt), and distributed with the
application at that path. Nothing conditions the distribution of these files on
supplying it. It is held here so that the grant travels with the work rather than
depending on a remote address, section 3 of that document being what carries the
dedication in a jurisdiction that does not admit the waiver.

**Required notices** — none. CC0 places no condition on a recipient and asks for
no attribution. This record is provided for identification.

## partials/icons — the Lucide icons

**Work** — eleven of the application's interface icons. Each is a copy of one
icon from the Lucide set:

| File               | Lucide icon           |
|--------------------|-----------------------|
| `bg-fill.svg`      | `paint-bucket`        |
| `caret.svg`        | `chevron-down`        |
| `copy.svg`         | `clipboard-copy`      |
| `demo.svg`         | `swatch-book`         |
| `download.svg`     | `arrow-down-to-line`  |
| `image.svg`        | `image-down`          |
| `info.svg`         | `info`                |
| `markup.svg`       | `code-xml`            |
| `open.svg`         | `folder-search`       |
| `paste.svg`        | `clipboard-paste`     |
| `preview.svg`      | `image`               |

**Author** — Lucide Icons and Contributors. `info` is one of the icons Lucide
derives from the Feather project by Cole Bemis, and carries that project's
notice in addition to Lucide's own; the other ten do not.

**Source** — the Lucide project, <https://lucide.dev>. The path data of each file
above is identical to the corresponding icon in `lucide-static` 1.32.0, against
which it was checked.

**Terms** — the **ISC License**, and for `info.svg` additionally the **MIT
License**. Both condition copying on the copyright notice and the permission
notice appearing in all copies. Every copy of this application carries these
icons inside its markup, so both notices are reproduced here in full.

**Licence text** — from the Lucide project's own `LICENSE` file:

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

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

The same file records that a named list of Lucide icons is derived from Feather
and carries the notice below as well. `info` is on that list; no other icon this
project ships is. "The icons listed above" in its heading refers to that list,
which is reproduced in the Lucide project's `LICENSE` rather than here.

```
The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

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

**Required notices** — the two notices above.

**Modifications** — the artwork of each file is verbatim. What is replaced is the
root element's attributes, which carry this project's shared partial conventions
instead of Lucide's: `aria-hidden="true"` and `class="icon"` are added, `width`
and `height`, and Lucide's own `class` and its `@license` comment are dropped.
`caret.svg` replaced a differently drawn caret on 2026-08-18.

## partials/icons/bolt.svg

**Work** — the filled `bolt` icon, which marks the Optimisation settings.

**Author** — Paweł Kuna and the Tabler Icons contributors.

**Source** — Tabler Icons, <https://tabler.io/icons>. The path data is identical
to `icons/filled/bolt.svg` in `@tabler/icons` 3.46.0, against which it was
checked.

**Terms** — the **MIT License**, which conditions copying on the copyright notice
and the permission notice appearing in all copies. This application carries the
icon inside its markup, so the notice is reproduced here in full.

**Licence text** — from the Tabler Icons project's own `LICENSE` file:

```
MIT License

Copyright (c) 2020-2026 Paweł Kuna

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

**Required notices** — the notice above.

**Modifications** — the artwork is verbatim. The root element's attributes are
replaced as described for the Lucide icons above, and the transparent bounding
path that Tabler's files open with — `<path stroke="none" d="M0 0h24v24H0z"
fill="none"/>` — is dropped, it having no effect on what is drawn.

## partials/icons/contribute.svg

**Work** — the GitHub logo, the mark GitHub calls the Invertocat. It is the
toolbar's link to this project's own repository.

**Rights holder** — GitHub, Inc.

**Source** — the path data is identical to `github.svg` in Simple Icons,
<https://simpleicons.org>, whose icon data that project dedicates under
`CC0-1.0`. A different drawing of the same mark came with upstream SVGOMG, before
the fork point, and was replaced here.

**Terms** — two things have to be separated. The **drawing** is dedicated under
the Creative Commons CC0 1.0 Universal Public Domain Dedication by Simple Icons,
which asks nothing of a recipient. The **mark** is GitHub's trademark, and no
dedication or licence from Simple Icons or from anyone else could grant rights in
it: what Simple Icons gives away is its own copyright in the drawing, not
GitHub's rights in what the drawing depicts.

It is used here nominatively — to identify GitHub as the place this project's
source is hosted, and to link to it — which is the use GitHub's own logo
guidelines describe. It is not used as a logo of this application, and nothing
here suggests that GitHub publishes, endorses, or is affiliated with OMSVG. A
copy of this application that is not hosted from that repository should point the
link at its own source, or drop it.

**Required notices** — none. CC0 asks for none, and this record is provided for
identification.

**Modifications** — the artwork is verbatim. The root element's attributes are
replaced as described for the Lucide icons above, and the `<title>` element reads
"Contribute on GitHub".
