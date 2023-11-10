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
  let indexJS = '';
  const matchIndexJS =
    /<script.+?src="\.([\S]+index[\S]+\.js)"[^>]*>[\s]*<\/script>/;
  if (matchIndexJS.test(html)) {
    indexJS = matchIndexJS.exec(html)[1];
    html = html.replace(matchIndexJS, '');
  }
  let indexCSS = '';
  const matchIndexCSS =
    /<link[\s]+rel="stylesheet"[\s]+href="\.([\S]+index[\S]+\.css)"[^>]*>/;
  if (matchIndexCSS.test(html)) {
    indexCSS = matchIndexCSS.exec(html)[1];
    html = html.replace(matchIndexCSS, '');
  }
  const matchScript = /<script[\s]+id="vite\-plugin\-pwa[^>]+><\/script>/;
  if (matchScript.test(html)) {
    let scriptPwa = html.match(matchScript)[0];
    scriptPwa = scriptPwa.replace(/src="[^"]+"/, '');
    scriptPwa = scriptPwa.replace(
      '</script>',
      `
      let routerPrefix = localStorage.getItem('musiche-router-prefix') || '';
      if (routerPrefix) routerPrefix = '/' + routerPrefix;
      const indexJS = '${indexJS}';
      const indexCSS = '${indexCSS}';
      if(indexJS){
        const indexScript = document.createElement('script');
        indexScript.type = 'module';
        indexScript.crossorigin = "anonymous";
        indexScript.src = routerPrefix + indexJS;
        document.head.appendChild(indexScript);
      }
      if(indexCSS){
        const indexStyle = document.createElement('link');
        indexStyle.rel = 'stylesheet';
        indexStyle.href = routerPrefix + indexCSS;
        document.head.appendChild(indexStyle);
      }
      const iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.href = routerPrefix + '/logo-circle.png';
      document.head.appendChild(iconLink);
      function registerSW(){
        navigator.serviceWorker.register(routerPrefix + '/sw.js', { scope: './' });
        window.removeEventListener('load', registerSW);
        document.getElementById('vite-plugin-pwa:register-sw').remove();
      }
      if ('serviceWorker' in navigator) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = routerPrefix + '/manifest.json';
        document.head.appendChild(link);
        window.addEventListener('load', registerSW);
      }else {
        document.getElementById('vite-plugin-pwa:register-sw').remove();
      }
    </script>`
    );
    prependedHtml += scriptPwa + '    \n';
    html = html.replace(matchScript, '');
    html = html.replace(/[\n]{2,}/g, '\n');
  }
  return html.replace('</head>', prependedHtml + '</head>');
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
