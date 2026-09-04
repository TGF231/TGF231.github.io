// Coleta de dados do GitHub. Sem dependências: usa fetch nativo do Node 20+.
const API = "https://api.github.com";

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

function pagesUrl(repo, user) {
  if (!repo.has_pages) return null;
  return `https://${user.toLowerCase()}.github.io/${repo.name}/`;
}

function normalize(repo, user, { visibility }) {
  return {
    name: repo.name,
    description: repo.description || "",
    language: repo.language || null,
    topics: repo.topics || [],
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    isFork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    updatedAt: repo.pushed_at || repo.updated_at,
    createdAt: repo.created_at,
    url: visibility === "private" ? null : repo.html_url,
    homepage: repo.homepage || null,
    hasPages: Boolean(repo.has_pages),
    pagesUrl: pagesUrl(repo, user),
    visibility
  };
}

// Mantém apenas os campos que o site.config.json autoriza expor para privados.
function redact(repo, fields) {
  const out = { name: repo.name, visibility: "private", hasPages: repo.hasPages, topics: [] };
  for (const f of fields) if (repo[f] !== undefined) out[f] = repo[f];
  return out;
}

export async function fetchRepos(config) {
  const user = config.user;
  const exclude = new Set(config.repos.exclude || []);
  const all = [];

  for (let page = 1; page <= 5; page++) {
    const batch = await api(`/users/${user}/repos?per_page=100&sort=updated&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }

  let repos = all
    .filter((r) => !exclude.has(r.name))
    .filter((r) => (config.repos.includeForks ? true : !r.fork))
    .filter((r) => (config.repos.includeArchived ? true : !r.archived))
    .map((r) => normalize(r, user, { visibility: "public" }));

  // Privados: só os explicitamente autorizados, e só com token disponível.
  const allow = config.private?.allow || [];
  const privateRepos = [];
  if (allow.length && hasToken()) {
    for (const name of allow) {
      if (exclude.has(name)) continue;
      const raw = await api(`/repos/${user}/${name}`, { optional: true });
      if (!raw) {
        console.warn(`aviso: repositório privado "${name}" não acessível com o token atual — ignorado.`);
        continue;
      }
      privateRepos.push(redact(normalize(raw, user, { visibility: "private" }), config.private.fields || []));
    }
  } else if (allow.length) {
    console.warn("aviso: sem GH_PAT/GITHUB_TOKEN — repositórios privados não foram consultados.");
  }

  const seen = new Set(repos.map((r) => r.name));
  repos = [...repos, ...privateRepos.filter((r) => !seen.has(r.name))];
  repos.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return repos;
}

export async function fetchProfileReadme(config) {
  if (!config.profileReadme?.enabled) return null;
  const repo = config.profileReadme.repo || config.user;
  const data = await api(`/repos/${config.user}/${repo}/readme`, { optional: true });
  if (!data?.content) return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}
