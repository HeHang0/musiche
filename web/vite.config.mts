import { fileURLToPath, URL } from 'node:url';
import * as path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

import { ZipPlugin, VersionPlugin } from './scripts/zip';
import { FixJSMediaTagsErrorPlugin, FixHeadPlugin } from './scripts/fix';

const plugins = [
  vue(),
  AutoImport({
    resolvers: [ElementPlusResolver()]
  }),
  Components({
    resolvers: [ElementPlusResolver()]
  }),
  FixJSMediaTagsErrorPlugin(),
  FixHeadPlugin(),
  VersionPlugin(),
  visualizer({
    open: false,
    gzipSize: true,
    brotliSize: true
  })
];
process.env.BUILD_ZIP === '1' && plugins.push(ZipPlugin());
const asyncJsList = ['magic-snowflakes', 'qrcode', 'crypto-js', 'jsmediatags'];
// https://vitejs.dev/config/
export default defineConfig({
  base: '/' + (process.env.ROUTER_PREFIX || ''),
  plugins,
  build: {
    rollupOptions: {
      output: {
        assetFileNames(chunkInfo) {
          console.log('chunkInfo', chunkInfo.type, chunkInfo.name);
          if (chunkInfo.name?.endsWith('.css')) {
            return 'assets/[name].[hash].[ext]';
          }
          return 'assets/[name].[ext]';
        },
        manualChunks(id, meta) {
          const filePath = path.resolve(id);
          const isAsync = asyncJsList.findIndex(m => filePath.includes(m)) >= 0;
          if (
            !filePath.includes('index.html') &&
            (filePath.endsWith('.css') || filePath.endsWith('.less'))
          ) {
            return 'style';
          } else if (isAsync) {
            return 'async';
          } else if (path.resolve(id).includes('node_modules')) {
            return 'modules';
          } else {
            return 'main';
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
