const path = require("path");
const Md = require(path.join(__dirname, "markdown-kit.js"));
let pass = 0, fail = 0;
function ok(n, c, e) { c ? (pass++, console.log("PASS  " + n + (e ? "  (" + e + ")" : ""))) : (fail++, console.log("FAIL  " + n + (e ? "  (" + e + ")" : ""))); }
const has = (html, s) => html.indexOf(s) !== -1;

/* ---------- escaping and safety ---------- */
ok("version", typeof Md.version === "string", Md.version);
ok("escapes HTML in text", Md.render("<script>alert(1)</script>").indexOf("<script>") === -1);
ok("escapes an inline tag", has(Md.render("a < b"), "a &lt; b"));
ok("javascript: link is not a link", Md.render("[x](javascript:alert(1))").indexOf("<a ") === -1);
ok("data: image is not an image", Md.render("![x](data:text/html,evil)").indexOf("<img") === -1);
ok("https link works", has(Md.render("[x](https://a.b)"), '<a href="https://a.b">x</a>'));
ok("relative link works", has(Md.render("[x](/docs/a)"), 'href="/docs/a"'));
ok("anchor link works", has(Md.render("[x](#top)"), 'href="#top"'));
ok("mailto works", has(Md.render("[x](mailto:a@b.c)"), 'href="mailto:a@b.c"'));
ok("link title is kept", has(Md.render('[x](https://a.b "T")'), 'title="T"'));

/* ---------- headings ---------- */
ok("h1", has(Md.render("# Title"), "<h1"));
ok("h3", has(Md.render("### Deep"), "<h3"));
ok("h6", has(Md.render("###### Six"), "<h6"));
ok("seven hashes is a paragraph", has(Md.render("####### Seven"), "<p>"));
ok("heading gets an id", has(Md.render("## Hello World"), 'id="hello-world"'));
ok("heading closes", has(Md.render("# T"), "</h1>"));
ok("heading inline code", has(Md.render("# a `b` c"), "<code>b</code>"));

/* ---------- paragraphs and breaks ---------- */
ok("paragraph", Md.render("hello") === "<p>hello</p>");
ok("two paragraphs", (Md.render("a\n\nb").match(/<p>/g) || []).length === 2);
ok("soft newline joins", has(Md.render("a\nb"), "<p>a\nb</p>"));
ok("hard break on two spaces", has(Md.render("a  \nb"), "<br>"));
ok("hard break on backslash", has(Md.render("a\\\nb"), "<br>"));
ok("empty source", Md.render("") === "");
ok("null source", Md.render(null) === "");

/* ---------- emphasis ---------- */
ok("bold", has(Md.render("**b**"), "<strong>b</strong>"));
ok("italic", has(Md.render("*i*"), "<em>i</em>"));
ok("bold italic", has(Md.render("***x***"), "<strong><em>x</em></strong>"));
ok("underscore bold", has(Md.render("__b__"), "<strong>b</strong>"));
ok("underscore italic", has(Md.render("_i_"), "<em>i</em>"));
ok("strike", has(Md.render("~~s~~"), "<del>s</del>"));
ok("asterisk inside a word is not emphasis", Md.render("a*b*c").indexOf("<em>") === -1);
ok("code span wins over emphasis", has(Md.render("`*not italic*`"), "<code>*not italic*</code>"));
ok("code span escapes", has(Md.render("`<b>`"), "<code>&lt;b&gt;</code>"));
ok("two code spans", (Md.render("`a` and `b`").match(/<code>/g) || []).length === 2);

/* ---------- code blocks ---------- */
const code = Md.render("```js\nconst a = 1 < 2;\n```");
ok("fenced code block", has(code, "<pre><code"));
ok("language class", has(code, 'class="language-js"'));
ok("code is escaped", has(code, "1 &lt; 2"));
ok("tilde fence", has(Md.render("~~~\nx\n~~~"), "<pre><code>"));
ok("unclosed fence still renders", has(Md.render("```\nabc"), "abc"));
ok("markdown inside a fence is literal", Md.render("```\n**x**\n```").indexOf("<strong>") === -1);

/* ---------- lists ---------- */
const ul = Md.render("- one\n- two\n- three");
ok("unordered list", has(ul, "<ul>") && (ul.match(/<li>/g) || []).length === 3);
ok("ordered list", has(Md.render("1. a\n2. b"), "<ol>"));
ok("ordered start is kept", has(Md.render("3. a\n4. b"), 'start="3"'));
ok("list item inline", has(ul, "<li><p>one</p></li>"));
ok("task list unchecked", has(Md.render("- [ ] todo"), '<input type="checkbox" disabled>'));
ok("task list checked", has(Md.render("- [x] done"), 'disabled checked'));
ok("nested list", (function () {
  const h = Md.render("- a\n  - b\n- c");
  return has(h, "<ul>") && (h.match(/<ul>/g) || []).length === 2;
})(), Md.render("- a\n  - b\n- c").replace(/\n/g, " "));

/* ---------- quotes and alerts ---------- */
ok("blockquote", has(Md.render("> quoted"), "<blockquote>"));
ok("blockquote multi-line", (function () {
  const h = Md.render("> a\n> b");
  return has(h, "<blockquote>") && has(h, "a") && has(h, "b");
})());
ok("alert NOTE", has(Md.render("> [!NOTE]\n> read this"), "md-alert-note"));
ok("alert WARNING", has(Md.render("> [!WARNING]\n> careful"), "md-alert-warning"));
ok("alert body is parsed", has(Md.render("> [!TIP]\n> **bold** tip"), "<strong>bold</strong>"));
ok("alert marker is not shown", Md.render("> [!NOTE]\n> x").indexOf("[!NOTE]") === -1);

/* ---------- tables ---------- */
const tbl = Md.render("| a | b |\n|---|---|\n| 1 | 2 |");
ok("table", has(tbl, "<table>") && has(tbl, "<th>a</th>"));
ok("table body", has(tbl, "<td>1</td>"));
ok("table alignment", has(Md.render("| a |\n|:--:|\n| 1 |"), "text-align:center"));
ok("table right align", has(Md.render("| a |\n|--:|\n| 1 |"), "text-align:right"));
ok("table pads short rows", has(Md.render("| a | b |\n|---|---|\n| 1 |"), "<td></td>"));
ok("a pipe line without a separator is a paragraph", Md.render("a | b").indexOf("<table>") === -1);

/* ---------- rules ---------- */
ok("hr dashes", has(Md.render("---"), "<hr>"));
ok("hr stars", has(Md.render("***"), "<hr>"));
ok("hr underscores", has(Md.render("___"), "<hr>"));

/* ---------- images ---------- */
ok("image", has(Md.render("![alt](https://a.b/i.png)"), '<img src="https://a.b/i.png" alt="alt"'));
ok("image is not a link", Md.render("![a](https://a.b/i.png)").indexOf("<a ") === -1);

/* ---------- scale ---------- */
const docScale = Md.scale();
const chatScale = Md.scale({ variant: "chat" });
ok("document text is 16", docScale.fontSize === 16);
ok("chat text is 14", chatScale.fontSize === 14);
ok("document line height", docScale.lineHeight === 1.8);
ok("chat line height", chatScale.lineHeight === 1.6);
ok("h1 grows 2.5x in a document", docScale.headings[0].size === 2.5, docScale.headings[0].px + "px");
ok("h1 barely grows in chat", chatScale.headings[0].size === 1.375, chatScale.headings[0].px + "px");
ok("h6 does not grow", docScale.headings[5].size === 1);
ok("heading room is positive", docScale.headings.every((h) => h.room >= 1));
ok("overrides are honoured", Md.scale({ fontSize: 20 }).fontSize === 20);

/* ---------- streaming ---------- */
const s = Md.stream();
let r = s.push("# Ti");
ok("partial heading shows as text, not a heading", r.complete === false && r.html.indexOf("<h1") === -1, r.html);
r = s.push("tle\n\n");
ok("a finished block becomes a heading", r.complete === true && r.html.indexOf("<h1") !== -1, r.html);
r = s.push("Some **bo");
ok("half-written emphasis is not bold", r.html.indexOf("<strong>") === -1, r.html);
r = s.push("ld**.\n\n");
ok("finished emphasis is bold", r.html.indexOf("<strong>bold</strong>") !== -1);
const fin = s.done();
ok("done renders the whole buffer", fin.complete === true && fin.html.indexOf("<h1") !== -1);
ok("done clears the buffer", s.text() === "");

const s2 = Md.stream();
r = s2.push("```js\nconst a = 1;\n");
ok("an open fence renders as code immediately", r.html.indexOf("<pre><code") !== -1 && r.complete === false);
ok("open fence keeps the language", r.html.indexOf('class="language-js"') !== -1);
r = s2.push("const b = 2;\n```\n\n");
ok("closed fence completes", r.complete === true && r.html.indexOf("const b = 2;") !== -1);

const s3 = Md.stream();
ok("empty stream is empty", s3.push("").html === "");
r = s3.push("- a\n- b\n");
ok("a list still being written is not finalised", r.complete === false);
r = s3.push("\n");
ok("a trailing blank line finalises the list", r.complete === true && (r.html.match(/<li>/g) || []).length === 2);

const s4 = Md.stream();
s4.set("## Replace\n\n");
ok("set replaces the buffer", s4.html().indexOf("<h2") !== -1);
s4.reset();
ok("reset empties it", s4.text() === "");

/* reveal is the same function without the wrapper */
ok("reveal on complete source", Md.reveal("a\n\n").complete === true);
ok("reveal on null", Md.reveal(null).complete === true);

/* ---------- blocks ---------- */
const b = Md.blocks("# h\n\npara\n\n- x");
ok("blocks exposes the parse", b.length === 3 && b[0].type === "heading" && b[2].type === "list");
ok("slug is stable", Md.slug("Hello, World!") === "hello-world");
ok("slug drops punctuation", Md.slug("a & b") === "a--b" || Md.slug("a & b").indexOf("&") === -1);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
