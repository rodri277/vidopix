import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'tools/fixtures/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.js',
            'commitlint.config.js',
            '.dependency-cruiser.cjs',
            'tools/*.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    languageOptions: { globals: {} },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    ...jsxA11y.flatConfigs.strict,
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.config.{js,ts}', 'eslint.config.js'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    files: [
      'tools/**/*.mjs',
      'eslint.config.js',
      'commitlint.config.js',
      '.dependency-cruiser.cjs',
    ],
    languageOptions: { globals: globals.node },
    ...tseslint.configs.disableTypeChecked,
  },
);
