# markdown-kit — API reference

**Version 1.0.0.** **Markdown to HTML, with a streaming reveal.** Zero dependencies. One file. A language model does not send a document — it sends chunks, and half of them end in the middle of a code fence. This renders what is finished and holds back what could still change.

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="markdown-kit.js"></script>
Md.escape(...)
// or: const Md = require('./markdown-kit.js')
```

## The surface (7 entries)

| Name | Arguments | What it does |
|---|---|---|
| `Md.escape` | `(s)` | — |
| `Md.slug` | `(text)` | — |
| `Md.render` | `(src)` | — |
| `Md.scale` | `(opts)` | — |
| `Md.reveal` | `(src)` | — |
| `Md.stream` | `()` | — |
| `Md.toDom` | `(src)` | — |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
