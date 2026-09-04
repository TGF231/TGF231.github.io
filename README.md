# Pacote de customização TGF231 para o Chirpy Starter

Estes arquivos são só as SUAS customizações — para colar por cima de um repositório
criado a partir do **chirpy-starter** oficial (que já traz todo o resto funcionando).

## Por que recomeçar do starter?

Instalar o Chirpy só pelo gem faz o Jekyll ler apenas parte do tema (`_includes`,
`_layouts`, `_sass`, `assets`). A estrutura que dá o visual completo (`_data`,
`_plugins`, assets compilados, favicons) não é carregada — por isso a montagem
manual fica com metade do estilo. O starter já empacota tudo isso.

## Passo 1 — Criar o repositório a partir do starter

1. Acesse https://github.com/cotes2020/chirpy-starter
2. Clique em **Use this template → Create a new repository**.
3. Nomeie o repositório como `TGF231.github.io` (tudo minúsculo no username).
4. Em **Settings → Pages**, deixe o Source em **GitHub Actions**.

## Passo 2 — Substituir o _config.yml

Este pacote já traz um `_config.yml` COMPLETO, baseado no arquivo oficial do
Chirpy (todos os blocos obrigatórios: analytics, pageviews, pwa, kramdown, sass,
collections, defaults, jekyll-archives etc.), com os seus valores já preenchidos:
título, tagline curto, url, avatar (seu próprio avatar do GitHub), idioma pt-BR
e timezone.

Basta substituir o `_config.yml` que veio do starter por este.

Se quiser, revise depois o `email:` em `social:` e o `twitter.username`
(deixei os placeholders). Não são obrigatórios pro site funcionar.

## Passo 3 — Colar os arquivos deste pacote

Copie para o repositório, nos mesmos caminhos:

- `_tabs/projects.md`            → cria a aba "Projetos"
- `_includes/repo-ledger.html`   → a listagem automática de repositórios
- `assets/css/jekyll-theme-chirpy.scss` → estilos da listagem + ajuste da sidebar

O starter já tem `_tabs/about.md`; edite o texto dele se quiser.

## Passo 4 — Publicar

Faça commit/push. A Action do starter builda e publica sozinha.
Acompanhe em **Actions**; quando ficar verde, o site estará no ar com o visual
completo do Chirpy.

## Manutenção

- **Adicionar repositório privado com Pages:** edite `TGF_MANUAL_ENTRIES` em
  `_includes/repo-ledger.html`.
- **Ocultar um repositório:** adicione o nome em `TGF_EXCLUDE` no mesmo arquivo.
- **Novo post:** crie `_posts/AAAA-MM-DD-titulo.md` com o front matter padrão do Chirpy.
