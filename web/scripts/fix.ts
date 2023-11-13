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
    /[\s]*<link[\s]+rel="stylesheet"[\s]+href="\.*([\S]+index[\S]+\.css)"[^>]*>.*[\n]*/;
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
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = routerPrefix + '/manifest.json';
      document.head.appendChild(manifestLink);
      if(routerPrefix){
        const iconLink = document.querySelector('link[rel="icon"]');
        if(iconLink)iconLink.href = routerPrefix + iconLink.href;
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if(manifestLink)manifestLink.href = routerPrefix + manifestLink.href;
      }
      ${indexJS}${indexCSS}
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
