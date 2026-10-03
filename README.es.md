# Vidopix

[English](README.md)

Un editor de pixel art que funciona en el navegador: sin instalar nada, sin cuenta y con un generador de paletas integrado.

> **Estado:** v1.1.0. El enlace a la demo y las capturas se añadirán cuando la app esté desplegada.

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
- Simetría, trama ordenada, lápiz pixel-perfect, presión del lápiz y gestos táctiles (pellizcar para zoom, dos dedos para desplazar).
- Se guarda solo en tu navegador (no se sube nada), proyectos recientes, archivos `.vidopix` y enlaces que llevan el sprite dentro de la URL.
- Instalable y utilizable sin conexión.
- Interfaz en inglés y español.
- Animación: una línea de tiempo con fotogramas de cualquier duración, reproducción en bucle, papel cebolla y exportación a GIF animado o a una hoja de sprites con un JSON de coordenadas.
- Exportación a PNG de 1× a 32×.
- Se puede usar entera con teclado: las flechas mueven un cursor de píxel y mantener Enter dibuja.

## Rendimiento medido

Cifras de los benchmarks y del E2E de este repositorio, en la máquina del autor (Mac con Apple silicon, Chromium sin interfaz). No son estimaciones: ejecuta `pnpm bench` y `pnpm e2e` para reproducirlas en la tuya.

| Métrica                                         | Objetivo        | Medido                                    |
| ----------------------------------------------- | --------------- | ----------------------------------------- |
| Relleno de 1024×1024, solo el algoritmo         | < 50 ms         | unos 12 ms                                |
| Relleno de 1024×1024, con el parche de deshacer | < 50 ms         | unos 34 ms                                |
| Tiempo por fotograma al dibujar en 256×256      | 60 fps          | 16,7 ms de media (limitado por vsync)     |
| 500 trazos deshechos y rehechos en 256×256      | dentro de 64 MB | pasa (test unitario)                      |
| Reproducir 32 fotogramas de 64×64               | 60 fps          | 16,7 ms de media (limitado por vsync)     |
| GIF de 32 fotogramas de 64×64, en un worker     | fluido          | unos 50 ms para codificar (paleta exacta) |
| JavaScript inicial (gzip)                       | < 150 kB        | 128 kB                                    |

Lighthouse se midió con `pnpm lighthouse` sobre el build de producción con el preset de escritorio. La página está pensada para pantallas de al menos 768 px de ancho, así que una prueba móvil de tamaño teléfono no es un objetivo.

## Límites conocidos

- La interfaz necesita al menos 768 px de ancho; los móviles no están soportados, las tablets sí.
- Solo Chromium está cubierto por las pruebas automáticas. Safari y Firefox necesitan una revisión manual, sobre todo la instalación de la app, el portapapeles del sistema, los enlaces con `CompressionStream` y el táctil.
- Un proyecto puede tener como máximo 1024×1024 píxeles, 64 capas, 128 fotogramas y 20 MB (y 256 MB de píxeles en memoria). Un enlace admite unos 6000 caracteres: de sobra para pixel art de colores planos, insuficiente para sprites grandes o con mucho ruido.
- Un GIF tiene una sola paleta de 256 colores y no tiene transparencia parcial, así que una imagen con más colores se reduce y los píxeles con más de la mitad transparente pasan a opacos o transparentes. Reducir miles de colores tarda medio segundo aproximadamente.
- Los detalles de los errores al leer archivos de paleta o de proyecto son técnicos y se quedan en inglés.

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
