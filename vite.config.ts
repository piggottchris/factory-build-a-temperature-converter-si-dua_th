import { defineConfig } from 'vite'

// Vite configuration — to be extended with CSP/SRI in issue #15
export default defineConfig({
  // root defaults to project root so /src/main.ts resolves correctly from index.html
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
