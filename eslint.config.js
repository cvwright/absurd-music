import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Honour the common _ prefix convention for intentionally unused params/vars
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Prevent innerHTML/outerHTML assignments — use Lit html templates instead.
      // In a multi-user context, user-controlled strings (track titles, artist
      // names, playlist names, etc.) must never be interpolated into raw HTML.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name="innerHTML"]',
          message: 'Use Lit html`` templates instead of innerHTML to prevent stored XSS.',
        },
        {
          selector: 'AssignmentExpression[left.property.name="outerHTML"]',
          message: 'Use Lit html`` templates instead of outerHTML to prevent stored XSS.',
        },
        {
          selector: 'CallExpression[callee.property.name="insertAdjacentHTML"]',
          message: 'Use Lit html`` templates instead of insertAdjacentHTML to prevent stored XSS.',
        },
        {
          selector: 'CallExpression[callee.property.name="write"][callee.object.name="document"]',
          message: 'Use Lit html`` templates instead of document.write to prevent stored XSS.',
        },
      ],

      // Ban unsafeHTML — the only safe use is for truly static, developer-controlled
      // strings (never data from storage or external APIs).
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lit/directives/unsafe-html.js',
              message: 'unsafeHTML must not be used with untrusted content. If you need this for static developer-controlled HTML, add an eslint-disable comment explaining why.',
            },
          ],
        },
      ],
    },
  },
  {
    // Don't lint build output or dependencies
    ignores: ['dist/**', 'dev-dist/**', 'node_modules/**'],
  },
);
