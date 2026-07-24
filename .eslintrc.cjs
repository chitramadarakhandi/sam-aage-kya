module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'server'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    // Advisory HMR-only hint; not a correctness issue. Off so CI (--max-warnings 0) stays green.
    'react-refresh/only-export-components': 'off',
    'react/prop-types': 'off',
    // Cosmetic in JSX text (apostrophes/quotes render fine in React). Disabling
    // avoids noisy escaping like &apos; throughout user-facing copy.
    'react/no-unescaped-entities': 'off',
    // Allow intentionally-empty catch blocks (used for best-effort operations).
    'no-empty': ['error', { allowEmptyCatch: true }],
    // Unused function args are fine if prefixed with _ (e.g. event handlers).
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
}
