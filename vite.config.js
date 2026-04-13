import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV !== 'production';

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const plugins = [vue()];
  if (isDev) {
    const { default: mkcert } = await import('vite-plugin-mkcert');
    plugins.push(mkcert());
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      https: isDev ? {
        host: 'localhost',
        port: 5173,
      } : undefined,
    }
  };
})
