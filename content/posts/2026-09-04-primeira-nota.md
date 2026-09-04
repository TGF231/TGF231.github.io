---
title: Como este site é montado
date: 2026-09-04
summary: Um build em Node puro que lê a API do GitHub e cospe HTML estático.
tags: [meta, github-actions]
---

Este site não usa framework nenhum. O build inteiro é um script Node sem
dependências (`scripts/build.mjs`) que faz três coisas:

1. Consulta a API do GitHub e monta a lista de repositórios.
2. Renderiza os templates de `templates/` com os dados coletados.
3. Escreve tudo em `dist/`, que a Action publica no GitHub Pages.

Para escrever uma nota nova, basta criar um arquivo em `content/posts/`
com front matter e commitar.

```bash
node scripts/build.mjs
```
