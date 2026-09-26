/**
 * Versión de build usada para forzar cache busting (data-build-version).
 * Fuente de verdad única: la variable VITE_BUILD_VERSION, que vite.config.mjs
 * define en cada build a partir de VITE_BUILD_VERSION del entorno, del HEAD
 * de git o de la marca de tiempo. Nunca depender de literales repartidos.
 */
export const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || 'dev'

export const buildHash = `v${BUILD_VERSION}`
