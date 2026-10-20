import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as { version: string }

/**
 * Lance uniquement l'interface dans un navigateur (sans Electron), pour le
 * développement de l'interface. Les fichiers passent alors par les API du
 * navigateur (sélecteur de fichier, téléchargement) : voir `platform/api.ts`.
 */
export default defineConfig({
  root: resolve(projectRoot, 'src/renderer'),
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  server: { port: 5199, strictPort: true }
})
