// Build do site estático. Node 20+, zero dependências.
// Uso: node scripts/build.mjs   (saída em dist/)
//
// Visual em vidro (assets/css/site.css), com tema claro e escuro e a cor principal #7D0E0E.
// A página inicial é uma sequência de etapas de tela cheia: herói, índice em blocos,
// uma etapa por projeto, notas, sobre e contato, com contador e menu de etapas no topo. Repositórios e
// releases são buscados no build e viram HTML; o build roda todo dia.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRepos, fetchProfileReadme, fetchReleases, hasToken } from "./github.mjs";
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

// Ícones Lucide (MIT), traço 1,5 e currentColor. Sempre com rótulo ao lado.
const ICONES = {
  baixo: '<path d="m6 9 6 6 6-6"/>',
  cima: '<path d="m18 15-6-6-6 6"/>',
  abrir: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  entrar: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  lista: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  codigo: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  email: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  livro: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  lua: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  notas: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
};
const icone = (nome, tam = 16) =>
  `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;

const dois = (n) => String(n).padStart(2, "0");

function template(tpl, vars) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
}

// Tamanho de arquivo no formato brasileiro, sempre com unidade: "3,3 MB".
function tamanho(bytes) {
  const mb = bytes / 1048576;
  if (mb >= 1) return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
}

// Projetos na ordem do site.config.json; os que não estão na lista vêm depois, pelo último push.
function ordenarProjetos(repos, config) {
  const ordem = config.projetos?.ordem || [];
  const pos = (r) => (ordem.includes(r.name) ? ordem.indexOf(r.name) : ordem.length);
  return [...repos].sort((a, b) => pos(a) - pos(b) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

// O que vem do GitHub, com os textos do site.config.json por cima.
function projeto(repo, config, releases) {
  const t = config.projetos?.textos?.[repo.name] || {};
  return {
    id: repo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    repo: repo.name,
    titulo: t.titulo || repo.name.replace(/_/g, " "),
    descricao: t.descricao || repo.description || "",
    linguagem: repo.language,
    atualizado: repo.updatedAt,
    app: repo.pagesUrl || repo.homepage || null,
    rotuloApp: t.abrir || "Abrir página",
    abrirDireto: Boolean(t.abrirDireto && (repo.pagesUrl || repo.homepage)),
    codigo: repo.url,
    documentacao: t.documentacao || null,
    release: releases.find((r) => r.repo === repo.name) || null
  };
}

// Um bloco do índice. O MeUsMe (abrirDireto) abre o aplicativo; os outros levam à própria etapa.
function bloco({ num, nome, texto, href, rotulo, iconeNome, externo = false }) {
  return `<a class="bloco" href="${esc(href)}"${externo ? ' target="_blank" rel="noopener"' : ""}>
      <span class="bloco__num mono">${num}</span>
      <span class="bloco__nome">${esc(nome)}</span>
      ${texto ? `<span class="bloco__texto">${esc(texto)}</span>` : ""}
      <span class="bloco__pe"><span>${esc(rotulo)}</span>${icone(iconeNome)}</span>
    </a>`;
}

// Uma etapa de tela cheia. A barra de título mostra o nome dela enquanto estiver na tela.
function etapa({ id, num, marca, titulo, html, classe = "" }) {
  return `<section class="etapa${classe ? " " + classe : ""}" id="${id}" data-titulo="${esc(titulo)}" aria-labelledby="${id}-titulo">
  <div class="etapa__corpo">
    <p class="chip etapa__marca"><span class="mono">${num}</span> · ${esc(marca)}</p>
${html}
  </div>
</section>`;
}

function botao(href, texto, iconeNome, externo = true) {
  return `<a class="botao" href="${esc(href)}"${externo ? ' target="_blank" rel="noopener"' : ""}>${icone(iconeNome)}<span>${esc(texto)}</span></a>`;
}

// Arquivos de um release: rótulo legível pelo fim do nome, os de apoio (somas, licenças, AAB) ficam de fora.
function arquivosDoRelease(release, config) {
  const ocultar = config.downloads?.ocultar || [];
  const rotulos = Object.entries(config.downloads?.rotulos || {});
  return release.arquivos
    .filter((a) => !ocultar.some((o) => a.nome.endsWith(o)))
    .map((a) => ({ ...a, rotulo: (rotulos.find(([fim]) => a.nome.endsWith(fim)) || [null, a.nome])[1] }));
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

  let releases = [];
  try {
    releases = await fetchReleases(config);
  } catch (err) {
    console.warn("Releases não carregados:", err.message);
  }

  const posts = await readPosts();
  const projetos = ordenarProjetos(repos, config).map((r) => projeto(r, config, releases));
  const hoje = fmtDate(new Date().toISOString(), config.lang);
  const central = config.central || {};

  const page = ({ contexto, marca = "", menu = "", acao = "", body, ...vars }) =>
    template(base, {
      lang: config.lang,
      brand: esc(config.name),
      contexto: esc(contexto),
      marca,
      menu,
      acao,
      body,
      centralUrl: esc(central.url || `https://github.com/${config.user}`),
      centralRotulo: esc(central.rotulo || "Entrar"),
      iconeEntrar: icone("entrar", 14),
      iconeSol: icone("sol", 16),
      iconeLua: icone("lua", 16),
      rodapeEstado: `Atualizado do GitHub em ${esc(hoje)}`,
      rodapeContagem: `${projetos.length} ${projetos.length === 1 ? "projeto" : "projetos"} · ${releases.length} ${releases.length === 1 ? "download" : "downloads"}`,
      year: String(new Date().getFullYear()),
      ...vars
    });

  // ---------------- home: etapas ----------------
  const etapas = [];

  // Os blocos do índice são montados depois, quando todas as etapas existem.
  etapas.push({ id: "inicio", titulo: "Início", marca: config.kicker, html: null });

  for (const p of projetos) {
    const ficha = [p.linguagem, p.atualizado && `atualizado ${relTime(p.atualizado)}`, p.release && `versão ${p.release.tag}`]
      .filter(Boolean)
      .map(esc)
      .join(" · ");
    const acoes = [
      p.app && botao(p.app, p.rotuloApp, "abrir"),
      p.release && botao(`/downloads/#${p.id}`, `Baixar ${p.release.tag}`, "baixar", false),
      p.documentacao && botao(p.documentacao, "Documentação", "livro"),
      p.codigo && botao(p.codigo, "Ver código", "codigo")
    ].filter(Boolean);
    etapas.push({
      id: p.id,
      titulo: p.titulo,
      marca: "Projeto",
      projeto: p,
      html: `    <h2 class="titulo" id="${p.id}-titulo">${esc(p.titulo)}</h2>
    ${p.descricao ? `<p class="etapa__texto">${esc(p.descricao)}</p>` : ""}
    ${ficha ? `<p class="meta">${ficha}</p>` : ""}
    ${acoes.length ? `<div class="etapa__acoes">${acoes.join("")}</div>` : ""}`
    });
  }

  if (posts.length) {
    etapas.push({
      id: "notas",
      titulo: "Notas",
      marca: "Notas",
      html: `    <h2 class="titulo" id="notas-titulo">Anotações técnicas</h2>
    <ul class="lista-notas">
      ${posts
        .slice(0, 5)
        .map((post) => `<li><a href="/notas/${esc(post.slug)}/">${esc(post.title)}</a><span class="mono">${esc(fmtDate(post.date, config.lang))}</span></li>`)
        .join("")}
    </ul>
    <div class="etapa__acoes">${botao("/notas/", "Todas as notas", "notas", false)}</div>`
    });
  }

  etapas.push({
    id: "sobre",
    titulo: "Sobre",
    marca: "Sobre",
    html: `    <h2 class="titulo" id="sobre-titulo">${esc(config.about.heading)}</h2>
    ${readmeHtml ? `<div class="prose">${readmeHtml}</div>` : `<p class="etapa__texto">${esc(config.about.text)}</p>`}
    <div class="etiquetas">${(config.skills || []).map((s) => `<span class="etiqueta">${esc(s)}</span>`).join("")}</div>`
  });

  etapas.push({
    id: "contato",
    titulo: "Contato",
    marca: "Contato",
    html: `    <h2 class="titulo" id="contato-titulo">${esc(config.contact.heading)}</h2>
    <p class="etapa__texto">${esc(config.contact.text)}</p>
    <div class="etapa__acoes">
      ${botao(`mailto:${config.email}`, config.email, "email", false)}
      ${botao(profileUrl, `github.com/${config.user}`, "codigo")}
    </div>`
  });

  // Índice logo depois do herói: um bloco por etapa (o MeUsMe abre o aplicativo direto).
  etapas.splice(1, 0, { id: "indice", titulo: "Índice", marca: "Boas-vindas", html: null });
  etapas.forEach((e, i) => (e.num = dois(i)));
  const ultima = dois(etapas.length - 1);

  const blocos = etapas
    .slice(2)
    .map((e) =>
      e.projeto?.abrirDireto
        ? bloco({ num: e.num, nome: e.titulo, texto: e.projeto.descricao, href: e.projeto.app, rotulo: e.projeto.rotuloApp, iconeNome: "abrir", externo: true })
        : bloco({ num: e.num, nome: e.titulo, texto: e.projeto?.descricao, href: `#${e.id}`, rotulo: "Ver", iconeNome: "baixo" })
    );
  if (releases.length) {
    blocos.push(
      bloco({ num: "DL", nome: "Downloads", texto: "Instaladores e versões mais recentes de cada programa.", href: "/downloads/", rotulo: "Abrir downloads", iconeNome: "baixar" })
    );
  }

  // Herói: nome grande com o ponto na cor principal e uma faixa com as linguagens.
  const [primeiro, ...resto] = config.name.split(" ");
  const faixa = (config.skills || []).map(esc).join('<span class="faixa__sep">/</span>');
  etapas[0].classe = "etapa--heroi";
  etapas[0].html = `    <h1 class="titulo titulo--heroi" id="inicio-titulo">${esc(primeiro)}${resto.length ? `<br>${esc(resto.join(" "))}` : ""}<span class="ponto">.</span></h1>
    <p class="etapa__papel">${esc(config.role)}</p>
    <p class="etapa__texto">${esc(config.description)}</p>
    <div class="etapa__acoes">
      <a class="botao botao--primario" href="#indice">${icone("baixo")}<span>Começar</span></a>
      ${releases.length ? botao("/downloads/", "Downloads", "baixar", false) : ""}
    </div>
    <div class="faixa" aria-hidden="true"><div class="faixa__trilho"><span>${faixa}<span class="faixa__sep">/</span></span><span>${faixa}<span class="faixa__sep">/</span></span></div></div>`;
  etapas[1].html = `    <h2 class="titulo" id="indice-titulo">O que tem por aqui</h2>
    <div class="blocos">
    ${blocos.join("\n    ")}
    </div>`;

  const menuEtapas = `<div class="etapas-menu">
    <button type="button" class="pilula" id="etapas-botao" aria-haspopup="menu" aria-expanded="false" aria-controls="etapas-lista">${icone("lista", 14)}<span>Etapas</span></button>
    <div class="menu etapas-menu__lista" id="etapas-lista" role="menu" hidden>
      ${etapas.map((e) => `<a class="menu__item" role="menuitem" href="#${e.id}"><span>${esc(e.titulo)}</span><span class="menu__num mono">${e.num}</span></a>`).join("\n      ")}
      ${releases.length ? `<div class="menu__sep" role="separator"></div>
      <a class="menu__item" role="menuitem" href="/downloads/"><span>Downloads</span><span class="menu__num mono">${releases.length} ${releases.length === 1 ? "programa" : "programas"}</span></a>` : ""}
    </div>
  </div>`;

  await write(
    "index.html",
    page({
      title: `${esc(config.name)} · ${esc(config.role)}`,
      description: esc(config.description),
      canonical: esc(config.url),
      contexto: "Início",
      marca: `<span class="pilula pilula--info mono" id="contador">00 / ${ultima}</span>`,
      menu: menuEtapas,
      acao: `<button type="button" class="acao botao botao--primario" id="proxima">${icone("baixo", 20)}<span>Próxima etapa</span></button>`,
      body: etapas.map(etapa).join("\n\n")
    })
  );

  // ---------------- downloads ----------------
  if (releases.length) {
    const ordem = projetos.map((p) => p.repo);
    const posicao = (r) => (ordem.includes(r.repo) ? ordem.indexOf(r.repo) : ordem.length);
    const lista = [...releases].sort((a, b) => posicao(a) - posicao(b));
    const blocosDownload = lista.map((r, i) => {
      const p = projetos.find((x) => x.repo === r.repo);
      const id = p?.id || r.repo.toLowerCase();
      const arquivos = arquivosDoRelease(r, config);
      return `<section class="bloco bloco--download" id="${id}" aria-labelledby="${id}-titulo">
      <span class="bloco__num mono">${dois(i + 1)}</span>
      <h2 class="bloco__nome" id="${id}-titulo">${esc(p?.titulo || r.repo)}</h2>
      <span class="meta">Versão <span class="mono">${esc(r.tag)}</span> · publicada em ${esc(fmtDate(r.publicadoEm, config.lang))}</span>
      <div class="arquivos">
        ${arquivos
          .map((a) => `<a class="botao arquivo" href="${esc(a.url)}" download>${icone("baixar")}<span class="arquivo__rotulo">${esc(a.rotulo)}</span><span class="arquivo__tamanho mono">${tamanho(a.tamanho)}</span></a>`)
          .join("\n        ")}
      </div>
      <span class="bloco__pe"><a href="${esc(r.pagina)}" target="_blank" rel="noopener">Notas da versão ${esc(r.tag)}</a></span>
    </section>`;
    });
    await write(
      "downloads/index.html",
      page({
        title: `Downloads · ${esc(config.name)}`,
        description: "Instaladores e versões mais recentes de cada programa.",
        canonical: `${esc(config.url)}/downloads/`,
        contexto: "Downloads",
        marca: `<span class="pilula pilula--info mono">${lista.length} ${lista.length === 1 ? "programa" : "programas"}</span>`,
        body: `<section class="etapa etapa--livre" aria-labelledby="downloads-titulo">
  <div class="etapa__corpo">
    <p class="chip etapa__marca"><a href="/">Início</a> · Downloads</p>
    <h1 class="titulo" id="downloads-titulo">Versões mais recentes</h1>
    <p class="etapa__texto">Cada bloco aponta para o último release publicado no GitHub de cada programa. A lista é conferida todo dia.</p>
    <div class="blocos blocos--downloads">
    ${blocosDownload.join("\n    ")}
    </div>
  </div>
</section>`
      })
    );
  }

  // ---------------- notas ----------------
  if (posts.length) {
    const listaNotas = `<ul class="lista-notas">
    ${posts.map((post) => `<li><a href="/notas/${esc(post.slug)}/">${esc(post.title)}</a><span class="mono">${esc(fmtDate(post.date, config.lang))}</span></li>`).join("")}
  </ul>`;
    await write(
      "notas/index.html",
      page({
        title: `Notas · ${esc(config.name)}`,
        description: "Notas e anotações técnicas.",
        canonical: `${esc(config.url)}/notas/`,
        contexto: "Notas",
        body: `<section class="etapa etapa--livre" aria-labelledby="notas-titulo">
  <div class="etapa__corpo">
    <p class="chip etapa__marca"><a href="/">Início</a> · Notas</p>
    <h1 class="titulo" id="notas-titulo">Anotações técnicas</h1>
    ${listaNotas}
  </div>
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
          contexto: post.title,
          body: `<article class="etapa etapa--livre" aria-labelledby="nota-titulo">
  <div class="etapa__corpo prose">
    <p class="chip etapa__marca"><a href="/notas/">Notas</a> · <span class="mono">${esc(fmtDate(post.date, config.lang))}</span></p>
    <h1 class="titulo" id="nota-titulo">${esc(post.title)}</h1>
    ${post.html}
  </div>
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

  const urls = ["/", ...(releases.length ? ["/downloads/"] : []), ...(posts.length ? ["/notas/", ...posts.map((post) => `/notas/${post.slug}/`)] : [])];
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
    `OK: ${projetos.length} projetos, ${releases.length} downloads, ${posts.length} notas -> dist/`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
