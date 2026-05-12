import { defineConfig } from 'vite'

// Vite configuration — to be extended with CSP/SRI in issue #15
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
