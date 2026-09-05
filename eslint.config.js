import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `playtest-shots/` ist git-ignoriert und enthaelt Screenshots sowie
  // wegwerfbare Reproduktionsskripte aus Audits. Ohne diesen Eintrag machte
  // ein liegengebliebenes Skript den Lint rot, obwohl es nie ausgeliefert
  // wird (bemerkt 2026-09-05).
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'playtest-shots/**'] },
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
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // `window` und `navigator` sind hier keine Node-Globals: die an
        // page.evaluate() uebergebenen Funktionen werden als Quelltext in den
        // Browser geschickt und laufen dort (scripts/playtest.mjs).
        window: 'readonly',
        navigator: 'readonly',
        document: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
);
