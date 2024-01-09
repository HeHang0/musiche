import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Visualizer from 'rollup-plugin-visualizer';
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
  Visualizer({
    open: true,
    gzipSize: true,
    brotliSize: true
  })
];
process.env.BUILD_ZIP === '1' && plugins.push(ZipPlugin());
// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
