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

## Passo 2 — Ajustar o _config.yml (que já veio no starter)

Edite os valores abaixo no `_config.yml` do novo repositório:

```yaml
lang: pt-BR
timezone: America/Sao_Paulo

title: TGF231
tagline: Automações e dados        # curto de propósito, pra caber na sidebar
description: >-
  Automações e ferramentas de dados — Python, SQL e integrações para sistemas legados.

url: "https://TGF231.github.io"

github:
  username: TGF231

social:
  name: TGF231
  links:
    - https://github.com/TGF231

# foto de perfil: usa seu próprio avatar do GitHub (URL sempre válida)
avatar: https://github.com/TGF231.png

theme_mode: dark
```

Não mexa nas seções de `collections`, `defaults`, `plugins` etc. — o starter
já traz tudo configurado corretamente.

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
