import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, '../shared'),
      zod: path.resolve(import.meta.dirname, './node_modules/zod'),
    },
    dedupe: ['zod', 'react', 'react-dom'],
  },
  server: {
    port: 5173,
    fs: {
      allow: [
        path.resolve(import.meta.dirname, '.'),
        path.resolve(import.meta.dirname, '../shared'),
      ],
    },
  },
});
