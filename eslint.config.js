import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      // Phaser-Klassen nutzen Definite-Assignment in create() - bewusst erlaubt.
      '@typescript-eslint/no-non-null-assertion': 'off',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Build-Skripte laufen in Node, nicht im Browser. Dort sind `Buffer` und
    // `console` selbstverstaendlich - und Ausgabe ist ihr Zweck, keine
    // vergessene Debug-Zeile.
    //
    // `fetch`, `URL` und die Timer sind seit Node 18 ebenfalls global; das
    // Projekt verlangt >= 20 (siehe package.json "engines").
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        // `window` und `navigator` sind hier keine Node-Globals: die an
        // page.evaluate() uebergebenen Funktionen werden als Quelltext in den
        // Browser geschickt und laufen dort (scripts/playtest.mjs).
        window: 'readonly',
        navigator: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
);
