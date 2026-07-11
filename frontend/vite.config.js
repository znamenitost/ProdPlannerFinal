import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const spritesDir = resolve(__dirname, '../sprites')
const spriteFiles = ['fon1.svg', 'fon2.svg', 'fon3.svg', 'fon5.svg', 'sun.svg', 'logo.svg', 'favicon2.svg']

function buildLoginBootstrapInjection(bootstrapJson) {
  const lines = [
    `<script type="application/json" id="login-employees-bootstrap">${bootstrapJson}</script>`,
  ]

  try {
    const employees = JSON.parse(bootstrapJson)
    const defaultEmployee = employees.find((emp) => emp.fullName === 'Дима')
      ?? employees.find((emp) => emp.id)
    if (defaultEmployee?.id && defaultEmployee?.avatarUrl) {
      lines.push(
        `<link rel="preload" as="image" href="/api/auth/avatar/${defaultEmployee.id}?w=64" fetchpriority="low" />`
      )
    }
  } catch {
    // оставляем только script-тег
  }

  return lines.join('\n    ')
}

function loginBootstrapPlugin() {
  const jsonPath = resolve(__dirname, 'public/login-employees.json')

  return {
    name: 'login-bootstrap',
    transformIndexHtml(html) {
      const bootstrapJson = existsSync(jsonPath)
        ? readFileSync(jsonPath, 'utf8').trim() || '[]'
        : '[]'
      const injection = buildLoginBootstrapInjection(bootstrapJson)
      return html.replace('<!-- LOGIN_EMPLOYEES_BOOTSTRAP -->', injection)
    },
  }
}

function spritesPlugin() {
  return {
    name: 'sprites-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/sprites/')) return next()

        const fileName = req.url.slice('/sprites/'.length).split('?')[0]
        const filePath = resolve(spritesDir, fileName)
        if (!filePath.startsWith(spritesDir) || !existsSync(filePath)) return next()

        res.setHeader('Content-Type', 'image/svg+xml')
        createReadStream(filePath).pipe(res)
      })
    },
    closeBundle() {
      const outDir = resolve(__dirname, 'dist/sprites')
      mkdirSync(outDir, { recursive: true })
      for (const name of spriteFiles) {
        cpSync(resolve(spritesDir, name), resolve(outDir, name))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), loginBootstrapPlugin(), spritesPlugin()],
  server: {
    proxy: {
      '/login-employees.json': {
        target: 'http://localhost:5234',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5234',
        changeOrigin: true,
      },
      '/notificationHub': {
        target: 'http://localhost:5234',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
