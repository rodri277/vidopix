# Vidopix

[Español](README.es.md)

A pixel art editor that runs in your browser: no install, no account, and a built-in palette generator.

> **Status:** Phase 0 (foundations). The editor itself arrives in Phase 1. Screenshots, the live demo link and measured performance numbers will be added as each phase closes.

## Goals

- A portfolio piece that shows architecture, algorithms, performance and product design.
- Genuinely usable: an artist should be able to make a 64×64 sprite from start to finish and export it.
- Fast to load and, from Phase 4, usable offline.

## Stack

TypeScript (strict), React, Vite, pnpm workspaces, Vitest + fast-check, Playwright + axe-core, ESLint, Prettier, dependency-cruiser, GitHub Actions and Vercel. See [SPEC.md](SPEC.md) section 3 for the reasoning.

## Architecture

A pure TypeScript engine (`packages/core`, no DOM) and a React app (`apps/web`) that only paints and translates events. The boundary is enforced in CI. See [docs/architecture.md](docs/architecture.md) and the [ADRs](docs/adr).

## Getting started

Requires Node 24 LTS (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev
```

Useful scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.

## How this was built

Developed with Claude Code from a written specification ([SPEC.md](SPEC.md)). This section will cover what was asked, what was reviewed and decided by the author, and what was corrected, once there is more to tell.

## Credits and license

By vidotho. MIT licensed, see [LICENSE](LICENSE).
