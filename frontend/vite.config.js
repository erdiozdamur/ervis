import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Keep these filenames aligned with legacy deployments so mixed
        // frontend instances behind the same domain don't break module loading.
        entryFileNames: 'assets/index-CWQ6MAJC.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names && assetInfo.names[0] ? assetInfo.names[0] : assetInfo.name || '';
          if (name.endsWith('.css')) return 'assets/index-CJnW8WFL.css';
          return 'assets/[name][extname]';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
