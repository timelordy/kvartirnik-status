# Kvartirnik · project status

Публичный адрес: https://kvartirnik-au.ru/

Здесь лежит статический артефакт в `site/`. GitHub Actions отключены, поэтому пуш `main` не запускает CI.

⚠️ **Pages раздаёт ветку `gh-pages`, а не `main`.** Пуш только в `main` сайт не обновляет — это стоило одной незамеченной публикации.

## Как публиковать

`site/` **собирается**, а не правится руками. Источник — приватный репозиторий `kvartirnik`:

```powershell
# в kvartirnik
node scripts/project-status/build-site.mjs
node scripts/project-status/css-ownership-regression.mjs

# сюда
Copy-Item -Recurse -Force ..\kvartirnik\dist\project-status-site\* .\site\
node scripts/verify-public-site.mjs site
node scripts/verify-design-system.mjs
git push origin main
git push origin main:gh-pages   # дерево site/ на gh-pages, см. историю
```

До августа 2026 витрина была форком: тема «Кабинета», вендоренная копия дизайн-системы, домен, локап в шапке, подвал и десятки правок CSS жили только здесь, а сборка из источника их не знала — любая пересборка снесла бы всё разом. Сейчас источник производит витрину целиком. **Не правьте `site/` руками:** правка уедет при первой же сборке, и никто об этом не узнает, пока не откроет страницу.

## Design system

The visual layer comes from `@cab234/design-system`, тег v1.2.1. This is a static artifact with no bundler, so it cannot resolve a package specifier: `site/design-system/` holds vendored copies and `site/design-system/VENDOR.json` records their upstream hashes.

Since 1.0 the system ships two files instead of one, and both are vendored:

- `tokens.css` — только значения. Импорт токенов больше не имеет права красить страницу.
- `base.css` — page defaults и режимы доступности (`prefers-reduced-motion`, `prefers-reduced-transparency`, `forced-colors`). До 1.0 всё это лежало в `tokens.css`.

Обе копии вкомпилированы в бандлы страниц (`program-flow/*-html.<hash>.css`) — именно их грузят страницы. Файлы в `site/design-system/` это эталон, по которому сверяется хеш.

Обновление версии системы делается в приватном репозитории `kvartirnik`: копируются `tokens.css` и `base.css` из нужного тега в `docs/design-system/`, пересчитываются хеши в `VENDOR.json`, дальше обычная сборка и публикация. Здесь руками не правится ничего.

`site/program-flow/kvartirnik-cabinet-theme.css` is the only file allowed to declare brand values. It does two things and nothing else:

1. overrides the four accent tokens — that is what the kvartirnik theme *is*;
2. maps every local name used by the other 37 stylesheets (`--ink`, `--r-md`, `--fs-micro`, `--shadow-card`, …) onto a design-system token.

`verify-design-system.mjs` fails if the vendored copy drifts, if the theme writes a literal colour or length, or if any stylesheet declares a brand property the theme does not map. Before this layer existed the theme covered 38 properties while another 92 were declared elsewhere, carrying a blue (`#0749b8`) and an acid-lime (`#a5ff00`) palette into the page — which brand won was decided by stylesheet order.

Known gap: `--tint-bg/--tint-fg` and `--hint-bg/--hint-fg` are categorical palettes (one hue per domain, one per hint kind). The design system does not define a categorical scale yet, so they stay unthemed and are reported by name on every run.
