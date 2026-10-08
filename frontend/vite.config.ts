import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

function localApiLauncher() {
  let apiProcess: ChildProcess | undefined
  let output = ''
  const backendDirectory = fileURLToPath(new URL('../backend', import.meta.url))
  const apiUrl = process.env.VITE_API_URL || 'http://127.0.0.1:8000'

  return {
    name: 'local-file-organizer-api-launcher',
    configureServer(server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void }; httpServer?: { once: (event: string, callback: () => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/__local/start-api' || req.method !== 'POST') return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')

        const respond = (status: number, body: object) => {
          res.statusCode = status
          res.end(JSON.stringify(body))
        }
        const waitUntilReady = async () => {
          const deadline = Date.now() + 25000
          while (Date.now() < deadline) {
            if (apiProcess?.exitCode !== null && apiProcess?.exitCode !== undefined) {
              throw new Error(output.trim() || `Python exited with code ${apiProcess.exitCode}.`)
            }
            try {
              const response = await fetch(apiUrl, { signal: AbortSignal.timeout(1000) })
              if (response.ok) return
            } catch { /* The backend is still starting. */ }
            await new Promise((resolve) => setTimeout(resolve, 400))
          }
          throw new Error(`Timed out waiting for ${apiUrl}. ${output.trim()}`.trim())
        }

        void (async () => {
          try {
            const existing = await fetch(apiUrl, { signal: AbortSignal.timeout(1200) }).catch(() => null)
            if (existing?.ok) return respond(200, { started: false, message: 'The API is already running.' })
            if (!apiProcess || apiProcess.exitCode !== null) {
              output = ''
              const python = process.env.FILE_ORGANIZER_PYTHON || (process.platform === 'win32' ? 'py' : 'python3')
              apiProcess = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', new URL(apiUrl).port || '8000'], {
                cwd: path.resolve(backendDirectory),
                windowsHide: true,
                env: { ...process.env, PYTHONUNBUFFERED: '1' },
                stdio: ['ignore', 'pipe', 'pipe'],
              })
              const collect = (chunk: Buffer) => { output = `${output}${chunk.toString()}`.slice(-6000) }
              apiProcess.stdout?.on('data', collect)
              apiProcess.stderr?.on('data', collect)
              apiProcess.once('error', (error) => { output = error.message })
            }
            await waitUntilReady()
            respond(200, { started: true, message: 'The API is running.' })
          } catch (error) {
            respond(500, { started: false, detail: error instanceof Error ? error.message : 'Could not start the API.' })
          }
        })()
      })
      server.httpServer?.once('close', () => { apiProcess?.kill() })
    },
  }
}

export default defineConfig({ plugins: [react(), localApiLauncher() as import('vite').Plugin], server: { host: '127.0.0.1', port: 5173 } })
