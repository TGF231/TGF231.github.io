// Coleta de dados do GitHub. Sem dependências: usa fetch nativo do Node 20+.
//
// Tudo que o site mostra vem daqui — nada de listas de projetos escritas à mão.
// O que manda é a própria página do repositório no GitHub:
//
//   topic "site"      o repositório vira um bloco de projeto (sem ele, fica fora)
//   topic "destaque"  sobe para o começo da página
//   description       o texto do bloco
//   homepage          endereço do aplicativo (quando não for a própria Page)
//
// Assim, renomear um repositório, abrir um que era privado ou publicar um
// release novo aparece no site sozinho, no build seguinte.
const API = "https://api.github.com";

export const TOPIC_SITE = "site";
export const TOPIC_DESTAQUE = "destaque";

function headers() {
  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tgf231-site-builder"
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export const hasToken = () => Boolean(process.env.GH_PAT || process.env.GITHUB_TOKEN);

async function api(path, { optional = false } = {}) {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (!res.ok) {
    if (optional && (res.status === 404 || res.status === 403)) return null;
    throw new Error(`GitHub ${res.status} em ${path}: ${await res.text()}`);
  }
  return res.json();
}

// Todos os repositórios públicos do usuário, do push mais recente para o mais antigo.
async function listarRepos(user) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await api(`/users/${user}/repos?per_page=100&sort=updated&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function pagesUrl(repo, user) {
  if (!repo.has_pages) return null;
  return `https://${user.toLowerCase()}.github.io/${repo.name}/`;
}

// Documentação por convenção: o repositório "<nome>-docs" com Page publicada.
// Evita guardar o endereço da documentação em arquivo, que envelhece.
function docsUrl(repo, todos, user) {
  const alvo = `${repo.name.toLowerCase().replace(/_/g, "-")}-docs`;
  const docs = todos.find((d) => d.name.toLowerCase() === alvo && d.has_pages);
  return docs ? pagesUrl(docs, user) : null;
}

function normalize(repo, todos, user) {
  const pages = pagesUrl(repo, user);
  return {
    name: repo.name,
    description: repo.description || "",
    language: repo.language || null,
    topics: repo.topics || [],
    destaque: (repo.topics || []).includes(TOPIC_DESTAQUE),
    stars: repo.stargazers_count ?? 0,
    archived: Boolean(repo.archived),
    updatedAt: repo.pushed_at || repo.updated_at,
    url: repo.html_url,
    // homepage apontando para fora da Page significa "este é o aplicativo".
    homepage: repo.homepage || null,
    hasPages: Boolean(repo.has_pages),
    pagesUrl: pages,
    docsUrl: docsUrl(repo, todos, user)
  };
}

// Os repositórios que viram projeto: públicos, com o topic "site".
// Em destaque primeiro; dentro de cada grupo, o de push mais recente lidera.
export async function fetchRepos(config) {
  const user = config.user;
  const todos = await listarRepos(user);

  const repos = todos
    .filter((r) => (r.topics || []).includes(TOPIC_SITE))
    .filter((r) => (config.repos?.includeForks ? true : !r.fork))
    .filter((r) => (config.repos?.includeArchived ? true : !r.archived))
    .map((r) => normalize(r, todos, user))
    .sort(
      (a, b) =>
        Number(b.destaque) - Number(a.destaque) ||
        new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    );

  if (!repos.length) {
    console.warn(
      `aviso: nenhum repositório público com o topic "${TOPIC_SITE}" — a página de projetos sai vazia.`
    );
  }
  return repos;
}

// Último release publicado (sem rascunho nem pré-lançamento) de cada projeto.
// Recebe a lista já filtrada: downloads e projetos seguem a mesma regra.
export async function fetchReleases(repos, config) {
  const out = [];
  for (const { name } of repos) {
    const r = await api(`/repos/${config.user}/${name}/releases/latest`, { optional: true });
    if (!r) continue; // sem release publicado: não é erro, só não há o que baixar
    out.push({
      repo: name,
      tag: r.tag_name,
      nome: r.name || r.tag_name,
      publicadoEm: r.published_at,
      pagina: r.html_url,
      arquivos: (r.assets || []).map((a) => ({ nome: a.name, tamanho: a.size, url: a.browser_download_url }))
    });
  }
  return out;
}

export async function fetchProfileReadme(config) {
  if (!config.profileReadme?.enabled) return null;
  const repo = config.profileReadme.repo || config.user;
  const data = await api(`/repos/${config.user}/${repo}/readme`, { optional: true });
  if (!data?.content) return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}
