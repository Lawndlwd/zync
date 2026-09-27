import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  sortImports: {},
  ignorePatterns: [
    '**/*.md',
    '**/*.css',
    '**/*.html',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    'pnpm-lock.yaml',
    'data/**',
    '**/dist/**',
  ],
})
