# TGF231.github.io

Site pessoal em HTML/CSS/JS puro — **sem Jekyll, sem framework, sem build tool**.
Um script Node sem dependências busca os dados no GitHub, renderiza os templates e
o GitHub Actions publica o resultado no Pages.

## Estrutura

```
site.config.json        toda a configuração (usuário, textos, filtros, privados)
templates/base.html     o esqueleto HTML de todas as páginas
assets/css/style.css    o visual inteiro — trocar tema = trocar as variáveis do :root
assets/js/app.js        filtro da grade de repositórios
content/posts/*.md      notas (Markdown com front matter)
scripts/build.mjs       o build: dados + templates -> dist/
scripts/github.mjs      coleta na API do GitHub
scripts/markdown.mjs    renderizador Markdown mínimo
data/repos.json         último snapshot dos repositórios (fallback se a API falhar)
dist/                   saída do build (não versionada)
```

## Como o site se atualiza sozinho

O workflow `.github/workflows/deploy.yml` roda o build:

- a cada push na `main`;
- **todo dia às 06:00 UTC** (`schedule`) — é isso que faz repositório novo,
  descrição alterada ou Page recém-publicada aparecerem sem você fazer nada;
- manualmente pela aba **Actions**;
- por `repository_dispatch`, se você quiser que outro repositório dispare
  um rebuild ao publicar a própria Page:

```bash
gh api repos/TGF231/TGF231.github.io/dispatches -f event_type=refresh
```

## Configuração inicial (uma vez)

1. **Settings → Pages → Source: GitHub Actions.**
2. Opcional, para incluir repositórios **privados**: crie um Personal Access Token
   (fine-grained, permissão *Repository → Metadata: read-only* nos repos desejados)
   e salve em **Settings → Secrets and variables → Actions** como `GH_PAT`.
   Sem esse secret o build simplesmente ignora os privados.

## Privacidade dos repositórios privados

Repositório privado **nunca** entra por acidente. Ele só aparece se:

- o nome estiver em `private.allow` no `site.config.json`, **e**
- o secret `GH_PAT` existir na Action.

E mesmo assim, só os campos listados em `private.fields` são publicados —
o resto (URL do código, estrelas, tópicos) é descartado no build.

## Rodar localmente

Precisa de Node 20+:

```bash
node scripts/build.mjs && npx serve dist
```

Sem token, o build usa apenas os dados públicos — suficiente para conferir o layout.
