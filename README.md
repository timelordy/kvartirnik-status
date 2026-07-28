# Kvartirnik · project status

Public status: https://timelordy.github.io/kvartirnik-status/

This repository contains the least-privilege publisher for the Kvartirnik project dashboard. The source repository remains private. A scheduled workflow reads it through a read-only deploy key, validates the versioned status contract, builds an allowlisted static artifact, and deploys that artifact to GitHub Pages.

Publication runs after an authenticated `workflow_dispatch` from a source checkpoint and has a best-effort five-minute polling fallback. The dispatch records the expected source SHA, branch, and reason; the publisher still reads the latest private `main` through its read-only key and reports when a newer revision has already replaced the requested one.

When an Actions-only token and an authenticated GitHub CLI are both unavailable, the local checkpoint command pushes a metadata-only commit to the `status-dispatch` branch. That commit reuses the public `main` tree, contains no private source, and triggers the same publisher through the workflow's `push` event.

The schedule is a recovery path, not a live-update guarantee: GitHub may delay or drop scheduled runs during high load. No application source, Markdown documentation, local reports, or repository credentials are included in the Pages artifact.
