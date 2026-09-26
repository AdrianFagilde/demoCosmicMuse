import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import autoprefixer from 'autoprefixer'

/**
 * Version de build, en dos pasos:
 *  1. Si el host/CI define VITE_BUILD_VERSION, se respeta.
 *  2. Si no, se deriva del HEAD de git y, en su defecto, de la marca de
 *     tiempo. Antes caia siempre en un literal ('2026.09.20') escrito a mano,
 *     de modo que todos los builds declaraban la misma version y el cache
 *     busting del service worker no podia funcionar nunca.
 */
const resolveBuildVersion = () => {
  if (process.env.VITE_BUILD_VERSION) return process.env.VITE_BUILD_VERSION
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '')
  }
}

/**
 * Vite copia public/ tal cual, asi que el service worker llega al bundle con
 * el marcador literal. Se sustituye por la version real del build para que el
 * nombre de la cache cambie en cada despliegue y `activate` purgue la anterior.
 */
const stampServiceWorker = (version) => ({
  name: 'stamp-service-worker',
  apply: 'build',
  closeBundle() {
    const swPath = path.resolve(__dirname, 'build', 'sw.js')
    try {
      const source = readFileSync(swPath, 'utf8')
      writeFileSync(
        swPath,
        source.replace("const BUILD_VERSION = 'dev'", `const BUILD_VERSION = '${version}'`),
      )
    } catch {
      // Sin build/sw.js todavia no hay nada que estampar.
    }
  },
})

export default defineConfig(() => {
  const buildVersion = resolveBuildVersion()

  return {
    base: '/',
    define: {
      'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(buildVersion),
    },
    build: {
      outDir: 'build',
    },
    css: {
      postcss: {
        plugins: [autoprefixer({})],
      },
    },
    plugins: [react(), stampServiceWorker(buildVersion)],
    resolve: {
      alias: [
        {
          find: 'src/',
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
    },
    server: {
      port: 3000,
      proxy: {},
    },
  }
})
