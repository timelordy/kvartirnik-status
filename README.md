# Kvartirnik · project status

Public status: https://timelordy.github.io/kvartirnik-status/

This repository contains the least-privilege publisher for the Kvartirnik project dashboard. The source repository remains private. A scheduled workflow reads it through a read-only deploy key, validates the versioned status contract, builds an allowlisted static artifact, and deploys that artifact to GitHub Pages.

Publication runs after an explicit agent dispatch and has a five-minute polling fallback. No application source, Markdown documentation, local reports, or repository credentials are included in the Pages artifact.
