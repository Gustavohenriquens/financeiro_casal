import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } }, // evita carregar um postcss.config de pastas acima do projeto
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
});
