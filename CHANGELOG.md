# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.0.1] - 2026-10-03

### Added

- pnpm monorepo with `packages/core` (DOM-free engine) and `apps/web` (React app).
- Packed RGBA `Color` with hex parsing and formatting in the core, with unit and property-based tests.
- Empty UI shell: top bar, tool options, toolbox, canvas area, side panel and status bar, with design tokens as CSS variables and self-hosted Inter and JetBrains Mono.
- Strict TypeScript, ESLint (strict type-checked, react-hooks, jsx-a11y), Prettier, Husky, lint-staged and commitlint.
- Architecture boundary checks with dependency-cruiser, and tests proving they fail on violations.
- Playwright E2E smoke test with axe-core accessibility checks, run against the production build.
- GitHub Actions pipeline (lint, typecheck, tests with coverage, build, bundle size, E2E), Vercel deployment config with a strict CSP, and Dependabot.
- `CLAUDE.md`, READMEs (English and Spanish), architecture document and ADRs 001 to 003.
