# Kvartirnik · project status

Публичный адрес: https://kvartirnik-au.ru/

Здесь лежит статический артефакт в `site/`. GitHub Actions отключены, поэтому пуш `main` не запускает CI.

⚠️ **Pages раздаёт содержимое `site/` в корне ветки `gh-pages`.** Пуш только в `main` сайт не обновляет — это стоило одной незамеченной публикации. Пуш `main:gh-pages` не помогает, а ломает: на `gh-pages` уедет дерево репозитория, сайт окажется на `/site/`, а в корне будет README. Публикуется поддерево.

## Как публиковать

`site/` **собирается**, а не правится руками. Источник — приватный репозиторий `kvartirnik`:

```powershell
# в kvartirnik
$env:SITE_PORTAL_SOURCE_SHA = git rev-parse HEAD
$env:SITE_APPLICATION_SHA = $env:SITE_PORTAL_SOURCE_SHA
$env:SITE_PORTAL_SOURCE_BRANCH = git branch --show-current
$env:SITE_PORTAL_SOURCE_COMMIT_TIME = git show -s --format=%cI HEAD
$env:SITE_PUBLISHED_AT = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
node scripts/project-status/build-site.mjs --strict-metadata
node scripts/project-status/css-ownership-regression.mjs

# сюда
Remove-Item -Recurse -Force .\site\*
Copy-Item -Recurse -Force ..\kvartirnik\dist\project-status-site\* .\site\
node scripts/verify-public-site.mjs site
node scripts/verify-design-system.mjs
git add -- site
git commit -m "публикация: обновить витрину"
git push origin main
git fetch origin gh-pages
$tree = git rev-parse HEAD:site
$commit = git commit-tree $tree -p FETCH_HEAD -m "публикация: обновить витрину"
git push origin "${commit}:refs/heads/gh-pages"
```

Три вещи в этой процедуре обязательны, и каждая стоила одной незамеченной публикации.

`--strict-metadata` с `SITE_PUBLISHED_AT`: без него собирается предварительная сборка, и витрина честно пишет «предварительная сборка не публикуется» и «в этой сборке не записано» — но выложить её всё равно можно, и тогда опубликованная страница месяцами утверждает, что она не опубликована. Строгий режим требует полные SHA, время коммита, ветку и дату публикации: без любого из них сборка не проходит.

`Remove-Item` перед копированием: `Copy-Item` не удаляет лишнее. Страница, убранная из сборки, остаётся в `site/` навсегда и продолжает раздаваться — со своими числами, своей датой и без всякой связи с источником.

`commit-tree` вместо пуша ветки: `gh-pages` содержит **содержимое** `site/`, а не дерево репозитория. Проверить это можно в любой момент — `git diff origin/main:site origin/gh-pages` должен быть пустым.

`git subtree split` для этого не годится: прежние публикации делались иначе, его коммиты с историей `gh-pages` не связаны и пуш отклоняется как non-fast-forward. Форсировать нельзя — потеряется история публикаций, а она единственное, по чему видно, когда сайт менялся.

До августа 2026 витрина была форком: тема «Кабинета», вендоренная копия дизайн-системы, домен, локап в шапке, подвал и десятки правок CSS жили только здесь, а сборка из источника их не знала — любая пересборка снесла бы всё разом. Сейчас источник производит витрину целиком. **Не правьте `site/` руками:** правка уедет при первой же сборке, и никто об этом не узнает, пока не откроет страницу.

## Design system

The visual layer comes from `@cab234/design-system`, тег v1.4.0 — версию называет `site/design-system/VENDOR.json`, и он же её проставляет. This is a static artifact with no bundler, so it cannot resolve a package specifier: `site/design-system/` holds vendored copies and `site/design-system/VENDOR.json` records their upstream hashes.

Вендорится вся система, а не часть: класс из невендоренного или неподключённого
файла молча не работает. Порядок тот же, что в её `index.css`:

- `layer-order.css` — очерёдность слоёв `ds.*`. Живёт в `index.css` системы, который витрине не нужен целиком; без него очерёдность определялась бы тем, какой файл браузер разобрал первым.
- `tokens.css` — только значения. Импорт токенов не имеет права красить страницу.
- `base.css` — page defaults и режимы доступности (`prefers-reduced-motion`, `prefers-reduced-transparency`, `forced-colors`).
- `structure.css` — контейнер, ритм секции, раскрывашка, строки данных.
- `primitives.css` — вид элемента.
- `patterns.css` — смысл и состояния.

До 1.4 `patterns.css` вендорился, но не подключался ни одной страницей. Хеш при
этом сходился: проверка отвечала на вопрос «копия не испортилась?», а не «копию
кто-нибудь читает?». Восемь `.ds-status` на витрине всё это время набирались
обычным текстом.

Обе копии вкомпилированы в бандлы страниц (`program-flow/*-html.<hash>.css`) — именно их грузят страницы. Файлы в `site/design-system/` это эталон, по которому сверяется хеш.

Обновление версии системы делается в приватном репозитории `kvartirnik` одной
командой: `npm run status:vendor` копирует файлы из источника, пересчитывает
хеши и переписывает `VENDOR.json`. Дальше обычная сборка и публикация. Здесь
руками не правится ничего.

Раньше это делалось вручную, и результат был предсказуем: `VENDOR.json`
фиксировал v1.2.2, этот README называл v1.2.1, а сама система ушла дальше обоих.
`npm run status:quality` теперь начинается с `--check`, который сверяет копию с
источником и заодно проверяет, что каждый вендоренный файл подключён страницами.

`site/program-flow/kvartirnik-cabinet-theme.css` is the only file allowed to declare brand values. It does two things and nothing else:

1. overrides the four accent tokens — that is what the kvartirnik theme *is*;
2. maps every local name used by the other 37 stylesheets (`--ink`, `--r-md`, `--fs-micro`, `--shadow-card`, …) onto a design-system token.

`verify-design-system.mjs` fails if the vendored copy drifts, if the theme writes a literal colour or length, or if any stylesheet declares a brand property the theme does not map. Before this layer existed the theme covered 38 properties while another 92 were declared elsewhere, carrying a blue (`#0749b8`) and an acid-lime (`#a5ff00`) palette into the page — which brand won was decided by stylesheet order.

Known gap: `--tint-bg/--tint-fg` and `--hint-bg/--hint-fg` are categorical palettes (one hue per domain, one per hint kind). The design system does not define a categorical scale yet, so they stay unthemed and are reported by name on every run.
