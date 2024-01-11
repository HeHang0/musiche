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
    apply: 'build',
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
  const workerPath = path.resolve(distPath, 'worker.js');
  if (fs.existsSync(workerPath)) {
    const workerJS = fs.readFileSync(workerPath, { encoding: 'utf8' });
    const hash = getHash(workerJS);
    const workerName = `worker-${hash}.js`;
    const workerNamePath = path.resolve(distPath, workerName);
    fs.renameSync(workerPath, workerNamePath);
    return `window.serviceWorkerJS = "${workerName}";`;
  }
  return '';
}

function transformIndexHtmlHandler(html: string) {
  const workerJS = fixWorkerJS();
  let indexJS = '';
  const matchIndexJS =
    /[\s]*<script.+?src="\.*([\S]+index[\S]+\.js)"[^>]*>[\s]*<\/script>.*[\n]*/;
  if (matchIndexJS.test(html)) {
    indexJS = `
      const indexScript = document.createElement('script');
      indexScript.type = 'module';
      indexScript.crossorigin = "anonymous";
      indexScript.src = routerPrefix + '${matchIndexJS.exec(html)[1]}';
      document.head.appendChild(indexScript);`;
    html = html.replace(matchIndexJS, '');
  }
  let indexCSS = '';
  const matchIndexCSS =
    /[\s]*<link[\s]+rel="stylesheet"[\s]*[\S]*[\s]*href="\.*([\S]+index[\S]+\.css)"[^>]*>.*[\n]*/;
  if (matchIndexCSS.test(html)) {
    indexCSS = `
      const indexStyle = document.createElement('link');
      indexStyle.rel = 'stylesheet';
      indexStyle.href = routerPrefix + '${matchIndexCSS.exec(html)[1]}';
      document.head.appendChild(indexStyle);`;
    html = html.replace(matchIndexCSS, '');
  }
  html = html.replace(
    '</head>',
    `
    <script id="musiche-script-fix">
      let routerPrefix = localStorage.getItem('musiche-router-prefix') || '';
      if (routerPrefix) routerPrefix = '/' + routerPrefix;
      const iconLink = document.querySelector('link[rel="icon"]');
      if(iconLink) iconLink.href = routerPrefix + '/logo-circle.png';
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if(manifestLink) manifestLink.href = location.origin + routerPrefix + '/manifest.json';
      ${workerJS}
      ${indexCSS}${indexJS}
      document.getElementById('musiche-script-fix').remove();
    </script>
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
