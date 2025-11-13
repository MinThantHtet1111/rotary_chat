// vite.config.js
import { defineConfig } from 'vite';                 // ← quotes added
import polyfillNode from 'rollup-plugin-polyfill-node';

export default defineConfig({
  plugins: [polyfillNode()],
  resolve: {
    alias: {
      os: 'os-browserify/browser',
      process: 'process/browser'
    }
  },
  optimizeDeps: {
    include: ['os-browserify', 'process']
  },
  define: {
    'process.env': {}
  }
});
