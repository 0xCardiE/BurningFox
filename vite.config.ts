import { defineConfig, build as viteBuild, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Content + inpage run as Chrome content scripts (no ES module loader).
 * Bundle each as a self-contained IIFE after the main extension build.
 */
function buildContentScripts(): Plugin {
  let nested = false;
  return {
    name: 'build-content-scripts',
    apply: 'build',
    async closeBundle() {
      if (nested) return;
      nested = true;
      try {
        for (const [name, entry] of [
          ['content', 'src/content/inject.ts'],
          ['inpage', 'src/inpage/provider.ts'],
        ] as const) {
          await viteBuild({
            configFile: false,
            root,
            publicDir: false,
            logLevel: 'warn',
            build: {
              outDir: join(root, 'dist'),
              emptyOutDir: false,
              sourcemap: false,
              target: 'es2020',
              rollupOptions: {
                input: join(root, entry),
                output: {
                  format: 'iife',
                  entryFileNames: `${name}.js`,
                  inlineDynamicImports: true,
                  name: `L33t_${name}`,
                },
              },
            },
          });
        }
      } finally {
        nested = false;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), buildContentScripts()],
  root,
  publicDir: 'public',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: join(root, 'index.html'),
        background: join(root, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
