import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { VitePWA } from 'vite-plugin-pwa';

import { ZipPlugin } from './scripts/zip';
import { FixJSMediaTagsErrorPlugin, FixPwaPlugin } from './scripts/fix';

const plugins = [
  vue(),
  AutoImport({
    resolvers: [ElementPlusResolver()]
  }),
  Components({
    resolvers: [ElementPlusResolver()]
  }),
  FixJSMediaTagsErrorPlugin(),
  VitePWA({
    manifest: {
      id: 'top.picapico.musiche',
      name: 'Musiche',
      short_name: 'Musiche',
      description: '音乐播放器[支持网易云、QQ音乐、咪咕音乐].',
      start_url: '',
      scope: '.',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#000000',
      icons: [
        {
          src: 'logo-circle.png',
          type: 'image/png',
          sizes: '300x300'
        }
      ]
    },
    manifestFilename: 'manifest.json',
    includeManifestIcons: false,
    outDir: 'dist',
    includeAssets: ['logo.png'],
    registerType: 'autoUpdate',
    workbox: {
      runtimeCaching: [
        {
          urlPattern: /(.*?)\.(js|css|ts)/, // js /css /ts静态资源缓存
          handler: 'CacheFirst',
          options: {
            cacheName: 'js-css-cache'
          }
        },
        {
          urlPattern: /(.*?)\.(png|jpe?g|svg|gif|bmp|psd|tiff|tga|eps)/, // 图片缓存
          handler: 'CacheFirst',
          options: {
            cacheName: 'image-cache'
          }
        }
      ]
    }
  }),
  FixPwaPlugin()
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
