import { defineConfig } from 'oxlint'

// Every rule here is an error: `pnpm lint` must print nothing. Fix the code, don't disable the rule;
// a disable comment needs a reason (`// oxlint-disable-next-line rule -- why`).
export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'promise', 'node'],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'error',
  },
  options: {
    typeAware: true,
    reportUnusedDisableDirectives: 'error',
  },
  env: { builtin: true, es2024: true },
  settings: { react: { version: '19.3' } },
  ignorePatterns: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'data/**', '**/*.d.ts'],
  rules: {
    // ── language ──
    'eslint/eqeqeq': ['error', 'always', { null: 'ignore' }],
    'eslint/no-var': 'error',
    'eslint/prefer-const': 'error',
    'eslint/no-param-reassign': 'error',
    'eslint/no-else-return': 'error',
    'eslint/no-lonely-if': 'error',
    'eslint/no-useless-rename': 'error',
    'eslint/no-useless-return': 'error',
    'eslint/prefer-template': 'error',
    'eslint/object-shorthand': 'error',
    'eslint/no-console': ['error', { allow: ['warn', 'error'] }],
    'eslint/no-shadow': 'error',
    'eslint/no-implicit-coercion': ['error', { allow: ['!!'] }],
    'eslint/no-promise-executor-return': 'error',
    'eslint/no-useless-assignment': 'error',

    // ── typescript (type-aware) ──
    'typescript/no-explicit-any': 'error',
    'typescript/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    'typescript/consistent-type-definitions': ['error', 'type'],
    'typescript/array-type': ['error', { default: 'array-simple' }],
    'typescript/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    'typescript/await-thenable': 'error',
    'typescript/no-unnecessary-condition': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    // `str || fallback` deliberately treats '' as missing; only nullable objects/numbers must use ??.
    'typescript/prefer-nullish-coalescing': ['error', { ignorePrimitives: { string: true, boolean: true } }],
    'typescript/prefer-optional-chain': 'error',
    'typescript/switch-exhaustiveness-check': 'error',
    'typescript/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
    'typescript/only-throw-error': 'error',
    'typescript/return-await': ['error', 'in-try-catch'],
    'typescript/use-unknown-in-catch-callback-variable': 'error',
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-non-null-asserted-optional-chain': 'error',
    'typescript/prefer-find': 'error',
    // tsc's noImplicitReturns covers this, and understands exhaustive switches.
    'typescript/consistent-return': 'off',
    'typescript/require-array-sort-compare': ['error', { ignoreStringArrays: true }],

    // ── unicorn / oxc ──
    'unicorn/prefer-node-protocol': 'error',
    'unicorn/catch-error-name': ['error', { name: 'err', ignore: ['^caught$'] }],
    'unicorn/no-nested-ternary': 'off',
    'unicorn/prefer-at': 'error',
    'unicorn/prefer-string-replace-all': 'error',
    'unicorn/prefer-array-flat-map': 'error',
    'unicorn/prefer-array-some': 'error',
    'unicorn/prefer-string-slice': 'error',
    'unicorn/no-array-for-each': 'off',
    'oxc/no-accumulating-spread': 'error',
    'oxc/no-map-spread': 'error',
    'oxc/no-barrel-file': 'off',
    // Express 5 forwards rejected promises from async handlers to the error middleware.
    'oxc/no-async-endpoint-handlers': 'off',
    // Sequential awaits are deliberate in file walks (ordering, bounded fd use); parallelize hot paths by hand.
    'eslint/no-await-in-loop': 'off',

    // ── imports ──
    'import/no-cycle': 'error',
    'import/no-self-import': 'error',
    'import/no-duplicates': 'error',

    // ── promises ──
    'promise/param-names': 'error',
    'promise/no-return-wrap': 'error',
  },
  overrides: [
    {
      files: ['packages/web/**/*.{ts,tsx}'],
      plugins: ['react', 'react-perf', 'jsx-a11y'],
      env: { browser: true },
      rules: {
        // Rules of hooks + React Compiler rules.
        'react/rules-of-hooks': 'error',
        'react/exhaustive-deps': 'error',
        'react/purity': 'error',
        'react/refs': 'error',
        'react/immutability': 'error',
        'react/set-state-in-effect': 'error',
        'react/set-state-in-render': 'error',
        'react/static-components': 'error',
        'react/no-deriving-state-in-effects': 'error',
        'react/preserve-manual-memoization': 'error',
        'react/globals': 'error',
        'react/incompatible-library': 'error',
        // JSX
        'react/jsx-key': 'error',
        'react/jsx-no-useless-fragment': 'error',
        'react/self-closing-comp': 'error',
        'react/jsx-boolean-value': 'error',
        'react/jsx-curly-brace-presence': 'error',
        'react/jsx-fragments': ['error', 'syntax'],
        // Render props and handlers that build JSX are fine; only inline component definitions are flagged.
        'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
        'react/jsx-no-constructed-context-values': 'error',
        'react/jsx-no-target-blank': 'error',
        'react/jsx-no-script-url': 'error',
        'react/no-danger': 'off',
        'react/react-in-jsx-scope': 'off',
        // Fast-refresh granularity only; view files export small helpers next to their component.
        'react/only-export-components': 'off',
        // The React Compiler memoizes props; these would only add noise.
        'react-perf/jsx-no-new-object-as-prop': 'off',
        'react-perf/jsx-no-new-array-as-prop': 'off',
        'react-perf/jsx-no-new-function-as-prop': 'off',
        'react-perf/jsx-no-jsx-as-prop': 'off',
        // a11y: keyboard + labels. The app's custom widgets carry their own roles/handlers.
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/anchor-is-valid': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/no-autofocus': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
        'jsx-a11y/no-noninteractive-element-interactions': 'off',
        'jsx-a11y/label-has-associated-control': 'off',
        // Custom widgets (rows, chips, cards) keep div + role so layout and drag behavior stay as designed.
        'jsx-a11y/prefer-tag-over-role': 'off',
      },
    },
    {
      files: ['**/*.test.{ts,tsx}'],
      plugins: ['vitest'],
      rules: {
        'vitest/no-focused-tests': 'error',
        'vitest/no-disabled-tests': 'error',
        'vitest/expect-expect': 'error',
        'vitest/valid-expect': 'error',
        'vitest/no-identical-title': 'error',
        'vitest/no-conditional-expect': 'error',
        'vitest/no-standalone-expect': 'error',
        'vitest/prefer-to-be': 'error',
        'vitest/prefer-to-have-length': 'error',
        'vitest/consistent-test-it': ['error', { fn: 'it' }],
        'typescript/no-non-null-assertion': 'off',
        'typescript/no-explicit-any': 'off',
        'typescript/no-unsafe-type-assertion': 'off',
      },
    },
    {
      // Entrypoints and CLIs talk on stdout.
      files: [
        'packages/api/src/index.ts',
        'packages/jobs/src/scheduler.ts',
        'packages/jobs/src/mcp.ts',
        'opencode/**',
        'scripts/**',
      ],
      rules: { 'eslint/no-console': 'off' },
    },
  ],
})
