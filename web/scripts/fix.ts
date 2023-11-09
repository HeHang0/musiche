import path from 'path';
import fs from 'fs';
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

function transformIndexHtmlHandler(html: string) {
  let prependedHtml = '';
  const matchLink = /<link[\s]+rel="manifest"[^>]+>/;
  if (matchLink.test(html)) {
    html = html.replace(matchLink, '');
  }
  const matchScript = /<script[\s]+id="vite\-plugin\-pwa[^>]+><\/script>/;
  if (matchScript.test(html)) {
    let scriptPwa = html.match(matchScript)[0];
    scriptPwa = scriptPwa.replace(/src="[^"]+"/, '');
    scriptPwa = scriptPwa.replace(
      '</script>',
      `
      if ('serviceWorker' in navigator) {
        let routerPrefix = localStorage.getItem('musiche-router-prefix') || '';
        if (routerPrefix) routerPrefix = '/' + routerPrefix;
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = routerPrefix + '/manifest.json';
        document.head.appendChild(link);
        window.addEventListener('load', () => {
          navigator.serviceWorker.register(routerPrefix + '/sw.js', { scope: './' });
        });
      }
    </script>`
    );
    prependedHtml += '\n    ' + scriptPwa;
    html = html.replace(matchScript, '');
  }
  return html.replace('<head>', '<head>' + prependedHtml);
}

export const FixPwaPlugin = function () {
  return <Plugin>{
    name: 'vite-plugin-fix-pwa',
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
