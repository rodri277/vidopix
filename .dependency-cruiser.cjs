const { join } = require('node:path');

/** Architecture boundaries from SPEC.md section 4. Enforced in CI via `pnpm deps:check`. */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-web',
      comment: 'packages/core is pure domain code and must not depend on the web app.',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: { path: '^apps/' },
    },
    {
      name: 'core-must-not-import-ui-or-dom-libraries',
      comment: 'packages/core must stay free of React and any browser-bound library.',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: { path: 'node_modules/(react|react-dom|zustand|idb|lucide-react)(/|$)' },
    },
    {
      name: 'features-must-not-import-each-other',
      comment: 'Features share code only through state/ or design-system/.',
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: { path: '^apps/web/src/features/', pathNot: '^apps/web/src/features/$1/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: join(__dirname, 'tsconfig.base.json') },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$|/e2e/' },
  },
};
