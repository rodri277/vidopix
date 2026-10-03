# ADR 003: Toolchain version constraints

- Status: Accepted
- Phase: 0

## Context

The spec asks for the latest stable version of every tool. At the time of Phase 0 two of the latest releases were not compatible with the rest of the toolchain:

- `typescript` 7.0.x is outside the supported peer range of `typescript-eslint` 8.71 (`>=4.8.4 <6.1.0`), which the strict type-checked lint setup depends on.
- `eslint` 10.x is outside the declared peer range of `eslint-plugin-jsx-a11y` 6.10 (`^3 ... ^9`).

## Decision

Pin `typescript` to 6.0.x and `eslint` / `@eslint/js` to 9.39.x, so `pnpm peers check` reports no issues. Everything else uses the latest stable release. Node is pinned to the active LTS (24.21.0) in `.nvmrc` and `engines`.

## Consequences

- Linting with type information keeps working, and no peer-dependency warnings are ignored.
- Revisit when `typescript-eslint` and `eslint-plugin-jsx-a11y` declare support for TypeScript 7 and ESLint 10. Dependabot will surface the updates; bump both together.
