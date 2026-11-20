# TGF231.github.io

Site pessoal em HTML/CSS/JS puro — **sem Jekyll, sem framework, sem build tool**.
Um script Node sem dependências busca os dados no GitHub, renderiza os templates e
o GitHub Actions publica o resultado no Pages.

## Estrutura

```
site.config.json        toda a configuração (textos, ordem dos projetos, downloads, botão Entrar)
templates/base.html     o esqueleto de todas as páginas: topo flutuante e rodapé
assets/css/site.css     o visual, com base no Atlassian Design System (claro e escuro); a cor principal é --cor (#7D0E0E)
assets/js/app.js        troca de tema claro e escuro
content/posts/*.md      notas (Markdown com front matter)
static/                 arquivos copiados crus para a raiz do site (sw.js)
scripts/build.mjs       o build: dados + templates -> dist/
scripts/github.mjs      coleta na API do GitHub
scripts/markdown.mjs    renderizador Markdown mínimo
data/repos.json         último snapshot dos repositórios (fallback se a API falhar)
dist/                   saída do build (não versionada)
```

## Páginas

- **`/`**: hub de uma tela, sem rolar. Um cartão por projeto (ordem em
  `projetos.ordem`, o primeiro em destaque), mais Downloads, Notas e uma faixa de
  Contato. Privados entram por `projetos.manuais`, com o texto de `projetos.textos`.
- **`/downloads/`**: um bloco por repositório de `downloads.repos` que tenha release
  publicado, sempre o mais recente (rascunho e pré-lançamento ficam de fora). Os
  nomes dos arquivos viram rótulos por `downloads.rotulos`; `downloads.ocultar` tira
  somas, licenças e AAB. Repositório privado não entra: o arquivo exigiria login.
- **Entrar** (canto superior direito): leva a `central.url`, o painel do NodeMCU.

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
