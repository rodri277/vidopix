# Vidopix

[English](README.md)

Un editor de pixel art que funciona en el navegador: sin instalar nada, sin cuenta y con un generador de paletas integrado.

> **Estado:** Fase 3 (paletas, v0.3.0). El uso sin conexión, compartir y la animación llegan en las siguientes fases. El enlace a la demo y las capturas se añadirán cuando la app esté desplegada.

## Objetivos

- Ser la pieza principal de un portfolio: arquitectura, algoritmos, rendimiento y diseño de producto.
- Ser usable de verdad: un artista debe poder hacer un sprite de 64×64 de principio a fin y exportarlo.
- Cargar rápido y, desde la Fase 4, funcionar sin conexión.

## Qué hace hoy

- Lápiz, goma (1 a 16 px), cubo (contiguo o global, con tolerancia), cuentagotas, línea, rectángulo y elipse. Con Shift las líneas se limitan a 0/45/90 grados y las formas a cuadrados y círculos.
- Zoom entero de 1× a 64× anclado al puntero, desplazamiento, cuadrícula de píxeles y damero de transparencia.
- Colores primario y secundario con hex y deslizadores OKLCH.
- Deshacer y rehacer que nunca se quedan sin pasos, solo sin presupuesto de memoria (64 MB por defecto).
- Capas (añadir, duplicar, borrar, renombrar, reordenar, ocultar, bloquear, opacidad, fusionar hacia abajo, aplanar), todas con deshacer.
- Selección rectangular, mover, copiar, cortar, pegar y borrar; todas las herramientas respetan la selección.
- Una paleta por sprite con seis predefinidas, importación y exportación (`.gpl`, `.hex`, JSON), extracción desde cualquier imagen (median cut, en un worker), armonías OKLCH, rampas de sombreado con desplazamiento de tono, comprobador de contraste WCAG y reemplazo de color.
- Exportación a PNG de 1× a 32×.
- Se puede usar entera con teclado: las flechas mueven un cursor de píxel y mantener Enter dibuja.

## Rendimiento medido

Cifras de los benchmarks y del E2E de este repositorio, en la máquina del autor (Mac con Apple silicon, Chromium sin interfaz). No son estimaciones: ejecuta `pnpm bench` y `pnpm e2e` para reproducirlas en la tuya.

| Métrica                                         | Objetivo        | Medido                                |
| ----------------------------------------------- | --------------- | ------------------------------------- |
| Relleno de 1024×1024, solo el algoritmo         | < 50 ms         | unos 12 ms                            |
| Relleno de 1024×1024, con el parche de deshacer | < 50 ms         | unos 34 ms                            |
| Tiempo por fotograma al dibujar en 256×256      | 60 fps          | 16,7 ms de media (limitado por vsync) |
| 500 trazos deshechos y rehechos en 256×256      | dentro de 64 MB | pasa (test unitario)                  |
| JavaScript inicial (gzip)                       | < 150 kB        | 88 kB                                 |

Las puntuaciones de Lighthouse todavía no se han medido.

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

## Créditos de las paletas

Las paletas predefinidas usan los valores de color publicados en [Lospec](https://lospec.com/palette-list). Pertenecen a sus autores:

- **PICO-8**: Lexaloffle Games.
- **DawnBringer 16** y **DawnBringer 32**: Richard "DawnBringer" Fhager.
- **Sweetie 16**: GrafxKid.
- **Endesga 32**: ENDESGA.
- **Resurrect 64**: Kerrie Lake.

## Créditos y licencia

Por vidotho. Licencia MIT, ver [LICENSE](LICENSE).
