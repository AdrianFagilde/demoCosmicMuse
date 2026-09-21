/**
 * Versión de build usada para forzar cache busting (data-build-version).
 * Fuente de verdad única: la variable VITE_BUILD_VERSION (definida en el
 * host/CI al construir); si no está, se usa una fecha por defecto.
 * Nunca depender de múltiples hardcodes repartidos por las vistas.
 */
export const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || '2026.09.20'

export const buildHash = `v${BUILD_VERSION}`
