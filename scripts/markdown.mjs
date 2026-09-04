// Renderizador Markdown mínimo, sem dependências.
// Cobre o que aparece em README de perfil e notas: títulos, listas, código,
// citações, tabelas, links, imagens, ênfase, HTML inline (badges) e linhas.

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(text) {
  let out = text;
  // código inline primeiro, protegido dos demais padrões
  const codes = [];
  out = out.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1" loading="lazy">');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2">$1</a>');
  out = out.replace(/(^|[^*])\*\*([^*]+)\*\*/g, "$1<strong>$2</strong>");
  out = out.replace(/(^|[^*_])_([^_]+)_/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return out;
}

function tableRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

export function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;

  const closeList = (stack) => { while (stack.length) html.push(`</${stack.pop()}>`); };
  const listStack = [];

  while (i < lines.length) {
    const line = lines[i];

    // bloco de código cercado
    const fence = line.match(/^\s*```+\s*([\w+-]*)/);
    if (fence) {
      closeList(listStack);
      const lang = fence[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const cls = lang ? ` class="language-${lang}"` : "";
      html.push(`<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // HTML bruto (badges, <p align="center">, <img>, comentários)
    if (/^\s*<(\/?)(p|div|img|a|br|hr|h[1-6]|table|tr|td|th|details|summary|picture|source|span|!--)/i.test(line)) {
      closeList(listStack);
      html.push(line);
      i++;
      continue;
    }

    if (!line.trim()) { closeList(listStack); i++; continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList(listStack);
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeList(listStack);
      html.push("<hr>");
      i++;
      continue;
    }

    // tabela
    if (/\|/.test(line) && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1] || "")) {
      closeList(listStack);
      const head = tableRow(line);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) body.push(tableRow(lines[i++]));
      html.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
        body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
        `</tbody></table>`
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      closeList(listStack);
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      html.push(`<blockquote>${renderMarkdown(buf.join("\n"))}</blockquote>`);
      continue;
    }

    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const tag = /^\d/.test(li[2]) ? "ol" : "ul";
      if (!listStack.length) { listStack.push(tag); html.push(`<${tag}>`); }
      else if (listStack[listStack.length - 1] !== tag) { closeList(listStack); listStack.push(tag); html.push(`<${tag}>`); }
      html.push(`<li>${inline(li[3])}</li>`);
      i++;
      continue;
    }

    // parágrafo
    closeList(listStack);
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^\s*```/.test(lines[i]) && !/^\s*>/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    html.push(`<p>${inline(buf.join(" ").trim())}</p>`);
  }

  closeList(listStack);
  return html.join("\n");
}

// Front matter simples: chave: valor, e listas [a, b]
export function parseFrontMatter(raw) {
  const text = String(raw).replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim().replace(/^["']|["']$/g, "");
    if (/^\[.*\]$/.test(value)) {
      value = value.slice(1, -1).split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
    data[kv[1]] = value;
  }
  return { data, body: text.slice(m[0].length) };
}
