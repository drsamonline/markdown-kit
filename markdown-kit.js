/* markdown-kit — Markdown to HTML, with a streaming reveal. Zero dependencies.
 *
 * The renderer the AI-facing apps need: a language model's reply arrives in
 * chunks, half a code fence at a time, and has to be shown without flashing a
 * broken parse on every token.
 *
 *   var Md = require("./markdown-kit.js");
 *   Md.render("## Hi\n\nSome **bold** text.");     // HTML string
 *
 *   var s = Md.stream();
 *   s.push("## Hi\n\nSome **bo");                  // { html, complete: false }
 *   s.push("ld** text.\n\n");                      // { html, complete: true }
 *
 * CommonMark's common core, plus the GitHub extensions the Go source enables:
 * tables, task lists, fenced code with a language, and alerts ([!NOTE] and the
 * rest). Raw HTML in the source is escaped, never passed through.
 *
 * Behaviour ported from lobe-mygo pkg/markdown (MIT): the type scale of the two
 * variants, the heading growth curve, and the reveal model (a unit at a time,
 * with a catch-up window) reduced to what a DOM renderer can honour.
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Md = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var Md = { version: "1.0.0" };

  /* ---------- escaping ---------- */
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  Md.escape = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  };

  /* A URL is only a link if it cannot run code. */
  var SAFE = /^(https?:|mailto:|tel:|#|\/|\.{1,2}\/|[A-Za-z0-9_\-]+\/)/;
  function safeUrl(u) {
    var t = String(u).trim().replace(/^<|>$/g, "");
    if (/^[a-z][a-z0-9+.\-]*:/i.test(t) && !SAFE.test(t)) return null;
    if (SAFE.test(t) || /^[\w.\-]+(@|:)/.test(t)) return t;
    return null;
  }
  Md.safeUrl = safeUrl;

  /* ---------- inline ---------- */
  /* Order matters: code spans are lifted out first so nothing inside them is
     interpreted, then the rest, then the spans are put back. */
  function inline(text) {
    var spans = [];
    var s = String(text);

    s = s.replace(/`([^`]+)`/g, function (_, code) {
      spans.push("<code>" + Md.escape(code) + "</code>");
      return "\u0000" + (spans.length - 1) + "\u0000";
    });

    s = Md.escape(s);

    /* images before links: ![a](b) would otherwise match as a link */
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (m, alt, url, title) {
      var u = safeUrl(url);
      if (!u) return m;
      return '<img src="' + Md.escape(u) + '" alt="' + alt + '"' +
        (title ? ' title="' + title + '"' : "") + ">";
    });

    s = s.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (m, label, url, title) {
      var u = safeUrl(url);
      if (!u) return m;
      return '<a href="' + Md.escape(u) + '"' + (title ? ' title="' + title + '"' : "") + ">" + label + "</a>";
    });

    s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, function (_, url) {
      return '<a href="' + url + '">' + url + "</a>";
    });

    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^\w_])_([^_\s][^_]*?)_(?!_)/g, "$1<em>$2</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");

    /* a hard break is two trailing spaces or a backslash */
    s = s.replace(/ {2,}\n/g, "<br>\n").replace(/\\\n/g, "<br>\n");

    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return spans[+i]; });
    return s;
  }
  Md.inline = inline;

  /* ---------- block parsing ---------- */
  var FENCE = /^(\s*)(```|~~~)\s*([\w+#.-]*)\s*$/;
  var ATX = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  var HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
  var QUOTE = /^\s{0,3}>\s?/;
  var UL = /^(\s*)([-*+])\s+(.*)$/;
  var OL = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
  var TASK = /^\[([ xX])\]\s+(.*)$/;
  var TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

  var ALERTS = { NOTE: "note", TIP: "tip", IMPORTANT: "important", WARNING: "warning", CAUTION: "caution" };

  function indentOf(line) { return /^\s*/.exec(line)[0].length; }

  function parseBlocks(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (/^\s*$/.test(line)) { i++; continue; }

      /* fenced code */
      var f = FENCE.exec(line);
      if (f) {
        var lang = f[3] || "";
        var body = [];
        i++;
        while (i < lines.length && !new RegExp("^\\s*" + f[2] + "\\s*$").test(lines[i])) {
          body.push(lines[i]); i++;
        }
        i++; /* closing fence */
        out.push({ type: "code", lang: lang, text: body.join("\n") });
        continue;
      }

      /* heading */
      var h = ATX.exec(line);
      if (h) {
        out.push({ type: "heading", level: h[1].length, text: h[2] });
        i++;
        continue;
      }

      /* horizontal rule */
      if (HR.test(line)) { out.push({ type: "hr" }); i++; continue; }

      /* blockquote, and the alert inside it */
      if (QUOTE.test(line)) {
        var inner = [];
        while (i < lines.length && (QUOTE.test(lines[i]) || (/^\s*$/.test(lines[i]) && inner.length))) {
          inner.push(lines[i].replace(QUOTE, ""));
          i++;
        }
        var first = (inner[0] || "").trim();
        var alert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i.exec(first);
        if (alert) {
          inner[0] = alert[2];
          out.push({ type: "alert", kind: ALERTS[alert[1].toUpperCase()], children: parseBlocks(inner.join("\n")) });
        } else {
          out.push({ type: "quote", children: parseBlocks(inner.join("\n")) });
        }
        continue;
      }

      /* table: a header row followed by a delimiter row */
      if (line.indexOf("|") !== -1 && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].indexOf("-") !== -1) {
        var split = function (row) {
          var r = row.trim().replace(/^\|/, "").replace(/\|$/, "");
          return r.split("|").map(function (c) { return c.trim(); });
        };
        var head = split(line);
        var align = split(lines[i + 1]).map(function (c) {
          var l = c.charAt(0) === ":", r = c.charAt(c.length - 1) === ":";
          return l && r ? "center" : r ? "right" : l ? "left" : "";
        });
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) {
          rows.push(split(lines[i])); i++;
        }
        out.push({ type: "table", head: head, align: align, rows: rows });
        continue;
      }

      /* lists */
      var ul = UL.exec(line), ol = OL.exec(line);
      if (ul || ol) {
        var parsed = parseList(lines, i);
        out.push(parsed.node);
        i = parsed.next;
        continue;
      }

      /* paragraph */
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !FENCE.test(lines[i]) &&
             !ATX.test(lines[i]) && !HR.test(lines[i]) && !QUOTE.test(lines[i]) &&
             !UL.test(lines[i]) && !OL.test(lines[i])) {
        /* keep trailing spaces: two of them are a hard break */
        para.push(lines[i].replace(/^\s+/, ""));
        i++;
      }
      if (para.length) out.push({ type: "para", text: para.join("\n") });
      else i++;
    }
    return out;
  }

  function parseList(lines, i) {
    var first = UL.exec(lines[i]) || OL.exec(lines[i]);
    var baseIndent = first[1].length;
    var ordered = !!OL.exec(lines[i]);
    var start = ordered ? parseInt(OL.exec(lines[i])[2], 10) : 1;
    var items = [];

    while (i < lines.length) {
      var line = lines[i];
      var m = ordered ? OL.exec(line) : UL.exec(line);
      if (!m || m[1].length !== baseIndent) break;
      var text = m[3];
      var task = null;
      var t = TASK.exec(text);
      if (t) { task = t[1].toLowerCase() === "x"; text = t[2]; }
      i++;

      /* continuation lines: indented past the marker, or blank inside the item */
      var cont = [];
      while (i < lines.length) {
        var next = lines[i];
        if (/^\s*$/.test(next)) {
          var after = i + 1 < lines.length ? lines[i + 1] : "";
          if (after && indentOf(after) > baseIndent) { cont.push(""); i++; continue; }
          break;
        }
        if (indentOf(next) > baseIndent) { cont.push(next.slice(baseIndent + 2)); i++; continue; }
        if ((ordered ? OL : UL).test(next) && indentOf(next) === baseIndent) break;
        if (!/^\s*$/.test(next) && indentOf(next) <= baseIndent && !FENCE.test(next)) break;
        break;
      }

      var body = [text].concat(cont);
      items.push({ task: task, children: parseBlocks(body.join("\n")) });
    }
    return { node: { type: "list", ordered: ordered, start: start, items: items }, next: i };
  }

  /* ---------- rendering ---------- */
  function renderNodes(nodes) {
    return nodes.map(renderNode).join("\n");
  }

  function renderNode(n) {
    switch (n.type) {
      case "heading":
        return "<h" + n.level + ' id="' + Md.slug(n.text) + '">' + inline(n.text) + "</h" + n.level + ">";
      case "para":
        return "<p>" + inline(n.text) + "</p>";
      case "code":
        return "<pre><code" + (n.lang ? ' class="language-' + Md.escape(n.lang) + '"' : "") + ">" +
          Md.escape(n.text) + "</code></pre>";
      case "hr":
        return "<hr>";
      case "quote":
        return "<blockquote>\n" + renderNodes(n.children) + "\n</blockquote>";
      case "alert":
        return '<div class="md-alert md-alert-' + n.kind + '">\n' + renderNodes(n.children) + "\n</div>";
      case "list": {
        var tag = n.ordered ? "ol" : "ul";
        var attrs = n.ordered && n.start !== 1 ? ' start="' + n.start + '"' : "";
        var items = n.items.map(function (it) {
          var box = it.task === null ? "" :
            '<input type="checkbox" disabled' + (it.task ? " checked" : "") + "> ";
          var inner = renderNodes(it.children);
          if (it.task !== null) {
            /* a task item's first paragraph carries the checkbox, not a new block */
            inner = inner.replace(/^<p>/, "<p>" + box);
          }
          return "<li>" + inner + "</li>";
        }).join("\n");
        return "<" + tag + attrs + ">\n" + items + "\n</" + tag + ">";
      }
      case "table": {
        var head = n.head.map(function (c, idx) {
          var a = n.align[idx];
          return "<th" + (a ? ' style="text-align:' + a + '"' : "") + ">" + inline(c) + "</th>";
        }).join("");
        var rows = n.rows.map(function (r) {
          var cells = [];
          for (var c = 0; c < n.head.length; c++) {
            var a = n.align[c];
            cells.push("<td" + (a ? ' style="text-align:' + a + '"' : "") + ">" + inline(r[c] == null ? "" : r[c]) + "</td>");
          }
          return "<tr>" + cells.join("") + "</tr>";
        }).join("\n");
        return "<table>\n<thead><tr>" + head + "</tr></thead>\n<tbody>\n" + rows + "\n</tbody>\n</table>";
      }
      default:
        return "";
    }
  }

  Md.slug = function (text) {
    return String(text).toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  };

  Md.blocks = parseBlocks;

  /* ---------- the public render ---------- */
  Md.render = function (src) {
    if (src == null) return "";
    return renderNodes(parseBlocks(src));
  };

  /* The variant type scales from the Go source: documents at 16, chat at 14,
   * headings at 1 + grow x headerMultiple, room at 2x or 1x. */
  var GROW = [1.5, 1, 0.5, 0.25, 0, 0];
  Md.scale = function (opts) {
    var o = opts || {};
    var chat = o.variant === "chat";
    var s = chat
      ? { fontSize: 14, headerMultiple: 0.25, marginMultiple: 1, lineHeight: 1.6 }
      : { fontSize: 16, headerMultiple: 1, marginMultiple: 2, lineHeight: 1.8 };
    ["fontSize", "headerMultiple", "marginMultiple", "lineHeight"].forEach(function (k) {
      if (o[k] > 0) s[k] = o[k];
    });
    s.headings = GROW.map(function (g) {
      var size = 1 + g * s.headerMultiple;
      return {
        size: size,
        room: Math.max(s.headerMultiple * s.marginMultiple * 0.4 * size, 1),
        px: Math.round(s.fontSize * size * 100) / 100
      };
    });
    return s;
  };

  /* ---------- streaming ---------- */
  /* A reply arrives in chunks. Rendering the whole buffer on every chunk would
     re-parse the document each time, and rendering the incomplete tail as
     Markdown shows a broken parse for one frame - a list item that is briefly
     just a dash. So: everything up to the last safe boundary is parsed as
     Markdown, and the tail that could still change is shown as text. */
  function safeSplit(src) {
    var s = String(src);
    var lines = s.split("\n");

    /* inside an unterminated fence: everything before the opener is safe, and
       the code so far renders as code, still open */
    var openFence = -1, fenceMark = null;
    for (var i = 0; i < lines.length; i++) {
      var f = FENCE.exec(lines[i]);
      if (!f) continue;
      if (openFence === -1) { openFence = i; fenceMark = f[2]; }
      else if (f[2] === fenceMark) openFence = -1;
    }
    if (openFence !== -1) {
      var before = lines.slice(0, openFence).join("\n");
      var codeSoFar = lines.slice(openFence + 1).join("\n");
      var lang = (FENCE.exec(lines[openFence]) || [])[3] || "";
      return {
        html: renderNodes(parseBlocks(before)) +
          "\n<pre><code" + (lang ? ' class="language-' + Md.escape(lang) + '"' : "") + ">" +
          Md.escape(codeSoFar) + "</code></pre>",
        complete: false
      };
    }

    /* otherwise: a blank line ends a block. The last block is only complete if
       the source ends with a blank line; anything else could still grow. */
    if (/\n\s*\n$/.test(s)) {
      return { html: renderNodes(parseBlocks(s)), complete: true };
    }
    var lastBlank = s.lastIndexOf("\n\n");
    if (lastBlank === -1) {
      /* one block, still being written: show it as text, not as a half parse */
      return { html: s.trim() ? "<p>" + inline(s.trim()) + "</p>" : "", complete: false };
    }
    var done = s.slice(0, lastBlank + 2);
    var tail = s.slice(lastBlank + 2);
    return {
      html: renderNodes(parseBlocks(done)) + (tail.trim() ? "\n<p>" + inline(tail.trim()) + "</p>" : ""),
      complete: false
    };
  }

  Md.reveal = function (src) {
    if (src == null) return { html: "", complete: true };
    return safeSplit(src);
  };

  Md.stream = function () {
    var buf = "";
    return {
      push: function (chunk) {
        buf += chunk == null ? "" : String(chunk);
        return Md.reveal(buf);
      },
      set: function (text) { buf = text == null ? "" : String(text); return Md.reveal(buf); },
      html: function () { return Md.reveal(buf).html; },
      text: function () { return buf; },
      reset: function () { buf = ""; },
      /* The message is complete: render the whole thing, not the safe split. */
      done: function () {
        var html = Md.render(buf);
        buf = "";
        return { html: html, complete: true };
      }
    };
  };

  /* ---------- DOM ---------- */
  /* One guarded helper, for a browser. Node has no document, so this returns
     null there rather than throwing. */
  Md.toDom = function (src) {
    if (typeof document === "undefined") return null;
    var wrap = document.createElement("div");
    wrap.className = "md";
    wrap.innerHTML = Md.render(src);
    return wrap;
  };

  return Md;
});
