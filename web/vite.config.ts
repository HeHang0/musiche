import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { VitePWA } from 'vite-plugin-pwa';

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
  VitePWA({
    injectRegister: null,
    manifest: false,
    filename: 'worker.js',
    registerType: 'autoUpdate',
    workbox: {
      runtimeCaching: [
        {
          urlPattern: /\/version$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'version-cache'
          }
        },
        {
          urlPattern: /\/proxy/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'interface-cache'
          }
        },
        {
          urlPattern: /(.*?)\.(js|css|ts)/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'js-css-cache'
          }
        },
        {
          urlPattern: /(.*?)\.(png|jpe?g|svg|gif|bmp|psd|tiff|tga|eps)/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'image-cache'
          }
        }
      ]
    }
  }),
  VersionPlugin()
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
