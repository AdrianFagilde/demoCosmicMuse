import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['eslint.config.mjs'] },
  {
    ...eslintPluginReact.configs.flat.recommended,
    ...eslintPluginReact.configs.flat['jsx-runtime'],
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      // La clave debe ser 'react', no el nombre del import: las reglas que
      // extiende flat.recommended vienen con el prefijo 'react/'.
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      // Un componente JSX sin importar no lo caza no-undef (no aplica a
      // JSX) ni vite (no resuelve referencias), asi que se rompe en
      // produccion con "X is not defined". Esta regla lo para antes.
      'react/jsx-no-undef': 'error',
      // jsx-no-undef solo mira nombres de etiquetas. Un identificador libre
      // dentro de una expresion JSX (consents.privacy sin declarar) se
      // escapa de ahi y revienta en runtime. Esta config no extiende
      // eslint:recommended, asi que no-undef hay que encenderlo a mano.
      'no-undef': 'error',
    },
  },
  eslintPluginPrettierRecommended,
]
