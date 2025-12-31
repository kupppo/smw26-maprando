import path from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(() => {
  return {
    test: {
      environment: 'node',
      globals: true,
      env: loadEnv('test', process.cwd(), ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }
})
