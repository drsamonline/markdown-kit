# Changelog
## 1.0.0 — 2026-11-09
### Added
- a Markdown parser written from scratch: headings, lists, tables, fenced code, quotes, task lists, alerts, footnotes
- `render`, `tokens`, `stream` with the reveal that holds back an incomplete tail
- HTML escaped by default, links sanitised

### Verified
- 92 assertions
- the Go source delegates to MyGo's renderer, so nothing was ported - the parser is new

PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
