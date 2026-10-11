import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'shells/default',
  base: './',
  plugins: [react()],
  build: { outDir: '../../out/shells/default', emptyOutDir: true },
});
