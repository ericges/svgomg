# Asset notices

This is the declaration of the demo and test artwork distributed with OMSVG, in
the source repository and in the built application alike — the SVG files listed
below, and those only. Each record states the work, its author, the source it was
obtained from, the terms it is distributed under, where those terms are
reproduced, and any modification made to it here.

Nothing else the app ships needs a record here. Its own artwork — the logo, the
icons and the drawings they are made from — is Eric Gesemann's own work, covered
by [LICENSE.md](./LICENSE.md); the code it bundles and the code font it ships are
covered by [NOTICE.md](./NOTICE.md). Neither document grants anything over the
works declared here: each is distributed under the terms stated with it, and
those terms govern it.

No work declared here is incorporated into a script, a stylesheet or any other
part of the application. Each is a separate file, distributed alongside OMSVG
rather than as a part of it, and fetched whole: `car-lite.svg` when the service
worker installs, so that the Demo button works offline, and every other one when
a user asks for it.

---

## Summary

| File                           | Work                        | Rights holder                          | Terms                       |
|--------------------------------|-----------------------------|----------------------------------------|-----------------------------|
| `test-svgs/car-lite.svg`       | little red racing car       | Onsemeliot                             | CC Public Domain Dedication |
| `test-svgs/car-lite-green.svg` | little green racing car     | Onsemeliot                             | CC Public Domain Dedication |
| `test-svgs/tiger.svg`          | Ghostscript Tiger           | the Ghostscript authors                | AGPL-3.0-or-later           |
| `test-svgs/flag.svg`           | Flag of Ecuador             | see the record below                   | Public domain, and CC0-1.0  |
| `test-svgs/svgo-logo.svg`      | SVGO project logo           | Kir Belevich and the SVGO contributors | MIT                         |
| `test-svgs/kitchen-sink.svg`   | OMSVG kitchen sink          | Eric Gesemann                          | CC0-1.0                     |
| `test-svgs/fail.svg`           | OMSVG parse-failure fixture | Eric Gesemann                          | CC0-1.0                     |

`src/config.json` determines which of these files are built and distributed with
the application. `fail.svg` is not among them; it is distributed only in the
source repository.

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
