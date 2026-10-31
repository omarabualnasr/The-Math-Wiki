import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths keep the build compatible with GitHub Pages project sites.
export default defineConfig({
  plugins: [react()],
  base: './',
});
