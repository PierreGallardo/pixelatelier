import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as { version: string }

/**
 * Politique de sécurité du contenu, ajoutée uniquement à la version construite
 * (le serveur de développement a besoin de scripts injectés pour le rechargement à chaud).
 */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"

function contentSecurityPolicy(): Plugin {
  return {
    name: 'pixelatelier-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
    }
  }
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(projectRoot, 'src/main/index.ts') } }
    }
  },
  preload: {
    build: {
      rollupOptions: { input: { index: resolve(projectRoot, 'src/preload/index.ts') } }
    }
  },
  renderer: {
    root: resolve(projectRoot, 'src/renderer'),
    build: {
      minify: true,
      rollupOptions: { input: { index: resolve(projectRoot, 'src/renderer/index.html') } }
    },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [react(), contentSecurityPolicy()]
  }
})
