// Build do site estático. Node 20+, zero dependências.
// Uso: node scripts/build.mjs   (saída em dist/)
//
// O visual vem do design "Portfolio with GitHub repos" (design system Nocturne).
// A diferença em relação ao design original: lá os repositórios eram buscados
// no navegador a cada visita; aqui eles são buscados no build e viram HTML.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRepos, fetchProfileReadme, hasToken } from "./github.mjs";
import { renderMarkdown, parseFrontMatter } from "./markdown.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => path.join(root, ...s);
const OUT = p("dist");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Datas só-dia ("2026-09-04") são lidas como meia-noite UTC pelo Date, o que
// retrocede um dia ao formatar em fusos negativos. Fixamos ao meio-dia local.
const fmtDate = (iso, lang) => {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString(lang, { day: "2-digit", month: "short", year: "numeric" });
};

// Mesma escala de tempo relativo do design.
function relTime(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? "há 1 dia" : `há ${d} dias`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo === 1 ? "há 1 mês" : `há ${mo} meses`;
  const y = Math.floor(d / 365);
  return y === 1 ? "há 1 ano" : `há ${y} anos`;
}

// Cores de linguagem do GitHub, como no design.
const LANG_COLORS = {
  Python: "#3572A5", JavaScript: "#f1e05e", TypeScript: "#3178c6",
  "C++": "#f34b7d", C: "#555555", "C#": "#178600", Java: "#b07219",
  HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051", Go: "#00ADD8",
  Rust: "#dea584", Ruby: "#701516", PHP: "#4F5D95", Vue: "#41b883",
  "Jupyter Notebook": "#DA5B0B", SQL: "#e38c00", PLpgSQL: "#336790",
  Dockerfile: "#384d54", Kotlin: "#A97BFF", Swift: "#F05138",
  Batchfile: "#C1F12E", PowerShell: "#012456", VBA: "#867db1",
  "Visual Basic .NET": "#945db7", TeX: "#3D6117", R: "#198CE7",
  Makefile: "#427819", Assembly: "#6E4C13"
};
const langColor = (lang) => LANG_COLORS[lang] || "var(--color-neutral-500)";

const ARROW = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9 7.4 14 2.2 9.5l6.9-.6z"/></svg>';

function template(tpl, vars) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
}

function repoCard(repo, { featured = false, index = 0 } = {}) {
  const href = repo.pagesUrl || repo.url || repo.homepage;
  const meta = [];
  if (repo.language) {
    meta.push(
      `<span><span class="lang-dot" style="background:${esc(langColor(repo.language))}"></span>${esc(repo.language)}</span>`
    );
  }
  if (repo.stars) meta.push(`<span>${STAR}${repo.stars}</span>`);
  meta.push(`<span title="${esc(repo.updatedAt || "")}">${esc(relTime(repo.updatedAt))}</span>`);

  const badges = [];
  if (repo.visibility === "private") badges.push('<span class="tag tag-outline">privado</span>');
  if (repo.hasPages) badges.push('<span class="tag tag-accent">page</span>');
  if (repo.archived) badges.push('<span class="tag tag-neutral">arquivado</span>');

  const top = featured
    ? `<div class="repo-top">
      <span class="repo-num">${String(index + 1).padStart(2, "0")}</span>
      <span class="repo-arrow">${ARROW}</span>
    </div>
    <div class="repo-name">${esc(repo.name)}</div>`
    : `<div class="repo-top">
      <span class="repo-name">${esc(repo.name)}</span>
      <span class="repo-arrow">${ARROW}</span>
    </div>`;

  const attrs = [
    `class="repo-card"`,
    `data-name="${esc(repo.name.toLowerCase())}"`,
    `data-lang="${esc((repo.language || "").toLowerCase())}"`,
    `data-pages="${repo.hasPages ? "1" : "0"}"`,
    `data-topics="${esc((repo.topics || []).join(" ").toLowerCase())}"`
  ].join(" ");

  const inner = `${top}
    <p class="repo-desc">${esc(repo.description || "Sem descrição.")}</p>
    ${badges.length ? `<div class="repo-tags">${badges.join("")}</div>` : ""}
    <div class="repo-meta">${meta.join("")}</div>`;

  // Repositório privado não tem link público — vira card estático.
  return href
    ? `<a ${attrs} href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div ${attrs}>${inner}</div>`;
}

// Escolhe quais repositórios ganham a seção "Projetos em destaque".
// Recebe a lista já ordenada por data de push e devolve um subconjunto dela.
// Array vazio esconde a seção inteira — é o estado atual, a pedido.
//
// Para ligar depois, basta devolver algo. Ex.:
//   por tópico no GitHub:  return repos.filter((r) => r.topics.includes("destaque"));
//   por lista no config:   return repos.filter((r) => (config.featured || []).includes(r.name));
//   os N mais recentes:    return repos.slice(0, 3);
function selectFeatured(repos, config) {
  return [];
}

async function readPosts() {
  const dir = p("content", "posts");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const posts = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const { data, body } = parseFrontMatter(raw);
    const slug = data.slug || file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || (file.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || null,
      summary: data.summary || "",
      html: renderMarkdown(body)
    });
  }
  posts.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return posts;
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(src, dst);
    else await fs.copyFile(src, dst);
  }
}

async function write(rel, content) {
  const file = path.join(OUT, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

async function main() {
  const config = JSON.parse(await fs.readFile(p("site.config.json"), "utf8"));
  const base = await fs.readFile(p("templates", "base.html"), "utf8");
  const profileUrl = `https://github.com/${config.user}`;

  console.log(`Token do GitHub: ${hasToken() ? "presente" : "ausente (apenas dados públicos)"}`);

  let repos = [];
  try {
    repos = await fetchRepos(config);
  } catch (err) {
    console.error("Falha ao buscar repositórios:", err.message);
    // Fallback: reaproveita o último data/repos.json versionado, se existir.
    try {
      repos = JSON.parse(await fs.readFile(p("data", "repos.json"), "utf8")).repos;
      console.warn("Usando data/repos.json anterior como fallback.");
    } catch {
      throw err;
    }
  }

  let readmeHtml = "";
  try {
    const md = await fetchProfileReadme(config);
    if (md) readmeHtml = renderMarkdown(md);
  } catch (err) {
    console.warn("README de perfil não carregado:", err.message);
  }

  const posts = await readPosts();
  const featured = (selectFeatured(repos, config) || []).filter(Boolean);
  const publicCount = repos.filter((r) => r.visibility !== "private").length;

  const navlinks = `<a href="/#repos">Repositórios</a>
  ${posts.length ? '<a href="/notas/">Notas</a>' : ""}
  <a href="/#sobre">Sobre</a>
  <a href="/#contato">Contato</a>`;

  const contactSection = `<section id="contato" class="contact">
  <div class="contact-inner">
    <div class="kicker">Contato</div>
    <h2>${esc(config.contact.heading)}</h2>
    <p>${esc(config.contact.text)}</p>
    <div class="contact-actions">
      <a class="btn btn-primary" href="mailto:${esc(config.email)}">${esc(config.email)}</a>
      <a class="btn btn-secondary" href="${esc(profileUrl)}" target="_blank" rel="noopener">github.com/${esc(config.user)}</a>
      <a class="btn btn-secondary" href="${esc(config.url)}">${esc(config.url.replace(/^https?:\/\//, ""))}</a>
    </div>
  </div>
</section>`;

  const page = (vars) =>
    template(base, {
      lang: config.lang,
      brand: esc(config.name),
      navlinks,
      profileUrl: esc(profileUrl),
      year: String(new Date().getFullYear()),
      updated: new Date().toISOString(),
      updatedLabel: fmtDate(new Date().toISOString(), config.lang),
      ...vars
    });

  // ---------------- home ----------------
  const indexBody = `
<section class="hero">
  <div class="kicker">${esc(config.kicker)}</div>
  <h1>${esc(config.name)}</h1>
  <p class="hero-role">${esc(config.role)}</p>
  <p class="hero-lede">${esc(config.description)}</p>
  <div class="hero-actions">
    <a class="btn btn-primary" href="#repos">Ver projetos</a>
    <a class="btn btn-secondary" href="#contato">Contato</a>
  </div>
</section>

${featured.length
    ? `<section id="projetos" class="section">
  <div class="section-head">
    <div class="kicker">Projetos em destaque</div>
    <span class="section-note">Selecionados manualmente</span>
  </div>
  <div class="repo-grid grid-featured">
${featured.map((r, i) => repoCard(r, { featured: true, index: i })).join("\n")}
  </div>
</section>`
    : ""}

<section id="repos" class="section">
  <div class="section-head">
    <div class="kicker">Todos os repositórios</div>
    <span class="section-note">${publicCount} ${publicCount === 1 ? "público" : "públicos"} · atualizado do GitHub</span>
  </div>
  <div class="filters" style="margin-bottom:20px;">
    <input type="search" id="q" class="input" placeholder="filtrar por nome, tópico…" aria-label="Filtrar repositórios">
    <select id="lang" class="input" aria-label="Filtrar por linguagem">
      <option value="">todas as linguagens</option>
      ${[...new Set(repos.map((r) => r.language).filter(Boolean))]
        .sort()
        .map((l) => `<option value="${esc(l.toLowerCase())}">${esc(l)}</option>`)
        .join("")}
    </select>
    <label class="check"><input type="checkbox" id="only-pages"> só com page</label>
  </div>
  <div class="repo-grid" id="repo-grid">
${repos.map((r) => repoCard(r)).join("\n")}
  </div>
  <p class="empty" id="no-results" hidden>Nenhum repositório corresponde ao filtro.</p>
</section>

${posts.length
    ? `<hr class="hr">
<section id="notas" class="section">
  <div class="section-head">
    <div class="kicker">Notas</div>
    <a class="section-note" href="/notas/">ver todas</a>
  </div>
  <ul class="post-list">
    ${posts
      .slice(0, 5)
      .map(
        (post) =>
          `<li><a href="/notas/${esc(post.slug)}/">${esc(post.title)}</a><span class="when">${esc(fmtDate(post.date, config.lang))}</span></li>`
      )
      .join("")}
  </ul>
</section>`
    : ""}

<hr class="hr">

<section id="sobre" class="section">
  <div class="about-grid">
    <div>
      <div class="kicker">Sobre</div>
      <h2>${esc(config.about.heading)}</h2>
    </div>
    <div>
      ${readmeHtml ? `<div class="prose">${readmeHtml}</div>` : `<p class="about-text">${esc(config.about.text)}</p>`}
    </div>
  </div>
</section>

<section id="stack" class="section" style="padding-top:0;">
  <div class="kicker" style="margin-bottom:22px;">Stack</div>
  <div class="stack-list">
    ${(config.skills || []).map((s) => `<span class="tag tag-neutral">${esc(s)}</span>`).join("")}
  </div>
</section>

${contactSection}
`;

  await write(
    "index.html",
    page({
      title: `${esc(config.name)} — ${esc(config.role)}`,
      description: esc(config.description),
      canonical: esc(config.url),
      body: indexBody
    })
  );

  // ---------------- notas ----------------
  if (posts.length) {
    await write(
      "notas/index.html",
      page({
        title: `Notas · ${esc(config.name)}`,
        description: "Notas e anotações técnicas.",
        canonical: `${esc(config.url)}/notas/`,
        body: `<section class="section" style="padding-top:clamp(40px,7vw,80px);">
  <div class="kicker" style="margin-bottom:26px;">Notas</div>
  <ul class="post-list">
    ${posts
      .map(
        (post) =>
          `<li><a href="/notas/${esc(post.slug)}/">${esc(post.title)}</a><span class="when">${esc(fmtDate(post.date, config.lang))}</span></li>`
      )
      .join("")}
  </ul>
</section>`
      })
    );

    for (const post of posts) {
      await write(
        `notas/${post.slug}/index.html`,
        page({
          title: `${esc(post.title)} · ${esc(config.name)}`,
          description: esc(post.summary),
          canonical: `${esc(config.url)}/notas/${esc(post.slug)}/`,
          body: `<article class="section prose" style="padding-top:clamp(40px,7vw,80px);">
  <header class="post-head">
    <h1>${esc(post.title)}</h1>
    <p class="when">${esc(fmtDate(post.date, config.lang))}</p>
  </header>
  ${post.html}
  <p class="back"><a href="/notas/">← todas as notas</a></p>
</article>`
        })
      );
    }
  }

  // ---------------- assets, dados e metadados ----------------
  await copyDir(p("assets"), path.join(OUT, "assets"));

  // static/ vai para a raiz do site, sem processamento (sw.js, CNAME, etc).
  try {
    await copyDir(p("static"), OUT);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const payload = { generatedAt: new Date().toISOString(), user: config.user, repos };

  // A cópia publicada leva sempre o carimbo de tempo do build.
  await write("data/repos.json", JSON.stringify(payload, null, 2));

  // Já o snapshot versionado (fallback caso a API do GitHub falhe) só é
  // reescrito quando a lista de repositórios muda de verdade. Reescrevê-lo a
  // cada build só para atualizar `generatedAt` sujaria o working tree sem
  // nenhuma diferença de conteúdo.
  const snapshot = p("data", "repos.json");
  let anterior = null;
  try {
    anterior = JSON.parse(await fs.readFile(snapshot, "utf8"));
  } catch {
    // Sem snapshot ainda — será criado abaixo.
  }
  const mudou = !anterior || JSON.stringify(anterior.repos) !== JSON.stringify(repos);
  if (mudou) {
    await fs.mkdir(p("data"), { recursive: true });
    await fs.writeFile(snapshot, JSON.stringify(payload, null, 2), "utf8");
    console.log("snapshot data/repos.json atualizado (a lista de repositórios mudou)");
  }
  await write(".nojekyll", "");

  const urls = ["/", ...(posts.length ? ["/notas/", ...posts.map((post) => `/notas/${post.slug}/`)] : [])];
  await write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${config.url}${u}</loc></url>`).join("\n")}
</urlset>
`
  );
  await write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);

  console.log(
    `OK: ${repos.length} repositórios (${featured.length} em destaque), ${posts.length} notas -> dist/`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
