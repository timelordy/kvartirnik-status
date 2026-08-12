# Kvartirnik · project status

Last published snapshot: https://timelordy.github.io/kvartirnik-status/

This repository stores a curated static artifact in `site/`. GitHub Actions are disabled, so pushing `main` does not run CI or update GitHub Pages.

Run the checks locally from this repository:

```powershell
node scripts/verify-public-site.mjs site
node scripts/verify-design-system.mjs
python -m http.server 4178 --directory site
```

Then inspect `http://127.0.0.1:4178/` in a browser. Publication is manual: replace `site/`, run both verifiers, review the Git diff, and push `main`.

## Design system

The visual layer comes from `@cab234/design-system`, тег v1.0.0. This is a static artifact with no bundler, so it cannot resolve a package specifier: `site/design-system/` holds vendored copies and `site/design-system/VENDOR.json` records their upstream hashes.

Since 1.0 the system ships two files instead of one, and both are vendored:

- `tokens.css` — только значения. Импорт токенов больше не имеет права красить страницу.
- `base.css` — page defaults и режимы доступности (`prefers-reduced-motion`, `prefers-reduced-transparency`, `forced-colors`). До 1.0 всё это лежало в `tokens.css`.

Обе копии вкомпилированы в бандлы страниц (`program-flow/*-html.<hash>.css`) — именно их грузят страницы. Файлы в `site/design-system/` это эталон, по которому сверяется хеш.

⚠️ Бандлы собираются из приватного репозитория `kvartirnik`. Там тоже нужно поднять версию системы, иначе следующая публикация вернёт токены 0.x.

`site/program-flow/kvartirnik-cabinet-theme.css` is the only file allowed to declare brand values. It does two things and nothing else:

1. overrides the four accent tokens — that is what the kvartirnik theme *is*;
2. maps every local name used by the other 37 stylesheets (`--ink`, `--r-md`, `--fs-micro`, `--shadow-card`, …) onto a design-system token.

`verify-design-system.mjs` fails if the vendored copy drifts, if the theme writes a literal colour or length, or if any stylesheet declares a brand property the theme does not map. Before this layer existed the theme covered 38 properties while another 92 were declared elsewhere, carrying a blue (`#0749b8`) and an acid-lime (`#a5ff00`) palette into the page — which brand won was decided by stylesheet order.

Known gap: `--tint-bg/--tint-fg` and `--hint-bg/--hint-fg` are categorical palettes (one hue per domain, one per hint kind). The design system does not define a categorical scale yet, so they stay unthemed and are reported by name on every run.
