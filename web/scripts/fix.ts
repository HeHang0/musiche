import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import { Plugin } from 'vite';

function fixJSMediaTagsError() {
  try {
    const packageJsonPath = path.resolve(
      __dirname,
      '../node_modules/jsmediatags/package.json'
    );
    const packageJsonString = fs.readFileSync(packageJsonPath, {
      encoding: 'utf8'
    });
    const packageJson = JSON.parse(packageJsonString);
    packageJson.browser = packageJson.browser.replace(
      'jsmediatags.js',
      'jsmediatags.min.js'
    );
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson), {
      encoding: 'utf8'
    });
  } catch {}
}

export const FixJSMediaTagsErrorPlugin = function () {
  return {
    name: 'vite-plugin-fix-jsmediatags',
    buildStart: fixJSMediaTagsError
  };
};

export function getHash(text: Buffer | string, length = 8): string {
  const h = createHash('sha256')
    .update(text)
    .digest('hex')
    .substring(0, length);
  if (length <= 64) return h;
  return h.padEnd(length, '_');
}

function fixWorkerJS(): string {
  const distPath = path.resolve('dist');
  const workerPath = path.resolve(distPath, 'musiche.worker.js');
  if (fs.existsSync(workerPath)) {
    const workerJS = fs.readFileSync(workerPath, { encoding: 'utf8' });
    const hash = getHash(workerJS);
    const workerName = `musiche.worker-${hash}.js`;
    const workerNamePath = path.resolve(distPath, workerName);
    fs.renameSync(workerPath, workerNamePath);
    let routerPrefix = process.env.ROUTER_PREFIX
      ? `/${process.env.ROUTER_PREFIX}`
      : '';
    return `window.serviceWorkerJS = "${routerPrefix}/${workerName}";`;
  }
  return '';
}

function transformIndexHtmlHandler(html: string) {
  const workerJS = fixWorkerJS();
  html = html.replace(
    '</head>',
    `  <script>${workerJS}</script>
  </head>`
  );
  return html;
}

export const FixHeadPlugin = function () {
  return <Plugin>{
    name: 'vite-plugin-fix-head',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return transformIndexHtmlHandler(html);
      }
    }
  };
};
