# Vidopix — Especificación técnica para Claude Code

Oct 3, 2026 · @Rodri

## 1. Cómo trabajar con este documento

Eres el desarrollador principal de Vidopix y trabajas como un ingeniero senior: decides con criterio, documentas el porqué y no das nada por terminado sin tests. Este documento es la fuente de verdad. Si algo choca con él o falta información, pregunta antes de improvisar.

**Flujo de trabajo**

1. Trabaja por fases (sección 8), en orden. No empieces una fase hasta que el usuario haya validado la anterior.
2. Al empezar cada fase, presenta un plan breve: tareas, ficheros que vas a crear y riesgos. Espera confirmación.
3. En `packages/core`, escribe primero los tests (TDD) y después la implementación.
4. Commits pequeños con Conventional Commits, por ejemplo `feat(core): add scanline flood fill`. Una rama y un PR por fase.
5. Antes de cerrar una tarea ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm test` y, si toca la interfaz, `pnpm e2e`. Todo en verde.
6. Cada decisión de arquitectura relevante se registra como ADR en `docs/adr/` (sección 9).
7. Mantén un `CLAUDE.md` en la raíz con convenciones y comandos, y actualízalo cuando cambien.

**Definición de hecho (para cada fase)**

- Criterios de aceptación de la fase cumplidos y demostrables en el despliegue de preview.
- Lint, typecheck y tests en verde en CI, con cobertura de `packages/core` ≥ 90 %.
- Sin `any`, sin `@ts-ignore` y sin `console.log` olvidados.
- README, CHANGELOG y ADRs actualizados.
- Usable entera con teclado y sin errores de axe.

**Idioma**

Código, nombres, comentarios y commits en inglés. README principal en inglés, con versión en español en `README.es.md`. Interfaz en inglés, con español añadido en la Fase 4.

**Lo que no debes hacer**

- Añadir dependencias sin justificarlas: cada dependencia nueva lleva una línea en el PR explicando por qué.
- Poner lógica de dominio en componentes React.
- Optimizar sin medir: primero benchmark, después optimización.
- Mezclar funcionalidades de fases distintas en un mismo PR.

## 2. Visión del producto

Vidopix es un editor de pixel art que funciona en el navegador, sin instalación ni cuenta, con un generador de paletas integrado como diferenciador. Lleva la firma "by vidotho" en el pie de la aplicación y en el README.

**Objetivos**

- Ser la pieza principal de un portfolio: demostrar arquitectura, algoritmos, rendimiento y diseño de producto.
- Ser usable de verdad: un artista debe poder hacer un sprite de 64×64 de principio a fin y exportarlo.
- Cargar rápido y, desde la Fase 4, funcionar sin conexión.

**Público**

- Artistas y desarrolladores de videojuegos indie que quieren algo rápido sin instalar un programa.
- Reclutadores y equipos técnicos que revisan el código y la demo.

**Fuera de alcance**

- Backend, cuentas de usuario o almacenamiento en la nube.
- Colaboración en tiempo real.
- Generación de imágenes con IA.
- Edición de imágenes grandes: el lienzo máximo es de 1024×1024 px.
- Aplicaciones nativas.

Como referencia de flujo de trabajo sirven editores como Aseprite, Piskel o el editor de Lospec. Se toman ideas de usabilidad, nunca su diseño visual.

## 3. Stack tecnológico

TypeScript estricto con React en la interfaz y un motor de edición en TypeScript puro, independiente del framework. Usa la última versión estable de cada herramienta (compruébala antes de instalar) y Node LTS fijado en `.nvmrc`.

| Área | Elección | Por qué |
| --- | --- | --- |
| Lenguaje | TypeScript en modo estricto | Tipos como documentación y red de seguridad |
| Monorepo | pnpm workspaces | Separa el motor (`core`) de la app (`web`) con límites reales |
| Build | Vite | Arranque y recarga instantáneos, build optimizado |
| Interfaz | React | El más demandado; el motor no depende de él |
| Estado de interfaz | Zustand | Ligero, con selectores y fácil de testear; el documento vive en el core |
| Estilos | CSS Modules + variables CSS (design tokens) | Control total del tema oscuro sin framework de estilos |
| Iconos | Lucide | Coherentes, ligeros y con licencia libre |
| Render | Canvas 2D + OffscreenCanvas | Suficiente para pixel art; WebGL sería sobreingeniería (ADR-002) |
| Concurrencia | Web Workers con mensajes tipados | Extracción de paletas y codificación de GIF sin bloquear la interfaz |
| Persistencia | IndexedDB con `idb` | Guardado automático local, sin servidor |
| Validación | Zod | Validar ficheros importados y migrar versiones de formato |
| Tests unitarios | Vitest + fast-check | Tests rápidos y pruebas basadas en propiedades para algoritmos |
| Tests de componentes | Testing Library | Paneles probados como los usa una persona |
| Tests E2E | Playwright + axe-core | Flujos completos y accesibilidad automatizada |
| Calidad | ESLint (`strict-type-checked`), Prettier, dependency-cruiser | Estilo uniforme y límites de arquitectura vigilados en CI |
| CI/CD | GitHub Actions + Vercel | Pipeline por PR y despliegue de preview por rama |
| PWA | vite-plugin-pwa (Fase 4) | Offline e instalable |
| GIF | gifenc (Fase 5) | Codificador pequeño y rápido, apto para workers |

## 4. Arquitectura

Puertos y adaptadores: un núcleo en TypeScript puro, sin DOM, que contiene todo el dominio, y una app React que solo pinta y traduce eventos. Así el motor se testea sin navegador y la interfaz podría cambiarse sin tocarlo.

> Diagrama de capas (no incluido en el export a Markdown): `apps/web` (React + adaptadores de navegador) depende de `packages/core` (dominio puro, sin DOM) a través de `EditorSession` y los puertos `Renderer`, `Storage` e `IdGenerator`. Las flechas solo bajan hacia el core o salen de él como eventos.

Las flechas solo bajan hacia el core o salen de él como eventos: el motor nunca conoce a React ni al navegador.

**Estructura de carpetas**

```
vidopix/
├─ apps/
│  └─ web/                    # App React: interfaz + adaptadores de navegador
│     ├─ src/
│     │  ├─ app/              # arranque, providers, error boundary
│     │  ├─ features/         # canvas, toolbar, layers, palette, export…
│     │  ├─ adapters/         # CanvasRenderer, IdbStorage, workers, ficheros
│     │  ├─ state/            # stores de interfaz (Zustand), keymap
│     │  ├─ design-system/    # tokens y componentes base (Button, Panel, Slider…)
│     │  └─ i18n/
│     └─ e2e/                 # tests Playwright
├─ packages/
│  └─ core/                   # TypeScript puro, sin DOM
│     └─ src/
│        ├─ domain/           # Sprite, Layer, PixelBuffer, Palette, Selection, Color
│        ├─ algorithms/       # bresenham, floodFill, shapes, medianCut, oklch
│        ├─ history/          # Command, HistoryManager, PixelPatch
│        ├─ tools/            # interfaz Tool + implementaciones
│        ├─ session/          # EditorSession: fachada que orquesta todo
│        ├─ ports/            # Renderer, Storage, IdGenerator…
│        └─ io/               # formato .vidopix, .gpl, .hex, migraciones
├─ docs/
│  ├─ adr/
│  └─ architecture.md
├─ .github/workflows/
├─ CLAUDE.md
└─ README.md
```

**Reglas de dependencia (vigiladas en CI con dependency-cruiser)**

- `core` no importa nada de `web` ni del DOM. Su `tsconfig` no incluye la librería `dom`.
- La interfaz solo habla con el core a través de `EditorSession`. Nunca escribe píxeles directamente.
- Toda mutación del documento pasa por un `Command`, y por tanto queda en el historial.
- Los adaptadores de `web` implementan los puertos del core (`Renderer`, `Storage`…).
- Las carpetas de `features/` no se importan entre sí. Comparten a través de `state/` o `design-system/`.
- Sin `export default`, salvo donde un framework lo exija.

**Patrones**

- **Command** para el historial de deshacer y rehacer.
- **Strategy** para las herramientas: cada una implementa `Tool` con `onPointerDown`, `onPointerMove` y `onPointerUp`.
- **Facade** con `EditorSession`, que expone una API pequeña a la interfaz.
- **Observer**: la sesión emite eventos tipados (`documentChanged` con su rectángulo sucio, `historyChanged`, `selectionChanged`).
- **Ports & Adapters** para render, almacenamiento y workers.

**Flujo de un trazo**

1. El adaptador del lienzo recibe Pointer Events y convierte coordenadas de pantalla a píxeles del documento.
2. `EditorSession` reenvía el evento a la herramienta activa.
3. La herramienta modifica píxeles a través de un comando abierto que acumula el parche del trazo.
4. La sesión emite `documentChanged` con el rectángulo afectado.
5. El renderer recompone solo esa zona en el siguiente `requestAnimationFrame`.
6. En `pointerup` el comando se cierra y entra en el historial como una sola operación.

## 5. Modelo de dominio y decisiones técnicas

Estas decisiones son las que convierten un editor de juguete en uno serio. Cada una lleva su test y, cuando corresponda, su ADR.

**Modelo**

| Entidad | Contenido |
| --- | --- |
| `Sprite` | id, nombre, ancho, alto, capas ordenadas, paleta; fotogramas desde la Fase 5 |
| `Layer` | id, nombre, visible, bloqueada, opacidad (0–1), modo de fusión (`normal` al principio), `PixelBuffer` |
| `PixelBuffer` | ancho, alto y un `Uint32Array` con un píxel RGBA empaquetado por posición |
| `Palette` | id, nombre y lista de colores con nombre opcional |
| `Selection` | rectángulo y máscara (Fase 2) |
| `Color` | RGBA empaquetado, con conversiones a hex, sRGB lineal, OKLab y OKLCH |

El `Uint32Array` es una vista sobre el mismo buffer que usa `ImageData`, así se pinta con `putImageData` sin copiar. El orden de bytes depende del procesador (en la práctica little-endian, ABGR): enciérralo en funciones de `Color` y documéntalo en un ADR. Los identificadores vienen de un puerto `IdGenerator` para que los tests sean deterministas.

**Historial de deshacer y rehacer**

- Cada operación es un `Command` con `apply`, `revert`, `label` y `sizeBytes`.
- Un trazo completo es un único comando: los movimientos se acumulan hasta `pointerup`.
- Los cambios se guardan como `PixelPatch`: índices, valores anteriores y valores nuevos. Si la operación afecta a mucha superficie (un relleno del lienzo entero), se guarda la región afectada completa. Se elige la representación más barata.
- El historial tiene un presupuesto de memoria (64 MB por defecto) en lugar de un número fijo de pasos. Al superarlo se descartan los más antiguos.
- Una operación nueva vacía la pila de rehacer.
- Test de propiedad: aplicar y revertir cualquier comando deja el buffer idéntico byte a byte.

**Entrada del puntero**

- Pointer Events con `setPointerCapture`, para que el trazo no se corte al salir del lienzo.
- `getCoalescedEvents()` cuando el navegador lo ofrezca, para no perder muestras en movimientos rápidos.
- Entre dos muestras consecutivas se interpola con Bresenham, de modo que un trazo rápido no deja huecos.
- Un mismo píxel no se pinta dos veces en el mismo trazo.
- Pantalla a documento: transformación de vista (zoom y desplazamiento) y redondeo hacia abajo.

**Relleno por cubo**

- Algoritmo scanline iterativo con pila explícita. Nada de recursión, que desborda la pila en lienzos grandes.
- Modos contiguo y global, tolerancia 0 por defecto, y respeto de la selección activa.
- Objetivo: rellenar un lienzo de 1024×1024 en menos de 50 ms.

**Formas**

- Línea con Bresenham, rectángulo, y elipse con el algoritmo del punto medio. Contorno o relleno.
- Con Mayúsculas: cuadrado, círculo y líneas a 0°, 45° o 90°.
- La vista previa se dibuja en la capa de superposición y solo se confirma en `pointerup`, como un comando.

**Render**

- Tres canvas apilados: documento compuesto, superposición (cursor, vista previa, selección) y cuadrícula.
- Cada capa mantiene su propio canvas en caché. Al cambiar algo, solo se recompone el rectángulo sucio.
- Los cambios de un mismo fotograma se agrupan y se pintan en un único `requestAnimationFrame`.
- `imageSmoothingEnabled = false`, `image-rendering: pixelated` y gestión de `devicePixelRatio` para que los píxeles se vean nítidos.
- Zoom en niveles enteros (de 1× a 64×) anclado a la posición del cursor.

**Color y paletas**

- Conversiones sRGB, sRGB lineal, OKLab y OKLCH implementadas en el core y validadas contra valores de referencia.
- Las armonías y las rampas se generan en OKLCH. Los colores fuera de gama se corrigen reduciendo croma.
- Contraste con la fórmula de WCAG 2.x.
- Extracción de paleta con median cut en un Web Worker: se ignoran píxeles transparentes, la imagen se reduce a 256×256 como máximo y la operación se puede cancelar.

**Exportación y formato propio**

- PNG con escalado entero (×1 a ×32) y fondo transparente opcional, comprobado píxel a píxel contra el modelo.
- Formato `.vidopix`: JSON con `schemaVersion`, capas codificadas en base64 y migraciones entre versiones. Se valida con Zod al importar.
- Límites al importar: 20 MB por fichero y 1024×1024 px.

## 6. Diseño de interfaz

Interfaz oscura de herramienta profesional: densa pero tranquila, con el lienzo como protagonista y un único color de acento. Sin degradados ni sombras pesadas.

**Distribución**

| Zona | Medida | Contenido |
| --- | --- | --- |
| Barra superior | 40 px de alto | Logotipo (un punto de color), nombre del sprite editable, menús Archivo, Editar, Ver y Ayuda, zoom y botón Exportar |
| Opciones de herramienta | 32 px de alto | Ajustes de la herramienta activa: tamaño, tolerancia, contorno o relleno |
| Barra de herramientas | 48 px de ancho, a la izquierda | Herramientas con icono y tooltip con su atajo; colores primario y secundario abajo |
| Lienzo | Centro | Sprite centrado sobre un damero de transparencia |
| Panel derecho | 280 px, redimensionable y plegable | Color (selector OKLCH y hex), Paleta y Capas |
| Barra de estado | 24 px de alto | Coordenadas del cursor, tamaño del sprite, zoom, herramienta activa y estado de guardado |

El diálogo de nuevo sprite ofrece 16, 32, 64, 128 y 256 px, y tamaño personalizado. La tecla Tab oculta todos los paneles.

**Design tokens (variables CSS)**

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg-app` | `#111318` | Fondo general |
| `--bg-panel` | `#181B21` | Paneles y barras |
| `--bg-elevated` | `#20242C` | Menús, diálogos, campos |
| `--border` | `#2A2F38` | Bordes y separadores |
| `--text` | `#E6E8EB` | Texto principal |
| `--text-muted` | `#9AA1AC` | Texto secundario |
| `--accent` | `#7C5CFF` | Herramienta activa, foco, acciones principales |
| `--danger` | `#FF5C5C` | Acciones destructivas |
| `--success` | `#3DD68C` | Confirmaciones |

Escala de espaciado de 4 px, radios de 6 px y texto base de 13 px. Tipografía Inter para la interfaz y JetBrains Mono para cifras y valores hex, ambas alojadas en el propio proyecto para funcionar sin conexión.

**Atajos de teclado**

| Acción | Atajo |
| --- | --- |
| Lápiz / Borrador / Cubo | B / E / G |
| Cuentagotas (Alt mantenido lo activa temporalmente) | I |
| Línea / Rectángulo / Elipse | L / U / O |
| Selección / Mover | M / V |
| Intercambiar colores | X |
| Tamaño del pincel | \[ y \] |
| Deshacer / Rehacer | Ctrl+Z / Ctrl+Shift+Z o Ctrl+Y |
| Zoom / Ajustar a pantalla / 100 % | + y − / 0 / 1 |
| Desplazar el lienzo | Espacio + arrastrar, o botón central |
| Cuadrícula | Ctrl+' |
| Nuevo / Guardar / Exportar | Ctrl+N / Ctrl+S / Ctrl+E |
| Nueva capa | Ctrl+Shift+N |
| Ocultar paneles / Ayuda de atajos | Tab / ? |

En macOS, Cmd sustituye a Ctrl. Los atajos viven en un registro central y no se disparan mientras el foco está en un campo de texto.

**Accesibilidad**

- Todo se puede usar con teclado y el foco siempre es visible.
- Roles ARIA correctos: `toolbar` para las herramientas, grupo de opciones para la herramienta activa y lista reordenable con Alt+↑/↓ para las capas.
- Deshacer y rehacer se anuncian en una región `aria-live`, por ejemplo "Deshecho: trazo de lápiz".
- Contraste AA en toda la interfaz y respeto de `prefers-reduced-motion`.
- Pensado para escritorio, con un ancho mínimo de 1024 px. Tablet y táctil llegan en la Fase 4.

## 7. Calidad, testing y CI/CD

La calidad se comprueba en cada PR de forma automática: si la CI no está en verde, no se fusiona.

**Código**

- `tsconfig` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` y `verbatimModuleSyntax`.
- ESLint con `typescript-eslint` en modo `strict-type-checked`, más `react-hooks` y `jsx-a11y`. Prettier para el formato.
- Husky y lint-staged en pre-commit; commitlint para Conventional Commits.
- Funciones pequeñas y puras siempre que se pueda. Nombres que expliquen la intención; comentarios solo para el porqué.
- En el core, los errores esperados (un fichero mal formado) se devuelven como `Result`. Las excepciones quedan para errores de programación.
- En la interfaz, un error boundary que ofrece recuperar el último guardado automático.

**Pirámide de tests**

- **Unitarios (Vitest)** en `packages/core`, con umbral de cobertura del 90 % en líneas y ramas que hace fallar la CI.
- **Basados en propiedades (fast-check)** para historial, algoritmos y conversiones de color. Ejemplos: deshacer y rehacer N veces devuelve el estado original; OKLCH a sRGB y vuelta no pierde precisión más allá de 1/255.
- **Componentes (Testing Library)** para paneles y diálogos.
- **E2E (Playwright)** para los flujos clave: crear, dibujar, deshacer, rehacer y exportar. El PNG exportado se compara píxel a píxel con lo esperado, no con capturas.
- **Accesibilidad** con axe-core dentro de los tests E2E.
- **Benchmarks** con `vitest bench` para relleno, composición e historial. Se publican en la CI como informe.

**Objetivos de rendimiento**

| Métrica | Objetivo |
| --- | --- |
| Dibujo en 256×256 con 8 capas | 60 fps |
| Relleno de 1024×1024 | < 50 ms |
| JavaScript inicial (gzip) | < 150 KB, vigilado con size-limit |
| Lighthouse (las cuatro categorías) | ≥ 95 |

**Seguridad y privacidad**

- Content Security Policy estricta, sin scripts en línea ni `eval`.
- Sin analíticas ni rastreadores de terceros. Nada sale del navegador del usuario.
- Validación de todo fichero importado (tamaño, dimensiones y esquema).
- Renovate o Dependabot para mantener las dependencias al día.

**Pipeline**

1. En cada PR: instalación con lockfile congelado, lint, typecheck, tests unitarios con cobertura, build, E2E contra el build, size-limit y despliegue de preview en Vercel.
2. En `main`: lo mismo y despliegue a producción.
3. Al cerrar cada fase: etiqueta de versión y entrada en el CHANGELOG.

## 8. Plan por fases

Seis fases, cada una desplegada y usable al terminarla. La animación va al final a propósito: el modelo se diseña desde el principio para que añadir fotogramas no obligue a reescribirlo.

### Fase 0 — Cimientos (v0.0.1)

Alcance:

- Monorepo pnpm con `packages/core` y `apps/web`.
- Configuración de TypeScript, ESLint, Prettier, Vitest, Playwright, dependency-cruiser, Husky y commitlint.
- Pipeline de CI completo y despliegue en Vercel con previews por PR.
- `CLAUDE.md`, esqueleto del README, ADR-001 (monorepo y core sin DOM) y ADR-002 (Canvas 2D frente a WebGL).
- Design tokens y estructura vacía de la interfaz: barras, panel y zona de lienzo.

Criterios de aceptación:

- `pnpm install && pnpm dev` arranca la aplicación.
- Un PR de prueba pasa la CI y genera una URL de preview pública.
- Si `core` importa algo de `web`, la CI falla (comprobado con un caso de prueba).

### Fase 1 — Editor base (v0.1.0)

Alcance:

- Nuevo sprite con tamaños predefinidos y personalizado.
- Lienzo con zoom entero anclado al cursor, desplazamiento, cuadrícula y damero de transparencia.
- Lápiz y borrador (1 a 16 px), cubo de relleno (contiguo y global), cuentagotas, línea, rectángulo y elipse.
- Colores primario y secundario con selector hex y OKLCH básico.
- Deshacer y rehacer, atajos de teclado y barra de estado.
- Exportación a PNG con escalado ×1 a ×32.

Criterios de aceptación:

- Un test E2E con movimiento rápido del puntero no deja huecos en el trazo.
- El relleno de 1024×1024 no desborda la pila y tarda menos de 50 ms.
- 500 trazos se deshacen y rehacen sin superar el presupuesto de memoria del historial.
- El PNG exportado coincide píxel a píxel con el modelo.
- Se mantienen 60 fps dibujando en 256×256, medido y documentado.

### Fase 2 — Capas y selección (v0.2.0)

Alcance:

- Capas: añadir, borrar, duplicar, renombrar, reordenar (arrastre y teclado), visibilidad, bloqueo y opacidad.
- Fusionar hacia abajo y aplanar.
- Selección rectangular, mover selección y contenido, copiar, cortar, pegar y borrar. El portapapeles del sistema se usa como PNG.
- Todas las herramientas respetan la selección activa.

Criterios de aceptación:

- Cada operación de capas y selección se puede deshacer.
- La composición solo recalcula el rectángulo sucio, verificado con un test.
- 8 capas en 256×256 se mantienen a 60 fps.
- Las capas se gestionan por completo con teclado.

### Fase 3 — Paletas (v0.3.0)

Alcance:

- Panel de paleta: añadir, borrar, reordenar y nombrar colores.
- Paletas predefinidas populares, con su autor acreditado en el README.
- Extraer paleta de una imagen (de 4 a 64 colores) con median cut en un worker.
- Armonías en OKLCH: análoga, complementaria, triádica, tetrádica y monocromática.
- Generador de rampas de sombreado con desplazamiento de tono (el *hue shifting* típico del pixel art).
- Comprobador de contraste WCAG entre dos colores.
- Importar y exportar `.gpl`, `.hex` y JSON.
- Reemplazar un color en todo el sprite, como comando deshacible.

Criterios de aceptación:

- Extraer la paleta de una foto de 4000×3000 no bloquea la interfaz y se puede cancelar.
- Las conversiones OKLCH pasan contra valores de referencia publicados.
- Importar y exportar `.gpl` es reversible sin pérdidas.

### Fase 4 — Persistencia y pulido (v1.0.0)

Alcance:

- Guardado automático en IndexedDB, lista de proyectos recientes y recuperación tras un cierre inesperado.
- Abrir y guardar ficheros `.vidopix`.
- PWA instalable que funciona sin conexión.
- Compartir por URL: sprites pequeños comprimidos dentro del enlace, sin servidor.
- Simetría horizontal y vertical, tramado ordenado (Bayer) y modo *pixel-perfect* para el lápiz.
- Soporte táctil (pellizcar para hacer zoom, dos dedos para desplazar) y presión de lápiz.
- Interfaz en inglés y español, y panel de ayuda de atajos.

Criterios de aceptación:

- Tras la primera visita, la app funciona sin conexión.
- Recargar la página por accidente no pierde trabajo.
- Lighthouse ≥ 95 en las cuatro categorías.
- Una URL compartida reproduce el sprite exacto.

### Fase 5 — Animación (v1.1.0)

Alcance:

- Línea de tiempo de fotogramas por capas: añadir, duplicar, borrar y reordenar fotogramas.
- Duración por fotograma y previsualización en bucle con FPS configurables.
- Onion skin del fotograma anterior y siguiente, con opacidad configurable.
- Exportar GIF (codificado en un worker) y spritesheet PNG con un JSON de coordenadas de cada fotograma.

Criterios de aceptación:

- Una animación de 32 fotogramas a 64×64 se reproduce con fluidez.
- El GIF respeta duraciones y transparencia.
- El spritesheet y su JSON son coherentes, comprobado con un test.

## 9. Documentación y presentación de portfolio

El repositorio es tan parte del portfolio como la demo: quien lo abra debe entender en dos minutos qué es, cómo está hecho y por qué.

**README (`README.md` en inglés y `README.es.md`)**

1. GIF de cabecera usando el editor y enlace a la demo en vivo.
2. Funcionalidades principales, con una captura por fase cerrada.
3. Stack y diagrama de arquitectura en Mermaid.
4. *Technical highlights*: los retos de la sección 5 con las métricas reales medidas, no estimadas.
5. *How this was built*: desarrollado con Claude Code a partir de esta especificación; qué se pidió, qué revisó y decidió el autor, y qué se corrigió.
6. Cómo ejecutarlo, cómo lanzar los tests y hoja de ruta.
7. Créditos ("by vidotho") y licencia MIT.

**ADRs en `docs/adr/`**

Formato: contexto, decisión, alternativas descartadas y consecuencias. Lista inicial:

| Nº | Decisión | Fase |
| --- | --- | --- |
| 001 | Monorepo y core sin dependencias del DOM | 0 |
| 002 | Canvas 2D frente a WebGL | 0 |
| 003 | Representación de píxeles en `Uint32Array` y orden de bytes | 1 |
| 004 | Historial por parches con presupuesto de memoria | 1 |
| 005 | Zustand para el estado de la interfaz | 1 |
| 006 | OKLCH como espacio de color para paletas | 3 |
| 007 | Formato `.vidopix` versionado y migraciones | 4 |

**Otros documentos**

- `docs/architecture.md` con el diagrama de capas y el flujo de un trazo.
- `CHANGELOG.md` siguiendo Keep a Changelog, con una versión por fase.
- Capturas y GIFs regenerados al cerrar cada fase.
