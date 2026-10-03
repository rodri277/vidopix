# Architecture decision records

Each record states the context, the decision, the alternatives that were rejected and the consequences. They are numbered in the order they were written.

| #                                                  | Decision                                                   | Phase   |
| -------------------------------------------------- | ---------------------------------------------------------- | ------- |
| [001](001-monorepo-and-dom-free-core.md)           | Monorepo with a DOM-free core                              | 0       |
| [002](002-canvas-2d-over-webgl.md)                 | Canvas 2D over WebGL                                       | 0       |
| [003](003-packed-rgba-in-uint32array.md)           | Pixels as packed RGBA in a `Uint32Array`                   | 1       |
| [004](004-patch-based-history.md)                  | History by pixel patches with a memory budget              | 1       |
| [005](005-zustand-for-ui-state.md)                 | Zustand for UI state; the document lives in the core       | 1       |
| [006](006-oklch-for-palette-tools.md)              | OKLCH for palette generation                               | 3       |
| [007](007-versioned-project-format.md)             | A versioned project format with migrations                 | 4, 5    |
| [008](008-toolchain-version-constraints.md)        | Toolchain version constraints                              | 0       |
| [009](009-whole-number-device-pixel-scale.md)      | Whole-number scale in device pixels                        | 1       |
| [010](010-layers-as-replaceable-document-state.md) | Layers and selection as a replaceable document state       | 2       |
| [011](011-floating-content-transaction.md)         | Moving and pasting as one open transaction                 | 2       |
| [012](012-palette-extraction-in-a-worker.md)       | Palette extraction in a worker, file formats on demand     | 3       |
| [013](013-offline-first-and-saving.md)             | Offline first, with layered protection against losing work | 4       |
| [014](014-sharing-by-link.md)                      | Sharing a sprite inside the link                           | 4       |
| [015](015-typed-translation-catalog.md)            | A typed translation catalog                                | 4       |
| [016](016-one-cel-per-layer-per-frame.md)          | One cel per layer per frame                                | 5       |
| [017](017-gif-export-in-a-worker.md)               | GIF and spritesheet export                                 | 5       |
| [018](018-third-party-notices-from-the-build.md)   | Third-party notices generated from the build               | after 5 |
