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
const asyncJsList = [
  'magic-snowflakes',
  'qrcode',
  'crypto-js',
  'jsmediatags',
  'jsqr',
  'colorthief'
];
// https://vitejs.dev/config/
export default defineConfig({
  base: '/' + (process.env.ROUTER_PREFIX || ''),
  plugins,
  build: {
    chunkSizeWarningLimit: 1000,
    cssTarget: ['ios14', 'safari14', 'chrome80'],
    rolldownOptions: {
      checks: {
        invalidAnnotation: false
      },
      output: {
        assetFileNames(chunkInfo) {
          console.log('chunkInfo', chunkInfo.type, chunkInfo.name);
          if (chunkInfo.name?.endsWith('.css')) {
            return 'assets/[name].[hash].[ext]';
          }
          return 'assets/[name].[ext]';
        },
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name: 'optional',
              test(id) {
                const normalizedPath = path.resolve(id).replace(/\\/g, '/');
                return asyncJsList.some(moduleName =>
                  normalizedPath.includes(`/node_modules/${moduleName}/`)
                );
              },
              priority: 40
            },
            {
              name: 'room',
              test(id) {
                const normalizedPath = path.resolve(id).replace(/\\/g, '/');
                return (
                  normalizedPath.includes('/node_modules/three/') ||
                  normalizedPath.includes('/src/views/room') ||
                  normalizedPath.includes('/src/components/room/') ||
                  normalizedPath.includes('/src/components/particle/') ||
                  normalizedPath.endsWith(
                    '/src/components/player/ParticleMode.vue'
                  ) ||
                  normalizedPath.endsWith('/src/stores/room.ts') ||
                  normalizedPath.endsWith('/src/utils/room.ts') ||
                  normalizedPath.endsWith('/src/utils/room-chat-crypto.ts') ||
                  normalizedPath.endsWith('/src/utils/room-transport.ts')
                );
              },
              priority: 30
            },
            {
              name: 'app',
              test: () => true,
              priority: 10
            }
          ]
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
