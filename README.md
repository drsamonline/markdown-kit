# markdown-kit

[![live](https://img.shields.io/badge/live-online-22c55e)](https://drsamonline.github.io/markdown-kit/)
[![test](https://github.com/drsamonline/markdown-kit/actions/workflows/test.yml/badge.svg)](https://github.com/drsamonline/markdown-kit/actions/workflows/test.yml)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)

**Markdown to HTML, with a streaming reveal.** Zero dependencies. One file. A language model
does not send a document — it sends chunks, and half of them end in the middle of a code
fence. This renders what is finished and holds back what could still change.

## Use it

```js
var Md = require("./markdown-kit.js");        // Node; in a browser it is window.Md

Md.render("## Hi\n\nSome **bold**.");         // HTML string

var s = Md.stream();
s.push("## Hi\n\nSome **bo");                 // { html, complete: false }
s.push("ld** text.\n\n");                     // { html, complete: true }
s.done();                                     // render the finished buffer, then reset
```

## What it does

- **CommonMark's core** — ATX headings with ids, paragraphs, hard breaks (two spaces or a
  backslash), emphasis, strong, strikethrough, inline code, fenced code with a language
  (``` or ~~~), blockquotes, ordered and unordered lists including nested ones, horizontal
  rules, links and images
- **the GitHub extensions** — tables with per-column alignment, task lists (`- [x]`), and
  alerts (`> [!NOTE]`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`)
- **safe by default** — HTML in the source is escaped, never passed through; a
  `javascript:` link or a `data:` image is rendered as text, not as a link or image
- **`Md.stream()`** — `push`, `set`, `html`, `text`, `reset`, `done`. An unterminated code
  fence renders as code immediately; any other unfinished block renders as text, so a list
  item is never briefly just a dash
- **`Md.blocks(src)`** — the parse tree, if you want to render it yourself
- **`Md.scale(opts)`** — the two type scales from the Go source: documents at 16px with
  headings growing to 2.5×, chat at 14px with headings barely larger, and the heading room
  curve
- **`Md.toDom(src)`** — a guarded DOM helper, `null` in Node

The streaming model and both type scales are ported from [lobe-mygo](https://github.com/lobehub/lobe-mygo)
`pkg/markdown` (MIT), which delegates parsing to MyGo's own CommonMark renderer. The parser
here is written from scratch, because there is nothing to port — the Go side uses a library
and the kits cannot have dependencies.

## Verified

```
node test-node.js
92 passed, 0 failed
```

The tests cover every block and inline construct, the sanitiser (a `javascript:` link and a
`data:` image are both refused), that markdown inside a fence stays literal, nested lists,
alert bodies, table padding for short rows, the heading scale in both variants, and the
streaming behaviour that matters: a partial heading is not a heading, half-written emphasis
is not bold, an open fence is code, and a trailing blank line is what finalises a block.

## Consumers

None, by design — no app in the fleet is modified by this pass. The intended first adopters
are the AI-facing apps (SmartNotes, ai-bridge, Matneo), which currently render model output
by hand, and that adoption is yours to decide one app at a time.

## Support

<img src="docs/assets/support-portrait.jpg" width="72" height="72" alt="Dr. Sohil Momin" align="left" style="border-radius:50%;margin-right:1rem">

Free, offline, accountless — and staying that way. If it earned its keep:

| | |
|---|---|
| UPI (India) | `drsohilboi@ybl` — payee Dr. Sohil Momin, open amount, or scan [the QR](docs/assets/upi-qr.svg) |
| Ko-fi | [ko-fi.com/matneo](https://ko-fi.com/matneo) |
| PayPal | [paypal.me/drsohilmomin](https://paypal.me/drsohilmomin?locale.x=en_GB&country.x=IN) |
| My books | [Amazon author store](https://www.amazon.com/stores/author/B08ZT331LY/allbooks) |
| More apps | [drsamonline.github.io](https://drsamonline.github.io/) |
| Email | [sohilmomin2000@gmail.com](mailto:sohilmomin2000@gmail.com) |

Nothing is gated behind it: no accounts, no tracking, no network requests.

## Licence

PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin. Part of the Forge system — kits
open, orchestrator licensed.
