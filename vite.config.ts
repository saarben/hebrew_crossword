import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Project Pages URL: https://<user>.github.io/hebrew_crossword/ — assets must load under /hebrew_crossword/
export default defineConfig(({command}) => {
  return {
    // VITE_BASE lets CI publish branch previews under /hebrew_crossword/preview/<branch>/
    base: command === 'serve' ? '/' : process.env.VITE_BASE || '/hebrew_crossword/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
