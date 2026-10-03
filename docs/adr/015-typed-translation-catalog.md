# ADR 015: A typed translation catalog

- Status: Accepted
- Phase: 4

## Context

The interface must be available in English and Spanish, and adding a text in one language and forgetting the other should not be possible to ship.

## Decision

- All interface text lives in `i18n/en.ts` (the reference) and `i18n/es.ts`. `es.ts` is typed `Record<keyof en, string>`, so a missing translation is a compile error. `{name}` placeholders are filled by `translate`, and a test checks that both languages use the same placeholders and that no text is empty.
- Components call `useT()`; the store has `t()` for messages it creates. The language is the one the user chose, else the browser's (any `es` variant gives Spanish), else English. The choice is stored in `localStorage` and also sets `<html lang>`.
- The engine in `packages/core` stays free of user-facing text. It names undoable steps in English ("Pencil", "Add layer") and reports reasons as codes; `history-labels.ts` maps those to catalog keys, and a test runs the real operations to make sure every name the engine produces has a translation.
- The shortcuts help is generated from one table that a test checks against the real shortcut resolver.

## Alternatives considered

- **An i18n library.** More features (plurals, formatting) than needed for two languages, plus a dependency.
- **Translating inside the engine.** Would tie the domain code to the interface and to locale data.

## Consequences

- Error details that come from file parsers (for example "Expected three numbers") are technical and stay in English inside a translated sentence.
- Plurals are handled with separate keys where they matter (`notice.replacedOne` and `notice.replacedMany`).
