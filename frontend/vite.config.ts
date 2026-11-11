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
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              priority: 50,
            },
            {
              name: 'vendor-supabase',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 40,
            },
            {
              name: 'vendor-markdown',
              test: /[\\/]node_modules[\\/](react-markdown|remark-gfm|remark-math|remark-breaks|rehype-katex|katex)[\\/]/,
              priority: 35,
            },
            {
              name: 'vendor-query',
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-ui',
              test: /[\\/]node_modules[\\/](@radix-ui|@floating-ui|lucide-react|sonner|class-variance-authority|clsx|tailwind-merge|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|aria-hidden|get-nonce)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
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
