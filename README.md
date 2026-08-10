# Kvartirnik · project status

Last published snapshot: https://timelordy.github.io/kvartirnik-status/

This repository stores a curated static artifact in `site/`. GitHub Actions are disabled, so pushing `main` does not run CI or update GitHub Pages.

Run the checks locally from this repository:

```powershell
node scripts/verify-public-site.mjs site
python -m http.server 4178 --directory site
```

Then inspect `http://127.0.0.1:4178/` in a browser. Publication is manual: replace `site/`, run the verifier, review the Git diff, and push `main`.
