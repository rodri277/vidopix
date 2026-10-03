# Vidopix

[English](README.md)

Un editor de pixel art que funciona en el navegador: sin instalar nada, sin cuenta y con un generador de paletas integrado.

> **Estado:** Fase 0 (cimientos). El editor llega en la Fase 1. Las capturas, el enlace a la demo y las métricas de rendimiento medidas se añadirán al cerrar cada fase.

## Objetivos

- Ser la pieza principal de un portfolio: arquitectura, algoritmos, rendimiento y diseño de producto.
- Ser usable de verdad: un artista debe poder hacer un sprite de 64×64 de principio a fin y exportarlo.
- Cargar rápido y, desde la Fase 4, funcionar sin conexión.

## Stack

TypeScript (estricto), React, Vite, pnpm workspaces, Vitest + fast-check, Playwright + axe-core, ESLint, Prettier, dependency-cruiser, GitHub Actions y Vercel. El porqué está en la sección 3 de [SPEC.md](SPEC.md).

## Arquitectura

Un motor en TypeScript puro (`packages/core`, sin DOM) y una app React (`apps/web`) que solo pinta y traduce eventos. La frontera se vigila en CI. Consulta [docs/architecture.md](docs/architecture.md) y los [ADR](docs/adr).

## Primeros pasos

Requiere Node 24 LTS (ver `.nvmrc`) y pnpm.

```bash
pnpm install
pnpm dev
```

Scripts útiles: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.

## Cómo se ha construido

Desarrollado con Claude Code a partir de una especificación escrita ([SPEC.md](SPEC.md)). Esta sección contará qué se pidió, qué revisó y decidió el autor y qué se corrigió, cuando haya más que contar.

## Créditos y licencia

Por vidotho. Licencia MIT, ver [LICENSE](LICENSE).
